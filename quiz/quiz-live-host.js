'use strict';

// Host side of the Kahoot-style live game mode: a new "Canlı Oyun" tab in the teacher panel
// (quiz-az.html / quiz-az.js). Draws into the same #questions-container the question editor and
// Analytics tab already share (see switchTab in quiz-az.js), following that existing convention.
// Reuses: `questions`/`publishedTopics`/`refreshPublishedTopics`/`normalizeImportedQuestion` (quiz-az.js /
// quiz-backup.js), `db`/`auth` (firebase-config.js), `esc`/`shuffleList` (quiz-az.js),
// `isCorrectAnswer`/`correctAnswerText`/`questionProblems`/`publicQuestion`/`answerKeyEntry` (quiz-grading.js),
// `generatePin`/`liveScore`/`sortLeaderboard`/`liveBoard`/`liveRoundFacts` (quiz-live.js).

const LIVE_MAX_QUESTIONS   = 30;
const LIVE_DEFAULT_SECONDS = 20;
const LIVE_DEFAULT_LEAVE_LIMIT = 3;
const LIVE_STORAGE_KEY     = 'qc_live_room';
const LIVE_OPT_LETTERS     = ['A', 'B', 'C', 'D', 'E'];

let liveShown         = false;  // the live screen is currently drawn where the question editor normally is
let liveRoomPin        = null;
let liveMeta           = null;
let livePlayersMap     = {};
let liveAnswersMap     = {};    // answers/{currentIndex} of the question currently on screen
let liveQuestionEligibleUids = [];  // players present when this question launched (see renderLiveQuestionActive)
let liveQuestions      = [];    // public shape, in-memory copy used for rendering
let liveAnswerKeyMap   = {};    // id -> answerKeyEntry, in-memory copy used for scoring
let liveLastRevealStats = null;
let liveRevealFact = null;   // { round, fact }: the random fact picked for a round, kept so a re-render shows the same one
let liveRevealing = false;  // guards against the timer and the manual button both calling
                             // revealLiveQuestion() at once
let liveFinishing = false;  // guards against a double-click on an end-game button

let liveMetaRef = null, liveRoomPlayersRef = null, liveAnswersRef = null, liveAnswersHandler = null;
let liveRejoinRequestsRef = null, liveBannedRef = null;
let liveQuestionTimer = null;
let liveRevealDelay = null;   // the short wait between the timer running out and scoring

// After the timer runs out, wait this long before reading the answers, so an answer sent in the
// last moment still reaches the server. Students' screens stop taking answers at 0.
const LIVE_REVEAL_GRACE_MS = 2000;

// Players the teacher kicked, or who reached the leave limit (flags.flagged). Saved in the room
// (live_rooms/<pin>/banned), where the rules stop them from joining again or sending answers. It also
// survives a reload of this panel, and clearing the flag from a browser console does not undo it.
let liveRemovedUids = new Set();
let liveBannedMap = {};
function liveIsRemoved(uid){
  const p = livePlayersMap[uid];
  if(p && p.flags && p.flags.flagged && !liveRemovedUids.has(uid)){
    liveRemovedUids.add(uid);
    if(liveRoomPin && !liveBannedMap[uid]) db.ref('live_rooms/' + liveRoomPin + '/banned/' + uid).set(true).catch(() => {});
  }
  return liveRemovedUids.has(uid) || !!liveBannedMap[uid];
}

