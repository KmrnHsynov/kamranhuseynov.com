const test = require('node:test');
const assert = require('node:assert');
const { generatePin, liveScore, sortLeaderboard, liveTimerUrgencyClass } = require('./quiz-live.js');

test('a pin is always a 6-digit numeric string', () => {
  for(let i = 0; i < 50; i++){
    const pin = generatePin();
    assert.match(pin, /^[0-9]{6}$/);
  }
});

test('mc/tf: instant correct answer gets full points, full-time correct answer gets half', () => {
  const q = { type: 'mc', points: 1, correctOption: 2 };
  assert.strictEqual(liveScore(q, 2, 0, 20), 1000);
  assert.strictEqual(liveScore(q, 2, 20000, 20), 500);
  assert.strictEqual(liveScore(q, 2, 10000, 20), 750);
});

test('mc/tf: a wrong or unanswered question scores 0 regardless of time', () => {
  const q = { type: 'tf', points: 1, tfAnswer: true };
  assert.strictEqual(liveScore(q, false, 0, 20), 0);
  assert.strictEqual(liveScore(q, undefined, 0, 20), 0);
});

test('mc/tf: time past the allotted window is clamped, never scoring below half', () => {
  const q = { type: 'mc', points: 1, correctOption: 0 };
  assert.strictEqual(liveScore(q, 0, 999999, 20), 500);
});

test('short/fill: flat 1000 when correct, no time bonus, the editor\'s own points value is ignored', () => {
  const short = { type: 'short', points: 3, shortAnswer: 'Paris' };
  assert.strictEqual(liveScore(short, 'paris', 0, 20), 1000);
  assert.strictEqual(liveScore(short, 'paris', 19999, 20), 1000);
  assert.strictEqual(liveScore(short, 'london', 0, 20), 0);

  const fill = { type: 'fill', points: 4, fillAnswers: ['Bakı', 'Kür,Kura'] };
  assert.strictEqual(liveScore(fill, ['bakı', 'kura'], 5000, 20), 1000);
  assert.strictEqual(liveScore(fill, ['bakı', 'x'], 0, 20), 0);
});

test('leaderboard sorts by score, highest first, without mutating the input', () => {
  const players = [{ name: 'a', score: 10 }, { name: 'b', score: 30 }, { name: 'c', score: 20 }];
  const sorted = sortLeaderboard(players);
  assert.deepStrictEqual(sorted.map(p => p.name), ['b', 'c', 'a']);
  assert.deepStrictEqual(players.map(p => p.name), ['a', 'b', 'c']);
});

test('leaderboard treats a missing score as zero', () => {
  const sorted = sortLeaderboard([{ name: 'a' }, { name: 'b', score: 5 }]);
  assert.deepStrictEqual(sorted.map(p => p.name), ['b', 'a']);
});

test('timer urgency is by fraction of time left, not an absolute second count', () => {
  assert.strictEqual(liveTimerUrgencyClass(20, 20), '');
  assert.strictEqual(liveTimerUrgencyClass(11, 20), '');
  assert.strictEqual(liveTimerUrgencyClass(10, 20), ' warn');
  assert.strictEqual(liveTimerUrgencyClass(4, 20), ' danger');
  assert.strictEqual(liveTimerUrgencyClass(0, 20), ' danger');
  // A short 5s question still reaches danger, unlike the exam's fixed 120s cutoff.
  assert.strictEqual(liveTimerUrgencyClass(1, 5), ' danger');
});

test('timer urgency with no time limit is never urgent', () => {
  assert.strictEqual(liveTimerUrgencyClass(5, 0), '');
});

test('a 30-second question gets urgency colors like any other length', () => {
  assert.strictEqual(liveTimerUrgencyClass(30, 30), '');
  assert.strictEqual(liveTimerUrgencyClass(15, 30), ' warn');
  assert.strictEqual(liveTimerUrgencyClass(5, 30), ' danger');
});

// ── server-timed speed bonus and rejoin checks ──
const { liveResponseTimeMs, liveRejoinAllowed } = require('./quiz-live.js');

test('response time comes from the server times, not the player-supplied value', () => {
  assert.strictEqual(liveResponseTimeMs({ responseTimeMs: 0, submittedAt: 15000 }, 10000), 5000);
  assert.strictEqual(liveResponseTimeMs({ submittedAt: 9000 }, 10000), 0);
  assert.strictEqual(liveResponseTimeMs({ responseTimeMs: 1200 }, 10000), 1200);
});

test('a forged instant answer no longer gets the full speed bonus', () => {
  const q = { type: 'mc', correctOption: 1 };
  const score = liveScore(q, 1, liveResponseTimeMs({ responseTimeMs: 0, submittedAt: 20000 }, 10000), 20);
  assert.strictEqual(score, 750);
});

test('rejoin only takes over a disconnected player with the same name', () => {
  const me = { profile: { displayName: 'Aysel ' } };
  assert.strictEqual(liveRejoinAllowed(me, { profile: { displayName: 'aysel', connected: false } }), true);
  assert.strictEqual(liveRejoinAllowed(me, { profile: { displayName: 'Aysel', connected: true } }), false);
  assert.strictEqual(liveRejoinAllowed(me, { profile: { displayName: 'Aysel' } }), false);
  assert.strictEqual(liveRejoinAllowed(me, { profile: { displayName: 'Nigar', connected: false } }), false);
  assert.strictEqual(liveRejoinAllowed(me, null), false);
});

