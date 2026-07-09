// ── Supabase ─────────────────────────────────────────────
// SUPABASE_URL/SUPABASE_ANON/db are defined in config.js, loaded before this file.

let currentUserId  = null;
let currentProfile = null;
let allExams       = [];
let bestScores     = {}; // exam_id -> { score, total }

// ── Auth helpers ──────────────────────────────────────────
async function nameToEmail(name) {
  const data = new TextEncoder().encode(name.toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex  = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return hex + '@examplatform.app';
}

function validatePassword(pwd) {
  if (pwd.length < 8)     return 'Şifrə ən az 8 simvol olmalıdır.';
  if (!/[A-Z]/.test(pwd)) return 'Ən az bir böyük hərf olmalıdır.';
  if (!/[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>\/?]/.test(pwd))
                           return 'Ən az bir xüsusi simvol olmalıdır (!@#$ və s.).';
  return null;
}

async function doSignUp(name, password, confirm) {
  if (!name.trim())         throw new Error('Ad daxil edin.');
  const pwdErr = validatePassword(password);
  if (pwdErr)               throw new Error(pwdErr);
  if (password !== confirm) throw new Error('Şifrələr uyğun gəlmir.');

  const { data: available } = await db.rpc('is_username_available', { uname: name });
  if (!available)           throw new Error('Bu ad artıq istifadə olunur. Başqa ad seçin.');

  // The profiles row is created by a DB trigger on auth.users in the same
  // transaction as the auth user, so a duplicate name (or any other failure)
  // rolls back the whole signup instead of leaving an orphaned auth user.
  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { display_name: name } }
  });
  if (error) {
    if (/duplicate key|already registered|already exists|database error saving new user/i.test(error.message)) {
      throw new Error('Bu ad artıq istifadə olunur. Başqa ad seçin.');
    }
    throw new Error(error.message);
  }

  return { user: data.user, profile: { display_name: name } };
}

async function doSignIn(name, password) {
  if (!name.trim()) throw new Error('Ad daxil edin.');
  if (!password)    throw new Error('Şifrə daxil edin.');

  const email = await nameToEmail(name);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Ad və ya şifrə yanlışdır.');

  const { data: profile, error: profErr } = await db.from('profiles').select('*').eq('id', data.user.id).single();
  if (profErr || !profile) throw new Error('Profil tapılmadı.');

  return { user: data.user, profile };
}

