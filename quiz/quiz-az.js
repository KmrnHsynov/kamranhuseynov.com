'use strict';
// ══════════════════════════════════════════════════════
//  CONSTANTS & STATE
// ══════════════════════════════════════════════════════
const STORAGE_KEY_QS  = 'qc_questions';
const STORAGE_KEY_CFG  = 'qc_cfg';

let questions = [];
let qId = 0;
let activeQId = null;
let publishedTopics = {};   // {topicName: true} — loaded fresh from Firebase
let analyticsFilter = 'all'; // 'all' or a Firebase exam key
let analyticsSortLeaves = false;
let lastReleased = {};
let lastRecords = [], lastAnswerKeys = {};   // what the Analytics tab is showing, for CSV export and question stats

// quiz runtime
let quizQs = [];
let quizIdx = 0;
let quizAns = {};
let quizCfg = {};
let timerInt = null;
let timerLeft = 0;
let answered = false;

// ══════════════════════════════════════════════════════
//  TEACHER SIGN-IN (Firebase Auth)
// ══════════════════════════════════════════════════════
const AUTH_ERRORS = {
  'auth/invalid-credential':     '❌ E-poçt və ya şifrə yanlışdır.',
  'auth/wrong-password':         '❌ E-poçt və ya şifrə yanlışdır.',
  'auth/user-not-found':         '❌ E-poçt və ya şifrə yanlışdır.',
  'auth/invalid-email':          '❌ E-poçt formatı yanlışdır.',
  'auth/too-many-requests':      '❌ Çox cəhd edildi. Bir az gözləyib yenidən cəhd edin.',
  'auth/network-request-failed': '❌ Şəbəkə xətası. İnternet bağlantısını yoxlayın.'
};

async function signInTeacher(){
  const email = document.getElementById('email-input').value.trim();
  const pw = document.getElementById('pw-input').value;
  const err = document.getElementById('pw-error');
  err.style.display = 'none';
  try{
    await auth.signInWithEmailAndPassword(email, pw);
    document.getElementById('pw-input').value = '';
  } catch(e){
    document.getElementById('pw-input').value = '';
    err.textContent = AUTH_ERRORS[e.code] || `❌ Giriş alınmadı (${e.code || e.message})`;
    err.style.display = 'block';
  }
}

function signOutTeacher(){ auth.signOut(); }

// Anonymous users (students using the same browser) never get the editor.
auth.onAuthStateChanged(user=>{
  if(user && !user.isAnonymous){
    document.getElementById('teacher-email').textContent = user.email || '';
    loadSaved();
    showView('editor-view');
    renderSidebar();
    renderEditor();
  } else {
    showView('lock-view');
  }
});

// ══════════════════════════════════════════════════════
//  BACKUP — questions live only in this browser, so keep a copy in a file
// ══════════════════════════════════════════════════════
function downloadText(filename, text, mime){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:mime}));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function exportQuestions(){
  if(!questions.length){ alert('Saxlamaq üçün sual yoxdur.'); return; }
  downloadText(`suallar-${new Date().toISOString().slice(0,10)}.json`, backupToJson(questions), 'application/json');
}

// CSV in the layout of Kahoot's question spreadsheet (see quiz-csv.js). The leading mark makes Excel read UTF-8.
function downloadCsvTemplate(){
  downloadText('sual-sablonu.csv', '﻿'+csvTemplate(), 'text/csv;charset=utf-8');
}

// A CSV or an Excel (.xlsx) file in the same column layout. Old binary .xls files cannot be read.
async function readQuestionFile(file){
  const name = String(file.name || '');
  if(/\.xls$/i.test(name)) throw new Error('Köhnə .xls formatı oxuna bilmir. Faylı .xlsx və ya CSV UTF-8 kimi yenidən saxlayın.');
  if(/\.xlsx$/i.test(name)) return parseQuestionsSheets(await xlsxReadSheets(await file.arrayBuffer()));
  return parseQuestionsCsv(await file.text());
}

async function importCsvFile(file){
  if(!file) return;
  try{
    const { questions: parsed, skipped, warnings, encodingProblem } = await readQuestionFile(file);
    const clean = parsed.map(normalizeImportedQuestion).filter(Boolean);
    const flagged = clean.filter(q=>q.needsReview).length;
    let msg = `${clean.length} sual mövcud suallara əlavə edilsin?`;
    if(encodingProblem) msg += '\n\n⚠ Fayl UTF-8 formatında deyil, ə, ş, ı kimi hərflər pozulub. Excel-də "CSV UTF-8" seçib yenidən saxlamaq daha yaxşıdır.';
    if(skipped) msg += `\n\n${skipped} sətir sual mətni olmadığı üçün atlandı.`;
    if(flagged) msg += `\n\n${flagged} sualın cavabı yoxlanmalıdır (⚠ ilə işarələnəcək):\n` + warnings.slice(0,5).join('\n') + (warnings.length>5 ? '\n…' : '');
    if(!confirm(msg)) return;
    clean.forEach(q=>{ q.id = ++qId; questions.push(q); });
    if(!activeQId) activeQId = questions[0].id;
    saveQs(); renderSidebar(); renderEditor();
  } catch(e){
    alert(e.message);
  } finally {
    document.getElementById('csv-file').value = '';
  }
}

async function importQuestions(file){
  if(!file) return;
  try{
    const imported = parseBackup(await file.text());
    if(!confirm(`${imported.length} sual mövcud suallara əlavə edilsin?`)) return;
    imported.forEach(q=>{ q.id = ++qId; questions.push(q); });
    if(!activeQId) activeQId = questions[0].id;
    saveQs(); renderSidebar(); renderEditor();
  } catch(e){
    alert(e.message);
  } finally {
    document.getElementById('import-file').value = '';
  }
}

// ══════════════════════════════════════════════════════
//  PERSISTENCE (non-pdf questions)
// ══════════════════════════════════════════════════════
function saveQs(){
  localStorage.setItem(STORAGE_KEY_QS, JSON.stringify({questions, qId}));
}

function loadSaved(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_QS);
    if(raw){
      const d = JSON.parse(raw);
      questions = d.questions||[];
      qId = d.qId||0;
    }
  }catch(e){}
}

// ══════════════════════════════════════════════════════
//  PDF IMPORT
// ══════════════════════════════════════════════════════
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function handlePdfDrop(e){
  e.preventDefault();
  document.getElementById('pdf-drop').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if(file && file.type==='application/pdf') handlePdfFile(file);
  else alert('Zəhmət olmasa PDF fayl seçin.');
}

