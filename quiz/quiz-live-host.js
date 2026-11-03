'use strict';

// Host side of the Kahoot-style live game mode: a new "Canlı Oyun" tab in the teacher panel
// (quiz-az.html / quiz-az.js). Draws into the same #questions-container the question editor and
// Analytics tab already share (see switchTab in quiz-az.js), following that existing convention.
// Reuses: `questions`/`publishedTopics`/`refreshPublishedTopics`/`normalizeImportedQuestion` (quiz-az.js /
// quiz-backup.js), `db`/`auth` (firebase-config.js), `esc`/`shuffleList` (quiz-az.js),
// `isCorrectAnswer`/`correctAnswerText`/`questionProblems`/`publicQuestion`/`answerKeyEntry` (quiz-grading.js),
// `generatePin`/`liveScore`/`sortLeaderboard` (quiz-live.js).

const LIVE_MAX_QUESTIONS   = 30;
const LIVE_DEFAULT_SECONDS = 20;
const LIVE_STORAGE_KEY     = 'qc_live_room';
const LIVE_OPT_LETTERS     = ['A', 'B', 'C', 'D', 'E'];

let liveShown         = false;  // the live screen is currently drawn where the question editor normally is
let liveRoomPin        = null;
let liveMeta           = null;
let livePlayersMap     = {};
let liveAnswersMap     = {};    // answers/{currentIndex} of the question currently on screen
let liveQuestions      = [];    // public shape, in-memory copy used for rendering
let liveAnswerKeyMap   = {};    // id -> answerKeyEntry, in-memory copy used for scoring
let liveLastRevealStats = null;

let liveMetaRef = null, liveRoomPlayersRef = null, liveAnswersRef = null, liveAnswersHandler = null;
let liveQuestionTimer = null;

// ── ENTRY POINT (called by switchTab('live') in quiz-az.js) ─────────────────
function renderLiveTab(){
  liveShown = true;
  document.getElementById('questions-container').classList.remove('hidden');
  if(liveRoomPin){ renderLiveRoom(); return; }
  const saved = loadLiveRoomMarker();
  if(!saved){ refreshPublishedTopics(renderLiveTopicPicker); return; }
  document.getElementById('questions-container').innerHTML =
    '<div class="analytics-empty"><div style="font-size:32px;margin-bottom:12px">⏳</div><p>Canlı oyun yoxlanılır…</p></div>';
  db.ref('live_rooms/' + saved.pin + '/meta').once('value').then(snap => {
    const meta = snap.val();
    if(meta && meta.status !== 'FINISHED') resumeLiveRoom(saved.pin);
    else { clearLiveRoomMarker(); refreshPublishedTopics(renderLiveTopicPicker); }
  }).catch(() => refreshPublishedTopics(renderLiveTopicPicker));
}

// ── TOPIC PICKER ──────────────────────────────────────────────────────────
// Same topic universe as the Mövzular tab: questions loaded into this browser's editor, plus
// topics published from any device (publishedTopics, refreshed just before this renders).
function liveTopicOptions(){
  const localTopics = new Set(questions.map(q => q.topic?.trim()).filter(Boolean));
  const remoteTopics = Object.keys(publishedTopics);
  const all = [...new Set([...localTopics, ...remoteTopics])];
  return all.map(t => ({
    topic: t,
    count: localTopics.has(t) ? questions.filter(q => q.topic?.trim() === t).length : (publishedTopics[t]?.count || '?'),
    remote: !localTopics.has(t)
  }));
}

// The question-count input's max tracks whichever topic is selected (capped at LIVE_MAX_QUESTIONS,
// since that's also what the database rules allow for a room's questionCount).
function liveTopicCountCap(topics, topic){
  const t = topics.find(x => x.topic === topic);
  return Math.max(1, Math.min(LIVE_MAX_QUESTIONS, Number(t?.count) || LIVE_MAX_QUESTIONS));
}
function onLiveTopicChange(){
  const topics = liveTopicOptions();
  const topic = document.getElementById('live-topic-select')?.value;
  const cap = liveTopicCountCap(topics, topic);
  const input = document.getElementById('live-count-input');
  if(!input) return;
  input.max = cap;
  if(Number(input.value) > cap || !input.value) input.value = cap;
}