test('the podium marks only the viewing player, even when two share a name', () => {
  global.esc = s => String(s);
  const { livePodiumHtml } = require('./quiz-live.js');
  const html = livePodiumHtml([{ uid: 'a', name: 'Ali', score: 900 }, { uid: 'b', name: 'Ali', score: 800 }], 'b');
  assert.strictEqual((html.match(/color:var\(--accent\)/g) || []).length, 1);
});

test('a player removed for leaving too often cannot be taken over by a rejoin', () => {
  const me = { profile: { displayName: 'Aysel' } };
  assert.strictEqual(liveRejoinAllowed(me, { profile: { displayName: 'Aysel', connected: false }, flags: { flagged: true } }), false);
});

// ── reading phase, streaks, ranking and round facts ──
const { LIVE_READ_MS, liveNextStreak, liveBoard, liveRoundFacts, livePickFact } = require('./quiz-live.js');

test('the answer clock starts after the 3s reading phase, never below 0', () => {
  assert.strictEqual(LIVE_READ_MS, 3000);
  assert.strictEqual(liveResponseTimeMs({ submittedAt: 15000 }, 10000, LIVE_READ_MS), 2000);
  assert.strictEqual(liveResponseTimeMs({ submittedAt: 11000 }, 10000, LIVE_READ_MS), 0);
  assert.strictEqual(liveResponseTimeMs({ submittedAt: 15000 }, 10000), 5000);   // old callers unchanged
});

test('a streak grows on a correct answer and resets on anything else; best streak is kept', () => {
  assert.deepStrictEqual(liveNextStreak(0, 0, true), { streak: 1, bestStreak: 1 });
  assert.deepStrictEqual(liveNextStreak(3, 3, true), { streak: 4, bestStreak: 4 });
  assert.deepStrictEqual(liveNextStreak(3, 5, false), { streak: 0, bestStreak: 5 });
  assert.deepStrictEqual(liveNextStreak(undefined, undefined, false), { streak: 0, bestStreak: 0 });
});

const P = (name, score, extra = {}) => ({ profile: { displayName: name }, score, ...extra });

test('liveBoard ranks by score, ties share a rank, nameless entries are skipped', () => {
  const board = liveBoard({ a: P('Ali', 500), b: P('Leyla', 900), c: P('Vüsal', 500), d: { score: 5 }, e: P('Nigar', 100) });
  assert.deepStrictEqual(board.map(p => [p.name, p.rank]), [['Leyla', 1], ['Ali', 2], ['Vüsal', 2], ['Nigar', 4]]);
});

test('round facts: streaks, fastest answer, percent correct, climbing, gap to the player above', () => {
  const board = liveBoard({
    a: P('Ali', 2000, { streak: 4, bestStreak: 4, lastRound: 2, lastCorrect: true, lastPoints: 900, lastMs: 1500 }),
    b: P('Leyla', 1800, { streak: 1, bestStreak: 3, lastRound: 2, lastCorrect: true, lastPoints: 800, lastMs: 4000 }),
    c: P('Vüsal', 700, { streak: 0, bestStreak: 1, lastRound: 2, lastCorrect: false, lastPoints: 0 })
  });
  const texts = liveRoundFacts(board, 2, 'c').map(f => f.text).join('\n');
  assert.match(texts, /Ali 4 sual ardıcıl/);
  assert.match(texts, /ən sürətli düzgün cavabı: Ali \(1\.5 san\)/);
  assert.match(texts, /67%/);
  assert.match(texts, /yuxarıdakı ilə fərq: 1100 xal/);
  assert.match(texts, /Ali liderdir və ikinci yerdən 200 xal/);
  assert.ok(!/Sizin seriyanız/.test(texts));   // c has no streak
  assert.match(liveRoundFacts(board, 2, 'a').map(f => f.text).join('\n'), /Sizin seriyanız: 4/);
});

test('round facts: a player who jumped ahead is called out', () => {
  // Vüsal had 100 before this round (score 1100 - 1000), so was last; now second.
  const board = liveBoard({
    a: P('Ali', 2000, { lastRound: 0, lastCorrect: true, lastPoints: 100, lastMs: 100 }),
    b: P('Leyla', 1000, { lastRound: 0, lastCorrect: false, lastPoints: 0 }),
    c: P('Vüsal', 1100, { lastRound: 0, lastCorrect: true, lastPoints: 1000, lastMs: 200 })
  });
  assert.match(liveRoundFacts(board, 0).map(f => f.text).join('\n'), /Vüsal bu sualda 1 pillə yüksəldi/);
});

test('livePickFact returns null for nothing and picks by the random value', () => {
  assert.strictEqual(livePickFact([]), null);
  const facts = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
  assert.strictEqual(livePickFact(facts, () => 0).text, 'a');
  assert.strictEqual(livePickFact(facts, () => 0.99).text, 'c');
});