async function handlePdfFile(file){
  if(!file) return;
  const status = document.getElementById('pdf-status');
  status.className='pdf-status show';
  status.innerHTML='⏳ PDF oxunur…';

  try{
    const arrBuf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data:arrBuf}).promise;
    let fullText='';
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      // Group text items by Y coordinate to reconstruct proper lines
      const lineMap = new Map();
      tc.items.forEach(item=>{
        const y = Math.round(item.transform[5]);
        if(!lineMap.has(y)) lineMap.set(y,[]);
        lineMap.get(y).push({x:item.transform[4], str:item.str});
      });
      const sortedLines = [...lineMap.entries()]
        .sort((a,b)=>b[0]-a[0])
        .map(([,items])=>items.sort((a,b)=>a.x-b.x).map(it=>it.str).join(''));
      fullText += sortedLines.join('\n')+'\n';
    }
    const parsed = parsePdfText(fullText);
    if(!parsed.length){
      status.innerHTML='⚠️ Sual tapılmadı. Faylın formatını yoxlayın (nömrəli sual siyahısı).';
      return;
    }
    // Replace previous PDF questions
    questions = questions.filter(q=>!q._fromPdf);
    parsed.forEach(q=>{ q.id=++qId; q._fromPdf=true; questions.push(q); });
    if(!activeQId && questions.length) activeQId=questions[0].id;
    saveQs();

    status.innerHTML=`✅ ${parsed.length} sual idxal edildi.`;
    document.getElementById('btn-clear-pdf').style.display='flex';
    renderSidebar();
    renderEditor();
    setActiveQ(questions.find(q=>q._fromPdf)?.id || activeQId);
  } catch(err){
    status.innerHTML='❌ PDF oxunarkən xəta baş verdi: '+err.message;
  }
}

function clearPdfQuestions(){
  questions = questions.filter(q=>!q._fromPdf);
  saveQs();
  const status=document.getElementById('pdf-status');
  status.className='pdf-status show';
  status.innerHTML='🗑 PDF sualları silindi.';
  document.getElementById('btn-clear-pdf').style.display='none';
  if(activeQId && !questions.find(q=>q.id===activeQId)) activeQId=questions[0]?.id||null;
  renderSidebar();renderEditor();
}

// ══════════════════════════════════════════════════════
//  EDITOR — RENDER
// ══════════════════════════════════════════════════════
function switchTab(name){
  document.querySelectorAll('.sidebar-tab').forEach((t,i)=>{
    const names=['questions','settings','pdf','topics','analytics'];
    t.classList.toggle('active', names[i]===name);
  });
  document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='topics') refreshPublishedTopics(renderTopics);
  if(name==='analytics') renderAnalytics();
  // Restore editor when leaving analytics
  const main = document.getElementById('questions-container');
  if(name !== 'analytics') main.classList.remove('hidden');
}

function addQuestion(type='mc'){
  const id=++qId;
  const q={id,type,text:'',options:['','','','',''],correctOption:0,tfAnswer:true,shortAnswer:'',fillText:'',fillAnswers:[],points:1,topic:'',_fromPdf:false};
  questions.push(q);
  saveQs();
  renderSidebar();renderEditor();setActiveQ(id);
}

function deleteQ(id){
  questions=questions.filter(q=>q.id!==id);
  if(activeQId===id) activeQId=questions.length?questions[questions.length-1].id:null;
  saveQs();renderSidebar();renderEditor();
}

function setActiveQ(id){
  activeQId=id;
  document.querySelectorAll('.q-item').forEach(el=>el.classList.toggle('active',+el.dataset.id===id));
  document.querySelectorAll('.q-card').forEach(el=>el.style.display=+el.dataset.id===id?'block':'none');
}

function renderSidebar(){
  const list=document.getElementById('q-list');
  document.getElementById('q-counter').textContent=`${questions.length} sual`;
  if(!questions.length){list.innerHTML='<div style="padding:20px 20px;font-size:12px;color:var(--muted)">Hələ sual yoxdur.</div>';return;}
  list.innerHTML=questions.map((q,i)=>`
    <div class="q-item ${q.id===activeQId?'active':''}" data-id="${q.id}" onclick="setActiveQ(${q.id})">
      <span class="q-num">${i+1}</span>
      <span class="q-preview">${esc(q.text)||'(sual mətni yoxdur)'}</span>
      ${q.needsReview?'<span class="q-warn" title="Düzgün cavabı yoxlayın" style="color:var(--warn)">⚠</span>':''}
      <span class="q-type-badge">${tlbl(q.type)}</span>
      <button class="q-del" onclick="event.stopPropagation();deleteQ(${q.id})">✕</button>
    </div>`).join('');
}

function tlbl(t){return{mc:'ÇS',tf:'D/Y',short:'Qısa',fill:'Boşluq'}[t]||t;}

