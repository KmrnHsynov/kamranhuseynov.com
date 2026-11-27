// İngiliscə Öyrən: admin panel.
// `db` comes from config.js, `Content` from content.js, `h` from ui.js.
// Write access is enforced by the database (RLS + is_admin()), not by this page.

const $ = id => document.getElementById(id);

const AUDIO_BUCKET = 'lesson-audio';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MIGRATION = 'ingilisce/migrations/2026-11-27-lesson-content.sql';

function setStatus(id, message, kind) {
  const el = typeof id === 'string' ? $(id) : id;
  el.textContent = message;
  el.className = `status${kind ? ` ${kind}` : ''}`;
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Sign in ──────────────────────────────────────────────

async function nameToEmail(name) {
  const data = new TextEncoder().encode(name.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return hex + '@ingilisce.app';
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('loginBtn');
  const errorBox = $('loginErr');
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = 'Gözləyin…';
  try {
    const email = await nameToEmail($('adminName').value.trim());
    const { error } = await db.auth.signInWithPassword({ email, password: $('adminPwd').value });
    if (error) throw new Error('Ad və ya şifrə yanlışdır.');

    // The same is_admin() check the database policies rely on.
    const { data: isAdmin } = await db.rpc('is_admin');
    if (!isAdmin) {
      await db.auth.signOut();
      throw new Error('Giriş icazəniz yoxdur.');
    }
    $('loginWrap').hidden = true;
    $('adminWrap').hidden = false;
    loadLessons();
  } catch (e) {
    errorBox.textContent = e.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Daxil ol';
  }
});

$('signOutBtn').addEventListener('click', async () => {
  if (!confirmDiscard()) return;
  editor.dirty = false;
  await db.auth.signOut();
  location.reload();
});

// ── Tabs ─────────────────────────────────────────────────

const LOADERS = { lessons: () => {}, questions: () => loadQuestions(), vocab: () => loadVocabItems() };

document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(other => {
    const on = other === tab;
    if (on) other.setAttribute('aria-current', 'page');
    else other.removeAttribute('aria-current');
    $(`panel-${other.dataset.tab}`).hidden = !on;
  });
  LOADERS[tab.dataset.tab]();
}));

// ── Lessons ──────────────────────────────────────────────

let outline = null;           // curriculum.json
let rows = new Map();         // node_id → lesson_content row
let tableError = null;        // set when lesson_content cannot be read
const editor = { nodeId: null, draft: null, dirty: false, busy: false };

const findOutlineNode = id => outline.sections.flatMap(s => s.nodes).find(n => n.id === id);
const effectiveNode = node => Content.applyRow(node, rows.get(node.id));

async function loadLessons() {
  renderEditorMessage('Yüklənir…', '');
  try {
    const response = await fetch('curriculum.json');
    if (!response.ok) throw new Error(String(response.status));
    outline = await response.json();
  } catch (e) {
    console.error('curriculum not loaded:', e);
    return renderEditorMessage('Kurs siyahısı yüklənmədi', 'Səhifəni yeniləyin.');
  }

  const { data, error } = await db.from('lesson_content').select('*');
  tableError = error || null;
  if (error) console.error('lesson_content not loaded:', error);
  rows = new Map((data || []).map(row => [row.node_id, row]));

  renderTopicList();
  renderEditorMessage('Mövzu seçin', 'Siyahıdan mövzu seçib mətnini, səsini və suallarını yazın. Boş mövzular öyrənənlərə görünmür.');
}

function tableNotice() {
  if (!tableError) return null;
  const missing = tableError.code === 'PGRST205' || tableError.code === '42P01';
  return h('p', { class: 'error-text', role: 'alert' },
    missing
      ? `Dərsləri yadda saxlamaq üçün baza hələ hazır deyil: ${MIGRATION} faylını Supabase → SQL Editor-də bir dəfə işə salın.`
      : `Saxlanmış dərslər oxunmadı: ${tableError.message}`);
}

