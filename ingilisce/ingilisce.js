const DEFAULT_STATE = {
  completedNodes: [],
  lives: 5,
  currentQuizNode: null
};

let currentMode = 'normal'; // 'normal' | 'sat'
let currentProfile = null;

// ── Profile management ─────────────────────────────────

function getProfiles() {
  try { return JSON.parse(localStorage.getItem('ingilisce_profiles') || '[]'); } catch { return []; }
}

function getAvatar(name) {
  return localStorage.getItem('ingilisce_avatar_' + name) || '👤';
}

function saveProfileName(name, avatar) {
  const profiles = getProfiles();
  if (!profiles.includes(name)) { profiles.push(name); localStorage.setItem('ingilisce_profiles', JSON.stringify(profiles)); }
  if (avatar) localStorage.setItem('ingilisce_avatar_' + name, avatar);
  localStorage.setItem('ingilisce_current_profile', name);
  currentProfile = name;
  document.getElementById('profileName').textContent = getAvatar(name) + ' ' + name;
}

function storageKey() {
  const base = currentMode === 'sat' ? 'ingilisce_sat_progress' : 'ingilisce_progress';
  return currentProfile ? `${base}_${currentProfile}` : base;
}

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey());
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

// ── Curriculum helpers ─────────────────────────────────

function getAllNodeIds(curriculum) {
  return curriculum.sections.flatMap(s => s.nodes.map(n => n.id));
}

function findNode(nodeId, curriculum) {
  for (const section of curriculum.sections) {
    const node = section.nodes.find(n => n.id === nodeId);
    if (node) return node;
  }
  return null;
}

function getNodeStatus(nodeId, allNodeIds, state) {
  if (state.completedNodes.includes(nodeId)) return 'completed';
  const firstIncomplete = allNodeIds.find(id => !state.completedNodes.includes(id));
  return nodeId === firstIncomplete ? 'active' : 'locked';
}

// ── Modal helpers ──────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function renderLives(containerId, lives) {
  document.getElementById(containerId).innerHTML =
    Array.from({ length: 5 }, (_, i) => i < lives ? '❤️' : '🤍').join('');
}

// ── Path rendering ─────────────────────────────────────

function renderPath(curriculum) {
  const state = loadState();
  const allNodeIds = getAllNodeIds(curriculum);
  const container = document.getElementById('pathContainer');
  container.innerHTML = '';

  curriculum.sections.forEach((section, si) => {
    const block = document.createElement('div');
    block.className = 'section-block';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title';
    titleEl.textContent = section.title;
    block.appendChild(titleEl);

    section.nodes.forEach((node, ni) => {
      const status = getNodeStatus(node.id, allNodeIds, state);

      if (si > 0 || ni > 0) {
        const line = document.createElement('div');
        line.className = 'path-line' + (status === 'completed' ? ' done' : '');
        block.appendChild(line);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'node-wrapper';

      const nodeEl = document.createElement('div');
      nodeEl.className = `node ${status}`;
      nodeEl.textContent = status === 'locked' ? '🔒' : status === 'completed' ? '✅' : '📖';
      nodeEl.addEventListener('click', () => handleNodeClick(node.id, status, curriculum));

      const label = document.createElement('div');
      label.className = 'node-label';
      label.textContent = node.title;

      wrapper.appendChild(nodeEl);
      wrapper.appendChild(label);
      block.appendChild(wrapper);
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
  document.getElementById('lessonBody').textContent = node.lesson;
  renderLives('lessonLives', state.lives);

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

// ── Quiz engine ────────────────────────────────────────

let quizSession = null;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
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
  showFeedbackToast(isCorrect);

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
    if (input) input.classList.add(isCorrect ? 'correct' : 'wrong');
  }
}

function showFeedbackToast(isCorrect) {
  const existing = document.querySelector('.feedback');
  if (existing) existing.remove();
  const fb = document.createElement('div');
  fb.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  fb.textContent = isCorrect ? '✓ Düzgün!' : '✗ Yanlış!';
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 1400);
}

// ── Node completion ────────────────────────────────────

function completeNode(nodeId, curriculum) {
  const state = loadState();
  if (!state.completedNodes.includes(nodeId)) {
    state.completedNodes.push(nodeId);
  }
  state.lives = 5;
  saveState(state);
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

// ── Profile modal ──────────────────────────────────────

function showProfileModal() {
  const profiles = getProfiles();
  const listEl = document.getElementById('profileList');
  listEl.innerHTML = '';
  profiles.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'profile-chip';
    chip.textContent = getAvatar(name) + ' ' + name;
    chip.addEventListener('click', () => {
      saveProfileName(name);
      document.getElementById('profileOverlay').classList.add('hidden');
      renderPath(currentMode === 'sat' ? window._satCurriculum : window._normalCurriculum);
    });
    listEl.appendChild(chip);
  });

  const input = document.getElementById('profileNameInput');
  const startBtn = document.getElementById('profileStart');
  input.value = '';

  const avatarBtns = document.querySelectorAll('.avatar-option');
  let selectedAvatar = '👦';
  avatarBtns.forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.avatar === selectedAvatar);
    btn.onclick = () => {
      selectedAvatar = btn.dataset.avatar;
      avatarBtns.forEach(b => b.classList.toggle('selected', b === btn));
    };
  });

  function doStart() {
    const name = input.value.trim();
    if (!name) return;
    saveProfileName(name, selectedAvatar);
    document.getElementById('profileOverlay').classList.add('hidden');
    renderPath(currentMode === 'sat' ? window._satCurriculum : window._normalCurriculum);
  }

  input.onkeydown = e => { if (e.key === 'Enter') doStart(); };
  startBtn.onclick = doStart;

  document.getElementById('profileOverlay').classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
}

// ── Init ───────────────────────────────────────────────

async function init() {
  const [normalRes, satRes] = await Promise.all([
    fetch('curriculum.json'),
    fetch('sat_curriculum.json')
  ]);
  window._normalCurriculum = await normalRes.json();
  window._satCurriculum   = await satRes.json();

  const saved = localStorage.getItem('ingilisce_current_profile');
  if (saved) {
    saveProfileName(saved);
    renderPath(window._normalCurriculum);
  } else {
    showProfileModal();
  }

  document.getElementById('profileBtn').addEventListener('click', showProfileModal);

  const toggleBtn = document.getElementById('modeToggle');
  toggleBtn.addEventListener('click', () => {
    if (currentMode === 'normal') {
      currentMode = 'sat';
      toggleBtn.textContent = 'Normal Rejim';
      toggleBtn.classList.add('active');
      renderPath(window._satCurriculum);
    } else {
      currentMode = 'normal';
      toggleBtn.textContent = 'SAT Rejimi';
      toggleBtn.classList.remove('active');
      renderPath(window._normalCurriculum);
    }
  });
}

init();