function toKey(str){ return str.replace(/[.#$[\]/]/g,'_'); }

function refreshPublishedTopics(cb){
  const el = document.getElementById('topics-list');
  if(el) el.innerHTML='<div style="padding:16px;font-size:12px;color:var(--muted)">⏳ Yüklənir…</div>';
  db.ref('student_quiz').once('value').then(snap=>{
    const val = snap.val()||{};
    publishedTopics = {};
    Object.entries(val).forEach(([key,exam])=>{
      if(exam&&exam.questions){
        const label = exam.topic || key;
        publishedTopics[label]={ count: exam.questions.length||0, key, opensAt: exam.opensAt||0, closesAt: exam.closesAt||0 };
      }
    });
    cb && cb();
  }).catch(()=>{ cb && cb(); });
}

function renderTopics(){
  const el = document.getElementById('topics-list');
  if(!el) return;
  const emptyCount = questions.filter(q=>!q.topic?.trim()).length;
  const localTopics = [...new Set(questions.map(q=>q.topic?.trim()).filter(Boolean))];
  const isPublished = t => !!publishedTopics[t];

  // Topics published from Firebase but not present in local questions
  const remoteOnlyTopics = Object.keys(publishedTopics).filter(t => !localTopics.includes(t));

  // Bulk-assign section (always shown if there are any questions)
  const bulkHtml = questions.length ? `
    <div style="padding:14px 16px;border-bottom:2px solid var(--border);background:rgba(255,255,255,.03)">
      <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Boş Sualları Təyin Et</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${emptyCount} sualın mövzusu boşdur</div>
      <input type="text" id="bulk-topic-input" placeholder="Mövzu adı…" style="font-size:12px;padding:7px 11px;margin-bottom:8px"
        oninput="document.getElementById('bulk-topic-btn').disabled=!this.value.trim()"
        onkeydown="if(event.key==='Enter')assignBulkTopic()"/>
      <button id="bulk-topic-btn" class="btn btn-ghost btn-full btn-sm" onclick="assignBulkTopic()" disabled
        style="font-size:12px">Boş sualları bu mövzuya əlavə et</button>
    </div>` : '';

  const localListHtml = localTopics.length ? localTopics.map(topic=>{
    const count = questions.filter(q=>q.topic?.trim()===topic).length;
    const isActive = isPublished(topic);
    return`<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div>
        <div style="font-size:13px;font-weight:600;color:${isActive?'var(--accent3)':'var(--text)'}">${esc(topic)}${isActive?' ✓':''}</div>
        <div style="font-size:11px;color:var(--muted)">${count} sual${isActive&&topicScheduleLabel(topic)?' · '+esc(topicScheduleLabel(topic)):''}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm ${isActive?'btn-accent3':'btn-ghost'}" data-topic="${esc(topic)}" onclick="publishTopic(this.dataset.topic)">
          ${isActive?'✓ Göndərilib':'📤 Göndər'}
        </button>
        ${isActive?`<button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:var(--wrong);border-color:rgba(239,68,68,.3)" data-topic="${esc(topic)}" onclick="unpublishTopic(this.dataset.topic)">📤 Geri Al</button>`:''}
        <button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:var(--wrong);border-color:rgba(239,68,68,.3)" data-topic="${esc(topic)}" onclick="deleteTopic(this.dataset.topic)">🗑</button>
      </div>
    </div>`;
  }).join('') : (!remoteOnlyTopics.length ? '<div style="padding:16px;font-size:12px;color:var(--muted)">Hələ mövzu yoxdur.<br/>Sual kartlarında <strong>Mövzu</strong> sahəsini doldurun.</div>' : '');

  const remoteOnlyHtml = remoteOnlyTopics.length ? `
    <div style="padding:10px 16px 6px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;border-top:2px solid var(--border)">
      Firebase — Digər Cihazdan
    </div>` +
    remoteOnlyTopics.map(topic=>{
      const info = publishedTopics[topic];
      return `<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--accent3)">${esc(topic)} ✓</div>
          <div style="font-size:11px;color:var(--muted)">${info.count||'?'} sual · yalnız Firebase</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:var(--wrong);border-color:rgba(239,68,68,.3)" data-topic="${esc(topic)}" onclick="unpublishTopic(this.dataset.topic)">📤 Geri Al</button>
      </div>`;
    }).join('')
  : '';

  el.innerHTML = bulkHtml + localListHtml + remoteOnlyHtml;
}

function assignBulkTopic(){
  const input = document.getElementById('bulk-topic-input');
  const name = input?.value.trim();
  if(!name) return;
  let changed = 0, skipped = 0;
  questions.forEach(q=>{ if(!q.topic?.trim()){ q.topic = name; changed++; } else { skipped++; } });
  if(!changed){ renderTopics(); return; }
  saveQs();
  renderSidebar();
  renderEditor();
  renderTopics();
  // Show confirmation
  const el = document.getElementById('topics-list');
  const banner = document.createElement('div');
  banner.style.cssText='padding:10px 16px;background:rgba(67,232,176,.12);border-bottom:1px solid rgba(67,232,176,.2);font-size:12px;color:var(--accent3);font-weight:600';
  banner.textContent=`✓ ${changed} sual əlavə edildi${skipped?` · ${skipped} artıq mövzusu olan sual atlandı`:''}`;
  el.prepend(banner);
  setTimeout(()=>banner.remove(), 3000);
}

function publicQuestion(q){
  const p = {id: q.id, type: q.type, text: q.text, points: q.points};
  if(q.type==='mc') p.options = q.options.map(o=>o||'');
  if(q.type==='fill') p.fillText = q.fillText||'';
  return p;
}

function answerKeyEntry(q){
  const k = {type: q.type, text: q.text, points: q.points};
  if(q.type==='mc'){ k.options = q.options.map(o=>o||''); k.correctOption = q.correctOption; }
  if(q.type==='tf') k.tfAnswer = !!q.tfAnswer;
  if(q.type==='short') k.shortAnswer = q.shortAnswer||'';
  if(q.type==='fill'){ k.fillText = q.fillText||''; k.fillAnswers = (q.fillAnswers||[]).map(a=>a||''); }
  return k;
}

function topicScheduleLabel(topic){
  const info = publishedTopics[topic];
  return info ? scheduleLabel(Date.now(), info.opensAt, info.closesAt) : '';
}

function publishTopic(topicName){
  const filtered = questions.filter(q=>q.topic?.trim()===topicName);
  if(!filtered.length) return;
  const unchecked = filtered.filter(q=>q.needsReview).length;
  if(unchecked && !confirm(`${unchecked} sualın düzgün cavabı PDF-dən müəyyən edilməyib və təsdiqlənməyib. Yenə də göndərilsin?`)) return;

  const opensAt = parseLocalDateTime(document.getElementById('opens-at')?.value);
  const closesAt = parseLocalDateTime(document.getElementById('closes-at')?.value);
  const scheduleError = checkSchedule(opensAt, closesAt);
  if(scheduleError){ alert(scheduleError); return; }
  if(closesAt && closesAt < Date.now() && !confirm('Son başlama vaxtı artıq keçib, tələbələr başlaya bilməyəcək. Yenə də göndərilsin?')) return;

  const el = document.getElementById('topics-list');
  const banner = document.createElement('div');
  banner.style.cssText='padding:10px 16px;background:rgba(67,232,176,.12);border-bottom:1px solid rgba(67,232,176,.2);font-size:12px;color:var(--accent3);font-weight:600';
  banner.textContent='⏳ Göndərilir…';
  el.prepend(banner);

  const examMinutes = Math.max(1, parseInt(document.getElementById('exam-minutes')?.value)||30);
  const lv = parseInt(document.getElementById('leave-limit')?.value, 10);
  const leaveLimit = Number.isNaN(lv) ? 3 : Math.min(20, Math.max(0, lv));
  // The public exam carries no answers. The key is saved under this version of the exam and is
  // never removed on unpublish, so attempts can still be graded later. Both are written together.
  const publishedAt = Date.now();
  const key = toKey(topicName);
  const updates = {};
  const exam = {questions: filtered.map(publicQuestion), topic: topicName, examMinutes, leaveLimit, publishedAt};
  if(opensAt) exam.opensAt = opensAt;      // left out when empty: Firebase rejects undefined values
  if(closesAt) exam.closesAt = closesAt;
  updates['student_quiz/'+key] = exam;
  updates['answer_keys/'+key+'/'+publishedAt] = {questions: Object.fromEntries(filtered.map(q=>[q.id, answerKeyEntry(q)]))};
  db.ref().update(updates)
    .then(()=>{
      publishedTopics[topicName] = { count: filtered.length, key: toKey(topicName), opensAt, closesAt };
      renderTopics();
      banner.textContent=`✓ "${topicName}" bütün cihazlara göndərildi`;
      setTimeout(()=>banner.remove(), 3000);
    })
    .catch(err=>{
      banner.style.background='rgba(239,68,68,.12)';
      banner.style.color='var(--wrong)';
      banner.textContent='❌ Xəta: '+err.message;
      setTimeout(()=>banner.remove(), 4000);
    });
}

function deleteTopic(topicName){
  const count = questions.filter(q=>q.topic?.trim()===topicName).length;
  if(!confirm(`"${topicName}" mövzusuna aid ${count} sual silinsin?`)) return;
  questions = questions.filter(q=>q.topic?.trim()!==topicName);
  saveQs(); renderSidebar(); renderEditor();
  db.ref('student_quiz/'+toKey(topicName)).remove().then(()=>{
    delete publishedTopics[topicName];
    renderTopics();
  }).catch(()=>renderTopics());
}

function deleteAllQuestions(){
  if(!questions.length) return;
  if(!confirm(`Bütün ${questions.length} sual silinsin?`)) return;
  questions = []; qId = 0; activeQId = null;
  saveQs(); renderSidebar(); renderEditor();
  db.ref('student_quiz').remove().then(()=>{ publishedTopics = {}; });
}

function unpublishTopic(topicName){
  if(!confirm(`"${topicName}" testini tələbələr üçün silmək istəyirsiniz?`)) return;
  db.ref('student_quiz/'+toKey(topicName)).remove()
    .then(()=>{
      delete publishedTopics[topicName];
      renderTopics();
    })
    .catch(err=>alert('Xəta: '+err.message));
}

// ══════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════
function renderAnalytics(){
  const main = document.getElementById('questions-container');
  const sidebar = document.getElementById('analytics-sidebar');
  main.classList.remove('hidden');
  main.innerHTML='<div class="analytics-empty"><div style="font-size:32px;margin-bottom:12px">⏳</div><p>Yüklənir…</p></div>';
  sidebar.innerHTML='';

  Promise.all([db.ref('analytics').once('value'), db.ref('answer_keys').once('value'), db.ref('results').once('value')]).then(([snapshot, keySnap, resultsSnap])=>{
    const val = snapshot.val()||{};
    const answerKeys = keySnap.val()||{};
    const released = resultsSnap.val()||{};
    const examKeys = Object.keys(val);

    // Build records for current filter
    const withExam = k => Object.values(val[k]||{}).map(r=>({...r, _exam:k}));
    let records;
    if(analyticsFilter==='all' || !val[analyticsFilter]){
      records = examKeys.flatMap(withExam);
    } else {
      records = withExam(analyticsFilter);
    }
    records.forEach(r=>applyGrade(r, answerKeys));
    records.sort((a,b)=>a.timestamp-b.timestamp);
    markRepeatAttempts(records);
    records.forEach(r=>{ r.released = !!released[r.attemptId]; });
    lastRecords = records; lastAnswerKeys = answerKeys; lastReleased = released;

    // Exam selector shown when more than one exam has data
    let selectorHtml = '';
    if(examKeys.length > 1){
      selectorHtml = `<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
        <label style="font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap">Test:</label>
        <select onchange="switchAnalyticsExam(this.value)" style="font-size:13px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);flex:1;min-width:0">
          <option value="all" ${analyticsFilter==='all'?'selected':''}>Bütün Testlər</option>
          ${examKeys.map(k=>{
            const examData = val[k]||{};
            const examName = (Object.values(examData)[0]?.topic)||k;
            const cnt = Object.keys(examData).length;
            return`<option value="${esc(k)}" ${analyticsFilter===k?'selected':''}>${esc(examName)} (${cnt})</option>`;
          }).join('')}
        </select>
      </div>`;
    }

    _drawAnalytics(records, main, sidebar, selectorHtml);
  }).catch(err=>{
    main.innerHTML=`<div class="analytics-empty"><p style="color:var(--wrong)">❌ Yüklənmə xətası: ${err.message}</p></div>`;
  });
}

// Students only store raw answers and server times; the score is worked out here from the saved key.
function applyGrade(r, answerKeys){
  const g = gradeAttempt(r, (answerKeys[r._exam]||{})[r.examVersion]);
  const end = r.finishedAt || r.updatedAt || r.startedAt || 0;
  r.timestamp = r.startedAt || 0;
  r.timeUsed = r.startedAt ? Math.max(0, Math.round((end - r.startedAt)/1000)) : 0;
  r.ungraded = !g;
  Object.assign(r, g || {correct:0, wrong:0, unanswered:0, score:0, maxScore:0, totalQuestions:0, pct:0});
}

function switchAnalyticsExam(val){
  analyticsFilter = val;
  renderAnalytics();
}

function _drawAnalytics(records, main, sidebar, selectorHtml=''){
  if(!records.length){
    sidebar.innerHTML='<div style="padding:20px 16px;font-size:12px;color:var(--muted);line-height:1.7">Hələ nəticə yoxdur.<br/>Tələbələr testi bitirdikdə burada görünəcək.</div>';
    main.innerHTML='<div class="analytics-empty"><div style="font-size:48px;margin-bottom:16px">📊</div><p>Hələ heç bir tələbə testi tamamlamamışdır.</p></div>';
    return;
  }

  // Averages use finished, graded attempts only: someone still taking the exam would drag them down.
  const finished = records.filter(r=>r.status!=='in_progress' && !r.ungraded);
  const average = (list, f) => list.length ? Math.round(list.reduce((s,r)=>s+f(r),0)/list.length) : null;
  const avgPct  = average(finished, r=>r.pct)==null ? '—' : average(finished, r=>r.pct)+'%';
  const avgTime = average(finished, r=>r.timeUsed)==null ? '—' : fmtTime(average(finished, r=>r.timeUsed));
  const topics  = [...new Set(records.map(r=>r.topic).filter(Boolean))];

  sidebar.innerHTML=`
    <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
      <div class="an-stat"><span>${records.length}</span><small>Toplam Cəhd</small></div>
      <div class="an-stat"><span>${avgPct}</span><small>Orta Nəticə</small></div>
      <div class="an-stat"><span>${avgTime}</span><small>Orta Vaxt</small></div>
    </div>
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Mövzular</div>
      ${topics.map(t=>{
        const cnt=records.filter(r=>r.topic===t).length;
        const topicAvg=average(finished.filter(r=>r.topic===t), r=>r.pct);
        const avg=topicAvg==null?'—':topicAvg+'%';
        return`<div style="font-size:12px;display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2)">
          <span style="color:var(--text2)">${esc(t)||'—'}</span>
          <span style="color:var(--accent4)">${cnt} cəhd · ${avg}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:12px 16px">
      <button class="btn btn-ghost btn-full btn-sm" onclick="clearAnalytics()" style="color:var(--wrong)">🗑 Bütün Nəticələri Sil</button>
    </div>`;

  main.innerHTML=`
    <div class="analytics-wrap">
      <div class="analytics-hdr">
        ${selectorHtml}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <h2 style="font-family:'Nunito',sans-serif;font-size:20px;font-weight:800">Tələbə Nəticələri</h2>
          <span style="display:flex;align-items:center;gap:10px">
            ${releaseButtonsHtml(records)}
            <button class="btn btn-sm btn-ghost" onclick="renderAnalytics()" title="Yeni nəticələri yüklə">↻</button>
            <button class="btn btn-sm btn-ghost" onclick="exportAnalyticsCsv()" title="Nəticələri CSV faylı kimi yüklə">⬇ CSV</button>
            <button class="btn btn-sm ${analyticsSortLeaves?'btn-accent3':'btn-ghost'}" onclick="toggleLeaveSort()">Çıxışa görə sırala</button>
            <span style="font-size:12px;color:var(--muted)">${records.length} qeyd</span>
          </span>
        </div>
      </div>
      <div class="an-table">
        <div class="an-thead">
          <div>Ad</div><div>Mövzu</div><div>Tarix / Vaxt</div>
          <div style="text-align:center">Doğru</div>
          <div style="text-align:center">Yanlış</div>
          <div style="text-align:center">Cavabsız</div>
          <div style="text-align:center">Nəticə</div>
          <div style="text-align:center">Çıxışlar</div>
          <div>Status</div>
        </div>
        ${(analyticsSortLeaves ? [...records].sort((a,b)=>(b.tabSwitches||0)-(a.tabSwitches||0)) : [...records].reverse()).map(r=>{
          const cls = r.pct>=70?'an-good':r.pct>=50?'an-mid':'an-low';
          const date = new Date(r.timestamp);
          const dateStr = date.toLocaleDateString('az-AZ',{day:'2-digit',month:'2-digit',year:'numeric'});
          const timeStr = date.toLocaleTimeString('az-AZ',{hour:'2-digit',minute:'2-digit'});
          return`<div class="an-row">
            <div class="an-name">${esc(r.studentName||'Anonim')}${r.repeatCount>1?` <span class="an-badge an-warn" title="Bu testdə eyni adla ${r.repeatCount} cəhd var" style="padding:1px 7px;font-size:10px">×${r.repeatCount}</span>`:''}</div>
            <div style="font-size:12px;color:var(--text2)">${esc(r.topic||'—')}</div>
            <div style="font-size:11px;color:var(--muted)">${dateStr}<br/>${timeStr} · ${fmtTime(r.timeUsed)}</div>
            <div style="text-align:center;color:var(--correct);font-weight:700">${r.correct}</div>
            <div style="text-align:center;color:var(--wrong);font-weight:700">${r.wrong}</div>
            <div style="text-align:center;color:var(--muted);font-weight:700">${r.unanswered??r.totalQuestions-r.correct-r.wrong}</div>
            <div style="text-align:center">${r.ungraded?'<span class="an-badge an-grey" title="Cavab açarı tapılmadı">—</span>':`<span class="an-badge ${cls}">${r.pct}%</span>`}</div>
            <div style="text-align:center;font-size:12px;color:var(--text2)">${r.tabSwitches||0} · ${fmtTime(r.timeAway||0)}${r.pastes?`<br/><span style="color:var(--wrong)">📋 ${r.pastes}</span>`:''}</div>
            <div style="display:flex;align-items:center;gap:6px">${leaveBadge(r)}${r.released?'<span title="Nəticəsi elan olunub" style="font-size:12px">📢</span>':''}<button class="an-del" title="Bu cəhdi sil" data-exam="${esc(r._exam)}" data-attempt="${esc(r.attemptId)}" onclick="deleteAttempt(this.dataset.exam,this.dataset.attempt)">✕</button></div>
          </div>`;
        }).join('')}
      </div>
      ${questionStatsHtml(records)}
    </div>`;
}

function questionStatsHtml(records){
  const stats = questionStats(records, lastAnswerKeys);
  if(!stats.length) return '';
  return `<div class="an-qstats">
    <h3>Sualların təhlili</h3>
    <p class="hint-text">Ən çətin suallar yuxarıdadır. Yalnız bitmiş cəhdlər sayılır, cavabsız sual düzgün sayılmır.</p>
    ${stats.map(s=>{
      const cls = s.pctCorrect>=70?'an-good':s.pctCorrect>=50?'an-mid':'an-low';
      return `<div class="an-qrow">
        <span class="an-badge ${cls}">${s.pctCorrect}%</span>
        <div class="an-qtext">${esc(s.text||'(mətn yoxdur)')}<small>${analyticsFilter==='all'?esc(s.exam)+' · ':''}${tlbl(s.type)} · ${s.correct}/${s.shown} düzgün</small></div>
      </div>`;
    }).join('')}
  </div>`;
}

// Publishing results: the student gets a code (their attempt id) and sees only their own counts.
function releaseButtonsHtml(records){
  const pending = resultsToRelease(records, lastReleased).length;
  const releasedCount = records.filter(r=>r.released).length;
  return `<button class="btn btn-sm ${pending?'btn-accent3':'btn-ghost'}" ${pending?'':'disabled'} onclick="releaseResults()" title="Tələbələr öz kodları ilə nəticəsini görəcək">📢 Elan et${pending?` (${pending})`:''}</button>`
    + (releasedCount ? `<button class="btn btn-sm btn-ghost" onclick="retractResults()" title="Elan olunmuş nəticələri gizlət">↩ Geri götür (${releasedCount})</button>` : '');
}

function releaseResults(){
  const list = resultsToRelease(lastRecords, lastReleased);
  if(!list.length) return;
  if(!confirm(`${list.length} tələbənin nəticəsi elan edilsin? Tələbə öz kodu ilə yalnız öz xalını görəcək.`)) return;
  const now = Date.now();
  const updates = {};
  list.forEach(r=>{ updates['results/'+r.attemptId] = buildResult(r, now); });
  db.ref().update(updates).then(renderAnalytics).catch(err=>alert('Xəta: '+err.message));
}

function retractResults(){
  const list = lastRecords.filter(r=>r.released);
  if(!list.length) return;
  if(!confirm(`${list.length} nəticə geri götürülsün? Tələbələr onları artıq görə bilməyəcək.`)) return;
  const updates = {};
  list.forEach(r=>{ updates['results/'+r.attemptId] = null; });
  db.ref().update(updates).then(renderAnalytics).catch(err=>alert('Xəta: '+err.message));
}

function deleteAttempt(exam, id){
  if(!exam || !id) return;
  if(!confirm('Bu cəhd silinsin?')) return;
  // The released result goes with it, so a deleted attempt cannot still be looked up.
  db.ref().update({['analytics/'+exam+'/'+id]: null, ['results/'+id]: null})
    .then(renderAnalytics)
    .catch(err=>alert('Xəta: '+err.message));
}

function exportAnalyticsCsv(){
  if(!lastRecords.length){ alert('Yükləmək üçün nəticə yoxdur.'); return; }
  // The leading mark makes Excel read the file as UTF-8, so Azerbaijani letters survive.
  const blob = new Blob(['﻿'+recordsToCsv(lastRecords)], {type:'text/csv;charset=utf-8'});
  const exam = analyticsFilter==='all' ? 'hamisi' : analyticsFilter.replace(/[\\/:*?"<>|]/g,'_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neticeler-${exam}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function toggleLeaveSort(){
  analyticsSortLeaves = !analyticsSortLeaves;
  renderAnalytics();
}

function leaveBadge(r){
  if(r.autoSubmitted) return '<span class="an-badge an-low">Avto-göndərildi</span>';
  if(r.status==='in_progress') return '<span class="an-badge an-mid">Tamamlanmayıb</span>';
  if(r.status==='exited') return '<span class="an-badge an-grey">Çıxdı</span>';
  if((r.tabSwitches||0)>0 || (r.pastes||0)>0) return '<span class="an-badge an-warn">Çıxışlar</span>';
  return '';
}

function fmtTime(secs){
  const m=Math.floor(secs/60), s=secs%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function clearAnalytics(){
  const label = analyticsFilter==='all' ? 'Bütün tələbə nəticələri' : `Bu testin nəticələri`;
  if(!confirm(`${label} silinsin?`)) return;
  // Released results for those attempts go too, so a cleared attempt cannot still be looked up by its code.
  const updates = { [analyticsFilter==='all' ? 'analytics' : 'analytics/'+analyticsFilter]: null };
  lastRecords.forEach(r=>{ if(r.attemptId) updates['results/'+r.attemptId] = null; });
  db.ref().update(updates)
    .then(()=>{ analyticsFilter='all'; renderAnalytics(); })
    .catch(err=>alert('Xəta: '+err.message));
}

function renderEditor(){
  const c=document.getElementById('questions-container');
  if(!questions.length){
    c.innerHTML=`<div class="empty-state"><div class="icon">✏️</div><h3>Sual yoxdur</h3><p>Sol paneldən <strong>Sual Əlavə Et</strong> düyməsinə basın<br/>və ya PDF faylından idxal edin.</p></div>`;
    return;
  }
  c.innerHTML=questions.map((q,i)=>buildQCard(q,i)).join('');
  document.querySelectorAll('.q-card').forEach(el=>el.style.display=+el.dataset.id===activeQId?'block':'none');
}

function buildQCard(q,i){
  return`<div class="q-card" data-id="${q.id}">
    <div class="q-card-header">
      <span class="q-num-badge">S${i+1}</span>
      <select class="q-type-sel" onchange="chgType(${q.id},this.value)">
        <option value="mc" ${q.type==='mc'?'selected':''}>Çoxseçimli</option>
        <option value="tf" ${q.type==='tf'?'selected':''}>Doğru / Yanlış</option>
        <option value="short" ${q.type==='short'?'selected':''}>Qısa Cavab</option>
        <option value="fill" ${q.type==='fill'?'selected':''}>Boşluq Doldurun</option>
      </select>
      ${q._fromPdf?'<span style="font-size:10px;color:var(--accent4);padding:2px 7px;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.2);border-radius:5px">PDF</span>':''}
      ${q.needsReview?`<button class="review-tag btn btn-ghost btn-sm" style="font-size:11px;color:var(--warn)" onclick="confirmReview(${q.id})">⚠ Düzgün cavab müəyyən edilməyib — təsdiq et</button>`:''}
    </div>
    <div style="margin-bottom:12px">
      <div class="field-lbl">Mövzu</div>
      <input type="text" placeholder="Məs: Fəsil 1, Verilənlər Bazası…" value="${esc(q.topic||'')}" oninput="updF(${q.id},'topic',this.value)" style="font-size:12px;padding:7px 11px"/>
    </div>
    <div class="field-lbl">Sualın mətni</div>
    <textarea rows="3" placeholder="Sualı buraya yazın…" oninput="updF(${q.id},'text',this.value)">${esc(q.text)}</textarea>
    ${q.type==='mc'?buildMC(q):''}
    ${q.type==='tf'?buildTF(q):''}
    ${q.type==='short'?buildShort(q):''}
    ${q.type==='fill'?buildFill(q):''}
    <div class="points-row"><label>Xal:</label><input type="number" min="1" max="100" value="${q.points}" oninput="updF(${q.id},'points',+this.value)"/></div>
  </div>`;
}

function buildMC(q){
  const L=['A','B','C','D','E'];
  return`<div class="field-lbl">Cavab Variantları <span style="font-size:9px;color:var(--muted)">(● = düzgün)</span></div>
  <div class="mc-options">${q.options.map((o,i)=>`
    <div class="mc-opt">
      <span class="mc-ltr">${L[i]}</span>
      <input type="text" placeholder="${L[i]} variantı" value="${esc(o)}" oninput="updOpt(${q.id},${i},this.value)"/>
      <input type="radio" class="correct-radio" name="cor-${q.id}" ${q.correctOption===i?'checked':''} onchange="updF(${q.id},'correctOption',${i})" title="Düzgün cavab"/>
    </div>`).join('')}
  </div>`;
}

function buildTF(q){
  return`<div class="field-lbl">Düzgün Cavab</div>
  <div class="tf-opts">
    <div class="tf-btn-editor ${q.tfAnswer===true?'sel-t':''}" onclick="updF(${q.id},'tfAnswer',true);renderEditor()">✓ Doğru</div>
    <div class="tf-btn-editor ${q.tfAnswer===false?'sel-f':''}" onclick="updF(${q.id},'tfAnswer',false);renderEditor()">✗ Yanlış</div>
  </div>`;
}

function buildShort(q){
  return`<div class="field-lbl">Düzgün Cavab (avtomatik yoxlama üçün)</div>
  <input type="text" placeholder="Gözlənilən cavab (həssaslıq yoxdur)" value="${esc(q.shortAnswer)}" oninput="updF(${q.id},'shortAnswer',this.value)"/>
  <p class="hint-text">Vergüllə ayırılmış alternativ cavablar qəbul edilir: <code>Paris,paris,PARİS</code></p>`;
}

function buildFill(q){
  return`<div class="field-lbl">Boşluqlu Mətn</div>
  <textarea rows="3" placeholder='[blank] ilə boşluq göstərin. Məs: "Azərbaycanın paytaxtı [blank]-dır."' oninput="updF(${q.id},'fillText',this.value)">${esc(q.fillText)}</textarea>
  <p class="hint-text">Hər boşluq üçün <code>[blank]</code> yazın.</p>
  <div class="field-lbl" style="margin-top:10px">Düzgün Cavablar</div>
  <input type="text" placeholder='Məs: "Bakı" və ya "Bakı,bakı" — birdən çox boşluq üçün ";" ilə ayırın' value="${esc((q.fillAnswers||[]).join(';'))}" oninput="updFill(${q.id},this.value)"/>
  <p class="hint-text">Birdən çox boşluq varsa <code>;</code> ilə ayırın</p>`;
}

function chgType(id,type){const q=getQ(id);if(q){q.type=type;saveQs();renderEditor();setActiveQ(id);}}
function clearReview(id){
  const q=getQ(id);
  if(!q||!q.needsReview) return;
  q.needsReview=false; saveQs();
  document.querySelectorAll(`.q-card[data-id="${id}"] .review-tag, .q-item[data-id="${id}"] .q-warn`).forEach(el=>el.remove());
}
const confirmReview = clearReview;
function updF(id,f,v){const q=getQ(id);if(q){q[f]=v;if(f==='correctOption'||f==='tfAnswer'||f==='shortAnswer')clearReview(id);if(f==='text'){const el=document.querySelector(`.q-item[data-id="${id}"] .q-preview`);if(el)el.textContent=v||'(sual mətni yoxdur)';}saveQs();}}
function updOpt(id,i,v){const q=getQ(id);if(q){q.options[i]=v;saveQs();}}
function updFill(id,v){const q=getQ(id);if(q){q.fillAnswers=v.split(';').map(s=>s.trim());saveQs();clearReview(id);}}
function getQ(id){return questions.find(q=>q.id===id);}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ══════════════════════════════════════════════════════
//  QUIZ ENGINE
// ══════════════════════════════════════════════════════
function startQuiz(){
  if(!questions.length){alert('Əvvəlcə ən azı bir sual əlavə edin.');return;}
  for(const q of questions){if(!q.text.trim()){alert('Bütün sual mətnlərini doldurun.');return;}}
  quizCfg={
    title:document.getElementById('quiz-title').value||'Test',
    timer:+document.getElementById('timer-sec').value||0,
    showAnswers:document.getElementById('show-answers').checked,
    shuffle:document.getElementById('shuffle-q').checked,
  };
  localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify(quizCfg));
  quizQs=JSON.parse(JSON.stringify(questions));
  if(quizCfg.shuffle) quizQs=quizQs.sort(()=>Math.random()-.5);
  quizIdx=0;quizAns={};
  document.getElementById('quiz-disp-title').textContent=quizCfg.title;
  showView('quiz-view');
  renderQuizQ();
}

function renderQuizQ(){
  answered=false;
  clearInterval(timerInt);
  const q=quizQs[quizIdx];
  const total=quizQs.length;
  document.getElementById('q-progress').textContent=`${quizIdx+1} / ${total}`;
  document.getElementById('prog-fill').style.width=`${(quizIdx/total)*100}%`;
  const prev=document.getElementById('btn-prev');
  const next=document.getElementById('btn-next');
  prev.style.display=quizIdx===0?'none':'inline-flex';
  next.textContent=quizIdx===total-1?'Bitir ✓':'Növbəti →';
  document.getElementById('quiz-pts-lbl').textContent=`${q.points} xal`;
  const c=document.getElementById('quiz-card-container');
  c.innerHTML=buildQuizCard(q);
  const saved=quizAns[q.id];
  if(saved!==undefined){answered=true;restoreAns(q,saved);if(quizCfg.showAnswers)showFbFromSaved(q,saved);}
  // Timer
  const pill=document.getElementById('timer-pill');
  if(quizCfg.timer>0 && saved===undefined){
    timerLeft=quizCfg.timer;pill.classList.remove('hidden');pill.className='timer-pill';
    updTimerPill();
    timerInt=setInterval(()=>{timerLeft--;updTimerPill();if(timerLeft<=0){clearInterval(timerInt);if(!answered)autoSubmit(q);}},1000);
  } else {pill.classList.add('hidden');}
}

function buildQuizCard(q){
  let body='';
  if(q.type==='mc'){
    const L=['A','B','C','D','E'];
    body=`<div class="quiz-mc-opts">${q.options.filter(o=>o).map((o,i)=>`
      <div class="quiz-mc-opt" id="mc${i}" onclick="pickMC(${q.id},${i},${q.correctOption})">
        <div class="opt-ltr">${L[i]}</div><div class="opt-txt">${esc(o)}</div>
      </div>`).join('')}</div>`;
  } else if(q.type==='tf'){
    body=`<div class="quiz-tf-opts">
      <div class="quiz-tf-btn" id="tf-t" onclick="pickTF(${q.id},true,${q.tfAnswer})">✓ Doğru</div>
      <div class="quiz-tf-btn" id="tf-f" onclick="pickTF(${q.id},false,${q.tfAnswer})">✗ Yanlış</div>
    </div>`;
  } else if(q.type==='short'){
    body=`<textarea class="quiz-short-input" id="short-inp" placeholder="Cavabınızı buraya yazın…" style="width:100%;background:var(--surface2);border:2px solid var(--border);border-radius:12px;color:var(--text);font-family:'Nunito',sans-serif;font-size:14px;padding:13px 15px;outline:none;resize:vertical;min-height:80px;transition:border-color .2s"></textarea>
    <div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="submitShort(${q.id})">Cavabı Göndər</button></div>`;
  } else if(q.type==='fill'){
    const rendered=(q.fillText||'').replace(/\[blank\]/gi,()=>`<input class="blank-inp" type="text"/>`);
    body=`<div class="fill-text-render">${rendered}</div>
    <div style="margin-top:16px"><button class="btn btn-primary btn-sm" onclick="submitFill(${q.id})">Cavabı Göndər</button></div>`;
  }
  return`<div class="quiz-card" id="quiz-card-main">
    <div class="quiz-q-label">Sual ${quizIdx+1} / ${quizQs.length}</div>
    <div class="quiz-q-text">${esc(q.text)}</div>
    ${body}
    <div class="feedback-bar" id="fb-bar"></div>
  </div>`;
}

function pickMC(qid,idx,correct){
  if(answered)return;
  answered=true;clearInterval(timerInt);
  quizAns[qid]=idx;
  document.querySelectorAll('.quiz-mc-opt').forEach((el,i)=>{
    el.classList.add('locked');el.onclick=null;
    if(i===idx)el.classList.add(idx===correct?'ok':'bad');
    if(quizCfg.showAnswers&&i===correct&&i!==idx)el.classList.add('reveal');
  });
  showFb(idx===correct,quizCfg.showAnswers?(idx===correct?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+['A','B','C','D','E'][correct]):(idx===correct?'✓ Düzdür!':'✗ Yanlış'));
}

function pickTF(qid,val,correct){
  if(answered)return;
  answered=true;clearInterval(timerInt);
  quizAns[qid]=val;
  const ok=val===correct;
  const tEl=document.getElementById('tf-t');
  const fEl=document.getElementById('tf-f');
  tEl.classList.add('locked');fEl.classList.add('locked');
  tEl.onclick=null;fEl.onclick=null;
  (val?tEl:fEl).classList.add(ok?'ok':'bad');
  if(quizCfg.showAnswers&&!ok)(correct?tEl:fEl).classList.add('reveal');
  showFb(ok,quizCfg.showAnswers?(ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+(correct?'Doğru':'Yanlış')):(ok?'✓ Düzdür!':'✗ Yanlış'));
}

function submitShort(qid){
  if(answered)return;
  const inp=document.getElementById('short-inp');
  const val=(inp?.value||'').trim();
  if(!val)return;
  answered=true;clearInterval(timerInt);
  quizAns[qid]=val;
  const q=quizQs.find(q=>q.id===qid);
  const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());
  const ok=acc.includes(val.toLowerCase());
  if(inp){inp.style.borderColor=ok?'var(--correct)':'var(--wrong)';inp.readOnly=true;}
  showFb(ok,quizCfg.showAnswers?(ok?'✓ Düzdür!':'✗ Yanlış — Gözlənilən: '+q.shortAnswer):(ok?'✓ Düzdür!':'✗ Yanlış'));
}

function submitFill(qid){
  if(answered)return;
  const inps=[...document.querySelectorAll('.blank-inp')];
  const vals=inps.map(i=>i.value.trim());
  if(vals.some(v=>!v))return;
  answered=true;clearInterval(timerInt);
  quizAns[qid]=vals;
  const q=quizQs.find(q=>q.id===qid);
  let allOk=true;
  vals.forEach((v,i)=>{
    const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());
    const ok=acc.includes(v.toLowerCase());
    if(!ok)allOk=false;
    inps[i].classList.add(ok?'ok':'bad');inps[i].readOnly=true;
  });
  showFb(allOk,quizCfg.showAnswers?(allOk?'✓ Hamısı düzdür!':'✗ Bəziləri yanlışdır — Düzgün: '+(q.fillAnswers||[]).join(', ')):(allOk?'✓ Hamısı düzdür!':'✗ Bəziləri yanlışdır'));
}

function autoSubmit(q){answered=true;quizAns[q.id]=q.type==='fill'?[]:q.type==='short'?'':null;showFb(false,'⏰ Vaxt bitdi!');}

function showFb(ok,msg){
  const el=document.getElementById('fb-bar');
  if(!el)return;
  el.className=`feedback-bar show ${ok?'fb-ok':'fb-bad'}`;
  el.textContent=msg;
}

function restoreAns(q,saved){
  if(q.type==='mc'&&saved!=null){
    const opts=document.querySelectorAll('.quiz-mc-opt');
    if(opts[saved])opts[saved].classList.add(saved===q.correctOption?'ok':'bad');
    if(quizCfg.showAnswers&&saved!==q.correctOption&&opts[q.correctOption])opts[q.correctOption].classList.add('reveal');
    opts.forEach(o=>{o.classList.add('locked');o.onclick=null;});
  } else if(q.type==='tf'&&saved!=null){
    const tEl=document.getElementById('tf-t'),fEl=document.getElementById('tf-f');
    const ok=saved===q.tfAnswer;
    (saved?tEl:fEl)?.classList.add(ok?'ok':'bad');
    if(quizCfg.showAnswers&&!ok)(q.tfAnswer?tEl:fEl)?.classList.add('reveal');
    tEl?.classList.add('locked');fEl?.classList.add('locked');
    if(tEl)tEl.onclick=null;if(fEl)fEl.onclick=null;
  } else if(q.type==='short'){
    const inp=document.getElementById('short-inp');
    if(inp){inp.value=saved||'';const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());inp.style.borderColor=acc.includes((saved||'').toLowerCase())?'var(--correct)':'var(--wrong)';inp.readOnly=true;}
  } else if(q.type==='fill'&&Array.isArray(saved)){
    const inps=[...document.querySelectorAll('.blank-inp')];
    saved.forEach((v,i)=>{if(inps[i]){inps[i].value=v;const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());inps[i].classList.add(acc.includes(v.toLowerCase())?'ok':'bad');inps[i].readOnly=true;}});
  }
}

function showFbFromSaved(q,saved){
  let ok=false,msg='';
  if(q.type==='mc'){ok=saved===q.correctOption;msg=ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+['A','B','C','D','E'][q.correctOption];}
  else if(q.type==='tf'){ok=saved===q.tfAnswer;msg=ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+(q.tfAnswer?'Doğru':'Yanlış');}
  else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());ok=acc.includes((saved||'').toLowerCase());msg=ok?'✓ Düzdür!':'✗ Yanlış — Gözlənilən: '+q.shortAnswer;}
  else if(q.type==='fill'){const vals=Array.isArray(saved)?saved:[];ok=vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});msg=ok?'✓ Hamısı düzdür!':'✗ Bəziləri yanlışdır';}
  if(msg)showFb(ok,msg);
}

function updTimerPill(){
  const el=document.getElementById('timer-pill');if(!el)return;
  const m=Math.floor(timerLeft/60),s=timerLeft%60;
  el.textContent=`${m}:${s.toString().padStart(2,'0')}`;
  el.className='timer-pill';
  if(timerLeft<=10)el.classList.add('danger');
  else if(timerLeft<=20)el.classList.add('warn');
}

function nextQ(){
  if(quizIdx<quizQs.length-1){quizIdx++;renderQuizQ();}
  else finishQuiz();
}
function prevQ(){if(quizIdx>0){quizIdx--;renderQuizQ();}}
function exitQuiz(){clearInterval(timerInt);showView('editor-view');}

// ══════════════════════════════════════════════════════
//  RESULTS
// ══════════════════════════════════════════════════════
function finishQuiz(){
  clearInterval(timerInt);
  let ok=0,bad=0,earned=0,total=0;
  quizQs.forEach(q=>{
    total+=q.points;
    const ans=quizAns[q.id];
    let correct=false;
    if(q.type==='mc')correct=ans===q.correctOption;
    else if(q.type==='tf')correct=ans===q.tfAnswer;
    else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());correct=acc.includes((ans||'').toLowerCase());}
    else if(q.type==='fill'){const vals=Array.isArray(ans)?ans:[];correct=vals.length>0&&vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});}
    if(correct){ok++;earned+=q.points;}else bad++;
  });
  const pct=total?Math.round((earned/total)*100):0;
  document.getElementById('score-ring').style.setProperty('--pct',`${pct}%`);
  document.getElementById('score-pct').textContent=`${pct}%`;
  document.getElementById('stat-ok').textContent=ok;
  document.getElementById('stat-bad').textContent=bad;
  document.getElementById('stat-pts').textContent=`${earned}/${total}`;
  const hdg=pct>=90?'🏆 Əla nəticə!':pct>=70?'👍 Yaxşı iş!':pct>=50?'📚 Daha çox çalışın':pct>0?'💪 Tərəddüd etmə!':'';
  document.getElementById('result-heading').textContent=hdg;
  document.getElementById('result-sub').textContent=`"${quizCfg.title}" testi üzrə ${total} xaldan ${earned} xal topladınız`;
  const rev=document.getElementById('review-sec');
  if(quizCfg.showAnswers){
    rev.innerHTML=`<h3>📋 Sualların İcmalı</h3>`+quizQs.map(q=>buildReview(q)).join('');
  } else {rev.innerHTML='';}
  showView('results-view');
}

