// Course content logic shared by the learner app and the admin page.
// Pure functions only (no DOM, no network) so they can run under `node --test`.
(function (root) {
  const BULLET = /^(?:[܀•▪*]|[-–—](?=\s))\s*/;
  const NUMBERED = /^(\d{1,2})[.)]\s+/;

  // A short line written entirely in capitals ("SİFƏT", "SUFFİKSLƏR").
  function isHeading(line) {
    if (line.length > 60 || line.includes('[')) return false;
    const letters = line.match(/\p{L}/gu);
    return !!letters && letters.length >= 3 && !/\p{Ll}/u.test(line);
  }

  // Lesson text is plain text typed by a person. Turn it into blocks:
  // { type: 'h' | 'p', text } and { type: 'ul', items } / { type: 'ol', items, start }.
  function parseLesson(text) {
    const blocks = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { blocks.push(null); continue; }
      const last = blocks[blocks.length - 1];
      const number = line.match(NUMBERED);
      if (BULLET.test(line)) {
        const item = line.replace(BULLET, '');
        if (last && last.type === 'ul') last.items.push(item);
        else blocks.push({ type: 'ul', items: [item] });
      } else if (number) {
        const item = line.replace(NUMBERED, '');
        const n = Number(number[1]);
        if (last && last.type === 'ol' && last.start + last.items.length === n) last.items.push(item);
        else blocks.push({ type: 'ol', start: n, items: [item] });
      } else {
        blocks.push({ type: isHeading(line) ? 'h' : 'p', text: line });
      }
    }
    return blocks.filter(Boolean);
  }

  // "The Noun - İsim" → { az: 'İsim', en: 'The Noun' }. Anything else stays whole.
  function splitTitle(title) {
    const parts = String(title).split(' - ');
    if (parts.length === 2 && !title.includes(' / ')) return { az: parts[1].trim(), en: parts[0].trim() };
    return { az: String(title), en: '' };
  }

  // A topic is shown to learners only when there is something to read or hear.
  function hasContent(node) {
    return !!((node.lesson && node.lesson.trim()) || node.audio);
  }

  function applyRow(node, row) {
    if (!row) return node;
    return {
      ...node,
      lesson: row.lesson || '',
      audio: row.audio_url || '',
      questions: Array.isArray(row.questions) ? row.questions : []
    };
  }

  // Overlay rows from the lesson_content table on the course outline file,
  // then drop empty topics and empty sections.
  function mergeCurriculum(base, rows) {
    const byId = new Map((rows || []).map(r => [r.node_id, r]));
    return {
      sections: base.sections
        .map(s => ({ ...s, nodes: s.nodes.map(n => applyRow(n, byId.get(n.id))).filter(hasContent) }))
        .filter(s => s.nodes.length > 0)
    };
  }

  const QUESTION_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];

  // Returns clean question objects, or throws an Error with a message for the admin.
  function cleanQuestions(list) {
    return list.map((q, i) => {
      const fail = msg => { throw new Error(`Sual ${i + 1}: ${msg}`); };
      if (!QUESTION_TYPES.includes(q.type)) fail('sual növü seçilməyib.');
      const question = String(q.question || '').trim();
      if (!question) fail('sual mətni boşdur.');

      if (q.type === 'true_false') {
        if (typeof q.answer !== 'boolean') fail('doğru və ya yanlış seçin.');
        return { type: q.type, question, answer: q.answer };
      }
      if (q.type === 'fill_blank') {
        const answer = String(q.answer || '').trim();
        if (!answer) fail('cavab boşdur.');
        return { type: q.type, question, answer };
      }
      const all = (q.options || []).map(o => String(o || '').trim());
      const options = all.filter(Boolean);
      if (options.length < 2) fail('ən azı iki variant yazın.');
      if (new Set(options.map(o => o.toLowerCase())).size !== options.length) fail('eyni variant iki dəfə yazılıb.');
      const answer = String(q.answer || '').trim();
      if (!answer || !options.includes(answer)) fail('düzgün variantı işarələyin.');
      return { type: q.type, question, options, answer };
    });
  }

  const api = { parseLesson, splitTitle, hasContent, applyRow, mergeCurriculum, cleanQuestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Content = api;

  // Shared DOM renderer for lesson text (browser only; uses textContent throughout).
  api.renderLesson = function (container, text) {
    container.replaceChildren(...parseLesson(text).map(block => {
      if (block.type === 'ul' || block.type === 'ol') {
        const list = document.createElement(block.type);
        if (block.type === 'ol') list.start = block.start;
        list.append(...block.items.map(item => {
          const li = document.createElement('li');
          li.textContent = item;
          return li;
        }));
        return list;
      }
      const el = document.createElement(block.type === 'h' ? 'h2' : 'p');
      el.textContent = block.text;
      return el;
    }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
