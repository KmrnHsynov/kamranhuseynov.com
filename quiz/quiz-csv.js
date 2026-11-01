'use strict';

// Imports questions from a CSV file in the layout of Kahoot's question spreadsheet:
//   Question | Answer 1 .. Answer 4 | Time limit | Correct answer(s)
// plus optional columns of our own: Type, Points, Topic, and a fifth answer.
// Headers are matched loosely (case, accents, and trailing text like "- max 120 characters" are ignored),
// in English or Azerbaijani, and the instruction rows Kahoot puts above the header are skipped.
// Pure functions: no DOM, so they run in Node tests.

const CSV_MAX_ROWS = 2000;
const CSV_LIMITS = { question: 1000, option: 300, answer: 300, topic: 200 };

// ── reading the file ──────────────────────────────────

function csvParseRows(text, delim){
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i + 1] === '"'){ cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if(c === '"' && cell === ''){
      inQuotes = true;
    } else if(c === delim){
      row.push(cell); cell = '';
    } else if(c === '\n' || c === '\r'){
      if(c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// Lower case, no accents, Azerbaijani letters folded: "Düzgün Cavab" -> "duzgun cavab".
function csvFold(s){
  return String(s == null ? '' : s)
    .replace(/[ıİ]/g, 'i').replace(/[əƏ]/g, 'e')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

// Works out which column holds what. Returns null when this row is not a header.
function csvMapHeader(cells){
  const map = { question: null, answers: [null, null, null, null, null], correct: null, type: null, points: null, topic: null };
  cells.forEach((raw, i) => {
    const h = csvFold(raw);
    if(!h) return;
    let m;
    if(/(correct|duzgun|dogru cavab|right answer)/.test(h)){ if(map.correct === null) map.correct = i; }
    else if((m = h.match(/^(answer|cavab|variant|option|secim)\s*([1-5])\b/))){ map.answers[Number(m[2]) - 1] = i; }
    else if(/^(question|sual)\b/.test(h)){ if(map.question === null) map.question = i; }
    else if(/^(type|tip|nov)\b/.test(h)){ if(map.type === null) map.type = i; }
    else if(/^(points?|xal|bal)\b/.test(h)){ if(map.points === null) map.points = i; }
    else if(/^(topic|movzu)\b/.test(h)){ if(map.topic === null) map.topic = i; }
    // "Time limit" and anything else is ignored: the whole exam has one timer here.
  });
  const answerCols = map.answers.filter(i => i !== null).length;
  if(map.question === null || (answerCols < 2 && map.correct === null)) return null;
  return map;
}

// Excel in an Azerbaijani region writes ';', Kahoot and Sheets write ','. Pick the one that gives a header.
function csvFindTable(text){
  let best = null;
  for(const delim of [',', ';', '\t']){
    const table = csvFindTableInRows(csvParseRows(text, delim));
    if(table && (!best || table.width > best.width)) best = table;
  }
  return best;
}

// The header is somewhere in the first rows (Kahoot puts instructions above it).
function csvFindTableInRows(rows){
  for(let r = 0; r < Math.min(rows.length, 25); r++){
    const map = csvMapHeader(rows[r]);
    if(map) return { rows, headerRow: r, map, width: rows[r].length };
  }
  return null;
}

// ── turning rows into questions ───────────────────────

// Reading a true/false answer cell is generous (Bəli/Xeyr, Yes/No are fine when the type says true/false).
const CSV_TRUE = /^(true|dogru|beli|yes)$/;
const CSV_FALSE = /^(false|yanlis|xeyr|no)$/;
// Deciding that a question IS true/false from its two answers is strict.
const CSV_TRUE_WORD = /^(true|dogru)$/;
const CSV_FALSE_WORD = /^(false|yanlis)$/;

function csvType(raw){
  const t = csvFold(raw);
  if(!t) return '';
  if(/^(mc|multiple|coxsecimli|quiz|choice)/.test(t)) return 'mc';
  if(/^(tf|true|dogru|bool)/.test(t)) return 'tf';
  if(/^(short|qisa|text|open)/.test(t)) return 'short';
  if(/^(fill|bosluq|blank)/.test(t)) return 'fill';
  return '';
}

function csvLimit(s, n){ return String(s).slice(0, n); }

function csvRowToQuestion(cells, map){
  const get = i => (i === null || i === undefined) ? '' : String(cells[i] == null ? '' : cells[i]).trim();
  const text = csvLimit(get(map.question), CSV_LIMITS.question);
  if(!text) return { question: null, hadContent: cells.some(c => String(c).trim() !== '') };

  const options = map.answers.map(i => csvLimit(get(i), CSV_LIMITS.option));
  const filled = options.map((a, i) => ({ a, i })).filter(x => x.a);
  const correctRaw = get(map.correct);
  const warnings = [];

  let type = csvType(get(map.type));
  if(!type){
    if(filled.length >= 2){
      const words = filled.map(x => csvFold(x.a));
      // Strict on purpose: only True/False or Doğru/Yanlış make it a true/false question,
      // so a Yes/No multiple-choice question is not turned into Doğru/Yanlış.
      type = filled.length === 2 && words.some(w => CSV_TRUE_WORD.test(w)) && words.some(w => CSV_FALSE_WORD.test(w)) ? 'tf' : 'mc';
    } else type = /\[blank\]/i.test(text) ? 'fill' : 'short';
  }

  const pts = Math.round(Number(get(map.points)));
  const q = {
    type, text, options: ['', '', '', '', ''], correctOption: 0, tfAnswer: true, shortAnswer: '',
    fillText: '', fillAnswers: [], points: pts >= 1 ? Math.min(100, pts) : 1,
    topic: csvLimit(get(map.topic), CSV_LIMITS.topic), needsReview: false
  };

  if(type === 'mc'){
    if(filled.length < 2){ q.needsReview = true; warnings.push('cavab variantları çatışmır'); }
    // Blank answer columns are dropped, so "correct answer 3" has to follow its option to its new place.
    const newIndex = {};
    filled.slice(0, 5).forEach((x, n) => { q.options[n] = x.a; newIndex[x.i] = n; });
    const hits = [];
    correctRaw.split(/[,;/\s]+/).filter(Boolean).forEach(tok => {
      let idx = -1;
      if(/^[1-5]$/.test(tok)) idx = Number(tok) - 1;
      else if(/^[a-eA-E]$/.test(tok)) idx = 'abcde'.indexOf(tok.toLowerCase());
      if(idx >= 0 && newIndex[idx] !== undefined && !hits.includes(newIndex[idx])) hits.push(newIndex[idx]);
    });
    if(!hits.length && correctRaw){
      // The cell may hold the option's own text instead of its number.
      const n = q.options.findIndex(o => o && csvFold(o) === csvFold(correctRaw));
      if(n >= 0) hits.push(n);
    }
    if(!hits.length){ q.needsReview = true; warnings.push('düzgün cavab müəyyən edilmədi'); }
    else {
      q.correctOption = hits[0];
      if(hits.length > 1){ q.needsReview = true; warnings.push('bir neçə düzgün cavab göstərilib, yalnız birincisi götürüldü'); }
    }
  } else if(type === 'tf'){
    let word = csvFold(correctRaw);
    // Kahoot-style True/False: "Answer 1 = True, Answer 2 = False, correct = 2"
    if(/^[1-5]$/.test(word) && options[Number(word) - 1]) word = csvFold(options[Number(word) - 1]);
    if(CSV_TRUE.test(word)) q.tfAnswer = true;
    else if(CSV_FALSE.test(word)) q.tfAnswer = false;
    else { q.needsReview = true; warnings.push('Doğru/Yanlış cavabı müəyyən edilmədi'); }
  } else {
    // Written answers: the Correct column, or the answer columns taken as accepted alternatives.
    const written = csvLimit(correctRaw || filled.map(x => x.a).join(', '), CSV_LIMITS.answer);
    if(type === 'short') q.shortAnswer = written;
    else {
      q.fillText = text;
      q.fillAnswers = [written];
      if((text.match(/\[blank\]/gi) || []).length > 1){ q.needsReview = true; warnings.push('yalnız bir [blank] dəstəklənir'); }
      if(!/\[blank\]/i.test(text)){ q.needsReview = true; warnings.push('mətndə [blank] yoxdur'); }
    }
    if(!written.trim()){ q.needsReview = true; warnings.push('düzgün cavab yoxdur'); }
  }
  return { question: q, warnings };
}

const CSV_HEADER_ERROR = 'Başlıq sətri tapılmadı. Faylda "Question" (və ya "Sual") və "Answer 1" (və ya "Cavab 1") sütunları olmalıdır. Şablonu yükləyib istifadə edə bilərsiniz.';
const CSV_BOM = String.fromCharCode(0xFEFF);
// What the browser puts in for bytes it could not read as UTF-8 (a file saved in an old encoding).
const CSV_BAD_CHAR = String.fromCharCode(0xFFFD);

// A file saved in an old encoding shows up as U+FFFD, or, for letters like ə ş ı ğ that the old
// encoding has no code for, as a "?" in the middle of a word. A few of those in a row is not a URL.
function csvLooksDamaged(text){
  return text.includes(CSV_BAD_CHAR) || (text.match(/\p{L}\?\p{L}/gu) || []).length >= 3;
}

// A table (header position + column map) -> questions. Shared by the CSV and the .xlsx readers.
function csvTableToQuestions(table, encodingProblem){
  const questions = [], warnings = [];
  let skipped = 0;
  const body = table.rows.slice(table.headerRow + 1, table.headerRow + 1 + CSV_MAX_ROWS);
  body.forEach(cells => {
    const res = csvRowToQuestion(cells, table.map);
    if(!res.question){ if(res.hadContent) skipped++; return; }
    questions.push(res.question);
    if(res.warnings.length) warnings.push(`Sual ${questions.length}: ${res.warnings.join('; ')}`);
  });
  if(!questions.length) throw new Error('Faylda sual tapılmadı.');
  return { questions, skipped, warnings, encodingProblem };
}

// text -> { questions, skipped, warnings:[ "Sual 3: ..." ], encodingProblem }, or throws an Error with a message for the teacher.
function parseQuestionsCsv(text){
  const clean = String(text || '').split(CSV_BOM).join('');
  const table = csvFindTable(clean);
  if(!table) throw new Error(CSV_HEADER_ERROR);
  return csvTableToQuestions(table, csvLooksDamaged(clean));
}

// [{ name, rows }] from a workbook -> the same result, using the first sheet that has a header row.
function parseQuestionsSheets(sheets){
  for(const sheet of sheets){
    const rows = sheet.rows.filter(r => r.some(c => String(c).trim() !== ''));
    const table = csvFindTableInRows(rows);
    if(table) return csvTableToQuestions(table, false);
  }
  throw new Error(CSV_HEADER_ERROR);
}

// A starting file for the teacher. ';' because Excel set to an Azerbaijani region splits columns on it.
function csvTemplate(){
  return [
    'Sual;Cavab 1;Cavab 2;Cavab 3;Cavab 4;Cavab 5;Düzgün cavab;Tip;Xal;Mövzu',
    'Hansı verilənlər bazası idarəetmə sistemidir?;MySQL;Photoshop;Excel;Windows;;1;;1;Verilənlər bazası',
    'SQL-də SELECT əmri məlumat seçmək üçündür.;Doğru;Yanlış;;;;1;;1;Verilənlər bazası',
    'Azərbaycanın paytaxtı hansı şəhərdir?;;;;;;Bakı, Baku;short;1;Coğrafiya',
    'Azərbaycanın paytaxtı [blank] şəhəridir.;;;;;;Bakı, Baku;fill;1;Coğrafiya'
  ].join('\r\n') + '\r\n';
}

if(typeof module !== 'undefined') module.exports = { parseQuestionsCsv, parseQuestionsSheets, csvParseRows, csvTemplate, csvMapHeader };
