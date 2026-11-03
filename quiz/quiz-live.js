'use strict';

// Pure logic for the Kahoot-style live game mode, shared between the host (quiz-live-host.js, in
// quiz-az.html) and the player (the live-game section of quiz-student.js), covered by quiz-live.test.js.
// isCorrectAnswer comes from quiz-grading.js: already a global in the browser (script-tag load
// order), so nothing to import there. This has to be `var`, not `const`/`let`: a lexical
// declaration with the same name as an existing global `function` (quiz-grading.js's
// isCorrectAnswer) is a SyntaxError that aborts the whole script, whereas `var` safely coexists
// with it. The assignment below only actually runs in Node, where there is no such global.
var isCorrectAnswer;
if(typeof module !== 'undefined') isCorrectAnswer = require('./quiz-grading.js').isCorrectAnswer;

function generatePin(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Kahoot-style: every question is worth up to 1000, not the exam editor's own (usually tiny,
// e.g. 1) points value — that field only matters for exam-mode grading, not the live game.
const LIVE_MAX_POINTS = 1000;

// mc/tf: real Kahoot formula - half the points (500) are guaranteed just for being correct, the
// other half scales with speed, so an instant answer is 1000 and one at the very last moment is
// still 500, never 0. short/fill: flat 1000 once correct, no speed bonus (revealed only once
// everyone's answered).
function liveScore(q, ans, responseTimeMs, questionSeconds){
  if(!isCorrectAnswer(q, ans)) return 0;
  if(q.type !== 'mc' && q.type !== 'tf') return LIVE_MAX_POINTS;
  const allowedMs = Math.max(1, questionSeconds) * 1000;
  const ratio = Math.min(Math.max(responseTimeMs, 0) / allowedMs, 1);
  return Math.round(LIVE_MAX_POINTS * (1 - ratio / 2));
}

// Highest score first; ties keep whoever is listed first (stable sort).
function sortLeaderboard(players){
  return players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}

if(typeof module !== 'undefined') module.exports = { generatePin, liveScore, sortLeaderboard };
