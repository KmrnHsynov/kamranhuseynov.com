const test = require('node:test');
const assert = require('node:assert');
const { parsePdfText } = require('./quiz-pdf-parse.js');

test('lettered options with an explicit "Cavab: B" line', () => {
  const [q] = parsePdfText('1. What is 2+2?\nA) 3\nB) 4\nC) 5\nCavab: B\n');
  assert.strictEqual(q.type, 'mc');
  assert.strictEqual(q.text, 'What is 2+2?');
  assert.deepStrictEqual(q.options.slice(0, 3), ['3', '4', '5']);
  assert.strictEqual(q.correctOption, 1);
  assert.ok(!q.needsReview);
});

test('a check-mark line marks the correct option and bullets are distractors', () => {
  const [q] = parsePdfText('1. Capital of France?\n• London\n√ Paris\n• Rome\n');
  assert.strictEqual(q.type, 'mc');
  assert.deepStrictEqual(q.options.slice(0, 3), ['London', 'Paris', 'Rome']);
  assert.strictEqual(q.correctOption, 1);
  assert.ok(!q.needsReview);
});

test('a multiple-choice question with no answer marker is flagged, not silently option A', () => {
  const [q] = parsePdfText('1. Pick one\nA) x\nB) y\n');
  assert.strictEqual(q.type, 'mc');
  assert.strictEqual(q.needsReview, true);
});

test('a short question with an answer is fine, without one it is flagged', () => {
  const [a] = parsePdfText('1. Capital of France?\nCavab: Paris\n');
  assert.strictEqual(a.type, 'short');
  assert.strictEqual(a.shortAnswer, 'Paris');
  assert.ok(!a.needsReview);
  const [b] = parsePdfText('1. Capital of France?\n');
  assert.strictEqual(b.type, 'short');
  assert.strictEqual(b.needsReview, true);
});

test('fill-in-the-blank takes its answer from the Cavab line, or is flagged', () => {
  const [a] = parsePdfText('1. The capital is [blank].\nCavab: Bakı\n');
  assert.strictEqual(a.type, 'fill');
  assert.deepStrictEqual(a.fillAnswers, ['Bakı']);
  assert.ok(!a.needsReview);
  const [b] = parsePdfText('1. The capital is [blank].\n');
  assert.strictEqual(b.needsReview, true);
});

test('true/false questions are detected from the wording', () => {
  const [t] = parsePdfText('1. The sky is blue. Doğru\n');
  assert.strictEqual(t.type, 'tf');
  assert.strictEqual(t.tfAnswer, true);
  const [f] = parsePdfText('1. The sun is cold. Yanlış\n');
  assert.strictEqual(f.tfAnswer, false);
});

test('several numbered questions are split correctly', () => {
  const qs = parsePdfText('1. First?\nA) a\nB) b\nCavab: A\n2. Second?\nA) c\nB) d\nCavab: B\n');
  assert.strictEqual(qs.length, 2);
  assert.deepStrictEqual(qs.map(q => q.correctOption), [0, 1]);
});

test('more than five options keeps the correct one', () => {
  const [q] = parsePdfText('1. Many\nA) 1\nB) 2\nC) 3\nD) 4\nE) 5\nF) 6\nCavab: E\n');
  assert.strictEqual(q.options.length, 5);
  assert.strictEqual(q.options[q.correctOption], '5');
});

test('text with no numbered questions gives an empty list', () => {
  assert.deepStrictEqual(parsePdfText('just some words\nno numbers here'), []);
});

test('a true/false block that names both words is flagged instead of guessed', () => {
  const [q] = parsePdfText('1. The sky is blue. Doğru / Yanlış\n');
  assert.strictEqual(q.type, 'tf');
  assert.strictEqual(q.needsReview, true);
});

test('an explicit Cavab line decides a true/false question', () => {
  const [q] = parsePdfText('1. The sun is cold. Doğru / Yanlış\nCavab: Yanlış\n');
  assert.strictEqual(q.tfAnswer, false);
  assert.ok(!q.needsReview);
});

