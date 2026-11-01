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
