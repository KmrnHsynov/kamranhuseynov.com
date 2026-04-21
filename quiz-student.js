'use strict';

const STORAGE_KEY_STUDENT   = 'qc_student_qs';
const STORAGE_KEY_ANALYTICS = 'qc_analytics';
const MAX_QUESTIONS         = 30;
const EXAM_SECONDS          = 30 * 60;

let quizQs = [], quizIdx = 0, quizAns = {}, topicName = '', studentName = '';
let totalTimer = null, timeLeft = EXAM_SECONDS, answered = false;

// ── INIT ──────────────────────────────────────────────
(function init(){
  const raw = localStorage.getItem(STORAGE_KEY_STUDENT);
  if(!raw){ showNoQuiz(); return; }
  try {
    const d = JSON.parse(raw);
    quizQs   = d.questions || [];
    topicName = d.topic || '';
  } catch(e){ showNoQuiz(); return; }
  if(!quizQs.length){ showNoQuiz(); return; }
  showLobby();
})();

function showNoQuiz(){
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">📭</div>
      <h2>Test Tapılmadı</h2>
      <p>Müəllim hələ test göndərməyib. Daha sonra yenidən cəhd edin.</p>
    </div>`;
  showView('lobby-view');
}

function showLobby(){
  const count = Math.min(quizQs.length, MAX_QUESTIONS);
  if(topicName) document.getElementById('lobby-topic').textContent = topicName;
  document.getElementById('lobby-count').textContent = count;
  showView('lobby-view');
}

// ── START ─────────────────────────────────────────────
function startExam(){
  studentName = (document.getElementById('student-name-inp')?.value || '').trim() || 'Anonim';
  // Shuffle all questions, pick up to 30
  let pool = JSON.parse(JSON.stringify(quizQs))
    .sort(() => Math.random() - .5)
    .slice(0, MAX_QUESTIONS);

  // Randomize MC answer order
  pool = pool.map(q => {
    if(q.type !== 'mc') return q;
    const correctText = q.options[q.correctOption];
    const shuffled = q.options.filter(o => o).sort(() => Math.random() - .5);
    while(shuffled.length < 4) shuffled.push('');
    const newIdx = shuffled.indexOf(correctText);
    return { ...q, options: shuffled, correctOption: newIdx >= 0 ? newIdx : 0 };
  });

  quizQs = pool;
  quizIdx = 0; quizAns = {};
  timeLeft = EXAM_SECONDS;

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
    timeLeft--;
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
  if(saved !== undefined){ restoreAns(q, saved); showFbFromSaved(q, saved); }
}

function buildQuizCard(q){
  const L = ['A','B','C','D'];
  let body = '';
  if(q.type === 'mc'){
    body = `<div class="quiz-mc-opts">${q.options.filter(o=>o).map((o,i)=>`
      <div class="quiz-mc-opt" id="mc${i}" onclick="pickMC(${q.id},${i},${q.correctOption})">
        <div class="opt-ltr">${L[i]}</div><div class="opt-txt">${esc(o)}</div>
      </div>`).join('')}</div>`;
  } else if(q.type === 'tf'){
    body = `<div class="quiz-tf-opts">
      <div class="quiz-tf-btn" id="tf-t" onclick="pickTF(${q.id},true,${q.tfAnswer})">✓ Doğru</div>
      <div class="quiz-tf-btn" id="tf-f" onclick="pickTF(${q.id},false,${q.tfAnswer})">✗ Yanlış</div>
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
    <div class="feedback-bar" id="fb-bar"></div>
  </div>`;
}

function pickMC(qid, idx, correct){
  if(answered) return;
  answered = true;
  quizAns[qid] = idx;
  document.querySelectorAll('.quiz-mc-opt').forEach((el,i)=>{
    el.classList.add('locked'); el.onclick = null;
    if(i === idx) el.classList.add(idx === correct ? 'ok' : 'bad');
    if(i === correct && i !== idx) el.classList.add('reveal');
  });
  showFb(idx===correct, idx===correct ? '✓ Düzdür!' : '✗ Yanlış — Düzgün: '+['A','B','C','D'][correct]);
}

function pickTF(qid, val, correct){
  if(answered) return;
  answered = true;
  quizAns[qid] = val;
  const ok = val === correct;
  const tEl = document.getElementById('tf-t'), fEl = document.getElementById('tf-f');
  tEl.classList.add('locked'); fEl.classList.add('locked');
  tEl.onclick = null; fEl.onclick = null;
  (val ? tEl : fEl).classList.add(ok ? 'ok' : 'bad');
  if(!ok)(correct ? tEl : fEl).classList.add('reveal');
  showFb(ok, ok ? '✓ Düzdür!' : '✗ Yanlış — Düzgün: '+(correct?'Doğru':'Yanlış'));
}

function submitShort(qid){
  if(answered) return;
  const inp = document.getElementById('short-inp');
  const val = (inp?.value||'').trim();
  if(!val) return;
  answered = true;
  quizAns[qid] = val;
  const q = quizQs.find(q=>q.id===qid);
  const acc = (q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());
  const ok = acc.includes(val.toLowerCase());
  if(inp){ inp.style.borderColor = ok?'var(--correct)':'var(--wrong)'; inp.readOnly = true; }
  showFb(ok, ok?'✓ Düzdür!':'✗ Yanlış — Gözlənilən: '+q.shortAnswer);
}

function submitFill(qid){
  if(answered) return;
  const inps = [...document.querySelectorAll('.blank-inp')];
  const vals = inps.map(i=>i.value.trim());
  if(vals.some(v=>!v)) return;
  answered = true;
  quizAns[qid] = vals;
  const q = quizQs.find(q=>q.id===qid);
  let allOk = true;
  vals.forEach((v,i)=>{
    const acc = ((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());
    const ok = acc.includes(v.toLowerCase());
    if(!ok) allOk = false;
    inps[i].classList.add(ok?'ok':'bad'); inps[i].readOnly = true;
  });
  showFb(allOk, allOk?'✓ Hamısı düzdür!':'✗ Bəziləri yanlışdır — Düzgün: '+(q.fillAnswers||[]).join(', '));
}

function showFb(ok, msg){
  const el = document.getElementById('fb-bar');
  if(!el) return;
  el.className = `feedback-bar show ${ok?'fb-ok':'fb-bad'}`;
  el.textContent = msg;
}

function restoreAns(q, saved){
  answered = true;
  if(q.type==='mc'&&saved!=null){
    const opts=document.querySelectorAll('.quiz-mc-opt');
    if(opts[saved])opts[saved].classList.add(saved===q.correctOption?'ok':'bad');
    if(saved!==q.correctOption&&opts[q.correctOption])opts[q.correctOption].classList.add('reveal');
    opts.forEach(o=>{o.classList.add('locked');o.onclick=null;});
  } else if(q.type==='tf'&&saved!=null){
    const tEl=document.getElementById('tf-t'),fEl=document.getElementById('tf-f');
    const ok=saved===q.tfAnswer;
    (saved?tEl:fEl)?.classList.add(ok?'ok':'bad');
    if(!ok)(q.tfAnswer?tEl:fEl)?.classList.add('reveal');
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

function showFbFromSaved(q, saved){
  let ok=false, msg='';
  if(q.type==='mc'){ok=saved===q.correctOption;msg=ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+['A','B','C','D'][q.correctOption];}
  else if(q.type==='tf'){ok=saved===q.tfAnswer;msg=ok?'✓ Düzdür!':'✗ Yanlış — Düzgün: '+(q.tfAnswer?'Doğru':'Yanlış');}
  else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());ok=acc.includes((saved||'').toLowerCase());msg=ok?'✓ Düzdür!':'✗ Yanlış — Gözlənilən: '+q.shortAnswer;}
  else if(q.type==='fill'){const vals=Array.isArray(saved)?saved:[];ok=vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});msg=ok?'✓ Hamısı düzdür!':'✗ Bəziləri yanlışdır';}
  if(msg) showFb(ok, msg);
}

function nextQ(){
  if(quizIdx < quizQs.length-1){ quizIdx++; renderQuizQ(); }
  else finishQuiz();
}
function prevQ(){ if(quizIdx > 0){ quizIdx--; renderQuizQ(); } }

// ── RESULTS ───────────────────────────────────────────
function finishQuiz(){
  clearInterval(totalTimer);
  let ok=0, bad=0, earned=0, total=0;
  quizQs.forEach(q=>{
    total += q.points;
    const ans = quizAns[q.id];
    let correct = false;
    if(q.type==='mc') correct=ans===q.correctOption;
    else if(q.type==='tf') correct=ans===q.tfAnswer;
    else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());correct=acc.includes((ans||'').toLowerCase());}
    else if(q.type==='fill'){const vals=Array.isArray(ans)?ans:[];correct=vals.length>0&&vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});}
    if(correct){ok++;earned+=q.points;}else bad++;
  });
  const pct = total ? Math.round((earned/total)*100) : 0;
  document.getElementById('score-ring').style.setProperty('--pct',`${pct}%`);
  document.getElementById('score-pct').textContent=`${pct}%`;
  document.getElementById('stat-ok').textContent=ok;
  document.getElementById('stat-bad').textContent=bad;
  document.getElementById('stat-pts').textContent=`${earned}/${total}`;
  const hdg=pct>=90?'🏆 Əla nəticə!':pct>=70?'👍 Yaxşı iş!':pct>=50?'📚 Daha çox çalışın':pct>0?'💪 Tərəddüd etmə!':'';
  document.getElementById('result-heading').textContent=hdg;
  document.getElementById('result-sub').textContent=`${ok} doğru, ${bad} yanlış — ${earned} / ${total} xal`;
  document.getElementById('review-sec').innerHTML=`<h3>Cavabların İcmalı</h3>`+quizQs.map(buildReview).join('');

  // Save to analytics
  try{
    const record={
      id: Date.now(),
      studentName,
      topic: topicName,
      timestamp: Date.now(),
      totalQuestions: quizQs.length,
      correct: ok,
      wrong: bad,
      unanswered: quizQs.length - ok - bad,
      score: earned,
      maxScore: total,
      pct,
      timeUsed: EXAM_SECONDS - timeLeft
    };
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_ANALYTICS)||'[]');
    existing.push(record);
    localStorage.setItem(STORAGE_KEY_ANALYTICS, JSON.stringify(existing));
  }catch(e){}

  showView('results-view');
}

function buildReview(q){
  const ans=quizAns[q.id];
  let ok=false, yourA='(cavablanmadı)', corA='';
  const L=['A','B','C','D'];
  if(q.type==='mc'){ok=ans===q.correctOption;yourA=ans!=null?L[ans]+' '+q.options[ans]:'(cavablanmadı)';corA=L[q.correctOption]+' '+q.options[q.correctOption];}
  else if(q.type==='tf'){ok=ans===q.tfAnswer;yourA=ans!=null?(ans?'Doğru':'Yanlış'):'(cavablanmadı)';corA=q.tfAnswer?'Doğru':'Yanlış';}
  else if(q.type==='short'){const acc=(q.shortAnswer||'').split(',').map(s=>s.trim().toLowerCase());ok=acc.includes((ans||'').toLowerCase());yourA=ans||'(cavablanmadı)';corA=q.shortAnswer;}
  else if(q.type==='fill'){const vals=Array.isArray(ans)?ans:[];ok=vals.length>0&&vals.every((v,i)=>{const acc=((q.fillAnswers||[])[i]||'').split(',').map(s=>s.trim().toLowerCase());return acc.includes(v.toLowerCase());});yourA=vals.join(', ')||'(cavablanmadı)';corA=(q.fillAnswers||[]).join(', ');}
  return`<div class="review-item ${ok?'r-ok':'r-bad'}">
    <div class="review-q">${esc(q.text)}</div>
    <div class="review-ans-row">
      <span class="r-badge your">Siz: ${esc(yourA)}</span>
      <span class="r-badge ${ok?'ok':'bad'}">${ok?'✓':'✗'} Düzgün: ${esc(corA)}</span>
    </div>
  </div>`;
}

function retakeExam(){
  showLobby();
}

function printResults(){ window.print(); }

// ── UTILS ─────────────────────────────────────────────
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function esc(s){ return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
