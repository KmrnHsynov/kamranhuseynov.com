'use strict';

const STORAGE_KEY_STUDENT   = 'qc_student_qs';
const MAX_QUESTIONS         = 30;
let EXAM_SECONDS            = 30 * 60;

let quizQs = [], quizIdx = 0, quizAns = {}, topicName = '', studentName = '', examKey = '';
let totalTimer = null, timeLeft = EXAM_SECONDS, answered = false;
let _examList = [];

const DEFAULT_LEAVE_LIMIT   = 3;
let leaveLimit = DEFAULT_LEAVE_LIMIT, monitor = null, examActive = false, attemptId = '', autoReason = null;

function readLeaveLimit(exam){
  const n = parseInt(exam && exam.leaveLimit, 10);
  return Number.isNaN(n) || n < 0 ? DEFAULT_LEAVE_LIMIT : n;
}
function analyticsKey(){
  return examKey || topicName.replace(/[.#$[\]/]/g,'_') || 'default';
}

// ── INIT ──────────────────────────────────────────────
(function init(){
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
      if(!val){ _loadFromLocalStorage(); return; }
      const exams = Object.entries(val)
        .map(([key,data])=>({key,...data}))
        .filter(e=>e.questions&&e.questions.length);
      if(!exams.length){ _loadFromLocalStorage(); return; }
      if(exams.length===1){
        examKey      = exams[0].key;
        quizQs       = exams[0].questions;
        topicName    = exams[0].topic||'';
        EXAM_SECONDS = (exams[0].examMinutes||30)*60;
        leaveLimit   = readLeaveLimit(exams[0]);
        showLobby();
      } else {
        showExamList(exams);
      }
    })
    .catch(()=>_loadFromLocalStorage());
})();

function _loadFromLocalStorage(){
  try{
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY_STUDENT)||'null');
    if(d && d.questions && d.questions.length){
      quizQs    = d.questions;
      topicName = d.topic || '';
      showLobby(); return;
    }
  }catch(e){}
  showNoQuiz();
}

function showNoQuiz(){
  document.getElementById('lobby-view').innerHTML = `
    <div class="lock-card">
      <div class="lock-icon">📭</div>
      <h2>Test Tapılmadı</h2>
      <p>Müəllim hələ test göndərməyib. Daha sonra yenidən cəhd edin.</p>
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
  onAnswered();
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
  onAnswered();
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
  onAnswered();
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
  onAnswered();
}

function onAnswered(){ saveAttempt('in_progress'); }

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
function gradeAll(){
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
  return { ok, bad, earned, total, pct };
}

function saveAttempt(status){
  if(!attemptId) return;
  try{
    const g = gradeAll();
    const m = monitor ? monitor.stats() : { tabSwitches:0, timeAway:0, pastes:0, events:[] };
    db.ref('analytics/'+analyticsKey()+'/'+attemptId).set({
      attemptId, status,
      studentName,
      topic: topicName,
      timestamp: Date.now(),
      totalQuestions: quizQs.length,
      correct: g.ok,
      wrong: g.bad,
      unanswered: quizQs.length - g.ok - g.bad,
      score: g.earned,
      maxScore: g.total,
      pct: g.pct,
      timeUsed: EXAM_SECONDS - timeLeft,
      tabSwitches: m.tabSwitches,
      timeAway: m.timeAway,
      pastes: m.pastes,
      autoSubmitted: autoReason === 'leaves',
      autoReason: autoReason || null,
      events: m.events
    });
  }catch(e){}
}

function finishQuiz(){
  clearInterval(totalTimer);
  examActive = false;
  document.getElementById('leave-warning')?.remove();
  const { ok, bad, earned, total, pct } = gradeAll();
  document.getElementById('score-ring').style.setProperty('--pct',`${pct}%`);
  document.getElementById('score-pct').textContent=`${pct}%`;
  document.getElementById('stat-ok').textContent=ok;
  document.getElementById('stat-bad').textContent=bad;
  document.getElementById('stat-pts').textContent=`${earned}/${total}`;
  const hdg=pct>=90?'🏆 Əla nəticə!':pct>=70?'👍 Yaxşı iş!':pct>=50?'📚 Daha çox çalışın':pct>0?'💪 Tərəddüd etmə!':'';
  document.getElementById('result-heading').textContent=hdg;
  document.getElementById('result-sub').textContent=`${ok} doğru, ${bad} yanlış — ${earned} / ${total} xal`;
  document.getElementById('review-sec').innerHTML=`<h3>Cavabların İcmalı</h3>`+quizQs.map(buildReview).join('');

  const autoEl = document.getElementById('result-auto');
  autoEl.style.display = autoReason === 'leaves' ? 'block' : 'none';
  autoEl.textContent = 'İmtahan səhifəsini çox dəfə tərk etdiyiniz üçün avtomatik göndərildi.';
  saveAttempt('done');

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

function exitQuiz(){
  examActive = false;
  if(!confirm('İmtahandan çıxmaq istəyirsiniz? Cavablarınız yadda saxlanmayacaq.')){ examActive = true; return; }
  clearInterval(totalTimer);
  saveAttempt('exited');
  attemptId = '';
  quizAns = {};
  showLobby();
}

function retakeExam(){
  clearInterval(totalTimer);
  showLobby();
}

function printResults(){ window.print(); }

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
