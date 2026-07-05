// ── Supabase ─────────────────────────────────────────────
// SUPABASE_URL/SUPABASE_ANON/db are defined in config.js, loaded before this file.

// ── App state ─────────────────────────────────────────────
const DEFAULT_STATE = { completedNodes: [], lives: 5 };
let currentMode    = 'normal';
let currentProfile = null;
let currentAvatar  = '👦';
let currentUserId  = null;

// ── Storage ───────────────────────────────────────────────
function storageKey() {
  return `igp_${currentMode}_${currentProfile}`;
}

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey());
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch { return { ...DEFAULT_STATE }; }
}

let syncQueue = Promise.resolve();
const syncedNodes = { normal: new Set(), sat: new Set() };

function saveState(state) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  syncQueue = syncQueue.then(syncProgress).catch(() => {});
}

// Progress is synced one completed node at a time via the append_progress
// RPC, which only allows appending to the server's array — the client can
// no longer overwrite normal_progress/sat_progress with an arbitrary value.
async function syncProgress() {
  if (!currentUserId) return;
  const mode = currentMode === 'sat' ? 'sat' : 'normal';
  const state = loadState();
  const newNodes = state.completedNodes.filter(id => !syncedNodes[mode].has(id));
  for (const nodeId of newNodes) {
    const { error } = await db.rpc('append_progress', { p_mode: mode, p_node_id: nodeId });
    if (error) {
      console.error('syncProgress failed:', error);
      showToast('Sinxronizasiya alınmadı, internetinizi yoxlayın.');
      return;
    }
    syncedNodes[mode].add(nodeId);
  }
}

// ── Auth helpers ──────────────────────────────────────────
async function nameToEmail(name) {
  const data = new TextEncoder().encode(name.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return hex + '@ingilisce.app';
}

function validatePassword(pwd) {
  if (pwd.length < 8)               return 'Şifrə ən az 8 simvol olmalıdır.';
  if (!/[A-Z]/.test(pwd))           return 'Ən az bir böyük hərf olmalıdır.';
  if (!/[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?]/.test(pwd))
                                     return 'Ən az bir xüsusi simvol olmalıdır (!@#$ və s.).';
  return null;
}

function getStreak() {
  try {
    const saved = localStorage.getItem(`igp_streak_${currentProfile}`);
    return saved ? JSON.parse(saved) : { count: 0, lastDate: null };
  } catch { return { count: 0, lastDate: null }; }
}

function recordStudyDay() {
  const today    = new Date().toDateString();
  const streak   = getStreak();
  if (streak.lastDate === today) return;
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  streak.count  = streak.lastDate === yesterday ? streak.count + 1 : 1;
  streak.lastDate = today;
  localStorage.setItem(`igp_streak_${currentProfile}`, JSON.stringify(streak));
  updateDropdownStats();
  updateStreakDisplay();
}

function updateStreakDisplay() {
  const streak = getStreak();
  const el = document.getElementById('streakDisplay');
  if (el) el.textContent = `🔥 ${streak.count}`;
}

function checkDailyLivesReset() {
  const today = new Date().toDateString();
  const key   = `igp_lives_date_${currentProfile}`;
  if (localStorage.getItem(key) !== today) {
    const state = loadState();
    state.lives = 5;
    saveState(state);
    localStorage.setItem(key, today);
  }
}

function setActiveProfile(userId, profile) {
  currentUserId  = userId;
  currentProfile = profile.display_name;
  currentAvatar  = profile.avatar;

  // Cache Supabase progress locally
  const nKey = `igp_normal_${profile.display_name}`;
  const sKey = `igp_sat_${profile.display_name}`;
  localStorage.setItem(nKey, JSON.stringify({ ...DEFAULT_STATE, completedNodes: profile.normal_progress || [] }));
  localStorage.setItem(sKey, JSON.stringify({ ...DEFAULT_STATE, completedNodes: profile.sat_progress  || [] }));
  syncedNodes.normal = new Set(profile.normal_progress || []);
  syncedNodes.sat    = new Set(profile.sat_progress  || []);

  checkDailyLivesReset();

  document.getElementById('profileName').textContent = profile.avatar + ' ' + profile.display_name;
  document.getElementById('dropdownAvatar').textContent = profile.avatar;
  document.getElementById('dropdownName').textContent   = profile.display_name;
  updateDropdownStats();
  updateStreakDisplay();
}

function updateDropdownStats() {
  if (!currentProfile) return;
  const curriculum = currentMode === 'sat' ? window._satCurriculum : window._normalCurriculum;
  const total = curriculum ? getAllNodeIds(curriculum).filter(id => {
    const node = findNode(id, curriculum);
    return node && node.type !== 'header';
  }).length : 0;
  const state = loadState();
  const completed = state.completedNodes.length;
  const lives     = state.lives;

  const streak = getStreak();

  document.getElementById('dropdownCompleted').textContent = completed;
  document.getElementById('dropdownTotal').textContent     = total;
  document.getElementById('dropdownLives').textContent     = `❤️ ${lives} / 5`;
  document.getElementById('dropdownStreak').textContent    = `🔥 ${streak.count}`;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('dropdownProgressFill').style.width = pct + '%';
}

async function doSignUp(name, avatar, password, confirm) {
  if (!name.trim())              throw new Error('Ad daxil edin.');
  const pwdErr = validatePassword(password);
  if (pwdErr)                    throw new Error(pwdErr);
  if (password !== confirm)      throw new Error('Şifrələr uyğun gəlmir.');

  const { data: available } = await db.rpc('is_username_available', { uname: name });
  if (!available)                throw new Error('Bu ad artıq istifadə olunur. Başqa ad seçin.');

  // The profiles row is created by a DB trigger on auth.users in the same
  // transaction as the auth user, so a duplicate name (or any other failure)
  // rolls back the whole signup instead of leaving an orphaned auth user.
  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { display_name: name, avatar } }
  });
  if (error) {
    if (/duplicate key|already registered|already exists|database error saving new user/i.test(error.message)) {
      throw new Error('Bu ad artıq istifadə olunur. Başqa ad seçin.');
    }
    throw new Error(error.message);
  }

  return { user: data.user, profile: { display_name: name, avatar, normal_progress: [], sat_progress: [] } };
}

