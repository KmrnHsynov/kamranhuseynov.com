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

// Students type their own name, so the same name twice in one exam is worth a second look.
function nameKey(name){ return String(name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/\s+/g, ' '); }
function markRepeatAttempts(records){
  const counts = {};
  records.forEach(r => { const k = r._exam + '|' + nameKey(r.studentName); counts[k] = (counts[k] || 0) + 1; });
  records.forEach(r => { r.repeatCount = counts[r._exam + '|' + nameKey(r.studentName)]; });
  return records;
}

if(typeof module !== 'undefined') module.exports = { gradeAttempt, isCorrectAnswer, isAnswered, questionStats, markRepeatAttempts };