// How far this computer's clock is from the server's. Firebase measures it once, when the connection
// opens, so it goes stale if this computer's clock moves later (waking from sleep, an automatic time
// correction). That is why a question seen starting here is timed with a local stopwatch instead
// (liveQuestionLocalStart); this offset is only used after a reload in the middle of a question.
let liveHostServerOffset = 0;
db.ref('.info/serverTimeOffset').on('value', s => { liveHostServerOffset = Number(s.val()) || 0; });
function liveHostNow(){ return Date.now() + liveHostServerOffset; }

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
    else {
      // A finished game that was never cleaned up (the panel was closed on its final screen).
      if(meta) db.ref('live_rooms/' + saved.pin).remove().catch(() => {});
      clearLiveRoomMarker(); refreshPublishedTopics(renderLiveTopicPicker);
    }
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
        <div style="margin-bottom:16px">
          <label class="field-lbl">Sual üçün vaxt (saniyə)</label>
          <input type="number" id="live-seconds-input" min="5" max="300" value="${LIVE_DEFAULT_SECONDS}" style="width:100%"/>
        </div>
        <div style="margin-bottom:20px">
          <label class="field-lbl">Səhifədən Çıxış Limiti</label>
          <input type="number" id="live-leave-limit-input" min="0" max="20" value="${LIVE_DEFAULT_LEAVE_LIMIT}" style="width:100%"/>
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
    // The list scrolls between a fixed title and a fixed close button, so a long game can always be
    // closed; clicking outside the box or pressing Esc closes it too.
    el.innerHTML = `<div class="modal modal-scroll" style="max-width:420px">
      <h2 style="margin-bottom:4px">${esc(h.topic || '')}</h2>
      <p style="font-size:12px;color:var(--muted);margin-bottom:16px">${h.playerCount || 0} tələbə · ${h.questionCount || 0} sual</p>
      <div class="modal-body">
        ${board.length ? board.map((p, idx) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);text-align:left"><span>${idx + 1}. ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join('') : '<div style="font-size:12px;color:var(--muted)">Nəticə yoxdur.</div>'}
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:16px;flex-shrink:0" onclick="closeLiveHistoryModal()">Bağla</button>
    </div>`;
    el.addEventListener('click', e => { if(e.target === el) closeLiveHistoryModal(); });
    document.addEventListener('keydown', liveHistoryEsc);
    document.body.appendChild(el);
  });
}

function liveHistoryEsc(e){ if(e.key === 'Escape') closeLiveHistoryModal(); }
function closeLiveHistoryModal(){
  document.getElementById('live-history-modal')?.remove();
  document.removeEventListener('keydown', liveHistoryEsc);
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
  const leaveLimitVal = parseInt(document.getElementById('live-leave-limit-input')?.value, 10);
  const leaveLimit = Number.isNaN(leaveLimitVal) ? LIVE_DEFAULT_LEAVE_LIMIT : Math.min(20, Math.max(0, leaveLimitVal));
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
      questionSeconds: seconds, leaveLimit, createdAt: Date.now()
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
    Object.keys(livePlayersMap).forEach(liveIsRemoved);
    if(!liveShown || !liveMeta) return;
    if(liveMeta.status === 'LOBBY') renderLivePlayerList();
    else if(liveMeta.status === 'QUESTION') updateLiveAnsweredCount();
  });
  liveRejoinRequestsRef = db.ref('live_rooms/' + pin + '/rejoin_requests');
  liveRejoinRequestsRef.on('child_added', snap => processLiveRejoinRequest(pin, snap.key, snap.val()));
  liveBannedRef = db.ref('live_rooms/' + pin + '/banned');
  liveBannedRef.on('value', snap => { liveBannedMap = snap.val() || {}; }, () => {});
}

// A player rejoining under a new uid (new device, or an old session that didn't survive a
// connection drop) can't write another uid's score themselves (teacher-only by rule), so they
// drop a request here and the host - already trusted to write any player's score - carries the
// merge out: copy the old player's score/flags onto the new uid, then remove the old entry so the
// roster/leaderboard don't show both. Re-reads `players/{targetUid}` fresh rather than trusting
// livePlayersMap, since sibling listeners aren't guaranteed to deliver in order.
function processLiveRejoinRequest(pin, newUid, req){
  const reqRef = db.ref('live_rooms/' + pin + '/rejoin_requests/' + newUid);
  const targetUid = req && req.targetUid;
  if(!targetUid || targetUid === newUid){ reqRef.remove().catch(() => {}); return; }
  Promise.all([
    db.ref('live_rooms/' + pin + '/players/' + targetUid).once('value'),
    db.ref('live_rooms/' + pin + '/players/' + newUid).once('value')
  ]).then(([snap, newSnap]) => {
    const oldPlayer = snap.val();
    // Refused (request dropped, nobody's score moves) unless the old player is disconnected and the
    // names match: otherwise anyone could type a classmate's name and push them out of the game.
    if(!liveRejoinAllowed(newSnap.val(), oldPlayer) || liveIsRemoved(targetUid) || liveIsRemoved(newUid)) return reqRef.remove();
    const updates = {};
    updates['players/' + newUid + '/score'] = (oldPlayer && Number(oldPlayer.score)) || 0;
    if(oldPlayer && oldPlayer.flags) updates['players/' + newUid + '/flags'] = oldPlayer.flags;
    if(oldPlayer && oldPlayer.streak) updates['players/' + newUid + '/streak'] = oldPlayer.streak;
    if(oldPlayer && oldPlayer.bestStreak) updates['players/' + newUid + '/bestStreak'] = oldPlayer.bestStreak;
    updates['players/' + targetUid] = null;
    updates['rejoin_requests/' + newUid] = null;
    return db.ref('live_rooms/' + pin).update(updates);
  }).catch(() => { reqRef.remove().catch(() => {}); });
}

