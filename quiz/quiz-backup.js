'use strict';

// Backup / restore of the question bank. Pure functions: the DOM parts live in quiz-az.js.

const BACKUP_TYPES = ['mc', 'tf', 'short', 'fill'];
const BACKUP_MAX_QUESTIONS = 2000;

function backupToJson(questions){
  return JSON.stringify({
    app: 'quizcraft',
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: questions.map(({ id, ...q }) => q)
  }, null, 2);
}

// Accepts anything that might be in a file and returns a clean question (without an id), or null.
function normalizeImportedQuestion(q){
  if(!q || typeof q !== 'object' || !BACKUP_TYPES.includes(q.type)) return null;
  const options = (Array.isArray(q.options) ? q.options : []).slice(0, 5).map(o => String(o == null ? '' : o));
  while(options.length < 5) options.push('');
  const correct = Number.isInteger(q.correctOption) && q.correctOption >= 0 && q.correctOption < 5 ? q.correctOption : 0;
  return {
    type: q.type,
    text: String(q.text == null ? '' : q.text),
    options,
    correctOption: correct,
    tfAnswer: q.tfAnswer !== false,
    shortAnswer: String(q.shortAnswer == null ? '' : q.shortAnswer),
    fillText: String(q.fillText == null ? '' : q.fillText),
    fillAnswers: (Array.isArray(q.fillAnswers) ? q.fillAnswers : []).map(a => String(a == null ? '' : a)),
    points: Math.min(100, Math.max(1, Math.round(Number(q.points)) || 1)),
    topic: String(q.topic == null ? '' : q.topic),
    _fromPdf: false,
    needsReview: q.needsReview === true
  };
}

function parseBackup(text){
  let data;
  try{ data = JSON.parse(text); }
  catch(e){ throw new Error('Fayl düzgün JSON deyil.'); }
  const list = Array.isArray(data) ? data : data && data.questions;
  if(!Array.isArray(list)) throw new Error('Faylda suallar tapılmadı.');
  const out = list.slice(0, BACKUP_MAX_QUESTIONS).map(normalizeImportedQuestion).filter(Boolean);
  if(!out.length) throw new Error('Faylda etibarlı sual yoxdur.');
  return out;
}

if(typeof module !== 'undefined') module.exports = { backupToJson, parseBackup, normalizeImportedQuestion };
