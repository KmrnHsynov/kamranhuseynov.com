const test = require('node:test');
const assert = require('node:assert');
const { recordsToCsv, csvCell, CSV_HEADER } = require('./quiz-export.js');

const base = { studentName: 'Ali', topic: 'T', startedAt: 1, status: 'done', correct: 3, wrong: 1, unanswered: 0,
  score: 5, maxScore: 6, pct: 83, timeUsed: 600, tabSwitches: 2, timeAway: 30, pastes: 1, autoSubmitted: false };
const fmt = () => '2026-11-01 10:00';

test('one header row plus one row per attempt, every row the same width', () => {
  const lines = recordsToCsv([base, { ...base, studentName: 'Vali' }], { formatDate: fmt }).trim().split('\r\n');
  assert.strictEqual(lines.length, 3);
  assert.ok(lines.every(l => l.split(';').length === CSV_HEADER.length));
});

test('values land in the right columns', () => {
  const row = recordsToCsv([base], { formatDate: fmt }).trim().split('\r\n')[1].split(';');
  assert.deepStrictEqual(row.slice(0, 10), ['Ali', 'T', '2026-11-01 10:00', 'Bitirib', '3', '1', '0', '5', '6', '83']);
  assert.deepStrictEqual(row.slice(10), ['600', '2', '30', '1', 'Xeyr', '']);
});

test('names with the separator, quotes or line breaks are quoted', () => {
  assert.strictEqual(csvCell('a;b', ';'), '"a;b"');
  assert.strictEqual(csvCell('say "hi"', ';'), '"say ""hi"""');
  assert.strictEqual(csvCell('two\nlines', ';'), '"two\nlines"');
});

test('a name that looks like a spreadsheet formula is defused', () => {
  assert.strictEqual(csvCell('=HYPERLINK("http://x")', ';'), '"\'=HYPERLINK(""http://x"")"');
  assert.strictEqual(csvCell('+1', ';'), "'+1");
  assert.strictEqual(csvCell('@cmd', ';'), "'@cmd");
});

test('an attempt without a key leaves the score columns empty', () => {
  const row = recordsToCsv([{ ...base, ungraded: true }], { formatDate: fmt }).trim().split('\r\n')[1].split(';');
  assert.deepStrictEqual(row.slice(4, 10), ['', '', '', '', '', '']);
});

test('statuses and repeat attempts are written out', () => {
  const rows = recordsToCsv([{ ...base, status: 'in_progress', autoSubmitted: true, repeatCount: 3 }], { formatDate: fmt })
    .trim().split('\r\n')[1].split(';');
  assert.strictEqual(rows[3], 'Tamamlanmayıb');
  assert.strictEqual(rows[14], 'Bəli');
  assert.strictEqual(rows[15], '3');
});

test('the separator can be changed', () => {
  assert.strictEqual(recordsToCsv([base], { sep: ',', formatDate: fmt }).split('\r\n')[0].split(',').length, CSV_HEADER.length);
});