function renderEditorMessage(title, text) {
  $('editor').replaceChildren(h('div', { class: 'editor-empty' },
    h('h1', {}, title),
    h('p', { class: 'muted' }, text),
    tableNotice()));
}

function topicState(node) {
  if (!Content.hasContent(effectiveNode(node))) return { label: 'Boş', live: false };
  return { label: rows.has(node.id) ? 'Dərc edilib · redaktə' : 'Dərc edilib', live: true };
}

function renderTopicList() {
  if (!outline) return;
  const term = $('topicSearch').value.trim().toLocaleLowerCase('az');
  const filter = $('topicFilter').value;
  let published = 0;
  let total = 0;

  const groups = outline.sections.map(section => {
    const buttons = [];
    for (const node of section.nodes) {
      const state = topicState(node);
      total += 1;
      if (state.live) published += 1;
      if (filter === 'published' && !state.live) continue;
      if (filter === 'empty' && state.live) continue;
      if (term && !`${node.title} ${section.title}`.toLocaleLowerCase('az').includes(term)) continue;
      buttons.push(h('button', {
        type: 'button',
        'data-node': node.id,
        'aria-current': node.id === editor.nodeId ? 'true' : undefined,
        onclick: () => openTopic(node.id)
      },
      h('span', {}, node.title),
      h('span', { class: `topic-state${state.live ? ' live' : ''}` }, state.label)));
    }
    return buttons.length ? h('div', {}, h('h2', {}, section.title), buttons) : null;
  }).filter(Boolean);

  $('topicCount').textContent = `${published} / ${total} mövzu dərc edilib`;
  $('topicList').replaceChildren(...(groups.length ? groups : [h('p', { class: 'empty' }, 'Uyğun mövzu yoxdur.')]));
}

$('topicSearch').addEventListener('input', renderTopicList);
$('topicFilter').addEventListener('change', renderTopicList);

function confirmDiscard() {
  return !editor.dirty || confirm('Yadda saxlanmamış dəyişikliklər itəcək. Davam edilsin?');
}

window.addEventListener('beforeunload', event => {
  if (editor.dirty) event.preventDefault();
});

// A question while it is being edited; `correct` is the index of the right option.
function toDraftQuestion(question) {
  if (question.type === 'multiple_choice') {
    const options = [...(question.options || [])];
    const answer = String(question.answer).trim().toLowerCase();
    return { type: question.type, question: question.question, options, correct: options.findIndex(o => String(o).trim().toLowerCase() === answer) };
  }
  const answer = question.type === 'true_false' ? String(question.answer) === 'true' : String(question.answer);
  return { type: question.type, question: question.question, answer };
}

function blankQuestion(type, question = '') {
  if (type === 'multiple_choice') return { type, question, options: ['', '', '', ''], correct: -1 };
  return { type, question, answer: type === 'true_false' ? null : '' };
}

function openTopic(nodeId, { force } = {}) {
  if (editor.busy || (!force && (nodeId === editor.nodeId && editor.draft))) {
    $('panel-lessons').classList.add('editing');
    return;
  }
  if (!force && !confirmDiscard()) return;

  const node = effectiveNode(findOutlineNode(nodeId));
  editor.nodeId = nodeId;
  editor.dirty = false;
  editor.draft = {
    lesson: node.lesson || '',
    audio: node.audio || '',
    file: null,
    questions: (node.questions || []).map(toDraftQuestion)
  };
  renderTopicList();
  renderEditor();
  $('panel-lessons').classList.add('editing');
  $('editor').scrollTop = 0;
  if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo(0, 0);
}

function markDirty() {
  editor.dirty = true;
  const status = $('lessonStatus');
  if (status) setStatus(status, 'Yadda saxlanmayıb');
}

