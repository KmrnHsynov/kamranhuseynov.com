# Quiz Anti-Cheat Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record when students leave the quiz page, warn them, auto-submit at a per-exam limit, and show the teacher the results.

**Architecture:** A small pure-logic module (`quiz/quiz-monitor.js`) counts leaves, away time and pastes and is unit-tested with Node. `quiz/quiz-student.js` wires browser events to it, shows the disclaimer and warnings, and saves the attempt to Firebase on every answer and event (so a closed browser still leaves a record). `quiz/quiz-az.js` adds the per-exam limit setting and the Analytics columns.

**Tech Stack:** Plain browser JS (no build step), Firebase Realtime Database compat SDK 10.12.0, Node built-in test runner (`node --test`) for the pure module.

**Spec:** `docs/superpowers/specs/2026-11-01-quiz-anti-cheat-design.md`

## Global Constraints

- UI text is Azerbaijani, matching the existing pages.
- Default leave limit is 3; the limit is stored per exam as `student_quiz/<key>.leaveLimit`; 0 disables the disclaimer and monitoring; exams without the field use 3.
- Attempt record lives at `analytics/<examKey>/<attemptId>`; `status` is `in_progress`, `done` or `exited`.
- New record fields: `attemptId, status, tabSwitches, timeAway (seconds), pastes, autoSubmitted, events`. `events` is `[{type, t}]` capped at 100. Existing fields stay unchanged.
- Paste into the exam is blocked and logged; copy, cut and right-click on the question area are blocked and logged. They do not count toward the leave limit.
- Do not change Firebase database rules.
- Old records without the new fields must still render in the Analytics tab.
- Repo note: `quiz/` is currently untracked (the files were moved there from the repo root and the old paths show as deleted). Stage only the files named in each commit step. Never stage `README.txt` or the old-path deletions.

## File Structure

- Create `quiz/quiz-monitor.js` — pure `createMonitor(limit, nowFn)`; works in browser (global) and Node (`module.exports`).
- Create `quiz/quiz-monitor.test.js` — Node tests for the module.
- Modify `quiz/quiz-student.html` — load the module script; add the `#result-auto` line to the results view.
- Modify `quiz/quiz-student.js` — leave limit, disclaimer, event wiring, warning overlay, grading refactor, attempt saving.
- Modify `quiz/quiz-az.html` — leave-limit field in publish settings.
- Modify `quiz/quiz-az.js` — publish the limit; Analytics columns, badge, sort.
- Modify `quiz/quiz-az.css` — two badge classes and the wider analytics grid.

---

### Task 1: Monitor module (pure logic, TDD)

**Files:**
- Create: `quiz/quiz-monitor.js`
- Test: `quiz/quiz-monitor.test.js`

**Interfaces:**
- Produces: `createMonitor(limit: number, nowFn?: () => number)` returning an object with:
  - `leave(): {count:number, reached:boolean} | null` — null if already away (de-duplicates blur plus visibilitychange)
  - `back(): {count:number} | null` — null if not away
  - `paste(): void`, `copy(): void`
  - `stats(): {tabSwitches:number, timeAway:number, pastes:number, events:{type:string,t:number}[]}`

- [ ] **Step 1: Write the failing tests**

