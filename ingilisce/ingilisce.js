// İngiliscə Öyrən: learner app.
// `db` comes from config.js; `Content` (lesson formatting and merging) from content.js.

const MAX_LIVES = 5;
const DEFAULT_STATE = { completedNodes: [], lives: MAX_LIVES };

let course = null;          // curriculum.json merged with lesson_content, empty topics removed
let userId = null;
let profileName = null;
let selectedSection = null;

let viewToken = 0;          // bumped on every route change, so late async work can bail out
let advanceTimer = null;
let currentAudio = null;
let quiz = null;            // { nodeId, questions, index }
let vocabCategory = null;

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');

// ── Small helpers (h() is in ui.js) ──────────────────────

const ICONS = {
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.2a4.2 4.2 0 017.5 2.6C19.5 15.4 12 20 12 20z"/>'
};

function icon(name) {
  const span = h('span');
  span.innerHTML = `<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

function hearts(count) {
  const el = h('span', { class: 'hearts', role: 'img', 'aria-label': `${count} / ${MAX_LIVES} can` });
  for (let i = 0; i < MAX_LIVES; i++) {
    const heart = icon('heart');
    if (i < count) heart.classList.add('full');
    el.append(heart);
  }
  return el;
}

function show(...nodes) { view.replaceChildren(...nodes); }

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4000);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const normalizeAnswer = value => String(value).trim().toLowerCase();

// ── Progress storage ─────────────────────────────────────
// The "normal" part of the key predates this file; changing it would lose saved progress.

const stateKey = () => `igp_normal_${profileName}`;

function loadState() {
  try {
    const saved = localStorage.getItem(stateKey());
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
}

let syncQueue = Promise.resolve();
let syncedNodes = new Set();

function saveState(state) {
  localStorage.setItem(stateKey(), JSON.stringify(state));
  syncQueue = syncQueue.then(syncProgress).catch(() => {});
}

// Progress is synced one completed node at a time via the append_progress RPC,
// which only allows appending to the server's array.
async function syncProgress() {
  if (!userId) return;
  const pending = loadState().completedNodes.filter(id => !syncedNodes.has(id));
  for (const nodeId of pending) {
    const { error } = await db.rpc('append_progress', { p_mode: 'normal', p_node_id: nodeId });
    if (error) {
      console.error('syncProgress failed:', error);
      showToast('Sinxronizasiya alınmadı, internetinizi yoxlayın.');
      return;
    }
    syncedNodes.add(nodeId);
  }
}

function readStreak() {
  try {
    return JSON.parse(localStorage.getItem(`igp_streak_${profileName}`)) || { count: 0, lastDate: null };
  } catch { return { count: 0, lastDate: null }; }
}

const yesterdayString = () => new Date(Date.now() - 864e5).toDateString();

// A streak is only still running if the last study day was today or yesterday.
function currentStreak() {
  const { count, lastDate } = readStreak();
  return lastDate === new Date().toDateString() || lastDate === yesterdayString() ? count : 0;
}

function recordStudyDay() {
  const today = new Date().toDateString();
  const streak = readStreak();
  if (streak.lastDate === today) return;
  streak.count = streak.lastDate === yesterdayString() ? streak.count + 1 : 1;
  streak.lastDate = today;
  localStorage.setItem(`igp_streak_${profileName}`, JSON.stringify(streak));
}

function resetLivesDaily() {
  const today = new Date().toDateString();
  const key = `igp_lives_date_${profileName}`;
  if (localStorage.getItem(key) === today) return;
  saveState({ ...loadState(), lives: MAX_LIVES });
  localStorage.setItem(key, today);
}

// ── Course helpers ───────────────────────────────────────

const allNodes = () => course.sections.flatMap(s => s.nodes);
const sectionOf = nodeId => course.sections.find(s => s.nodes.some(n => n.id === nodeId));

function progress() {
  const done = new Set(loadState().completedNodes);
  const nodes = allNodes();
  return {
    done,
    total: nodes.length,
    completed: nodes.filter(n => done.has(n.id)).length,
    next: nodes.find(n => !done.has(n.id)) || null
  };
}

function nodeStatus(node, { done, next }) {
  if (done.has(node.id)) return 'done';
  return next && next.id === node.id ? 'current' : 'locked';
}

function nodeSummary(node) {
  const parts = [];
  if (node.lesson && node.lesson.trim()) parts.push('Mətn');
  if (node.audio) parts.push('Səs');
  if (node.questions?.length) parts.push(`${node.questions.length} sual`);
  return parts.join(' · ');
}

// ── Routing ──────────────────────────────────────────────

function go(hash) {
  if ((location.hash || '#/') === hash) route();
  else location.hash = hash;
}

function leaveView() {
  viewToken++;
  clearTimeout(advanceTimer);
  currentAudio?.pause();
  currentAudio = null;
  document.removeEventListener('keydown', onOptionKey);
  document.getElementById('accountMenu').hidden = true;
  document.getElementById('accountBtn').setAttribute('aria-expanded', 'false');
}

function setChrome(nav, title) {
  topbar.hidden = !nav;
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = title ? `${title} · İngiliscə Öyrən` : 'İngiliscə Öyrən';
}

function route() {
  if (!course) return;
  leaveView();
  if (!userId) return renderAuth();

  const [, page, id, sub] = location.hash.split('/');
  window.scrollTo(0, 0);

  if (page === 'ders') return sub === 'sual' ? renderQuiz(id) : renderLesson(id);
  quiz = null;
  if (page === 'tekrar') return renderReviewSetup();
  if (page === 'soz') return renderVocabSetup();
  renderCourse();
}

// ── Course (home) ────────────────────────────────────────

function renderCourse() {
  setChrome('course');
  if (!course.sections.length) {
    return show(h('p', { class: 'page-message' }, 'Hələ dərs dərc edilməyib.'));
  }
  const info = progress();
  const currentSection = info.next && sectionOf(info.next.id);
  let section = course.sections.find(s => s.id === selectedSection) || currentSection || course.sections[0];
  selectedSection = section.id;

  const index = h('nav', { class: 'thumb-index', 'aria-label': 'Bölmələr' },
    course.sections.map(s => {
      const done = s.nodes.filter(n => info.done.has(n.id)).length;
      return h('button', {
        type: 'button',
        'aria-current': s.id === section.id ? 'true' : undefined,
        onclick: () => {
          selectedSection = s.id;
          route();
          view.querySelector('.thumb-index [aria-current]')?.focus();
        }
      },
      h('span', {}, Content.splitTitle(s.title).az),
      h('small', {}, `${done} / ${s.nodes.length}`));
    }));

  const { az, en } = Content.splitTitle(section.title);
  const sectionDone = section.nodes.filter(n => info.done.has(n.id)).length;

  const entries = h('ol', { class: 'entries' }, section.nodes.map((node, i) => {
    const status = nodeStatus(node, info);
    return h('li', { class: `entry ${status}` },
      h('button', {
        type: 'button',
        disabled: status === 'locked',
        onclick: () => go(`#/ders/${node.id}`)
      },
      h('span', { class: 'mark', 'aria-hidden': 'true' }, status === 'done' ? icon('check') : String(i + 1)),
      h('span', { class: 'entry-text' },
        h('span', { class: 'entry-title' }, node.title),
        status === 'current' && h('span', { class: 'entry-meta' }, nodeSummary(node))),
      status === 'current' && h('span', { class: 'btn entry-start' }, 'Dərsə başla'),
      status === 'locked' && icon('lock'),
      h('span', { class: 'sr-only' }, status === 'done' ? 'keçilib' : status === 'locked' ? 'bağlıdır' : 'cari mövzu')));
  }));

  const main = h('div', { class: 'course-main' },
    h('div', { class: 'headword' },
      h('h1', {}, az),
      en && h('p', { class: 'headword-en', lang: 'en' }, en)),
    h('p', { class: 'muted headword-count' }, `${sectionDone} / ${section.nodes.length} mövzu keçilib`),
    entries);

  const elsewhere = info.next && currentSection.id !== section.id;
  const streak = currentStreak();
  const percent = Math.round((info.completed / info.total) * 100);

  const side = h('aside', { class: 'course-side', 'aria-label': 'Göstəriciləriniz' },
    elsewhere && h('section', { class: 'side-block notice' },
      h('h2', {}, 'Cari mövzu'),
      h('p', {}, info.next.title),
      h('button', {
        class: 'btn small', type: 'button',
        onclick: () => { selectedSection = currentSection.id; route(); }
      }, 'Ora qayıt')),
    !info.next && h('section', { class: 'side-block notice' },
      h('h2', {}, 'Hamısı keçilib'),
      h('p', {}, 'Bütün dərc edilmiş mövzuları tamamladınız.')),
    h('section', { class: 'side-block stats' },
      h('p', { class: 'stat-streak' }, streak ? `${streak} gün ardıcıl` : 'Bu gün bir mövzu keçin'),
      h('p', { class: 'stat-lives' }, hearts(loadState().lives)),
      h('div', { class: 'stat-progress' },
        h('p', {}, `${info.completed} / ${info.total} mövzu`),
        h('progress', { max: '100', value: String(percent), 'aria-label': 'Kursun gedişi' }))),
    h('section', { class: 'side-block practice' },
      h('h2', {}, 'Məşq'),
      h('a', { class: 'btn secondary', href: '#/tekrar' }, 'Təkrar sualları'),
      h('a', { class: 'btn secondary', href: '#/soz' }, 'Söz oyunu')));

  show(h('div', { class: 'course' }, index, main, side));

  // Keep the current tab and the current entry in sight.
  const tab = index.querySelector('[aria-current]');
  if (index.scrollWidth > index.clientWidth) index.scrollLeft = tab.offsetLeft - 16;
  const current = main.querySelector('.entry.current');
  if (current && current.getBoundingClientRect().bottom > window.innerHeight) {
    current.scrollIntoView({ block: 'center' });
  }
}

