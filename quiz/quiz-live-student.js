'use strict';

// Player side of the Kahoot-style live game mode. Separate from quiz-student.js (single-player
// exam mode): host-paced, one answer per question, no resume-after-refresh, no fullscreen lock.

let pin = '', uid = '', displayName = '';
let serverOffset = 0;
let roomMetaRef = null;
let lastIndex = -1;
let currentQuestion = null, questionStartedLocal = 0;
let answered = false, monitor = null, leaveLimit = 0;
let countdownTimer = null;

// Students sign in anonymously so the database rules can tie each player record to its owner.
const authReady = new Promise(resolve => {
  auth.onAuthStateChanged(u => {
    if(u) resolve(u);
    else auth.signInAnonymously().catch(e => console.warn('anonymous sign-in failed', e.code));
  });
});

function serverNow(){ return Date.now() + serverOffset; }
function esc(s){ return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

(function init(){
  const p = new URLSearchParams(location.search).get('pin');
  if(p) document.getElementById('join-pin-inp').value = p.replace(/\D/g, '').slice(0, 6);
})();

// ── JOIN ──────────────────────────────────────────────────────────────────
function showJoinError(msg){
  const err = document.getElementById('join-error');
  err.textContent = msg;
  err.style.display = 'block';
}

async function joinLiveRoom(){
  const pinVal = (document.getElementById('join-pin-inp').value || '').trim();
  const nameVal = (document.getElementById('join-name-inp').value || '').trim();
  document.getElementById('join-error').style.display = 'none';
  if(!/^[0-9]{6}$/.test(pinVal)){ showJoinError('PIN 6 rəqəm olmalıdır.'); return; }
  if(!nameVal){ showJoinError('Zəhmət olmasa adınızı daxil edin.'); return; }

  const btn = document.getElementById('join-btn');
  btn.disabled = true; btn.textContent = '⏳ Yoxlanılır…';
  try{
    const snap = await db.ref('live_rooms/' + pinVal + '/meta').once('value');
    const meta = snap.val();
    if(!meta){ showJoinError('Bu kodla oyun tapılmadı.'); return; }
    if(meta.status === 'FINISHED'){ showJoinError('Bu oyun artıq bitib.'); return; }
    if(meta.status !== 'LOBBY'){ showJoinError('Oyun artıq başlayıb. Müəllimdən yeni oyun gözləyin.'); return; }

    const user = await authReady;
    uid = user.uid; pin = pinVal; displayName = nameVal; leaveLimit = Number(meta.leaveLimit) || 0;

    await db.ref('live_rooms/' + pin + '/players/' + uid + '/profile').set({
      displayName, joinedAt: firebase.database.ServerValue.TIMESTAMP, connected: true
    });
    db.ref('live_rooms/' + pin + '/players/' + uid + '/profile/connected').onDisconnect().set(false);

    const offsetSnap = await db.ref('.info/serverTimeOffset').once('value');
    serverOffset = Number(offsetSnap.val()) || 0;
    monitor = leaveLimit > 0 ? createMonitor(leaveLimit) : null;

    showView('game-view');
    attachRoomListener();
  }catch(e){
    showJoinError('Qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.');
  }finally{
    btn.disabled = false; btn.textContent = '▶ Qoşul';
  }
}

// ── ROOM STATE ────────────────────────────────────────────────────────────
function attachRoomListener(){
  roomMetaRef = db.ref('live_rooms/' + pin + '/meta');
  roomMetaRef.on('value', snap => {
    const meta = snap.val();
    if(!meta){ renderGameMessage('🚫', 'Oyun bitdi', 'Müəllim otağı silib.'); detachRoomListener(); return; }
    handleMetaUpdate(meta);
  });
}

function detachRoomListener(){
  if(roomMetaRef) roomMetaRef.off();
  roomMetaRef = null;
  clearInterval(countdownTimer);
}

// Every fire of this listener is a genuine state transition (status/currentIndex only ever change
// together, written in one update by the host), so a full re-render each time is safe and simple.
function handleMetaUpdate(meta){
  clearInterval(countdownTimer);
  if(meta.status === 'LOBBY') renderWaiting(meta);
  else if(meta.status === 'QUESTION'){ answered = false; loadAndRenderQuestion(meta); }
  else if(meta.status === 'REVEAL') renderReveal(meta);
  else renderFinished(meta);
}

function gameMessageHtml(icon, title, sub){
  return `<div class="lock-card" style="margin:0 auto;max-width:460px">
    <div class="lock-icon">${icon}</div>
    <h2>${title}</h2>
    <p>${sub}</p>
  </div>`;
}
function renderGameMessage(icon, title, sub){
  document.getElementById('game-wrap').innerHTML = gameMessageHtml(icon, title, sub);
}

function renderWaiting(meta){
  renderGameMessage('⏳', esc(meta.topic || 'Canlı Oyun'), `Salam, ${esc(displayName)}! Oyun başlayana qədər gözləyin…`);
}

// ── QUESTION ──────────────────────────────────────────────────────────────
async function loadAndRenderQuestion(meta){
  const i = meta.currentIndex;
  lastIndex = i;
  try{
    const snap = await db.ref('live_rooms/' + pin + '/questions/' + i).once('value');
    currentQuestion = snap.val();
  }catch(e){
    currentQuestion = null;
  }
  questionStartedLocal = meta.questionStartedAt || Date.now();
  renderQuestion(meta, i);
  startCountdown(meta);
}

function renderQuestion(meta, i){
  const q = currentQuestion;
  const wrap = document.getElementById('game-wrap');
  if(!q){ wrap.innerHTML = gameMessageHtml('⚠️', 'Sual yüklənmədi', 'Səhifəni yeniləyin.'); return; }
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

function lockAnswerUI(){
  document.querySelectorAll('.quiz-mc-opt,.quiz-tf-btn').forEach(el => { el.classList.add('locked'); el.onclick = null; });
  const btn = document.querySelector('#live-q-card .btn-primary');
  if(btn) btn.disabled = true;
}

function submitLiveAnswer(fields, el){
  if(answered) return;
  el?.classList.add('sel');
  writeLiveAnswer(fields);
}
function submitLiveShort(){
  if(answered) return;
  const val = (document.getElementById('live-short-inp')?.value || '').trim();
  if(!val) return;
  writeLiveAnswer({ shortAnswer: val.slice(0, 500) });
}
function submitLiveFill(){
  if(answered) return;
  const vals = [...document.querySelectorAll('.blank-inp')].map(i => i.value.trim());
  if(!vals.length || !vals.every(Boolean)) return;
  writeLiveAnswer({ fillAnswers: vals.map(v => v.slice(0, 200)) });
}

function writeLiveAnswer(fields){
  answered = true;
  lockAnswerUI();
  const responseTimeMs = Math.max(0, serverNow() - questionStartedLocal);
  const data = { ...fields, responseTimeMs, submittedAt: firebase.database.ServerValue.TIMESTAMP };
  const status = document.getElementById('live-answer-status');
  if(status) status.textContent = '⏳ Göndərilir…';
  db.ref('live_rooms/' + pin + '/answers/' + lastIndex + '/' + uid).set(data).then(() => {
    if(status) status.textContent = '✓ Cavab göndərildi. Növbəti addımı gözləyin…';
  }).catch(() => {
    answered = false;
    document.querySelectorAll('.quiz-mc-opt,.quiz-tf-btn').forEach(el => el.classList.remove('locked'));
    if(status) status.textContent = '⚠️ Göndərilmədi, yenidən cəhd edin.';
  });
}

function startCountdown(meta){
  clearInterval(countdownTimer);
  const deadline = questionStartedLocal + meta.questionSeconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - serverNow()) / 1000));
    const pill = document.getElementById('live-q-timer');
    if(pill) pill.textContent = left;
    if(left <= 0) clearInterval(countdownTimer);
  };
  tick();
  countdownTimer = setInterval(tick, 500);
}

