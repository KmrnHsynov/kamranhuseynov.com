const test = require('node:test');
const assert = require('node:assert');
const { parseQuestionsCsv, csvParseRows, csvTemplate } = require('./quiz-csv.js');

// What a Kahoot question spreadsheet looks like once saved as CSV: instruction rows first, then the header.
const KAHOOT = [
  'Quiz template,,,,,,',
  'Add questions, at least 2 answer alternatives and choose at least one correct answer,,,,,',
  ',,,,,,',
  'Question - max 120 characters,Answer 1 - max 75 characters,Answer 2 - max 75 characters,Answer 3 - max 75 characters,Answer 4 - max 75 characters,"Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs",Correct answer(s) - choose at least one',
  'What is 2+2?,3,4,5,6,20,2',
  '"Pick the primes, or not?",2,4,"7, seven",9,30,"1,3"',
  'Capital of France?,Paris,Rome,,,20,1'
].join('\r\n');

test('a Kahoot-style file imports: instruction rows skipped, time limit ignored', () => {
  const { questions } = parseQuestionsCsv(KAHOOT);
  assert.strictEqual(questions.length, 3);
  assert.strictEqual(questions[0].type, 'mc');
  assert.strictEqual(questions[0].text, 'What is 2+2?');
  assert.deepStrictEqual(questions[0].options.slice(0, 4), ['3', '4', '5', '6']);
  assert.strictEqual(questions[0].options[questions[0].correctOption], '4');
  assert.ok(!questions[0].needsReview);
});

test('quoted cells with commas are read as one cell', () => {
  const { questions } = parseQuestionsCsv(KAHOOT);
  assert.strictEqual(questions[1].text, 'Pick the primes, or not?');
  assert.strictEqual(questions[1].options[2], '7, seven');
});

test('several correct answers: the first is kept and the question is flagged', () => {
  const { questions, warnings } = parseQuestionsCsv(KAHOOT);
  assert.strictEqual(questions[1].options[questions[1].correctOption], '2');
  assert.strictEqual(questions[1].needsReview, true);
  assert.match(warnings.join('|'), /Sual 2/);
});

test('two answers only: unused columns are dropped', () => {
  const q = parseQuestionsCsv(KAHOOT).questions[2];
  assert.deepStrictEqual(q.options, ['Paris', 'Rome', '', '', '']);
  assert.strictEqual(q.correctOption, 0);
});

test('a blank answer column in the middle: the correct number follows its option', () => {
  const csv = 'Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct answer(s)\nQ,a,,c,d,3\n';
  const q = parseQuestionsCsv(csv).questions[0];
  assert.deepStrictEqual(q.options.slice(0, 3), ['a', 'c', 'd']);
  assert.strictEqual(q.options[q.correctOption], 'c');
});

test('semicolons, BOM, Azerbaijani headers and letters or option text as the answer', () => {
  const csv = '﻿Sual;Cavab 1;Cavab 2;Cavab 3;Düzgün cavab\r\nBir?;x;y;z;B\r\nİki?;x;y;z;z\r\n';
  const { questions } = parseQuestionsCsv(csv);
  assert.strictEqual(questions[0].options[questions[0].correctOption], 'y');
  assert.strictEqual(questions[1].options[questions[1].correctOption], 'z');
  assert.ok(questions.every(q => !q.needsReview));
});

test('True/False answers become a true/false question', () => {
  const csv = 'Question,Answer 1,Answer 2,Correct answer(s)\nSky is blue,True,False,1\nSun is cold,True,False,2\nVar?,Doğru,Yanlış,2\n';
  const t = parseQuestionsCsv(csv).questions;
  assert.deepStrictEqual(t.map(q => [q.type, q.tfAnswer]), [['tf', true], ['tf', false], ['tf', false]]);
});