// ── Lesson ───────────────────────────────────────────────

function findOpenNode(nodeId) {
  const node = allNodes().find(n => n.id === nodeId);
  if (!node) return null;
  const status = nodeStatus(node, progress());
  return status === 'locked' ? null : { node, status };
}

const redirect = hash => { location.replace(hash); };

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function audioPlayer(src) {
  const audio = new Audio(src);
  audio.preload = 'metadata';
  currentAudio = audio;

  const button = h('button', { type: 'button', class: 'play', 'aria-label': 'Səsləndir' }, icon('play'));
  const seek = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Səs yazısında yer' });
  const time = h('span', { class: 'time' }, '0:00');
  const player = h('div', { class: 'player' }, button, seek, time);

  const setPlaying = playing => {
    button.replaceChildren(icon(playing ? 'pause' : 'play'));
    button.setAttribute('aria-label', playing ? 'Dayandır' : 'Səsləndir');
  };
  const update = () => {
    const total = Number.isFinite(audio.duration) ? audio.duration : 0;
    time.textContent = total ? `${formatTime(audio.currentTime)} / ${formatTime(total)}` : formatTime(audio.currentTime);
    const ratio = total ? audio.currentTime / total : 0;
    seek.value = String(Math.round(ratio * 1000));
    seek.style.setProperty('--played', `${ratio * 100}%`);
  };

  button.addEventListener('click', () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('timeupdate', update);
  audio.addEventListener('loadedmetadata', update);
  audio.addEventListener('error', () => player.replaceChildren(h('span', { class: 'muted' }, 'Səs yazısı yüklənmədi.')));
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
  });
  return player;
}