test('upper-case and mixed-case Azerbaijani words are recognised', () => {
  assert.strictEqual(parsePdfText('1. Göy mavidir. DOĞRU\n')[0].type, 'tf');
  assert.strictEqual(parsePdfText('1. Günəş soyuqdur. YANLIŞ\n')[0].tfAnswer, false);
});

test('words that merely contain doğru or true are not true/false markers', () => {
  assert.strictEqual(parsePdfText('1. Explain the construction of trueness.\nCavab: x\n')[0].type, 'short');
});

test('the answer line never stays inside the question text students see', () => {
  const short = parsePdfText('1. Capital of France?\nCavab: Paris\n')[0];
  assert.strictEqual(short.text, 'Capital of France?');
  const fill = parsePdfText('1. The capital is [blank].\nCavab: Bakı\n')[0];
  assert.strictEqual(fill.fillText, 'The capital is [blank].');
  assert.strictEqual(fill.text, 'The capital is [blank].');
  const tf = parsePdfText('1. The sky is blue. (Doğru / Yanlış)\nCavab: Doğru\n')[0];
  assert.ok(!/cavabs*:/i.test(tf.text));
  assert.strictEqual(tf.tfAnswer, true);
});

test('an answer written on the same line as the question is split off', () => {
  const [q] = parsePdfText('1. Capital of France? Cavab: Paris\n');
  assert.strictEqual(q.text, 'Capital of France?');
  assert.strictEqual(q.shortAnswer, 'Paris');
});

test('a multiple-choice answer given as the option text instead of a letter', () => {
  const [q] = parsePdfText('1. Which is a database?\nA) Photoshop\nB) MySQL\nC) Paint\nCavab: MySQL\n');
  assert.strictEqual(q.options[q.correctOption], 'MySQL');
  assert.ok(!q.needsReview);
  assert.ok(!/cavabs*:/i.test(q.text));
});

// This is the exact example given to the AI in the prompt. If this test fails, the prompt needs updating.
const PROMPT_EXAMPLE = `1. Hansı verilənlər bazası idarəetmə sistemidir?
A) MySQL
B) Photoshop
C) Excel Chart
D) Windows
E) Paint
Cavab: A

2. SQL-də cədvəldən məlumat seçmək üçün SELECT əmri istifadə olunur. (Doğru / Yanlış)
Cavab: Doğru

3. Verilənlər bazasında hər sətri unikal şəkildə təyin edən sütun ... adlanır.
Cavab: Primary key, əsas açar

4. Azərbaycanın paytaxtı [blank] şəhəridir.
Cavab: Bakı, Baku

5. HTTP protokolunun tam açılışını yazın.
Cavab: HyperText Transfer Protocol

6. Yalnız bir cavab düzgündür.
A) Bir
B) İki
C) Üç
Cavab: C
`;

test('the example from the AI prompt imports completely, with no questions flagged and no answers in the text', () => {
  const qs = parsePdfText(PROMPT_EXAMPLE);
  assert.deepStrictEqual(qs.map(q => q.type), ['mc', 'tf', 'short', 'fill', 'short', 'mc']);
  assert.strictEqual(qs[0].options[qs[0].correctOption], 'MySQL');
  assert.strictEqual(qs[1].tfAnswer, true);
  assert.strictEqual(qs[2].shortAnswer, 'Primary key, əsas açar');
  assert.deepStrictEqual(qs[3].fillAnswers, ['Bakı, Baku']);
  assert.strictEqual(qs[4].shortAnswer, 'HyperText Transfer Protocol');
  assert.strictEqual(qs[5].options[qs[5].correctOption], 'Üç');
  assert.ok(qs.every(q => !q.needsReview), 'no question should need review');
  assert.ok(qs.every(q => !/cavabs*:/i.test(q.text) && !/cavabs*:/i.test(q.fillText)), 'no answer line inside any question text');
});