Create `quiz/quiz-monitor.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { createMonitor } = require('./quiz-monitor.js');

function clock(){ let t = 0; const f = () => t; f.set = v => { t = v; }; return f; }

test('a leave is counted once even if blur and visibilitychange both fire', () => {
  const m = createMonitor(3, clock());
  assert.deepStrictEqual(m.leave(), { count: 1, reached: false });
  assert.strictEqual(m.leave(), null);
  assert.strictEqual(m.stats().tabSwitches, 1);
});

test('reached is true when the count hits the limit', () => {
  const m = createMonitor(2, clock());
  m.leave(); m.back();
  assert.deepStrictEqual(m.leave(), { count: 2, reached: true });
});

test('limit 0 never reaches', () => {
  const m = createMonitor(0, clock());
  for (let i = 0; i < 5; i++) { m.leave(); m.back(); }
  assert.strictEqual(m.stats().tabSwitches, 5);
  const r = m.leave();
  assert.strictEqual(r.reached, false);
});

test('back without leave returns null', () => {
  assert.strictEqual(createMonitor(3, clock()).back(), null);
});

test('time away accumulates in whole seconds', () => {
  const now = clock();
  const m = createMonitor(5, now);
  now.set(10000); m.leave();
  now.set(14000); m.back();
  now.set(20000); m.leave();
  now.set(21400); m.back();
  assert.strictEqual(m.stats().timeAway, 5 + 1);
});

test('stats include time of a leave that is still ongoing', () => {
  const now = clock();
  const m = createMonitor(5, now);
  now.set(1000); m.leave();
  now.set(9000);
  assert.strictEqual(m.stats().timeAway, 8);
});

test('paste and copy are logged; only paste is counted', () => {
  const now = clock();
  const m = createMonitor(3, now);
  now.set(7000); m.paste(); m.copy();
  const s = m.stats();
  assert.strictEqual(s.pastes, 1);
  assert.deepStrictEqual(s.events, [{ type: 'paste', t: 7 }, { type: 'copy', t: 7 }]);
});

test('events are capped at 100 but counters keep counting', () => {
  const m = createMonitor(0, clock());
  for (let i = 0; i < 150; i++) m.paste();
  const s = m.stats();
  assert.strictEqual(s.events.length, 100);
  assert.strictEqual(s.pastes, 150);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (repo root): `node --test quiz/quiz-monitor.test.js`
Expected: FAIL with "Cannot find module './quiz-monitor.js'".

- [ ] **Step 3: Write the implementation**

Create `quiz/quiz-monitor.js`:

```js
'use strict';

const MONITOR_MAX_EVENTS = 100;

function createMonitor(limit, nowFn){
  const now = nowFn || (() => Date.now());
  const startedAt = now();
  let awaySince = null;
  const s = { tabSwitches: 0, timeAway: 0, pastes: 0, events: [] };

  function secs(ms){ return Math.round(ms / 1000); }
  function log(type){
    if(s.events.length < MONITOR_MAX_EVENTS) s.events.push({ type, t: secs(now() - startedAt) });
  }

  return {
    leave(){
      if(awaySince !== null) return null;
      awaySince = now();
      s.tabSwitches++;
      log('leave');
      return { count: s.tabSwitches, reached: limit > 0 && s.tabSwitches >= limit };
    },
    back(){
      if(awaySince === null) return null;
      s.timeAway += secs(now() - awaySince);
      awaySince = null;
      return { count: s.tabSwitches };
    },
    paste(){ s.pastes++; log('paste'); },
    copy(){ log('copy'); },
    stats(){
      return {
        tabSwitches: s.tabSwitches,
        timeAway: s.timeAway + (awaySince !== null ? secs(now() - awaySince) : 0),
        pastes: s.pastes,
        events: s.events.slice()
      };
    }
  };
}

if(typeof module !== 'undefined') module.exports = { createMonitor };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test quiz/quiz-monitor.test.js`
Expected: 8 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add quiz/quiz-monitor.js quiz/quiz-monitor.test.js
git commit -m "feat: add quiz leave/paste monitor module with tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Student page — limit, disclaimer, monitoring, auto-submit, attempt saving

**Files:**
- Modify: `quiz/quiz-student.html` (script tags near line 87-90; results view near line 69)
- Modify: `quiz/quiz-student.js`

**Interfaces:**
- Consumes: `createMonitor` from Task 1.
- Produces: attempt records at `analytics/<key>/<attemptId>` with the fields in Global Constraints. Reads `leaveLimit` from the exam object (written by Task 3).

- [ ] **Step 1: Load the module and add the result line in the HTML**

In `quiz/quiz-student.html`, change

```html
<script src="firebase-config.js"></script>
<script src="quiz-student.js"></script>
```

to

```html
<script src="firebase-config.js"></script>
<script src="quiz-monitor.js"></script>
<script src="quiz-student.js"></script>
```

and after `<p class="results-sub" id="result-sub"></p>` add:

```html
      <p class="results-sub" id="result-auto" style="display:none;color:var(--wrong);font-weight:700"></p>