// A question this panel saw start (not one already running when the panel loaded): its countdown runs
// on performance.now(), which no clock change can move, so it always gets its full time.
let liveQuestionLocalStart = null;   // { index, t: performance.now() at launch }

function handleLiveMetaSnapshot(snap){
  const prev = liveMeta;
  liveMeta = snap.val();
  if(prev && liveMeta && liveMeta.status === 'QUESTION' && (prev.status !== 'QUESTION' || prev.currentIndex !== liveMeta.currentIndex)){
    liveQuestionLocalStart = { index: liveMeta.currentIndex, t: performance.now() };
  }
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
  if(liveRejoinRequestsRef) liveRejoinRequestsRef.off();
  if(liveBannedRef) liveBannedRef.off();
  liveMetaRef = null; liveRoomPlayersRef = null; liveRejoinRequestsRef = null; liveBannedRef = null;
  liveBannedMap = {};
  clearInterval(liveQuestionTimer);
  clearTimeout(liveRevealDelay);
  liveRoomPin = null; liveMeta = null; livePlayersMap = {}; liveAnswersMap = {}; liveQuestionEligibleUids = [];
  liveRemovedUids = new Set();
  liveRevealing = false; liveFinishing = false; liveQuestionLocalStart = null; liveRevealFact = null;
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
  // Marked as banned in the same write, so the rules refuse it if they try to join again.
  db.ref('live_rooms/' + liveRoomPin).update({ ['players/' + uid]: null, ['banned/' + uid]: true })
    .catch(err => alert('Xəta: ' + err.message));
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
  liveRevealing = false;
  // Frozen at question-launch, not recomputed live: the "x / y answered" counter is for the players
  // who were there when the question started. A disconnect among them drops out of the count
  // (see updateLiveAnsweredCount).
  liveQuestionEligibleUids = Object.entries(livePlayersMap)
    .filter(([uid, p]) => (p.profile || {}).displayName && (p.profile || {}).connected !== false && !liveIsRemoved(uid))
    .map(([uid]) => uid);
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Sual ${i + 1} / ${liveQuestions.length}</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:16px">${esc(q.text)}</div>
      <div id="live-options-area"><div id="live-read-note" style="font-size:13px;color:var(--muted)">⏳ Cavablar ${Math.round(LIVE_READ_MS / 1000)} saniyə sonra açılır…</div></div>
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
  // Letters follow the option's position in the teacher's list, same as the players' buttons and the key.
  if(q.type === 'mc') return `<div>${q.options.map((o, i) => o ?
    `<div style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">${LIVE_OPT_LETTERS[i]}. ${esc(o)}</div>` : '').join('')}</div>`;
  if(q.type === 'tf') return '<div style="font-size:13px;color:var(--muted)">Doğru / Yanlış sualı</div>';
  if(q.type === 'fill') return `<div style="font-size:14px">${esc(q.fillText || '').replace(/\[blank\]/gi, '____')}</div>`;
  return '<div style="font-size:13px;color:var(--muted)">Yazılı cavab sualı</div>';
}

function startLiveQuestionTimer(){
  clearInterval(liveQuestionTimer);
  clearTimeout(liveRevealDelay);
  const index = liveMeta.currentIndex;
  const total = liveMeta.questionSeconds;
  const local = liveQuestionLocalStart && liveQuestionLocalStart.index === index ? liveQuestionLocalStart.t : null;
  const startedAt = liveMeta.questionStartedAt || liveHostNow();
  // Seen starting here: the local stopwatch. Otherwise (a reload mid-question): server time, never less than 0.
  const elapsedMs = () => local != null
    ? performance.now() - local
    : Math.max(0, liveHostNow() - startedAt);
  const q = liveQuestions[index];
  const tick = () => {
    const elapsed = elapsedMs();
    // The first LIVE_READ_MS show only the question; the options appear (and the answer timer starts) after it.
    if(elapsed >= LIVE_READ_MS) showLiveOptions(q);
    else {
      const note = document.getElementById('live-read-note');
      if(note) note.textContent = `⏳ Cavablar ${Math.ceil((LIVE_READ_MS - elapsed) / 1000)} saniyə sonra açılır…`;
    }
    const left = Math.max(0, Math.ceil((LIVE_READ_MS + total * 1000 - elapsed) / 1000));
    const shown = Math.min(total, left);
    const pill = document.getElementById('live-timer-pill');
    if(pill){ pill.textContent = shown; pill.className = 'timer-pill' + liveTimerUrgencyClass(shown, total); }
    if(left <= 0){
      clearInterval(liveQuestionTimer);
      // Tied to this question, so a late timeout can never end the next one.
      liveRevealDelay = setTimeout(() => revealLiveQuestion(index), LIVE_REVEAL_GRACE_MS);
    }
  };
  tick();
  liveQuestionTimer = setInterval(tick, 500);
}