function renderLesson(nodeId) {
  const found = findOpenNode(nodeId);
  if (!found) return redirect('#/');
  const { node, status } = found;
  quiz = null;
  selectedSection = sectionOf(nodeId).id;
  setChrome('course', node.title);

  const body = h('div', { class: 'lesson-body' });
  Content.renderLesson(body, node.lesson);

  const questionCount = node.questions?.length || 0;
  let action;
  if (status === 'done') {
    action = [h('p', { class: 'muted' }, 'Bu mövzu keçilib.'), h('a', { class: 'btn secondary', href: '#/' }, 'Kursa qayıt')];
  } else if (questionCount) {
    action = [
      h('p', { class: 'muted' }, `${questionCount} sual`, hearts(loadState().lives)),
      h('button', {
        class: 'btn', type: 'button',
        onclick: () => {
          quiz = { nodeId, questions: shuffle(node.questions), index: 0 };
          go(`#/ders/${nodeId}/sual`);
        }
      }, 'Suallara keç')
    ];
  } else {
    action = [h('span'), h('button', { class: 'btn', type: 'button', onclick: () => completeNode(nodeId) }, 'Bitirdim')];
  }

  show(
    h('article', { class: 'lesson' },
      h('a', { class: 'back', href: '#/' }, icon('back'), Content.splitTitle(sectionOf(nodeId).title).az),
      h('h1', {}, node.title),
      node.audio && audioPlayer(node.audio),
      body),
    h('div', { class: 'action-bar' }, h('div', { class: 'action-inner' }, action)));
}

// ── Question screen (lesson quiz and review) ─────────────

function onOptionKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.target.matches('input[type="text"]')) return;
  const option = view.querySelectorAll('.option input')[Number(event.key) - 1];
  if (!option || option.disabled) return;
  option.checked = true;
  option.focus();
  option.dispatchEvent(new Event('change', { bubbles: true }));
}

function practiceHeader({ backHref, backLabel, index, total, lives }) {
  return h('header', { class: 'practice-head' },
    h('a', { class: 'btn quiet', href: backHref }, icon('cross'), h('span', {}, backLabel)),
    h('div', { class: 'practice-progress' },
      h('span', {}, `${index + 1} / ${total}`),
      h('progress', { max: String(total), value: String(index), 'aria-label': 'Gediş' })),
    h('span', { class: 'practice-lives' }, lives === undefined ? null : hearts(lives)));
}