```

- [ ] **Step 2: Add state and helpers at the top of `quiz/quiz-student.js`**

After the line `let _examList = [];` add:

```js
const DEFAULT_LEAVE_LIMIT   = 3;
let leaveLimit = DEFAULT_LEAVE_LIMIT, monitor = null, examActive = false, attemptId = '', autoReason = null;

function readLeaveLimit(exam){
  const n = parseInt(exam && exam.leaveLimit, 10);
  return Number.isNaN(n) || n < 0 ? DEFAULT_LEAVE_LIMIT : n;
}
function analyticsKey(){
  return examKey || topicName.replace(/[.#$[\]/]/g,'_') || 'default';
}
```

- [ ] **Step 3: Read the limit when an exam is chosen**

In `init`, in the `if(exams.length===1){` block, after the `EXAM_SECONDS = ...` line add:

```js
        leaveLimit   = readLeaveLimit(exams[0]);
```

In `selectExam`, after `EXAM_SECONDS = (e.examMinutes||30)*60;` add:

```js
  leaveLimit   = readLeaveLimit(e);
```

- [ ] **Step 4: Show the disclaimer in the lobby**

In `showLobby`, before `document.getElementById('lobby-view').innerHTML = ...` add:

```js
  const notice = leaveLimit > 0 ? `
      <p style="font-size:12px;color:var(--wrong);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px;margin-bottom:16px;line-height:1.6;text-align:left">
        ⚠ Diqqət: Bu səhifədən çıxmaq (başqa tab və ya pəncərə) qeydə alınır. ${leaveLimit} dəfə çıxsanız və ya brauzeri bağlasanız, imtahan avtomatik göndəriləcək.
      </p>` : '';
```

and in the template, insert `${notice}` on its own line directly before the `<input type="text" id="student-name-inp" ...>` line.

- [ ] **Step 5: Start monitoring and create the attempt in `startExam`**

In `startExam`, after the line `timeLeft = EXAM_SECONDS;` add:

```js
  attemptId = db.ref('analytics/'+analyticsKey()).push().key;
  monitor = leaveLimit > 0 ? createMonitor(leaveLimit) : null;
  autoReason = null;
  examActive = true;
  saveAttempt('in_progress');
```

- [ ] **Step 6: Refactor grading out of `finishQuiz` and replace the Firebase push**

Add above `// ── RESULTS` section's `finishQuiz`:

```js
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
```

Then in `finishQuiz` replace the whole block from `let ok=0, bad=0, earned=0, total=0;` through `const pct = total ? Math.round((earned/total)*100) : 0;` with:

```js
  examActive = false;
  document.getElementById('leave-warning')?.remove();
  const { ok, bad, earned, total, pct } = gradeAll();
```

Replace the whole `// Save to Firebase analytics` `try{ ... }catch(e){}` block (from `// Save to Firebase analytics` to its closing `}catch(e){}`) with:

```js
  const autoEl = document.getElementById('result-auto');
  autoEl.style.display = autoReason === 'leaves' ? 'block' : 'none';
  autoEl.textContent = 'İmtahan səhifəsini çox dəfə tərk etdiyiniz üçün avtomatik göndərildi.';
  saveAttempt('done');
```

- [ ] **Step 7: Save progress after every answer**

Add this helper next to `showFb`:

```js
function onAnswered(){ saveAttempt('in_progress'); }
```

and call `onAnswered();` as the last line of `pickMC`, `pickTF`, `submitShort` and `submitFill` (after their `showFb(...)` call).

- [ ] **Step 8: Wire the browser events and warning overlay**

Add a new section before `// ── UTILS`:

```js
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
```

- [ ] **Step 9: Keep the voluntary exit from counting as a leave**

Replace `exitQuiz` with:

```js
function exitQuiz(){
  examActive = false;
  if(!confirm('İmtahandan çıxmaq istəyirsiniz? Cavablarınız yadda saxlanmayacaq.')){ examActive = true; return; }
  clearInterval(totalTimer);
  saveAttempt('exited');
  attemptId = '';
  quizAns = {};
  showLobby();
}
```

- [ ] **Step 10: Manual verification**

Run: `python -m http.server 8000` from the repo root, then open `http://localhost:8000/quiz/quiz-student.html` (publish a test first from the teacher page, or use an existing one).

Check each:
1. Lobby shows the red disclaimer with the number 3.
2. Start, switch to another tab and back: warning "Xəbərdarlıq 1/3" appears; "Davam et" closes it.
3. Do it twice more: on the third leave the exam is submitted, results show the red auto-submit line.
4. In the Firebase console, `analytics/<exam>/<attemptId>` has `status: "done"`, `tabSwitches: 3`, `autoSubmitted: true`. No permission errors in the browser console (if the database rules reject `set` on an existing path, report this before continuing).
5. Start another attempt, answer one question, close the tab: the record stays `status: "in_progress"` with the partial score.
6. Paste into a short-answer box: nothing is pasted, `pastes` increments. Right-click the question text: no menu.
7. Click "Çıxış" and confirm: record becomes `status: "exited"`, no leave warning appears.

- [ ] **Step 11: Commit**

```bash
git add quiz/quiz-student.html quiz/quiz-student.js
git commit -m "feat: monitor page leaves, warn and auto-submit in student quiz

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Teacher page — limit setting and Analytics columns

**Files:**
- Modify: `quiz/quiz-az.html` (after the exam-minutes section, line ~65)
- Modify: `quiz/quiz-az.js` (`analyticsFilter` declaration line ~18, `publishTopic` line ~405, `_drawAnalytics` lines ~502-568)
- Modify: `quiz/quiz-az.css` (lines ~519-544)

**Interfaces:**
- Consumes: record fields from Task 2 (`status, tabSwitches, timeAway, pastes, autoSubmitted`; all optional).
- Produces: `student_quiz/<key>.leaveLimit` read by Task 2.

- [ ] **Step 1: Add the limit field to the publish settings**

In `quiz/quiz-az.html`, directly after the closing `</div>` of the "İmtahan Müddəti (dəqiqə)" `sidebar-section`, add:

```html
      <div class="sidebar-section">
        <label>Səhifədən Çıxış Limiti</label>
        <div class="timer-row">
          <input type="number" id="leave-limit" min="0" max="20" value="3"/>
          <span>0 = nəzarət yoxdur</span>
        </div>
      </div>
```

- [ ] **Step 2: Publish the limit**

In `publishTopic`, after the `const examMinutes = ...` line add:

```js
  const lv = parseInt(document.getElementById('leave-limit')?.value, 10);
  const leaveLimit = Number.isNaN(lv) ? 3 : Math.min(20, Math.max(0, lv));
```

and change the `.set({...})` call to include it:

```js
  db.ref('student_quiz/'+toKey(topicName)).set({questions: filtered, topic: topicName, examMinutes, leaveLimit, publishedAt: Date.now()})
```

- [ ] **Step 3: Add the sort flag and helpers**

After `let analyticsFilter = 'all'; ...` (line ~18) add:

```js
let analyticsSortLeaves = false;
```

Above `function fmtTime(secs){` add:

```js
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
```

- [ ] **Step 4: Add the columns, badge and sort button to the table**

In `_drawAnalytics`, replace the `<div class="analytics-hdr">` inner header row

```js
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h2 style="font-family:'Nunito',sans-serif;font-size:20px;font-weight:800">Tələbə Nəticələri</h2>
          <span style="font-size:12px;color:var(--muted)">${records.length} qeyd</span>
        </div>
```

with:

```js
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <h2 style="font-family:'Nunito',sans-serif;font-size:20px;font-weight:800">Tələbə Nəticələri</h2>
          <span style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-sm ${analyticsSortLeaves?'btn-accent3':'btn-ghost'}" onclick="toggleLeaveSort()">Çıxışa görə sırala</button>
            <span style="font-size:12px;color:var(--muted)">${records.length} qeyd</span>
          </span>
        </div>
```

In the `.an-thead` block, after the `Nəticə` header cell add:

```js
          <div style="text-align:center">Çıxışlar</div>
          <div>Status</div>
```

Replace `${[...records].reverse().map(r=>{` with:

```js
        ${(analyticsSortLeaves ? [...records].sort((a,b)=>(b.tabSwitches||0)-(a.tabSwitches||0)) : [...records].reverse()).map(r=>{
```

and in the row, after the `an-badge ${cls}` cell add:

```js
            <div style="text-align:center;font-size:12px;color:var(--text2)">${r.tabSwitches||0} · ${fmtTime(r.timeAway||0)}${r.pastes?`<br/><span style="color:var(--wrong)">📋 ${r.pastes}</span>`:''}</div>
            <div>${leaveBadge(r)}</div>
```

- [ ] **Step 5: CSS for the wider grid and new badges**

In `quiz/quiz-az.css`, change both occurrences (in `.an-thead` and `.an-row`) of

```css
grid-template-columns: 1.4fr 1.2fr 1.4fr repeat(4,0.7fr);
```

to

```css
grid-template-columns: 1.4fr 1.2fr 1.4fr repeat(4,0.7fr) 0.9fr 1.1fr;
```

and after the `.an-low{...}` rule add:

```css
.an-warn{background:rgba(234,179,8,.14);color:#eab308;border:1px solid rgba(234,179,8,.25);}
.an-grey{background:rgba(148,163,184,.14);color:var(--muted);border:1px solid rgba(148,163,184,.25);}
```

- [ ] **Step 6: Check narrow-screen rules**

Run: `grep -n "an-row\|an-thead" quiz/quiz-az.css`
If a media query overrides `grid-template-columns` for `.an-row`/`.an-thead`, extend it with two more columns the same way; otherwise leave it.

- [ ] **Step 7: Manual verification**

Open `http://localhost:8000/quiz/quiz-az.html`.
1. Settings tab shows "Səhifədən Çıxış Limiti" = 3. Set it to 2, publish a topic; in Firebase `student_quiz/<key>.leaveLimit` is `2`, and the student lobby disclaimer says 2.
2. Analytics tab: the attempts from Task 2's manual test show with the right badges (red "Avto-göndərildi", orange "Tamamlanmayıb", grey "Çıxdı") and leave counts with time away.
3. "Çıxışa görə sırala" puts the highest leave counts first; clicking again restores newest-first.
4. Any old record without the new fields renders with `0 · 0:00` and no badge, with no console errors.
5. Set the limit to 0, publish, open the student page: no disclaimer; switching tabs shows no warning.

- [ ] **Step 8: Commit**

```bash
git add quiz/quiz-az.html quiz/quiz-az.js quiz/quiz-az.css
git commit -m "feat: per-exam leave limit and anti-cheat columns in analytics

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** disclaimer (T2 S4), warning overlay and auto-submit (T2 S8), paste/copy blocking and logging (T2 S8), progress saved per answer and event, `pagehide` best effort (T2 S6-S8), new record fields (T2 S6), per-exam limit with default 3 and 0 off (T2 S2-S3, T3 S1-S2), Analytics columns, badges and sort (T3 S3-S5), old records render (T3 S7). No gaps.
- **Placeholder scan:** none; every code step shows the code.
- **Name consistency:** `createMonitor`, `leave/back/paste/copy/stats`, `leaveLimit`, `saveAttempt`, `gradeAll`, `analyticsKey`, `examActive`, `attemptId`, `autoReason`, `leaveBadge`, `toggleLeaveSort` are used identically across tasks.
- **Deviation from spec wording:** the orange badge for `in_progress` says "Tamamlanmayıb" (not finished), because an exam still in progress looks the same as a closed browser in the data.
