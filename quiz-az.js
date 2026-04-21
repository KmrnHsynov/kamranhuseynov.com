
'use strict';
// ══════════════════════════════════════════════════════
//  CONSTANTS & STATE
// ══════════════════════════════════════════════════════
// Password is stored as a SHA-256 hash — not readable as plain text
// Default password: müəllim2025  (to change, run: sha256("yourpassword") and replace the hash)
const DEFAULT_PW_HASH = 'a4f795ba6225c5311dcb48a4711fcc924eaa12add1272435413ba06d1c4d1173';
const STORAGE_KEY_PW  = 'qc_pw_hash';
const STORAGE_KEY_QS  = 'qc_questions';
const STORAGE_KEY_CFG  = 'qc_cfg';
const STORAGE_KEY_STUDENT = 'qc_student_qs';

let questions = [];
let qId = 0;
let activeQId = null;

// quiz runtime
let quizQs = [];
let quizIdx = 0;
let quizAns = {};
let quizCfg = {};
let timerInt = null;
let timerLeft = 0;
let answered = false;


// ══════════════════════════════════════════════════════
//  PASSWORD
// ══════════════════════════════════════════════════════
async function hashStr(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function getStoredHash(){ return localStorage.getItem(STORAGE_KEY_PW) || DEFAULT_PW_HASH; }

async function checkPw(){
  const val = document.getElementById('pw-input').value;
  const err = document.getElementById('pw-error');
  const inputHash = await hashStr(val);
  if(inputHash === getStoredHash()){
    err.style.display='none';
    document.getElementById('pw-input').value='';
    loadSaved();
    showView('editor-view');
    renderSidebar();
    renderEditor();
  } else {
    err.style.display='block';
    document.getElementById('pw-input').value='';
  }
}

async function savePw(){
  const v = document.getElementById('new-pw').value.trim();
  if(!v){alert('Şifrə boş ola bilməz!');return;}
  const h = await hashStr(v);
  localStorage.setItem(STORAGE_KEY_PW, h);
  document.getElementById('new-pw').value='';
  const msg = document.getElementById('pw-saved-msg');
  msg.style.display='block';
  setTimeout(()=>msg.style.display='none', 2500);
}

function goStudentMode(){
  if(!questions.length){alert('Müəllim hələ test əlavə etməyib.');return;}
  startQuiz();
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

function parsePdfText(text){
  const results=[];
  text = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');

  // Split on lines that start with a question number (e.g. "1." or "1)")
  const qRegex = /(?:^|\n)[ \t]*(\d+)[.)]\s+(.+?)(?=\n[ \t]*\d+[.)]\s|\s*$)/gs;

  let m;
  while((m=qRegex.exec(text))!==null){
    const block = m[2].trim();
    const lines = block.split('\n').map(l=>l.trim()).filter(l=>l);
    if(!lines.length) continue;

    const questionText = lines[0];
    const opts=[];
    let correctLetter=null;

    for(const line of lines){
      // Match option lines: A) text  or  A. text
      const optMatch = line.match(/^([A-Da-d])[.)]\s+(.+)/);
      if(optMatch){
        opts.push(optMatch[2].trim());
        continue;
      }
      // Match answer line
      const ansMatch = line.match(/(?:cavab|answer|düzgün)[:\s]+([A-Da-d])/i);
      if(ansMatch && !correctLetter){
        correctLetter = ansMatch[1].toUpperCase();
      }
    }

    const correctIdx = correctLetter ? 'ABCD'.indexOf(correctLetter) : 0;

    let q;
    if(opts.length>=2){
      while(opts.length<4) opts.push('');
      q={ type:'mc', text:questionText, options:opts.slice(0,4), correctOption:correctIdx>=0?correctIdx:0, tfAnswer:true, shortAnswer:'', fillText:'', fillAnswers:[], points:1 };
    } else if(/\b(doğru|yanlış|true|false|T\/F)\b/i.test(block)){
      const ans=/\b(doğru|true)\b/i.test(block);
      q={ type:'tf', text:questionText, options:['','','',''], correctOption:0, tfAnswer:ans, shortAnswer:'', fillText:'', fillAnswers:[], points:1 };
    } else if(/\[blank\]/i.test(block)){
      const ans=(block.match(/cavab[:\s]+(.+)/i)||[])[1]||'';
      q={ type:'fill', text:questionText, options:['','','',''], correctOption:0, tfAnswer:true, shortAnswer:'', fillText:questionText, fillAnswers:[ans], points:1 };
    } else {
      const ans=(block.match(/(?:cavab|answer)[:\s]+(.+)/i)||[])[1]||'';
      q={ type:'short', text:questionText, options:['','','',''], correctOption:0, tfAnswer:true, shortAnswer:ans, fillText:'', fillAnswers:[], points:1 };
    }
    results.push(q);
  }
  return results;
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
    const names=['questions','settings','pdf','topics'];
    t.classList.toggle('active', names[i]===name);
  });
  document.querySelectorAll('.sidebar-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='topics') renderTopics();
}