function setActiveProfile(userId, profile) {
  currentUserId  = userId;
  currentProfile = profile.display_name;
  document.getElementById('profileName').textContent = profile.display_name;
  document.getElementById('dropdownName').textContent = profile.display_name;
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Exam list ──────────────────────────────────────────
async function loadExams() {
  const { data: exams, error } = await db.from('exams').select('*').order('created_at', { ascending: false });
  if (error) {
    showToast('İmtahanlar yüklənmədi: ' + error.message);
    return;
  }
  allExams = exams || [];

  const { data: attempts } = await db.from('exam_attempts')
    .select('exam_id, score, total')
    .eq('user_id', currentUserId);

  bestScores = {};
  (attempts || []).forEach(a => {
    const cur = bestScores[a.exam_id];
    if (!cur || a.score / a.total > cur.score / cur.total) bestScores[a.exam_id] = a;
  });

  renderExamList();
}

function renderExamList() {
  const grid = document.getElementById('examGrid');
  const empty = document.getElementById('examListEmpty');
  grid.innerHTML = '';

  if (allExams.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  allExams.forEach(exam => {
    const card = document.createElement('div');
    card.className = 'exam-card';
    const best = bestScores[exam.id];
    card.innerHTML = `
      <div class="exam-card-title">${escapeHtml(exam.title)}</div>
      ${exam.description ? `<div class="exam-card-desc">${escapeHtml(exam.description)}</div>` : '<div class="exam-card-desc"></div>'}
      <div class="exam-card-meta">
        <span>⏱ ${exam.duration_minutes} dəq</span>
      </div>
      ${best ? `<div class="exam-card-best">✓ Ən yaxşı nəticə: ${best.score}/${best.total}</div>` : ''}
      <button class="btn-primary" data-exam-id="${exam.id}">Başla</button>
    `;
    card.querySelector('button').addEventListener('click', () => openExamStartConfirm(exam));
    grid.appendChild(card);
  });
}

// ── Exam start confirm ─────────────────────────────────
let pendingExam = null;

async function openExamStartConfirm(exam) {
  pendingExam = exam;
  document.getElementById('examStartTitle').textContent = exam.title;
  document.getElementById('examStartDesc').textContent = exam.description || '';

  const { count } = await db.from('exam_questions').select('id', { count: 'exact', head: true }).eq('exam_id', exam.id);
  document.getElementById('examStartQCount').textContent = count || 0;
  document.getElementById('examStartDuration').textContent = exam.duration_minutes + ' dəqiqə';

  openModal('examStartOverlay');
}

document.getElementById('examStartBeginBtn').addEventListener('click', () => {
  closeModal('examStartOverlay');
  if (pendingExam) beginExam(pendingExam);
});

// ── Exam session ───────────────────────────────────────
let examSession = null;
let timerInterval = null;

async function beginExam(exam) {
  const { data: questions, error } = await db.rpc('get_exam_questions', { p_exam_id: exam.id });
  if (error || !questions || questions.length === 0) {
    showToast('Bu imtahanda sual yoxdur.');
    return;
  }

  examSession = {
    exam,
    questions,
    answers: {},
    current: 0,
    startedAt: new Date(),
    deadline: Date.now() + exam.duration_minutes * 60 * 1000
  };

  window.addEventListener('beforeunload', beforeUnloadWarning);
  openModal('examRunScreen');
  renderExamRunQuestion();
  startTimer();
}

function beforeUnloadWarning(e) {
  e.preventDefault();
  e.returnValue = '';
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    updateTimerDisplay();
    if (Date.now() >= examSession.deadline) {
      clearInterval(timerInterval);
      showToast('Vaxt bitdi, imtahan avtomatik təhvil verildi.');
      finishExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const remainingMs = Math.max(0, examSession.deadline - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const el = document.getElementById('examRunTimer');
  el.textContent = `⏱ ${m}:${s.toString().padStart(2, '0')}`;
  el.classList.toggle('low', totalSec <= 60);
}

function renderExamJumpGrid() {
  const wrap = document.getElementById('examJumpGrid');
  wrap.innerHTML = '';
  examSession.questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.className = 'exam-jump-btn';
    if (i === examSession.current) btn.classList.add('current');
    if (examSession.answers[q.id] != null) btn.classList.add('answered');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => {
      examSession.current = i;
      renderExamRunQuestion();
    });
    wrap.appendChild(btn);
  });
}

function renderExamRunQuestion() {
  const { questions, current, answers } = examSession;
  const q = questions[current];

  document.getElementById('examRunProgress').textContent = `Sual ${current + 1} / ${questions.length}`;
  renderExamJumpGrid();

  const body = document.getElementById('examRunBody');
  body.innerHTML = '';

  const qEl = document.createElement('p');
  qEl.className = 'quiz-question';
  qEl.textContent = q.question;
  body.appendChild(qEl);

  const container = document.createElement('div');
  container.className = 'quiz-options';
  const opts = [
    ['a', q.option_a], ['b', q.option_b], ['c', q.option_c], ['d', q.option_d]
  ];
  if (q.option_e) opts.push(['e', q.option_e]);

  opts.forEach(([letter, text]) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    if (answers[q.id] === letter) btn.classList.add('selected');
    btn.textContent = text;
    btn.addEventListener('click', () => {
      examSession.answers[q.id] = letter;
      container.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderExamJumpGrid();
    });
    container.appendChild(btn);
  });
  body.appendChild(container);

  const prevBtn = document.getElementById('examRunPrevBtn');
  const nextBtn = document.getElementById('examRunNextBtn');
  prevBtn.disabled = current === 0;
  nextBtn.textContent = current === questions.length - 1 ? 'Bitir →' : 'Növbəti →';
  nextBtn.onclick = () => {
    if (current === questions.length - 1) {
      confirmFinishExam();
    } else {
      examSession.current++;
      renderExamRunQuestion();
    }
  };
  prevBtn.onclick = () => {
    examSession.current--;
    renderExamRunQuestion();
  };
}

function confirmFinishExam() {
  const total = examSession.questions.length;
  const answered = Object.keys(examSession.answers).length;
  if (answered < total) {
    if (!confirm(`${total - answered} suala cavab vermədiniz. Yenə də təhvil vermək istəyirsiniz?`)) return;
  } else {
    if (!confirm('İmtahanı təhvil vermək istədiyinizə əminsiniz?')) return;
  }
  finishExam(false);
}

async function finishExam(auto) {
  clearInterval(timerInterval);
  window.removeEventListener('beforeunload', beforeUnloadWarning);

  const finishBtn = document.getElementById('examRunFinishBtn');
  if (finishBtn) finishBtn.disabled = true;

  const { exam, answers, startedAt, questions } = examSession;
  const { data, error } = await db.rpc('submit_exam_attempt', {
    p_exam_id: exam.id,
    p_answers: answers,
    p_started_at: startedAt.toISOString()
  });

  if (finishBtn) finishBtn.disabled = false;
  closeModal('examRunScreen');

  if (error || !data || data.length === 0) {
    showToast('Nəticə göndərilmədi: ' + (error?.message || 'naməlum xəta'));
    return;
  }

  const { score, total, correct_answers } = data[0];
  showExamResult(exam, questions, answers, correct_answers, score, total);
  loadExams();
}

