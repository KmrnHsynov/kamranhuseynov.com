const test = require('node:test');
const assert = require('node:assert');
const { createMonitor } = require('./quiz-monitor.js');

function clock(){ let t = 0; const f = () => t; f.set = v => { t = v; }; return f; }

test('a leave is counted once even if blur and visibilitychange both fire', () => {
  const m = createMonitor(3, clock());
  assert.deepStrictEqual(m.leave(), { count: 1, reached: false });
  assert.strictEqual(m.leave(), null);
  assert.strictEqual(m.stats().tabSwitches, 1);
});

test('reached is true when the count hits the limit', () => {
  const m = createMonitor(2, clock());
  m.leave(); m.back();
  assert.deepStrictEqual(m.leave(), { count: 2, reached: true });
});

test('limit 0 never reaches', () => {
  const m = createMonitor(0, clock());
  for (let i = 0; i < 5; i++) { m.leave(); m.back(); }
  assert.strictEqual(m.stats().tabSwitches, 5);
  const r = m.leave();
  assert.strictEqual(r.reached, false);
});

test('back without leave returns null', () => {
  assert.strictEqual(createMonitor(3, clock()).back(), null);
});

test('time away accumulates in whole seconds', () => {
  const now = clock();
  const m = createMonitor(5, now);
  now.set(10000); m.leave();
  now.set(14000); m.back();
  now.set(20000); m.leave();
  now.set(21400); m.back();
  assert.strictEqual(m.stats().timeAway, 4 + 1);
});

test('stats include time of a leave that is still ongoing', () => {
  const now = clock();
  const m = createMonitor(5, now);
  now.set(1000); m.leave();
  now.set(9000);
  assert.strictEqual(m.stats().timeAway, 8);
});

test('paste and copy are logged; only paste is counted', () => {
  const now = clock();
  const m = createMonitor(3, now);
  now.set(7000); m.paste(); m.copy();
  const s = m.stats();
  assert.strictEqual(s.pastes, 1);
  assert.deepStrictEqual(s.events, [{ type: 'paste', t: 7 }, { type: 'copy', t: 7 }]);
});

test('events are capped at 100 but counters keep counting', () => {
  const m = createMonitor(0, clock());
  for (let i = 0; i < 150; i++) m.paste();
  const s = m.stats();
  assert.strictEqual(s.events.length, 100);
  assert.strictEqual(s.pastes, 150);
});

test('a saved session is restored and keeps counting from where it was', () => {
  const now = clock();
  now.set(100000);
  const m = createMonitor(3, now, { tabSwitches: 2, timeAway: 30, pastes: 1, events: [{ type: 'leave', t: 5 }], elapsed: 60 });
  assert.strictEqual(m.stats().tabSwitches, 2);
  assert.deepStrictEqual(m.leave(), { count: 3, reached: true });
  const s = m.stats();
  assert.strictEqual(s.timeAway, 30);
  assert.strictEqual(s.pastes, 1);
  assert.deepStrictEqual(s.events, [{ type: 'leave', t: 5 }, { type: 'leave', t: 60 }]);
});
