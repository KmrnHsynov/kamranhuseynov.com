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

// A question's text shows alone for this long; only then do the answer options appear and the
// answer timer start. Host and players both use this same number: the server's questionStartedAt is
// when the question went out, so answers open at questionStartedAt + LIVE_READ_MS. (The database
// rules allow answers up to 15s after the timer, so this 3s does not need a rules change.)
const LIVE_READ_MS = 3000;

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

// How long a player took, from the two server-stamped times (question launch, answer accepted).
// The player's own responseTimeMs is only a fallback for answers without a server time: it comes
// from their browser, so trusting it would let anyone claim an instant answer.
// readMs is the reading phase before options open (LIVE_READ_MS): the answer clock starts after it.
function liveResponseTimeMs(answer, questionStartedAt, readMs){
  const a = answer || {};
  const skip = Number(readMs) || 0;
  if(Number.isFinite(a.submittedAt) && Number.isFinite(questionStartedAt)) return Math.max(0, a.submittedAt - questionStartedAt - skip);
  return Math.max(0, Number(a.responseTimeMs) || 0);
}

// A rejoin request moves an old player's score to the new one and removes the old entry, so it is
// only honoured for a player who has dropped out, under the same name the requester joined with.
function liveRejoinAllowed(requester, target){
  const norm = s => String(s || '').trim().toLowerCase();
  const rp = (requester || {}).profile || {}, tp = (target || {}).profile || {};
  const removed = !!((target || {}).flags || {}).flagged;   // left the game too often: not a slot to resume
  return !!tp.displayName && tp.connected === false && !removed && norm(rp.displayName) === norm(tp.displayName);
}