async function doSignIn(name, password) {
  if (!name.trim())  throw new Error('Ad daxil edin.');
  if (!password)     throw new Error('Şifrə daxil edin.');

  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error)         throw new Error(error.message);

  const { data: profile, error: profErr } = await db.from('profiles').select('*').eq('id', data.user.id).single();
  if (profErr || !profile) throw new Error('Profil tapılmadı.');

  return { user: data.user, profile };
}

// ── Curriculum helpers ─────────────────────────────────

function getAllNodeIds(curriculum) {
  return curriculum.sections.flatMap(s => s.nodes.map(n => n.id));
}

// findNode is called once per node on every stats/render pass, so a linear
// section/node scan per call turns an O(n) pass into O(n²). Cache a flat
// id → node map per curriculum object instead.
const nodeIndexCache = new WeakMap();

function getNodeIndex(curriculum) {
  let index = nodeIndexCache.get(curriculum);
  if (!index) {
    index = new Map();
    curriculum.sections.forEach(s => s.nodes.forEach(n => index.set(n.id, n)));
    nodeIndexCache.set(curriculum, index);
  }
  return index;
}

function findNode(nodeId, curriculum) {
  return getNodeIndex(curriculum).get(nodeId) || null;
}

// ── Modal helpers ──────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showToast(msg) {
  const existing = document.querySelector('.ig-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'ig-toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function renderLives(containerId, lives) {
  document.getElementById(containerId).innerHTML =
    Array.from({ length: 5 }, (_, i) => i < lives ? '❤️' : '🤍').join('');
}

// ── Path rendering ─────────────────────────────────────

function getNextNodeId(curriculum) {
  const state      = loadState();
  const allNodeIds = getAllNodeIds(curriculum);
  const completed  = new Set(state.completedNodes);
  return allNodeIds.find(id => !completed.has(id));
}

function resumeProgress(curriculum) {
  const nextId = getNextNodeId(curriculum);
  if (!nextId) return;

  const collapseKey = `igp_collapsed_${curriculum.sections.find(s => s.nodes.some(n => n.id === nextId))?.id}`;
  if (localStorage.getItem(collapseKey) === '1') {
    localStorage.setItem(collapseKey, '0');
    renderPath(curriculum);
  }

  setTimeout(() => {
    const el = document.querySelector(`[data-node-id="${nextId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function renderPath(curriculum) {
  const state = loadState();
  const allNodeIds = getAllNodeIds(curriculum);
  const completed = new Set(state.completedNodes);
  const firstIncompleteId = allNodeIds.find(id => !completed.has(id));
  const container = document.getElementById('pathContainer');
  container.innerHTML = '';

  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) {
    // firstIncompleteId above already is the "next node", so reuse it
    // instead of re-reading localStorage and rescanning all node ids again.
    resumeBtn.classList.toggle('hidden', !firstIncompleteId);
    resumeBtn.onclick = () => resumeProgress(curriculum);
  }

  curriculum.sections.forEach((section, si) => {
    const block = document.createElement('div');
    block.className = 'section-block';

    const collapseKey = `igp_collapsed_${section.id}`;
    const isCollapsed = localStorage.getItem(collapseKey) === '1';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title collapsible';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = section.title;
    const chevron = document.createElement('span');
    chevron.className = 'section-chevron';
    chevron.textContent = isCollapsed ? '▶' : '▼';
    titleEl.append(titleSpan, chevron);
    block.appendChild(titleEl);

    const nodesContainer = document.createElement('div');
    nodesContainer.className = 'nodes-container' + (isCollapsed ? ' collapsed' : '');
    block.appendChild(nodesContainer);

    titleEl.addEventListener('click', () => {
      const collapsed = nodesContainer.classList.toggle('collapsed');
      titleEl.querySelector('.section-chevron').textContent = collapsed ? '▶' : '▼';
      localStorage.setItem(collapseKey, collapsed ? '1' : '0');
    });

    section.nodes.forEach((node, ni) => {
      const status = completed.has(node.id) ? 'completed'
        : node.id === firstIncompleteId ? 'active' : 'locked';

      if (ni > 0) {
        const line = document.createElement('div');
        line.className = 'path-line' + (status === 'completed' ? ' done' : '');
        nodesContainer.appendChild(line);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'node-wrapper';

      const nodeEl = document.createElement('div');
      nodeEl.className = `node ${status}`;
      nodeEl.dataset.nodeId = node.id;
      nodeEl.textContent = status === 'locked' ? '🔒' : status === 'completed' ? '✅' : '📖';
      nodeEl.addEventListener('click', () => handleNodeClick(node.id, status, curriculum));

      const label = document.createElement('div');
      label.className = 'node-label';
      label.textContent = node.title;

      wrapper.appendChild(nodeEl);
      wrapper.appendChild(label);
      nodesContainer.appendChild(wrapper);
    });

    container.appendChild(block);
  });
}

// ── Node click ─────────────────────────────────────────

function handleNodeClick(nodeId, status, curriculum) {
  if (status === 'locked') return;
  openLesson(nodeId, curriculum, status === 'completed');
}

// ── Lesson modal ───────────────────────────────────────

function openLesson(nodeId, curriculum, isReview) {
  const node = findNode(nodeId, curriculum);
  const state = loadState();

  document.getElementById('lessonTitle').textContent = node.title;
  const lessonBody = document.getElementById('lessonBody');
  lessonBody.innerHTML = '';
  const lessonText = document.createElement('p');
  lessonText.className = 'lesson-text';
  lessonText.textContent = node.lesson;
  lessonBody.appendChild(lessonText);
  if (node.audio) {
    const audio = new Audio(node.audio);
    const player = document.createElement('div');
    player.className = 'custom-audio-player';
    player.innerHTML = `
      <button class="cap-play-btn" id="capPlay">&#9654;</button>
      <div class="cap-bar">
        <div class="cap-progress" id="capProgress"></div>
      </div>
      <span class="cap-time" id="capTime">0:00</span>
    `;
    lessonBody.appendChild(player);

    const playBtn  = player.querySelector('#capPlay');
    const progress = player.querySelector('#capProgress');
    const timeEl   = player.querySelector('#capTime');

    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playBtn.innerHTML = '&#10074;&#10074;'; playBtn.style.paddingLeft = '0'; }
      else              { audio.pause(); playBtn.innerHTML = '&#9654;'; playBtn.style.paddingLeft = '3px'; }
    });
    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      progress.style.width = pct + '%';
      const m = Math.floor(audio.currentTime / 60);
      const s = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
      timeEl.textContent = `${m}:${s}`;
    });
    audio.addEventListener('ended', () => { playBtn.innerHTML = '&#9654;'; playBtn.style.paddingLeft = '3px'; });
    player.querySelector('.cap-bar').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

    // stop audio when lesson closes
    document.getElementById('lessonClose').addEventListener('click', () => audio.pause(), { once: true });
  }
  document.getElementById('lessonLives').innerHTML = '';

  const footer = document.getElementById('lessonFooter');
  if (isReview) {
    footer.innerHTML = '';
  } else {
    if (node.questions && node.questions.length > 0) {
      footer.innerHTML = '<button class="btn-primary" id="lessonDone">Bitirdim →</button>';
      document.getElementById('lessonDone').addEventListener('click', () => {
        closeModal('lessonOverlay');
        startQuiz(nodeId, curriculum);
      });
    } else {
      footer.innerHTML = '<button class="btn-primary" id="lessonDone">Bitirdim →</button>';
      document.getElementById('lessonDone').addEventListener('click', () => {
        closeModal('lessonOverlay');
        completeNode(nodeId, curriculum);
      });
    }
  }

  document.getElementById('lessonClose').onclick = () => closeModal('lessonOverlay');
  openModal('lessonOverlay');
}

// ── Review Quiz ────────────────────────────────────────

let reviewSession = null;
let vocabSession = null;

let reviewAllQuestions = [];
let selectedReviewCategory = null;

async function startReviewQuiz() {
  const { data, error } = await db.from('review_questions').select('*');
  if (error || !data || data.length === 0) {
    showToast('Suallar tapılmadı. Admin suallar əlavə etməlidir.');
    return;
  }
  reviewAllQuestions = data;

  const cats = [...new Set(data.map(q => q.category).filter(Boolean))].sort();
  selectedReviewCategory = null;

  const chips = document.getElementById('reviewCategoryChips');
  chips.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.className = 'vocab-chip active';
  allChip.textContent = 'Hamısı';
  allChip.onclick = () => { selectedReviewCategory = null; chips.querySelectorAll('.vocab-chip').forEach(c => c.classList.remove('active')); allChip.classList.add('active'); };
  chips.appendChild(allChip);

  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'vocab-chip';
    chip.textContent = cat;
    chip.onclick = () => { selectedReviewCategory = cat; chips.querySelectorAll('.vocab-chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); };
    chips.appendChild(chip);
  });

  openModal('reviewCategoryOverlay');
}

function launchReviewSession() {
  const pool = selectedReviewCategory
    ? reviewAllQuestions.filter(q => q.category === selectedReviewCategory)
    : reviewAllQuestions;

  if (pool.length === 0) {
    showToast('Bu kateqoriyada sual yoxdur.');
    return;
  }

  const questions = shuffle(pool).slice(0, 25).map(q => ({
    question: q.question,
    options: shuffle([q.option_a, q.option_b, q.option_c, q.option_d, ...(q.option_e ? [q.option_e] : [])]),
    answer: q[`option_${q.correct}`]
  }));

  reviewSession = { questions, currentIndex: 0, correct: 0, wrong: [], selectedAnswer: null };
  closeModal('reviewCategoryOverlay');
  document.getElementById('reviewClose').onclick = () => closeModal('reviewOverlay');
  openModal('reviewOverlay');
  renderReviewQuestion();
}

function renderReviewQuestion() {
  const { questions, currentIndex } = reviewSession;
  const question = questions[currentIndex];

  document.getElementById('reviewProgress').textContent = `Sual ${currentIndex + 1} / ${questions.length}`;

  const body = document.getElementById('reviewBody');
  body.innerHTML = '';
  reviewSession.selectedAnswer = null;

  const checkBtn = document.getElementById('reviewCheck');
  checkBtn.disabled = true;
  checkBtn.onclick = checkReviewAnswer;

  const qEl = document.createElement('p');
  qEl.className = 'quiz-question';
  qEl.textContent = question.question;
  body.appendChild(qEl);

  const container = document.createElement('div');
  container.className = 'quiz-options';
  question.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      reviewSession.selectedAnswer = opt;
      checkBtn.disabled = false;
    });
    container.appendChild(btn);
  });
  body.appendChild(container);
}

function checkReviewAnswer() {
  const { questions, currentIndex, selectedAnswer } = reviewSession;
  const question = questions[currentIndex];
  const isCorrect = normalizeAnswer(selectedAnswer) === normalizeAnswer(question.answer);

  document.querySelectorAll('#reviewBody .quiz-option').forEach(btn => {
    btn.disabled = true;
    if (normalizeAnswer(btn.dataset.value) === normalizeAnswer(question.answer)) btn.classList.add('correct');
    else if (btn.classList.contains('selected') && !isCorrect) btn.classList.add('wrong');
  });
  document.getElementById('reviewCheck').disabled = true;

  if (isCorrect) reviewSession.correct++;
  else reviewSession.wrong.push({ question: question.question, answer: question.answer });

  setTimeout(() => {
    const next = currentIndex + 1;
    if (next >= questions.length) showReviewResult();
    else { reviewSession.currentIndex = next; renderReviewQuestion(); }
  }, 1000);
}

function showReviewResult() {
  closeModal('reviewOverlay');
  const { correct, questions, wrong } = reviewSession;
  const total = questions.length;
  const pct = Math.round((correct / total) * 100);

  document.getElementById('reviewResultIcon').textContent = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
  document.getElementById('reviewResultTitle').textContent = pct >= 80 ? 'Əla nəticə!' : pct >= 50 ? 'Yaxşı cəhd!' : 'Daha çox oxu!';
  document.getElementById('reviewResultText').textContent = `${correct} / ${total} düzgün · ${pct}%`;

  const wrongList = document.getElementById('reviewWrongList');
  wrongList.innerHTML = '';
  if (wrong.length > 0) {
    const heading = document.createElement('p');
    heading.className = 'review-wrong-heading';
    heading.textContent = 'Səhv cavablar:';
    wrongList.appendChild(heading);
    wrong.forEach(w => {
      const item = document.createElement('div');
      item.className = 'review-wrong-item';

      const q = document.createElement('span');
      q.className = 'review-wrong-q';
      q.textContent = w.question;

      const a = document.createElement('span');
      a.className = 'review-wrong-a';
      a.textContent = '✓ ' + w.answer;

      item.appendChild(q);
      item.appendChild(a);
      wrongList.appendChild(item);
    });
  }

  document.getElementById('reviewResultClose').onclick = () => closeModal('reviewResultOverlay');
  openModal('reviewResultOverlay');
}

// ── Vocab Game ─────────────────────────────────────────
async function startVocabGame(preselect, btn) {
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const { data, error } = await db.from('vocab_items').select('category');
    if (error || !data || data.length === 0) {
      showToast('Söz tapılmadı. Əvvəlcə admin panelindən söz əlavə edin.');
      return;
    }

    const categories = ['Hamısı', ...new Set(data.map(v => v.category).sort())];
    const chips = document.getElementById('vocabCategoryChips');
    chips.innerHTML = '';
    let selectedCategory = preselect || 'Hamısı';

    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'vocab-chip' + (cat === selectedCategory ? ' selected' : '');
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        chips.querySelectorAll('.vocab-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedCategory = cat;
      });
      chips.appendChild(chip);
    });

    document.getElementById('vocabStartBtn').onclick = () => {
      closeModal('vocabCategoryOverlay');
      launchVocabSession(selectedCategory);
    };

    openModal('vocabCategoryOverlay');
  } finally {
    if (btn) { btn.textContent = '🃏 Söz'; btn.disabled = false; }
  }
}

async function launchVocabSession(category) {
  const { data: fullPool, error } = await db.from('vocab_items').select('*');
  const allItems = category === 'Hamısı'
    ? fullPool
    : (fullPool || []).filter(v => v.category === category);

  if (error || !allItems || allItems.length === 0) {
    showToast('Bu kateqoriyada söz tapılmadı.');
    return;
  }

  const pool = shuffle(allItems).slice(0, 20);

  // Assign modes: first 12 Mode A (emoji→word), last 8 Mode B (word→emoji), then shuffle
  const questions = shuffle(pool.map((item, i) => {
    const isA = i < 12;  // 12 Mode A, 8 Mode B before shuffle
    // Build 3 distractors from category pool first, fall back to full pool
    const categoryPool = allItems.filter(v => v.id !== item.id);
    const fallbackPool = (fullPool || allItems).filter(v => v.id !== item.id);
    let distPool = categoryPool.length >= 3 ? categoryPool : fallbackPool;
    const distractors = shuffle(distPool).slice(0, 3);
    // options array: 4 items (correct + 3 distractors), shuffled
    const options = shuffle([item, ...distractors]);
    return { item, mode: isA ? 'A' : 'B', options };
  }));

  vocabSession = {
    questions,
    current: 0,
    lives: 5,
    wrong: [],
    category
  };

  const prevCategory = category;
  document.getElementById('vocabFailRetry').onclick = () => {
    closeModal('vocabFailOverlay');
    startVocabGame(prevCategory);
  };
  document.getElementById('vocabFailClose').onclick = () => closeModal('vocabFailOverlay');
  document.getElementById('vocabResultRetry').onclick = () => {
    closeModal('vocabResultOverlay');
    startVocabGame(prevCategory);
  };
  document.getElementById('vocabResultClose').onclick = () => closeModal('vocabResultOverlay');

  openModal('vocabOverlay');
  renderVocabQuestion();
}

function renderVocabQuestion() {
  const { questions, current, lives } = vocabSession;
  const { item, mode, options } = questions[current];

  document.getElementById('vocabProgress').textContent = `${current + 1} / ${questions.length}`;
  renderLives('vocabLives', lives);

  const body = document.getElementById('vocabBody');
  body.innerHTML = '';

  if (mode === 'A') {
    // Show emoji → pick English word
    const emojiEl = document.createElement('div');
    emojiEl.className = 'vocab-emoji-display';
    emojiEl.textContent = item.emoji;
    body.appendChild(emojiEl);

    const prompt = document.createElement('p');
    prompt.className = 'vocab-prompt';
    prompt.textContent = 'Bu nədir?';
    body.appendChild(prompt);

    const optContainer = document.createElement('div');
    optContainer.className = 'vocab-options';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vocab-option';
      btn.textContent = opt.english;
      btn.addEventListener('click', () => checkVocabAnswer(btn, opt.id, optContainer));
      optContainer.appendChild(btn);
    });
    body.appendChild(optContainer);

  } else {
    // Mode B: Show English word → pick emoji
    const wordEl = document.createElement('div');
    wordEl.className = 'vocab-word-display';
    wordEl.textContent = item.english;
    body.appendChild(wordEl);

    const prompt = document.createElement('p');
    prompt.className = 'vocab-prompt';
    prompt.textContent = 'Emojiini tap!';
    body.appendChild(prompt);

    const optContainer = document.createElement('div');
    optContainer.className = 'vocab-options-grid';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vocab-option-emoji';
      btn.textContent = opt.emoji;
      btn.addEventListener('click', () => checkVocabAnswer(btn, opt.id, optContainer));
      optContainer.appendChild(btn);
    });
    body.appendChild(optContainer);
  }
}

function checkVocabAnswer(btn, selectedId, container) {
  const { questions, current } = vocabSession;
  const { item, mode } = questions[current];
  const isCorrect = selectedId === item.id;

  // Disable all buttons
  const btnClass = mode === 'A' ? '.vocab-option' : '.vocab-option-emoji';
  container.querySelectorAll(btnClass).forEach(b => b.disabled = true);

  // Visual feedback: mark correct button green, selected wrong button red
  container.querySelectorAll(btnClass).forEach((b, i) => {
    if (vocabSession.questions[current].options[i].id === item.id) {
      b.classList.add('correct');
    } else if (b === btn && !isCorrect) {
      b.classList.add('wrong');
    }
  });

  if (!isCorrect) {
    vocabSession.lives -= 1;
    renderLives('vocabLives', vocabSession.lives);
    vocabSession.wrong.push({ item });
  }

  const delay = isCorrect ? 600 : 900;

  setTimeout(() => {
    if (!isCorrect && vocabSession.lives <= 0) {
      closeModal('vocabOverlay');
      openModal('vocabFailOverlay');
      return;
    }
    const next = current + 1;
    if (next >= vocabSession.questions.length) {
      closeModal('vocabOverlay');
      showVocabResult();
    } else {
      vocabSession.current = next;
      renderVocabQuestion();
    }
  }, delay);
}

function showVocabResult() {
  const { questions, wrong } = vocabSession;
  const correct = questions.length - wrong.length;
  const total   = questions.length;
  const pct     = Math.round((correct / total) * 100);

  document.getElementById('vocabResultIcon').textContent  = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
  document.getElementById('vocabResultTitle').textContent = pct >= 80 ? 'Əla nəticə!' : pct >= 50 ? 'Yaxşı cəhd!' : 'Daha çox məşq et!';
  document.getElementById('vocabResultText').textContent  = `${correct} / ${total} düzgün · ${pct}%`;

  const wrongList = document.getElementById('vocabWrongList');
  wrongList.innerHTML = '';
  if (wrong.length > 0) {
    const heading = document.createElement('p');
    heading.className = 'review-wrong-heading';
    heading.textContent = 'Səhvlər:';
    wrongList.appendChild(heading);
    wrong.forEach(({ item }) => {
      const el = document.createElement('div');
      el.className = 'vocab-wrong-item';

      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'vocab-wrong-emoji';
      emojiSpan.textContent = item.emoji;

      const enSpan = document.createElement('span');
      enSpan.className = 'vocab-wrong-en';
      enSpan.textContent = item.english;

      const azSpan = document.createElement('span');
      azSpan.className = 'vocab-wrong-az';
      azSpan.textContent = item.azerbaijani;

      el.appendChild(emojiSpan);
      el.appendChild(enSpan);
      el.appendChild(azSpan);
      wrongList.appendChild(el);
    });
  }

  openModal('vocabResultOverlay');
}

// ── Quiz engine ────────────────────────────────────────

let quizSession = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startQuiz(nodeId, curriculum) {
  const node = findNode(nodeId, curriculum);
  quizSession = {
    nodeId,
    curriculum,
    questions: shuffle(node.questions),
    currentIndex: 0,
    selectedAnswer: null
  };
  document.getElementById('quizClose').onclick = () => closeModal('quizOverlay');
  openModal('quizOverlay');
  renderQuestion();
}

function renderQuestion() {
  const { questions, currentIndex } = quizSession;
  const question = questions[currentIndex];
  const state = loadState();

  document.getElementById('quizProgress').textContent =
    `Sual ${currentIndex + 1}/${questions.length}`;
  renderLives('quizLives', state.lives);

  const body = document.getElementById('quizBody');
  body.innerHTML = '';
  quizSession.selectedAnswer = null;

  const checkBtn = document.getElementById('quizCheck');
  checkBtn.disabled = true;
  checkBtn.onclick = checkAnswer;

  const qEl = document.createElement('p');
  qEl.className = 'quiz-question';
  qEl.textContent = question.question;
  body.appendChild(qEl);

  if (question.type === 'multiple_choice') {
    renderMCOptions(question, body);
  } else if (question.type === 'true_false') {
    renderTFOptions(body);
  } else if (question.type === 'fill_blank') {
    renderFillBlank(body, checkBtn);
  }

  if (question.type !== 'true_false') {
    const hintBtn = document.createElement('button');
    hintBtn.className = 'hint-btn';
    hintBtn.textContent = '💡 İpucu';
    hintBtn.addEventListener('click', () => {
      hintBtn.disabled = true;
      hintBtn.style.opacity = '0.4';
      applyAutoHint(question, body);
    });
    body.appendChild(hintBtn);
  }
}

function applyAutoHint(question, body) {
  if (question.type === 'multiple_choice') {
    const wrongBtns = [...body.querySelectorAll('.quiz-option')]
      .filter(btn => normalizeAnswer(btn.dataset.value) !== normalizeAnswer(question.answer) && !btn.disabled);
    if (wrongBtns.length === 0) return;
    const target = wrongBtns[Math.floor(Math.random() * wrongBtns.length)];
    target.disabled = true;
    target.style.opacity = '0.3';
    target.style.textDecoration = 'line-through';
  } else if (question.type === 'fill_blank') {
    const answer = String(question.answer);
    const revealed = answer[0].toUpperCase() + ' ' + '_'.repeat(Math.max(0, answer.length - 1)).split('').join(' ');
    const hintEl = document.createElement('div');
    hintEl.className = 'hint-text';
    hintEl.textContent = 'İlk hərf: ' + revealed;
    body.appendChild(hintEl);
  }
}

function renderMCOptions(question, body) {
  const container = document.createElement('div');
  container.className = 'quiz-options';
  question.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.addEventListener('click', () => selectOption(btn, opt, container));
    container.appendChild(btn);
  });
  body.appendChild(container);
}

function renderTFOptions(body) {
  const container = document.createElement('div');
  container.className = 'quiz-options';
  [{ label: 'Doğrudur ✓', value: 'true' }, { label: 'Yanlışdır ✗', value: 'false' }].forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.addEventListener('click', () => selectOption(btn, value, container));
    container.appendChild(btn);
  });
  body.appendChild(container);
}

function renderFillBlank(body, checkBtn) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'fill-blank-input';
  input.placeholder = 'Cavabınızı yazın...';
  input.addEventListener('input', () => {
    quizSession.selectedAnswer = input.value.trim();
    checkBtn.disabled = input.value.trim() === '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !checkBtn.disabled) checkAnswer();
  });
  body.appendChild(input);
  setTimeout(() => input.focus(), 50);
}

function selectOption(btn, value, container) {
  container.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  quizSession.selectedAnswer = value;
  document.getElementById('quizCheck').disabled = false;
}

// ── Answer checking ────────────────────────────────────

function normalizeAnswer(val) {
  return String(val).trim().toLowerCase();
}

function checkAnswer() {
  const { questions, currentIndex, selectedAnswer, nodeId, curriculum } = quizSession;
  const question = questions[currentIndex];
  const correctVal = String(question.answer);
  const isCorrect = normalizeAnswer(selectedAnswer) === normalizeAnswer(correctVal);

  disableQuizInputs();
  showVisualFeedback(question, isCorrect);
  showFeedbackToast(isCorrect, question);

  const state = loadState();
  if (!isCorrect) {
    state.lives -= 1;
    saveState(state);
    renderLives('quizLives', state.lives);
  }

  setTimeout(() => {
    if (!isCorrect && state.lives <= 0) {
      state.lives = 5;
      saveState(state);
      closeModal('quizOverlay');
      openModal('failOverlay');
      document.getElementById('failClose').onclick = () => {
        closeModal('failOverlay');
        openLesson(nodeId, curriculum, false);
      };
      renderPath(curriculum);
    } else {
      const next = currentIndex + 1;
      if (next >= questions.length) {
        completeNode(nodeId, curriculum);
      } else {
        quizSession.currentIndex = next;
        renderQuestion();
      }
    }
  }, 1200);
}

function disableQuizInputs() {
  document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
  const input = document.querySelector('.fill-blank-input');
  if (input) input.disabled = true;
  document.getElementById('quizCheck').disabled = true;
}

function showVisualFeedback(question, isCorrect) {
  if (question.type === 'multiple_choice') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      if (normalizeAnswer(btn.dataset.value) === normalizeAnswer(question.answer)) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected') && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  } else if (question.type === 'true_false') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      if (btn.dataset.value === String(question.answer)) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected') && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  } else {
    const input = document.querySelector('.fill-blank-input');
    if (input) {
      input.classList.add(isCorrect ? 'correct' : 'wrong');
      if (!isCorrect) {
        const hint = document.createElement('div');
        hint.className = 'correct-answer-hint';
        hint.textContent = `Düzgün cavab: ${question.answer}`;
        input.parentNode.insertBefore(hint, input.nextSibling);
      }
    }
  }
}

function showFeedbackToast(isCorrect, question) {
  const existing = document.querySelector('.feedback');
  if (existing) existing.remove();
  const fb = document.createElement('div');
  fb.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  fb.setAttribute('role', 'status');
  fb.setAttribute('aria-live', 'polite');
  if (isCorrect) {
    fb.textContent = '✓ Düzgün!';
  } else if (question.type === 'multiple_choice' || question.type === 'true_false') {
    fb.textContent = `✗ Düzgün cavab: ${question.answer}`;
  } else {
    fb.textContent = '✗ Yanlış!';
  }
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 2000);
}

// ── Node completion ────────────────────────────────────

function completeNode(nodeId, curriculum) {
  const state = loadState();
  if (!state.completedNodes.includes(nodeId)) {
    state.completedNodes.push(nodeId);
  }
  state.lives = 5;
  saveState(state);
  recordStudyDay();
  updateDropdownStats();
  closeModal('quizOverlay');

  const allNodeIds = getAllNodeIds(curriculum);
  const hasNext = allNodeIds.indexOf(nodeId) < allNodeIds.length - 1;

  document.getElementById('celebrationTitle').textContent = 'Əla!';
  document.getElementById('celebrationText').textContent = hasNext
    ? 'Mövzu tamamlandı! Növbəti dərs açıldı.'
    : 'Bütün dərslər tamamlandı! 🎓';

  openModal('celebrationOverlay');
  document.getElementById('celebrationClose').onclick = () => {
    closeModal('celebrationOverlay');
    renderPath(curriculum);
  };
  renderPath(curriculum);
}

// ── Auth modal ────────────────────────────────────────────

function showAuthModal() {
  // Reset forms
  ['signupName','signupPassword','signupConfirm','signinName','signinPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showAuthError('signup', '');
  showAuthError('signin', '');

  // Avatar picker
  const avatarBtns = document.querySelectorAll('.avatar-option');
  let selectedAvatar = '👦';
  avatarBtns.forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.avatar === selectedAvatar);
    btn.onclick = () => {
      selectedAvatar = btn.dataset.avatar;
      avatarBtns.forEach(b => b.classList.toggle('selected', b === btn));
    };
  });

  // Password show/hide toggles
  document.querySelectorAll('.profile-pwd-toggle').forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
      btn.setAttribute('aria-label', show ? 'Şifrəni gizlət' : 'Şifrəni göstər');
    };
  });

  // Tab switching
  document.getElementById('tabSignup').onclick = () => switchTab('signup');
  document.getElementById('tabSignin').onclick = () => switchTab('signin');

  // Sign up
  document.getElementById('btnSignup').onclick = async () => {
    const name    = document.getElementById('signupName').value.trim();
    const pwd     = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    setAuthLoading('btnSignup', true);
    try {
      const { user, profile } = await doSignUp(name, selectedAvatar, pwd, confirm);
      setActiveProfile(user.id, profile);
      document.getElementById('profileOverlay').classList.add('hidden');
      renderPath(window._normalCurriculum);
    } catch (e) {
      showAuthError('signup', e.message);
    } finally { setAuthLoading('btnSignup', false); }
  };

  // Sign in
  document.getElementById('btnSignin').onclick = async () => {
    const name = document.getElementById('signinName').value.trim();
    const pwd  = document.getElementById('signinPassword').value;
    setAuthLoading('btnSignin', true);
    try {
      const { user, profile } = await doSignIn(name, pwd);
      setActiveProfile(user.id, profile);
      document.getElementById('profileOverlay').classList.add('hidden');
      renderPath(currentMode === 'sat' ? window._satCurriculum : window._normalCurriculum);
    } catch (e) {
      showAuthError('signin', e.message);
    } finally { setAuthLoading('btnSignin', false); }
  };

  // Enter key on sign-in password
  document.getElementById('signinPassword').onkeydown = e => {
    if (e.key === 'Enter') document.getElementById('btnSignin').click();
  };

  document.getElementById('profileOverlay').classList.remove('hidden');
}

function switchTab(tab) {
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('tabSignin').classList.toggle('active', tab === 'signin');
  document.getElementById('formSignup').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('formSignin').classList.toggle('hidden', tab !== 'signin');
}

function showAuthError(form, msg) {
  if (msg) console.error(`auth error (${form}):`, msg);
  const el = document.getElementById(form + 'Error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Gözləyin...' : (btnId === 'btnSignup' ? 'Hesab yarat' : 'Daxil ol');
}

// ── Init ──────────────────────────────────────────────────

// Minimal shape check so a malformed curriculum edit (missing nodes, wrong
// key name) fails loudly here instead of throwing a confusing TypeError deep
// inside renderPath later.
function validateCurriculumShape(curriculum, label) {
  if (!curriculum || !Array.isArray(curriculum.sections)) {
    throw new Error(`${label}: sections array is missing`);
  }
  curriculum.sections.forEach((section, si) => {
    if (!section.id || !Array.isArray(section.nodes)) {
      throw new Error(`${label}: section[${si}] is missing id/nodes`);
    }
    section.nodes.forEach((node, ni) => {
      if (!node.id || typeof node.title !== 'string') {
        throw new Error(`${label}: section[${si}].nodes[${ni}] is missing id/title`);
      }
    });
  });
}

async function init() {
  try {
    const [normalRes, satRes] = await Promise.all([
      fetch('curriculum.json'),
      fetch('sat_curriculum.json')
    ]);
    if (!normalRes.ok || !satRes.ok) throw new Error('curriculum fetch not ok');
    const normalCurriculum = await normalRes.json();
    const satCurriculum    = await satRes.json();
    validateCurriculumShape(normalCurriculum, 'curriculum.json');
    validateCurriculumShape(satCurriculum, 'sat_curriculum.json');
    window._normalCurriculum = normalCurriculum;
    window._satCurriculum    = satCurriculum;
  } catch (e) {
    console.error('Kurikulum yüklənmədi:', e);
    showToast('Kurikulum yüklənmədi, səhifəni yeniləyin.');
    return;
  }

  // Check existing Supabase session
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        setActiveProfile(session.user.id, profile);
        renderPath(window._normalCurriculum);
      } else {
        showAuthModal();
      }
    } else {
      showAuthModal();
    }
  } catch (e) {
    console.error('Sessiya yoxlanılmadı:', e);
    showToast('Qoşulma xətası, internetinizi yoxlayıb səhifəni yeniləyin.');
    showAuthModal();
  }

  // Profile button → toggle dropdown
  document.getElementById('profileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentProfile) return;
    document.getElementById('profileDropdown').classList.toggle('hidden');
    updateDropdownStats();
  });

  // İmtahan dropdown
  document.getElementById('imtahanBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('imtahanMenu').classList.toggle('hidden');
    document.getElementById('profileDropdown').classList.add('hidden');
  });
  document.getElementById('imtahanMenu').addEventListener('click', () => {
    document.getElementById('imtahanMenu').classList.add('hidden');
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.add('hidden');
    document.getElementById('imtahanMenu').classList.add('hidden');
  });

  document.getElementById('profileDropdown').addEventListener('click', (e) => e.stopPropagation());

  // İmtahan menu actions
  const vocabMenuBtn = document.getElementById('vocabMenuBtn');
  vocabMenuBtn.addEventListener('click', () => startVocabGame(null, vocabMenuBtn));
  document.getElementById('reviewMenuBtn').addEventListener('click', () => startReviewQuiz());
  document.getElementById('reviewStartBtn').addEventListener('click', () => launchReviewSession());
  // vocabStartBtn's click handler is (re)assigned in startVocabGame() each time
  // the category picker opens, since it needs the currently-selected category.

  // Generic modal-close buttons (data-close holds the overlay id)
  document.querySelectorAll('.modal-close[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Sign out button
  document.getElementById('btnSignOut').addEventListener('click', async () => {
    document.getElementById('profileDropdown').classList.add('hidden');
    await db.auth.signOut();
    currentUserId = null; currentProfile = null; currentAvatar = '👦';
    document.getElementById('profileName').textContent = '';
    document.getElementById('dropdownAvatar').textContent = '';
    document.getElementById('dropdownName').textContent = '';
    showAuthModal();
  });

}

init();
