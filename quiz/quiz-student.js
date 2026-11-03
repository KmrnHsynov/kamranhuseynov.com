'use strict';

const STORAGE_KEY_STUDENT   = 'qc_student_qs';
const MAX_QUESTIONS         = 30;
let EXAM_SECONDS            = 30 * 60;

let quizQs = [], quizIdx = 0, quizAns = {}, topicName = '', studentName = '', examKey = '';
let totalTimer = null, timeLeft = EXAM_SECONDS;
let _examList = [];

const DEFAULT_LEAVE_LIMIT   = 3;
const STORAGE_KEY_ATTEMPT   = 'qc_student_attempt';
const OPT_LETTERS           = ['A','B','C','D','E'];
// Students sign in anonymously so the database rules can tie each attempt to its owner.
const authReady = new Promise(resolve => {
  auth.onAuthStateChanged(u => {
    if(u) resolve(u);
    else auth.signInAnonymously().catch(e => console.warn('anonymous sign-in failed', e.code));
  });
});
let leaveLimit = DEFAULT_LEAVE_LIMIT, monitor = null, examActive = false, attemptId = '', autoReason = null, startedAt = 0;
let examVersion = 0, attemptCreated = false;
let sourceQs = [], examQCount = 0, startingExam = false, examOpensAt = 0, examClosesAt = 0, serverOffset = 0, lobbyTimer = null;
function serverNow(){ return Date.now() + serverOffset; }

// ── MY RESULT ─────────────────────────────────────────
// The teacher releases counts under results/<attempt id>. The attempt id is the student's result code:
// long and random, so it can be read by whoever holds it but the list of results cannot be browsed.
const STORAGE_KEY_LAST = 'qc_last_attempt';
const RESULT_CODE_RE = /^[-_A-Za-z0-9]{15,40}$/;

function rememberLastAttempt(){
  if(!attemptId) return;
  try{ localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify({ attemptId, topic: topicName, at: Date.now() })); }catch(e){}
}
function lastAttemptCode(){
  try{ return (JSON.parse(localStorage.getItem(STORAGE_KEY_LAST) || 'null') || {}).attemptId || ''; }catch(e){ return ''; }
}

function lookupHtml(){
  return `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);text-align:left">
    <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Nəticəmə bax</div>
    <input type="text" class="result-code-inp" placeholder="Nəticə kodu…" value="${esc(lastAttemptCode())}" maxlength="40" style="margin-bottom:8px;font-size:12px" onkeydown="if(event.key==='Enter')checkMyResult(this)"/>
    <button class="btn btn-ghost btn-full btn-sm" onclick="checkMyResult(this.previousElementSibling)">Yoxla</button>
    <div class="result-lookup-out" style="margin-top:10px;font-size:13px;line-height:1.6"></div>
  </div>`;
}

function resultCardHtml(r){
  const n = v => Number(v) || 0;
  return `<div style="padding:12px 14px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25)">
    <div style="font-size:26px;font-weight:800;color:var(--correct)">${n(r.pct)}%</div>
    <div style="font-weight:600">${esc(r.studentName)}</div>
    <div style="color:var(--text2)">${esc(r.topic)}</div>
    <div style="margin-top:6px">${n(r.score)} / ${n(r.maxScore)} xal · ${n(r.correct)} doğru · ${n(r.wrong)} yanlış · ${n(r.unanswered)} cavabsız</div>
  </div>`;
}

async function checkMyResult(input){
  const out = input.closest('div').querySelector('.result-lookup-out');
  const code = (input.value || '').trim();
  if(!RESULT_CODE_RE.test(code)){ out.innerHTML = '<span style="color:var(--wrong)">Kod düzgün deyil.</span>'; return; }
  out.textContent = '⏳ Yoxlanır…';
  try{
    const snap = await db.ref('results/' + code).once('value');
    const r = snap.val();
    out.innerHTML = r ? resultCardHtml(r) : '<span style="color:var(--text2)">Nəticə hələ elan olunmayıb. Daha sonra yenidən yoxlayın.</span>';
  }catch(e){
    out.innerHTML = '<span style="color:var(--wrong)">Yoxlamaq mümkün olmadı. İnternet bağlantısını yoxlayın.</span>';
  }
}

// Fisher–Yates; sorting with a random comparator does not shuffle evenly.
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The running exam is kept in localStorage so a refresh resumes it instead of restarting it.
// `finishing` marks an attempt that was finished but whose final save is not confirmed yet, so a refresh sends it again.
function persistState(finishing){
  if((!examActive && !finishing) || !attemptId) return;
  try{
    localStorage.setItem(STORAGE_KEY_ATTEMPT, JSON.stringify({
      v: 2, finishing: !!finishing, autoReason, attemptId, attemptCreated, examKey, examVersion, topicName, studentName, quizQs, quizAns, quizIdx,
      startedAt, examSeconds: EXAM_SECONDS, leaveLimit,
      monitor: monitor ? { ...monitor.stats(), elapsed: Math.floor((Date.now() - startedAt) / 1000) } : null
    }));
  }catch(e){}
}
function clearSavedAttempt(){ try{ localStorage.removeItem(STORAGE_KEY_ATTEMPT); }catch(e){} }
function loadSavedAttempt(){
  try{
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY_ATTEMPT)||'null');
    return s && s.v === 2 && s.attemptId && Array.isArray(s.quizQs) && s.quizQs.length ? s : null;
  }catch(e){ return null; }
}