// ── REVEAL ────────────────────────────────────────────────────────────────
async function renderReveal(){
  const i = lastIndex;
  const wrap = document.getElementById('game-wrap');
  wrap.innerHTML = gameMessageHtml('⏳', 'Nəticə yüklənir…', '');
  try{
    const [resSnap, scoreSnap] = await Promise.all([
      db.ref('live_rooms/' + pin + '/results/' + i + '/' + uid).once('value'),
      db.ref('live_rooms/' + pin + '/players/' + uid + '/score').once('value')
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
    wrap.innerHTML = gameMessageHtml('⚠️', 'Nəticə yüklənmədi', 'Növbəti sualı gözləyin.');
  }
}

// ── FINISH ────────────────────────────────────────────────────────────────
async function renderFinished(meta){
  clearInterval(countdownTimer);
  const wrap = document.getElementById('game-wrap');
  wrap.innerHTML = gameMessageHtml('⏳', 'Yekun nəticələr yüklənir…', '');
  try{
    const snap = await db.ref('live_rooms/' + pin + '/players').once('value');
    const players = snap.val() || {};
    const board = sortLeaderboard(Object.entries(players).map(([pid, p]) =>
      ({ uid: pid, name: (p.profile || {}).displayName || '?', score: p.score || 0 })));
    const rank = board.findIndex(p => p.uid === uid) + 1;
    wrap.innerHTML = `<div class="lock-card" style="margin:0 auto;max-width:460px">
      <div class="lock-icon">🏁</div>
      <h2>${esc(meta.topic || 'Canlı Oyun')} — Bitdi</h2>
      <p style="margin-bottom:16px">Sizin yeriniz: <strong>${rank || '—'} / ${board.length}</strong></p>
      ${board.slice(0, 10).map((p, idx) => `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);text-align:left;${p.uid === uid ? 'font-weight:700;color:var(--accent)' : ''}">
        <span>${idx + 1}. ${esc(p.name)}</span><strong>${p.score}</strong>
      </div>`).join('')}
    </div>`;
  }catch(e){
    wrap.innerHTML = gameMessageHtml('⚠️', 'Yekun nəticə yüklənmədi', '');
  }
}

// ── ANTI-CHEAT ────────────────────────────────────────────────────────────
// Unlike exam mode, a violation never ends the attempt early: it only flags the player so the
// host can see it in the live roster, since the host paces the game for everyone at once.
function writeLiveFlags(){
  if(!monitor || !uid || !pin) return;
  const m = monitor.stats();
  db.ref('live_rooms/' + pin + '/players/' + uid + '/flags').update({
    tabSwitches: m.tabSwitches, timeAway: m.timeAway, pastes: m.pastes
  }).catch(() => {});
}
function markLiveFlagged(){
  if(!uid || !pin) return;
  db.ref('live_rooms/' + pin + '/players/' + uid + '/flags/flagged').set(true).catch(() => {});
}
function onLiveLeave(){
  if(!monitor) return;
  const r = monitor.leave();
  if(!r) return;
  writeLiveFlags();
  if(r.reached) markLiveFlagged();
}
function onLiveReturn(){
  if(!monitor) return;
  const r = monitor.back();
  if(!r) return;
  writeLiveFlags();
}
document.addEventListener('visibilitychange', () => { document.hidden ? onLiveLeave() : onLiveReturn(); });
window.addEventListener('blur', onLiveLeave);
window.addEventListener('focus', onLiveReturn);
document.addEventListener('paste', () => {
  if(!monitor) return;
  monitor.paste();
  writeLiveFlags();
}, true);

// ── UTILS ─────────────────────────────────────────────────────────────────
function showView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
