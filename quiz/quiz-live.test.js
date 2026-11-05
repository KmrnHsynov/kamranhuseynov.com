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

test('a 30-second question never shows urgency color, even near zero', () => {
  assert.strictEqual(liveTimerUrgencyClass(30, 30), '');
  assert.strictEqual(liveTimerUrgencyClass(5, 30), '');
  assert.strictEqual(liveTimerUrgencyClass(0, 30), '');
});