function readLeaveLimit(exam){
  const n = parseInt(exam && exam.leaveLimit, 10);
  return Number.isNaN(n) || n < 0 ? DEFAULT_LEAVE_LIMIT : n;
}
function analyticsKey(){
  return examKey || topicName.replace(/[.#$[\]/]/g,'_') || 'default';
}

// ── MODE SELECT ───────────────────────────────────────
// Two modes share this one page: the exam (single-player, scheduled) and the live game
// (host-paced, joined by PIN/QR — see the LIVE GAME section near the bottom of this file).
function chooseExamMode(){ startExamMode(); }
function chooseLiveMode(){
  showView('live-join-view');
  document.getElementById('live-name-inp')?.focus();
}

function startExamMode(){
  // Show loading state while fetching from Firebase
  document.getElementById('lobby-view').innerHTML=`
    <div class="lock-card" style="max-width:460px">
      <div class="lock-icon">⏳</div>
      <h2>Yüklənir…</h2>
      <p style="font-size:13px;color:var(--text2)">Test məlumatları alınır</p>
    </div>`;
  showView('lobby-view');

  Promise.all([
    loadExamList(),
    // How far this device's clock is from the server's, so the open/close times cannot be dodged by changing it.
    db.ref('.info/serverTimeOffset').once('value').then(s => Number(s.val()), () => 0)
  ])
    .then(([snapshot, offset])=>{
      serverOffset = Number.isFinite(offset) ? offset : 0;
      const exams = snapshot;
      if(!exams.length){ showNoQuiz(); return; }
      if(exams.length===1){
        useExam(exams[0]);
        showLobby();
      } else {
        showExamList(exams);
      }
    })
    .catch(showLoadError);
}

// ── INIT ──────────────────────────────────────────────
(function init(){
  // Old versions cached the last published exam here and showed it when none was active.
  try{ localStorage.removeItem(STORAGE_KEY_STUDENT); }catch(e){}
  const saved = loadSavedAttempt();
  if(saved){ resumeExam(saved); return; }

  // A link from the host's QR code / PIN screen goes straight to the live join form, pin prefilled.
  const params = new URLSearchParams(location.search);
  const linkedPin = (params.get('pin') || '').replace(/\D/g, '').slice(0, 6);
  if(params.get('mode') === 'live' || linkedPin){
    if(linkedPin) document.getElementById('live-pin-inp').value = linkedPin;
    showView('live-join-view');
    return;
  }

  showView('mode-view');
})();

// Questions are not part of the list: they are fetched when the student starts (see loadExamQuestions).
// Exams published before the list existed are still read straight from student_quiz, as long as the rules allow it.
async function loadExamList(){
  // Rules that do not know the public list yet refuse this read: then fall back to the plain list below.
  const idx = await db.ref('exam_index').once('value').then(s => s.val() || {}, () => ({}));
  const listed = Object.entries(idx).map(([key,data])=>({key,...data})).filter(e=>e.qCount > 0 && e.active !== false);
  if(listed.length) return listed;
  const old = await db.ref('student_quiz').once('value').then(s => s.val() || {}, () => ({}));
  return Object.entries(old).map(([key,data])=>({key,...data})).filter(e=>legacyQuestionCount(e) > 0 && e.active !== false);
}

function questionList(v){
  return Array.isArray(v) ? v : Object.keys(v || {}).sort((a, b) => a - b).map(k => v[k]);
}

function useExam(e){
  examKey      = e.key;
  sourceQs     = e.questions ? questionList(e.questions) : [];   // never changed; every attempt shuffles a fresh copy of it
  quizQs       = sourceQs;
  examQCount   = e.qCount || sourceQs.length;
  topicName    = e.topic||e.key;
  EXAM_SECONDS = (e.examMinutes||30)*60;
  leaveLimit   = readLeaveLimit(e);
  examVersion  = e.publishedAt || 0;
  examOpensAt  = Number(e.opensAt) || 0;
  examClosesAt = Number(e.closesAt) || 0;
}

function showNoQuiz(){
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">📭</div>
      <h2>Aktiv Test Yoxdur</h2>
      <p>Hazırda aktiv test yoxdur. Müəllim test göndərdikdə bu səhifədə görünəcək.</p>
      <button class="btn btn-ghost btn-full" onclick="location.reload()">↻ Yenilə</button>
      ${lookupHtml()}
    </div>`;
  showView('lobby-view');
}

function showLoadError(){
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">⚠️</div>
      <h2>Yüklənmədi</h2>
      <p>Test məlumatları alına bilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.</p>
      <button class="btn btn-primary btn-full" onclick="location.reload()">↻ Yenidən cəhd et</button>
    </div>`;
  showView('lobby-view');
}

function showExamList(exams){
  _examList = exams;
  document.getElementById('lobby-view').innerHTML=`
    <div class="lock-card" style="max-width:460px">
      <div class="lock-icon">📋</div>
      <h2 style="font-family:'Nunito',sans-serif">Test Seçin</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">Müəllim ${exams.length} test göndərib. Birini seçin:</p>
      ${exams.map((e,i)=>`
        <button class="btn btn-ghost btn-full" style="margin-bottom:8px;text-align:left;padding:12px 16px;display:block" onclick="selectExam(${i})">
          <div style="font-weight:700;margin-bottom:2px">${esc(e.topic||e.key)}</div>
          <div style="font-size:11px;color:var(--muted)">${e.qCount || legacyQuestionCount(e)} sual${examScheduleLabel(e)?' · '+esc(examScheduleLabel(e)):''}</div>
        </button>
      `).join('')}
      ${lookupHtml()}
    </div>`;
  showView('lobby-view');
}

function selectExam(idx){
  useExam(_examList[idx]);
  showLobby();
}

function examScheduleLabel(e){
  return scheduleLabel(serverNow(), Number(e.opensAt) || 0, Number(e.closesAt) || 0);
}

function showClosedLobby(state){
  const before = state === 'before';
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">${before ? '⏳' : '🔒'}</div>
      <h2>${before ? 'Test Hələ Açılmayıb' : 'Test Bağlanıb'}</h2>
      <p>${esc(topicName||'İmtahan')}<br/>${before
        ? 'Açılış vaxtı: <strong>' + esc(formatWhen(examOpensAt)) + '</strong>'
        : 'Başlamaq üçün son vaxt <strong>' + esc(formatWhen(examClosesAt)) + '</strong> idi.'}</p>
      <button class="btn btn-ghost btn-full" onclick="showLobby()">↻ Yenilə</button>
      ${_examList.length > 1 ? '<button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="showExamList(_examList)">← Siyahıya qayıt</button>' : ''}
      ${lookupHtml()}
    </div>`;
  showView('lobby-view');
  // Opens by itself when the time comes. The delay is capped because setTimeout cannot take more than ~24 days.
  if(before) lobbyTimer = setTimeout(showLobby, Math.min(examOpensAt - serverNow() + 500, 2147483647));
}

// With several tests published, the student picks one first; this arrow goes back to that list if they picked wrong.
function backToListHtml(){
  return _examList.length > 1
    ? '<div style="text-align:left;margin:-6px 0 10px"><button class="btn btn-ghost btn-sm" onclick="showExamList(_examList)" title="Test siyahısına qayıt">← Testlər</button></div>'
    : '';
}

// Firefox on Android gives the page no signal when a phone assistant (Circle to Search, Gemini)
// opens, so a monitored exam (or live game) cannot be run there. Shared by exam and live mode,
// each passing its own leave limit (0 = no monitoring, so nothing to protect).
function browserBlocked(limit){
  const ua = navigator.userAgent || '';
  return limit > 0 && /Android/i.test(ua) && /Firefox\//i.test(ua);
}

function showLobby(){
  clearTimeout(lobbyTimer);
  const state = scheduleState(serverNow(), examOpensAt, examClosesAt);
  if(state !== 'open'){ showClosedLobby(state); return; }
  if(browserBlocked(leaveLimit)){
    document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card" style="max-width:460px">
      ${backToListHtml()}
      <div class="lock-icon">🚫</div>
      <h2>Bu brauzer dəstəklənmir</h2>
      <p>${esc(topicName||'İmtahan')}<br/>Bu imtahanı Firefox-da açmaq olmur. Zəhmət olmasa linki <strong>Chrome</strong> brauzerində açın.</p>
      ${lookupHtml()}
    </div>`;
    showView('lobby-view');
    return;
  }
  const count = Math.min(examQCount, MAX_QUESTIONS);
  const closing = examClosesAt ? `<p style="font-size:12px;color:var(--muted);margin-bottom:12px">Başlamaq üçün son vaxt: <strong>${esc(formatWhen(examClosesAt))}</strong></p>` : '';
  const notice = leaveLimit > 0 ? `
      <p style="font-size:12px;color:var(--wrong);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px;margin-bottom:16px;line-height:1.6;text-align:left">
        ⚠ Diqqət: Bu səhifədən çıxmaq (başqa tab və ya pəncərə) qeydə alınır. ${leaveLimit} dəfə çıxsanız və ya brauzeri bağlasanız, imtahan avtomatik göndəriləcək.
      </p>` : '';
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card" style="max-width:460px">
      ${backToListHtml()}
      <div class="lock-icon">📝</div>
      <h2 id="lobby-topic">${esc(topicName||'İmtahan')}</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:6px">
        Suallar: <strong>${count}</strong> &nbsp;·&nbsp; Vaxt: <strong>${Math.round(EXAM_SECONDS/60)} dəqiqə</strong>
      </p>
      <p style="font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.7">
        Suallar və cavablar avtomatik qarışdırılacaq.<br/>
        Vaxt bitdikdə test avtomatik göndəriləcək.
      </p>
      ${closing}
      ${notice}
      <input type="text" id="student-name-inp" placeholder="Adınızı daxil edin…" style="margin-bottom:14px" maxlength="60"/>
      <p id="name-error" style="display:none;font-size:12px;color:var(--wrong);margin:-6px 0 12px;text-align:left">Zəhmət olmasa adınızı daxil edin.</p>
      <button class="btn btn-primary btn-full" onclick="startExam()">▶ İmtahana Başla</button>
      ${lookupHtml()}
    </div>`;
  showView('lobby-view');
}

// ── START ─────────────────────────────────────────────
// The questions are only fetched when the student starts, so before the exam opens the database holds them back.
async function loadExamQuestions(){
  try{
    const e = (await db.ref('student_quiz/'+examKey).once('value')).val();
    if(!e) throw new Error('gone');
    const list = e.payload ? await decodeQuestions(e.payload, examKey, e.publishedAt) : questionList(e.questions);
    if(!list.length) throw new Error('empty');
    // The teacher may have published it again since the list was read: take its version, time and limits.
    sourceQs = list; quizQs = list; examQCount = list.length;
    examVersion = e.publishedAt || 0; EXAM_SECONDS = (e.examMinutes || 30) * 60; leaveLimit = readLeaveLimit(e);
    examOpensAt = Number(e.opensAt) || 0; examClosesAt = Number(e.closesAt) || 0;
    return true;
  }catch(err){
    console.warn('loading the questions failed', err.code || err.message || err);
    if(err && err.code === 'PERMISSION_DENIED') alert('Test hələ açılmayıb. Vaxtı gələndə yenidən cəhd edin.');
    else alert('Suallar yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.');
    return false;
  }
}

async function startExam(){
  if(startingExam) return;
  // Checked again here: the page may have been open since before the exam closed.
  if(scheduleState(serverNow(), examOpensAt, examClosesAt) !== 'open' || browserBlocked(leaveLimit)){ showLobby(); return; }
  const typedName = (document.getElementById('student-name-inp')?.value || '').trim();
  if(!typedName){
    const err = document.getElementById('name-error');
    if(err) err.style.display = 'block';
    document.getElementById('student-name-inp')?.focus();
    return;
  }
  studentName = typedName;
  startingExam = true;
  const btn = document.querySelector('#lobby-view .btn-primary');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Suallar yüklənir…'; }
  const loaded = sourceQs.length ? true : await loadExamQuestions();
  startingExam = false;
  if(!loaded){ showLobby(); return; }
  if(scheduleState(serverNow(), examOpensAt, examClosesAt) !== 'open' || browserBlocked(leaveLimit)){ showLobby(); return; }
  // Shuffle all questions, pick up to 30. Always from the untouched source, so starting again
  // after leaving does not shuffle already-shuffled options and break the answer positions.
  let pool = shuffle(JSON.parse(JSON.stringify(sourceQs))).slice(0, MAX_QUESTIONS);

  // Randomize MC answer order. `order[i]` is the original position of the option now shown at i;
  // answers are stored by original position, so the teacher panel can grade them.
  pool = pool.map(q => {
    if(q.type !== 'mc') return q;
    const order = shuffle(q.options.map((o, i) => i).filter(i => q.options[i]));
    return { ...q, order, options: order.map(i => q.options[i]) };
  });

  quizQs = pool;
  quizIdx = 0; quizAns = {};
  timeLeft = EXAM_SECONDS;
  startedAt = Date.now();
  attemptCreated = false;
  attemptId = db.ref('analytics/'+analyticsKey()).push().key;
  monitor = leaveLimit > 0 ? createMonitor(leaveLimit) : null;
  autoReason = null;
  examActive = true;
  saveAttempt('in_progress');

  document.getElementById('quiz-disp-title').textContent = 'İmtahan';
  showView('quiz-view');
  renderQuizQ();
  startTotalTimer();
  enterFullscreen();
}

// ── TOTAL TIMER ───────────────────────────────────────
function startTotalTimer(){
  clearInterval(totalTimer);
  updateTimerDisplay();
  totalTimer = setInterval(() => {
    timeLeft = EXAM_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
    updateTimerDisplay();
    if(timeLeft <= 0){ clearInterval(totalTimer); finishQuiz(); }
  }, 1000);
}

function updateTimerDisplay(){
  const pill = document.getElementById('timer-pill');
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  pill.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  pill.classList.remove('hidden');
  pill.className = 'timer-pill' + (timeLeft <= 120 ? ' danger' : timeLeft <= 300 ? ' warn' : '');
}

// ── QUIZ ENGINE ───────────────────────────────────────
function renderQuizQ(){
  const q = quizQs[quizIdx];
  const total = quizQs.length;
  document.getElementById('q-progress').textContent = `${quizIdx+1} / ${total}`;
  document.getElementById('prog-fill').style.width = `${(quizIdx/total)*100}%`;
  document.getElementById('btn-prev').style.display = quizIdx === 0 ? 'none' : 'inline-flex';
  document.getElementById('btn-next').textContent = quizIdx === total-1 ? 'Bitir ✓' : 'Növbəti →';
  document.getElementById('quiz-pts-lbl').textContent = `${q.points} xal`;
  document.getElementById('quiz-card-container').innerHTML = buildQuizCard(q);
  const saved = quizAns[q.id];
  if(saved !== undefined) restoreAns(q, saved);
  persistState();
}

function buildQuizCard(q){
  const L = OPT_LETTERS;
  let body = '';
  if(q.type === 'mc'){
    body = `<div class="quiz-mc-opts">${q.options.filter(o=>o).map((o,i)=>`
      <div class="quiz-mc-opt" id="mc${i}" onclick="pickMC(${q.id},${i})">
        <div class="opt-ltr">${L[i]}</div><div class="opt-txt">${esc(o)}</div>
      </div>`).join('')}</div>`;
  } else if(q.type === 'tf'){
    body = `<div class="quiz-tf-opts">
      <div class="quiz-tf-btn" id="tf-t" onclick="pickTF(${q.id},true)">✓ Doğru</div>
      <div class="quiz-tf-btn" id="tf-f" onclick="pickTF(${q.id},false)">✗ Yanlış</div>
    </div>`;
  } else if(q.type === 'short'){
    body = `<textarea class="quiz-short-input" id="short-inp" oninput="liveShort(${q.id})" placeholder="Cavabınızı buraya yazın…" style="width:100%;background:var(--surface2);border:2px solid var(--border);border-radius:12px;color:var(--text);font-family:'Nunito',sans-serif;font-size:14px;padding:13px 15px;outline:none;resize:vertical;min-height:80px;transition:border-color .2s"></textarea>
    <div id="ans-status" style="margin-top:8px;min-height:18px;font-size:12px;color:var(--muted)"></div>`;
  } else if(q.type === 'fill'){
    const rendered = (q.fillText||'').replace(/\[blank\]/gi, () => `<input class="blank-inp" type="text"/>`);
    body = `<div class="fill-text-render" oninput="liveFill(${q.id})">${rendered}</div>
    <div id="ans-status" style="margin-top:12px;min-height:18px;font-size:12px;color:var(--muted)"></div>`;
  }
  return `<div class="quiz-card" id="quiz-card-main">
    <div class="quiz-q-label">Sual ${quizIdx+1} / ${quizQs.length}</div>
    <div class="quiz-q-text">${esc(q.text)}</div>
    ${body}
  </div>`;
}

// Answers are stored exactly as the student gave them, and can be changed until the exam ends. This page
// never knows which answer is correct: the key lives in a teacher-only database node and the teacher panel does the grading.
function markMC(idx){
  document.querySelectorAll('.quiz-mc-opt').forEach((el,i)=>el.classList.toggle('sel', i === idx));
}

function pickMC(qid, idx){
  const q = quizQs.find(q=>q.id===qid);
  quizAns[qid] = q.order[idx];   // stored as the option's position in the teacher's original list
  markMC(idx);
  onAnswered();
}

function markTF(val){
  document.getElementById('tf-t').classList.toggle('sel', val === true);
  document.getElementById('tf-f').classList.toggle('sel', val === false);
}

function pickTF(qid, val){
  quizAns[qid] = val;
  markTF(val);
  onAnswered();
}

// Written answers are kept as the student types. An empty one (or a fill-in with a blank left) counts as no answer.
function showAnsStatus(has){
  const el = document.getElementById('ans-status');
  if(el) el.textContent = has ? '✓ Cavab yadda saxlanıldı' : '';
}

function liveShort(qid){
  const val = (document.getElementById('short-inp')?.value || '').trim();
  if(val) quizAns[qid] = val.slice(0, 500); else delete quizAns[qid];
  showAnsStatus(!!val);
  onAnsweredSoon();
}

function liveFill(qid){
  const vals = [...document.querySelectorAll('.blank-inp')].map(i => i.value.trim());
  const complete = vals.length > 0 && vals.every(Boolean);
  if(complete) quizAns[qid] = vals.map(v => v.slice(0, 200)); else delete quizAns[qid];
  showAnsStatus(complete);
  onAnsweredSoon();
}

function onAnswered(){ saveAttempt('in_progress'); }

// Typing saves to this device at once and to the database after a short pause.
let answerSaveTimer = null;
function onAnsweredSoon(){
  persistState();
  clearTimeout(answerSaveTimer);
  answerSaveTimer = setTimeout(() => saveAttempt('in_progress'), 700);
}

function restoreAns(q, saved){
  if(q.type==='mc'){
    markMC((q.order||[]).indexOf(saved));
  } else if(q.type==='tf'){
    markTF(saved);
  } else if(q.type==='short'){
    const inp=document.getElementById('short-inp');
    if(inp) inp.value=saved||'';
    showAnsStatus(!!saved);
  } else if(q.type==='fill'&&Array.isArray(saved)){
    const inps=[...document.querySelectorAll('.blank-inp')];
    saved.forEach((v,i)=>{ if(inps[i]) inps[i].value=v; });
    showAnsStatus(true);
  }
}

function flushAnswer(){
  if(answerSaveTimer){ clearTimeout(answerSaveTimer); answerSaveTimer = null; saveAttempt('in_progress'); }
}
function nextQ(){
  flushAnswer();
  if(quizIdx < quizQs.length-1){ quizIdx++; renderQuizQ(); }
  else finishQuiz();
}
function prevQ(){ flushAnswer(); if(quizIdx > 0){ quizIdx--; renderQuizQ(); } }

// ── RESULTS ───────────────────────────────────────────
function answeredCount(){ return quizQs.filter(q => quizAns[q.id] !== undefined).length; }

// Writes only raw answers and server-stamped times. Scores are worked out in the teacher panel.
// The first save creates the record (with startedAt); later saves update it without touching startedAt.
// Resolves to true once the database has accepted the write, false if it was refused. Never rejects.
function saveAttempt(status){
  if(!attemptId) return Promise.resolve(false);
  const first = !attemptCreated;
  attemptCreated = true;
  if(status === 'in_progress') persistState();
  try{
    const m = monitor ? monitor.stats() : { tabSwitches:0, timeAway:0, pastes:0, events:[] };
    const SERVER_TIME = firebase.database.ServerValue.TIMESTAMP;
    const path = 'analytics/'+analyticsKey()+'/'+attemptId;
    const data = {
      attemptId, status,
      studentName,
      topic: topicName,
      examVersion: String(examVersion),
      qids: quizQs.map(q => String(q.id)),
      answers: { ...quizAns },
      tabSwitches: m.tabSwitches,
      timeAway: m.timeAway,
      pastes: m.pastes,
      autoSubmitted: autoReason === 'leaves',
      autoReason: autoReason || null,
      events: m.events,
      updatedAt: SERVER_TIME
    };
    if(status !== 'in_progress') data.finishedAt = SERVER_TIME;
    return authReady
      .then(u => {
        data.uid = u.uid;
        return first ? db.ref(path).set({ ...data, startedAt: SERVER_TIME }) : db.ref(path).update(data);
      })
      .then(() => true, e => {
        if(first) attemptCreated = false;
        console.warn('saving attempt failed', e.code || e);
        return false;
      });
  }catch(e){ return Promise.resolve(false); }
}

// The results screen only says "sent" once the database has accepted the final save. Until then the attempt
// stays in localStorage (marked `finishing`), so a refresh or the connection coming back sends it again.
let finalSaveState = '';
function setSaveState(state){
  finalSaveState = state;
  const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
  const retry = document.getElementById('result-retry');
  const notes = {
    pending: 'Səhifəni bağlamayın.',
    slow: 'Göndərmə gecikir. İnternet bağlantısını yoxlayın və səhifəni bağlamayın.',
    ok: '',
    failed: 'Cavablarınız göndərilə bilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin. Səhifəni bağlamayın.'
  };
  set('result-icon', { pending: '⏳', slow: '⏳', ok: '✅', failed: '⚠️' }[state]);
  set('result-heading', { pending: 'İmtahan göndərilir…', slow: 'İmtahan göndərilir…', ok: 'İmtahan göndərildi', failed: 'İmtahan göndərilmədi' }[state]);
  set('result-save', notes[state]);
  if(retry) retry.style.display = state === 'failed' ? 'inline-flex' : 'none';
  const extra = document.getElementById('result-extra');
  if(extra) extra.style.display = state === 'ok' ? 'block' : 'none';
}

function sendFinal(){
  setSaveState('pending');
  const slow = setTimeout(() => { if(finalSaveState === 'pending') setSaveState('slow'); }, 8000);
  saveAttempt('done').then(ok => {
    clearTimeout(slow);
    if(!ok){ setSaveState('failed'); return; }
    clearSavedAttempt();
    rememberLastAttempt();
    setSaveState('ok');
  });
}
window.addEventListener('online', () => { if(finalSaveState === 'failed' || finalSaveState === 'slow') sendFinal(); });

function finishQuiz(){
  clearInterval(totalTimer);
  clearTimeout(answerSaveTimer);
  examActive = false;
  leaveFullscreen();
  persistState(true);
  document.getElementById('leave-warning')?.remove();
  document.getElementById('result-sub').textContent =
    `${answeredCount()} / ${quizQs.length} suala cavab verdiniz. Nəticələr müəllim tərəfindən elan olunacaq.`;
  const autoEl = document.getElementById('result-auto');
  autoEl.style.display = autoReason === 'leaves' ? 'block' : 'none';
  autoEl.textContent = 'İmtahan səhifəsini çox dəfə tərk etdiyiniz üçün avtomatik göndərildi.';

  const extra = document.getElementById('result-extra');
  if(extra) extra.innerHTML = `<div class="lock-card" style="max-width:460px;margin:0 auto">
    <h2 style="font-size:18px">Nəticə kodunuz</h2>
    <p style="font-size:12px;margin-bottom:0">Bu kodu saxlayın. Müəllim nəticələri elan edəndə onunla xalınızı görə bilərsiniz.</p>
    ${lookupHtml()}
  </div>`;

  showView('results-view');
  sendFinal();
}

// Leaving counts as finishing: what was answered so far is sent, the rest stays unanswered.
function exitQuiz(){
  examActive = false;
  if(!confirm('İmtahandan çıxmaq istəyirsiniz? İmtahan bitmiş sayılacaq və indiyə qədərki cavablarınız göndəriləcək.')){ examActive = true; return; }
  finishQuiz();
}

// ── RESUME AFTER REFRESH ──────────────────────────────
// A refresh counts as one page leave, so it cannot be used to dodge the limit.
function resumeExam(s){
  examKey = s.examKey; examVersion = s.examVersion || 0; attemptCreated = !!s.attemptCreated;
  topicName = s.topicName; studentName = s.studentName;
  quizQs = s.quizQs; quizAns = s.quizAns || {}; quizIdx = s.quizIdx || 0;
  EXAM_SECONDS = s.examSeconds; leaveLimit = s.leaveLimit;
  attemptId = s.attemptId; startedAt = s.startedAt; autoReason = s.finishing ? (s.autoReason || null) : null;
  timeLeft = EXAM_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
  monitor = leaveLimit > 0 ? createMonitor(leaveLimit, null, s.monitor || undefined) : null;
  examActive = true;

  if(timeLeft <= 0 || s.finishing){ finishQuiz(); return; }
  document.getElementById('quiz-disp-title').textContent = 'İmtahan';
  showView('quiz-view');
  renderQuizQ();
  if(monitor){
    const r = monitor.leave();
    if(r.reached){ autoReason = 'leaves'; finishQuiz(); return; }
    monitor.back();
    showLeaveWarning(r.count);
  }
  startTotalTimer();
  saveAttempt('in_progress');
}

// ── MONITORING ────────────────────────────────────────
function onLeave(){
  if(!examActive || !monitor) return;
  const r = monitor.leave();
  if(!r) return;
  if(r.reached){ autoReason = 'leaves'; finishQuiz(); return; }
  saveAttempt('in_progress');
}

function onReturn(){
  if(!examActive || !monitor) return;
  const r = monitor.back();
  if(!r) return;
  saveAttempt('in_progress');
  showLeaveWarning(r.count);
}

function showLeaveWarning(count){
  document.getElementById('leave-warning')?.remove();
  const el = document.createElement('div');
  el.id = 'leave-warning';
  el.className = 'overlay';
  el.innerHTML = `<div class="modal" style="text-align:center">
    <div style="font-size:40px;margin-bottom:8px">⚠️</div>
    <h2>Xəbərdarlıq ${count}/${leaveLimit}</h2>
    <p>İmtahan səhifəsini tərk etdiniz. Yenə ${leaveLimit-count} dəfə çıxsanız, imtahan avtomatik göndəriləcək.</p>
    <button class="btn btn-primary btn-full" onclick="document.getElementById('leave-warning').remove();enterFullscreen()">Davam et</button>
  </div>`;
  document.body.appendChild(el);
}

document.addEventListener('visibilitychange', () => { document.hidden ? onLeave() : onReturn(); });
window.addEventListener('blur', onLeave);
window.addEventListener('focus', onReturn);
window.addEventListener('pagehide', () => { if(examActive) saveAttempt('in_progress'); });

document.addEventListener('paste', e => {
  if(!examActive || !monitor) return;
  e.preventDefault();
  monitor.paste();
  saveAttempt('in_progress');
}, true);
['copy','cut','contextmenu'].forEach(type => document.addEventListener(type, e => {
  if(!examActive || !monitor) return;
  if(!(e.target instanceof Element) || !e.target.closest('#quiz-card-container')) return;
  e.preventDefault();
  monitor.copy();
}, true));
// Long-press selection and dragging on the exam, outside the answer fields.
['selectstart','dragstart'].forEach(type => document.addEventListener(type, e => {
  if(!examActive) return;
  if(!(e.target instanceof Element) || !e.target.closest('#quiz-view') || e.target.closest('textarea,input')) return;
  e.preventDefault();
}, true));

// Some phone assistants (Circle to Search, Gemini) take over the screen without a blur or
// visibilitychange event, but the page usually still loses focus. Poll for that.
// Two polls in a row (about a second) must miss focus before it counts, so a brief system popup or
// keyboard switch does not cost a warning; an assistant overlay stays up much longer than that.
let unfocusedPolls = 0;
setInterval(() => {
  if(!examActive || !monitor){ unfocusedPolls = 0; return; }
  if(document.hasFocus()){ unfocusedPolls = 0; onReturn(); }
  else if(++unfocusedPolls >= 2) onLeave();
}, 500);

// ── FULLSCREEN ────────────────────────────────────────
// Needs a tap, so it is requested when the exam starts and again from the warning's button.
// Browsers without it (iPhone Safari) simply skip this.
function enterFullscreen(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if(!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  try{ Promise.resolve(req.call(el)).catch(() => {}); }catch(e){}
}
function leaveFullscreen(){
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if(!exit || !(document.fullscreenElement || document.webkitFullscreenElement)) return;
  try{ Promise.resolve(exit.call(document)).catch(() => {}); }catch(e){}
}
function onFullscreenChange(){
  if(!examActive || !monitor) return;
  if(document.fullscreenElement || document.webkitFullscreenElement) return;
  onLeave();
  onReturn();
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

// ── UTILS ─────────────────────────────────────────────
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function esc(s){ return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ══════════════════════════════════════════════════════
//  LIVE GAME (Kahoot-style, host-paced — separate state from the exam above, prefixed `live*`
//  to avoid colliding with it; reuses esc/showView/authReady/serverOffset/serverNow from above)
// ══════════════════════════════════════════════════════
let livePin = '', liveUid = '', liveDisplayName = '';
let liveRoomMetaRef = null, livePlayerProfileRef = null, liveLastIndex = -1;
let liveCurrentQuestion = null, liveQuestionStartedLocal = 0, liveAnswered = false;
let liveMonitor = null, liveLeaveLimit = 0, liveJoined = false;
let liveCountdownTimer = null;

// ── JOIN ──────────────────────────────────────────────
function showLiveJoinError(msg){
  const err = document.getElementById('live-join-error');
  err.textContent = msg;
  err.style.display = 'block';
}

async function joinLiveRoom(){
  const pinVal = (document.getElementById('live-pin-inp').value || '').trim();
  const nameVal = (document.getElementById('live-name-inp').value || '').trim();
  document.getElementById('live-join-error').style.display = 'none';
  if(!/^[0-9]{6}$/.test(pinVal)){ showLiveJoinError('PIN 6 rəqəm olmalıdır.'); return; }
  if(!nameVal){ showLiveJoinError('Zəhmət olmasa adınızı daxil edin.'); return; }

  const btn = document.getElementById('live-join-btn');
  btn.disabled = true; btn.textContent = '⏳ Yoxlanılır…';
  try{
    const snap = await db.ref('live_rooms/' + pinVal + '/meta').once('value');
    const meta = snap.val();
    if(!meta){ showLiveJoinError('Bu kodla oyun tapılmadı.'); return; }
    if(meta.status === 'FINISHED'){ showLiveJoinError('Bu oyun artıq bitib.'); return; }
    if(browserBlocked(Number(meta.leaveLimit) || 0)){ showLiveJoinError('Bu oyunu Firefox-da (Android) açmaq olmur. Zəhmət olmasa Chrome brauzerində açın.'); return; }

    const user = await authReady;
    liveUid = user.uid; livePin = pinVal; liveDisplayName = nameVal; liveLeaveLimit = Number(meta.leaveLimit) || 0;

    await db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/profile').set({
      displayName: liveDisplayName, joinedAt: firebase.database.ServerValue.TIMESTAMP, connected: true
    });
    db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/profile/connected').onDisconnect().set(false);

    // Re-fetched here too (not just by exam mode) so a live-only visit still gets an accurate server clock.
    const offsetSnap = await db.ref('.info/serverTimeOffset').once('value');
    serverOffset = Number(offsetSnap.val()) || 0;
    liveMonitor = liveLeaveLimit > 0 ? createMonitor(liveLeaveLimit) : null;
    liveJoined = true;

    showView('live-game-view');
    attachLiveRoomListener();
    enterFullscreen();
  }catch(e){
    showLiveJoinError('Qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.');
  }finally{
    btn.disabled = false; btn.textContent = '▶ Qoşul';
  }
}

// ── ROOM STATE ────────────────────────────────────────
function attachLiveRoomListener(){
  liveRoomMetaRef = db.ref('live_rooms/' + livePin + '/meta');
  liveRoomMetaRef.on('value', snap => {
    const meta = snap.val();
    if(!meta){ liveJoined = false; leaveFullscreen(); renderLiveGameMessage('🚫', 'Oyun bitdi', 'Müəllim otağı silib.'); detachLiveRoomListener(); return; }
    handleLiveMetaUpdate(meta);
  });
  // The teacher can only kick from the lobby roster, so this only ever fires once the player's
  // own profile is removed out from under them - not a race with their own join write, since
  // that write is already awaited (and so already landed) before this listener is attached.
  livePlayerProfileRef = db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/profile');
  livePlayerProfileRef.on('value', snap => {
    if(snap.exists() || !liveJoined) return;
    liveJoined = false;
    leaveFullscreen();
    renderLiveGameMessage('🚫', 'Oyundan çıxarıldınız', 'Müəllim sizi oyundan çıxarıb.');
    detachLiveRoomListener();
  });
}
function detachLiveRoomListener(){
  if(liveRoomMetaRef) liveRoomMetaRef.off();
  if(livePlayerProfileRef) livePlayerProfileRef.off();
  liveRoomMetaRef = null; livePlayerProfileRef = null;
  clearInterval(liveCountdownTimer);
}

// Every fire of this listener is a genuine state transition (status/currentIndex only ever change
// together, written in one update by the host), so a full re-render each time is safe and simple.
function handleLiveMetaUpdate(meta){
  clearInterval(liveCountdownTimer);
  if(meta.status === 'LOBBY') renderLiveWaiting(meta);
  else if(meta.status === 'QUESTION'){ liveAnswered = false; loadAndRenderLiveQuestion(meta); }
  else if(meta.status === 'REVEAL') renderLiveReveal();
  else renderLiveFinished(meta);
}

function liveGameMessageHtml(icon, title, sub){
  return `<div class="lock-card" style="margin:0 auto;max-width:460px">
    <div class="lock-icon">${icon}</div>
    <h2>${title}</h2>
    <p>${sub}</p>
  </div>`;
}
function renderLiveGameMessage(icon, title, sub){
  document.getElementById('live-game-wrap').innerHTML = liveGameMessageHtml(icon, title, sub);
}

function renderLiveWaiting(meta){
  renderLiveGameMessage('⏳', esc(meta.topic || 'Canlı Oyun'), `Salam, ${esc(liveDisplayName)}! Oyun başlayana qədər gözləyin…`);
}

// ── QUESTION ──────────────────────────────────────────
// A late joiner or a reconnect both land here: liveAnswered is re-checked against the database
// (not just the in-memory flag) so a reconnect after already answering can't be shown the
// options again - the database would refuse a second submit anyway, but this avoids the confusing
// dead click. A brand-new joiner mid-question simply has no answer yet and plays normally.
async function loadAndRenderLiveQuestion(meta){
  const i = meta.currentIndex;
  liveLastIndex = i;
  try{
    const [qSnap, aSnap] = await Promise.all([
      db.ref('live_rooms/' + livePin + '/questions/' + i).once('value'),
      db.ref('live_rooms/' + livePin + '/answers/' + i + '/' + liveUid).once('value')
    ]);
    liveCurrentQuestion = qSnap.val();
    liveAnswered = aSnap.exists();
  }catch(e){
    liveCurrentQuestion = null;
  }
  liveQuestionStartedLocal = meta.questionStartedAt || Date.now();
  renderLiveQuestion(meta, i);
  if(!liveAnswered) startLiveCountdown(meta);
}

function renderLiveQuestion(meta, i){
  const q = liveCurrentQuestion;
  const wrap = document.getElementById('live-game-wrap');
  if(!q){ wrap.innerHTML = liveGameMessageHtml('⚠️', 'Sual yüklənmədi', 'Səhifəni yeniləyin.'); return; }
  if(liveAnswered){
    wrap.innerHTML = liveGameMessageHtml('✓', `Sual ${i + 1} / ${meta.questionCount}`, 'Bu suala artıq cavab vermisiniz. Növbəti addımı gözləyin…');
    return;
  }
  wrap.innerHTML = `
    <div class="quiz-topbar">
      <span class="quiz-title-lbl">${esc(meta.topic || 'Canlı Oyun')}</span>
      <div class="quiz-meta">
        <span class="quiz-prog-txt">${i + 1} / ${meta.questionCount}</span>
        <div class="timer-pill" id="live-q-timer">${meta.questionSeconds}</div>
      </div>
    </div>
    <div class="prog-track"><div class="prog-fill" style="width:${(i / meta.questionCount) * 100}%"></div></div>
    <div class="quiz-card" id="live-q-card">
      <div class="quiz-q-label">Sual ${i + 1}</div>
      <div class="quiz-q-text">${esc(q.text)}</div>
      ${liveAnswerInputHtml(q)}
    </div>
    <div id="live-answer-status" style="margin-top:14px;font-size:13px;color:var(--muted);text-align:center"></div>`;
}

function liveAnswerInputHtml(q){
  const L = ['A', 'B', 'C', 'D', 'E'];
  if(q.type === 'mc') return `<div class="quiz-mc-opts">${q.options.filter(o => o).map((o, i) =>
    `<div class="quiz-mc-opt" onclick="submitLiveAnswer({selectedOption:${i}}, this)"><div class="opt-ltr">${L[i]}</div><div class="opt-txt">${esc(o)}</div></div>`).join('')}</div>`;
  if(q.type === 'tf') return `<div class="quiz-tf-opts">
    <div class="quiz-tf-btn" onclick="submitLiveAnswer({tfAnswer:true}, this)">✓ Doğru</div>
    <div class="quiz-tf-btn" onclick="submitLiveAnswer({tfAnswer:false}, this)">✗ Yanlış</div>
  </div>`;
  if(q.type === 'short') return `<textarea id="live-short-inp" class="quiz-short-input" placeholder="Cavabınızı yazın…" style="width:100%;background:var(--surface2);border:2px solid var(--border);border-radius:12px;color:var(--text);font-family:'Nunito',sans-serif;font-size:14px;padding:13px 15px;outline:none;resize:vertical;min-height:80px"></textarea>
    <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="submitLiveShort()">Göndər</button>`;
  if(q.type === 'fill'){
    const rendered = (q.fillText || '').replace(/\[blank\]/gi, () => '<input class="blank-inp" type="text"/>');
    return `<div class="fill-text-render">${rendered}</div>
    <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="submitLiveFill()">Göndər</button>`;
  }
  return '';
}

function lockLiveAnswerUI(){
  document.querySelectorAll('.quiz-mc-opt,.quiz-tf-btn').forEach(el => { el.classList.add('locked'); el.onclick = null; });
  const btn = document.querySelector('#live-q-card .btn-primary');
  if(btn) btn.disabled = true;
}

function submitLiveAnswer(fields, el){
  if(liveAnswered) return;
  el?.classList.add('sel');
  writeLiveAnswer(fields);
}
function submitLiveShort(){
  if(liveAnswered) return;
  const val = (document.getElementById('live-short-inp')?.value || '').trim();
  if(!val) return;
  writeLiveAnswer({ shortAnswer: val.slice(0, 500) });
}
function submitLiveFill(){
  if(liveAnswered) return;
  const vals = [...document.querySelectorAll('.blank-inp')].map(i => i.value.trim());
  if(!vals.length || !vals.every(Boolean)) return;
  writeLiveAnswer({ fillAnswers: vals.map(v => v.slice(0, 200)) });
}

function writeLiveAnswer(fields){
  liveAnswered = true;
  lockLiveAnswerUI();
  const responseTimeMs = Math.max(0, serverNow() - liveQuestionStartedLocal);
  const data = { ...fields, responseTimeMs, submittedAt: firebase.database.ServerValue.TIMESTAMP };
  const status = document.getElementById('live-answer-status');
  if(status) status.textContent = '⏳ Göndərilir…';
  db.ref('live_rooms/' + livePin + '/answers/' + liveLastIndex + '/' + liveUid).set(data).then(() => {
    document.getElementById('live-game-wrap').innerHTML = liveGameMessageHtml('✅', 'Cavab göndərildi!', 'Digər tələbələri gözləyin…');
  }).catch(() => {
    liveAnswered = false;
    document.querySelectorAll('.quiz-mc-opt,.quiz-tf-btn').forEach(el => el.classList.remove('locked'));
    if(status) status.textContent = '⚠️ Göndərilmədi, yenidən cəhd edin.';
  });
}

function startLiveCountdown(meta){
  clearInterval(liveCountdownTimer);
  const total = meta.questionSeconds;
  const deadline = liveQuestionStartedLocal + total * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
    const pill = document.getElementById('live-q-timer');
    if(pill){ pill.textContent = left; pill.className = 'timer-pill' + liveTimerUrgencyClass(left, total); }
    if(left <= 0) clearInterval(liveCountdownTimer);
  };
  tick();
  liveCountdownTimer = setInterval(tick, 500);
}

// ── REVEAL ────────────────────────────────────────────
async function renderLiveReveal(){
  const i = liveLastIndex;
  const wrap = document.getElementById('live-game-wrap');
  wrap.innerHTML = liveGameMessageHtml('⏳', 'Nəticə yüklənir…', '');
  try{
    const [resSnap, scoreSnap] = await Promise.all([
      db.ref('live_rooms/' + livePin + '/results/' + i + '/' + liveUid).once('value'),
      db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/score').once('value')
    ]);
    const res = resSnap.val();
    const score = Number(scoreSnap.val()) || 0;
    const ok = res && res.correct;
    const pts = res ? (res.pointsEarned || 0) : 0;
    wrap.innerHTML = `<div class="lock-card" style="margin:0 auto;max-width:440px">
      <div class="lock-icon">${res ? (ok ? '✅' : '❌') : '⌛'}</div>
      <h2>${res ? (ok ? 'Düzgün!' : 'Səhv') : 'Cavab vermədiniz'}</h2>
      <p>${res && ok ? `+${pts} xal qazandınız.` : 'Bu sual üçün xal qazanmadınız.'}<br/>Ümumi xalınız: <strong>${score}</strong></p>
    </div>`;
  }catch(e){
    wrap.innerHTML = liveGameMessageHtml('⚠️', 'Nəticə yüklənmədi', 'Növbəti sualı gözləyin.');
  }
}

// ── FINISH ────────────────────────────────────────────
async function renderLiveFinished(meta){
  clearInterval(liveCountdownTimer);
  liveJoined = false;
  leaveFullscreen();
  const wrap = document.getElementById('live-game-wrap');
  wrap.innerHTML = liveGameMessageHtml('⏳', 'Yekun nəticələr yüklənir…', '');
  try{
    const snap = await db.ref('live_rooms/' + livePin + '/players').once('value');
    const players = snap.val() || {};
    const board = sortLeaderboard(Object.entries(players).map(([pid, p]) =>
      ({ uid: pid, name: (p.profile || {}).displayName || '?', score: p.score || 0 })));
    const myEntry = board.find(p => p.uid === liveUid);
    const rank = board.findIndex(p => p.uid === liveUid) + 1;
    const rest = board.slice(3, 10);
    wrap.innerHTML = `<div class="lock-card" style="margin:0 auto;max-width:460px">
      <div class="lock-icon">🏁</div>
      <h2>${esc(meta.topic || 'Canlı Oyun')} — Bitdi</h2>
      <p style="margin-bottom:16px">Sizin yeriniz: <strong>${rank || '—'} / ${board.length}</strong></p>
      ${livePodiumHtml(board, myEntry ? myEntry.name : undefined)}
      ${rest.map((p, idx) => `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);text-align:left;${p.uid === liveUid ? 'font-weight:700;color:var(--accent)' : ''}">
        <span>${idx + 4}. ${esc(p.name)}</span><strong>${p.score}</strong>
      </div>`).join('')}
    </div>`;
  }catch(e){
    wrap.innerHTML = liveGameMessageHtml('⚠️', 'Yekun nəticə yüklənmədi', '');
  }
}

// ── ANTI-CHEAT ────────────────────────────────────────
// Unlike exam mode above, a violation never ends the attempt early: it only flags the player so the
// host can see it in the live roster, since the host paces the game for everyone at once.
function writeLiveFlags(){
  if(!liveMonitor || !liveUid || !livePin) return;
  const m = liveMonitor.stats();
  db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/flags').update({
    tabSwitches: m.tabSwitches, timeAway: m.timeAway, pastes: m.pastes
  }).catch(() => {});
}
function markLiveFlagged(){
  if(!liveUid || !livePin) return;
  db.ref('live_rooms/' + livePin + '/players/' + liveUid + '/flags/flagged').set(true).catch(() => {});
}
function onLiveLeave(){
  if(!liveJoined || !liveMonitor) return;
  const r = liveMonitor.leave();
  if(!r) return;
  writeLiveFlags();
  if(r.reached) markLiveFlagged();
}
function onLiveReturn(){
  if(!liveJoined || !liveMonitor) return;
  const r = liveMonitor.back();
  if(!r) return;
  writeLiveFlags();
  showLiveLeaveWarning(r.count);
}

function showLiveLeaveWarning(count){
  document.getElementById('live-leave-warning')?.remove();
  const el = document.createElement('div');
  el.id = 'live-leave-warning';
  el.className = 'overlay';
  el.innerHTML = `<div class="modal" style="text-align:center">
    <div style="font-size:40px;margin-bottom:8px">⚠️</div>
    <h2>Xəbərdarlıq ${count}</h2>
    <p>Oyun səhifəsini tərk etdiniz. Bu müəllimə bildirilir.</p>
    <button class="btn btn-primary btn-full" onclick="document.getElementById('live-leave-warning').remove();enterFullscreen()">Davam et</button>
  </div>`;
  document.body.appendChild(el);
}

document.addEventListener('visibilitychange', () => { if(document.hidden) onLiveLeave(); else onLiveReturn(); });
window.addEventListener('blur', onLiveLeave);
window.addEventListener('focus', onLiveReturn);
window.addEventListener('pagehide', () => { if(liveJoined) writeLiveFlags(); });

document.addEventListener('paste', () => {
  if(!liveJoined || !liveMonitor) return;
  liveMonitor.paste();
  writeLiveFlags();
}, true);
['copy','cut','contextmenu'].forEach(type => document.addEventListener(type, e => {
  if(!liveJoined || !liveMonitor) return;
  if(!(e.target instanceof Element) || !e.target.closest('#live-game-wrap')) return;
  e.preventDefault();
  liveMonitor.copy();
}, true));
// Long-press selection and dragging on the live game, outside the answer fields.
['selectstart','dragstart'].forEach(type => document.addEventListener(type, e => {
  if(!liveJoined) return;
  if(!(e.target instanceof Element) || !e.target.closest('#live-game-view') || e.target.closest('textarea,input')) return;
  e.preventDefault();
}, true));

// Same phone-assistant-overlay fallback as exam mode: two missed-focus polls in a row (~1s) count
// as a leave, so a brief system popup or keyboard switch is not mistaken for one.
let liveUnfocusedPolls = 0;
setInterval(() => {
  if(!liveJoined || !liveMonitor){ liveUnfocusedPolls = 0; return; }
  if(document.hasFocus()){ liveUnfocusedPolls = 0; onLiveReturn(); }
  else if(++liveUnfocusedPolls >= 2) onLiveLeave();
}, 500);

function onLiveFullscreenChange(){
  if(!liveJoined || !liveMonitor) return;
  if(document.fullscreenElement || document.webkitFullscreenElement) return;
  onLiveLeave();
  onLiveReturn();
}
document.addEventListener('fullscreenchange', onLiveFullscreenChange);
document.addEventListener('webkitfullscreenchange', onLiveFullscreenChange);