test('type, points, topic and written answers', () => {
  const csv = 'Sual;Düzgün cavab;Tip;Xal;Mövzu\r\nPaytaxt?;Bakı, Baku;short;3;Coğrafiya\r\nŞəhər [blank] var.;Bakı;fill;;Coğrafiya\r\n';
  const [a, b] = parseQuestionsCsv(csv).questions;
  assert.deepStrictEqual([a.type, a.shortAnswer, a.points, a.topic], ['short', 'Bakı, Baku', 3, 'Coğrafiya']);
  assert.deepStrictEqual([b.type, b.fillAnswers, b.points, b.fillText], ['fill', ['Bakı'], 1, 'Şəhər [blank] var.']);
});

test('without a type column the kind is guessed from the row', () => {
  const csv = 'Question,Answer 1,Answer 2,Correct answer(s)\nOpen question,,,Paris\nCity is [blank],,,Baku\n';
  const [a, b] = parseQuestionsCsv(csv).questions;
  assert.strictEqual(a.type, 'short');
  assert.strictEqual(b.type, 'fill');
});

test('missing answers are flagged, never guessed', () => {
  const csv = 'Question,Answer 1,Answer 2,Correct answer(s)\nNo key,a,b,\nBad key,a,b,9\nFill,,,\nThe [blank] and the [blank],,,x\n';
  const qs = parseQuestionsCsv(csv).questions;
  assert.deepStrictEqual(qs.map(q => q.needsReview), [true, true, true, true]);
});

test('quotes, doubled quotes and line breaks inside a cell', () => {
  const rows = csvParseRows('a,"he said ""hi""","two\nlines",d\r\n', ',');
  assert.deepStrictEqual(rows, [['a', 'he said "hi"', 'two\nlines', 'd']]);
});

test('rows with content but no question are counted as skipped, empty rows are not', () => {
  const csv = 'Question,Answer 1,Answer 2,Correct answer(s)\nReal,a,b,1\n,a,b,1\n,,,\n';
  const r = parseQuestionsCsv(csv);
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(r.skipped, 1);
});

test('a short row (missing trailing cells) does not crash', () => {
  const r = parseQuestionsCsv('Question,Answer 1,Answer 2,Correct answer(s)\nOnly question\n');
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(r.questions[0].needsReview, true);
});

test('overlong text is cut to the limits', () => {
  const q = parseQuestionsCsv('Question,Answer 1,Answer 2,Correct answer(s)\n' + 'q'.repeat(5000) + ',' + 'a'.repeat(900) + ',b,1\n').questions[0];
  assert.strictEqual(q.text.length, 1000);
  assert.strictEqual(q.options[0].length, 300);
});

test('a file with no header, or no questions, gives a message for the teacher', () => {
  assert.throws(() => parseQuestionsCsv('hello,world\n1,2\n'), /Başlıq sətri/);
  assert.throws(() => parseQuestionsCsv(''), /Başlıq sətri/);
  assert.throws(() => parseQuestionsCsv('Question,Answer 1,Answer 2,Correct answer(s)\n'), /sual tapılmadı/);
});

test('the downloadable template imports cleanly, one of each kind, nothing flagged', () => {
  const { questions, warnings } = parseQuestionsCsv(csvTemplate());
  assert.deepStrictEqual(questions.map(q => q.type), ['mc', 'tf', 'short', 'fill']);
  assert.strictEqual(questions[0].options[questions[0].correctOption], 'MySQL');
  assert.strictEqual(questions[1].tfAnswer, true);
  assert.strictEqual(questions[2].shortAnswer, 'Bakı, Baku');
  assert.deepStrictEqual(questions[3].fillAnswers, ['Bakı, Baku']);
  assert.deepStrictEqual(warnings, []);
  assert.ok(questions.every(q => q.topic));
});

test('a file that was not saved as UTF-8 is reported', () => {
  const bad = 'Question,Answer 1,Answer 2,Correct answer(s)' + String.fromCharCode(10) + 'Paytaxt' + String.fromCharCode(0xFFFD) + '?,Bak' + String.fromCharCode(0xFFFD) + ',G' + String.fromCharCode(0x259) + 'nc' + String.fromCharCode(0x259) + ',1' + String.fromCharCode(10);
  assert.strictEqual(parseQuestionsCsv(bad).encodingProblem, true);
  assert.strictEqual(parseQuestionsCsv(csvTemplate()).encodingProblem, false);
});