function answerText(question) {
  if (question.type === 'true_false') return String(question.answer) === 'true' ? 'Doğrudur' : 'Yanlışdır';
  return String(question.answer);
}

// Renders one question. onGraded(isCorrect) returns the label of the continue button.
function questionScreen({ header, question, hint, onGraded, onNext }) {
  const isText = question.type === 'fill_blank';
  const options = question.type === 'true_false'
    ? [{ label: 'Doğrudur', value: 'true' }, { label: 'Yanlışdır', value: 'false' }]
    : (question.options || []).map(o => ({ label: o, value: o }));

  let graded = false;
  const check = h('button', { class: 'btn', type: 'submit', disabled: true }, 'Yoxla');
  const verdict = h('div', { class: 'verdict', role: 'status' });
  const hintText = h('p', { class: 'hint', role: 'status', hidden: true });

  let answers;
  let input;
  if (isText) {
    input = h('input', {
      type: 'text', class: 'fill', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      'aria-label': 'Cavabınız', placeholder: 'Cavabınızı yazın',
      oninput: () => { check.disabled = !input.value.trim(); }
    });
    answers = input;
  } else {
    answers = h('fieldset', { class: 'options' },
      h('legend', { class: 'sr-only' }, 'Cavab variantları'),
      options.map(o => h('label', { class: 'option' },
        h('input', { type: 'radio', name: 'answer', value: o.value, onchange: () => { if (!graded) check.disabled = false; } }),
        h('span', {}, o.label))));
  }

  const hintButton = hint && question.type !== 'true_false' && h('button', {
    class: 'btn quiet', type: 'button',
    onclick: event => {
      event.currentTarget.disabled = true;
      if (isText) {
        const answer = String(question.answer);
        hintText.textContent = `İlk hərf: ${answer[0].toUpperCase()}${' _'.repeat(Math.max(0, answer.length - 1))}`;
        hintText.hidden = false;
        input.focus();
        return;
      }
      const wrong = [...answers.querySelectorAll('input')]
        .filter(r => normalizeAnswer(r.value) !== normalizeAnswer(question.answer) && !r.disabled);
      if (!wrong.length) return;
      const target = wrong[Math.floor(Math.random() * wrong.length)];
      if (target.checked) { target.checked = false; check.disabled = true; }
      target.disabled = true;
      target.parentElement.classList.add('removed');
    }
  }, 'İpucu');

  const footerButtons = h('div', { class: 'action-inner' }, hintButton || h('span'), check);

  const form = h('form', {
    class: 'question',
    onsubmit: event => {
      event.preventDefault();
      if (graded) return;
      const chosen = isText ? input.value.trim() : form.querySelector('input:checked')?.value;
      if (!chosen) return;
      graded = true;
      const correct = normalizeAnswer(chosen) === normalizeAnswer(question.answer);

      if (isText) {
        input.disabled = true;
        input.classList.add(correct ? 'correct' : 'wrong');
      } else {
        answers.querySelectorAll('input').forEach(radio => {
          radio.disabled = true;
          const label = radio.parentElement;
          if (normalizeAnswer(radio.value) === normalizeAnswer(question.answer)) {
            label.classList.add('correct');
            label.append(icon('check'));
          } else if (radio.checked) {
            label.classList.add('wrong');
            label.append(icon('cross'));
          }
        });
      }
      if (hintButton) hintButton.disabled = true;

      const nextLabel = onGraded(correct);
      verdict.classList.add(correct ? 'correct' : 'wrong');
      verdict.append(
        h('strong', {}, correct ? 'Düzgün!' : 'Səhv.'),
        !correct ? h('span', {}, ` Düzgün cavab: ${answerText(question)}`) : '');
      const next = h('button', { class: 'btn', type: 'button', onclick: onNext }, nextLabel);
      footerButtons.replaceChildren(h('span'), next);
      next.focus();
    }
  },
  h('h1', { class: 'prompt' }, question.question),
  answers,
  hintText,
  h('div', { class: 'action-bar' }, verdict, footerButtons));

  show(header, form);
  document.removeEventListener('keydown', onOptionKey);
  if (!isText) document.addEventListener('keydown', onOptionKey);
  (isText ? input : answers.querySelector('input'))?.focus({ preventScroll: true });
}

