const test = require('node:test');
const assert = require('node:assert');
const { parseLesson, splitTitle, mergeCurriculum, cleanQuestions } = require('./content.js');
const normal = require('./curriculum.json');

test('lesson text becomes headings, lists and paragraphs', () => {
  assert.deepStrictEqual(parseLesson('SİFƏT\nGiriş cümləsi.\n܀ long – uzun\n- Less: homeless\n\n1) Bir\n2) İki\n-s əlavə olunur'), [
    { type: 'h', text: 'SİFƏT' },
    { type: 'p', text: 'Giriş cümləsi.' },
    { type: 'ul', items: ['long – uzun', 'Less: homeless'] },
    { type: 'ol', start: 1, items: ['Bir', 'İki'] },
    { type: 'p', text: '-s əlavə olunur' }
  ]);
});

test('section titles split into Azerbaijani and English only when unambiguous', () => {
  assert.deepStrictEqual(splitTitle('The Noun - İsim'), { az: 'İsim', en: 'The Noun' });
  assert.strictEqual(splitTitle('The Article - Artikl / The Preposition - Sözönləri').en, '');
  assert.strictEqual(splitTitle('There + To Be').az, 'There + To Be');
});

test('empty topics and sections are hidden until the admin writes them', () => {
  const base = { sections: [
    { id: 'a', title: 'A', nodes: [{ id: 'a1', title: 'x', lesson: 'text' }, { id: 'a2', title: 'y' }] },
    { id: 'b', title: 'B', nodes: [{ id: 'b1', title: 'z', lesson: '  ' }] }
  ] };
  assert.deepStrictEqual(mergeCurriculum(base, []).sections.map(s => s.nodes.map(n => n.id)), [['a1']]);
  const merged = mergeCurriculum(base, [{ node_id: 'b1', lesson: '', audio_url: 'https://x/a.mp3', questions: [] }]);
  assert.deepStrictEqual(merged.sections.map(s => s.id), ['a', 'b']);
  assert.strictEqual(merged.sections[1].nodes[0].audio, 'https://x/a.mp3');
});

test('a saved row replaces the file version of a topic', () => {
  const base = { sections: [{ id: 'a', title: 'A', nodes: [{ id: 'a1', title: 'x', lesson: 'old', audio: 'a.mp3', questions: [1] }] }] };
  const node = mergeCurriculum(base, [{ node_id: 'a1', lesson: 'new', audio_url: null, questions: [] }]).sections[0].nodes[0];
  assert.deepStrictEqual([node.lesson, node.audio, node.questions, node.title], ['new', '', [], 'x']);
});

test('every question already in the course file passes validation', () => {
  for (const s of normal.sections) for (const n of s.nodes) cleanQuestions(n.questions || []);
});

test('bad questions are rejected with the question number', () => {
  assert.throws(() => cleanQuestions([{ type: 'multiple_choice', question: 'q', options: ['a', ''], answer: 'a' }]), /Sual 1/);
  assert.throws(() => cleanQuestions([{ type: 'multiple_choice', question: 'q', options: ['a', 'b'], answer: 'c' }]), /düzgün variant/);
  assert.throws(() => cleanQuestions([{ type: 'true_false', question: 'q' }]), /Sual 1/);
  assert.throws(() => cleanQuestions([{ type: 'fill_blank', question: 'q', answer: ' ' }]), /cavab/);
});