function renderEditor() {
  const node = findOutlineNode(editor.nodeId);
  const section = outline.sections.find(s => s.nodes.includes(node));
  const draft = editor.draft;

  // Text, with a preview that uses the same formatter as the learner page.
  const textarea = h('textarea', {
    class: 'lesson-input', id: 'lessonText', 'aria-label': 'Dərsin mətni',
    oninput: () => { draft.lesson = textarea.value; markDirty(); }
  });
  textarea.value = draft.lesson;
  const preview = h('div', { class: 'preview', hidden: true });
  const writeTab = h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => setPreview(false) }, 'Mətn');
  const previewTab = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => setPreview(true) }, 'Önizləmə');
  function setPreview(on) {
    writeTab.setAttribute('aria-pressed', String(!on));
    previewTab.setAttribute('aria-pressed', String(on));
    textarea.hidden = on;
    preview.hidden = !on;
    if (on) Content.renderLesson(preview, textarea.value);
  }

  const audioBox = h('div');
  const questionBox = h('div');

  function renderAudio() {
    const input = h('input', {
      type: 'file', accept: 'audio/*', 'aria-label': 'Səs faylı seçin',
      onchange: () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > MAX_AUDIO_BYTES) {
          input.value = '';
          return showToast('Fayl 20 MB-dan böyükdür.');
        }
        draft.file = file;
        markDirty();
        renderAudio();
      }
    });
    const current = draft.file
      ? h('div', { class: 'audio-row' },
        h('span', {}, `Seçildi: ${draft.file.name}. Yadda saxlayanda yüklənəcək.`),
        h('button', { type: 'button', class: 'btn danger small', onclick: () => { draft.file = null; markDirty(); renderAudio(); } }, 'Seçimi ləğv et'))
      : draft.audio
        ? h('div', { class: 'audio-row' },
          h('audio', { controls: true, preload: 'none', src: draft.audio }),
          h('button', { type: 'button', class: 'btn danger small', onclick: () => { draft.audio = ''; markDirty(); renderAudio(); } }, 'Səsi sil'))
        : h('p', { class: 'muted audio-row' }, 'Bu mövzuda səs yoxdur.');
    audioBox.replaceChildren(current, input);
  }

  function renderQuestionEditors() {
    questionBox.replaceChildren(...draft.questions.map((q, i) => questionEditor(q, i)));
  }

  function questionEditor(q, i) {
    const type = h('select', {
      'aria-label': `Sual ${i + 1} növü`,
      onchange: () => { draft.questions[i] = blankQuestion(type.value, q.question); markDirty(); renderQuestionEditors(); }
    },
    h('option', { value: 'multiple_choice' }, 'Variantlı sual'),
    h('option', { value: 'true_false' }, 'Doğru / Yanlış'),
    h('option', { value: 'fill_blank' }, 'Boşluq doldurma'));
    type.value = q.type;

    const text = h('input', { type: 'text', oninput: () => { q.question = text.value; markDirty(); } });
    text.value = q.question;

    let answer;
    if (q.type === 'multiple_choice') {
      answer = h('fieldset', { class: 'q-answers' },
        h('legend', {}, 'Variantlar (düzgün olanı işarələyin)'),
        q.options.map((option, j) => {
          const field = h('input', { type: 'text', 'aria-label': `Variant ${j + 1}`, oninput: () => { q.options[j] = field.value; markDirty(); } });
          field.value = option;
          return h('div', { class: 'q-answer' },
            h('input', { type: 'radio', name: `correct-${i}`, checked: q.correct === j, 'aria-label': `Variant ${j + 1} düzgündür`, onchange: () => { q.correct = j; markDirty(); } }),
            field);
        }),
        q.options.length < 6 && h('div', {}, h('button', {
          type: 'button', class: 'btn quiet small',
          onclick: () => { q.options.push(''); markDirty(); renderQuestionEditors(); }
        }, 'Variant əlavə et')));
    } else if (q.type === 'true_false') {
      answer = h('fieldset', { class: 'q-answers' },
        h('legend', {}, 'Düzgün cavab'),
        [[true, 'Doğrudur'], [false, 'Yanlışdır']].map(([value, label]) =>
          h('div', { class: 'q-answer' }, h('label', {},
            h('input', { type: 'radio', name: `correct-${i}`, checked: q.answer === value, onchange: () => { q.answer = value; markDirty(); } }),
            label))));
    } else {
      const field = h('input', { type: 'text', oninput: () => { q.answer = field.value; markDirty(); } });
      field.value = q.answer;
      answer = h('label', { class: 'field' }, h('span', {}, 'Düzgün cavab'), field,
        h('small', {}, 'Sualda boşluğu ___ ilə göstərin. Böyük və kiçik hərf fərqi yoxdur.'));
    }

    return h('fieldset', { class: 'q-edit' },
      h('legend', { class: 'sr-only' }, `Sual ${i + 1}`),
      h('div', { class: 'q-edit-head' },
        type,
        h('button', {
          type: 'button', class: 'btn danger small',
          onclick: () => { draft.questions.splice(i, 1); markDirty(); renderQuestionEditors(); }
        }, 'Sualı sil')),
      h('label', { class: 'field' }, h('span', {}, `Sual ${i + 1}`), text),
      answer);
  }

  const save = h('button', { type: 'button', class: 'btn', id: 'lessonSave', disabled: !!tableError, onclick: saveLesson }, 'Yadda saxla və dərc et');
  const revert = rows.has(node.id) && h('button', { type: 'button', class: 'btn secondary', onclick: revertLesson }, 'Fayldakı versiyaya qaytar');

  renderAudio();
  renderQuestionEditors();

  $('editor').replaceChildren(h('div', { class: 'editor-inner' },
    h('div', { class: 'editor-head' },
      h('button', { type: 'button', class: 'btn quiet back-list', onclick: () => $('panel-lessons').classList.remove('editing') }, 'Mövzulara qayıt'),
      h('h1', {}, node.title),
      h('p', { class: 'muted' }, section.title)),
    tableNotice(),
    h('section', { class: 'editor-section' },
      h('h2', {}, 'Mətn'),
      h('p', { class: 'muted' }, 'Sətri "-" ilə başlasanız siyahı, "1." ilə başlasanız nömrəli siyahı olur. BÖYÜK HƏRFLƏ yazılmış qısa sətir alt başlıqdır.'),
      h('div', { class: 'tabs', role: 'group', 'aria-label': 'Mətn görünüşü' }, writeTab, previewTab),
      textarea, preview),
    h('section', { class: 'editor-section' },
      h('h2', {}, 'Səs yazısı'),
      h('p', { class: 'muted' }, 'MP3, M4A, OGG və ya WAV, ən çoxu 20 MB.'),
      audioBox),
    h('section', { class: 'editor-section' },
      h('h2', {}, 'Dərsin sualları'),
      h('p', { class: 'muted' }, 'İstəyə bağlıdır. Sual yoxdursa, öyrənən dərsi oxuyub "Bitirdim" düyməsini basır.'),
      questionBox,
      h('button', {
        type: 'button', class: 'btn secondary',
        onclick: () => {
          draft.questions.push(blankQuestion('multiple_choice'));
          markDirty();
          renderQuestionEditors();
          questionBox.lastElementChild.querySelector('input[type="text"]').focus();
        }
      }, 'Sual əlavə et')),
    h('div', { class: 'save-bar' },
      save, revert,
      h('p', { class: 'status', id: 'lessonStatus', role: 'status' }))));
}

