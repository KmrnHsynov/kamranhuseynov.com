const test = require('node:test');
const assert = require('node:assert');
const { scheduleState, parseLocalDateTime, checkSchedule, scheduleLabel } = require('./quiz-schedule.js');

test('no limits means always open', () => {
  assert.strictEqual(scheduleState(5, 0, 0), 'open');
  assert.strictEqual(scheduleState(5, undefined, undefined), 'open');
});

test('before the opening time the exam is not open yet', () => {
  assert.strictEqual(scheduleState(99, 100, 0), 'before');
});

test('opening and closing moments themselves count as open', () => {
  assert.strictEqual(scheduleState(100, 100, 200), 'open');
  assert.strictEqual(scheduleState(200, 100, 200), 'open');
  assert.strictEqual(scheduleState(201, 100, 200), 'closed');
});

test('only a closing time works on its own', () => {
  assert.strictEqual(scheduleState(1, 0, 200), 'open');
  assert.strictEqual(scheduleState(300, 0, 200), 'closed');
});

test('datetime-local text is read as local time and blank means none', () => {
  assert.strictEqual(parseLocalDateTime(''), 0);
  assert.strictEqual(parseLocalDateTime('garbage'), 0);
  assert.strictEqual(parseLocalDateTime('2026-11-02T09:30'), new Date(2026, 10, 2, 9, 30).getTime());
});

test('a closing time at or before the opening time is rejected', () => {
  assert.match(checkSchedule(200, 100), /sonra/);
  assert.match(checkSchedule(200, 200), /sonra/);
  assert.strictEqual(checkSchedule(100, 200), null);
  assert.strictEqual(checkSchedule(0, 200), null);
  assert.strictEqual(checkSchedule(100, 0), null);
});

test('labels describe the current state', () => {
  assert.match(scheduleLabel(1, 100, 200), /^Açılış: /);
  assert.strictEqual(scheduleLabel(300, 100, 200), 'Bağlanıb');
  assert.match(scheduleLabel(150, 100, 200), /^Son başlama: /);
  assert.strictEqual(scheduleLabel(150, 0, 0), '');
});
