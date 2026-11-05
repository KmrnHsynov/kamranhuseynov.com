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

// Question-timer pill color, by fraction of time left rather than an absolute second count (live
// questions run 5-300s, unlike the exam's fixed 30-minute clock, so a fixed cutoff would never
// trigger on a short question). '' means the plain/default color.
function liveTimerUrgencyClass(secondsLeft, totalSeconds){
  if(!(totalSeconds > 0) || totalSeconds === 30) return '';
  const ratio = secondsLeft / totalSeconds;
  if(ratio <= 0.2) return ' danger';
  if(ratio <= 0.5) return ' warn';
  return '';
}

// Top-3 podium markup shared by the host's and the player's finished screens. Presentation only -
// not covered by quiz-live.test.js like the logic above, since esc() is a page global this file
// doesn't define (same reasoning as liveQuestionOptionsHtml etc in quiz-live-host.js).
function livePodiumHtml(leaderboard, highlightName){
  const top3 = leaderboard.slice(0, 3);
  if(!top3.length) return '';
  const order = [1, 0, 2];       // silver, gold, bronze, left to right
  const heights = [130, 96, 74]; // indexed by rank (0=1st..2=3rd), not by column
  const medals = ['🥇', '🥈', '🥉'];
  return `<div class="live-podium">${order.map((rank, col) => {
    const p = top3[rank];
    if(!p) return '<div class="live-podium-slot"></div>';
    const mine = highlightName != null && p.name === highlightName;
    return `<div class="live-podium-slot" style="animation-delay:${col * 0.15}s">
      <div class="live-podium-medal">${medals[rank]}</div>
      <div class="live-podium-name"${mine ? ' style="color:var(--accent);font-weight:800"' : ''}>${esc(p.name)}</div>
      <div class="live-podium-bar" style="height:${heights[rank]}px">${p.score}</div>
    </div>`;
  }).join('')}</div>`;
}

if(typeof module !== 'undefined') module.exports = { generatePin, liveScore, sortLeaderboard, liveTimerUrgencyClass, livePodiumHtml };