function resultScreen({ title, text, wrong, actions }) {
  show(h('div', { class: 'result' },
    h('h1', { tabindex: '-1' }, title),
    h('p', { class: 'result-text' }, text),
    wrong?.length ? h('section', { class: 'mistakes' },
      h('h2', {}, 'Səhvləriniz'),
      h('ul', {}, wrong.map(w => h('li', {}, h('span', {}, w.prompt), h('strong', {}, w.answer))))) : null,
    h('div', { class: 'result-actions' }, actions)));
  view.querySelector('h1').focus();
}

// ── Lesson quiz ──────────────────────────────────────────

function renderQuiz(nodeId) {
  const found = findOpenNode(nodeId);
  if (!found) return redirect('#/');
  // Reloading or arriving from history without a running quiz goes back to the lesson.
  if (!quiz || quiz.nodeId !== nodeId || found.status === 'done') return redirect(`#/ders/${nodeId}`);
  setChrome(null, found.node.title);
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const { nodeId, questions, index } = quiz;
  const question = questions[index];
  const lives = loadState().lives;
  const header = practiceHeader({ backHref: `#/ders/${nodeId}`, backLabel: 'Dərsə qayıt', index, total: questions.length, lives });
  let outOfLives = false;

  questionScreen({
    header, question, hint: true,
    onGraded: correct => {
      if (!correct) {
        const state = loadState();
        state.lives -= 1;
        outOfLives = state.lives <= 0;
        header.querySelector('.practice-lives').replaceChildren(hearts(state.lives));
        // Running out refills the lives; the learner rereads the lesson.
        if (outOfLives) state.lives = MAX_LIVES;
        saveState(state);
      }
      return 'Davam et';
    },
    onNext: () => {
      if (outOfLives) {
        quiz = null;
        return resultScreen({
          title: 'Canlar bitdi',
          text: `${MAX_LIVES} can yeniləndi. Dərsi bir də oxuyun.`,
          actions: [h('a', { class: 'btn', href: `#/ders/${nodeId}` }, 'Dərsi yenidən oxu')]
        });
      }
      if (index + 1 >= questions.length) return completeNode(nodeId);
      quiz.index += 1;
      leaveView();
      window.scrollTo(0, 0);
      renderQuizQuestion();
    }
  });
}

function completeNode(nodeId) {
  const state = loadState();
  if (!state.completedNodes.includes(nodeId)) state.completedNodes.push(nodeId);
  state.lives = MAX_LIVES;
  saveState(state);
  recordStudyDay();
  quiz = null;
  leaveView();
  setChrome('course');
  window.scrollTo(0, 0);

  const { next } = progress();
  if (next) selectedSection = sectionOf(next.id).id;
  resultScreen({
    title: 'Mövzu tamamlandı',
    text: next ? `Növbəti mövzu açıldı: ${next.title}` : 'Bütün dərc edilmiş mövzuları tamamladınız.',
    actions: [
      next && h('a', { class: 'btn', href: `#/ders/${next.id}` }, 'Növbəti dərs'),
      h('button', { class: next ? 'btn secondary' : 'btn', type: 'button', onclick: () => go('#/') }, 'Kursa qayıt')
    ]
  });
}

// ── Shared setup screen for practice modes ───────────────

function categoryPicker({ title, intro, categories, selected, startLabel, onStart }) {
  const form = h('form', {
    class: 'setup',
    onsubmit: event => {
      event.preventDefault();
      onStart(form.querySelector('input:checked').value);
    }
  },
  h('h1', {}, title),
  h('p', { class: 'muted' }, intro),
  h('fieldset', { class: 'chips' },
    h('legend', {}, 'Mövzu'),
    [{ value: '', label: 'Hamısı' }, ...categories.map(c => ({ value: c, label: c }))].map(c =>
      h('label', { class: 'chip' },
        h('input', { type: 'radio', name: 'category', value: c.value, checked: c.value === selected }),
        h('span', {}, c.label)))),
  h('button', { class: 'btn' }, startLabel));
  if (!form.querySelector('input:checked')) form.querySelector('input').checked = true;
  show(form);
}

function setupMessage(title, message, retry) {
  show(h('div', { class: 'setup' },
    h('h1', {}, title),
    h('p', { class: 'muted' }, message),
    retry && h('button', { class: 'btn secondary', type: 'button', onclick: route }, 'Yenidən cəhd et')));
}

const categoriesOf = rows => [...new Set(rows.map(r => r.category).filter(Boolean))].sort();

async function fetchRows(table) {
  try {
    const { data, error } = await db.from(table).select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error(`${table} not loaded:`, e);
    return null;
  }
}

// ── Review quiz ──────────────────────────────────────────

