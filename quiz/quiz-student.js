'use strict';

const STORAGE_KEY_STUDENT   = 'qc_student_qs';
const MAX_QUESTIONS         = 30;
let EXAM_SECONDS            = 30 * 60;

let quizQs = [], quizIdx = 0, quizAns = {}, topicName = '', studentName = '', examKey = '';
let totalTimer = null, timeLeft = EXAM_SECONDS, answered = false;
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

// Fisher–Yates; sorting with a random comparator does not shuffle evenly.
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The running exam is kept in localStorage so a refresh resumes it instead of restarting it.
function persistState(){
  if(!examActive || !attemptId) return;
  try{
    localStorage.setItem(STORAGE_KEY_ATTEMPT, JSON.stringify({
      v: 2, attemptId, attemptCreated, examKey, examVersion, topicName, studentName, quizQs, quizAns, quizIdx,
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

// ── INIT ──────────────────────────────────────────────
(function init(){
  // Old versions cached the last published exam here and showed it when none was active.
  try{ localStorage.removeItem(STORAGE_KEY_STUDENT); }catch(e){}
  const saved = loadSavedAttempt();
  if(saved){ resumeExam(saved); return; }

  // Show loading state while fetching from Firebase
  document.getElementById('lobby-view').innerHTML=`
    <div class="lock-card" style="max-width:460px">
      <div class="lock-icon">⏳</div>
      <h2>Yüklənir…</h2>
      <p style="font-size:13px;color:var(--text2)">Test məlumatları alınır</p>
    </div>`;
  showView('lobby-view');

  db.ref('student_quiz').once('value')
    .then(snapshot=>{
      const val = snapshot.val();
      if(!val){ showNoQuiz(); return; }
      const exams = Object.entries(val)
        .map(([key,data])=>({key,...data}))
        .filter(e=>e.questions&&e.questions.length);
      if(!exams.length){ showNoQuiz(); return; }
      if(exams.length===1){
        examKey      = exams[0].key;
        quizQs       = exams[0].questions;
        topicName    = exams[0].topic||'';
        EXAM_SECONDS = (exams[0].examMinutes||30)*60;
        leaveLimit   = readLeaveLimit(exams[0]);
        examVersion  = exams[0].publishedAt || 0;
        showLobby();
      } else {
        showExamList(exams);
      }
    })
    .catch(showLoadError);
})();

function showNoQuiz(){
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">📭</div>
      <h2>Aktiv Test Yoxdur</h2>
      <p>Hazırda aktiv test yoxdur. Müəllim test göndərdikdə bu səhifədə görünəcək.</p>
      <button class="btn btn-ghost btn-full" onclick="location.reload()">↻ Yenilə</button>
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
          <div style="font-size:11px;color:var(--muted)">${e.questions.length} sual</div>
        </button>
      `).join('')}
    </div>`;
  showView('lobby-view');
}

function selectExam(idx){
  const e = _examList[idx];
  examKey      = e.key;
  quizQs       = e.questions;
  topicName    = e.topic||e.key;
  EXAM_SECONDS = (e.examMinutes||30)*60;
  leaveLimit   = readLeaveLimit(e);
  examVersion  = e.publishedAt || 0;
  showLobby();
}

function showLobby(){
  const count = Math.min(quizQs.length, MAX_QUESTIONS);
  const notice = leaveLimit > 0 ? `
      <p style="font-size:12px;color:var(--wrong);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px;margin-bottom:16px;line-height:1.6;text-align:left">
        ⚠ Diqqət: Bu səhifədən çıxmaq (başqa tab və ya pəncərə) qeydə alınır. ${leaveLimit} dəfə çıxsanız və ya brauzeri bağlasanız, imtahan avtomatik göndəriləcək.
      </p>` : '';
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card" style="max-width:460px">
      <div class="lock-icon">📝</div>
      <h2 id="lobby-topic">${esc(topicName||'İmtahan')}</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:6px">
        Suallar: <strong>${count}</strong> &nbsp;·&nbsp; Vaxt: <strong>${Math.round(EXAM_SECONDS/60)} dəqiqə</strong>
      </p>
      <p style="font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.7">
        Suallar və cavablar avtomatik qarışdırılacaq.<br/>
        Vaxt bitdikdə test avtomatik göndəriləcək.
      </p>
      ${notice}
      <input type="text" id="student-name-inp" placeholder="Adınızı daxil edin…" style="margin-bottom:14px" maxlength="60"/>
      <button class="btn btn-primary btn-full" onclick="startExam()">▶ İmtahana Başla</button>
    </div>`;
  showView('lobby-view');
}

// ── START ─────────────────────────────────────────────
function startExam(){
  studentName = (document.getElementById('student-name-inp')?.value || '').trim() || 'Anonim';
  // Shuffle all questions, pick up to 30
  let pool = shuffle(JSON.parse(JSON.stringify(quizQs))).slice(0, MAX_QUESTIONS);

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
  answered = quizAns[quizQs[quizIdx]?.id] !== undefined;
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
    body = `<textarea class="quiz-short-input" id="short-inp" placeholder="Cavabınızı buraya yazın…" style="width:100%;background:var(--surface2);border:2px solid var(--border);border-radius:12px;color:var(--text);font-family:'Nunito',sans-serif;font-size:14px;padding:13px 15px;outline:none;resize:vertical;min-height:80px;transition:border-color .2s"></textarea>
    <div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="submitShort(${q.id})">Cavabı Göndər</button></div>`;
  } else if(q.type === 'fill'){
    const rendered = (q.fillText||'').replace(/\[blank\]/gi, () => `<input class="blank-inp" type="text"/>`);
    body = `<div class="fill-text-render">${rendered}</div>
    <div style="margin-top:16px"><button class="btn btn-primary btn-sm" onclick="submitFill(${q.id})">Cavabı Göndər</button></div>`;
  }
  return `<div class="quiz-card" id="quiz-card-main">
    <div class="quiz-q-label">Sual ${quizIdx+1} / ${quizQs.length}</div>
    <div class="quiz-q-text">${esc(q.text)}</div>
    ${body}
  </div>`;
}

// Answers are stored exactly as the student gave them. This page never knows which answer is
// correct: the key lives in a teacher-only database node and the teacher panel does the grading.
function markMC(idx){
  document.querySelectorAll('.quiz-mc-opt').forEach((el,i)=>{
    el.classList.add('locked'); el.onclick = null;
    if(i === idx) el.classList.add('sel');
  });
}

function pickMC(qid, idx){
  if(answered) return;
  const q = quizQs.find(q=>q.id===qid);
  answered = true;
  quizAns[qid] = q.order[idx];   // stored as the option's position in the teacher's original list
  markMC(idx);
  onAnswered();
}

function markTF(val){
  const tEl = document.getElementById('tf-t'), fEl = document.getElementById('tf-f');
  tEl.classList.add('locked'); fEl.classList.add('locked');
  tEl.onclick = null; fEl.onclick = null;
  (val ? tEl : fEl).classList.add('sel');
}

function pickTF(qid, val){
  if(answered) return;
  answered = true;
  quizAns[qid] = val;
  markTF(val);
  onAnswered();
}

function lockShort(inp){ if(inp){ inp.style.borderColor = 'var(--accent)'; inp.readOnly = true; } }

function submitShort(qid){
  if(answered) return;
  const inp = document.getElementById('short-inp');
  const val = (inp?.value||'').trim();
  if(!val) return;
  answered = true;
  quizAns[qid] = val.slice(0, 500);
  lockShort(inp);
  onAnswered();
}

function lockFill(inps){ inps.forEach(i=>{ i.classList.add('sel'); i.readOnly = true; }); }

function submitFill(qid){
  if(answered) return;
  const inps = [...document.querySelectorAll('.blank-inp')];
  const vals = inps.map(i=>i.value.trim());
  if(vals.some(v=>!v)) return;
  answered = true;
  quizAns[qid] = vals.map(v=>v.slice(0, 200));
  lockFill(inps);
  onAnswered();
}

function onAnswered(){ saveAttempt('in_progress'); }

function restoreAns(q, saved){
  answered = true;
  if(q.type==='mc'){
    markMC((q.order||[]).indexOf(saved));
  } else if(q.type==='tf'){
    markTF(saved);
  } else if(q.type==='short'){
    const inp=document.getElementById('short-inp');
    if(inp) inp.value=saved||'';
    lockShort(inp);
  } else if(q.type==='fill'&&Array.isArray(saved)){
    const inps=[...document.querySelectorAll('.blank-inp')];
    saved.forEach((v,i)=>{ if(inps[i]) inps[i].value=v; });
    lockFill(inps);
  }
}

function nextQ(){
  if(quizIdx < quizQs.length-1){ quizIdx++; renderQuizQ(); }
  else finishQuiz();
}
function prevQ(){ if(quizIdx > 0){ quizIdx--; renderQuizQ(); } }

// ── RESULTS ───────────────────────────────────────────
function answeredCount(){ return quizQs.filter(q => quizAns[q.id] !== undefined).length; }

// Writes only raw answers and server-stamped times. Scores are worked out in the teacher panel.
// The first save creates the record (with startedAt); later saves update it without touching startedAt.
function saveAttempt(status){
  if(!attemptId) return;
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
    authReady
      .then(u => {
        data.uid = u.uid;
        return first ? db.ref(path).set({ ...data, startedAt: SERVER_TIME }) : db.ref(path).update(data);
      })
      .catch(e => {
        if(first) attemptCreated = false;
        console.warn('saving attempt failed', e.code || e);
      });
  }catch(e){}
}

function finishQuiz(){
  clearInterval(totalTimer);
  examActive = false;
  clearSavedAttempt();
  document.getElementById('leave-warning')?.remove();
  document.getElementById('result-sub').textContent =
    `${answeredCount()} / ${quizQs.length} suala cavab verdiniz. Nəticələr müəllim tərəfindən elan olunacaq.`;
  const autoEl = document.getElementById('result-auto');
  autoEl.style.display = autoReason === 'leaves' ? 'block' : 'none';
  autoEl.textContent = 'İmtahan səhifəsini çox dəfə tərk etdiyiniz üçün avtomatik göndərildi.';
  saveAttempt('done');

  showView('results-view');
}

function exitQuiz(){
  examActive = false;
  if(!confirm('İmtahandan çıxmaq istəyirsiniz? İmtahan bitmiş sayılacaq.')){ examActive = true; return; }
  clearInterval(totalTimer);
  saveAttempt('exited');
  clearSavedAttempt();
  attemptId = '';
  quizAns = {};
  showLobby();
}

// ── RESUME AFTER REFRESH ──────────────────────────────
// A refresh counts as one page leave, so it cannot be used to dodge the limit.
function resumeExam(s){
  examKey = s.examKey; examVersion = s.examVersion || 0; attemptCreated = !!s.attemptCreated;
  topicName = s.topicName; studentName = s.studentName;
  quizQs = s.quizQs; quizAns = s.quizAns || {}; quizIdx = s.quizIdx || 0;
  EXAM_SECONDS = s.examSeconds; leaveLimit = s.leaveLimit;
  attemptId = s.attemptId; startedAt = s.startedAt; autoReason = null;
  timeLeft = EXAM_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
  monitor = leaveLimit > 0 ? createMonitor(leaveLimit, null, s.monitor || undefined) : null;
  examActive = true;

  if(timeLeft <= 0){ finishQuiz(); return; }
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
    <button class="btn btn-primary btn-full" onclick="document.getElementById('leave-warning').remove()">Davam et</button>
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

// ── UTILS ─────────────────────────────────────────────
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function esc(s){ return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