function renderLiveTopicPicker(){
  const topics = liveTopicOptions();
  const main = document.getElementById('questions-container');
  const firstCap = topics.length ? liveTopicCountCap(topics, topics[0].topic) : LIVE_MAX_QUESTIONS;
  main.innerHTML = `
    <div style="padding:28px;max-width:560px;margin:0 auto">
      <h2 style="margin-bottom:6px">Canlı Oyun</h2>
      <p style="font-size:13px;color:var(--text2);margin-bottom:20px">Bir mövzu seçin, tələbələr PIN və ya QR kodla qoşulsun, suallar canlı göstərilsin.</p>
      ${topics.length ? `
        <div style="margin-bottom:16px">
          <label class="field-lbl">Mövzu</label>
          <select id="live-topic-select" style="width:100%" onchange="onLiveTopicChange()">
            ${topics.map(t => `<option value="${esc(t.topic)}">${esc(t.topic)} (${t.count} sual${t.remote ? ' · serverdə' : ''})</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:16px">
          <label class="field-lbl">Sual sayı (max ${LIVE_MAX_QUESTIONS})</label>
          <input type="number" id="live-count-input" min="1" max="${firstCap}" value="${Math.min(firstCap, 20)}" style="width:100%"/>
        </div>
        <div style="margin-bottom:20px">
          <label class="field-lbl">Sual üçün vaxt (saniyə)</label>
          <input type="number" id="live-seconds-input" min="5" max="300" value="${LIVE_DEFAULT_SECONDS}" style="width:100%"/>
        </div>
        <button class="btn btn-primary btn-full" onclick="startLiveGame()">▶ Canlı Oyun Başlat</button>
      ` : '<div style="font-size:13px;color:var(--muted)">Hələ heç bir mövzuda sual yoxdur. Əvvəlcə Suallar bölməsində sual əlavə edin, ya da bir mövzu göndərin.</div>'}
      <div id="live-history-list" style="margin-top:28px"></div>
    </div>`;
  renderLiveHistoryList();
}

// ── HISTORY (a record of each finished game, written once by finishLiveRoom) ──────────────
function renderLiveHistoryList(){
  const el = document.getElementById('live-history-list');
  if(!el) return;
  el.innerHTML = '<div style="font-size:11px;color:var(--muted)">⏳ Keçmiş oyunlar yüklənir…</div>';
  db.ref('live_history').limitToLast(10).once('value').then(snap => {
    const el2 = document.getElementById('live-history-list');
    if(!el2) return; // the teacher navigated to another tab while this was loading
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, h]) => ({ id, ...h })).sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
    if(!list.length){ el2.innerHTML = ''; return; }
    el2.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Son Oyunlar</div>
      ${list.map(liveHistoryRowHtml).join('')}`;
  }).catch(() => { const el2 = document.getElementById('live-history-list'); if(el2) el2.innerHTML = ''; });
}

function liveHistoryRowHtml(h){
  const top = (h.leaderboard || [])[0];
  const when = new Date(h.finishedAt || h.createdAt || 0).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `<div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
    <div>
      <div style="font-size:13px;font-weight:600">${esc(h.topic || '')}</div>
      <div style="font-size:11px;color:var(--muted)">${esc(when)} · ${h.playerCount || 0} tələbə${top ? ' · 🥇 ' + esc(top.name) + ' (' + top.score + ')' : ''}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 8px" data-id="${esc(h.id)}" onclick="showLiveHistoryDetail(this.dataset.id)">Bax</button>
      <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:4px 8px;color:var(--wrong)" data-id="${esc(h.id)}" onclick="deleteLiveHistory(this.dataset.id)">🗑</button>
    </div>
  </div>`;
}

