const test = require('node:test');
const assert = require('node:assert');
const { gradeAttempt, isCorrectAnswer, isAnswered } = require('./quiz-grading.js');

const key = { questions: {
  1: { type: 'mc',    points: 2, correctOption: 3 },
  2: { type: 'tf',    points: 1, tfAnswer: false },
  3: { type: 'short', points: 3, shortAnswer: 'Paris, paris ,PARİS' },
  4: { type: 'fill',  points: 4, fillAnswers: ['Bakı', 'Kür,Kura'] }
} };

test('mc compares the original option index', () => {
  assert.strictEqual(isCorrectAnswer(key.questions[1], 3), true);
  assert.strictEqual(isCorrectAnswer(key.questions[1], 0), false);
});

test('mc option index 0 counts as an answer', () => {
  assert.strictEqual(isAnswered(key.questions[1], 0), true);
});

test('tf false is an answer and is compared strictly', () => {
  assert.strictEqual(isAnswered(key.questions[2], false), true);
  assert.strictEqual(isCorrectAnswer(key.questions[2], false), true);
  assert.strictEqual(isCorrectAnswer(key.questions[2], true), false);
});

test('short answers ignore case and spaces and accept comma-separated alternatives', () => {
  assert.strictEqual(isCorrectAnswer(key.questions[3], '  PARIS '), true);
  assert.strictEqual(isCorrectAnswer(key.questions[3], 'london'), false);
});

test('blank short answer is unanswered', () => {
  assert.strictEqual(isAnswered(key.questions[3], '   '), false);
});

test('fill needs every blank right', () => {
  assert.strictEqual(isCorrectAnswer(key.questions[4], ['bakı', 'kura']), true);
  assert.strictEqual(isCorrectAnswer(key.questions[4], ['bakı', 'x']), false);
});

test('fill accepts the object form Firebase uses for arrays', () => {
  assert.strictEqual(isCorrectAnswer(key.questions[4], { 0: 'Bakı', 1: 'Kür' }), true);
});

test('fill with fewer answers than blanks is not correct even if the first matches', () => {
  assert.strictEqual(isCorrectAnswer(key.questions[4], ['Bakı']), false);
});

test('whole attempt: counts, points and percent', () => {
  const rec = { qids: [1, 2, 3, 4], answers: { 1: 3, 2: true, 3: 'paris' } };
  assert.deepStrictEqual(gradeAttempt(rec, key), {
    correct: 2, wrong: 1, unanswered: 1, score: 5, maxScore: 10, totalQuestions: 4, pct: 50
  });
});

test('questions the student never got are not counted', () => {
  const rec = { qids: [1], answers: { 1: 3, 3: 'paris' } };
  const g = gradeAttempt(rec, key);
  assert.strictEqual(g.maxScore, 2);
  assert.strictEqual(g.pct, 100);
});

test('qids stored as an object are read too', () => {
  const rec = { qids: { 0: 1, 1: 2 }, answers: { 1: 3, 2: false } };
  assert.strictEqual(gradeAttempt(rec, key).pct, 100);
});

test('unknown question ids are skipped, a missing key gives null', () => {
  assert.strictEqual(gradeAttempt({ qids: [99], answers: { 99: 1 } }, key).totalQuestions, 0);
  assert.strictEqual(gradeAttempt({ qids: [1] }, null), null);
});

test('no answers at all is 0 percent with everything unanswered', () => {
  const g = gradeAttempt({ qids: [1, 2] }, key);
  assert.deepStrictEqual([g.unanswered, g.pct], [2, 0]);
});

const { questionStats, markRepeatAttempts } = require('./quiz-grading.js');

const keys = { ex: { 'v1': { questions: {
  1: { type: 'tf', text: 'Easy', points: 1, tfAnswer: true },
  2: { type: 'tf', text: 'Hard', points: 1, tfAnswer: true }
} } } };
const rec = (status, answers) => ({ _exam: 'ex', examVersion: 'v1', status, qids: ['1', '2'], answers });

test('question stats count correct answers and sort the hardest first', () => {
  const stats = questionStats([
    rec('done', { 1: true, 2: false }),
    rec('done', { 1: true, 2: false }),
    rec('exited', { 1: false })
  ], keys);
  assert.deepStrictEqual(stats.map(s => [s.text, s.shown, s.answered, s.correct, s.pctCorrect]),
    [['Hard', 3, 2, 0, 0], ['Easy', 3, 3, 2, 67]]);
});

test('attempts still in progress are not counted in question stats', () => {
  const stats = questionStats([rec('in_progress', { 1: true }), rec('done', { 1: true, 2: true })], keys);
  assert.strictEqual(stats[0].shown, 1);
  assert.strictEqual(stats.every(s => s.pctCorrect === 100), true);
});

test('question stats skip attempts whose key is missing', () => {
  assert.deepStrictEqual(questionStats([{ ...rec('done', {}), examVersion: 'other' }], keys), []);
});

test('repeat attempts are counted per exam and ignore case, spacing and dotless i', () => {
  const rs = markRepeatAttempts([
    { _exam: 'a', studentName: 'Əli  Vəliyev' }, { _exam: 'a', studentName: ' əli vəliyev ' },
    { _exam: 'a', studentName: 'Kamran' }, { _exam: 'b', studentName: 'Kamran' },
    { _exam: 'a', studentName: 'KAMRAN' }, { _exam: 'a', studentName: 'Salıh' }, { _exam: 'a', studentName: 'salih' }
  ]);
  assert.deepStrictEqual(rs.map(r => r.repeatCount), [2, 2, 2, 1, 2, 2, 2]);
});

