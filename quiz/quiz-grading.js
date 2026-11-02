'use strict';

// Grades a stored attempt against an answer key. Runs in the teacher's browser (and in Node for tests).
// key:  {questions: {<id>: {type, points, correctOption, tfAnswer, shortAnswer, fillAnswers}}}
// rec:  {qids: [<id>...], answers: {<id>: number | boolean | string | string[]}}

function gradeNorm(s){ return String(s == null ? '' : s).trim().toLowerCase(); }
function gradeAccepted(spec){ return String(spec == null ? '' : spec).split(',').map(gradeNorm); }

// Firebase hands back arrays as arrays, or as {0:..,1:..} objects when they have gaps.
function gradeList(v){
  if(Array.isArray(v)) return v;
  if(v && typeof v === 'object') return Object.keys(v).sort((a, b) => a - b).map(k => v[k]);
  return [];
}

function isAnswered(q, ans){
  if(ans === undefined || ans === null) return false;
  if(q.type === 'short') return gradeNorm(ans) !== '';
  if(q.type === 'fill') return gradeList(ans).some(v => gradeNorm(v) !== '');
  return true;
}

function isCorrectAnswer(q, ans){
  if(!isAnswered(q, ans)) return false;
  if(q.type === 'mc') return ans === q.correctOption;
  if(q.type === 'tf') return ans === q.tfAnswer;
  if(q.type === 'short') return gradeAccepted(q.shortAnswer).includes(gradeNorm(ans));
  if(q.type === 'fill'){
    const vals = gradeList(ans), exp = gradeList(q.fillAnswers);
    return vals.length >= exp.length && vals.every((v, i) => gradeAccepted(exp[i]).includes(gradeNorm(v)));
  }
  return false;
}

function gradeAttempt(rec, key){
  if(!key || !key.questions) return null;
  const answers = rec.answers || {};
  let correct = 0, wrong = 0, unanswered = 0, score = 0, maxScore = 0;
  gradeList(rec.qids).forEach(id => {
    const q = key.questions[id];
    if(!q) return;
    const pts = Number(q.points) || 0;
    maxScore += pts;
    const ans = answers[id];
    if(!isAnswered(q, ans)) unanswered++;
    else if(isCorrectAnswer(q, ans)){ correct++; score += pts; }
    else wrong++;
  });
  return {
    correct, wrong, unanswered, score, maxScore,
    totalQuestions: correct + wrong + unanswered,
    pct: maxScore ? Math.round(score / maxScore * 100) : 0
  };
}

// How each question did across the finished attempts. Unanswered counts as not correct.
// Attempts still in progress are left out: their blanks just mean the student has not got there yet.
function questionStats(records, answerKeys){
  const map = new Map();
  records.forEach(r => {
    if(r.status === 'in_progress') return;
    const key = (answerKeys[r._exam] || {})[r.examVersion];
    if(!key || !key.questions) return;
    const answers = r.answers || {};
    gradeList(r.qids).forEach(id => {
      const q = key.questions[id];
      if(!q) return;
      const gid = r._exam + '|' + r.examVersion + '|' + id;
      let s = map.get(gid);
      if(!s){ s = { exam: r._exam, version: r.examVersion, id, text: q.text || '', type: q.type, shown: 0, answered: 0, correct: 0 }; map.set(gid, s); }
      s.shown++;
      if(isAnswered(q, answers[id])){
        s.answered++;
        if(isCorrectAnswer(q, answers[id])) s.correct++;
      }
    });
  });
  return [...map.values()]
    .map(s => ({ ...s, pctCorrect: s.shown ? Math.round(s.correct / s.shown * 100) : 0 }))
    .sort((a, b) => a.pctCorrect - b.pctCorrect || b.shown - a.shown);
}

// What would make a question impossible to answer (or to mark) once it reaches students. Used before publishing.
// Returns a list of short Azerbaijani messages; empty means the question is fine.
function questionProblems(q){
  const out = [];
  const filled = v => String(v == null ? '' : v).trim() !== '';
  if(!filled(q.text)) out.push('sual mətni boşdur');
  const pts = Number(q.points);
  if(!(pts > 0)) out.push('xal 0-dan böyük olmalıdır');
  if(q.type === 'mc'){
    const opts = gradeList(q.options);
    if(opts.filter(filled).length < 2) out.push('ən azı 2 variant doldurulmalıdır');
    if(!filled(opts[q.correctOption])) out.push('düzgün variant boşdur');
  }
  if(q.type === 'short' && !filled(q.shortAnswer)) out.push('düzgün cavab yazılmayıb');
  if(q.type === 'fill'){
    const blanks = (String(q.fillText || '').match(/\[blank\]/gi) || []).length;
    const answers = gradeList(q.fillAnswers);
    if(!blanks) out.push('mətndə [blank] yoxdur');
    else if(answers.slice(0, blanks).filter(filled).length < blanks) out.push(`${blanks} boşluq üçün ${blanks} düzgün cavab yazılmalıdır`);
  }
  return out;
}