function showLiveHistoryDetail(id){
  db.ref('live_history/' + id).once('value').then(snap => {
    const h = snap.val();
    if(!h) return;
    const board = h.leaderboard || [];
    document.getElementById('live-history-modal')?.remove();
    const el = document.createElement('div');
    el.id = 'live-history-modal';
    el.className = 'overlay';
    el.innerHTML = `<div class="modal" style="max-width:420px">
      <h2 style="margin-bottom:4px">${esc(h.topic || '')}</h2>
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px">${h.playerCount || 0} tələbə · ${h.questionCount || 0} sual</p>
      ${board.length ? board.map((p, idx) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);text-align:left"><span>${idx + 1}. ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join('') : '<div style="font-size:12px;color:var(--muted)">Nəticə yoxdur.</div>'}
      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="document.getElementById('live-history-modal').remove()">Bağla</button>
    </div>`;
    document.body.appendChild(el);
  });
}

function deleteLiveHistory(id){
  if(!confirm('Bu qeyd silinsin?')) return;
  db.ref('live_history/' + id).remove().then(renderLiveHistoryList).catch(() => {});
}

// Local editor questions for this topic if it's loaded here; otherwise its published questions +
// answers, fetched from the server (same source loadTopicFromServer uses) without touching the editor.
async function fetchLiveTopicQuestions(topic){
  const localQs = questions.filter(q => q.topic?.trim() === topic);
  if(localQs.length) return localQs;
  const info = publishedTopics[topic];
  if(!info) return [];
  let keyDoc = null;
  const version = (await db.ref('student_quiz/' + info.key + '/publishedAt').once('value')).val();
  if(version) keyDoc = (await db.ref('answer_keys/' + info.key + '/' + version).once('value')).val();
  if(!keyDoc){
    const all = (await db.ref('answer_keys/' + info.key).once('value')).val() || {};
    const newest = Object.keys(all).sort((a, b) => Number(b) - Number(a))[0];
    keyDoc = newest ? all[newest] : null;
  }
  const raw = keyDoc && keyDoc.questions;
  const list = !raw ? [] : (Array.isArray(raw) ? raw : Object.keys(raw).sort((a, b) => a - b).map(k => raw[k])).filter(Boolean);
  let tempId = 0;
  return list.map(normalizeImportedQuestion).filter(Boolean).map(q => ({ ...q, id: --tempId, topic }));
}

async function startLiveGame(){
  const topic = document.getElementById('live-topic-select')?.value;
  if(!topic) return;
  const seconds = Math.min(300, Math.max(5, parseInt(document.getElementById('live-seconds-input')?.value, 10) || LIVE_DEFAULT_SECONDS));
  const wantCount = Math.min(LIVE_MAX_QUESTIONS, Math.max(1, parseInt(document.getElementById('live-count-input')?.value, 10) || LIVE_MAX_QUESTIONS));
  const btn = document.querySelector('#questions-container .btn-primary');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Yüklənir…'; }

  const filtered = await fetchLiveTopicQuestions(topic).catch(() => []);
  if(!filtered.length){
    alert('Bu mövzunun sualları tapılmadı.');
    if(btn){ btn.disabled = false; btn.textContent = '▶ Canlı Oyun Başlat'; }
    return;
  }

  // Validated after picking, not the whole topic: a broken question elsewhere in a 150-question
  // bank shouldn't block a 20-question round that never includes it.
  const pool = shuffleList(filtered.slice()).slice(0, wantCount);
  const problems = pool.map((q, i) => ({ n: i + 1, list: questionProblems(q) })).filter(p => p.list.length);
  if(problems.length){
    alert(`Canlı oyun başlamadı. ${problems.length} sualı düzəltmək lazımdır:\n\n` +
      problems.slice(0, 8).map(p => `S${p.n}: ${p.list.join(', ')}`).join('\n') +
      (problems.length > 8 ? `\n… və daha ${problems.length - 8} sual` : ''));
    if(btn){ btn.disabled = false; btn.textContent = '▶ Canlı Oyun Başlat'; }
    return;
  }

  if(btn) btn.textContent = '⏳ Otaq yaradılır…';

  try{
    const pin = await reserveLivePin();
    const publicQs = pool.map(publicQuestion);
    const keyMap = Object.fromEntries(pool.map(q => [String(q.id), answerKeyEntry(q)]));
    const meta = {
      topic, status: 'LOBBY', currentIndex: 0, questionCount: publicQs.length,
      questionSeconds: seconds, leaveLimit: 3, createdAt: Date.now()
    };
    await db.ref('live_rooms/' + pin).set({ meta, questions: publicQs, answer_key: { questions: keyMap } });
    liveQuestions = publicQs;
    liveAnswerKeyMap = keyMap;
    saveLiveRoomMarker(pin);
    attachLiveRoom(pin);
  }catch(err){
    alert('Xəta: ' + err.message);
    if(btn){ btn.disabled = false; btn.textContent = '▶ Canlı Oyun Başlat'; }
  }
}

