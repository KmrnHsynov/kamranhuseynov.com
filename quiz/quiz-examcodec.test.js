const test = require('node:test');
const assert = require('node:assert');
const { encodeQuestions, decodeQuestions, examMeta, legacyQuestionCount } = require('./quiz-examcodec.js');

const qs = [
  { id: 1, type: 'mc', text: 'SDLC-də tələblər mərhələsinin çıxışı nədir? ə ş ı', points: 1, options: ['A', 'B', '', 'D', ''] },
  { id: 2, type: 'fill', text: 'F', points: 2, fillText: 'x [blank] y' }
];

test('questions survive a round trip, including Azerbaijani letters', async () => {
  const payload = await encodeQuestions(qs, 'exam-1', 1700);
  assert.deepStrictEqual(await decodeQuestions(payload, 'exam-1', 1700), qs);
});

test('the payload does not contain the question text', async () => {
  const payload = await encodeQuestions(qs, 'exam-1', 1700);
  assert.ok(payload.startsWith('v1.'));
  assert.ok(!payload.includes('SDLC'));
  assert.ok(!Buffer.from(payload.slice(3), 'base64').toString('latin1').includes('SDLC'));
});

test('the same questions give a different payload each time', async () => {
  assert.notStrictEqual(await encodeQuestions(qs, 'e', 1), await encodeQuestions(qs, 'e', 1));
});

test('a payload only opens with its own exam key and version', async () => {
  const payload = await encodeQuestions(qs, 'exam-1', 1700);
  await assert.rejects(decodeQuestions(payload, 'exam-2', 1700));
  await assert.rejects(decodeQuestions(payload, 'exam-1', 1701));
});

test('garbage and tampered payloads are refused', async () => {
  await assert.rejects(decodeQuestions('nope', 'e', 1));
  await assert.rejects(decodeQuestions(undefined, 'e', 1));
  const payload = await encodeQuestions(qs, 'e', 1);
  const raw = Buffer.from(payload.slice(3), 'base64');
  raw[raw.length - 1] ^= 1;
  await assert.rejects(decodeQuestions('v1.' + raw.toString('base64'), 'e', 1));
});

test('a long exam does not overflow the base64 step', async () => {
  const big = Array.from({ length: 400 }, (_, i) => ({ id: i, type: 'tf', text: 'q'.repeat(200) + i, points: 1 }));
  assert.strictEqual((await decodeQuestions(await encodeQuestions(big, 'e', 1), 'e', 1)).length, 400);
});

test('the public entry carries times and count, and leaves out unset fields', () => {
  assert.deepStrictEqual(examMeta({ topic: 'T', examMinutes: 30, leaveLimit: 3, publishedAt: 5, questions: [1, 2] }, 2),
    { topic: 'T', examMinutes: 30, leaveLimit: 3, publishedAt: 5, qCount: 2 });
  const m = examMeta({ topic: 'T', examMinutes: 30, leaveLimit: 3, publishedAt: 5, opensAt: 10, closesAt: 20 }, 4);
  assert.strictEqual(m.opensAt, 10);
  assert.strictEqual(m.closesAt, 20);
  assert.strictEqual('payload' in m, false);
  assert.strictEqual('questions' in m, false);
});

test('question count works for lists and for Firebase objects with gaps', () => {
  assert.strictEqual(legacyQuestionCount({ questions: [1, 2, 3] }), 3);
  assert.strictEqual(legacyQuestionCount({ questions: { 0: 'a', 2: 'b' } }), 2);
  assert.strictEqual(legacyQuestionCount({}), 0);
});

test('examMeta carries the one-attempt setting only when it is on', () => {
  const { examMeta } = require('./quiz-examcodec.js');
  assert.strictEqual(examMeta({ topic: 'T', oneAttempt: true }, 3).oneAttempt, true);
  assert.strictEqual('oneAttempt' in examMeta({ topic: 'T' }, 3), false);
});
