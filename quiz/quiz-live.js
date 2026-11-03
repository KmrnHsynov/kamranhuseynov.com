'use strict';

// Pure logic for the Kahoot-style live game mode, shared between the host (quiz-live-host.js, in
// quiz-az.html) and the player (the live-game section of quiz-student.js), covered by quiz-live.test.js.
// isCorrectAnswer comes from quiz-grading.js: a global in the browser (script-tag load order),
// required here only so this file's tests can run standalone under Node.
const { isCorrectAnswer } = typeof module !== 'undefined' ? require('./quiz-grading.js') : window;

function generatePin(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// mc/tf reward speed: full points at an instant answer, half at the full time allowed.
// short/fill are flat full-credit once correct, revealed only after everyone has answered.
function liveScore(q, ans, responseTimeMs, questionSeconds){
  if(!isCorrectAnswer(q, ans)) return 0;
  if(q.type !== 'mc' && q.type !== 'tf') return q.points;
  const allowedMs = Math.max(1, questionSeconds) * 1000;
  const ratio = Math.min(Math.max(responseTimeMs, 0) / allowedMs, 1);
  return Math.round(q.points * (1 - ratio / 2));
}

// Highest score first; ties keep whoever is listed first (stable sort).
function sortLeaderboard(players){
  return players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}

if(typeof module !== 'undefined') module.exports = { generatePin, liveScore, sortLeaderboard };