function addQuestion(type='mc'){
  const id=++qId;
  const q={id,type,text:'',options:['','','',''],correctOption:0,tfAnswer:true,shortAnswer:'',fillText:'',fillAnswers:[],points:1,topic:'',_fromPdf:false};
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
      <span class="q-preview">${q.text||'(sual mətni yoxdur)'}</span>
      <span class="q-type-badge">${tlbl(q.type)}</span>
      <button class="q-del" onclick="event.stopPropagation();deleteQ(${q.id})">✕</button>
    </div>`).join('');
}

function tlbl(t){return{mc:'ÇS',tf:'D/Y',short:'Qısa',fill:'Boşluq'}[t]||t;}

function renderTopics(){
  const el = document.getElementById('topics-list');
  if(!el) return;
  const emptyCount = questions.filter(q=>!q.topic?.trim()).length;
  const topics = [...new Set(questions.map(q=>q.topic?.trim()).filter(Boolean))];
  const published = (() => { try{ return JSON.parse(localStorage.getItem(STORAGE_KEY_STUDENT)||'{}').topic||''; }catch(e){return '';} })();

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

  const listHtml = topics.length ? topics.map(topic=>{
    const count = questions.filter(q=>q.topic?.trim()===topic).length;
    const isActive = topic === published;
    return`<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div>
        <div style="font-size:13px;font-weight:600;color:${isActive?'var(--accent3)':'var(--text)'}">${esc(topic)}${isActive?' ✓':''}</div>
        <div style="font-size:11px;color:var(--muted)">${count} sual</div>
      </div>
      <button class="btn btn-sm ${isActive?'btn-accent3':'btn-ghost'}" onclick="publishTopic('${esc(topic).replace(/'/g,"\\'")}')">
        ${isActive?'✓ Göndərilib':'📤 Göndər'}
      </button>
    </div>`;
  }).join('') : '<div style="padding:16px;font-size:12px;color:var(--muted)">Hələ mövzu yoxdur.<br/>Sual kartlarında <strong>Mövzu</strong> sahəsini doldurun.</div>';

  el.innerHTML = bulkHtml + listHtml;
}

function assignBulkTopic(){
  const input = document.getElementById('bulk-topic-input');
  const name = input?.value.trim();
  if(!name) return;
  let changed = 0;
  questions.forEach(q=>{ if(!q.topic?.trim()){ q.topic = name; changed++; } });
  if(!changed){ renderTopics(); return; }
  saveQs();
  renderSidebar();
  renderEditor();
  renderTopics();
  // Show confirmation
  const el = document.getElementById('topics-list');
  const banner = document.createElement('div');
  banner.style.cssText='padding:10px 16px;background:rgba(67,232,176,.12);border-bottom:1px solid rgba(67,232,176,.2);font-size:12px;color:var(--accent3);font-weight:600';
  banner.textContent=`✓ ${changed} sual "${name}" mövzusuna əlavə edildi`;
  el.prepend(banner);
  setTimeout(()=>banner.remove(), 3000);
}

function publishTopic(topicName){
  const filtered = questions.filter(q=>q.topic?.trim()===topicName);
  if(!filtered.length) return;
  localStorage.setItem(STORAGE_KEY_STUDENT, JSON.stringify({questions: filtered, topic: topicName}));
  renderTopics();
  // Brief confirmation
  const el = document.getElementById('topics-list');
  const banner = document.createElement('div');
  banner.style.cssText='padding:10px 16px;background:rgba(67,232,176,.12);border-bottom:1px solid rgba(67,232,176,.2);font-size:12px;color:var(--accent3);font-weight:600';
  banner.textContent=`✓ "${topicName}" tələbə səhifəsinə göndərildi`;
  el.prepend(banner);
  setTimeout(()=>banner.remove(), 3000);
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
  const L=['A','B','C','D'];
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
function updF(id,f,v){const q=getQ(id);if(q){q[f]=v;if(f==='text'){const el=document.querySelector(`.q-item[data-id="${id}"] .q-preview`);if(el)el.textContent=v||'(sual mətni yoxdur)';}saveQs();}}
function updOpt(id,i,v){const q=getQ(id);if(q){q.options[i]=v;saveQs();}}
function updFill(id,v){const q=getQ(id);if(q){q.fillAnswers=v.split(';').map(s=>s.trim());saveQs();}}
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
    const L=['A','B','C','D'];
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
  showFb(idx===correct,quizCfg.showAnswers?(idx===correct?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+['A','B','C','D'][correct]):(idx===correct?'✓ Düzdür!':'✗ Yanlış'));
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
  if(q.type==='mc'){ok=saved===q.correctOption;msg=ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+['A','B','C','D'][q.correctOption];}
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
  const L=['A','B','C','D'];
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
//  PRELOADED QUESTIONS (from via_kollokvium_suallar PDF)
// ══════════════════════════════════════════════════════
const PRELOADED_QUESTIONS = [{"id":1,"type":"mc","text":"Data analysis nədir?","options":["Mövcud datanı analiz edərək qərar verməyə kömək edən proses","Gizli nümunələri aşkar etmə prosesi","Data saxlama prosesi","Data silmə prosesi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":2,"type":"mc","text":"Strukturlaşdırılmış dataya nümunə göstərin","options":["Excel cədvəli, SQL verilənlər bazası","Sosial media şəkilləri","E-poçt mətnləri","Audio yazılar"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":3,"type":"mc","text":"ETL nəyin qısaltmasıdır?","options":["Extract, Transform, Load","Enter, Test, Launch","Edit, Transfer, Log","Evaluate, Train, Link"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":4,"type":"mc","text":"Missing value nədir?","options":["Datasettə dəyəri olmayan boş xana","Yanlış yazılmış dəyər","Dublikat sətir","Çox böyük ədəd"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":5,"type":"mc","text":"Outlier nədir?","options":["Digər dəyərlərdən kəskin fərqlənən uçuq dəyər","İtkin dəyər","Ən böyük dəyər","Orta dəyər"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":6,"type":"mc","text":"Strukturlaşdırılmamış dataya nümunə göstərin","options":["Şəkillər, videolar, sosial media yazıları","SQL cədvəlləri","CSV faylları","Excel cədvəlləri"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":7,"type":"mc","text":"Normalizasiya nə üçün istifadə edilir?","options":["Fərqli miqyaslı dəyişənləri müqayisəli hala gətirmək üçün","Datanı silmək üçün","Dublikatları tapmaq üçün","Qrafik çəkmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":8,"type":"mc","text":"Data mining ilə data analysis arasındakı fərq nədir?","options":["Data analysis mövcud datanı izah edir, data mining gizli nümunələr aşkar edir","Onlar eynidir","Data mining daha köhnədir","Data analysis daha mürəkkəbdir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":9,"type":"mc","text":"Analitikanın neçə əsas mərhələsi var?","options":["Descriptive, Diagnostic, Predictive, Prescriptive olmaqla 4 mərhələ","2 mərhələ","6 mərhələ","1 mərhələ"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":10,"type":"mc","text":"Data təmizləmə prosesinin məqsədi nədir?","options":["Xətalı, dublikat və natamam dataları düzəltmək","Datanı şifrələmək","Datanı sıxışdırmaq","Datanı silmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":11,"type":"mc","text":"ETL prosesinin 'Transform' mərhələsində nə baş verir?","options":["Data təmizlənir, formatlanır və çevrilir","Data mənbədən oxunur","Data anbara yüklənir","Data silinir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":12,"type":"mc","text":"Descriptive analytics hansı suala cavab verir?","options":["Nə baş verdi? (What happened?)","Niyə baş verdi?","Nə baş verəcək?","Nə etməliyik?"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":13,"type":"mc","text":"Min-Max normalizasiyası hansı formula ilə hesablanır?","options":["(x - min) / (max - min)","(x - mean) / std","x / max","(x + min) / max"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":14,"type":"mc","text":"Semi-structured data-ya hansı nümunə aiddir?","options":["JSON və XML faylları","Excel cədvəlləri","Düz mətn faylları","Şəkillər"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":15,"type":"mc","text":"Data təmizləmədə 'imputation' nə deməkdir?","options":["Missing dəyərləri orta, median və ya başqa dəyərlərlə əvəz etmək","Bütün sütunu silmək","Dublikatları silmək","Datanı sıralamaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":16,"type":"mc","text":"Predictive analytics nə edir?","options":["Keçmiş dataya əsaslanaraq gələcəyi proqnozlaşdırır","Keçmişi izah edir","Optimal qərar verir","Anomaliyaları aşkar edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":17,"type":"mc","text":"IQR ilə outlier aşkarlamasında hansı qayda istifadə edilir?","options":["Q1 - 1.5×IQR-dan kiçik və Q3 + 1.5×IQR-dan böyük dəyərlər outlier sayılır","Yalnız maksimum outlier sayılır","Orta dəyərdən 2 dəfə böyük olanlar outlier sayılır","Standart sapma ilə müqayisə edilir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":18,"type":"mc","text":"Z-score normalizasiyası üçün hansı formula istifadə edilir?","options":["(x - orta) / standart sapma","(x - min) / (max - min)","x / cəm","x * standart sapma"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":19,"type":"mc","text":"Diagnostic analytics-in əsas sualı hansıdır?","options":["Niyə baş verdi? (Why did it happen?)","Nə baş verdi?","Nə baş verəcək?","Nə etməliyik?"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":20,"type":"mc","text":"MCAR, MAR və MNAR – missing data mexanizmlərini fərqləndirin","options":["MCAR tamamilə təsadüfi, MAR başqa dəyişənlə əlaqəli, MNAR özünün dəyərindən asılıdır","Hamısı eyni şeyi ifadə edir","MCAR ən ciddi problemi göstərir","MAR dataseti tamamilə yararsız edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":21,"type":"mc","text":"ETL vs ELT fərqi nədir?","options":["ETL ənənəvi anbarlarda işləyir, ELT cloud mühitlərində raw data yükləyib sonra çevirir","ETL daha yenidir","ELT yalnız kiçik datasetlər üçündür","Onlar eyni prosesdir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":22,"type":"mc","text":"Data keyfiyyətini ölçmək üçün standart 6 ölçü hansıdır?","options":["Completeness, Consistency, Accuracy, Validity, Uniqueness, Timeliness","Yalnız accuracy və completeness","Sürət, həcm, müxtəliflik","Dəqiqlik, sürət, ölçü"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":23,"type":"mc","text":"Prescriptive analytics ilə predictive analytics fərqi nədir?","options":["Predictive nə baş verəcəyini, prescriptive isə nə etmək lazım olduğunu söyləyir","Onlar eyni mərhələdir","Prescriptive daha az dəqiqdir","Predictive daha çox data tələb edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":24,"type":"mc","text":"Data lineage nədir?","options":["Datanın mənbədən son istifadəyə qədər hərəkətini izləmək, audit və problem həlli üçün vacibdir","Datanın formatını dəyişdirmək prosesidir","Datanı silmək üsuludur","Outlierləri tapmaq metodudur"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":25,"type":"mc","text":"Isolation Forest alqoritmi outlier aşkarlamasında necə işləyir?","options":["Az addımla ayrılan nöqtələri outlier sayır – anomaliyaları ayırmaq daha az bölmə tələb edir","Ən böyük dəyəri outlier elan edir","Orta dəyərdən 3 std uzaqda olanları seçir","Klasterləşdirməyə əsaslanır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":26,"type":"mc","text":"Data Warehouse vs Data Lake vs Data Lakehouse fərqlərini izah edin","options":["DW strukturlu data, Data Lake raw hər cür data, Lakehouse hər ikisini birləşdirir","Üçü eyni texnologiyadır","Data Lake daha köhnədir","Lakehouse yalnız kiçik şirkətlər üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":27,"type":"mc","text":"Excel-də sütunlar hansı işarələrlə göstərilir?","options":["Latın hərfləri ilə (A, B, C...)","Rəqəmlərlə (1, 2, 3...)","Yunan hərfləri ilə","Roma rəqəmləri ilə"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":28,"type":"mc","text":"Excel-də aktiv xananın ünvanı harada göstərilir?","options":["Name Box-da (sol yuxarı küncdə)","Formula bar-da","Status bar-da","Ribbon-da"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":29,"type":"mc","text":"Excel-də 'Freeze Panes' funksiyası nə üçün istifadə edilir?","options":["Sütun və sırları hərəkətsiz saxlamaq üçün","Xananı silmək üçün","Datanı sıralamaq üçün","Şrift ölçüsünü dəyişmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":30,"type":"mc","text":"Excel-də Sort funksiyası nə edir?","options":["Datanı müəyyən sütuna görə artan ya azalan qaydada sıralayır","Datanı filtrləyir","Datanı silir","Datanı kopyalayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":31,"type":"mc","text":"Excel-də mətn data tipi necə hizalanır?","options":["Sol tərəfə hizalanır","Sağ tərəfə hizalanır","Mərkəzə hizalanır","Yuxarıya hizalanır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":32,"type":"mc","text":"Excel-də rəqəm data tipi necə hizalanır?","options":["Sağ tərəfə hizalanır","Sol tərəfə hizalanır","Mərkəzə hizalanır","Yuxarıya hizalanır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":33,"type":"mc","text":"Excel-də Filter funksiyası nə işə yarayır?","options":["Müəyyən kriteriyaya uyğun sətirləri göstərir, qalanlarını gizlədir","Datanı sıralayır","Xanaları birləşdirir","Sütunları gizlədir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":34,"type":"mc","text":"Excel-də yeni sheet əlavə etmək üçün nə etmək lazımdır?","options":["'+' işarəsinə klikləmək və ya Shift+F11","Ctrl+N","Alt+F4","F5 düyməsinə basmaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":35,"type":"mc","text":"Excel-də Advanced Filter ilə adi Filter arasındakı fərq nədir?","options":["Advanced Filter mürəkkəb kriteriyalar və başqa yerə çıxarma imkanı verir","Onlar eynidir","Advanced Filter daha yavaşdır","Adi Filter daha çox seçim verir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":36,"type":"mc","text":"Excel-də 'Text to Columns' xüsusiyyəti nə üçün istifadə edilir?","options":["Bir sütundakı mətni ayırıcı işarəyə görə bir neçə sütuna bölmək üçün","Sütunları birləşdirmək üçün","Mətni silmək üçün","Rəqəmlər əlavə etmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":37,"type":"mc","text":"Excel-də 'Data Validation' tətbiq edildikdə nə baş verir?","options":["Xanaya daxil edilə biləcək dəyərlər məhdudlaşdırılır","Xana silinir","Xana qorunur","Xana boş qalır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":38,"type":"mc","text":"Excel-də cədvəl (Table) formatına çevirdikdə hansı üstünlüklər əldə edilir?","options":["Avtomatik filter, strukturlaşdırılmış istinadlar və dinamik genişlənmə","Yalnız rəng dəyişir","Formullar silinir","Fayl ölçüsü azalır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":39,"type":"mc","text":"Excel-də Flash Fill xüsusiyyəti necə işləyir?","options":["Nümunəyə əsasən qonşu sütundakı datanı avtomatik tamamlayır","Xanaları avtomatik doldurur","Formulları kopyalayır","Datanı filtrləyir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":40,"type":"mc","text":"Excel-də 'Find & Replace'-də Wildcard (*) nə deməkdir?","options":["İstənilən sayda istənilən simvolu təmsil edir","Yalnız rəqəmləri axtarır","Boş xanaları tapar","Xüsusi simvoldur"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":41,"type":"mc","text":"Excel-də 'Conditional Formatting' nə üçün istifadə edilir?","options":["Müəyyən şərtlərə görə xanaların görünüşünü avtomatik dəyişmək üçün","Xanaları silmək üçün","Formullar yazmaq üçün","Datanı sıralamaq üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":42,"type":"mc","text":"Excel-də 'Custom Sort' nə imkan verir?","options":["Çoxlu sütuna görə ardıcıl sıralama aparmaq","Yalnız bir sütuna görə sıralama","Sıralama istiqamətini dəyişmək","Yalnız rənglərə görə sıralama"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":43,"type":"mc","text":"Excel-də Power Query nədir və adi data cleaning metodlarından üstünlüyü nədir?","options":["Power Query ETL prosesini avtomatlaşdırır, addımları yadda saxlayır, yenilənə bilən iş axını yaradır","Sadəcə sütun silmə vasitəsidir","Power Query yalnız SQL faylları üçündür","Power Query köhnə Excel versiyalarında işləmir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":44,"type":"mc","text":"Excel-də strukturlaşdırılmış cədvəl (Table) və adi Range arasındakı texniki fərqlər nədir?","options":["Cədvəl strukturlaşdırılmış istinadlar, dinamik genişlənmə, avtomatik filter və DAX inteqrasiyası verir","Yalnız görünüş fərqi var","Cədvəl daha yavaş işləyir","Cədvəldə formullar yazılamaz"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":45,"type":"mc","text":"Excel-də 1 milyondan çox sətiri olan dataseti effektiv emal etmək üçün hansı strategiyalar var?","options":["Power Query ilə filtrlənmiş yükləmə, Power Pivot ilə xarici data modeli, ya da hissə-hissə oxuma","Sadəcə gözləmək lazımdır","Datanı çap etmək","Faylı bölmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":46,"type":"mc","text":"Excel-də data cleaning üçün TRIM, CLEAN, SUBSTITUTE funksiyaları nə üçün istifadə edilir?","options":["TRIM əlavə boşluqları silir, CLEAN çap olunmayan simvolları silir, SUBSTITUTE müəyyən simvolu əvəz edir","Hamısı eyni işi görür","Yalnız rəqəmli datada işləyir","Formulları dəyişmək üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":47,"type":"mc","text":"Excel-də 'Get & Transform' iş axınında hər addımın qeyd edilməsinin üstünlüyü nədir?","options":["Hər addım M kodu kimi saxlanır, data yeniləndikdə bütün transformasiyalar avtomatik tətbiq edilir","Daha çox yer tutur","Faylı yavaşladır","Yalnız bir dəfə istifadə edilə bilər"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":48,"type":"mc","text":"Excel-də circular reference nədir, nə vaxt yaranır?","options":["Formula özünü birbaşa/dolayı yolla özünə istinad etdikdə yaranır; iterativ hesablama aktivləşdirilə bilər","Yanlış formula adıdır","Xana boş qaldıqda yaranır","Sütunlar uyğunsuz olduqda yaranır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":49,"type":"mc","text":"Excel-də çoxlu mənbədən gələn dataları birləşdirərkən tipik uyğunsuzluq problemlərini necə həll etmək olar?","options":["Power Query-də tip çevirmə, birləşdirmə açarı standardizasiyası və TRIM+PROPER kimi funksiyalarla","Dataları əl ilə birləşdirmək","Hər faylı ayrıca saxlamaq","Yalnız eyni formatda faylları birləşdirmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":50,"type":"mc","text":"Excel-də SUM funksiyasının sintaksisi necədir?","options":["=SUM(ədəd1, ədəd2,...) və ya =SUM(aralıq)","=@TOPLA(ədəd1,ədəd2)","=@ADD(aralıq)","=@PLUS(A1:A10)"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":51,"type":"mc","text":"Excel-də COUNT funksiyası nə sayır?","options":["Seçilmiş aralıqdakı rəqəmli xanaların sayını","Bütün dolu xanaların sayını","Boş xanaların sayını","Mətn xanalarının sayını"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":52,"type":"mc","text":"Excel-də IF funksiyasının strukturu necədir?","options":["=IF(şərt, doğrusa_dəyər, yanlışsa_dəyər)","=@IF(@dəyər1, dəyər2)","=@IF(@şərt, dəyər)","=IF(dəyər1, dəyər2)"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":53,"type":"mc","text":"Excel-də VLOOKUP nə üçün istifadə edilir?","options":["Sol sütunda dəyər axtarıb, həmin sətirdən istənilən sütunun dəyərini qaytarmaq üçün","Datanı sıralamaq üçün","Orta hesablamaq üçün","Şərtli formatlama üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":54,"type":"mc","text":"Excel-də MIN funksiyası nə qaytarır?","options":["Seçilmiş aralıqdakı ən kiçik dəyəri","Ən böyük dəyəri","Ortanı","Cəmi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":55,"type":"mc","text":"Excel-də MAX funksiyası nə qaytarır?","options":["Seçilmiş aralıqdakı ən böyük dəyəri","Ən kiçik dəyəri","Ortanı","Cəmi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":56,"type":"mc","text":"Excel-də COUNTA funksiyası nə sayır?","options":["Boş olmayan bütün xanaların sayını (mətn daxil)","Yalnız rəqəmli xanaları","Yalnız boş xanaları","Yalnız mətn xanalarını"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":57,"type":"mc","text":"Excel-də VLOOKUP-un 4-cü arqumenti FALSE olduqda nə baş verir?","options":["Dəqiq uyğunluq axtarılır","Təxmini uyğunluq axtarılır","Funksiya xəta qaytarır","Bütün sütun axtarılır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":58,"type":"mc","text":"Excel-də INDEX və MATCH-in VLOOKUP-dan üstünlüyü nədir?","options":["Yalnız sol sütunda deyil, istənilən sütunda axtarır; sütun əlavə etdikdə sınmır","Onlar eyni iş görür","VLOOKUP daha sürətlidir","INDEX+MATCH daha çox RAM tələb edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":59,"type":"mc","text":"Excel-də SUMIF funksiyası necə işləyir?","options":["Müəyyən şərtə uyğun xanaların cəmini hesablayır: =SUMIF(şərt_aralığı, şərt, cəm_aralığı)","Bütün xanaların cəmini hesablayır","Yalnız neqativ dəyərləri toplar","Şərtli sıralama aparır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":60,"type":"mc","text":"Excel-də IFERROR funksiyası nə üçün istifadə edilir?","options":["Xəta qaytaran formulun nəticəsini başqa dəyərlə əvəz etmək üçün","Şərt yoxlamaq üçün","Xətalı xanaları silmək üçün","Formula yazmaq üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":61,"type":"mc","text":"Excel-də XLOOKUP-un VLOOKUP-dan üstünlükləri nədir?","options":["İstənilən istiqamətdə axtarır, tapılmayan halda default dəyər verir, sütun nömrəsi əvəzinə birbaşa aralıq göstərilir","Onlar eynidir","VLOOKUP daha sürətlidir","XLOOKUP yalnız Excel 2010-da var"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":62,"type":"mc","text":"Excel-də COUNTIF funksiyası necə yazılır?","options":["=COUNTIF(aralıq, şərt)","=COUNT(aralıq, şərt)","=COUNTA(şərt, aralıq)","=COUNTIFS(aralıq)"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":63,"type":"mc","text":"Excel-də nested IF (iç-içə IF) nədir?","options":["IF funksiyasının içinə başqa IF yazılması","İki IF funksiyasını toplamaq","IF ilə SUM birlikdə istifadə etmək","IFERROR funksiyası"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":64,"type":"mc","text":"Excel-də LEFT, RIGHT, MID funksiyaları nə üçün istifadə edilir?","options":["Mətn daxilindən müəyyən sayda simvol çıxarmaq üçün","Mətni silmək üçün","Mətni birləşdirmək üçün","Mətni rəqəmə çevirmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":65,"type":"mc","text":"Excel-də SUMPRODUCT funksiyası nə edir?","options":["İki və ya daha çox aralığın elementlərini vurub cəmini hesablayır","Yalnız cəm hesablayır","Yalnız vurma əməliyyatı aparır","Şərtli filtrasiya edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":66,"type":"mc","text":"Excel-də dinamik massiv formulları (FILTER, SORT, UNIQUE) ənənəvi formullardan necə fərqlənir?","options":["Nəticəni avtomatik olaraq bitişik xanalara dökür (spill), Ctrl+Shift+Enter tələb etmir","Onlar eyni işi görür","Daha yavaş hesablayırlar","Yalnız Excel Online-da işləyirlər"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":67,"type":"mc","text":"Excel-də LAMBDA funksiyası nə üçün istifadə edilir?","options":["İstifadəçi tərəfindən müəyyən edilmiş yenidən istifadə olunan funksiya yaratmaq üçün","Yalnız riyazi əməliyyatlar üçün","Digər funksiyaları silmək üçün","Şərtli formatlama üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":68,"type":"mc","text":"Excel-də LET funksiyası nə üçün istifadə edilir?","options":["Formulda dəyişkənlər müəyyən edərək hesablamanı bir dəfə aparmaq və formulun oxunmasını asanlaşdırmaq","Sıraları silmək üçün","Cədvəl yaratmaq üçün","Şərtli formatlama üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":69,"type":"mc","text":"Excel-də OFFSET funksiyası nədir və hansı riskləri var?","options":["Başlanğıc xanadan sürüşdürülmüş aralıq qaytarır; volatile-dir, böyük modelləri yavaşlada bilər","Xananı başqa yerə köçürür","Sütun nömrəsini dəyişir","Sütunu siler"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":70,"type":"mc","text":"Excel-də Power Pivot-da DAX ilə adi Excel formulları arasındakı fərq nədir?","options":["DAX sütun əvəzinə bütün cədvəl üzərində işləyir, context-aware-dir, milyonlarla sətiri effektiv emal edir","Onlar eyni dildir","DAX daha sadədir","DAX yalnız hesablama üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":71,"type":"mc","text":"Excel-də XLOOKUP-da 'match_mode' parametri nə işə yarayır?","options":["Dəqiq, təxmini, wildcard uyğunluq arasında seçim etməyə imkan verir","Axtarış istiqamətini dəyişir","Qaytarma sütununu seçir","Aralığı müəyyən edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":72,"type":"mc","text":"Excel-də böyük həcmli datada COUNTIFS yerinə niyə SUMPRODUCT daha effektiv ola bilər?","options":["SUMPRODUCT volatile deyil, massiv məntiqini elastik tətbiq edir, mürəkkəb çox şərtli sayımı asan ifadə edir","COUNTIFS artıq mövcud deyil","SUMPRODUCT daha sürətlidir","COUNTIFS yalnız kiçik datasetlər üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":73,"type":"mc","text":"Excel-də 3D formullar nədir?","options":["Eyni xana ünvanını bir neçə vərəq üzərindən hesablamaq: =SUM(Vərəq1:Vərəq5!B10)","3 ölçülü diaqram yaratmaq","Üç sütun üzərindən hesablama","3 şərtli IF formulası"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":74,"type":"mc","text":"Excel-də Pivot Table nə üçün istifadə edilir?","options":["Böyük həcmli datanı ümumiləşdirmək, qruplaşdırmaq və analiz etmək üçün","Şəkil əlavə etmək üçün","Xanaları birləşdirmək üçün","Formullar yazmaq üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":75,"type":"mc","text":"Pivot Table-da 'Values' sahəsi nəyi bildirir?","options":["Hesablanacaq rəqəmli dəyərləri (cəm, say, orta və s.)","Filtrasiya üçün sahəni","Sütun başlıqlarını","Sıra başlıqlarını"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":76,"type":"mc","text":"Pivot Table-a Slicer əlavə etmək nə üçün istifadə edilir?","options":["Vizual interaktiv filtrasiya paneli yaratmaq üçün","Diaqram əlavə etmək üçün","Sıraları silmək üçün","Formullar yazmaq üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":77,"type":"mc","text":"Pivot Chart nədir?","options":["Pivot Table-a əsaslanan interaktiv qrafik","Adi Excel qrafiki","Şəkil formatında pivot","SQL qrafiki"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":78,"type":"mc","text":"Pivot Table-da data yeniləndikdə nə etmək lazımdır?","options":["'Refresh' düyməsinə basmaq","Faylı yenidən açmaq","Pivot Table-ı silmək","Yeni Pivot yaratmaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":79,"type":"mc","text":"Dashboard dizaynında Slicer-lərin əsas üstünlüyü nədir?","options":["Bir neçə Pivot Table-ı eyni zamanda idarə edə bilmək","Yalnız bir pivot table-a təsir edir","Datanı silir","Formulları dəyişir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":80,"type":"mc","text":"Pivot Table yaratmaq üçün datanın ilk şərti nədir?","options":["Datanın başlıq (header) sırası olmalıdır","Data rəqəm olmalıdır","Data boş olmamalıdır","Data sıralanmalıdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":81,"type":"mc","text":"Pivot Table-da 'Grand Total' nə göstərir?","options":["Bütün sıra və sütunların ümumi cəmini","Orta dəyəri","Maksimum dəyəri","Minimum dəyəri"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":82,"type":"mc","text":"Pivot Table-da 'Calculated Field' nə üçün istifadə edilir?","options":["Mövcud sahələr əsasında yeni formullu sütun yaratmaq üçün","Xana silmək üçün","Pivot-u köçürmək üçün","Slicer əlavə etmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":83,"type":"mc","text":"Pivot Table-da 'Show Values As' seçimindən istifadə edərək nə əldə etmək olar?","options":["% of Total, Running Total, Difference From kimi hesablamalar","Yalnız cəm göstərmək","Pivot-u ixrac etmək","Sütun adını dəyişmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":84,"type":"mc","text":"Pivot Table-da 'Group' xüsusiyyəti ilə tarixlər necə qruplaşdırıla bilər?","options":["İl, rüb, ay, həftə, gün kimi hər hansı birləşmədə","Yalnız ilə görə","Yalnız aya görə","Yalnız günə görə"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":85,"type":"mc","text":"Bir neçə Pivot Table-ı eyni Slicer ilə idarə etmək üçün nə etmək lazımdır?","options":["Slicer-ə sağ klik → 'Report Connections' seçib digər pivot table-ları işarələmək","Hər pivot üçün ayrı slicer yaratmaq","Datanı kopyalamaq","Pivot-ları birləşdirmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":86,"type":"mc","text":"Pivot Table-da 'Value Field Settings'-dən istifadə edərək nələri dəyişmək olar?","options":["Hesablama tipi (Sum, Count, Average, Max, Min) və rəqəm formatı","Yalnız sütun adını","Yalnız rəngi","Yalnız sıra sıralamasını"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":87,"type":"mc","text":"Dashboard-da Slicer ilə Timeline arasındakı fərq nədir?","options":["Timeline yalnız tarix sahələrinə əsaslanan xüsusi zaman filtridir, Slicer hər tip sahə üçündür","Onlar eynidir","Timeline daha köhnə xüsusiyyətdir","Slicer yalnız tarix üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":88,"type":"mc","text":"Pivot Table üçün ən uyğun data strukturu hansıdır?","options":["Hər sütunun bir dəyişəni, hər sətrin bir müşahidəni təmsil etdiyi 'flat' cədvəl","Ümumiləşdirilmiş hesabat formatı","Birləşdirilmiş xanalı cədvəl","Çox sütunlu başlıqlı cədvəl"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":89,"type":"mc","text":"Pivot Table-da Drill Down xüsusiyyəti nə deməkdir?","options":["Ümumiləşdirilmiş nəticənin arxasındakı detalları görmək üçün iki dəfə klikləmək","Pivotu silmək","Sütun əlavə etmək","Formatlamaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":90,"type":"mc","text":"Excel-da Power Pivot ilə adi Pivot Table-ın fərqləri nədir?","options":["Power Pivot milyonlarla sətiri emal edir, Data Model yaradır, çoxlu cədvəl əlaqəsi qurur, DAX dəstəkləyir","Yalnız ölçü fərqi var","Power Pivot yalnız SQL üçündür","Adi Pivot Table daha güclüdür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":91,"type":"mc","text":"Excel-də Power BI ilə Excel Pivot Table arasındakı fərqləri müzakirə edin","options":["Power BI paylaşım, real-time yeniləmə, mürəkkəb DAX, R/Python inteqrasiyası təmin edir","Onlar eyni məhsuldur","Excel daha güclüdür","Power BI yalnız bulud üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":92,"type":"mc","text":"Pivot Table-da Calculated Item ilə Calculated Field arasındakı fərq nədir?","options":["Calculated Item sıra/sütun elementlərinə yeni element əlavə edir, Calculated Field dəyər sahəsinə yeni hesablama əlavə edir","Onlar eynidir","Calculated Item daha güclüdür","Calculated Field element yaradır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":93,"type":"mc","text":"Excel dashboardunda KPI kartlarını Pivot Table olmadan formullarla qurmaq üçün hansı yanaşma istifadə edilir?","options":["SUMIFS+COUNTIFS+dinamik başlıq kombinasiyası, named ranglar ilə strukturlaşdırılmış hesablamalar","Yalnız Pivot Table istifadə etmək","Power BI-a keçmək","Hər karta ayrıca sheet yaratmaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":94,"type":"mc","text":"Excel-da dashboard performansını artırmaq üçün nələrdən çəkinmək lazımdır?","options":["Volatile formullar (OFFSET, INDIRECT, NOW), həddən artıq şərtli formatlama, çox böyük named aralıqlar","Yalnız Pivot Table istifadə etmək","Slicer əlavə etmək","Diaqram çəkmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":95,"type":"mc","text":"Pivot Table-da 'Defer Layout Update' seçiminin məqsədi nədir?","options":["Çoxlu sahə dəyişikliyi zamanı hesablamanı saxlayıb son anda yeniləmək, böyük datada performansı artırır","Pivot-u gizlətmək","Pivot-u silmək","Xətalı pivot-u düzəltmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":96,"type":"mc","text":"Excel-də CUBE funksiyaları (CUBEMEMBER, CUBEVALUE) nədir?","options":["Data Model və ya OLAP küpündən birbaşa hüceyrəyə dəyər çəkmək üçün istifadə olunan formullar","Pivot table növüdür","Diaqram tipidir","Filtrasiya metodudur"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":97,"type":"mc","text":"SQL-da SELECT operatoru nə üçün istifadə edilir?","options":["Cədvəldən sütunları seçib nəticəni göstərmək üçün","Yeni cədvəl yaratmaq üçün","Datanı silmək üçün","Cədvəl adını dəyişmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":98,"type":"mc","text":"SQL-da WHERE şərtinin rolu nədir?","options":["SELECT sorğusunda sətirləri müəyyən şərtə görə filtrləmək","Sütunları sıralamaq","Cədvəlləri birləşdirmək","Datanı qruplaşdırmaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":99,"type":"mc","text":"SQL-da ORDER BY nə edir?","options":["Nəticəni müəyyən sütuna görə artan (ASC) ya azalan (DESC) sıralayır","Datanı filtrləyir","Cədvəlləri birləşdirir","Sütunları silir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":100,"type":"mc","text":"SQL-da PRIMARY KEY nədir?","options":["Cədvəlin hər sırını unikal şəkildə müəyyən edən sütun","Ən böyük dəyər","Birinci sütun","Xarici açar"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":101,"type":"mc","text":"SQL-da LIMIT operatoru nə edir?","options":["Sorğu nəticəsindəki sıraların sayını məhdudlaşdırır","Sütunları məhdudlaşdırır","Cədvəl ölçüsünü azaldır","Datanı sıralayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":102,"type":"mc","text":"SQL-da AND operatoru nə edir?","options":["İki şərtin ikisi də doğru olduqda nəticəni göstərir","İki şərtin birinin doğru olması kifayətdir","Şərti inkar edir","Şərtlər arasında seçim edir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":103,"type":"mc","text":"SQL-da SELECT * FROM tablename sorğusu nə qaytarır?","options":["Cədvəlin bütün sütun və sırlarını","Yalnız ilk sütunu","Yalnız ilk sırı","Yalnız sayı"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":104,"type":"mc","text":"SQL-da NOT operatoru nə edir?","options":["Şərtin mənasını tərsinə çevirir","Şərtləri birləşdirir","Datanı silir","Sütunları seçir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":105,"type":"mc","text":"SQL-da BETWEEN operatoru necə işləyir?","options":["Dəyər iki hüdud arasında olduqda TRUE qaytarır: WHERE yaş BETWEEN 18 AND 65","Yalnız daha böyük yoxlayır","Yalnız daha kiçik yoxlayır","Bərabərlik yoxlayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":106,"type":"mc","text":"SQL-da LIKE operatoru nə üçün istifadə edilir?","options":["Şablon üzrə mətn axtarışı üçün: '%ali%' ali sözünü içərən dəyərləri tapır","Tam bərabərlik üçün","Rəqəm müqayisəsi üçün","Tarix müqayisəsi üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":107,"type":"mc","text":"SQL-da NULL dəyərini yoxlamaq üçün hansı syntax istifadə edilir?","options":["WHERE sütun IS NULL","WHERE sütun = NULL","WHERE sütun == NULL","WHERE sütun NULL"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":108,"type":"mc","text":"SQL-da SELECT DISTINCT nə üçün istifadə edilir?","options":["Dublikat dəyərləri çıxarıb unikal dəyərləri göstərmək","Dəyərləri sıralamaq","Maksimum dəyəri tapmaq","Cəm hesablamaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":109,"type":"mc","text":"SQL-da sütuna alias vermək üçün nə istifadə edilir?","options":["AS açar sözü: SELECT adı AS ad FROM cədvəl","RENAME açar sözü","CHANGE açar sözü","ALIAS açar sözü"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":110,"type":"mc","text":"SQL-da IN operatoru nə edir?","options":["Dəyərin siyahıdakı elementlərdən birinə bərabər olub olmadığını yoxlayır","İki cədvəli birləşdirir","Maksimum dəyəri tapır","Datanı sıralayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":111,"type":"mc","text":"SQL-da WHERE sütun LIKE 'A%' nə qaytarır?","options":["A hərfi ilə başlayan bütün dəyərləri","A hərfi ilə bitən dəyərləri","A hərfini içərən dəyərləri","Yalnız 'A' dəyərini"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":112,"type":"mc","text":"SQL-da COALESCE funksiyası nə edir?","options":["Siyahıdakı ilk NULL olmayan dəyəri qaytarır","Bütün NULL dəyərləri silir","Dəyərləri birləşdirir","Cəm hesablayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":113,"type":"mc","text":"SQL-da execution order (icra sırası) hansıdır?","options":["FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT","SELECT → FROM → WHERE → GROUP BY","WHERE → FROM → SELECT → ORDER BY","JOIN → SELECT → WHERE → HAVING"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":114,"type":"mc","text":"SQL-da window function ilə GROUP BY arasındakı əsas fərq nədir?","options":["Window function sıraları qruplaşdırmadan analiz edir, hər sıra üçün ayrı nəticə qaytarır","Onlar eyni işi görür","GROUP BY daha güclüdür","Window function daha yavaşdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":115,"type":"mc","text":"SQL-da CTE ilə subquery arasındakı fərqlər nədir?","options":["CTE oxunaqlıdır, rekursiv ola bilir, eyni sorğuda bir neçə dəfə istinad edilə bilir","Onlar eynidir","Subquery daha güclüdür","CTE daha yavaşdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":116,"type":"mc","text":"SQL-da index nədir və sorğu performansına təsiri necədir?","options":["Index sütunun sıralanmış kopyasını yaradaraq axtarışı sürətləndirir, lakin yazma əməliyyatlarını yavaşladır","Index datanı sıxışdırır","Index datanı şifrələyir","Index dublikatları aradan qaldırır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":117,"type":"mc","text":"SQL-da CASE WHEN ifadəsi necə işləyir?","options":["Şərtlərə görə fərqli dəyərlər qaytaran Excel IF-in SQL ekvivalentidir","Döngü yaradır","Funksiya çağırır","Cədvəl yaradır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":118,"type":"mc","text":"SQL-da NULL dəyərləri aqreqat funksiyalarda necə davranır?","options":["NULL dəyərləri aqreqat funksiyalar tərəfindən avtomatik olaraq ignore edilir","NULL 0 kimi sayılır","NULL ən böyük dəyər kimi sayılır","NULL sətiri xəta verir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":119,"type":"mc","text":"SQL-da normalizasiya (1NF, 2NF, 3NF) nədir?","options":["Datanın dublikatlaşmasını aradan qaldırmaq üçün cədvəl dizayn qaydaları: 1NF atomik dəyərlər, 2NF qismən asılılığı, 3NF tranzitiv asılılığı aradan qaldırır","Datanı kiçik etmək üçün yöntem","Sütunları adlandırma qaydası","Datanı şifrələmə prosesi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":120,"type":"mc","text":"SQL-da EXPLAIN / EXPLAIN ANALYZE komandası nə üçün istifadə edilir?","options":["Sorğunun icra planını göstərərək performans bottleneck-larını aşkar etmək üçün","Datanı izah etmək üçün","Sorğunu düzəltmək üçün","Xətaları silmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":121,"type":"mc","text":"SQL-da COUNT(*) ilə COUNT(sütun) arasındakı fərq nədir?","options":["COUNT(*) bütün sıraları sayır, COUNT(sütun) NULL olmayan dəyərləri sayır","Onlar eynidir","COUNT(*) daha yavaşdır","COUNT(sütun) bütün sıraları sayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":122,"type":"mc","text":"SQL-da GROUP BY nə üçün istifadə edilir?","options":["Datanı sütuna görə qruplaşdırıb hər qrup üçün aqreqat hesablamaq üçün","Datanı sıralamaq üçün","Datanı silmək üçün","Cədvəlləri birləşdirmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":123,"type":"mc","text":"SQL-da HAVING şərti nə üçün istifadə edilir?","options":["GROUP BY ilə yaradılmış qruplara şərt tətbiq etmək üçün","WHERE ilə eynidir","Sıraları filtrləmək üçün","Cədvəl adını dəyişmək üçün"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":124,"type":"mc","text":"SQL-da AVG funksiyası nə hesablayır?","options":["Seçilmiş sütundakı rəqəmlərin orta qiymətini","Maksimum dəyəri","Minimum dəyəri","Cəmi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":125,"type":"mc","text":"SQL-da WHERE ilə HAVING arasındakı əsas fərq nədir?","options":["WHERE qruplaşdırmadan əvvəl sıralara, HAVING isə qruplaşdırmadan sonra qruplara şərt tətbiq edir","Onlar eynidir","HAVING daha əvvəl icra edilir","WHERE qruplara şərt qoyur"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":126,"type":"mc","text":"SQL-da DISTINCT açar sözü nə üçün istifadə edilir?","options":["Dublikat sıraları aradan qaldırıb unikal dəyərləri göstərmək","Datanı sıralamaq","Datanı filtrləmək","Cəm hesablamaq"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":127,"type":"mc","text":"SQL-da MIN funksiyası nəyi tapır?","options":["Sütundakı ən kiçik dəyəri","Ən böyük dəyəri","Orta dəyəri","Cəmi"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":128,"type":"mc","text":"SQL-da GROUP BY olmadan COUNT(*) nə qaytarır?","options":["Bütün cədvəlin sıra sayını","Hər sıranın sayını","Sütun sayını","Xəta qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":129,"type":"mc","text":"SQL-da aqreqat funksiyalar WHERE-də istifadə edilə bilərmi?","options":["Xeyr, aqreqat funksiyalar WHERE-də işləmir, HAVING istifadə edilməlidir","Bəli, hər yerdə istifadə edilə bilir","Yalnız COUNT istifadə edilə bilir","Yalnız SUM istifadə edilə bilir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":130,"type":"mc","text":"SQL-da HAVING COUNT(*) > 1 nə edir?","options":["Bir neçə sıradan ibarət olan qrupları göstərir","Bütün sıraları sayır","Bir sıralı qrupları göstərir","NULL qrupları tapır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":131,"type":"mc","text":"SQL-da DISTINCT COUNT necə yazılır?","options":["COUNT(DISTINCT sütun)","DISTINCT COUNT(sütun)","COUNTD(sütun)","UNIQUE COUNT(sütun)"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":132,"type":"mc","text":"SQL-da GROUP BY çoxlu sütunla işlədikdə nə baş verir?","options":["Hər unikal sütun kombinasiyası üçün ayrı qrup yaranır","Yalnız ilk sütuna görə qruplaşdırılır","Xəta qaytarılır","Yalnız son sütuna görə qruplaşdırılır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":133,"type":"mc","text":"SQL-da HAVING AVG(maas) > 5000 nə edir?","options":["Orta maaşı 5000-dən çox olan qrupları göstərir","Maaşı 5000-dən çox olan sıraları göstərir","Maksimum maaşı 5000-dən çox olan qrupları göstərir","5000-dən çox sıra olan qrupları göstərir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":134,"type":"mc","text":"SQL-da GROUP_CONCAT (MySQL) nə edir?","options":["Qrupdakı dəyərləri birləşdirərək bir mətn sətrinə çevirir","Sətirləri toplamaq üçündür","Sütunları birləşdirir","Cəm hesablayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":135,"type":"mc","text":"SQL-da SELECT-də olmayan sütun GROUP BY-da ola bilərmi?","options":["Bəli, GROUP BY-da SELECT-dəki sütunlardan daha çox sütun ola bilər","Xeyr, yalnız SELECT-dəki sütunlar olmalıdır","Bu xəta verir","Yalnız PostgreSQL-da mümkündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":136,"type":"mc","text":"SQL-da NULL dəyərləri COUNT, SUM, AVG hesablamalarında necə davranır?","options":["COUNT(*) NULL-ları sayır, COUNT(sütun) saymır; SUM/AVG NULL-ları ignore edir","Hamısı NULL-ları 0 kimi sayır","Hamısı xəta qaytarır","Hamısı NULL-ları ən böyük dəyər kimi sayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":137,"type":"mc","text":"SQL-da CUBE vs ROLLUP vs GROUPING SETS fərqlərini izah edin","options":["ROLLUP hiyerarxik, CUBE bütün kombinasiyalar, GROUPING SETS seçilmiş kombinasiyalar üçün cəmlər yaradır","Onlar eynidir","CUBE daha sürətlidir","ROLLUP daha çox imkan verir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":138,"type":"mc","text":"SQL-da ROW_NUMBER, RANK, DENSE_RANK arasındakı fərqlər nədir?","options":["ROW_NUMBER unikal ardıcıl nömrə, RANK bərabər dəyərlərə eyni rank verib boşluq saxlayır, DENSE_RANK boşluq saxlamır","Onlar eynidir","RANK həmişə unikal nömrə verir","DENSE_RANK köhnədir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":139,"type":"mc","text":"SQL-da moving average hesablamaq üçün window function necə yazılır?","options":["AVG(dəyər) OVER (ORDER BY tarix ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)","AVG() OVER ()","GROUP BY tarix","MOVING_AVG(dəyər, 7)"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":140,"type":"mc","text":"SQL-da LAG və LEAD funksiyaları nə edir?","options":["LAG əvvəlki sıradan, LEAD sonrakı sıradan dəyər qaytarır – dəyişiklik analizi üçün","LAG/LEAD xəta qaytarır","LAG maksimum, LEAD minimum tapır","Hər ikisi eyni sıradan dəyər qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":141,"type":"mc","text":"SQL-da sorğu optimallaşdırmasında HAVING əvəzinə WHERE istifadəsinin üstünlüyü nədir?","options":["WHERE qruplaşdırmadan əvvəl sıraları süzür, az data ilə qruplaşdırma aparır, sorğunu sürətləndirir","HAVING daha sürətlidir","Fərq yoxdur","WHERE aqreqat funksiyaları dəstəkləyir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":142,"type":"mc","text":"SQL-da NTILE funksiyası nə edir?","options":["Sıraları N bərabər hissəyə bölüb hər sıraya qrup nömrəsi verir (məs. top 25% üçün)","Sıraları sıralayır","N ədədinə qədər sıra göstərir","N-ci sıradan dəyər qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":143,"type":"mc","text":"SQL-da approximate aggregates (HyperLogLog kimi) nə vaxt istifadə edilir?","options":["Milyardlarla sıranı exact COUNT DISTINCT ilə saymaq çox vaxt apardıqda, 1-2% xəta ilə sürətli nəticə üçün","Həmişə dəqiq nəticə üçün","Kiçik datasetlər üçün","Yalnız string sahələr üçündür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":144,"type":"mc","text":"SQL-da INNER JOIN nə edir?","options":["İki cədvəldə uyğun açar dəyərləri olan sıraları birləşdirir","Bütün sıraları göstərir","Sol cədvəlin bütün sıralarını göstərir","Sağ cədvəlin bütün sıralarını göstərir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":145,"type":"mc","text":"SQL-da LEFT JOIN nədir?","options":["Sol cədvəlin bütün sıralarını, sağ cədvəldən yalnız uyğun sıraları qaytarır","İki cədvəldə yalnız uyğun sıraları qaytarır","Sağ cədvəlin bütün sıralarını qaytarır","Bütün sıraları qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":146,"type":"mc","text":"SQL-da FOREIGN KEY nədir?","options":["Bir cədvəlin başqa cədvəlin PRIMARY KEY-inə istinad edən sütunu","Unikal identifikator","Şifrəli açar","Cədvəlin birinci sütunu"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":147,"type":"mc","text":"SQL-da Relational Database nədir?","options":["Bir-biri ilə əlaqəli cədvəllərdən ibarət verilənlər bazası","Yalnız bir cədvəllik baza","Excel faylı","CSV toplusu"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":148,"type":"mc","text":"SQL-da LEFT JOIN-də sağ cədvəldə uyğunluq tapılmadıqda nə göstərilir?","options":["NULL dəyəri göstərilir","Boş mətn göstərilir","0 göstərilir","Xəta qaytarılır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":149,"type":"mc","text":"SQL-da RIGHT JOIN nədir?","options":["Sağ cədvəlin bütün sıralarını, sol cədvəldən yalnız uyğun sıraları qaytarır","Sol cədvəlin bütün sıralarını qaytarır","Yalnız uyğun sıraları qaytarır","Bütün sıraları qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":150,"type":"mc","text":"SQL-da hansı JOIN yalnız hər iki cədvəldə uyğunluq olan sıraları göstərir?","options":["INNER JOIN","LEFT JOIN","RIGHT JOIN","FULL OUTER JOIN"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":151,"type":"mc","text":"SQL-da JOIN şərtini müəyyən etmək üçün hansı açar söz istifadə edilir?","options":["ON açar sözü","WHERE açar sözü","AND açar sözü","USING açar sözü"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":152,"type":"mc","text":"SQL-da FULL OUTER JOIN nədir?","options":["Hər iki cədvəlin bütün sıralarını qaytarır, uyğunsuz olanlar NULL ilə doldurulur","Yalnız uyğun sıraları qaytarır","Sol cədvəlin bütün sıralarını qaytarır","Sağ cədvəlin bütün sıralarını qaytarır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":153,"type":"mc","text":"SQL-da LEFT JOIN ilə sağ cədvəldə uyğunluğu olmayan sıraları tapmaq üçün nə etmək lazımdır?","options":["WHERE sağ_cədvəl.id IS NULL şərtini əlavə etmək","HAVING istifadə etmək","NOT IN istifadə etmək","EXCEPT istifadə etmək"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":154,"type":"mc","text":"SQL-da SELF JOIN nə zaman istifadə edilir?","options":["Cədvəlin eyni sütununda əlaqəli dəyərləri müqayisə etmək üçün (məs. işçi-müdir əlaqəsi)","Dublikatları tapmaq üçün","Null dəyərləri silmək üçün","İki fərqli cədvəl olmadıqda"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":155,"type":"mc","text":"SQL-da JOIN şərtinə əlavə WHERE şərti əlavə edildikdə nə baş verir?","options":["JOIN-dən sonra nəticə sıraları WHERE şərtinə görə filtrələnir","JOIN şərti dəyişir","NULL dəyərlər silinir","Bütün sıralar göstərilir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":156,"type":"mc","text":"SQL-da ON şərtini WHERE-ə yazmaq ilə ON-a yazmaq arasında LEFT JOIN-də fərq varmı?","options":["Bəli – şərti ON-da yazmaq sağ cədvəl filtrini JOIN öncəsi tətbiq edir, WHERE-də yazmaq isə null sıraları itirir","Heç fərqi yoxdur","WHERE həmişə daha sürətlidir","ON da WHERE da eyni nəticəni verir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":157,"type":"mc","text":"SQL-da çoxlu JOIN yazarkən performansa diqqət etmək niyə vacibdir?","options":["Hər JOIN əlavə Kartezyen hasili yarada bilər, nəticə sətir sayı eksponensial böyüyə bilər","JOIN sayının əhəmiyyəti yoxdur","Daha çox JOIN daha sürətlidir","JOIN sırası performansa təsir etmir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":158,"type":"mc","text":"SQL-da JOIN + GROUP BY birlikdə istifadə edildikdə icra sırası necədir?","options":["FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY","GROUP BY → JOIN → SELECT","WHERE → JOIN → GROUP BY","JOIN → SELECT → GROUP BY"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":159,"type":"mc","text":"SQL-da LEFT JOIN vs LEFT OUTER JOIN fərqi nədir?","options":["Heç fərqi yoxdur, eyni əməliyyatdır, OUTER açar sözü isteğe bağlıdır","LEFT JOIN sol, LEFT OUTER JOIN sağ cədvəli qaytarır","OUTER JOIN NULL dəyərləri silir","LEFT OUTER JOIN daha güclüdür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false},{"id":160,"type":"mc","text":"SQL-da hash join, nested loop join və merge join nədir?","options":["Hash join böyük datasetlər üçün, nested loop indeksli kiçik cədvəl üçün, merge join sıralı cədvəllər üçün optimaldir","Hamısı eyni nəticəni eyni sürətlə verir","Hash join həmişə ən sürətlidir","Nested loop həmişə ən yavaşdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":161,"type":"mc","text":"SQL-da NOT IN vs NOT EXISTS vs LEFT JOIN...IS NULL performans fərqləri nədir?","options":["NOT IN NULL-larla problemlidir; NOT EXISTS optimizer-dən asılı olaraq sürətlidir; LEFT JOIN...IS NULL çox zaman optimallaşdırılır","Hamısı eyni performansı verir","NOT IN həmişə ən sürətlidir","LEFT JOIN həmişə ən yavaşdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":162,"type":"mc","text":"SQL-da semi-join və anti-join nədir?","options":["Semi-join (EXISTS/IN) sağ cədvəldə uyğunluğu olan, anti-join (NOT EXISTS/NOT IN) uyğunluğu olmayan sıraları qaytarır","Semi-join iki cədvəli birləşdirir","Anti-join bütün sıraları qaytarır","Hər ikisi JOIN növüdür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":163,"type":"mc","text":"SQL-da fanout problemi nədir?","options":["JOIN zamanı birə-çox əlaqə dublikatlaşmaya səbəb olduqda aqreqat dəyərləri yanlış hesablanır","JOIN xəta qaytarır","NULL dəyərləri çoxalır","Cədvəl böyüyür"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":164,"type":"mc","text":"SQL-da star schema vs snowflake schema JOIN strategiyaları fərqlidir, niyə?","options":["Star schema mərkəzi fact cədvəlindən birbaşa JOIN, snowflake normallaşdırılmış ölçü cədvəlləri vasitəsilə daha çox JOIN tələb edir","Fərq yoxdur","Snowflake daha az JOIN tələb edir","Star schema daha mürəkkəbdir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":165,"type":"mc","text":"SQL-da non-equality condition ilə JOIN (BETWEEN, >, < ilə) nə vaxt istifadə edilir?","options":["Tarix aralığına, qiymət intervalına görə bir-birini əhatə etməyən aralıqlar arasında birləşmə üçün","Bu sintaksis mövcud deyil","Yalnız string sahələr üçündür","Performans həmişə pisdir"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":166,"type":"mc","text":"SQL-da JOIN sütunlarına index əlavə etmənin performansa təsiri nədir?","options":["Index JOIN sütunlarında axtarışı sürətləndirir, planerin daha effektiv join strategiyası seçməsinə imkan verir","Index performansa təsir etmir","Index JOIN-ı yavaşladır","Yalnız PRIMARY KEY-ə index əlavə edilə bilər"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":3,"_fromPdf":false},{"id":167,"type":"mc","text":"SQL-da Subquery nədir?","options":["Başqa bir SQL sorğusunun içinə yazılmış sorğu","İki cədvəli birləşdirən sorğu","Aqreqat funksiya","Sıralama əmri"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":168,"type":"mc","text":"SQL-da Single-row subquery nə qaytarır?","options":["Yalnız bir sıra qaytaran subquery","Çox sıra qaytaran subquery","Bir sütun qaytaran subquery","Heç nə qaytarmayan subquery"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":169,"type":"mc","text":"SQL-da FULL OUTER JOIN iki cədvəl arasında nə qaytarır?","options":["Hər iki cədvəlin bütün sıralarını, uyğunsuzlar NULL ilə","Yalnız uyğun sıraları","Yalnız sol cədvəli","Yalnız sağ cədvəli"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":170,"type":"mc","text":"SQL-da EXISTS operatoru nə edir?","options":["Subquery ən az bir sıra qaytarırsa TRUE qaytarır","Subquery nəticəsini göstərir","Sayı hesablayır","Cəm hesablayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":171,"type":"mc","text":"SQL-da UNION operatoru nə edir?","options":["İki sorğunun nəticəsini birləşdirib dublikatları silir","İki sorğunun nəticəsini birləşdirib dublikatları saxlayır","Cədvəlləri birləşdirir","JOIN əməliyyatı aparır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":172,"type":"mc","text":"SQL-da multi-row subquery nə deməkdir?","options":["Birdən çox sıra qaytaran subquery","Yalnız bir sıra qaytaran subquery","Birdən çox sütun qaytaran subquery","Heç nə qaytarmayan subquery"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":173,"type":"mc","text":"SQL-da UNION ALL ilə UNION arasındakı fərq nədir?","options":["UNION ALL dublikatları saxlayır və daha sürətlidir; UNION dublikatları silir amma daha yavaşdır","Onlar eynidir","UNION ALL daha yavaşdır","UNION dublikatları saxlayır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":174,"type":"mc","text":"SQL-da inline view (FROM bəndindəki subquery) nə adlanır?","options":["Derived table (törəmə cədvəl)","CTE","Window function","Temporary table"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":1,"_fromPdf":false},{"id":175,"type":"mc","text":"SQL-da correlated subquery ilə uncorrelated subquery arasındakı fərq nədir?","options":["Correlated subquery xarici sorğunun hər sırası üçün yenidən icra edilir; uncorrelated subquery bir dəfə icra edilir","Onlar eynidir","Correlated subquery daha sürətlidir","Uncorrelated subquery daha yavaşdır"],"correctOption":0,"tfAnswer":true,"shortAnswer":"","fillText":"","fillAnswers":[],"points":2,"_fromPdf":false}];
const PRELOADED_QID = 175;


// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
(function init(){
  // Load preloaded questions if localStorage is empty
  const saved = localStorage.getItem('qc_questions');
  if(!saved){
    questions = JSON.parse(JSON.stringify(PRELOADED_QUESTIONS));
    qId = PRELOADED_QID;
    if(questions.length) activeQId = questions[0].id;
    saveQs();
  } else {
    loadSaved();
    // If saved is empty/corrupt, fall back to preloaded
    if(!questions.length){
      questions = JSON.parse(JSON.stringify(PRELOADED_QUESTIONS));
      qId = PRELOADED_QID;
      if(questions.length) activeQId = questions[0].id;
      saveQs();
    }
  }
  // Show question count on lock screen
  const badge = document.getElementById('lock-q-count');
  if(badge) badge.textContent = questions.length;
  renderSidebar();
  renderEditor();
})();