function buildReview(q){
  const ans=quizAns[q.id];
  const L=['A','B','C','D','E'];
  let ok=false,yourA='(cavab yoxdur)',corA='';
  if(q.type==='mc'){ok=ans===q.correctOption;yourA=ans!=null?`${L[ans]}: ${q.options[ans]}`:'(cavab yoxdur)';corA=`${L[q.correctOption]}: ${q.options[q.correctOption]}`;}
  else if(q.type==='tf'){ok=ans===q.tfAnswer;yourA=ans==null?'(cavab yoxdur)':(ans?'Doğru':'Yanlış');corA=q.tfAnswer?'Doğru':'Yanlış';}
  else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());ok=acc.includes((ans||'').toLowerCase());yourA=ans||'(cavab yoxdur)';corA=q.shortAnswer;}
  else if(q.type==='fill'){const vals=Array.isArray(ans)?ans:[];ok=vals.length>0&&vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});yourA=vals.join(', ')||'(cavab yoxdur)';corA=(q.fillAnswers||[]).join(', ');}
  return`<div class="review-item ${ok?'r-ok':'r-bad'}">
    <div class="review-q">${esc(q.text)}</div>
    <div class="review-ans-row">
      <span class="r-badge your">Siz: ${esc(yourA)}</span>
      <span class="r-badge ${ok?'ok':'bad'}">${ok?'✓':'✗'} Düzgün: ${esc(corA)}</span>
    </div>
  </div>`;
}

function retakeQuiz(){
  quizIdx=0;quizAns={};
  if(quizCfg.shuffle) quizQs=quizQs.sort(()=>Math.random()-.5);
  showView('quiz-view');renderQuizQ();
}

function printResults(){window.print();}

// ══════════════════════════════════════════════════════
//  VIEW UTILS
// ══════════════════════════════════════════════════════
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
(function init(){
  // One-time migration: clear old preloaded questions (all 175 had correctOption===0)
  if(!localStorage.getItem('qc_version')){
    try{
      const raw = localStorage.getItem('qc_questions');
      if(raw){
        const d = JSON.parse(raw);
        if(d.questions && d.questions.length >= 100 &&
           d.questions.every(q => q.correctOption === 0 && !q._fromPdf)){
          localStorage.removeItem('qc_questions');
        }
      }
    }catch(e){}
    localStorage.setItem('qc_version','2');
  }

  const saved = localStorage.getItem('qc_questions');
  if(saved){ loadSaved(); }
  renderSidebar();
  renderEditor();
})();