// The storage path of an uploaded file, or null for files that ship with the site.
function storagePath(url) {
  const marker = `/${AUDIO_BUCKET}/`;
  const at = url ? url.indexOf(marker) : -1;
  return at < 0 ? null : decodeURIComponent(url.slice(at + marker.length));
}

async function removeAudio(path) {
  if (!path) return;
  const { error } = await db.storage.from(AUDIO_BUCKET).remove([path]);
  if (error) console.error('old audio not removed:', error);
}

async function uploadAudio(nodeId, file) {
  const extension = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${nodeId.replace(/[^a-zA-Z0-9._-]/g, '_')}/${Date.now()}.${extension}`;
  const { error } = await db.storage.from(AUDIO_BUCKET).upload(path, file, { contentType: file.type || 'audio/mpeg' });
  if (error) throw new Error(`Səs yüklənmədi: ${error.message}`);
  return { path, url: db.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl };
}

async function saveLesson() {
  const status = $('lessonStatus');
  const { nodeId, draft } = editor;
  if (editor.busy) return;

  let questions;
  try {
    questions = Content.cleanQuestions(draft.questions.map(q =>
      q.type === 'multiple_choice' ? { ...q, answer: q.options[q.correct] } : q));
  } catch (e) {
    return setStatus(status, e.message, 'bad');
  }

  const lesson = draft.lesson.trim();
  if (!lesson && !draft.audio && !draft.file &&
      !confirm('Mətn və səs boşdur: bu mövzu öyrənənlərə görünməyəcək. Yadda saxlanılsın?')) return;

  editor.busy = true;
  $('lessonSave').disabled = true;
  setStatus(status, draft.file ? 'Səs yüklənir…' : 'Yadda saxlanılır…');

  let uploaded = null;
  try {
    if (draft.file) uploaded = await uploadAudio(nodeId, draft.file);
    const previousPath = storagePath(rows.get(nodeId)?.audio_url);
    const row = {
      node_id: nodeId,
      lesson,
      audio_url: uploaded ? uploaded.url : draft.audio || null,
      questions,
      updated_at: new Date().toISOString()
    };
    const { error } = await db.from('lesson_content').upsert(row);
    if (error) throw new Error(`Yadda saxlanmadı: ${error.message}`);

    rows.set(nodeId, row);
    if (previousPath && previousPath !== storagePath(row.audio_url)) await removeAudio(previousPath);

    editor.busy = false;
    editor.dirty = false;
    openTopic(nodeId, { force: true });
    setStatus('lessonStatus', Content.hasContent(effectiveNode(findOutlineNode(nodeId)))
      ? 'Yadda saxlanıldı və dərc edildi.'
      : 'Yadda saxlanıldı. Mövzu boş olduğu üçün gizlidir.', 'ok');
  } catch (e) {
    console.error('saveLesson failed:', e);
    if (uploaded) await removeAudio(uploaded.path);
    editor.busy = false;
    $('lessonSave').disabled = false;
    setStatus(status, e.message, 'bad');
  }
}

async function revertLesson() {
  const { nodeId } = editor;
  if (editor.busy || !confirm('Admin paneldə yazdığınız versiya silinəcək. Davam edilsin?')) return;
  editor.busy = true;
  const path = storagePath(rows.get(nodeId)?.audio_url);
  const { error } = await db.from('lesson_content').delete().eq('node_id', nodeId);
  editor.busy = false;
  if (error) return setStatus('lessonStatus', `Silinmədi: ${error.message}`, 'bad');
  rows.delete(nodeId);
  await removeAudio(path);
  openTopic(nodeId, { force: true });
  setStatus('lessonStatus', 'Fayldakı versiya bərpa edildi.', 'ok');
}

// ── Review questions ─────────────────────────────────────
// Fetched one page at a time, with the search pushed into the query.

const PAGE_SIZE = 10;
const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'];
const QUESTION_FIELDS = ['fQuestion', 'fA', 'fB', 'fC', 'fD', 'fE', 'fCategory'];

let totalCount = 0;
let currentPage = 0;
let editingId = null;
let searchTerm = '';
let searchTimer = null;

async function loadQuestions() {
  let query = db.from('review_questions').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (searchTerm) query = query.ilike('question', `%${searchTerm}%`);
  const start = currentPage * PAGE_SIZE;
  const { data, error, count } = await query.range(start, start + PAGE_SIZE - 1);
  if (error) return setStatus('qCount', `Xəta: ${error.message}`, 'bad');

  totalCount = count || 0;
  // Deleting the last row of a page would otherwise leave an empty page behind.
  if (!data.length && currentPage > 0) {
    currentPage -= 1;
    return loadQuestions();
  }
  $('qCount').textContent = `${totalCount} sual`;
  renderQuestions(data);
  loadCategoryList();
}

async function loadCategoryList() {
  const { data, error } = await db.from('review_questions').select('category').not('category', 'is', null);
  if (error) return;
  const categories = [...new Set(data.map(q => q.category).filter(Boolean))].sort();
  $('qCategoryList').replaceChildren(...categories.map(c => h('option', { value: c })));
}

function renderQuestions(questions) {
  const list = $('qList');
  if (!questions.length) {
    list.replaceChildren(h('li', { class: 'empty' }, searchTerm ? 'Axtarışa uyğun sual tapılmadı.' : 'Hələ sual yoxdur.'));
    return $('qPager').replaceChildren();
  }

  list.replaceChildren(...questions.map(q => h('li', {},
    h('div', { class: 'row-body' },
      h('p', { class: 'row-title' }, q.question),
      h('p', { class: 'row-options' }, OPTION_KEYS.filter(k => q[`option_${k}`]).map(k =>
        h('span', { class: k === q.correct ? 'is-correct' : undefined }, `${k.toUpperCase()}. ${q[`option_${k}`]}${k === q.correct ? ' (düzgün)' : ''}`))),
      q.category && h('span', { class: 'row-tag' }, q.category)),
    h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'btn secondary small', onclick: () => editQuestion(q) }, 'Düzəlt'),
      h('button', { type: 'button', class: 'btn danger small', onclick: () => deleteQuestion(q.id) }, 'Sil')))));

  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (pages <= 1) return $('qPager').replaceChildren();
  const move = step => { currentPage += step; loadQuestions(); $('qList').scrollIntoView({ block: 'start' }); };
  $('qPager').replaceChildren(
    h('button', { type: 'button', class: 'btn secondary small', disabled: currentPage === 0, onclick: () => move(-1) }, 'Əvvəlki'),
    h('span', {}, `${currentPage + 1} / ${pages}`),
    h('button', { type: 'button', class: 'btn secondary small', disabled: currentPage >= pages - 1, onclick: () => move(1) }, 'Növbəti'));
}

$('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = $('searchInput').value.trim();
    currentPage = 0;
    loadQuestions();
  }, 300);
});

function resetQuestionForm() {
  editingId = null;
  QUESTION_FIELDS.forEach(id => { $(id).value = ''; });
  $('fCorrect').value = 'a';
  $('questionFormTitle').textContent = 'Yeni sual';
  $('saveBtn').textContent = 'Əlavə et';
  $('cancelEditBtn').hidden = true;
}

function editQuestion(q) {
  editingId = q.id;
  $('fQuestion').value = q.question;
  OPTION_KEYS.forEach(k => { $(`f${k.toUpperCase()}`).value = q[`option_${k}`] || ''; });
  $('fCorrect').value = q.correct;
  $('fCategory').value = q.category || '';
  $('questionFormTitle').textContent = 'Sualı düzəlt';
  $('saveBtn').textContent = 'Yadda saxla';
  $('cancelEditBtn').hidden = false;
  setStatus('addStatus', '');
  $('questionForm').scrollIntoView({ block: 'start' });
  $('fQuestion').focus({ preventScroll: true });
}

$('cancelEditBtn').addEventListener('click', () => { resetQuestionForm(); setStatus('addStatus', ''); });

$('questionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('saveBtn');
  if (button.disabled) return;

  const value = id => $(id).value.trim();
  const record = {
    question: value('fQuestion'),
    option_a: value('fA'), option_b: value('fB'), option_c: value('fC'), option_d: value('fD'),
    option_e: value('fE') || null,
    correct: $('fCorrect').value,
    category: value('fCategory') || null
  };
  if (!record.question || !record.option_a || !record.option_b || !record.option_c || !record.option_d) {
    return setStatus('addStatus', 'Sual mətni və A–D variantları mütləqdir.', 'bad');
  }
  if (record.correct === 'e' && !record.option_e) {
    return setStatus('addStatus', 'Düzgün cavab E seçilib, amma E variantı boşdur.', 'bad');
  }

  const wasEditing = editingId;
  button.disabled = true;
  setStatus('addStatus', 'Yadda saxlanılır…');
  try {
    const table = db.from('review_questions');
    const { error } = wasEditing ? await table.update(record).eq('id', wasEditing) : await table.insert(record);
    if (error) return setStatus('addStatus', error.message, 'bad');
    resetQuestionForm();
    setStatus('addStatus', wasEditing ? 'Yeniləndi.' : 'Əlavə edildi.', 'ok');
    loadQuestions();
  } finally {
    button.disabled = false;
  }
});

async function deleteQuestion(id) {
  if (!confirm('Bu sualı silmək istəyirsiniz?')) return;
  const { error } = await db.from('review_questions').delete().eq('id', id);
  if (error) return showToast(`Silinmədi: ${error.message}`);
  if (editingId === id) resetQuestionForm();
  loadQuestions();
}

$('bulkCategoryBtn').addEventListener('click', async () => {
  const category = $('bulkCategoryInput').value.trim();
  if (!category) return setStatus('bulkCategoryStatus', 'Kateqoriya adını yazın.', 'bad');

  const { data, error: selectError } = await db.from('review_questions').select('id').is('category', null);
  if (selectError) return setStatus('bulkCategoryStatus', selectError.message, 'bad');
  if (!data?.length) return setStatus('bulkCategoryStatus', 'Bütün sualların kateqoriyası var.', 'ok');

  setStatus('bulkCategoryStatus', `${data.length} sual yenilənir…`);
  const { error } = await db.from('review_questions').update({ category }).in('id', data.map(q => q.id));
  if (error) return setStatus('bulkCategoryStatus', error.message, 'bad');
  setStatus('bulkCategoryStatus', `${data.length} sual "${category}" kateqoriyasına keçirildi.`, 'ok');
  loadQuestions();
});

// Quote-aware CSV/TSV tokenizer, so a quoted cell with a line break
// (wrapped text pasted from Sheets) does not split its row.
function tokenizeDelimited(text, delimiter) {
  const out = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); cell = ''; out.push(row); row = []; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.trim()); out.push(row); }
  return out.filter(r => r.some(c => c !== ''));
}

let pendingRecords = null;

function clearBulkPreview() {
  pendingRecords = null;
  $('bulkPreview').replaceChildren();
  $('bulkConfirmBtn').hidden = true;
}

$('bulkPaste').addEventListener('input', clearBulkPreview);

$('bulkPreviewBtn').addEventListener('click', () => {
  const raw = $('bulkPaste').value.trim();
  clearBulkPreview();
  if (!raw) return setStatus('bulkStatus', 'Mətn boşdur.', 'bad');

  const parsed = tokenizeDelimited(raw, raw.includes('\t') ? '\t' : ',').filter(r => r.length >= 6);
  if (!parsed.length) return setStatus('bulkStatus', 'Format yanlışdır: ən azı 6 sütun lazımdır.', 'bad');

  const records = [];
  for (const cells of parsed) {
    // The last column is the correct letter; everything between the question and it is an option.
    const correct = cells[cells.length - 1].toLowerCase().trim();
    if (!OPTION_KEYS.includes(correct)) return setStatus('bulkStatus', `Yanlış cavab hərfi: "${correct}". a, b, c, d və ya e olmalıdır.`, 'bad');
    const options = cells.slice(1, -1);
    records.push({
      question: cells[0],
      option_a: options[0] || '', option_b: options[1] || '',
      option_c: options[2] || '', option_d: options[3] || '',
      option_e: options[4] || null,
      correct
    });
  }

  $('bulkPreview').replaceChildren(...records.map(r => h('li', {},
    h('div', { class: 'row-body' },
      h('p', { class: 'row-title' }, r.question),
      h('p', { class: 'row-options' }, OPTION_KEYS.filter(k => r[`option_${k}`]).map(k =>
        h('span', { class: k === r.correct ? 'is-correct' : undefined }, `${k.toUpperCase()}. ${r[`option_${k}`]}${k === r.correct ? ' (düzgün)' : ''}`)))))));
  pendingRecords = records;
  $('bulkConfirmBtn').hidden = false;
  setStatus('bulkStatus', `${records.length} sual tapıldı. Yoxlayıb təsdiqləyin.`);
});

$('bulkConfirmBtn').addEventListener('click', async () => {
  const button = $('bulkConfirmBtn');
  if (button.disabled || !pendingRecords?.length) return;
  button.disabled = true;
  try {
    const count = pendingRecords.length;
    setStatus('bulkStatus', `${count} sual əlavə edilir…`);
    const { error } = await db.from('review_questions').insert(pendingRecords);
    if (error) {
      console.error('bulk insert failed:', error);
      return setStatus('bulkStatus', error.message, 'bad');
    }
    $('bulkPaste').value = '';
    clearBulkPreview();
    setStatus('bulkStatus', `${count} sual əlavə edildi.`, 'ok');
    loadQuestions();
  } finally {
    button.disabled = false;
  }
});

// ── Words ────────────────────────────────────────────────

async function loadVocabItems() {
  const { data, error } = await db.from('vocab_items').select('*').order('category').order('english');
  const list = $('vocabList');
  if (error) return list.replaceChildren(h('li', { class: 'empty' }, `Xəta: ${error.message}`));

  $('vocabCount').textContent = `${data.length} söz`;
  if (!data.length) return list.replaceChildren(h('li', { class: 'empty' }, 'Hələ söz əlavə edilməyib.'));

  const categories = [...new Set(data.map(v => v.category))];
  $('categoryList').replaceChildren(...categories.map(c => h('option', { value: c })));

  list.replaceChildren(...data.map(v => h('li', {},
    h('span', { class: 'row-emoji', 'aria-hidden': 'true' }, v.emoji),
    h('div', { class: 'row-body' },
      h('p', { class: 'row-title', lang: 'en' }, v.english),
      h('p', { class: 'muted' }, v.azerbaijani),
      h('span', { class: 'row-tag' }, v.category)),
    h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'btn danger small', onclick: () => deleteVocabItem(v.id) }, 'Sil')))));
}

$('vocabForm').addEventListener('submit', async event => {
  event.preventDefault();
  const value = id => $(id).value.trim();
  const record = {
    emoji: value('vEmoji'),
    english: value('vEnglish'),
    azerbaijani: value('vAz'),
    category: value('vCategory').toLowerCase(),
    image_url: value('vImageUrl') || null
  };
  if (!record.emoji || !record.english || !record.azerbaijani || !record.category) {
    return setStatus('vocabAddStatus', 'Emoji, ingiliscə, azərbaycanca və kateqoriya mütləqdir.', 'bad');
  }
  const button = $('vocabForm').querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  setStatus('vocabAddStatus', 'Əlavə edilir…');
  try {
    const { error } = await db.from('vocab_items').insert(record);
    if (error) return setStatus('vocabAddStatus', error.message, 'bad');
    ['vEmoji', 'vEnglish', 'vAz', 'vCategory', 'vImageUrl'].forEach(id => { $(id).value = ''; });
    setStatus('vocabAddStatus', 'Əlavə edildi.', 'ok');
    loadVocabItems();
  } finally {
    button.disabled = false;
  }
});

async function deleteVocabItem(id) {
  if (!confirm('Bu sözü silmək istəyirsiniz?')) return;
  const { error } = await db.from('vocab_items').delete().eq('id', id);
  if (error) return showToast(`Silinmədi: ${error.message}`);
  loadVocabItems();
}