async function reserveLivePin(){
  for(let i = 0; i < 5; i++){
    const pin = generatePin();
    const snap = await db.ref('live_rooms/' + pin + '/meta').once('value');
    if(!snap.exists()) return pin;
  }
  throw new Error('PIN tapılmadı, yenidən cəhd edin.');
}

// ── ROOM RECOVERY (a teacher-panel reload mid-game rejoins instead of orphaning the room) ──
function resumeLiveRoom(pin){
  Promise.all([
    db.ref('live_rooms/' + pin + '/questions').once('value'),
    db.ref('live_rooms/' + pin + '/answer_key').once('value')
  ]).then(([qSnap, kSnap]) => {
    liveQuestions = liveQuestionListFrom(qSnap.val());
    liveAnswerKeyMap = (kSnap.val() || {}).questions || {};
    attachLiveRoom(pin);
  }).catch(() => { clearLiveRoomMarker(); renderLiveTopicPicker(); });
}

function liveQuestionListFrom(v){
  return Array.isArray(v) ? v : Object.keys(v || {}).sort((a, b) => a - b).map(k => v[k]);
}

function saveLiveRoomMarker(pin){ try{ localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify({ pin, createdAt: Date.now() })); }catch(e){} }
function loadLiveRoomMarker(){ try{ return JSON.parse(localStorage.getItem(LIVE_STORAGE_KEY) || 'null'); }catch(e){ return null; } }
function clearLiveRoomMarker(){ try{ localStorage.removeItem(LIVE_STORAGE_KEY); }catch(e){} }

// ── LISTENERS ─────────────────────────────────────────────────────────────
// A single meta + players listener stays attached for the room's whole life (independent of which
// sidebar tab is focused, so the per-question auto-reveal timer keeps running); only the per-question
// answers listener is swapped as the game moves from one question to the next.
function attachLiveRoom(pin){
  detachLiveRoom();
  liveRoomPin = pin;
  liveMetaRef = db.ref('live_rooms/' + pin + '/meta');
  liveMetaRef.on('value', handleLiveMetaSnapshot);
  liveRoomPlayersRef = db.ref('live_rooms/' + pin + '/players');
  liveRoomPlayersRef.on('value', snap => {
    livePlayersMap = snap.val() || {};
    if(!liveShown || !liveMeta) return;
    if(liveMeta.status === 'LOBBY') renderLivePlayerList();
    else if(liveMeta.status === 'QUESTION') updateLiveAnsweredCount();
  });
}

function handleLiveMetaSnapshot(snap){
  liveMeta = snap.val();
  if(!liveMeta){
    // Deleted from elsewhere (or never existed): fall back to the topic picker.
    detachLiveRoom();
    clearLiveRoomMarker();
    if(liveShown) renderLiveTopicPicker();
    return;
  }
  if(liveShown) renderLiveRoom();
}

function detachLiveAnswersListener(){
  if(liveAnswersRef && liveAnswersHandler) liveAnswersRef.off('value', liveAnswersHandler);
  liveAnswersRef = null; liveAnswersHandler = null;
}

function detachLiveRoom(){
  detachLiveAnswersListener();
  if(liveMetaRef) liveMetaRef.off('value', handleLiveMetaSnapshot);
  if(liveRoomPlayersRef) liveRoomPlayersRef.off();
  liveMetaRef = null; liveRoomPlayersRef = null;
  clearInterval(liveQuestionTimer);
  liveRoomPin = null; liveMeta = null; livePlayersMap = {}; liveAnswersMap = {};
}