async function renderReviewSetup() {
  setChrome('review', 'Təkrar');
  const token = viewToken;
  setupMessage('Təkrar', 'Suallar yüklənir…');
  const rows = await fetchRows('review_questions');
  if (token !== viewToken) return;
  if (!rows) return setupMessage('Təkrar', 'Suallar yüklənmədi. İnterneti yoxlayın.', true);
  if (!rows.length) return setupMessage('Təkrar', 'Hələ təkrar sualı əlavə edilməyib.');

  categoryPicker({
    title: 'Təkrar',
    intro: 'Qarışıq suallar, hər dəfə ən çoxu 25. Canlar burada azalmır.',
    categories: categoriesOf(rows),
    selected: '',
    startLabel: 'Başla',
    onStart: category => {
      const pool = category ? rows.filter(q => q.category === category) : rows;
      const questions = shuffle(pool).slice(0, 25).map(q => ({
        type: 'multiple_choice',
        question: q.question,
        options: shuffle([q.option_a, q.option_b, q.option_c, q.option_d, ...(q.option_e ? [q.option_e] : [])]),
        answer: q[`option_${q.correct}`]
      }));
      runReview({ questions, index: 0, correct: 0, wrong: [] });
    }
  });
}

function runReview(session) {
  leaveView();
  setChrome(null, 'Təkrar');
  window.scrollTo(0, 0);
  const { questions, index } = session;
  const question = questions[index];
  const last = index + 1 >= questions.length;

  const header = practiceHeader({ backHref: '#/', backLabel: 'Çıx', index, total: questions.length });
  questionScreen({
    header, question, hint: false,
    onGraded: correct => {
      if (correct) session.correct += 1;
      else session.wrong.push({ prompt: question.question, answer: question.answer });
      return last ? 'Nəticəyə bax' : 'Davam et';
    },
    onNext: () => {
      if (!last) { session.index += 1; return runReview(session); }
      leaveView();
      setChrome('review', 'Təkrar');
      showScore(session.correct, questions.length, session.wrong, () => route());
    }
  });
}

function showScore(correct, total, wrong, retry) {
  const percent = Math.round((correct / total) * 100);
  resultScreen({
    title: percent >= 80 ? 'Əla nəticə' : percent >= 50 ? 'Yaxşı cəhd' : 'Bir az da məşq edin',
    text: `${correct} / ${total} düzgün (${percent}%)`,
    wrong,
    actions: [
      h('button', { class: 'btn', type: 'button', onclick: retry }, 'Yenidən'),
      h('a', { class: 'btn secondary', href: '#/' }, 'Kursa qayıt')
    ]
  });
}

// ── Word game ────────────────────────────────────────────

async function renderVocabSetup() {
  setChrome('vocab', 'Söz oyunu');
  const token = viewToken;
  setupMessage('Söz oyunu', 'Sözlər yüklənir…');
  const rows = await fetchRows('vocab_items');
  if (token !== viewToken) return;
  if (!rows) return setupMessage('Söz oyunu', 'Sözlər yüklənmədi. İnterneti yoxlayın.', true);
  if (rows.length < 4) return setupMessage('Söz oyunu', 'Oyun üçün hələ kifayət qədər söz əlavə edilməyib.');

  categoryPicker({
    title: 'Söz oyunu',
    intro: 'Şəklə uyğun sözü, sözə uyğun şəkli seçin. Hər oyunda ən çoxu 20 söz və 5 can.',
    categories: categoriesOf(rows),
    selected: vocabCategory || '',
    startLabel: 'Başla',
    onStart: category => startVocab(rows, category)
  });
}

function startVocab(rows, category) {
  vocabCategory = category;
  const pool = category ? rows.filter(v => v.category === category) : rows;

  // First 12 show the picture and ask for the word, the rest the reverse; then mix them.
  const questions = shuffle(shuffle(pool).slice(0, 20).map((item, i) => {
    const sameCategory = pool.filter(v => v.id !== item.id);
    const others = sameCategory.length >= 3 ? sameCategory : rows.filter(v => v.id !== item.id);
    return { item, picture: i < 12, options: shuffle([item, ...shuffle(others).slice(0, 3)]) };
  }));

  runVocab({ rows, category, questions, index: 0, lives: MAX_LIVES, wrong: [] });
}