// One attempt question by question, for the teacher: what the student answered next to the right answer.
// MC answers are stored by the option's original position, which is how the key lists them.
function optionLabel(q, i){
  const opts = gradeList(q.options);
  return typeof i === 'number' && i >= 0 && i < opts.length ? String.fromCharCode(65 + i) + '. ' + opts[i] : '';
}
function answerText(q, ans){
  if(!isAnswered(q, ans)) return '';
  if(q.type === 'mc') return optionLabel(q, ans) || String(ans);
  if(q.type === 'tf') return ans ? 'Doğru' : 'Yanlış';
  if(q.type === 'fill') return gradeList(ans).map(v => String(v == null ? '' : v).trim() || '—').join(' · ');
  return String(ans).trim();
}
function correctAnswerText(q){
  if(q.type === 'mc') return optionLabel(q, q.correctOption);
  if(q.type === 'tf') return q.tfAnswer ? 'Doğru' : 'Yanlış';
  if(q.type === 'short') return String(q.shortAnswer || '').split(',').map(s => s.trim()).filter(Boolean).join(' / ');
  if(q.type === 'fill') return gradeList(q.fillAnswers).map(a => String(a || '').split(',').map(s => s.trim()).join(' / ')).join(' · ');
  return '';
}
function attemptReview(rec, key){
  if(!key || !key.questions) return [];
  const answers = rec.answers || {};
  return gradeList(rec.qids).map(id => {
    const q = key.questions[id];
    if(!q) return null;
    const ans = answers[id];
    const status = !isAnswered(q, ans) ? 'blank' : isCorrectAnswer(q, ans) ? 'correct' : 'wrong';
    return { id, type: q.type, text: q.text || '', fillText: q.fillText || '', points: Number(q.points) || 0, status, studentText: answerText(q, ans), correctText: correctAnswerText(q) };
  }).filter(Boolean);
}

// Students type their own name, so the same name twice in one exam is worth a second look.
function nameKey(name){ return String(name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/\s+/g, ' '); }
function markRepeatAttempts(records){
  const counts = {};
  records.forEach(r => { const k = r._exam + '|' + nameKey(r.studentName); counts[k] = (counts[k] || 0) + 1; });
  records.forEach(r => { r.repeatCount = counts[r._exam + '|' + nameKey(r.studentName)]; });
  return records;
}

// The device is the anonymous sign-in id (`uid`) saved with each attempt. It is not proof of who sat the exam,
// only a hint: clearing site data or using a private tab gives a new one. Expects records in start order.
const QUICK_RETRY_MS = 10 * 60 * 1000;
function markDeviceFlags(records){
  const byDevice = {}, devicesOfName = {};
  records.forEach(r => {
    const nk = r._exam + '|' + nameKey(r.studentName);
    (devicesOfName[nk] = devicesOfName[nk] || new Set()).add(r.uid || '');
    if(!r.uid) return;
    (byDevice[r._exam + '|' + r.uid] = byDevice[r._exam + '|' + r.uid] || []).push(r);
  });
  Object.values(byDevice).forEach(list => {
    const names = [], seen = new Set();
    list.forEach(r => {
      const k = nameKey(r.studentName);
      if(!seen.has(k)){ seen.add(k); names.push(String(r.studentName || 'Anonim').trim()); }
    });
    list.forEach((r, i) => {
      r.deviceAttempt = i + 1;
      r.deviceTotal = list.length;
      r.deviceNames = names;
      r.quickRetry = i > 0 && (r.timestamp || 0) - (list[i - 1].timestamp || 0) <= QUICK_RETRY_MS;
    });
  });
  records.forEach(r => { r.nameDevices = devicesOfName[r._exam + '|' + nameKey(r.studentName)].size; });
  return records;
}

// Releasing results: only counts are published (never answers or the key), one small record per attempt.
// Attempts still in progress, and ones that could not be graded, are not released.
function resultsToRelease(records, released){
  return records.filter(r => r.status !== 'in_progress' && !r.ungraded && r.attemptId && !(released && released[r.attemptId]));
}

function buildResult(r, now){
  return {
    exam: String(r._exam || '').slice(0, 200),
    topic: String(r.topic || '').slice(0, 200),
    studentName: String(r.studentName || 'Anonim').slice(0, 60) || 'Anonim',
    correct: r.correct, wrong: r.wrong, unanswered: r.unanswered,
    score: r.score, maxScore: r.maxScore, pct: r.pct,
    releasedAt: now
  };
}

if(typeof module !== 'undefined') module.exports = { gradeAttempt, isCorrectAnswer, isAnswered, questionStats, questionProblems, attemptReview, markRepeatAttempts, markDeviceFlags, resultsToRelease, buildResult };