// Highest score first; ties keep whoever is listed first (stable sort).
function sortLeaderboard(players){
  return players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Question-timer pill color, by fraction of time left rather than an absolute second count (live
// questions run 5-300s, unlike the exam's fixed 30-minute clock, so a fixed cutoff would never
// trigger on a short question). '' means the plain/default color.
function liveTimerUrgencyClass(secondsLeft, totalSeconds){
  if(!(totalSeconds > 0)) return '';
  const ratio = secondsLeft / totalSeconds;
  if(ratio <= 0.2) return ' danger';
  if(ratio <= 0.5) return ' warn';
  return '';
}

// Top-3 podium markup shared by the host's and the player's finished screens. Presentation only -
// not covered by quiz-live.test.js like the logic above, since esc() is a page global this file
// doesn't define (same reasoning as liveQuestionOptionsHtml etc in quiz-live-host.js).
// highlightUid marks the viewing player's own slot; by id, so two players with the same name are not both marked.
function livePodiumHtml(leaderboard, highlightUid){
  const top3 = leaderboard.slice(0, 3);
  if(!top3.length) return '';
  const order = [1, 0, 2];       // silver, gold, bronze, left to right
  const heights = [130, 96, 74]; // indexed by rank (0=1st..2=3rd), not by column
  const medals = ['🥇', '🥈', '🥉'];
  return `<div class="live-podium">${order.map((rank, col) => {
    const p = top3[rank];
    if(!p) return '<div class="live-podium-slot"></div>';
    const mine = highlightUid != null && p.uid === highlightUid;
    return `<div class="live-podium-slot" style="animation-delay:${col * 0.15}s">
      <div class="live-podium-medal">${medals[rank]}</div>
      <div class="live-podium-name"${mine ? ' style="color:var(--accent);font-weight:800"' : ''}>${esc(p.name)}</div>
      <div class="live-podium-bar" style="height:${heights[rank]}px">${p.score}</div>
    </div>`;
  }).join('')}</div>`;
}

// ── Round stats: ranking, streaks and the random "did you know" line shown after each question ──
// The host writes these per player at every reveal (players/<uid>/streak, bestStreak, lastRound,
// lastCorrect, lastPoints, lastMs), because players can only read their own results/ entry but can
// read the whole players/ node. This turns that node into a ranked board.
//
// Next streak / best streak for a player after a question. A player who was there but did not answer
// (or answered wrong) loses the streak.
function liveNextStreak(prevStreak, prevBest, correct){
  const streak = correct ? (Number(prevStreak) || 0) + 1 : 0;
  return { streak, bestStreak: Math.max(Number(prevBest) || 0, streak) };
}

// Players with a name, highest score first, each with a `rank`. Equal scores share a rank (1, 1, 3).
function liveBoard(playersMap){
  const list = Object.entries(playersMap || {})
    .filter(([, p]) => p && p.profile && p.profile.displayName)
    .map(([uid, p]) => ({
      uid, name: p.profile.displayName, score: Number(p.score) || 0,
      streak: Number(p.streak) || 0, bestStreak: Number(p.bestStreak) || 0,
      lastRound: Number.isFinite(p.lastRound) ? p.lastRound : -1,
      lastCorrect: !!p.lastCorrect, lastPoints: Number(p.lastPoints) || 0,
      lastMs: Number.isFinite(p.lastMs) ? p.lastMs : null
    }));
  const sorted = sortLeaderboard(list);
  sorted.forEach(p => { p.rank = 1 + sorted.filter(o => o.score > p.score).length; });
  return sorted;
}

// Candidate facts about the round that just ended, as { icon, text } with raw (unescaped) text.
// myUid adds lines about the viewing player; pass nothing for the teacher's screen.
function liveRoundFacts(board, round, myUid){
  const facts = [];
  if(!board || !board.length) return facts;
  const me = myUid != null ? board.find(p => p.uid === myUid) : null;
  const inRound = board.filter(p => p.lastRound === round);

  if(me && me.streak >= 2) facts.push({ icon: '🔥', text: `Sizin seriyanız: ${me.streak} sual ardıcıl düzgün cavab!` });
  const hot = board.filter(p => p.streak >= 2 && (!me || p.uid !== me.uid)).sort((a, b) => b.streak - a.streak)[0];
  if(hot) facts.push({ icon: '🔥', text: `${hot.name} ${hot.streak} sual ardıcıl düzgün cavab verib!` });
  const bestEver = board.slice().sort((a, b) => b.bestStreak - a.bestStreak)[0];
  if(bestEver && bestEver.bestStreak >= 3) facts.push({ icon: '🏆', text: `Oyunun ən uzun seriyası: ${bestEver.name} — ${bestEver.bestStreak} ardıcıl düzgün cavab.` });

  if(board.length >= 2){
    const fast = inRound.filter(p => p.lastCorrect && p.lastMs != null).sort((a, b) => a.lastMs - b.lastMs)[0];
    if(fast) facts.push({ icon: '⚡', text: `Bu sualın ən sürətli düzgün cavabı: ${fast.name} (${(fast.lastMs / 1000).toFixed(1)} san).` });
  }
  if(inRound.length >= 2){
    const pct = Math.round(inRound.filter(p => p.lastCorrect).length / inRound.length * 100);
    facts.push({ icon: '🎯', text: `Tələbələrin ${pct}%-i bu suala düzgün cavab verdi.` });
  }

  // Who climbed the most this round: rank now vs. rank with last round's points taken off.
  const prevScore = p => p.score - (p.lastRound === round ? p.lastPoints : 0);
  let climber = null, climb = 0;
  board.forEach(p => {
    const prevRank = 1 + board.filter(o => prevScore(o) > prevScore(p)).length;
    if(prevRank - p.rank > climb){ climb = prevRank - p.rank; climber = p; }
  });
  if(climber && (!me || climber.uid !== me.uid)) facts.push({ icon: '📈', text: `${climber.name} bu sualda ${climb} pillə yüksəldi.` });
  if(me && climber && climber.uid === me.uid) facts.push({ icon: '📈', text: `Bu sualda ${climb} pillə yüksəldiniz!` });

  if(me && me.rank > 1){
    const above = board.filter(p => p.score > me.score).sort((a, b) => a.score - b.score)[0];
    if(above) facts.push({ icon: '👀', text: `Özünüzdən yuxarıdakı ilə fərq: ${above.score - me.score} xal.` });
  }
  if(board.length >= 2 && board[0].score > board[1].score){
    facts.push({ icon: '👑', text: `${board[0].name} liderdir və ikinci yerdən ${board[0].score - board[1].score} xal öndədir.` });
  }
  return facts;
}

// rnd is only injectable so a test can pin the choice.
function livePickFact(facts, rnd){
  if(!facts || !facts.length) return null;
  const r = typeof rnd === 'function' ? rnd() : Math.random();
  return facts[Math.min(facts.length - 1, Math.floor(r * facts.length))];
}

// Rows for the top-5 list shown at the end of a round, used by the host and the players. When the
// viewing player is outside the top, their own row is added below a gap so they still see their place.
// highlightUid marks the viewer's row. Presentation only (needs the page's esc()).
function liveTopRowsHtml(board, highlightUid, limit){
  const n = limit || 5;
  const row = p => {
    const mine = highlightUid != null && p.uid === highlightUid;
    return `<div class="live-top-row${mine ? ' mine' : ''}">
      <span class="live-top-rank">${p.rank}</span>
      <span class="live-top-name">${esc(p.name)}${p.streak >= 2 ? ` <span class="live-top-streak" title="Ardıcıl düzgün cavab">🔥${p.streak}</span>` : ''}</span>
      <strong>${p.score}</strong>
    </div>`;
  };
  const top = board.slice(0, n);
  let html = top.map(row).join('');
  const me = highlightUid != null ? board.find(p => p.uid === highlightUid) : null;
  if(me && !top.includes(me)) html += '<div class="live-top-gap">⋮</div>' + row(me);
  return html;
}

if(typeof module !== 'undefined') module.exports = { LIVE_READ_MS, liveNextStreak, liveBoard, liveRoundFacts, livePickFact, liveTopRowsHtml, generatePin, liveScore, liveResponseTimeMs, liveRejoinAllowed, sortLeaderboard, liveTimerUrgencyClass, livePodiumHtml };