function runVocab(game) {
  leaveView();
  setChrome(null, 'Söz oyunu');
  window.scrollTo(0, 0);
  const { questions, index } = game;
  const { item, picture, options } = questions[index];
  const header = practiceHeader({ backHref: '#/', backLabel: 'Çıx', index, total: questions.length, lives: game.lives });
  const verdict = h('p', { class: 'sr-only', role: 'status' });

  const grid = h('div', { class: picture ? 'word-options' : 'picture-options' }, options.map(option =>
    h('button', {
      type: 'button', class: 'vocab-option', lang: picture ? 'en' : undefined,
      onclick: event => answer(event.currentTarget, option)
    }, picture ? option.english : option.emoji)));

  function answer(button, option) {
    const correct = option.id === item.id;
    [...grid.children].forEach((b, i) => {
      b.disabled = true;
      if (options[i].id === item.id) b.classList.add('correct');
      else if (b === button) b.classList.add('wrong');
    });
    verdict.textContent = correct ? 'Düzgün' : `Səhv. Düzgün cavab: ${item.english}`;
    if (!correct) {
      game.lives -= 1;
      game.wrong.push({ prompt: `${item.emoji}  ${item.azerbaijani}`, answer: item.english });
      header.querySelector('.practice-lives').replaceChildren(hearts(game.lives));
    }

    advanceTimer = setTimeout(() => {
      const retry = () => startVocab(game.rows, game.category);
      if (game.lives <= 0) {
        leaveView();
        setChrome('vocab', 'Söz oyunu');
        return resultScreen({
          title: 'Canlar bitdi',
          text: 'Səhvlərinizə baxın və yenidən cəhd edin.',
          wrong: game.wrong,
          actions: [
            h('button', { class: 'btn', type: 'button', onclick: retry }, 'Yenidən'),
            h('button', { class: 'btn secondary', type: 'button', onclick: route }, 'Mövzu dəyiş')
          ]
        });
      }
      if (index + 1 < questions.length) { game.index += 1; return runVocab(game); }
      leaveView();
      setChrome('vocab', 'Söz oyunu');
      showScore(questions.length - game.wrong.length, questions.length, game.wrong, retry);
    }, correct ? 600 : 1200);
  }

  show(header, h('div', { class: 'question' },
    picture
      ? h('div', { class: 'picture', role: 'img', 'aria-label': item.azerbaijani }, item.emoji)
      : h('div', { class: 'word', lang: 'en' }, item.english),
    h('h1', { class: 'vocab-ask' }, picture ? 'Bu nədir?' : 'Uyğun şəkli seçin'),
    grid,
    verdict));
}

// ── Accounts ─────────────────────────────────────────────

// Accounts are name + password; the email Supabase needs is derived from the name.
async function nameToEmail(name) {
  const data = new TextEncoder().encode(name.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return hex + '@ingilisce.app';
}

function validatePassword(password) {
  if (password.length < 8) return 'Şifrə ən az 8 simvol olmalıdır.';
  if (!/[A-Z]/.test(password)) return 'Ən az bir böyük hərf olmalıdır.';
  if (!/[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?]/.test(password)) return 'Ən az bir xüsusi simvol olmalıdır (!@#$ və s.).';
  return null;
}

const NAME_TAKEN = 'Bu ad artıq istifadə olunur. Başqa ad seçin.';

// Errors written for the learner carry `friendly`; anything else gets a generic message.
function userError(message) {
  return Object.assign(new Error(message), { friendly: true });
}

async function signUp(name, password, confirm) {
  if (!name) throw userError('Adınızı yazın.');
  const problem = validatePassword(password);
  if (problem) throw userError(problem);
  if (password !== confirm) throw userError('Şifrələr uyğun gəlmir.');

  const { data: available } = await db.rpc('is_username_available', { uname: name });
  if (!available) throw userError(NAME_TAKEN);

  // A database trigger creates the profiles row in the same transaction as the user.
  // The app no longer shows avatars, but the profile column still expects a value.
  const { data, error } = await db.auth.signUp({
    email: await nameToEmail(name), password,
    options: { data: { display_name: name, avatar: '👦' } }
  });
  if (error) {
    if (/duplicate key|already registered|already exists|database error saving new user/i.test(error.message)) {
      throw userError(NAME_TAKEN);
    }
    throw error;
  }
  return { user: data.user, profile: { display_name: name, normal_progress: [] } };
}

async function signIn(name, password) {
  if (!name) throw userError('Adınızı yazın.');
  if (!password) throw userError('Şifrəni yazın.');

  const { data, error } = await db.auth.signInWithPassword({ email: await nameToEmail(name), password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw userError('Ad və ya şifrə yanlışdır.');
    throw error;
  }
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError || !profile) throw userError('Profil tapılmadı.');
  return { user: data.user, profile };
}

function setProfile(id, profile) {
  userId = id;
  profileName = profile.display_name;
  selectedSection = null;

  const lives = loadState().lives; // keep today's lives across reloads
  const completedNodes = profile.normal_progress || [];
  localStorage.setItem(stateKey(), JSON.stringify({ completedNodes, lives }));
  syncedNodes = new Set(completedNodes);
  resetLivesDaily();

  document.getElementById('accountInitial').textContent = profileName.trim().charAt(0).toLocaleUpperCase('az');
  document.getElementById('accountName').textContent = profileName;
  document.getElementById('menuName').textContent = profileName;
}

function renderAuth() {
  setChrome(null, 'Daxil ol');
  const screen = document.getElementById('authTemplate').content.cloneNode(true);
  const forms = { signup: screen.getElementById('signupForm'), signin: screen.getElementById('signinForm') };

  screen.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    view.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-pressed', String(t === tab)));
    for (const [name, form] of Object.entries(forms)) form.hidden = name !== tab.dataset.tab;
  }));

  screen.querySelectorAll('.show-pwd').forEach(box => box.addEventListener('change', () => {
    box.form.querySelectorAll('input[id$="Password"], input[id$="Confirm"]')
      .forEach(input => { input.type = box.checked ? 'text' : 'password'; });
  }));

  const value = id => document.getElementById(id).value;
  const submit = (form, action) => form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button.btn');
    const errorBox = form.querySelector('.error-text');
    const label = button.textContent;
    errorBox.hidden = true;
    button.disabled = true;
    button.textContent = 'Gözləyin…';
    try {
      const { user, profile } = await action();
      setProfile(user.id, profile);
      go('#/');
    } catch (e) {
      console.error('auth failed:', e);
      errorBox.textContent = e.friendly ? e.message : 'Alınmadı. İnterneti yoxlayıb yenidən cəhd edin.';
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = label;
    }
  });

  submit(forms.signup, () => signUp(value('signupName').trim(), value('signupPassword'), value('signupConfirm')));
  submit(forms.signin, () => signIn(value('signinName').trim(), value('signinPassword')));

  show(screen);
}