// ── ROOM STATE → SCREEN ──────────────────────────────────────────────────
function renderLiveRoom(){
  if(!liveMeta) return;
  if(liveMeta.status === 'LOBBY') renderLiveLobby();
  else if(liveMeta.status === 'QUESTION') renderLiveQuestionActive();
  else if(liveMeta.status === 'REVEAL') renderLiveReveal();
  else renderLiveFinished();
}

// ── LOBBY ─────────────────────────────────────────────────────────────────
function renderLiveLobby(){
  detachLiveAnswersListener();
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto;text-align:center">
      <div style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${esc(liveMeta.topic)}</div>
      <div style="font-size:48px;font-weight:800;letter-spacing:.08em;font-family:'DM Mono',monospace;margin-bottom:6px">${esc(liveRoomPin)}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:20px">Tələbələr quiz-student.html səhifəsində "Canlı Oyun"u seçib bu kodu daxil etsin, və ya QR kodu skan etsin.</div>
      <div id="live-qr" style="display:inline-block;padding:12px;background:#fff;border-radius:12px;margin-bottom:20px"></div>
      <div id="live-player-list" style="text-align:left;margin-bottom:20px"></div>
      <button class="btn btn-primary btn-full" id="live-start-btn" onclick="launchLiveQuestion(0)" disabled>▶ Oyunu Başlat</button>
      <button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="deleteLiveRoom()">🗑 Otağı Sil</button>
    </div>`;
  renderLiveQr();
  renderLivePlayerList();
}

function renderLiveQr(){
  const el = document.getElementById('live-qr');
  if(!el || typeof QRCode === 'undefined') return;
  el.innerHTML = '';
  try{ new QRCode(el, { text: liveJoinUrl(liveRoomPin), width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); }catch(e){}
}

function liveJoinUrl(pin){
  return location.href.replace(/[^/]*$/, '') + 'quiz-student.html?mode=live&pin=' + pin;
}

function renderLivePlayerList(){
  const el = document.getElementById('live-player-list');
  if(!el) return;
  const list = Object.entries(livePlayersMap)
    .map(([uid, p]) => ({ uid, ...(p.profile || {}), flagged: !!(p.flags && p.flags.flagged) }))
    .filter(p => p.displayName);
  document.getElementById('live-start-btn')?.toggleAttribute('disabled', list.length === 0);
  el.innerHTML = list.length
    ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${list.length} tələbə qoşulub</div>` +
      list.map(p => `<span class="an-badge" style="margin:3px;background:var(--surface2);border:1px solid var(--border);color:var(--text);display:inline-flex;align-items:center;gap:6px">
        ${esc(p.displayName)}${p.flagged ? ' ⚠' : ''}
        <button data-uid="${esc(p.uid)}" onclick="kickLivePlayer(this.dataset.uid)" title="Oyundan çıxar" style="background:none;border:none;color:var(--wrong);cursor:pointer;font-size:13px;padding:0;line-height:1">✕</button>
      </span>`).join('')
    : '<div style="font-size:12px;color:var(--muted)">Hələ heç kim qoşulmayıb…</div>';
}

// Kick is only offered from the lobby (the roster shown here) - once the game starts, the screen
// switches to the question/reveal views and there is no persistent roster to kick from.
function kickLivePlayer(uid){
  const name = (livePlayersMap[uid] && livePlayersMap[uid].profile || {}).displayName || 'Bu tələbə';
  if(!confirm(`${name} oyundan çıxarılsın?`)) return;
  db.ref('live_rooms/' + liveRoomPin + '/players/' + uid).remove().catch(err => alert('Xəta: ' + err.message));
}

// ── QUESTION LIVE ─────────────────────────────────────────────────────────
function launchLiveQuestion(i){
  if(!liveRoomPin) return;
  if(i >= liveQuestions.length){ finishLiveRoom(); return; }
  db.ref('live_rooms/' + liveRoomPin + '/meta').update({
    status: 'QUESTION', currentIndex: i, questionStartedAt: firebase.database.ServerValue.TIMESTAMP
  }).catch(err => alert('Xəta: ' + err.message));
}