function showExamResult(exam, questions, answers, correctAnswers, score, total) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  document.getElementById('resultIcon').textContent = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
  document.getElementById('resultTitle').textContent = exam.title;
  document.getElementById('resultScoreBig').textContent = `${score} / ${total}`;
  document.getElementById('resultPct').textContent = `${pct}%`;

  const list = document.getElementById('resultReviewList');
  list.innerHTML = '';
  const letterToText = (q, letter) => {
    if (!letter) return '—';
    return q[`option_${letter}`] || letter.toUpperCase();
  };

  questions.forEach(q => {
    const yourLetter = answers[q.id] || null;
    const correctLetter = correctAnswers[q.id];
    const isCorrect = yourLetter === correctLetter;
    const item = document.createElement('div');
    item.className = 'review-item ' + (isCorrect ? 'right' : 'wrong');
    item.innerHTML = `
      <div class="review-q">${escapeHtml(q.question)}</div>
      <div class="review-a your-answer ${isCorrect ? '' : 'wrong-answer'}">Cavabınız: ${escapeHtml(letterToText(q, yourLetter))}</div>
      ${!isCorrect ? `<div class="review-a correct-answer">Düzgün: ${escapeHtml(letterToText(q, correctLetter))}</div>` : ''}
    `;
    list.appendChild(item);
  });

  openModal('resultOverlay');
}

// ── History ────────────────────────────────────────────
async function loadHistory() {
  const { data, error } = await db.from('exam_attempts')
    .select('id, score, total, submitted_at, exams(title)')
    .eq('user_id', currentUserId)
    .order('submitted_at', { ascending: false });

  const list = document.getElementById('historyList');
  list.innerHTML = '';

  if (error) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>Nəticələr yüklənmədi.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div>Hələ heç bir imtahan verməmisiniz.</div>`;
    return;
  }

  data.forEach(a => {
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
    const date = new Date(a.submitted_at).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div>
        <div class="history-item-title">${escapeHtml(a.exams?.title || 'İmtahan')}</div>
        <div class="history-item-date">${date}</div>
      </div>
      <div class="history-item-score ${pct >= 50 ? 'pass' : 'fail'}">${a.score}/${a.total} · ${pct}%</div>
    `;
    list.appendChild(item);
  });
}

// ── Auth modal ────────────────────────────────────────────
function showAuthModal() {
  ['signupName','signupPassword','signupConfirm','signinName','signinPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showAuthError('signup', '');
  showAuthError('signin', '');

  document.querySelectorAll('.profile-pwd-toggle').forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
      btn.setAttribute('aria-label', show ? 'Şifrəni gizlət' : 'Şifrəni göstər');
    };
  });

  document.getElementById('tabSignup').onclick = () => switchTab('signup');
  document.getElementById('tabSignin').onclick = () => switchTab('signin');

  document.getElementById('btnSignup').onclick = async () => {
    const name    = document.getElementById('signupName').value.trim();
    const pwd     = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    setAuthLoading('btnSignup', true);
    try {
      const { user, profile } = await doSignUp(name, pwd, confirm);
      setActiveProfile(user.id, profile);
      document.getElementById('profileOverlay').classList.add('hidden');
      loadExams();
    } catch (e) {
      showAuthError('signup', e.message);
    } finally { setAuthLoading('btnSignup', false); }
  };

  document.getElementById('btnSignin').onclick = async () => {
    const name = document.getElementById('signinName').value.trim();
    const pwd  = document.getElementById('signinPassword').value;
    setAuthLoading('btnSignin', true);
    try {
      const { user, profile } = await doSignIn(name, pwd);
      setActiveProfile(user.id, profile);
      document.getElementById('profileOverlay').classList.add('hidden');
      loadExams();
    } catch (e) {
      showAuthError('signin', e.message);
    } finally { setAuthLoading('btnSignin', false); }
  };

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
async function init() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const { data: profile } = await db.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        setActiveProfile(session.user.id, profile);
        loadExams();
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

  document.getElementById('profileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentProfile) return;
    document.getElementById('profileDropdown').classList.toggle('hidden');
  });
  document.getElementById('profileDropdown').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => document.getElementById('profileDropdown').classList.add('hidden'));

  document.getElementById('historyBtn').addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.add('hidden');
    loadHistory();
    openModal('historyOverlay');
  });

  document.querySelectorAll('.modal-close[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.getElementById('examRunFinishBtn').addEventListener('click', confirmFinishExam);
  document.getElementById('resultCloseBtn').addEventListener('click', () => closeModal('resultOverlay'));

  document.getElementById('btnSignOut').addEventListener('click', async () => {
    document.getElementById('profileDropdown').classList.add('hidden');
    await db.auth.signOut();
    currentUserId = null; currentProfile = null;
    document.getElementById('profileName').textContent = '';
    document.getElementById('dropdownName').textContent = '';
    showAuthModal();
  });
}

init();