// ── Account menu ─────────────────────────────────────────

const accountBtn = document.getElementById('accountBtn');
const accountMenu = document.getElementById('accountMenu');

function toggleAccountMenu(open) {
  accountMenu.hidden = !open;
  accountBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    const { completed, total } = progress();
    document.getElementById('menuProgress').textContent = `${completed} / ${total} mövzu keçilib`;
  }
}

accountBtn.addEventListener('click', () => toggleAccountMenu(accountMenu.hidden));
document.addEventListener('click', event => {
  if (!event.target.closest('.account')) toggleAccountMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !accountMenu.hidden) { toggleAccountMenu(false); accountBtn.focus(); }
});
document.getElementById('signOutBtn').addEventListener('click', async () => {
  await db.auth.signOut();
  userId = null;
  profileName = null;
  history.replaceState(null, '', location.pathname);
  route();
});

// A link to the screen you are already on starts it again (e.g. "Təkrar" after a result).
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#/"]');
  if (link && link.getAttribute('href') === (location.hash || '#/')) {
    event.preventDefault();
    route();
  }
});

// ── Start ────────────────────────────────────────────────

// Fail loudly on a malformed curriculum edit instead of deep inside rendering.
function validateCurriculum(curriculum) {
  if (!curriculum || !Array.isArray(curriculum.sections)) throw new Error('curriculum.json: sections array is missing');
  curriculum.sections.forEach((section, si) => {
    if (!section.id || !Array.isArray(section.nodes)) throw new Error(`curriculum.json: section[${si}] is missing id/nodes`);
    section.nodes.forEach((node, ni) => {
      if (!node.id || typeof node.title !== 'string') throw new Error(`curriculum.json: section[${si}].nodes[${ni}] is missing id/title`);
    });
  });
}

async function init() {
  try {
    const [response, rows] = await Promise.all([fetch('curriculum.json'), fetchRows('lesson_content')]);
    if (!response.ok) throw new Error(`curriculum.json: ${response.status}`);
    const base = await response.json();
    validateCurriculum(base);
    // Without lesson_content (offline, or not set up yet) the file content still works.
    course = Content.mergeCurriculum(base, rows || []);
  } catch (e) {
    console.error('course not loaded:', e);
    show(h('div', { class: 'page-message' },
      h('p', {}, 'Kurs yüklənmədi.'),
      h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Yenidən cəhd et')));
    return;
  }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) setProfile(session.user.id, profile);
    }
  } catch (e) {
    console.error('session not checked:', e);
    showToast('Qoşulma xətası, internetinizi yoxlayıb səhifəni yeniləyin.');
  }

  window.addEventListener('hashchange', route);
  route();
}

init();
