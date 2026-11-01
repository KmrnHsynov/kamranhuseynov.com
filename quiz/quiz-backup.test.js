const test = require('node:test');
const assert = require('node:assert');
const { backupToJson, parseBackup } = require('./quiz-backup.js');

const sample = [
  { id: 7, type: 'mc', text: 'Q1', options: ['a', 'b', 'c', 'd', ''], correctOption: 2, tfAnswer: true, shortAnswer: '', fillText: '', fillAnswers: [], points: 3, topic: 'T', _fromPdf: true },
  { id: 9, type: 'fill', text: 'Q2', options: ['', '', '', '', ''], correctOption: 0, tfAnswer: true, shortAnswer: '', fillText: 'a [blank]', fillAnswers: ['Bakı'], points: 1, topic: 'T', needsReview: true }
];

test('export then import gives the same questions back, without ids', () => {
  const back = parseBackup(backupToJson(sample));
  assert.strictEqual(back.length, 2);
  assert.ok(back.every(q => !('id' in q)));
  assert.strictEqual(back[0].correctOption, 2);
  assert.strictEqual(back[0].points, 3);
  assert.deepStrictEqual(back[1].fillAnswers, ['Bakı']);
  assert.strictEqual(back[1].needsReview, true);
});

test('imported questions are never marked as coming from a PDF', () => {
  assert.strictEqual(parseBackup(backupToJson(sample))[0]._fromPdf, false);
});

test('a plain array of questions is accepted too', () => {
  assert.strictEqual(parseBackup(JSON.stringify([{ type: 'tf', text: 'x', tfAnswer: false }]))[0].tfAnswer, false);
});

test('missing fields get safe defaults and options are padded to five', () => {
  const [q] = parseBackup(JSON.stringify([{ type: 'mc', text: 'x', options: ['only'] }]));
  assert.strictEqual(q.options.length, 5);
  assert.strictEqual(q.correctOption, 0);
  assert.strictEqual(q.points, 1);
  assert.strictEqual(q.topic, '');
});

test('points are clamped and out-of-range correct options reset', () => {
  const [q] = parseBackup(JSON.stringify([{ type: 'mc', text: 'x', points: 5000, correctOption: 9 }]));
  assert.strictEqual(q.points, 100);
  assert.strictEqual(q.correctOption, 0);
});

test('entries with an unknown type are skipped, the rest kept', () => {
  const out = parseBackup(JSON.stringify([{ type: 'essay', text: 'x' }, null, 5, { type: 'short', text: 'ok', shortAnswer: 'a' }]));
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].type, 'short');
});

test('junk input is rejected with a message', () => {
  assert.throws(() => parseBackup('not json'), /JSON/);
  assert.throws(() => parseBackup('{"hello":1}'), /tapılmadı/);
  assert.throws(() => parseBackup('[{"type":"essay"}]'), /etibarlı/);
});

test('values that are not strings do not crash or inject objects', () => {
  const [q] = parseBackup(JSON.stringify([{ type: 'short', text: { a: 1 }, topic: ['x'], shortAnswer: 5 }]));
  assert.strictEqual(typeof q.text, 'string');
  assert.strictEqual(typeof q.topic, 'string');
  assert.strictEqual(q.shortAnswer, '5');
});