function renderLiveQuestionActive(){
  const i = liveMeta.currentIndex;
  const q = liveQuestions[i];
  liveAnswersMap = {};
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Sual ${i + 1} / ${liveQuestions.length}</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:16px">${esc(q.text)}</div>
      ${liveQuestionOptionsHtml(q)}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px">
        <span id="live-answered-count" style="font-size:13px;color:var(--muted)">0 / 0 cavab verdi</span>
        <div class="timer-pill" id="live-timer-pill">${liveMeta.questionSeconds}</div>
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="revealLiveQuestion()">Nəticəni Göstər →</button>
      <button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="confirmEndLiveRoom()">⏹ Oyunu İndi Bitir</button>
    </div>`;
  startLiveQuestionTimer();
  detachLiveAnswersListener();
  liveAnswersRef = db.ref('live_rooms/' + liveRoomPin + '/answers/' + i);
  liveAnswersHandler = snap => { liveAnswersMap = snap.val() || {}; updateLiveAnsweredCount(); };
  liveAnswersRef.on('value', liveAnswersHandler);
}

function liveQuestionOptionsHtml(q){
  if(q.type === 'mc') return `<div>${q.options.filter(Boolean).map((o, i) =>
    `<div style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">${LIVE_OPT_LETTERS[i]}. ${esc(o)}</div>`).join('')}</div>`;
  if(q.type === 'tf') return '<div style="font-size:13px;color:var(--muted)">Doğru / Yanlış sualı</div>';
  if(q.type === 'fill') return `<div style="font-size:14px">${esc(q.fillText || '').replace(/\[blank\]/gi, '____')}</div>`;
  return '<div style="font-size:13px;color:var(--muted)">Yazılı cavab sualı</div>';
}

function startLiveQuestionTimer(){
  clearInterval(liveQuestionTimer);
  // Driven off the host's own clock: fine here, since an early/late auto-reveal is a UX nicety,
  // not a security boundary (the database rule already gates when answers may be written).
  const deadline = (liveMeta.questionStartedAt || Date.now()) + liveMeta.questionSeconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const pill = document.getElementById('live-timer-pill');
    if(pill) pill.textContent = left;
    if(left <= 0){ clearInterval(liveQuestionTimer); revealLiveQuestion(); }
  };
  tick();
  liveQuestionTimer = setInterval(tick, 500);
}

function updateLiveAnsweredCount(){
  const el = document.getElementById('live-answered-count');
  if(!el) return;
  const connected = Object.values(livePlayersMap).filter(p => (p.profile || {}).displayName && (p.profile || {}).connected !== false).length;
  el.textContent = `${Object.keys(liveAnswersMap).length} / ${connected} cavab verdi`;
}

// ── REVEAL ────────────────────────────────────────────────────────────────
function extractLiveAnswer(q, a){
  if(!a || !q) return undefined;
  if(q.type === 'mc') return a.selectedOption;
  if(q.type === 'tf') return a.tfAnswer;
  if(q.type === 'short') return a.shortAnswer;
  if(q.type === 'fill') return a.fillAnswers;
  return undefined;
}

function revealLiveQuestion(){
  if(!liveMeta || liveMeta.status !== 'QUESTION') return;
  clearInterval(liveQuestionTimer);
  const i = liveMeta.currentIndex;
  const q = liveQuestions[i];
  const key = liveAnswerKeyMap[String(q.id)];
  const answers = liveAnswersMap || {};
  const updates = { 'meta/status': 'REVEAL' };
  let correctCount = 0;
  Object.entries(answers).forEach(([uid, a]) => {
    const ans = extractLiveAnswer(key, a);
    const correct = isCorrectAnswer(key, ans);
    if(correct) correctCount++;
    const earned = liveScore(key, ans, a.responseTimeMs || 0, liveMeta.questionSeconds);
    updates['players/' + uid + '/score'] = firebase.database.ServerValue.increment(earned);
    updates['results/' + i + '/' + uid] = { correct, pointsEarned: earned };
  });
  liveLastRevealStats = { answeredCount: Object.keys(answers).length, correctCount };
  db.ref('live_rooms/' + liveRoomPin).update(updates).catch(err => alert('Xəta: ' + err.message));
}

function renderLiveReveal(){
  detachLiveAnswersListener();
  const i = liveMeta.currentIndex;
  const q = liveQuestions[i];
  const key = liveAnswerKeyMap[String(q.id)] || {};
  const stats = liveLastRevealStats || {};
  const isLast = i >= liveQuestions.length - 1;
  const leaderboard = liveLeaderboard().slice(0, 5);
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Sual ${i + 1} / ${liveQuestions.length} — Nəticə</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:10px">${esc(q.text)}</div>
      <div style="font-size:13px;color:var(--correct);margin-bottom:18px">✓ Düzgün cavab: ${esc(correctAnswerText(key))}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:20px">${stats.correctCount || 0} / ${stats.answeredCount || 0} şagird düzgün cavab verdi</div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Liderlik Cədvəli</div>
      ${leaderboard.length ? leaderboard.map((p, idx) =>
        `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)"><span>${idx + 1}. ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join('')
        : '<div style="font-size:12px;color:var(--muted)">Heç kim cavab vermədi.</div>'}
      <button class="btn btn-primary btn-full" style="margin-top:20px" onclick="${isLast ? 'finishLiveRoom()' : 'launchLiveQuestion(' + (i + 1) + ')'}">${isLast ? '🏁 Oyunu Bitir' : 'Növbəti Sual →'}</button>
      ${isLast ? '' : '<button class="btn btn-ghost btn-full" style="margin-top:10px" onclick="confirmEndLiveRoom()">⏹ Oyunu İndi Bitir</button>'}
    </div>`;
}

function liveLeaderboard(){
  return sortLeaderboard(Object.values(livePlayersMap)
    .filter(p => (p.profile || {}).displayName)
    .map(p => ({ name: p.profile.displayName, score: p.score || 0 })));
}

// ── FINISH ────────────────────────────────────────────────────────────────
// Lets the teacher stop a game early (mid-question or mid-reveal) instead of only at the last
// question; players currently mid-answer just see the room jump to the final leaderboard.
function confirmEndLiveRoom(){
  if(confirm('Oyun indi bitsin? Qalan suallar göstərilməyəcək.')) finishLiveRoom();
}

function finishLiveRoom(){
  clearInterval(liveQuestionTimer);
  if(!liveMeta || !liveRoomPin) return;
  const board = liveLeaderboard();
  const historyId = db.ref('live_history').push().key;
  const updates = {};
  updates['live_rooms/' + liveRoomPin + '/meta/status'] = 'FINISHED';
  updates['live_history/' + historyId] = {
    topic: liveMeta.topic, createdAt: liveMeta.createdAt || Date.now(), finishedAt: Date.now(),
    questionCount: liveQuestions.length, playerCount: board.length,
    leaderboard: board.slice(0, 20).map(p => ({ name: p.name, score: p.score }))
  };
  db.ref().update(updates).catch(err => alert('Xəta: ' + err.message));
}

function renderLiveFinished(){
  detachLiveAnswersListener();
  const leaderboard = liveLeaderboard();
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto;text-align:center">
      <div style="font-size:32px;margin-bottom:10px">🏁</div>
      <h2 style="margin-bottom:18px">${esc(liveMeta.topic)} — Oyun Bitdi</h2>
      ${leaderboard.length ? leaderboard.slice(0, 10).map((p, idx) =>
        `<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);text-align:left"><span>${idx + 1}. ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join('')
        : '<div style="font-size:12px;color:var(--muted)">Heç kim qoşulmadı.</div>'}
      <button class="btn btn-ghost btn-full" style="margin-top:20px" onclick="deleteLiveRoom()">🗑 Otağı Sil</button>
      <button class="btn btn-primary btn-full" style="margin-top:10px" onclick="startNewLiveGame()">＋ Yeni Oyun</button>
    </div>`;
}

function startNewLiveGame(){
  detachLiveRoom();
  clearLiveRoomMarker();
  renderLiveTopicPicker();
}

function deleteLiveRoom(){
  if(!liveRoomPin) return;
  if(!confirm('Otaq silinsin? Bu geri qaytarıla bilməz.')) return;
  const pin = liveRoomPin;
  detachLiveRoom();
  clearLiveRoomMarker();
  db.ref('live_rooms/' + pin).remove().catch(() => {});
  renderLiveTopicPicker();
}