const { attemptReview, markDeviceFlags } = require('./quiz-grading.js');

test('an attempt review shows each answer next to the right one, in the order the student saw them', () => {
  const key = { questions: {
    1: { type: 'mc', text: 'Q1', points: 1, options: ['x', 'y', 'z'], correctOption: 2 },
    2: { type: 'tf', text: 'Q2', points: 1, tfAnswer: true },
    3: { type: 'short', text: 'Q3', points: 1, shortAnswer: 'cat, kitten' },
    4: { type: 'fill', text: 'Q4', points: 1, fillText: 'a [blank] b [blank]', fillAnswers: ['one', 'two'] },
    5: { type: 'mc', text: 'Q5', points: 1, options: ['p', 'q'], correctOption: 0 }
  } };
  const rv = attemptReview({ qids: ['3', '1', '2', '4', '5', '9'], answers: { 1: 1, 2: true, 3: 'Dog', 4: ['one', 'x'] } }, key);
  assert.deepStrictEqual(rv.map(r => r.id), ['3', '1', '2', '4', '5']);
  assert.deepStrictEqual(rv.map(r => r.status), ['wrong', 'wrong', 'correct', 'wrong', 'blank']);
  assert.strictEqual(rv[0].studentText, 'Dog');
  assert.strictEqual(rv[0].correctText, 'cat / kitten');
  assert.strictEqual(rv[1].studentText, 'B. y');
  assert.strictEqual(rv[1].correctText, 'C. z');
  assert.strictEqual(rv[2].studentText, 'Doğru');
  assert.strictEqual(rv[3].studentText, 'one · x');
  assert.strictEqual(rv[4].studentText, '');
});

test('an attempt review without a key is empty', () => {
  assert.deepStrictEqual(attemptReview({ qids: ['1'], answers: {} }, null), []);
});

test('attempts from one device are numbered in start order, per exam', () => {
  const rs = markDeviceFlags([
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 1000 },
    { _exam: 'a', uid: 'u2', studentName: 'Vali', timestamp: 2000 },
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 3000 },
    { _exam: 'b', uid: 'u1', studentName: 'Ali', timestamp: 4000 }
  ]);
  assert.deepStrictEqual(rs.map(r => [r.deviceAttempt, r.deviceTotal]), [[1, 2], [1, 1], [2, 2], [1, 1]]);
});

test('one device under several names lists them; one name on several devices is counted', () => {
  const rs = markDeviceFlags([
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 1 },
    { _exam: 'a', uid: 'u1', studentName: ' ALI ', timestamp: 2 },
    { _exam: 'a', uid: 'u1', studentName: 'Vali', timestamp: 3 },
    { _exam: 'a', uid: 'u2', studentName: 'ali', timestamp: 4 }
  ]);
  assert.deepStrictEqual(rs[0].deviceNames, ['Ali', 'Vali']);
  assert.strictEqual(rs[3].deviceNames.length, 1);
  assert.deepStrictEqual(rs.map(r => r.nameDevices), [2, 2, 1, 2]);
});

test('a retry from the same device within ten minutes is marked quick', () => {
  const rs = markDeviceFlags([
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 0 },
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 9 * 60000 },
    { _exam: 'a', uid: 'u1', studentName: 'Ali', timestamp: 30 * 60000 }
  ]);
  assert.deepStrictEqual(rs.map(r => !!r.quickRetry), [false, true, false]);
});

test('records without a device id get no device flags', () => {
  const rs = markDeviceFlags([{ _exam: 'a', studentName: 'Ali', timestamp: 1 }, { _exam: 'a', studentName: 'Ali', timestamp: 2 }]);
  assert.strictEqual(rs[0].deviceTotal, undefined);
  assert.strictEqual(rs[0].nameDevices, 1);
});

const { resultsToRelease, buildResult } = require('./quiz-grading.js');

const done = (id, extra) => ({ attemptId: id, status: 'done', _exam: 'ex', topic: 'T', studentName: 'Ali', correct: 3, wrong: 1, unanswered: 0, score: 5, maxScore: 6, pct: 83, ...extra });

test('only finished, graded, not-yet-released attempts are released', () => {
  const list = [done('a'), done('b', { status: 'in_progress' }), done('c', { ungraded: true }), done('d', { status: 'exited' }), done('e')];
  assert.deepStrictEqual(resultsToRelease(list, { e: true }).map(r => r.attemptId), ['a', 'd']);
});

test('a released result carries counts and names, never answers', () => {
  const res = buildResult({ ...done('a'), answers: { 1: 2 }, qids: ['1'], uid: 'secret-uid' }, 1700);
  assert.deepStrictEqual(Object.keys(res).sort(),
    ['correct', 'exam', 'maxScore', 'pct', 'releasedAt', 'score', 'studentName', 'topic', 'unanswered', 'wrong']);
  assert.strictEqual(res.releasedAt, 1700);
});

test('a released result keeps to the sizes the database rules allow', () => {
  const res = buildResult(done('a', { studentName: 'x'.repeat(200), topic: 'y'.repeat(500), _exam: 'z'.repeat(500) }), 1);
  assert.ok(res.studentName.length <= 60 && res.topic.length <= 200 && res.exam.length <= 200);
  assert.strictEqual(buildResult(done('a', { studentName: '' }), 1).studentName, 'Anonim');
});
