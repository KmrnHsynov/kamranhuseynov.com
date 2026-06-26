// ── Supabase ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://krrzidmvtudulflxzrqj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtycnppZG12dHVkdWxmbHh6cnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTQ1NzYsImV4cCI6MjA5ODAzMDU3Nn0.zj6zfL7WsCugBGi5rjLbBQ-wmt6Q4q-lNNxc72M8Vj4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

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

function saveState(state) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
  syncProgress();
}

async function syncProgress() {
  if (!currentUserId) return;
  const col = currentMode === 'sat' ? 'sat_progress' : 'normal_progress';
  const state = loadState();
  await db.from('profiles').update({ [col]: state.completedNodes }).eq('id', currentUserId);
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

  checkDailyLivesReset();

  document.getElementById('profileName').textContent = profile.avatar + ' ' + profile.display_name;
  document.getElementById('dropdownAvatar').textContent = profile.avatar;
  document.getElementById('dropdownName').textContent   = profile.display_name;
  updateDropdownStats();
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

  document.getElementById('dropdownCompleted').textContent = completed;
  document.getElementById('dropdownTotal').textContent     = total;
  document.getElementById('dropdownLives').textContent     = '❤️'.repeat(lives) + '🤍'.repeat(5 - lives);
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

  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signUp({ email, password });
  if (error)                     throw new Error(error.message);

  const { error: profErr } = await db.from('profiles').insert({
    id: data.user.id, display_name: name, avatar,
    normal_progress: [], sat_progress: []
  });
  if (profErr)                   throw new Error(profErr.message);

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

    const collapseKey = `igp_collapsed_${section.id}`;
    const isCollapsed = localStorage.getItem(collapseKey) === '1';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title collapsible';
    titleEl.innerHTML = `<span>${section.title}</span><span class="section-chevron">${isCollapsed ? '▶' : '▼'}</span>`;
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
      const status = getNodeStatus(node.id, allNodeIds, state);

      if (ni > 0) {
        const line = document.createElement('div');
        line.className = 'path-line' + (status === 'completed' ? ' done' : '');
        nodesContainer.appendChild(line);
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
      if (audio.paused) { audio.play(); playBtn.innerHTML = '&#10074;&#10074;'; }
      else              { audio.pause(); playBtn.innerHTML = '&#9654;'; }
    });
    audio.addEventListener('timeupdate', () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      progress.style.width = pct + '%';
      const m = Math.floor(audio.currentTime / 60);
      const s = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
      timeEl.textContent = `${m}:${s}`;
    });
    audio.addEventListener('ended', () => { playBtn.innerHTML = '&#9654;'; });
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

async function init() {
  const [normalRes, satRes] = await Promise.all([
    fetch('curriculum.json'),
    fetch('sat_curriculum.json')
  ]);
  window._normalCurriculum = await normalRes.json();
  window._satCurriculum    = await satRes.json();

  // Check existing Supabase session
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

  // Profile button → toggle dropdown
  document.getElementById('profileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentProfile) return;
    document.getElementById('profileDropdown').classList.toggle('hidden');
    updateDropdownStats();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.add('hidden');
  });

  document.getElementById('profileDropdown').addEventListener('click', (e) => e.stopPropagation());

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

  // Mode toggle
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