function showLiveOptions(q){
  const el = document.getElementById('live-options-area');
  if(!el || el.dataset.shown) return;
  el.dataset.shown = '1';
  el.innerHTML = liveQuestionOptionsHtml(q);
}

// Called whenever either the answers for this question or the roster changes, from both
// listeners in attachLiveRoom(). Only updates the counter: a question always runs its full time
// (or until the teacher presses the reveal button), even when everyone has already answered.
function updateLiveAnsweredCount(){
  // Players eligible for *this* question (frozen at launch), minus any who dropped out since.
  const connected = liveQuestionEligibleUids.filter(uid => {
    const p = livePlayersMap[uid];
    return p && (p.profile || {}).connected !== false && !liveIsRemoved(uid);
  }).length;
  const answered = Object.keys(liveAnswersMap).filter(uid => !liveIsRemoved(uid)).length;
  const el = document.getElementById('live-answered-count');
  if(el) el.textContent = `${answered} / ${connected} cavab verdi`;
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

// `expectedIndex` is passed by the timer: the reveal only goes ahead if that question is still on.
async function revealLiveQuestion(expectedIndex){
  if(!liveMeta || liveMeta.status !== 'QUESTION' || liveRevealing) return;
  if(expectedIndex != null && liveMeta.currentIndex !== expectedIndex) return;
  liveRevealing = true;
  clearInterval(liveQuestionTimer);
  clearTimeout(liveRevealDelay);
  const pin = liveRoomPin;
  const i = liveMeta.currentIndex;
  const q = liveQuestions[i];
  const key = liveAnswerKeyMap[String(q.id)];
  // Read fresh from the server: the listener's copy can be missing answers the server already took
  // in the last moment, and those students could never send again (one answer per question).
  let answers;
  try{ answers = (await db.ref('live_rooms/' + pin + '/answers/' + i).once('value')).val() || {}; }
  catch(e){ answers = liveAnswersMap || {}; }
  // The room may have been left, or moved on, while that was loading.
  if(pin !== liveRoomPin || !liveMeta || liveMeta.status !== 'QUESTION' || liveMeta.currentIndex !== i) return;
  liveAnswersMap = answers;
  const updates = { 'meta/status': 'REVEAL' };
  let correctCount = 0;
  // Everyone still in the game gets their streak / last-round fields written (a player who did not
  // answer loses the streak), plus anyone who answered.
  const uids = new Set([...Object.keys(answers), ...Object.keys(livePlayersMap)]);
  uids.forEach(uid => {
    if(liveIsRemoved(uid)) return;   // removed for leaving the page: no more points
    const a = answers[uid];
    const player = livePlayersMap[uid] || {};
    if(!a && !(player.profile || {}).displayName) return;
    let correct = false, earned = 0, ms = null;
    if(a){
      const ans = extractLiveAnswer(key, a);
      correct = isCorrectAnswer(key, ans);
      ms = liveResponseTimeMs(a, liveMeta.questionStartedAt, LIVE_READ_MS);
      earned = liveScore(key, ans, ms, liveMeta.questionSeconds);
      if(correct) correctCount++;
      updates['players/' + uid + '/score'] = firebase.database.ServerValue.increment(earned);
      updates['results/' + i + '/' + uid] = { correct, pointsEarned: earned };
    }
    const st = liveNextStreak(player.streak, player.bestStreak, correct);
    updates['players/' + uid + '/streak'] = st.streak;
    updates['players/' + uid + '/bestStreak'] = st.bestStreak;
    updates['players/' + uid + '/lastRound'] = i;
    updates['players/' + uid + '/lastCorrect'] = correct;
    updates['players/' + uid + '/lastPoints'] = earned;
    updates['players/' + uid + '/lastMs'] = ms;   // null (no answer) removes it
    // Applied locally too, not just sent to the server: meta/status and players/*/score are two
    // separate listeners, and nothing guarantees the players one's round-trip confirmation lands
    // before the meta one flips to REVEAL and renders the leaderboard - without this, the board
    // shown right at reveal reflects last round's scores, not this one's, until the next render.
    if(livePlayersMap[uid]) Object.assign(livePlayersMap[uid], {
      score: (livePlayersMap[uid].score || 0) + earned, streak: st.streak, bestStreak: st.bestStreak,
      lastRound: i, lastCorrect: correct, lastPoints: earned, lastMs: ms
    });
  });
  liveLastRevealStats = { answeredCount: Object.keys(answers).filter(uid => !liveIsRemoved(uid)).length, correctCount };
  // Reset on failure so a network hiccup doesn't permanently wedge the round: without this, every
  // future trigger (the timer, the manual button) would keep no-opping forever.
  db.ref('live_rooms/' + liveRoomPin).update(updates).catch(err => { liveRevealing = false; alert('Xəta: ' + err.message); });
}

function renderLiveReveal(){
  detachLiveAnswersListener();
  const i = liveMeta.currentIndex;
  const q = liveQuestions[i];
  const key = liveAnswerKeyMap[String(q.id)] || {};
  const stats = liveLastRevealStats || {};
  const isLast = i >= liveQuestions.length - 1;
  const board = liveBoard(livePlayersMap);
  if(!liveRevealFact || liveRevealFact.round !== i) liveRevealFact = { round: i, fact: livePickFact(liveRoundFacts(board, i)) };
  const fact = liveRevealFact.fact;
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Sual ${i + 1} / ${liveQuestions.length} — Nəticə</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:10px">${esc(q.text)}</div>
      <div style="font-size:13px;color:var(--correct);margin-bottom:18px">✓ Düzgün cavab: ${esc(correctAnswerText(key))}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:20px">${stats.correctCount || 0} / ${stats.answeredCount || 0} şagird düzgün cavab verdi</div>
      ${fact ? `<div class="live-fact"><span>${fact.icon}</span> ${esc(fact.text)}</div>` : ''}
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Top 5</div>
      ${board.length ? `<div class="live-top-list">${liveTopRowsHtml(board, undefined, 5)}</div>`
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
  // Guards a double-click (the end-game and "last question" buttons have no disabled state):
  // without this, two live_history pushes would be written for the same game.
  if(liveFinishing || !liveMeta || !liveRoomPin) return;
  liveFinishing = true;
  clearInterval(liveQuestionTimer);
  const board = liveLeaderboard();
  const historyId = db.ref('live_history').push().key;
  const updates = {};
  updates['live_rooms/' + liveRoomPin + '/meta/status'] = 'FINISHED';
  updates['live_history/' + historyId] = {
    topic: liveMeta.topic, createdAt: liveMeta.createdAt || Date.now(), finishedAt: Date.now(),
    questionCount: liveQuestions.length, playerCount: board.length,
    leaderboard: board.slice(0, 20).map(p => ({ name: p.name, score: p.score }))
  };
  db.ref().update(updates).catch(err => { liveFinishing = false; alert('Xəta: ' + err.message); });
}

function renderLiveFinished(){
  detachLiveAnswersListener();
  const leaderboard = liveLeaderboard();
  const rest = leaderboard.slice(3, 10);
  document.getElementById('questions-container').innerHTML = `
    <div style="padding:28px;max-width:640px;margin:0 auto;text-align:center">
      <div style="font-size:32px;margin-bottom:10px">🏁</div>
      <h2 style="margin-bottom:18px">${esc(liveMeta.topic)} — Oyun Bitdi</h2>
      ${leaderboard.length ? livePodiumHtml(leaderboard) + rest.map((p, idx) =>
        `<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);text-align:left"><span>${idx + 4}. ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join('')
        : '<div style="font-size:12px;color:var(--muted)">Heç kim qoşulmadı.</div>'}
      <button class="btn btn-ghost btn-full" style="margin-top:20px" onclick="deleteLiveRoom()">🗑 Otağı Sil</button>
      <button class="btn btn-primary btn-full" style="margin-top:10px" onclick="startNewLiveGame()">＋ Yeni Oyun</button>
    </div>`;
}

// The finished room is removed here: the result is kept in live_history, and players have already
// loaded their final screen (they stop listening once the game is FINISHED).
function startNewLiveGame(){
  const pin = liveRoomPin;
  detachLiveRoom();
  clearLiveRoomMarker();
  if(pin) db.ref('live_rooms/' + pin).remove().catch(() => {});
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
