/* ============================================================================
   Bolt — one lesson engine for JSBolt, PythonBolt and WebBolt.

   Each page sets <body data-course="js | py | web">. The matching entry in
   COURSES (bottom of this file) supplies the curriculum, the CodeMirror mode,
   how code is run/checked and how progress is saved. Everything else —
   language toggle, sidebar, exercise navigation, progress bar, mobile layout —
   is shared below.

   Functions are plain globals on purpose: the HTML uses inline onclick="…".
   ============================================================================ */

const $ = id => document.getElementById(id);

// ── State ────────────────────────────────────────────────
const COURSES = {};              // filled in per course, below
let course, curriculum, cm;      // set in boot()
let curLesson = 0, curExercise = 0;
const done = {};                 // { lessonIndex: [exerciseIndex, …] }
let lang = 'az';

const t = (az, en) => lang === 'az' ? az : en;
const isMobile = () => window.innerWidth <= 700;
const currentExercise = () => curriculum[curLesson].exercises[curExercise];

function setLang(l) {
  lang = l;
  $('btn-az').classList.toggle('active', l === 'az');
  $('btn-en').classList.toggle('active', l === 'en');
  loadLesson(curLesson);
}

// ── Saved code (localStorage) ────────────────────────────
// Two formats are kept so progress saved before the merge still loads.
function perExerciseStorage(prefix) {      // one key per exercise
  return {
    get: (l, e) => { try { return localStorage.getItem(`${prefix}_${l}_${e}`); } catch { return null; } },
    set: (l, e, v) => { try { localStorage.setItem(`${prefix}_${l}_${e}`, v); } catch {} }
  };
}
function jsonStorage(key) {                // one JSON blob for everything
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  return {
    get: (l, e) => { try { return (read()[l] || {})[e] ?? null; } catch { return null; } },
    set: (l, e, v) => {
      try { const d = read(); (d[l] ||= {})[e] = v; localStorage.setItem(key, JSON.stringify(d)); } catch {}
    }
  };
}

// ── Mobile: drawer sidebar + lesson/code tabs ────────────
function toggleSidebar() {
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('open');
}
function switchTab(tab) {
  $('tab-lesson').classList.toggle('active', tab === 'lesson');
  $('tab-code').classList.toggle('active', tab === 'code');
  $('lesson-panel').classList.toggle('tab-active', tab === 'lesson');
  $('exercise-panel').classList.toggle('tab-active', tab === 'code');
  if (tab === 'code') setTimeout(() => cm.refresh(), 50);
}

// ── Sidebar + progress ───────────────────────────────────
function renderSidebar() {
  $('sidebar-title').textContent = t('Dərslər', 'Lessons');
  const list = $('lesson-list');
  list.innerHTML = '';
  let lastSection = '';
  curriculum.forEach((l, i) => {
    if (l.section && l.section[lang] !== lastSection) {
      lastSection = l.section[lang];
      const h = document.createElement('div');
      h.className = 'section-header';
      h.textContent = lastSection;
      list.appendChild(h);
    }
    const allDone = (done[i] || []).length === l.exercises.length;
    const d = document.createElement('div');
    d.className = 'lesson-item' + (i === curLesson ? ' active' : '');
    d.innerHTML = `<span class="num">${i}</span>${l.title[lang]}${allDone ? '<span class="check">✓</span>' : ''}`;
    d.onclick = () => { loadLesson(i); if (isMobile()) closeSidebar(); };
    list.appendChild(d);
  });

  const total = curriculum.reduce((n, l) => n + l.exercises.length, 0);
  const comp  = Object.values(done).reduce((n, a) => n + a.length, 0);
  $('progress-text').textContent = `${comp}/${total}`;
  $('progress-bar-fill').style.width = `${total ? Math.round(comp / total * 100) : 0}%`;
}

// ── Lessons & exercises ──────────────────────────────────
function loadLesson(i) {
  curLesson = i;
  const l = curriculum[i];
  $('lesson-title').textContent = l.title[lang];
  $('lesson-meta').textContent  = l.meta[lang];
  $('lesson-body').innerHTML    = l.body[lang];
  $('task-label').textContent   = t('Tapşırıq', 'Exercise');
  if (course.onLesson) course.onLesson(i);
  renderSidebar();
  loadExercise(0);
  if (isMobile()) switchTab('lesson');
}

function loadExercise(ei) {
  curExercise = ei;
  const ex = currentExercise();
  $('task-text')[course.taskIsHTML ? 'innerHTML' : 'textContent'] = ex.task[lang];
  $('ex-title').textContent  = t(`Məşq ${ei + 1}`, `Exercise ${ei + 1}`);
  $('feedback').textContent  = '';
  cm.setValue(course.storage.get(curLesson, ei) || ex.starter);
  cm.clearHistory();
  renderExNav();
  course.onExerciseLoad();
}

function renderExNav() {
  const nav = $('ex-nav');
  nav.innerHTML = '';
  curriculum[curLesson].exercises.forEach((_, ei) => {
    const b = document.createElement('button');
    b.className = 'ex-dot' + (ei === curExercise ? ' active' : '') + ((done[curLesson] || []).includes(ei) ? ' done' : '');
    b.textContent = ei + 1;
    b.onclick = () => loadExercise(ei);
    nav.appendChild(b);
  });
}

function nextStep() {
  if (curExercise + 1 < curriculum[curLesson].exercises.length) loadExercise(curExercise + 1);
  else if (curLesson + 1 < curriculum.length) loadLesson(curLesson + 1);
}

// ── Buttons: run / reset / hint ──────────────────────────
function runCode()   { return course.run(cm.getValue()); }
function resetCode() {
  cm.setValue(currentExercise().starter);
  $('feedback').textContent = '';
  course.onReset();
}
function hintHTML(ex) { return `<span class="fb-hint">💡 ${ex.hint[lang]}</span>`; }
function showHint()   { $('feedback').innerHTML = hintHTML(currentExercise()); }

// Called by a course when the current exercise's check() passes.
function exercisePassed() {
  if (!done[curLesson]) done[curLesson] = [];
  if (!done[curLesson].includes(curExercise)) done[curLesson].push(curExercise);
  renderExNav();
  renderSidebar();
  const hasNext = curExercise + 1 < curriculum[curLesson].exercises.length || curLesson + 1 < curriculum.length;
  $('feedback').innerHTML = `<span class="fb-pass">✅ ${t('Düzgündür!', 'Correct!')}</span>`
    + (hasNext ? `<button class="btn-next" onclick="nextStep()">${t('Növbəti →', 'Next →')}</button>` : '');
}

// ── Text console (JS + Python courses) ───────────────────
function setInfo(msg) { $('output').innerHTML = `<span class="out-info">${msg}</span>`; }
function printLine(text, cls) {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  $('output').appendChild(d);
}
// Compare the program's printed output with the exercise's check().
function checkConsole(output) {
  const ex = currentExercise();
  if (ex.check(output)) exercisePassed();
  else $('feedback').innerHTML = hintHTML(ex);
}
const consoleCourse = {
  onExerciseLoad() { setInfo(`▶ ${t('Kodu işlət', 'Run your code')}`); },
  onReset()        { setInfo(`↺ ${t('Sıfırlandı.', 'Reset.')}`); }
};

// ── Boot ─────────────────────────────────────────────────
function boot() {
  const key = document.body.dataset.course;
  if (!key) return;                        // the hub page has no lessons
  course = COURSES[key];
  curriculum = course.curriculum;

  const spaces = ' '.repeat(course.indent);
  cm = CodeMirror.fromTextArea($('editor'), {
    mode: course.mode, theme: 'dracula', lineNumbers: true,
    indentUnit: course.indent, tabSize: course.indent, indentWithTabs: false,
    extraKeys: { Tab: c => c.replaceSelection(spaces), 'Ctrl-Enter': runCode, 'Cmd-Enter': runCode }
  });
  cm.on('change', () => course.storage.set(curLesson, curExercise, cm.getValue()));

  window.addEventListener('resize', () => {
    if (isMobile()) return;
    closeSidebar();
    $('lesson-panel').classList.add('tab-active');
    $('exercise-panel').classList.add('tab-active');
  });

  loadLesson(0);
  if (course.init) course.init();
}
window.addEventListener('DOMContentLoaded', boot);


/* ============================================================================
   COURSE: JavaScript  (runs the code in the browser, checks console output)
   ============================================================================ */
function runJS(code) {
  const lines = [];
  const show = a => a === null ? 'null'
    : typeof a === 'object' ? (() => { try { return JSON.stringify(a); } catch { return String(a); } })()
    : String(a);
  const fakeConsole = { log: (...args) => lines.push(args.map(show).join(' ')) };
  try { new Function('console', code)(fakeConsole); }
  catch (e) { return { lines, error: e.message }; }
  return { lines, error: null };
}

COURSES.js = {
  ...consoleCourse,
  mode: 'javascript',
  indent: 2,
  storage: perExerciseStorage('jsb2'),
  init() { setInfo(t('Hazırdır. Kodu yazıb işlət!', 'Ready. Write and run!')); },
  run(code) {
    $('output').innerHTML = '';
    $('feedback').textContent = '';
    const { lines, error } = runJS(code);
    lines.forEach(l => printLine(l, 'out-ok'));
    if (error) return printLine('❌ ' + error, 'out-err');
    if (!lines.length) setInfo(t('Çıxış yoxdur.', 'No output.'));
    checkConsole(lines.join('\n'));
  },
  curriculum: [
{id:0,section:{az:'Əsaslar',en:'Basics'},
 title:{az:'Giriş: JavaScript nədir?',en:'Intro: What is JavaScript?'},
 meta:{az:'Dərs 0 · 2 dəq',en:'Lesson 0 · 2 min'},
 body:{
  az:`<p>JavaScript — veb səhifələrini interaktiv edən proqramlaşdırma dilidir. Brauzer daxilində birbaşa işləyir, server lazım deyil.</p>
<p>Çıxış üçün <b>console.log()</b> funksiyasından istifadə edirik:</p>
<pre><span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Salam, dünya!"</span>)</pre>
<p>Şərh əlavə etmək üçün <b>//</b> (bir sətir) və ya <b>/* */</b> (çox sətir):</p>
<pre><span class="cm">// Bu şərhdir</span>
<span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Salam!"</span>) <span class="cm">// inline şərh</span></pre>`,
  en:`<p>JavaScript is the programming language of the web. It runs directly in the browser — no server needed.</p>
<p>Use <b>console.log()</b> to display output:</p>
<pre><span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Hello, world!"</span>)</pre>
<p>Comments: <b>//</b> for single line, <b>/* */</b> for multi-line:</p>
<pre><span class="cm">// This is a comment</span>
<span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Hello!"</span>) <span class="cm">// inline comment</span></pre>`
 },
 exercises:[
  {task:{az:'Ekrana "Salam, JavaScript!" çap edin.',en:'Print "Hello, JavaScript!" to the console.'},
   starter:'// Kodunuzu buraya yazın\n',check:o=>o.includes('Salam, JavaScript!')||o.includes('Hello, JavaScript!'),hint:{az:'console.log("Salam, JavaScript!")',en:'console.log("Hello, JavaScript!")'}},
  {task:{az:'İki ayrı console.log() ilə "JavaScript" və "Maraqlıdır!" çap edin.',en:'Use two console.log() calls to print "JavaScript" and "Awesome!"'},
   starter:'',check:o=>o.split('\n').filter(l=>l.trim()).length>=2,hint:{az:'İki ayrı console.log() yazın',en:'Write two separate console.log() calls'}},
  {task:{az:'console.log() içərisində 18 + 24 hesablayın. Cavab: 42.',en:'Calculate 18 + 24 inside console.log(). Answer: 42.'},
   starter:'',check:o=>o.includes('42'),hint:{az:'console.log(18 + 24)',en:'console.log(18 + 24)'}},
  {task:{az:'Adınızı, yaşınızı və şəhərinizi üç ayrı console.log() ilə çap edin.',en:'Print your name, age, and city using three separate console.log() calls.'},
   starter:'',check:o=>o.split('\n').filter(l=>l.trim()).length>=3,hint:{az:'Üç ayrı console.log() yazın',en:'Write three separate console.log() calls'}},
 ]
},
{id:1,
 title:{az:'Dəyişənlər (let, const, var)',en:'Variables (let, const, var)'},
 meta:{az:'Dərs 1 · 5 dəq',en:'Lesson 1 · 5 min'},
 body:{
  az:`<p>JavaScript-də dəyişən elan etmək üçün üç açar söz var:</p>
<pre><span class="kw">let</span> ad = <span class="str">"Kənan"</span>       <span class="cm">// dəyişdirilə bilər</span>
<span class="kw">const</span> PI = <span class="num">3.14</span>      <span class="cm">// sabit, dəyişdirilməz</span>
<span class="kw">var</span> yas = <span class="num">22</span>         <span class="cm">// köhnə üsul</span></pre>
<p>Müasir JS-də <b>let</b> və <b>const</b> istifadə edin.</p>
<pre><span class="kw">let</span> x = <span class="num">10</span>
x = <span class="num">20</span>   <span class="cm">// ✅ let dəyişdirilə bilər</span>
<span class="kw">const</span> Y = <span class="num">10</span>
<span class="cm">// Y = 20  ← ❌ XƏTA!</span></pre>
<p>Şablon sətri (template literal):</p>
<pre><span class="kw">const</span> salam = <span class="str">\`Ad: \${ad}, Yaş: \${yas}\`</span>
<span class="fn">console</span>.<span class="fn">log</span>(salam)</pre>`,
  en:`<p>JavaScript has three ways to declare variables:</p>
<pre><span class="kw">let</span> name = <span class="str">"Kenan"</span>     <span class="cm">// can be reassigned</span>
<span class="kw">const</span> PI = <span class="num">3.14</span>      <span class="cm">// constant, cannot change</span>
<span class="kw">var</span> age = <span class="num">22</span>         <span class="cm">// old style, avoid</span></pre>
<p>In modern JS, prefer <b>let</b> and <b>const</b>.</p>
<pre><span class="kw">let</span> x = <span class="num">10</span>
x = <span class="num">20</span>   <span class="cm">// ✅ let can be reassigned</span>
<span class="kw">const</span> Y = <span class="num">10</span>
<span class="cm">// Y = 20  ← ❌ ERROR!</span></pre>
<p>Template literals for interpolation:</p>
<pre><span class="kw">const</span> msg = <span class="str">\`Name: \${name}, Age: \${age}\`</span>
<span class="fn">console</span>.<span class="fn">log</span>(msg)</pre>`
 },
 exercises:[
  {task:{az:'"ad" dəyişənini let ilə yaradın, adınızı verin və çap edin.',en:'Declare a "name" variable with let, assign your name, and log it.'},
   starter:'',check:o=>o.trim().length>0,hint:{az:'let ad = "Adınız"\nconsole.log(ad)',en:'let name = "YourName"\nconsole.log(name)'}},
  {task:{az:'"en" və "hündürlük" dəyişənlərini const ilə yaradın. Sahəni çap edin.',en:'Declare "width" and "height" with const. Log their area.'},
   starter:'',check:o=>!isNaN(o.trim().split('\n').pop()),hint:{az:'console.log(en * hündürlük)',en:'console.log(width * height)'}},
  {task:{az:'ad, yas, şəhər yaradın. Template literal ilə "Mənim adım X, yaşım Y, şəhərim Z" çap edin.',en:'Create name, age, city. Use a template literal to log "My name is X, age Y, city Z".'},
   starter:'',check:o=>o.includes('adım')||o.includes('name is'),hint:{az:'console.log(`Mənim adım ${ad}...`)',en:'console.log(`My name is ${name}...`)'}},
  {task:{az:'let counter=0. 3 dəfə +=5 edin. Final dəyəri çap edin (15 olmalıdır).',en:'let counter=0. Add 5 three times using +=. Log the final value (should be 15).'},
   starter:'let counter = 0\n',check:o=>o.includes('15'),hint:{az:'counter += 5  // 3 dəfə',en:'counter += 5  // three times'}},
 ]
},
{id:2,
 title:{az:'Məlumat tipləri',en:'Data Types'},
 meta:{az:'Dərs 2 · 6 dəq',en:'Lesson 2 · 6 min'},
 body:{
  az:`<p>JavaScript-in əsas tipləri:</p>
<pre><span class="kw">typeof</span> <span class="num">42</span>          <span class="cm">// "number"</span>
<span class="kw">typeof</span> <span class="str">"salam"</span>    <span class="cm">// "string"</span>
<span class="kw">typeof</span> <span class="kw">true</span>       <span class="cm">// "boolean"</span>
<span class="kw">typeof</span> <span class="kw">undefined</span>  <span class="cm">// "undefined"</span>
<span class="kw">typeof</span> <span class="kw">null</span>       <span class="cm">// "object" ← JS xətası!</span></pre>
<p>Tip çevirmələri:</p>
<pre><span class="fn">Number</span>(<span class="str">"42"</span>)      <span class="cm">// 42</span>
<span class="fn">String</span>(<span class="num">99</span>)       <span class="cm">// "99"</span>
<span class="fn">Boolean</span>(<span class="num">0</span>)      <span class="cm">// false</span>
<span class="fn">parseInt</span>(<span class="str">"3.9"</span>) <span class="cm">// 3</span></pre>
<p>Riyazi: <b>+ - * / % **</b> · Math: <b>Math.round(), Math.floor(), Math.ceil(), Math.random()</b></p>`,
  en:`<p>JavaScript's main types:</p>
<pre><span class="kw">typeof</span> <span class="num">42</span>          <span class="cm">// "number"</span>
<span class="kw">typeof</span> <span class="str">"hello"</span>    <span class="cm">// "string"</span>
<span class="kw">typeof</span> <span class="kw">true</span>       <span class="cm">// "boolean"</span>
<span class="kw">typeof</span> <span class="kw">undefined</span>  <span class="cm">// "undefined"</span>
<span class="kw">typeof</span> <span class="kw">null</span>       <span class="cm">// "object" ← JS quirk!</span></pre>
<p>Type conversions:</p>
<pre><span class="fn">Number</span>(<span class="str">"42"</span>)      <span class="cm">// 42</span>
<span class="fn">String</span>(<span class="num">99</span>)       <span class="cm">// "99"</span>
<span class="fn">Boolean</span>(<span class="num">0</span>)      <span class="cm">// false</span>
<span class="fn">parseInt</span>(<span class="str">"3.9"</span>) <span class="cm">// 3</span></pre>
<p>Math operators: <b>+ - * / % **</b> · Math object: <b>Math.round(), Math.floor(), Math.ceil()</b></p>`
 },
 exercises:[
  {task:{az:'number, string, boolean tipli 3 dəyişən yaradın. Hər birinin tipini typeof ilə çap edin.',en:'Create 3 variables: number, string, boolean. Log each type using typeof.'},
   starter:'',check:o=>o.includes('number')&&o.includes('string')&&o.includes('boolean'),hint:{az:'console.log(typeof dəyişən)',en:'console.log(typeof variable)'}},
  {task:{az:'"37" mətnini ədədə çevirin, 5 ilə vurun. Nəticə 185.',en:'Convert "37" to a number and multiply by 5. Result: 185.'},
   starter:'const s = "37"\n',check:o=>o.includes('185'),hint:{az:'console.log(Number(s) * 5)',en:'console.log(Number(s) * 5)'}},
  {task:{az:'Math.round(4.6), Math.floor(4.9), Math.ceil(4.1) nəticələrini çap edin.',en:'Log Math.round(4.6), Math.floor(4.9), Math.ceil(4.1).'},
   starter:'',check:o=>o.includes('5')&&o.includes('4'),hint:{az:'console.log(Math.round(4.6))\nconsole.log(Math.floor(4.9))\nconsole.log(Math.ceil(4.1))',en:'console.log(Math.round(4.6))\nconsole.log(Math.floor(4.9))\nconsole.log(Math.ceil(4.1))'}},
  {task:{az:'2**10 qüvvətini hesablayın. Cavab: 1024.',en:'Calculate 2**10. Answer: 1024.'},
   starter:'',check:o=>o.includes('1024'),hint:{az:'console.log(2 ** 10)',en:'console.log(2 ** 10)'}},
  {task:{az:'Boolean(0), Boolean(""), Boolean("salam"), Boolean(1) çap edin.',en:'Log Boolean(0), Boolean(""), Boolean("hello"), Boolean(1).'},
   starter:'',check:o=>o.includes('false')&&o.includes('true'),hint:{az:'console.log(Boolean(0), Boolean(""), Boolean("salam"), Boolean(1))',en:'console.log(Boolean(0), Boolean(""), Boolean("hello"), Boolean(1))'}},
 ]
},
{id:3,section:{az:'Mətn',en:'Strings'},
 title:{az:'Stringlər',en:'Strings'},
 meta:{az:'Dərs 3 · 7 dəq',en:'Lesson 3 · 7 min'},
 body:{
  az:`<pre><span class="kw">const</span> s = <span class="str">"JavaScript"</span>
s.<span class="bi">length</span>              <span class="cm">// 10</span>
s.<span class="fn">toUpperCase</span>()       <span class="cm">// JAVASCRIPT</span>
s.<span class="fn">toLowerCase</span>()       <span class="cm">// javascript</span>
s.<span class="fn">includes</span>(<span class="str">"Script"</span>)  <span class="cm">// true</span>
s.<span class="fn">replace</span>(<span class="str">"Java"</span>,<span class="str">"Type"</span>) <span class="cm">// TypeScript</span>
s.<span class="fn">slice</span>(<span class="num">0</span>,<span class="num">4</span>)           <span class="cm">// Java</span>
s.<span class="fn">split</span>(<span class="str">"a"</span>)           <span class="cm">// array</span>
s.<span class="fn">trim</span>()              <span class="cm">// boşluqları sil</span></pre>
<p>Template literal:</p>
<pre><span class="kw">const</span> n=<span class="str">"Kənan"</span>, y=<span class="num">25</span>
<span class="fn">console</span>.<span class="fn">log</span>(<span class="str">\`Ad: \${n}, Yaş: \${y}\`</span>)</pre>`,
  en:`<pre><span class="kw">const</span> s = <span class="str">"JavaScript"</span>
s.<span class="bi">length</span>              <span class="cm">// 10</span>
s.<span class="fn">toUpperCase</span>()       <span class="cm">// JAVASCRIPT</span>
s.<span class="fn">toLowerCase</span>()       <span class="cm">// javascript</span>
s.<span class="fn">includes</span>(<span class="str">"Script"</span>)  <span class="cm">// true</span>
s.<span class="fn">replace</span>(<span class="str">"Java"</span>,<span class="str">"Type"</span>) <span class="cm">// TypeScript</span>
s.<span class="fn">slice</span>(<span class="num">0</span>,<span class="num">4</span>)           <span class="cm">// Java</span>
s.<span class="fn">split</span>(<span class="str">"a"</span>)           <span class="cm">// array</span>
s.<span class="fn">trim</span>()              <span class="cm">// remove whitespace</span></pre>
<p>Template literal:</p>
<pre><span class="kw">const</span> n=<span class="str">"Kenan"</span>, y=<span class="num">25</span>
<span class="fn">console</span>.<span class="fn">log</span>(<span class="str">\`Name: \${n}, Age: \${y}\`</span>)</pre>`
 },
 exercises:[
  {task:{az:'"javascript" sözünü böyük hərflərə çevirin.',en:'Convert "javascript" to uppercase.'},
   starter:'const s = "javascript"\n',check:o=>o.includes('JAVASCRIPT'),hint:{az:'console.log(s.toUpperCase())',en:'console.log(s.toUpperCase())'}},
  {task:{az:'"Veb Proqramlaşdırma" mətninin uzunluğunu, ilk 3 simvolunu və "Proqram" içindəmi olduğunu çap edin.',en:'Log the length, first 3 chars, and whether "Program" is in "Web Programming".'},
   starter:'const s = "Veb Proqramlaşdırma"\n',check:o=>o.split('\n').filter(l=>l.trim()).length>=2,hint:{az:'s.length, s.slice(0,3), s.includes("Proqram")',en:'s.length, s.slice(0,3), s.includes("Program")'}},
  {task:{az:'"  salam dünya  " mətnindən boşluqları silin (.trim()).',en:'Remove whitespace from "  hello world  " using .trim().'},
   starter:'const s = "  salam dünya  "\n',check:o=>!o.startsWith(' '),hint:{az:'console.log(s.trim())',en:'console.log(s.trim())'}},
  {task:{az:'"bakı,gəncə,sumqayıt,lənkəran" mətnini vergüllə parçalayın.',en:'Split "baku,ganja,sumgait,lankaran" by comma.'},
   starter:'const s = "bakı,gəncə,sumqayıt,lənkəran"\n',check:o=>o.includes('['),hint:{az:'console.log(s.split(","))',en:'console.log(s.split(","))'}},
  {task:{az:'Ad və soyadı const-lara yazın. Template literal ilə "Ad Soyad" çap edin.',en:'Store first and last name. Log "First Last" using a template literal.'},
   starter:'',check:o=>o.trim().length>0&&!o.includes('undefined'),hint:{az:'console.log(`${ad} ${soyad}`)',en:'console.log(`${first} ${last}`)'}},
 ]
},
{id:4,section:{az:'Nəzarət axını',en:'Control Flow'},
 title:{az:'Şərtlər (if / else / switch)',en:'Conditions (if / else / switch)'},
 meta:{az:'Dərs 4 · 7 dəq',en:'Lesson 4 · 7 min'},
 body:{
  az:`<pre><span class="kw">if</span> (yas >= <span class="num">18</span>) {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Böyükdür"</span>)
} <span class="kw">else if</span> (yas >= <span class="num">13</span>) {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Yeniyetmə"</span>)
} <span class="kw">else</span> {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Uşaq"</span>)
}</pre>
<p>Ternary: <code>şərt ? doğru : yanlış</code></p>
<pre><span class="kw">const</span> tip = n % <span class="num">2</span> === <span class="num">0</span> ? <span class="str">"Cüt"</span> : <span class="str">"Tək"</span></pre>
<p>switch/case:</p>
<pre><span class="kw">switch</span>(gün) {
  <span class="kw">case</span> <span class="num">1</span>: <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"B.e."</span>); <span class="kw">break</span>
  <span class="kw">default</span>: <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Digər"</span>)
}</pre>
<p>Müqayisə: <b>===</b> <b>!==</b> <b>&gt;</b> <b>&lt;</b> <b>&amp;&amp;</b> <b>||</b> <b>!</b></p>`,
  en:`<pre><span class="kw">if</span> (age >= <span class="num">18</span>) {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Adult"</span>)
} <span class="kw">else if</span> (age >= <span class="num">13</span>) {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Teenager"</span>)
} <span class="kw">else</span> {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Child"</span>)
}</pre>
<p>Ternary: <code>condition ? true : false</code></p>
<pre><span class="kw">const</span> type = n % <span class="num">2</span> === <span class="num">0</span> ? <span class="str">"Even"</span> : <span class="str">"Odd"</span></pre>
<p>switch/case:</p>
<pre><span class="kw">switch</span>(day) {
  <span class="kw">case</span> <span class="num">1</span>: <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Mon"</span>); <span class="kw">break</span>
  <span class="kw">default</span>: <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Other"</span>)
}</pre>
<p>Comparison: <b>===</b> <b>!==</b> <b>&gt;</b> <b>&lt;</b> <b>&amp;&amp;</b> <b>||</b> <b>!</b></p>`
 },
 exercises:[
  {task:{az:'temp=38. 35-dən böyükdürsə "İsti", 15-dən aşağıdırsa "Soyuq", əks halda "Mülayim".',en:'temp=38. "Hot" if >35, "Cold" if <15, else "Mild".'},
   starter:'const temp = 38\n',check:o=>o.includes('İsti')||o.includes('Hot'),hint:{az:'if (temp > 35) ... else if (temp < 15) ...',en:'if (temp > 35) ... else if (temp < 15) ...'}},
  {task:{az:'score=82. 90+→"A", 80-89→"B", 70-79→"C", 60-69→"D", aşağı→"F".',en:'score=82. "A" for 90+, "B" for 80-89, "C" for 70-79, "D" for 60-69, "F" otherwise.'},
   starter:'const score = 82\n',check:o=>o.includes('B'),hint:{az:'else if (score >= 80) { console.log("B") }',en:'else if (score >= 80) { console.log("B") }'}},
  {task:{az:'n=7. Ternary ilə cüt/tək olduğunu çap edin.',en:'n=7. Use ternary to log "Even" or "Odd".'},
   starter:'const n = 7\n',check:o=>o.includes('Tək')||o.includes('Odd'),hint:{az:'const tip = n%2===0?"Cüt":"Tək"\nconsole.log(tip)',en:'const type = n%2===0?"Even":"Odd"\nconsole.log(type)'}},
  {task:{az:'gun=3 üçün switch/case ilə gün adını çap edin. gun=3 → "Çərşənbə".',en:'Use switch/case for day=3: day=3 → "Wednesday".'},
   starter:'const gun = 3\n',check:o=>o.includes('Çərşənbə')||o.includes('Wednesday'),hint:{az:'case 3: console.log("Çərşənbə"); break',en:'case 3: console.log("Wednesday"); break'}},
 ]
},
{id:5,
 title:{az:'Dövrlər (for / while / for...of)',en:'Loops (for / while / for...of)'},
 meta:{az:'Dərs 5 · 8 dəq',en:'Lesson 5 · 8 min'},
 body:{
  az:`<pre><span class="kw">for</span> (<span class="kw">let</span> i=<span class="num">0</span>; i<<span class="num">5</span>; i++) <span class="fn">console</span>.<span class="fn">log</span>(i)</pre>
<p>while:</p>
<pre><span class="kw">let</span> say = <span class="num">1</span>
<span class="kw">while</span> (say <= <span class="num">5</span>) { <span class="fn">console</span>.<span class="fn">log</span>(say); say++ }</pre>
<p>for...of — massiv üzərindən:</p>
<pre><span class="kw">for</span> (<span class="kw">const</span> m <span class="kw">of</span> [<span class="str">"alma"</span>,<span class="str">"armud"</span>]) <span class="fn">console</span>.<span class="fn">log</span>(m)</pre>
<p><b>break</b> — dövrü dayandırır · <b>continue</b> — növbəti iterasiyaya keçir</p>`,
  en:`<pre><span class="kw">for</span> (<span class="kw">let</span> i=<span class="num">0</span>; i<<span class="num">5</span>; i++) <span class="fn">console</span>.<span class="fn">log</span>(i)</pre>
<p>while:</p>
<pre><span class="kw">let</span> count = <span class="num">1</span>
<span class="kw">while</span> (count <= <span class="num">5</span>) { <span class="fn">console</span>.<span class="fn">log</span>(count); count++ }</pre>
<p>for...of — iterates over arrays:</p>
<pre><span class="kw">for</span> (<span class="kw">const</span> f <span class="kw">of</span> [<span class="str">"apple"</span>,<span class="str">"pear"</span>]) <span class="fn">console</span>.<span class="fn">log</span>(f)</pre>
<p><b>break</b> — stops the loop · <b>continue</b> — skips to next iteration</p>`
 },
 exercises:[
  {task:{az:'for dövrü ilə 1-10 ədədlərinin cəmini tapın. Cavab: 55.',en:'Use a for loop to sum numbers 1–10. Answer: 55.'},
   starter:'let total = 0\n',check:o=>o.includes('55'),hint:{az:'for(let i=1;i<=10;i++) total+=i',en:'for(let i=1;i<=10;i++) total+=i'}},
  {task:{az:'for dövrü ilə 1-100 arasındakı cüt ədədləri çap edin.',en:'Print all even numbers from 1 to 100 using a for loop.'},
   starter:'',check:o=>o.includes('2')&&o.includes('100'),hint:{az:'if(i%2===0) console.log(i)',en:'if(i%2===0) console.log(i)'}},
  {task:{az:'while dövrü ilə 2-nin qüvvətlərini (1,2,4,...) 1000-dən kiçik olanları çap edin.',en:'Use while to print powers of 2 (1,2,4,...) less than 1000.'},
   starter:'let n = 1\n',check:o=>o.includes('512'),hint:{az:'while(n<1000){console.log(n);n*=2}',en:'while(n<1000){console.log(n);n*=2}'}},
  {task:{az:'["Bakı","Gəncə","Sumqayıt","Lənkəran"] massivini for...of ilə çap edin.',en:'Log each item in ["Baku","Ganja","Sumgait","Lankaran"] using for...of.'},
   starter:'const şəhərlər = ["Bakı","Gəncə","Sumqayıt","Lənkəran"]\n',check:o=>o.includes('Bakı')||o.includes('Baku'),hint:{az:'for(const s of şəhərlər) console.log(s)',en:'for(const c of cities) console.log(c)'}},
  {task:{az:'İç-içə for ilə 5x5 ulduz (*) cədvəli çap edin.',en:'Print a 5×5 grid of asterisks using nested for loops.'},
   starter:'',check:o=>o.split('\n').filter(l=>l.includes('*')).length>=5,hint:{az:'for(let i=0;i<5;i++){let r="";for(let j=0;j<5;j++)r+="* ";console.log(r)}',en:'for(let i=0;i<5;i++){let r="";for(let j=0;j<5;j++)r+="* ";console.log(r)}'}},
 ]
},
{id:6,section:{az:'Məlumat strukturları',en:'Data Structures'},
 title:{az:'Massivlər (Arrays)',en:'Arrays'},
 meta:{az:'Dərs 6 · 8 dəq',en:'Lesson 6 · 8 min'},
 body:{
  az:`<pre><span class="kw">const</span> arr = [<span class="str">"alma"</span>,<span class="str">"armud"</span>,<span class="str">"gilas"</span>]
arr.<span class="fn">push</span>(<span class="str">"üzüm"</span>)     <span class="cm">// sona əlavə</span>
arr.<span class="fn">pop</span>()           <span class="cm">// sonuncunu sil</span>
arr.<span class="fn">unshift</span>(<span class="str">"ərik"</span>) <span class="cm">// əvvələ əlavə</span>
arr.<span class="bi">length</span>           <span class="cm">// uzunluq</span></pre>
<p>Güclü metodlar:</p>
<pre>arr.<span class="fn">filter</span>(x => x.<span class="bi">length</span> > <span class="num">4</span>)
arr.<span class="fn">map</span>(x => x.<span class="fn">toUpperCase</span>())
arr.<span class="fn">reduce</span>((a,x) => a+x, <span class="str">""</span>)
arr.<span class="fn">sort</span>((a,b) => a-b)</pre>`,
  en:`<pre><span class="kw">const</span> arr = [<span class="str">"apple"</span>,<span class="str">"pear"</span>,<span class="str">"cherry"</span>]
arr.<span class="fn">push</span>(<span class="str">"grape"</span>)     <span class="cm">// add to end</span>
arr.<span class="fn">pop</span>()             <span class="cm">// remove last</span>
arr.<span class="fn">unshift</span>(<span class="str">"apricot"</span>) <span class="cm">// add to front</span>
arr.<span class="bi">length</span>             <span class="cm">// length</span></pre>
<p>Powerful methods:</p>
<pre>arr.<span class="fn">filter</span>(x => x.<span class="bi">length</span> > <span class="num">4</span>)
arr.<span class="fn">map</span>(x => x.<span class="fn">toUpperCase</span>())
arr.<span class="fn">reduce</span>((a,x) => a+x, <span class="str">""</span>)
arr.<span class="fn">sort</span>((a,b) => a-b)</pre>`
 },
 exercises:[
  {task:{az:'[10,20,30,40,50] cəmini .reduce() ilə, maksimumunu Math.max(...arr) ilə çap edin.',en:'Log the sum of [10,20,30,40,50] via .reduce() and max via Math.max(...arr).'},
   starter:'const arr = [10,20,30,40,50]\n',check:o=>o.includes('150')&&o.includes('50'),hint:{az:'arr.reduce((a,x)=>a+x,0) və Math.max(...arr)',en:'arr.reduce((a,x)=>a+x,0) and Math.max(...arr)'}},
  {task:{az:'[1..10] massivindən cüt ədədləri .filter() ilə götürün.',en:'Use .filter() to get even numbers from [1..10].'},
   starter:'const nums = [1,2,3,4,5,6,7,8,9,10]\n',check:o=>o.includes('2')&&o.includes('10')&&!o.includes(',1,'),hint:{az:'nums.filter(x=>x%2===0)',en:'nums.filter(x=>x%2===0)'}},
  {task:{az:'[1,2,3,4,5] massivindəki hər elementi .map() ilə kvadratına çevirin. Nəticə: [1,4,9,16,25].',en:'Use .map() to square each element of [1,2,3,4,5]. Result: [1,4,9,16,25].'},
   starter:'const nums = [1,2,3,4,5]\n',check:o=>o.includes('25')&&o.includes('16'),hint:{az:'nums.map(x=>x**2)',en:'nums.map(x=>x**2)'}},
  {task:{az:'["Python","Java","C++","JavaScript"] massivindən "Java"nı silin. Massivi çap edin.',en:'Remove "Java" from ["Python","Java","C++","JavaScript"]. Log the result.'},
   starter:'const dillər = ["Python","Java","C++","JavaScript"]\n',check:o=>!o.includes('Java')&&o.includes('Python'),hint:{az:'dillər.splice(dillər.indexOf("Java"),1)',en:'langs.splice(langs.indexOf("Java"),1)'}},
  {task:{az:'[5,3,8,1,9,2,7] massivini azalan sırada çap edin. İlk element 9 olmalıdır.',en:'Sort [5,3,8,1,9,2,7] descending. First element should be 9.'},
   starter:'const n = [5,3,8,1,9,2,7]\n',check:o=>o.indexOf('9')<o.indexOf('1'),hint:{az:'n.sort((a,b)=>b-a)',en:'n.sort((a,b)=>b-a)'}},
 ]
},
{id:7,
 title:{az:'Obyektlər (Objects)',en:'Objects'},
 meta:{az:'Dərs 7 · 8 dəq',en:'Lesson 7 · 8 min'},
 body:{
  az:`<pre><span class="kw">const</span> t = { ad:<span class="str">"Kənan"</span>, yas:<span class="num">21</span>, bal:<span class="num">88</span> }
t.ad           <span class="cm">// Kənan</span>
t[<span class="str">"yas"</span>]        <span class="cm">// 21</span>
t.şəhər = <span class="str">"Bakı"</span> <span class="cm">// yeni xüsusiyyət</span></pre>
<p>Metodlar:</p>
<pre><span class="fn">Object</span>.<span class="fn">keys</span>(t)     <span class="cm">// açarlar</span>
<span class="fn">Object</span>.<span class="fn">values</span>(t)   <span class="cm">// dəyərlər</span>
<span class="fn">Object</span>.<span class="fn">entries</span>(t)  <span class="cm">// cütlər</span></pre>
<p>Destructuring:</p>
<pre><span class="kw">const</span> { ad, yas } = t
<span class="fn">console</span>.<span class="fn">log</span>(ad, yas)</pre>`,
  en:`<pre><span class="kw">const</span> s = { name:<span class="str">"Kenan"</span>, age:<span class="num">21</span>, score:<span class="num">88</span> }
s.name          <span class="cm">// Kenan</span>
s[<span class="str">"age"</span>]        <span class="cm">// 21</span>
s.city = <span class="str">"Baku"</span>  <span class="cm">// new property</span></pre>
<p>Methods:</p>
<pre><span class="fn">Object</span>.<span class="fn">keys</span>(s)     <span class="cm">// keys</span>
<span class="fn">Object</span>.<span class="fn">values</span>(s)   <span class="cm">// values</span>
<span class="fn">Object</span>.<span class="fn">entries</span>(s)  <span class="cm">// pairs</span></pre>
<p>Destructuring:</p>
<pre><span class="kw">const</span> { name, age } = s
<span class="fn">console</span>.<span class="fn">log</span>(name, age)</pre>`
 },
 exercises:[
  {task:{az:'Özünüz haqqında obyekt: ad, yas, şəhər. Hər dəyəri ayrıca çap edin.',en:'Create an object: name, age, city. Log each value separately.'},
   starter:'',check:o=>o.split('\n').filter(l=>l.trim()).length>=3,hint:{az:'const mən={ad:"...",yas:...}',en:'const me={name:"...",age:...}'}},
  {task:{az:'{a:1,b:2,c:3} obyektini Object.entries()+for...of ilə çap edin.',en:'Log all pairs of {a:1,b:2,c:3} using Object.entries() + for...of.'},
   starter:'const d = {a:1,b:2,c:3}\n',check:o=>o.includes('a')&&o.includes('1')&&o.includes('c'),hint:{az:'for(const [k,v] of Object.entries(d)) console.log(k,v)',en:'for(const [k,v] of Object.entries(d)) console.log(k,v)'}},
  {task:{az:'Destructuring ilə {ad:"Kənan",yas:21,bal:92} obyektindən ad və bal çıxarın. Template literal ilə çap edin.',en:'Destructure name and score from {name:"Kenan",age:21,score:92}. Log with template literal.'},
   starter:'const t = {ad:"Kənan", yas:21, bal:92}\n',check:o=>o.includes('Kənan')&&o.includes('92'),hint:{az:'const {ad,bal}=t\nconsole.log(`${ad}: ${bal}`)',en:'const {name,score}=t\nconsole.log(`${name}: ${score}`)'}},
  {task:{az:'[{ad:"A",bal:80},{ad:"B",bal:95},{ad:"C",bal:73}] — ən yüksək ballının adını çap edin.',en:'[{name:"A",score:80},{name:"B",score:95}] — log the name of the top scorer.'},
   starter:'const tələbələr = [{ad:"A",bal:80},{ad:"B",bal:95},{ad:"C",bal:73}]\n',check:o=>o.includes('B'),hint:{az:'tələbələr.sort((a,b)=>b.bal-a.bal)[0].ad',en:'students.sort((a,b)=>b.score-a.score)[0].name'}},
 ]
},
{id:8,section:{az:'Funksiyalar',en:'Functions'},
 title:{az:'Funksiyalar (function / arrow)',en:'Functions (function / arrow)'},
 meta:{az:'Dərs 8 · 9 dəq',en:'Lesson 8 · 9 min'},
 body:{
  az:`<pre><span class="cm">// Declaration</span>
<span class="kw">function</span> <span class="fn">salam</span>(ad) {
  <span class="kw">return</span> <span class="str">\`Salam, \${ad}!\`</span>
}
<span class="cm">// Arrow</span>
<span class="kw">const</span> <span class="fn">cəm</span> = (a,b) => a+b
<span class="cm">// Default param</span>
<span class="kw">const</span> <span class="fn">güc</span> = (x,d=<span class="num">2</span>) => x**d</pre>
<p>Higher-order funksiyalar:</p>
<pre><span class="kw">const</span> <span class="fn">əməl</span> = (a,b,fn) => fn(a,b)
<span class="fn">console</span>.<span class="fn">log</span>(<span class="fn">əməl</span>(<span class="num">4</span>,<span class="num">5</span>,(a,b)=>a*b)) <span class="cm">// 20</span></pre>`,
  en:`<pre><span class="cm">// Declaration</span>
<span class="kw">function</span> <span class="fn">greet</span>(name) {
  <span class="kw">return</span> <span class="str">\`Hello, \${name}!\`</span>
}
<span class="cm">// Arrow</span>
<span class="kw">const</span> <span class="fn">add</span> = (a,b) => a+b
<span class="cm">// Default param</span>
<span class="kw">const</span> <span class="fn">power</span> = (x,exp=<span class="num">2</span>) => x**exp</pre>
<p>Higher-order functions:</p>
<pre><span class="kw">const</span> <span class="fn">operate</span> = (a,b,fn) => fn(a,b)
<span class="fn">console</span>.<span class="fn">log</span>(<span class="fn">operate</span>(<span class="num">4</span>,<span class="num">5</span>,(a,b)=>a*b)) <span class="cm">// 20</span></pre>`
 },
 exercises:[
  {task:{az:'İki ədədin maksimumunu tapan maxIki(a,b) arrow funksiyası yazın. maxIki(7,12)→12.',en:'Write arrow function maxTwo(a,b) returning the larger. maxTwo(7,12)→12.'},
   starter:'',check:o=>o.includes('12'),hint:{az:'const maxIki=(a,b)=>a>b?a:b',en:'const maxTwo=(a,b)=>a>b?a:b'}},
  {task:{az:'Massiv ortalamasını hesablayan average(arr) yazın. average([10,20,30])→20.',en:'Write average(arr) returning the mean. average([10,20,30])→20.'},
   starter:'',check:o=>o.includes('20'),hint:{az:'const average=arr=>arr.reduce((a,x)=>a+x,0)/arr.length',en:'const average=arr=>arr.reduce((a,x)=>a+x,0)/arr.length'}},
  {task:{az:'Default parametrli salam(ad,dil="az"): dil="az"→"Salam {ad}", dil="en"→"Hello {ad}".',en:'Write greet(name,lang="en"): lang="en"→"Hello {name}", lang="az"→"Salam {name}".'},
   starter:'',check:o=>o.includes('Salam')&&o.includes('Hello'),hint:{az:'const salam=(ad,dil="az")=>dil==="az"?`Salam ${ad}`:`Hello ${ad}`',en:'const greet=(name,lang="en")=>lang==="en"?`Hello ${name}`:`Salam ${name}`'}},
  {task:{az:'Rekursiv factorial(n) yazın. factorial(5)→120.',en:'Write recursive factorial(n). factorial(5)→120.'},
   starter:'',check:o=>o.includes('120'),hint:{az:'function factorial(n){return n<=1?1:n*factorial(n-1)}',en:'function factorial(n){return n<=1?1:n*factorial(n-1)}'}},
  {task:{az:'operate(a,b,fn) yazın. operate(10,3,(a,b)=>a%b)→1.',en:'Write operate(a,b,fn). operate(10,3,(a,b)=>a%b)→1.'},
   starter:'',check:o=>o.trim().split('\n').some(l=>l.trim()==='1'),hint:{az:'const operate=(a,b,fn)=>fn(a,b)\nconsole.log(operate(10,3,(a,b)=>a%b))',en:'const operate=(a,b,fn)=>fn(a,b)\nconsole.log(operate(10,3,(a,b)=>a%b))'}},
 ]
},
{id:9,section:{az:'DOM və Veb',en:'DOM & Web'},
 title:{az:'DOM Manipulyasiyası',en:'DOM Manipulation'},
 meta:{az:'Dərs 9 · 8 dəq',en:'Lesson 9 · 8 min'},
 body:{
  az:`<p>DOM — HTML sənədinin JS tərəfindən idarə olunan təsviridir.</p>
<pre><span class="cm">// Element seçmək</span>
document.<span class="fn">getElementById</span>(<span class="str">"id"</span>)
document.<span class="fn">querySelector</span>(<span class="str">".class"</span>)
document.<span class="fn">querySelectorAll</span>(<span class="str">"tag"</span>)</pre>
<pre><span class="cm">// Məzmun dəyişmək</span>
el.textContent = <span class="str">"Yeni mətn"</span>
el.style.color = <span class="str">"red"</span>
el.classList.<span class="fn">add</span>(<span class="str">"aktiv"</span>)
el.classList.<span class="fn">remove</span>(<span class="str">"aktiv"</span>)</pre>
<pre><span class="cm">// Event</span>
el.<span class="fn">addEventListener</span>(<span class="str">"click"</span>, () => {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Klik!"</span>)
})</pre>`,
  en:`<p>The DOM is JavaScript's interface to HTML documents.</p>
<pre><span class="cm">// Selecting elements</span>
document.<span class="fn">getElementById</span>(<span class="str">"id"</span>)
document.<span class="fn">querySelector</span>(<span class="str">".class"</span>)
document.<span class="fn">querySelectorAll</span>(<span class="str">"tag"</span>)</pre>
<pre><span class="cm">// Changing content</span>
el.textContent = <span class="str">"New text"</span>
el.style.color = <span class="str">"red"</span>
el.classList.<span class="fn">add</span>(<span class="str">"active"</span>)
el.classList.<span class="fn">remove</span>(<span class="str">"active"</span>)</pre>
<pre><span class="cm">// Events</span>
el.<span class="fn">addEventListener</span>(<span class="str">"click"</span>, () => {
  <span class="fn">console</span>.<span class="fn">log</span>(<span class="str">"Clicked!"</span>)
})</pre>`
 },
 exercises:[
  {task:{az:'DOM elementini simulyasiya edin: {textContent:""} obyekti. textContent="Salam!" verin, çap edin.',en:'Simulate a DOM element {textContent:""}. Set textContent="Hello!" and log it.'},
   starter:'const el = {textContent: "", style: {}}\n',check:o=>o.includes('Salam!')||o.includes('Hello!'),hint:{az:'el.textContent="Salam!"\nconsole.log(el.textContent)',en:'el.textContent="Hello!"\nconsole.log(el.textContent)'}},
  {task:{az:'classList simulyasiyası: {classes:[], add(c){...}} obyekti. "aktiv" və "görünür" əlavə edin.',en:'Simulate classList with add(). Add "active" and "visible", log classes.'},
   starter:'const el = {classes:[], add(c){this.classes.push(c)}}\n',check:o=>o.includes('aktiv')||o.includes('active'),hint:{az:'el.add("aktiv")\nel.add("görünür")\nconsole.log(el.classes)',en:'el.add("active")\nel.add("visible")\nconsole.log(el.classes)'}},
  {task:{az:'addEventListener simulyasiyası: "click" eventi üçün callback əlavə edin və çağırın.',en:'Simulate addEventListener: add a "click" callback and fire it.'},
   starter:'const el = {\n  listeners: {},\n  addEventListener(e,fn){this.listeners[e]=fn}\n}\n',check:o=>o.includes('Klik')||o.includes('Click'),hint:{az:'el.addEventListener("click",()=>console.log("Klik!"))\nel.listeners["click"]()',en:'el.addEventListener("click",()=>console.log("Clicked!"))\nel.listeners["click"]()'}},
  {task:{az:'5 fake element massivi: [{id:1,text:"a"},...]. id===3 olanı tapıb text-ini çap edin.',en:'5 fake elements [{id:1,text:"a"},...]. Find id===3 and log its text.'},
   starter:'const elements = [{id:1,text:"alma"},{id:2,text:"armud"},{id:3,text:"gilas"},{id:4,text:"üzüm"},{id:5,text:"ərik"}]\n',check:o=>o.includes('gilas'),hint:{az:'console.log(elements.find(e=>e.id===3).text)',en:'console.log(elements.find(e=>e.id===3).text)'}},
 ]
},
{id:10,section:{az:'Asinxron JS',en:'Async JS'},
 title:{az:'Promises və async/await',en:'Promises & async/await'},
 meta:{az:'Dərs 10 · 9 dəq',en:'Lesson 10 · 9 min'},
 body:{
  az:`<pre><span class="kw">const</span> vəd = <span class="kw">new</span> <span class="fn">Promise</span>((resolve, reject) => {
  <span class="fn">resolve</span>(<span class="str">"Uğurlu!"</span>)
})
vəd.<span class="fn">then</span>(v => <span class="fn">console</span>.<span class="fn">log</span>(v))
   .<span class="fn">catch</span>(e => <span class="fn">console</span>.<span class="fn">log</span>(e))</pre>
<p>async/await:</p>
<pre><span class="kw">async function</span> <span class="fn">gətir</span>() {
  <span class="kw">try</span> {
    <span class="kw">const</span> r = <span class="kw">await</span> <span class="fn">Promise</span>.<span class="fn">resolve</span>(<span class="str">"data"</span>)
    <span class="fn">console</span>.<span class="fn">log</span>(r)
  } <span class="kw">catch</span>(e) { <span class="fn">console</span>.<span class="fn">log</span>(e) }
}
<span class="fn">gətir</span>()</pre>`,
  en:`<pre><span class="kw">const</span> p = <span class="kw">new</span> <span class="fn">Promise</span>((resolve, reject) => {
  <span class="fn">resolve</span>(<span class="str">"Done!"</span>)
})
p.<span class="fn">then</span>(v => <span class="fn">console</span>.<span class="fn">log</span>(v))
 .<span class="fn">catch</span>(e => <span class="fn">console</span>.<span class="fn">log</span>(e))</pre>
<p>async/await:</p>
<pre><span class="kw">async function</span> <span class="fn">fetch</span>() {
  <span class="kw">try</span> {
    <span class="kw">const</span> r = <span class="kw">await</span> <span class="fn">Promise</span>.<span class="fn">resolve</span>(<span class="str">"data"</span>)
    <span class="fn">console</span>.<span class="fn">log</span>(r)
  } <span class="kw">catch</span>(e) { <span class="fn">console</span>.<span class="fn">log</span>(e) }
}
<span class="fn">fetch</span>()</pre>`
 },
 exercises:[
  {task:{az:'"Uğurlu!" ilə resolve olan Promise yaradın. .then() ilə çap edin.',en:'Create a Promise resolving with "Success!". Log it with .then().'},
   starter:'',check:o=>o.includes('Uğurlu')||o.includes('Success'),hint:{az:'new Promise(r=>r("Uğurlu!")).then(v=>console.log(v))',en:'new Promise(r=>r("Success!")).then(v=>console.log(v))'}},
  {task:{az:'reject("Xəta!") olan Promise yaradın. .catch() ilə xəta mesajını çap edin.',en:'Create a Promise that rejects with "Error!". Catch and log it.'},
   starter:'',check:o=>o.includes('Xəta')||o.includes('Error'),hint:{az:'new Promise((_,r)=>r("Xəta!")).catch(e=>console.log(e))',en:'new Promise((_,r)=>r("Error!")).catch(e=>console.log(e))'}},
  {task:{az:'async function yazın, Promise.resolve("ok")-u await edin. Nəticəni çap edin.',en:'Write an async function that awaits Promise.resolve("ok") and logs the result.'},
   starter:'',check:o=>o.includes('ok'),hint:{az:'async function f(){const r=await Promise.resolve("ok");console.log(r)}\nf()',en:'async function f(){const r=await Promise.resolve("ok");console.log(r)}\nf()'}},
  {task:{az:'Promise.all() ilə üç Promise-i paralel işlədin. Nəticələr massivini çap edin.',en:'Run three Promises in parallel with Promise.all(). Log the results array.'},
   starter:'const p1=Promise.resolve("bir")\nconst p2=Promise.resolve("iki")\nconst p3=Promise.resolve("üç")\n',check:o=>o.includes('bir')||o.includes('one'),hint:{az:'Promise.all([p1,p2,p3]).then(r=>console.log(r))',en:'Promise.all([p1,p2,p3]).then(r=>console.log(r))'}},
 ]
},
  ]
};


/* ============================================================================
   COURSE: Python  (Pyodide — CPython compiled to WebAssembly — loaded on demand)
   ============================================================================ */
let pyodide = null;

function initPyodide() {
  const status = $('pyodide-status');
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
  s.onload = async () => {
    pyodide = await window.loadPyodide();
    status.textContent = '✅ Python hazırdır';
    setTimeout(() => status.style.display = 'none', 2500);
    setInfo(t('Python hazırdır. Kodu yazıb işlət!', 'Python ready. Write and run your code!'));
  };
  s.onerror = () => { status.textContent = '❌ Pyodide yüklənmədi'; };
  document.head.appendChild(s);
}

COURSES.py = {
  ...consoleCourse,
  mode: 'python',
  indent: 4,
  storage: perExerciseStorage('pb2'),
  init: initPyodide,
  async run(code) {
    if (!pyodide) return setInfo(`⏳ ${t('Python hələ hazır deyil...', 'Python not ready yet...')}`);
    $('output').innerHTML = '';
    $('feedback').textContent = '';
    const lines = [];
    pyodide.globals.set('print', (...args) => {
      const line = args.map(a => typeof a === 'boolean' ? (a ? 'True' : 'False') : String(a)).join(' ');
      lines.push(line);
      printLine(line, 'out-ok');
    });
    try { await pyodide.runPythonAsync(code); }
    catch (err) { return printLine('❌ ' + err.message, 'out-err'); }
    checkConsole(lines.join('\n'));
  },
  curriculum: [
 // ── 0. INTRO ──────────────────────────────────────────
 {id:0,section:{az:'Əsaslar',en:'Basics'},
  title:{az:'Giriş: Python nədir?',en:'Intro: What is Python?'},
  meta:{az:'Dərs 0 · 2 dəq',en:'Lesson 0 · 2 min'},
  body:{
   az:`<p>Python sadə sintaksisə malik, güclü proqramlaşdırma dilidir. Süni intellekt, veb, data analizi kimi sahələrdə geniş istifadə olunur. 1991-ci ildə Qvido van Rossum tərəfindən yaradılıb. Onun əsas fəlsəfəsi kodun oxunaqlı olması və sadəliyidir.</p>
<p>Proqramı sınaq üçün <b>print()</b> funksiyasından istifadə edirik:</p>
<pre><span class="fn">print</span>(<span class="str">"Salam, dünya!"</span>)</pre>
<p>Şərh əlavə etmək üçün <b>#</b> işarəsindən istifadə edin — Python bu sətirləri icra etmir:</p>
<pre><span class="cm"># Bu şərhdir</span>
<span class="fn">print</span>(<span class="str">"Salam!"</span>)  <span class="cm"># bu da şərhdir</span></pre>`,
   en:`<p>Python is a powerful, beginner-friendly language used in AI, web dev, and data science.</p>
<p>Use <b>print()</b> to display output:</p>
<pre><span class="fn">print</span>(<span class="str">"Hello, world!"</span>)</pre>
<p>Use <b>#</b> for comments — Python ignores these lines:</p>
<pre><span class="cm"># This is a comment</span>
<span class="fn">print</span>(<span class="str">"Hello!"</span>)  <span class="cm"># inline comment</span></pre>`
  },
  exercises:[
   {task:{az:'Ekrana "Salam, Python!" çap edin.',en:'Print "Hello, Python!" to the screen.'},
    starter:'# Kodunuzu buraya yazın\n',
    check:o=>o.includes('Salam, Python!')||o.includes('Hello, Python!'),
    hint:{az:'print("Salam, Python!")',en:'print("Hello, Python!")'}},
   {task:{az:'İki ayrı print() ilə "Python" və "Maraqlıdır!" çap edin.',en:'Use two separate print() calls to print "Python" and "Interesting!"'},
    starter:'',
    check:o=>o.split('\n').filter(l=>l.trim()).length>=2,
    hint:{az:'İki ayrı print() sətri yazın',en:'Write two separate print() lines'}},
   {task:{az:'print() içərisində toplama əməliyyatı edin: 15 + 27 nəticəsini çap edin.',en:'Do math inside print(): print the result of 15 + 27.'},
    starter:'',
    check:o=>o.includes('42'),
    hint:{az:'print(15 + 27)',en:'print(15 + 27)'}},
   {task:{az:'print() ilə adınızı, yaşınızı və şəhərinizi üç ayrı sətirdə çap edin.',en:'Print your name, age, and city on three separate lines using print().'},
    starter:'',
    check:o=>o.split('\n').filter(l=>l.trim()).length>=3,
    hint:{az:'Üç ayrı print() yazın',en:'Write three separate print() calls'}},
  ]
 },
 // ── 1. VARIABLES ──────────────────────────────────────
 {id:1,
  title:{az:'Dəyişənlər',en:'Variables'},
  meta:{az:'Dərs 1 · 5 dəq',en:'Lesson 1 · 5 min'},
  body:{
   az:`<p>Dəyişən — məlumatı saxlamaq üçün addır. Heç bir açar söz lazım deyil:</p>
<pre>ad = <span class="str">"Kənan"</span>
yas = <span class="num">22</span>
<span class="fn">print</span>(ad, yas)</pre>
<p>Bir neçə dəyişəni eyni anda mənimsətmək olar:</p>
<pre>x, y, z = <span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span></pre>
<p>Dəyişənin dəyərini sonradan dəyişmək mümkündür:</p>
<pre>bal = <span class="num">50</span>
bal = bal + <span class="num">10</span>  <span class="cm"># bal indi 60-dır</span>
bal += <span class="num">5</span>       <span class="cm"># bal indi 65-dir</span></pre>`,
   en:`<p>A variable stores data under a name. No keyword needed:</p>
<pre>name = <span class="str">"Kenan"</span>
age = <span class="num">22</span>
<span class="fn">print</span>(name, age)</pre>
<p>Assign multiple variables at once:</p>
<pre>x, y, z = <span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span></pre>
<p>You can update a variable's value later:</p>
<pre>score = <span class="num">50</span>
score = score + <span class="num">10</span>  <span class="cm"># score is now 60</span>
score += <span class="num">5</span>          <span class="cm"># score is now 65</span></pre>`
  },
  exercises:[
   {task:{az:'"ad" dəyişəni yaradın, öz adınızı mənimsədin və çap edin.',en:'Create a "name" variable, assign your name, and print it.'},
    starter:'',check:o=>o.trim().length>0,hint:{az:'ad = "Adınız"\nprint(ad)',en:'name = "YourName"\nprint(name)'}},
   {task:{az:'"en", "hündürlük" dəyişənlərini yaradın (istənilən ədəd). Sahəni (en * hündürlük) çap edin.',en:'Create "width" and "height" variables (any numbers). Print their area (width * height).'},
    starter:'',check:o=>!isNaN(o.trim().split('\n').pop()),hint:{az:'print(en * hündürlük)',en:'print(width * height)'}},
   {task:{az:'x=10, y=20 yaradın. Dəyərlərini dəyişdirin (x←y, y←x) və çap edin. Nəticə: x=20, y=10.',en:'Create x=10, y=20. Swap their values and print. Result: x=20, y=10.'},
    starter:'x = 10\ny = 20\n# dəyərləri dəyişin\n',check:o=>o.includes('20')&&o.includes('10'),hint:{az:'x, y = y, x',en:'x, y = y, x'}},
   {task:{az:'"counter" dəyişənini 0-dan başladın. 3 dəfə 5 əlavə edin (+=). Final dəyəri çap edin (15 olmalıdır).',en:'Start "counter" at 0. Add 5 three times using +=. Print final value (should be 15).'},
    starter:'counter = 0\n',check:o=>o.includes('15'),hint:{az:'counter += 5  # 3 dəfə',en:'counter += 5  # three times'}},
  ]
 },
 // ── 2. DATA TYPES ─────────────────────────────────────
 {id:2,
  title:{az:'Məlumat tipləri',en:'Data Types'},
  meta:{az:'Dərs 2 · 6 dəq',en:'Lesson 2 · 6 min'},
  body:{
   az:`<p>Python-da əsas tiplər:</p>
<pre><span class="cm"># int, float, str, bool</span>
x = <span class="num">10</span>; pi = <span class="num">3.14</span>
ad = <span class="str">"Python"</span>; aktiv = <span class="kw">True</span>
<span class="fn">print</span>(<span class="fn">type</span>(x))  <span class="cm"># &lt;class 'int'&gt;</span></pre>
<p>Tip çevirmələri:</p>
<pre>s = <span class="fn">str</span>(<span class="num">42</span>)      <span class="cm"># "42"</span>
n = <span class="fn">int</span>(<span class="str">"10"</span>)   <span class="cm"># 10</span>
f = <span class="fn">float</span>(<span class="str">"3.5"</span>) <span class="cm"># 3.5</span>
b = <span class="fn">bool</span>(<span class="num">0</span>)     <span class="cm"># False</span></pre>
<p>Riyazi əməliyyatlar: <b>+ - * / // % **</b></p>
<pre><span class="fn">print</span>(<span class="num">17</span> // <span class="num">3</span>)  <span class="cm"># 5  (tam bölmə)</span>
<span class="fn">print</span>(<span class="num">17</span> % <span class="num">3</span>)   <span class="cm"># 2  (qalıq)</span>
<span class="fn">print</span>(<span class="num">2</span> ** <span class="num">8</span>)   <span class="cm"># 256 (qüvvət)</span></pre>`,
   en:`<p>Python's main types:</p>
<pre><span class="cm"># int, float, str, bool</span>
x = <span class="num">10</span>; pi = <span class="num">3.14</span>
name = <span class="str">"Python"</span>; active = <span class="kw">True</span>
<span class="fn">print</span>(<span class="fn">type</span>(x))  <span class="cm"># &lt;class 'int'&gt;</span></pre>
<p>Type conversions:</p>
<pre>s = <span class="fn">str</span>(<span class="num">42</span>)      <span class="cm"># "42"</span>
n = <span class="fn">int</span>(<span class="str">"10"</span>)   <span class="cm"># 10</span>
f = <span class="fn">float</span>(<span class="str">"3.5"</span>) <span class="cm"># 3.5</span>
b = <span class="fn">bool</span>(<span class="num">0</span>)     <span class="cm"># False</span></pre>
<p>Math operators: <b>+ - * / // % **</b></p>
<pre><span class="fn">print</span>(<span class="num">17</span> // <span class="num">3</span>)  <span class="cm"># 5  (floor div)</span>
<span class="fn">print</span>(<span class="num">17</span> % <span class="num">3</span>)   <span class="cm"># 2  (remainder)</span>
<span class="fn">print</span>(<span class="num">2</span> ** <span class="num">8</span>)   <span class="cm"># 256 (power)</span></pre>`
  },
  exercises:[
   {task:{az:'int, float, str, bool tipli 4 dəyişən yaradın. Hər birinin tipini type() ilə çap edin.',en:'Create 4 variables: int, float, str, bool. Print each type using type().'},
    starter:'',check:o=>o.includes('int')&&o.includes('float')&&o.includes('str')&&o.includes('bool'),hint:{az:'print(type(dəyişən))',en:'print(type(variable))'}},
   {task:{az:'"25" mətnini ədədə çevirin və 7 ilə vurun. Nəticə 175 olmalıdır.',en:'Convert the string "25" to an int and multiply by 7. Result should be 175.'},
    starter:'s = "25"\n',check:o=>o.includes('175'),hint:{az:'print(int(s) * 7)',en:'print(int(s) * 7)'}},
   {task:{az:'100-ü 7-yə bölün. Tam hissəni (//) və qalığı (%) ayrı-ayrı çap edin.',en:'Divide 100 by 7. Print the integer quotient (//) and remainder (%) separately.'},
    starter:'',check:o=>o.includes('14')&&o.includes('2'),hint:{az:'print(100//7)\nprint(100%7)',en:'print(100//7)\nprint(100%7)'}},
   {task:{az:'2-nin 10-cu qüvvətini (**) hesablayın və çap edin. Cavab: 1024.',en:'Calculate 2 to the power of 10 (**) and print it. Answer: 1024.'},
    starter:'',check:o=>o.includes('1024'),hint:{az:'print(2 ** 10)',en:'print(2 ** 10)'}},
   {task:{az:'bool(0), bool(1), bool(""), bool("salam") dəyərlərini çap edin.',en:'Print the values of bool(0), bool(1), bool(""), bool("hello").'},
    starter:'',check:o=>o.includes('False')&&o.includes('True'),hint:{az:'print(bool(0), bool(1), bool(""), bool("salam"))',en:'print(bool(0), bool(1), bool(""), bool("hello"))'}},
  ]
 },
 // ── 3. STRINGS ────────────────────────────────────────
 {id:3,section:{az:'Mətn işləmə',en:'Text'},
  title:{az:'Strings (Mətnlər)',en:'Strings'},
  meta:{az:'Dərs 3 · 7 dəq',en:'Lesson 3 · 7 min'},
  body:{
   az:`<p>String — mətn tipli məlumatdır. Tək yaxud cüt dırnaqla yazılır:</p>
<pre>s = <span class="str">"Salam"</span>
<span class="fn">print</span>(<span class="fn">len</span>(s))        <span class="cm"># 5</span>
<span class="fn">print</span>(s.<span class="fn">upper</span>())    <span class="cm"># SALAM</span>
<span class="fn">print</span>(s.<span class="fn">lower</span>())    <span class="cm"># salam</span>
<span class="fn">print</span>(s.<span class="fn">replace</span>(<span class="str">"S"</span>,<span class="str">"H"</span>)) <span class="cm"># Halam</span></pre>
<p>f-string ilə format:</p>
<pre>ad = <span class="str">"Kənan"</span>; yas = <span class="num">25</span>
<span class="fn">print</span>(<span class="str">f"Ad: {ad}, Yaş: {yas}"</span>)</pre>
<p>İndekslər və kəsim (slice):</p>
<pre>s = <span class="str">"Python"</span>
<span class="fn">print</span>(s[<span class="num">0</span>])     <span class="cm"># P</span>
<span class="fn">print</span>(s[-<span class="num">1</span>])    <span class="cm"># n</span>
<span class="fn">print</span>(s[<span class="num">0</span>:<span class="num">3</span>])   <span class="cm"># Pyt</span>
<span class="fn">print</span>(s[::<span class="num">-1</span>])  <span class="cm"># nohtyP (tərsinə)</span></pre>`,
   en:`<p>A string is text data, written in single or double quotes:</p>
<pre>s = <span class="str">"Hello"</span>
<span class="fn">print</span>(<span class="fn">len</span>(s))        <span class="cm"># 5</span>
<span class="fn">print</span>(s.<span class="fn">upper</span>())    <span class="cm"># HELLO</span>
<span class="fn">print</span>(s.<span class="fn">lower</span>())    <span class="cm"># hello</span>
<span class="fn">print</span>(s.<span class="fn">replace</span>(<span class="str">"H"</span>,<span class="str">"J"</span>)) <span class="cm"># Jello</span></pre>
<p>f-string formatting:</p>
<pre>name = <span class="str">"Kenan"</span>; age = <span class="num">25</span>
<span class="fn">print</span>(<span class="str">f"Name: {name}, Age: {age}"</span>)</pre>
<p>Indexing and slicing:</p>
<pre>s = <span class="str">"Python"</span>
<span class="fn">print</span>(s[<span class="num">0</span>])     <span class="cm"># P</span>
<span class="fn">print</span>(s[-<span class="num">1</span>])    <span class="cm"># n</span>
<span class="fn">print</span>(s[<span class="num">0</span>:<span class="num">3</span>])   <span class="cm"># Pyt</span>
<span class="fn">print</span>(s[::<span class="num">-1</span>])  <span class="cm"># nohtyP (reversed)</span></pre>`
  },
  exercises:[
   {task:{az:'"azerbaycan" sözünü böyük hərflərə (.upper()) çevirin və çap edin.',en:'Convert "azerbaijan" to uppercase using .upper() and print it.'},
    starter:'s = "azerbaycan"\n',check:o=>o.includes('AZERBAYCAN'),hint:{az:'print(s.upper())',en:'print(s.upper())'}},
   {task:{az:'Ad və soyadı ayrı dəyişənlərə yazın. f-string ilə "Ad Soyad" formatında çap edin.',en:'Store first and last name in variables. Print them as "First Last" using an f-string.'},
    starter:'',check:o=>o.trim().length>0&&!o.includes('Error'),hint:{az:'print(f"{ad} {soyad}")',en:'print(f"{first} {last}")'}},
   {task:{az:'"Python Programming" mətninin uzunluğunu (len()), ilk 6 simvolunu və tərsinə çevrilmiş halını çap edin.',en:'For "Python Programming", print its length (len()), first 6 chars, and reversed version.'},
    starter:'s = "Python Programming"\n',check:o=>o.includes('18')&&o.includes('Python'),hint:{az:'len(s), s[:6], s[::-1]',en:'len(s), s[:6], s[::-1]'}},
   {task:{az:'"  salam dünya  " mətnindən baştutan boşluqları silin (.strip()) və nəticəni çap edin.',en:'Remove leading/trailing spaces from "  hello world  " using .strip() and print.'},
    starter:'s = "  salam dünya  "\n',check:o=>!o.startsWith(' ')&&o.includes('salam'),hint:{az:'print(s.strip())',en:'print(s.strip())'}},
   {task:{az:'"bakı,gəncə,sumqayıt" mətnini vergüllə (.split(",")) parçalayın. Nəticəni çap edin.',en:'Split "baku,ganja,sumgait" by comma using .split(",") and print the result.'},
    starter:'s = "bakı,gəncə,sumqayıt"\n',check:o=>o.includes('[')&&(o.includes('bakı')||o.includes('baku')),hint:{az:'print(s.split(","))',en:'print(s.split(","))'}},
  ]
 },
 // ── 4. CONDITIONS ─────────────────────────────────────
 {id:4,section:{az:'Nəzarət axını',en:'Control Flow'},
  title:{az:'Şərtlər (if/elif/else)',en:'Conditions (if/elif/else)'},
  meta:{az:'Dərs 4 · 7 dəq',en:'Lesson 4 · 7 min'},
  body:{
   az:`<pre>yas = <span class="num">18</span>
<span class="kw">if</span> yas >= <span class="num">18</span>:
    <span class="fn">print</span>(<span class="str">"Böyükdür"</span>)
<span class="kw">elif</span> yas >= <span class="num">13</span>:
    <span class="fn">print</span>(<span class="str">"Yeniyetmə"</span>)
<span class="kw">else</span>:
    <span class="fn">print</span>(<span class="str">"Uşaq"</span>)</pre>
<p>Məntiqi operatorlar: <b>and, or, not</b></p>
<pre>x = <span class="num">15</span>
<span class="kw">if</span> x > <span class="num">10</span> <span class="kw">and</span> x < <span class="num">20</span>:
    <span class="fn">print</span>(<span class="str">"10 ilə 20 arasında"</span>)</pre>
<p>Bir sətirlik şərt (ternary):</p>
<pre>nəticə = <span class="str">"Keçdi"</span> <span class="kw">if</span> bal >= <span class="num">50</span> <span class="kw">else</span> <span class="str">"Kəsildi"</span></pre>`,
   en:`<pre>age = <span class="num">18</span>
<span class="kw">if</span> age >= <span class="num">18</span>:
    <span class="fn">print</span>(<span class="str">"Adult"</span>)
<span class="kw">elif</span> age >= <span class="num">13</span>:
    <span class="fn">print</span>(<span class="str">"Teenager"</span>)
<span class="kw">else</span>:
    <span class="fn">print</span>(<span class="str">"Child"</span>)</pre>
<p>Logical operators: <b>and, or, not</b></p>
<pre>x = <span class="num">15</span>
<span class="kw">if</span> x > <span class="num">10</span> <span class="kw">and</span> x < <span class="num">20</span>:
    <span class="fn">print</span>(<span class="str">"Between 10 and 20"</span>)</pre>
<p>One-line ternary:</p>
<pre>result = <span class="str">"Pass"</span> <span class="kw">if</span> score >= <span class="num">50</span> <span class="kw">else</span> <span class="str">"Fail"</span></pre>`
  },
  exercises:[
   {task:{az:'temp=35. 30-dan böyükdürsə "İsti", 15-dən aşağıdırsa "Soyuq", əks halda "Mülayim" çap edin.',en:'temp=35. Print "Hot" if above 30, "Cold" if below 15, else "Mild".'},
    starter:'temp = 35\n',check:o=>o.includes('İsti')||o.includes('Hot'),hint:{az:'if temp>30 elif temp<15 else',en:'if temp>30 elif temp<15 else'}},
   {task:{az:'bal=85. 90+→"A", 80-89→"B", 70-79→"C", 60-69→"D", aşağı→"F" çap edin.',en:'score=85. Print "A" for 90+, "B" for 80-89, "C" for 70-79, "D" for 60-69, "F" otherwise.'},
    starter:'bal = 85\n',check:o=>o.includes('B'),hint:{az:'elif bal >= 80: print("B")',en:'elif score >= 80: print("B")'}},
   {task:{az:'x=15. x 10-dan böyük VƏ 20-dən kiçikdirsə "Aralıqda" çap edin. (and istifadə edin)',en:'x=15. Print "In range" if x is greater than 10 AND less than 20. Use "and".'},
    starter:'x = 15\n',check:o=>o.includes('Aralıqda')||o.includes('In range'),hint:{az:'if x > 10 and x < 20:',en:'if x > 10 and x < 20:'}},
   {task:{az:'ədəd=7. Ədəd cüt (%) yoxsa tək olduğunu ternary ilə bir dəyişənə yazın və çap edin.',en:'n=7. Use a ternary expression to assign "Even" or "Odd" to a variable, then print it.'},
    starter:'ədəd = 7\n',check:o=>o.includes('tək')||o.includes('Odd')||o.includes('odd'),hint:{az:'nəticə = "Cüt" if ədəd % 2 == 0 else "Tək"',en:'result = "Even" if n % 2 == 0 else "Odd"'}},
  ]
 },
 // ── 5. LOOPS ──────────────────────────────────────────
 {id:5,
  title:{az:'Dövrlər (for / while)',en:'Loops (for / while)'},
  meta:{az:'Dərs 5 · 8 dəq',en:'Lesson 5 · 8 min'},
  body:{
   az:`<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>, <span class="num">6</span>):
    <span class="fn">print</span>(i)  <span class="cm"># 1 2 3 4 5</span></pre>
<p><b>break</b> — dövrü dayandırır, <b>continue</b> — növbəti iterasiyaya keçir:</p>
<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">10</span>):
    <span class="kw">if</span> i == <span class="num">3</span>: <span class="kw">continue</span>  <span class="cm"># 3-ü atla</span>
    <span class="kw">if</span> i == <span class="num">6</span>: <span class="kw">break</span>     <span class="cm"># 6-da dur</span>
    <span class="fn">print</span>(i)</pre>
<p>while dövrü:</p>
<pre>say = <span class="num">1</span>
<span class="kw">while</span> say <= <span class="num">5</span>:
    <span class="fn">print</span>(say)
    say += <span class="num">1</span></pre>
<p>İç-içə dövrlər:</p>
<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">4</span>):
    <span class="kw">for</span> j <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">4</span>):
        <span class="fn">print</span>(i*j, end=<span class="str">" "</span>)</pre>`,
   en:`<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>, <span class="num">6</span>):
    <span class="fn">print</span>(i)  <span class="cm"># 1 2 3 4 5</span></pre>
<p><b>break</b> stops the loop, <b>continue</b> skips to the next iteration:</p>
<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">10</span>):
    <span class="kw">if</span> i == <span class="num">3</span>: <span class="kw">continue</span>  <span class="cm"># skip 3</span>
    <span class="kw">if</span> i == <span class="num">6</span>: <span class="kw">break</span>     <span class="cm"># stop at 6</span>
    <span class="fn">print</span>(i)</pre>
<p>while loop:</p>
<pre>count = <span class="num">1</span>
<span class="kw">while</span> count <= <span class="num">5</span>:
    <span class="fn">print</span>(count)
    count += <span class="num">1</span></pre>
<p>Nested loops:</p>
<pre><span class="kw">for</span> i <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">4</span>):
    <span class="kw">for</span> j <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">4</span>):
        <span class="fn">print</span>(i*j, end=<span class="str">" "</span>)</pre>`
  },
  exercises:[
   {task:{az:'for dövrü ilə 1-dən 10-a qədər (daxil) olan ədədlərin cəmini hesablayın. Cavab: 55.',en:'Use a for loop to calculate the sum of numbers 1 to 10 (inclusive). Answer: 55.'},
    starter:'total = 0\n',check:o=>o.includes('55'),hint:{az:'for i in range(1,11): total += i',en:'for i in range(1,11): total += i'}},
   {task:{az:'1-100 arasındakı cüt ədədləri çap edin. (range + if % istifadə edin)',en:'Print all even numbers from 1 to 100. (Use range + if %)'},
    starter:'',check:o=>o.includes('2')&&o.includes('100')&&o.includes('50'),hint:{az:'if i % 2 == 0: print(i)',en:'if i % 2 == 0: print(i)'}},
   {task:{az:'while dövrü ilə 2-nin qüvvətlərini (1,2,4,8,...) 1000-dən kiçik olanları çap edin.',en:'Use a while loop to print powers of 2 (1,2,4,8,...) that are less than 1000.'},
    starter:'n = 1\n',check:o=>o.includes('512')&&o.includes('1'),hint:{az:'while n < 1000: print(n); n *= 2',en:'while n < 1000: print(n); n *= 2'}},
   {task:{az:'for dövrü ilə 1-50 arasındakı 3-ə bölünən ədədləri çap edin. İlk 3: 3,6,9...',en:'Print all numbers from 1-50 divisible by 3. First few: 3,6,9...'},
    starter:'',check:o=>o.includes('3')&&o.includes('48'),hint:{az:'if i % 3 == 0',en:'if i % 3 == 0'}},
   {task:{az:'İç-içə for dövrü ilə 5x5 ulduz (*) cədvəli çap edin.',en:'Use nested for loops to print a 5x5 grid of asterisks (*).'},
    starter:'',check:o=>o.split('\n').filter(l=>l.includes('*')).length>=5,hint:{az:'for i in range(5):\n  for j in range(5):\n    print("*",end=" ")\n  print()',en:'for i in range(5):\n  for j in range(5):\n    print("*",end=" ")\n  print()'}},
  ]
 },
 // ── 6. LISTS ──────────────────────────────────────────
 {id:6,section:{az:'Məlumat strukturları',en:'Data Structures'},
  title:{az:'Siyahılar (Lists)',en:'Lists'},
  meta:{az:'Dərs 6 · 8 dəq',en:'Lesson 6 · 8 min'},
  body:{
   az:`<pre>meyvələr = [<span class="str">"alma"</span>, <span class="str">"armud"</span>, <span class="str">"gilas"</span>]
meyvələr.<span class="fn">append</span>(<span class="str">"üzüm"</span>)   <span class="cm"># əlavə et</span>
meyvələr.<span class="fn">remove</span>(<span class="str">"armud"</span>) <span class="cm"># sil</span>
<span class="fn">print</span>(meyvələr[<span class="num">0</span>])       <span class="cm"># alma</span>
<span class="fn">print</span>(<span class="fn">len</span>(meyvələr))     <span class="cm"># 3</span></pre>
<p>Faydalı metodlar:</p>
<pre>ədədlər = [<span class="num">3</span>,<span class="num">1</span>,<span class="num">4</span>,<span class="num">1</span>,<span class="num">5</span>]
ədədlər.<span class="fn">sort</span>()         <span class="cm"># [1,1,3,4,5]</span>
<span class="fn">print</span>(<span class="fn">sum</span>(ədədlər))    <span class="cm"># 14</span>
<span class="fn">print</span>(<span class="fn">max</span>(ədədlər))    <span class="cm"># 5</span>
<span class="fn">print</span>(<span class="fn">min</span>(ədədlər))    <span class="cm"># 1</span></pre>
<p>List comprehension:</p>
<pre>kvadratlar = [x**<span class="num">2</span> <span class="kw">for</span> x <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">6</span>)]
<span class="cm"># [1, 4, 9, 16, 25]</span></pre>`,
   en:`<pre>fruits = [<span class="str">"apple"</span>, <span class="str">"pear"</span>, <span class="str">"cherry"</span>]
fruits.<span class="fn">append</span>(<span class="str">"grape"</span>)   <span class="cm"># add</span>
fruits.<span class="fn">remove</span>(<span class="str">"pear"</span>)   <span class="cm"># remove</span>
<span class="fn">print</span>(fruits[<span class="num">0</span>])         <span class="cm"># apple</span>
<span class="fn">print</span>(<span class="fn">len</span>(fruits))       <span class="cm"># 3</span></pre>
<p>Useful methods:</p>
<pre>nums = [<span class="num">3</span>,<span class="num">1</span>,<span class="num">4</span>,<span class="num">1</span>,<span class="num">5</span>]
nums.<span class="fn">sort</span>()           <span class="cm"># [1,1,3,4,5]</span>
<span class="fn">print</span>(<span class="fn">sum</span>(nums))      <span class="cm"># 14</span>
<span class="fn">print</span>(<span class="fn">max</span>(nums))      <span class="cm"># 5</span>
<span class="fn">print</span>(<span class="fn">min</span>(nums))      <span class="cm"># 1</span></pre>
<p>List comprehension:</p>
<pre>squares = [x**<span class="num">2</span> <span class="kw">for</span> x <span class="kw">in</span> <span class="fn">range</span>(<span class="num">1</span>,<span class="num">6</span>)]
<span class="cm"># [1, 4, 9, 16, 25]</span></pre>`
  },
  exercises:[
   {task:{az:'[10,20,30,40,50] siyahısının cəmini, maksimumunu və uzunluğunu çap edin.',en:'Print the sum, max, and length of [10,20,30,40,50].'},
    starter:'ədədlər = [10,20,30,40,50]\n',check:o=>o.includes('150')&&o.includes('50')&&o.includes('5'),hint:{az:'sum(), max(), len()',en:'sum(), max(), len()'}},
   {task:{az:'Boş siyahı yaradın. 5 ədəd append() ilə əlavə edin. Sıralayın (.sort()). Çap edin.',en:'Create an empty list. Append 5 numbers. Sort it (.sort()). Print it.'},
    starter:'siyahi = []\n',check:o=>o.includes('[')&&o.includes(']'),hint:{az:'siyahi.append(x)  # 5 dəfə',en:'siyahi.append(x)  # 5 times'}},
   {task:{az:'List comprehension ilə 1-10 arasındakı cüt ədədlərin siyahısını yaradın.',en:'Use list comprehension to create a list of even numbers from 1 to 10.'},
    starter:'',check:o=>o.includes('[2')&&o.includes('10]'),hint:{az:'[x for x in range(1,11) if x%2==0]',en:'[x for x in range(1,11) if x%2==0]'}},
   {task:{az:'["Python","Java","C++","JavaScript"] siyahısından "Java"nı silin. Siyahını çap edin.',en:'Remove "Java" from ["Python","Java","C++","JavaScript"] and print the list.'},
    starter:'dillər = ["Python","Java","C++","JavaScript"]\n',check:o=>!o.includes('Java')&&o.includes('Python'),hint:{az:'dillər.remove("Java")',en:'langs.remove("Java")'}},
   {task:{az:'[5,3,8,1,9,2,7] siyahısını tərsinə sıralayın (ən böyükdən kiçiyə). İlk element 9 olmalıdır.',en:'Sort [5,3,8,1,9,2,7] in reverse order (largest first). First element should be 9.'},
    starter:'n = [5,3,8,1,9,2,7]\n',check:o=>o.indexOf('9')<o.indexOf('1'),hint:{az:'n.sort(reverse=True)\nprint(n)',en:'n.sort(reverse=True)\nprint(n)'}},
  ]
 },
 // ── 7. TUPLES & SETS ──────────────────────────────────
 {id:7,
  title:{az:'Tuples və Sets',en:'Tuples & Sets'},
  meta:{az:'Dərs 7 · 6 dəq',en:'Lesson 7 · 6 min'},
  body:{
   az:`<p><b>Tuple</b> — dəyişilməz siyahı (mötərizə ilə):</p>
<pre>koordinat = (<span class="num">40.4</span>, <span class="num">49.8</span>)
<span class="fn">print</span>(koordinat[<span class="num">0</span>])  <span class="cm"># 40.4</span>
<span class="cm"># koordinat[0] = 5  ← XƏTA!</span></pre>
<p><b>Set</b> — təkrarsız elementlər toplusu (fiqurlu mötərizə):</p>
<pre>rənglər = {<span class="str">"qırmızı"</span>, <span class="str">"mavi"</span>, <span class="str">"yaşıl"</span>}
rənglər.<span class="fn">add</span>(<span class="str">"sarı"</span>)
<span class="fn">print</span>(<span class="fn">len</span>(rənglər))  <span class="cm"># 4</span></pre>
<p>Set əməliyyatları:</p>
<pre>a = {<span class="num">1</span>,<span class="num">2</span>,<span class="num">3</span>,<span class="num">4</span>}; b = {<span class="num">3</span>,<span class="num">4</span>,<span class="num">5</span>,<span class="num">6</span>}
<span class="fn">print</span>(a & b)  <span class="cm"># {3,4} kəsişmə</span>
<span class="fn">print</span>(a | b)  <span class="cm"># birləşmə</span>
<span class="fn">print</span>(a - b)  <span class="cm"># fərq</span></pre>`,
   en:`<p><b>Tuple</b> — immutable list (parentheses):</p>
<pre>coord = (<span class="num">40.4</span>, <span class="num">49.8</span>)
<span class="fn">print</span>(coord[<span class="num">0</span>])  <span class="cm"># 40.4</span>
<span class="cm"># coord[0] = 5  ← ERROR!</span></pre>
<p><b>Set</b> — unordered collection of unique items:</p>
<pre>colors = {<span class="str">"red"</span>, <span class="str">"blue"</span>, <span class="str">"green"</span>}
colors.<span class="fn">add</span>(<span class="str">"yellow"</span>)
<span class="fn">print</span>(<span class="fn">len</span>(colors))  <span class="cm"># 4</span></pre>
<p>Set operations:</p>
<pre>a = {<span class="num">1</span>,<span class="num">2</span>,<span class="num">3</span>,<span class="num">4</span>}; b = {<span class="num">3</span>,<span class="num">4</span>,<span class="num">5</span>,<span class="num">6</span>}
<span class="fn">print</span>(a & b)  <span class="cm"># {3,4} intersection</span>
<span class="fn">print</span>(a | b)  <span class="cm"># union</span>
<span class="fn">print</span>(a - b)  <span class="cm"># difference</span></pre>`
  },
  exercises:[
   {task:{az:'(10, 20, 30, 40, 50) tuple-ının ikinci elementini və uzunluğunu çap edin.',en:'Print the second element and the length of tuple (10, 20, 30, 40, 50).'},
    starter:'t = (10,20,30,40,50)\n',check:o=>o.includes('20')&&o.includes('5'),hint:{az:'print(t[1])\nprint(len(t))',en:'print(t[1])\nprint(len(t))'}},
   {task:{az:'[1,2,2,3,3,3,4] siyahısını set-ə çevirin. Unikal elementləri çap edin.',en:'Convert [1,2,2,3,3,3,4] to a set and print the unique elements.'},
    starter:'lst = [1,2,2,3,3,3,4]\n',check:o=>!o.includes('2, 2')&&o.includes('1'),hint:{az:'print(set(lst))',en:'print(set(lst))'}},
   {task:{az:'a={1,2,3,4,5} və b={4,5,6,7,8}. Kəsişməni (&) və birləşməni (|) çap edin.',en:'a={1,2,3,4,5} and b={4,5,6,7,8}. Print their intersection (&) and union (|).'},
    starter:'a = {1,2,3,4,5}\nb = {4,5,6,7,8}\n',check:o=>o.includes('4')&&o.includes('5'),hint:{az:'print(a & b)\nprint(a | b)',en:'print(a & b)\nprint(a | b)'}},
   {task:{az:'Tuple-ı siyahıya, siyahını yenidən tuple-a çevirin. Hər iki formanı çap edin.',en:'Convert a tuple to a list, then back to a tuple. Print both forms.'},
    starter:'t = (1,2,3)\n',check:o=>o.includes('[')&&o.includes('('),hint:{az:'lst=list(t)\nprint(lst)\nprint(tuple(lst))',en:'lst=list(t)\nprint(lst)\nprint(tuple(lst))'}},
  ]
 },
 // ── 8. DICTS ──────────────────────────────────────────
 {id:8,
  title:{az:'Lüğətlər (Dictionaries)',en:'Dictionaries'},
  meta:{az:'Dərs 8 · 8 dəq',en:'Lesson 8 · 8 min'},
  body:{
   az:`<pre>tələbə = {
    <span class="str">"ad"</span>: <span class="str">"Kənan"</span>,
    <span class="str">"yas"</span>: <span class="num">21</span>,
    <span class="str">"bal"</span>: <span class="num">88</span>
}
<span class="fn">print</span>(tələbə[<span class="str">"ad"</span>])          <span class="cm"># Kənan</span>
<span class="fn">print</span>(tələbə.<span class="fn">get</span>(<span class="str">"yas"</span>))   <span class="cm"># 21</span>
tələbə[<span class="str">"şəhər"</span>] = <span class="str">"Bakı"</span>  <span class="cm"># yeni açar</span></pre>
<p>Açarlar, dəyərlər, elementlər:</p>
<pre><span class="fn">print</span>(tələbə.<span class="fn">keys</span>())
<span class="fn">print</span>(tələbə.<span class="fn">values</span>())
<span class="kw">for</span> k, v <span class="kw">in</span> tələbə.<span class="fn">items</span>():
    <span class="fn">print</span>(k, <span class="str">"→"</span>, v)</pre>`,
   en:`<pre>student = {
    <span class="str">"name"</span>: <span class="str">"Kenan"</span>,
    <span class="str">"age"</span>: <span class="num">21</span>,
    <span class="str">"score"</span>: <span class="num">88</span>
}
<span class="fn">print</span>(student[<span class="str">"name"</span>])         <span class="cm"># Kenan</span>
<span class="fn">print</span>(student.<span class="fn">get</span>(<span class="str">"age"</span>))    <span class="cm"># 21</span>
student[<span class="str">"city"</span>] = <span class="str">"Baku"</span>     <span class="cm"># new key</span></pre>
<p>Keys, values, items:</p>
<pre><span class="fn">print</span>(student.<span class="fn">keys</span>())
<span class="fn">print</span>(student.<span class="fn">values</span>())
<span class="kw">for</span> k, v <span class="kw">in</span> student.<span class="fn">items</span>():
    <span class="fn">print</span>(k, <span class="str">"→"</span>, v)</pre>`
  },
  exercises:[
   {task:{az:'Özünüz haqqında lüğət yaradın: ad, yas, şəhər. Hər dəyəri ayrıca çap edin.',en:'Create a dict about yourself: name, age, city. Print each value separately.'},
    starter:'',check:o=>o.split('\n').filter(l=>l.trim()).length>=3,hint:{az:'mənim = {"ad":"...","yas":...}',en:'me = {"name":"...","age":...}'}},
   {task:{az:'{"a":1,"b":2,"c":3} lüğətinin bütün açar-dəyər cütlərini for + .items() ilə çap edin.',en:'Print all key-value pairs of {"a":1,"b":2,"c":3} using for + .items().'},
    starter:'d = {"a":1,"b":2,"c":3}\n',check:o=>o.includes('a')&&o.includes('1')&&o.includes('c'),hint:{az:'for k,v in d.items(): print(k,v)',en:'for k,v in d.items(): print(k,v)'}},
   {task:{az:'Lüğətdə olmayan açara .get() ilə müraciət edin, tapılmadıqda "Yoxdur" qaytarsın.',en:'Access a missing key using .get() with "Not found" as the default value.'},
    starter:'d = {"ad":"Kənan"}\n',check:o=>o.includes('Yoxdur')||o.includes('Not found'),hint:{az:'print(d.get("şəhər","Yoxdur"))',en:'print(d.get("city","Not found"))'}},
   {task:{az:'Tələbə siyahısı lüğət kimi: [{"ad":"A","bal":80},{"ad":"B","bal":95}]. Ən yüksək ballı tələbənin adını çap edin.',en:'Students as dicts: [{"name":"A","score":80},{"name":"B","score":95}]. Print the name of the highest scorer.'},
    starter:'tələbələr = [{"ad":"A","bal":80},{"ad":"B","bal":95},{"ad":"C","bal":73}]\n',
    check:o=>o.includes('B'),hint:{az:'max(tələbələr, key=lambda x: x["bal"])["ad"]',en:'max(students, key=lambda x: x["score"])["name"]'}},
  ]
 },
 // ── 9. FUNCTIONS ──────────────────────────────────────
 {id:9,section:{az:'Funksiyalar',en:'Functions'},
  title:{az:'Funksiyalar (def)',en:'Functions (def)'},
  meta:{az:'Dərs 9 · 9 dəq',en:'Lesson 9 · 9 min'},
  body:{
   az:`<pre><span class="kw">def</span> <span class="fn">salam</span>(ad):
    <span class="fn">print</span>(<span class="str">f"Salam, {ad}!"</span>)

<span class="fn">salam</span>(<span class="str">"Kənan"</span>)</pre>
<p>return ilə dəyər qaytarmaq:</p>
<pre><span class="kw">def</span> <span class="fn">cəm</span>(a, b):
    <span class="kw">return</span> a + b

nəticə = <span class="fn">cəm</span>(<span class="num">3</span>, <span class="num">7</span>)
<span class="fn">print</span>(nəticə)  <span class="cm"># 10</span></pre>
<p>Default parametrlər:</p>
<pre><span class="kw">def</span> <span class="fn">güc</span>(x, dərəcə=<span class="num">2</span>):
    <span class="kw">return</span> x ** dərəcə

<span class="fn">print</span>(<span class="fn">güc</span>(<span class="num">4</span>))      <span class="cm"># 16</span>
<span class="fn">print</span>(<span class="fn">güc</span>(<span class="num">2</span>, <span class="num">10</span>))  <span class="cm"># 1024</span></pre>
<p>Lambda (anonim funksiya):</p>
<pre>kvadrat = <span class="kw">lambda</span> x: x**<span class="num">2</span>
<span class="fn">print</span>(<span class="fn">kvadrat</span>(<span class="num">5</span>))  <span class="cm"># 25</span></pre>`,
   en:`<pre><span class="kw">def</span> <span class="fn">greet</span>(name):
    <span class="fn">print</span>(<span class="str">f"Hello, {name}!"</span>)

<span class="fn">greet</span>(<span class="str">"Kenan"</span>)</pre>
<p>Return a value:</p>
<pre><span class="kw">def</span> <span class="fn">add</span>(a, b):
    <span class="kw">return</span> a + b

result = <span class="fn">add</span>(<span class="num">3</span>, <span class="num">7</span>)
<span class="fn">print</span>(result)  <span class="cm"># 10</span></pre>
<p>Default parameters:</p>
<pre><span class="kw">def</span> <span class="fn">power</span>(x, exp=<span class="num">2</span>):
    <span class="kw">return</span> x ** exp

<span class="fn">print</span>(<span class="fn">power</span>(<span class="num">4</span>))      <span class="cm"># 16</span>
<span class="fn">print</span>(<span class="fn">power</span>(<span class="num">2</span>, <span class="num">10</span>))  <span class="cm"># 1024</span></pre>
<p>Lambda (anonymous function):</p>
<pre>square = <span class="kw">lambda</span> x: x**<span class="num">2</span>
<span class="fn">print</span>(<span class="fn">square</span>(<span class="num">5</span>))  <span class="cm"># 25</span></pre>`
  },
  exercises:[
   {task:{az:'İki ədədin maksimumunu tapan max_iki(a,b) funksiyası yazın. max_iki(7,12) → 12.',en:'Write max_iki(a,b) that returns the larger of two numbers. max_iki(7,12) → 12.'},
    starter:'def max_iki(a, b):\n    pass\n\nprint(max_iki(7, 12))\n',check:o=>o.includes('12'),hint:{az:'return a if a > b else b',en:'return a if a > b else b'}},
   {task:{az:'Siyahının ortalamasını hesablayan ortalama(lst) funksiyası yazın. ortalama([10,20,30]) → 20.0.',en:'Write ortalama(lst) that returns the average of a list. ortalama([10,20,30]) → 20.0.'},
    starter:'def ortalama(lst):\n    pass\n\nprint(ortalama([10,20,30]))\n',check:o=>o.includes('20'),hint:{az:'return sum(lst)/len(lst)',en:'return sum(lst)/len(lst)'}},
   {task:{az:'default parametrli salam(ad, dil="az") funksiyası yazın. dil="az" → "Salam {ad}", dil="en" → "Hello {ad}".',en:'Write greet(name, lang="en") with default param. lang="en"→"Hello {name}", lang="az"→"Salam {name}".'},
    starter:'def salam(ad, dil="az"):\n    pass\n\nprint(salam("Kənan"))\nprint(salam("Kenan","en"))\n',check:o=>o.includes('Salam')&&o.includes('Hello'),hint:{az:'if dil=="az": return f"Salam {ad}"',en:'if lang=="en": return f"Hello {name}"'}},
   {task:{az:'Lambda ilə ədədlər siyahısını mütləq dəyərə görə sıralayın. [-3,1,-5,2,-1] → [1,-1,2,-3,-5].',en:'Use a lambda to sort a list by absolute value. [-3,1,-5,2,-1] → [1,-1,2,-3,-5].'},
    starter:'lst = [-3,1,-5,2,-1]\n',check:o=>o.startsWith('[1')||o.includes('1, -1'),hint:{az:'sorted(lst, key=lambda x: abs(x))',en:'sorted(lst, key=lambda x: abs(x))'}},
   {task:{az:'Rekursiv factorial(n) funksiyası yazın. factorial(5) → 120.',en:'Write a recursive factorial(n) function. factorial(5) → 120.'},
    starter:'def factorial(n):\n    pass\n\nprint(factorial(5))\n',check:o=>o.includes('120'),hint:{az:'if n<=1: return 1\nreturn n * factorial(n-1)',en:'if n<=1: return 1\nreturn n * factorial(n-1)'}},
  ]
 },
 // ── 10. MODULES ───────────────────────────────────────
 {id:10,section:{az:'Modullar',en:'Modules'},
  title:{az:'Modullar və import',en:'Modules & import'},
  meta:{az:'Dərs 10 · 7 dəq',en:'Lesson 10 · 7 min'},
  body:{
   az:`<pre><span class="kw">import</span> math
<span class="fn">print</span>(math.<span class="fn">sqrt</span>(<span class="num">144</span>))   <span class="cm"># 12.0</span>
<span class="fn">print</span>(math.pi)           <span class="cm"># 3.14159...</span>
<span class="fn">print</span>(math.<span class="fn">floor</span>(<span class="num">3.7</span>)) <span class="cm"># 3</span></pre>
<p>Seçici import:</p>
<pre><span class="kw">from</span> math <span class="kw">import</span> sqrt, pi
<span class="fn">print</span>(<span class="fn">sqrt</span>(<span class="num">81</span>))  <span class="cm"># 9.0</span></pre>
<p>random modulu:</p>
<pre><span class="kw">import</span> random
<span class="fn">print</span>(random.<span class="fn">randint</span>(<span class="num">1</span>,<span class="num">100</span>))
<span class="fn">print</span>(random.<span class="fn">choice</span>([<span class="str">"a"</span>,<span class="str">"b"</span>,<span class="str">"c"</span>]))</pre>
<p>datetime modulu:</p>
<pre><span class="kw">from</span> datetime <span class="kw">import</span> datetime
indi = datetime.<span class="fn">now</span>()
<span class="fn">print</span>(indi.<span class="fn">strftime</span>(<span class="str">"%Y-%m-%d"</span>))</pre>`,
   en:`<pre><span class="kw">import</span> math
<span class="fn">print</span>(math.<span class="fn">sqrt</span>(<span class="num">144</span>))   <span class="cm"># 12.0</span>
<span class="fn">print</span>(math.pi)           <span class="cm"># 3.14159...</span>
<span class="fn">print</span>(math.<span class="fn">floor</span>(<span class="num">3.7</span>)) <span class="cm"># 3</span></pre>
<p>Selective import:</p>
<pre><span class="kw">from</span> math <span class="kw">import</span> sqrt, pi
<span class="fn">print</span>(<span class="fn">sqrt</span>(<span class="num">81</span>))  <span class="cm"># 9.0</span></pre>
<p>random module:</p>
<pre><span class="kw">import</span> random
<span class="fn">print</span>(random.<span class="fn">randint</span>(<span class="num">1</span>,<span class="num">100</span>))
<span class="fn">print</span>(random.<span class="fn">choice</span>([<span class="str">"a"</span>,<span class="str">"b"</span>,<span class="str">"c"</span>]))</pre>
<p>datetime module:</p>
<pre><span class="kw">from</span> datetime <span class="kw">import</span> datetime
now = datetime.<span class="fn">now</span>()
<span class="fn">print</span>(now.<span class="fn">strftime</span>(<span class="str">"%Y-%m-%d"</span>))</pre>`
  },
  exercises:[
   {task:{az:'math modulunu import edin. 256-nın kvadrat kökünü və π-nin dəyərini çap edin.',en:'Import math. Print the square root of 256 and the value of π.'},
    starter:'import math\n',check:o=>o.includes('16')&&o.includes('3.14'),hint:{az:'print(math.sqrt(256))\nprint(math.pi)',en:'print(math.sqrt(256))\nprint(math.pi)'}},
   {task:{az:'random.randint() ilə 1-6 arasında zər atın. 5 dəfə nəticəni çap edin.',en:'Simulate a die roll using random.randint(1,6). Print 5 rolls.'},
    starter:'import random\n',check:o=>o.split('\n').filter(l=>l.trim()&&!isNaN(l.trim())).length>=5,hint:{az:'for _ in range(5): print(random.randint(1,6))',en:'for _ in range(5): print(random.randint(1,6))'}},
   {task:{az:'math.ceil(), math.floor(), round() funksiyalarını 3.7 ədədinə tətbiq edin. Hər nəticəni çap edin.',en:'Apply math.ceil(), math.floor(), and round() to 3.7. Print each result.'},
    starter:'import math\nx = 3.7\n',check:o=>o.includes('4')&&o.includes('3'),hint:{az:'print(math.ceil(x))\nprint(math.floor(x))\nprint(round(x))',en:'print(math.ceil(x))\nprint(math.floor(x))\nprint(round(x))'}},
   {task:{az:'datetime.now() ilə bugünün tarixini "DD/MM/YYYY" formatında çap edin.',en:'Use datetime.now() to print today\'s date in "DD/MM/YYYY" format.'},
    starter:'from datetime import datetime\n',check:o=>/\d{2}\/\d{2}\/\d{4}/.test(o),hint:{az:'print(datetime.now().strftime("%d/%m/%Y"))',en:'print(datetime.now().strftime("%d/%m/%Y"))'}},
   {task:{az:'["alma","armud","gilas","üzüm","ərik"] siyahısından random.choice() ilə 3 fərqli element seçin.',en:'Use random.choice() to pick 3 elements from ["apple","pear","cherry","grape","apricot"].'},
    starter:'import random\nmeyvələr = ["alma","armud","gilas","üzüm","ərik"]\n',check:o=>o.split('\n').filter(l=>l.trim()).length>=3,hint:{az:'for _ in range(3): print(random.choice(meyvələr))',en:'for _ in range(3): print(random.choice(fruits))'}},
  ]
 },
 // ── 11. FILE I/O ──────────────────────────────────────
 {id:11,section:{az:'Fayl işləmə',en:'File I/O'},
  title:{az:'Fayl Oxuma/Yazma',en:'File Reading & Writing'},
  meta:{az:'Dərs 11 · 8 dəq',en:'Lesson 11 · 8 min'},
  body:{
   az:`<p>Python-da fayl işləmə <b>open()</b> funksiyası ilə həyata keçirilir:</p>
<pre><span class="cm"># Yazma (write)</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>, <span class="str">"w"</span>) <span class="kw">as</span> f:
    f.<span class="fn">write</span>(<span class="str">"Salam, fayl!\n"</span>)
    f.<span class="fn">write</span>(<span class="str">"İkinci sətir\n"</span>)</pre>
<pre><span class="cm"># Oxuma (read)</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>, <span class="str">"r"</span>) <span class="kw">as</span> f:
    məzmun = f.<span class="fn">read</span>()
    <span class="fn">print</span>(məzmun)</pre>
<p>Rejimlər: <b>"r"</b> oxu, <b>"w"</b> yaz (üzərinə yaz), <b>"a"</b> əlavə et, <b>"r+"</b> oxu+yaz</p>
<pre><span class="cm"># Sətir-sətir oxuma</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>) <span class="kw">as</span> f:
    <span class="kw">for</span> sətir <span class="kw">in</span> f:
        <span class="fn">print</span>(sətir.<span class="fn">strip</span>())</pre>`,
   en:`<p>File handling in Python uses the <b>open()</b> function:</p>
<pre><span class="cm"># Writing</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>, <span class="str">"w"</span>) <span class="kw">as</span> f:
    f.<span class="fn">write</span>(<span class="str">"Hello, file!\n"</span>)
    f.<span class="fn">write</span>(<span class="str">"Second line\n"</span>)</pre>
<pre><span class="cm"># Reading</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>, <span class="str">"r"</span>) <span class="kw">as</span> f:
    content = f.<span class="fn">read</span>()
    <span class="fn">print</span>(content)</pre>
<p>Modes: <b>"r"</b> read, <b>"w"</b> write (overwrite), <b>"a"</b> append, <b>"r+"</b> read+write</p>
<pre><span class="cm"># Read line by line</span>
<span class="kw">with</span> <span class="fn">open</span>(<span class="str">"test.txt"</span>) <span class="kw">as</span> f:
    <span class="kw">for</span> line <span class="kw">in</span> f:
        <span class="fn">print</span>(line.<span class="fn">strip</span>())</pre>`
  },
  exercises:[
   {task:{az:'"salam.txt" faylına "Salam, Python!" yazın, sonra oxuyun və çap edin.',en:'Write "Hello, Python!" to "hello.txt", then read and print it.'},
    starter:'',check:o=>o.includes('Salam, Python!')||o.includes('Hello, Python!'),hint:{az:'with open("salam.txt","w") as f: f.write("Salam, Python!")\nwith open("salam.txt") as f: print(f.read())',en:'with open("hello.txt","w") as f: f.write("Hello, Python!")\nwith open("hello.txt") as f: print(f.read())'}},
   {task:{az:'"ədədlər.txt" faylına 1-10 ədədlərini hər biri ayrı sətirdə yazın. Sonra oxuyun.',en:'Write numbers 1-10 (each on a new line) to "numbers.txt". Then read and print it.'},
    starter:'',check:o=>o.includes('1')&&o.includes('10'),hint:{az:'with open("ədədlər.txt","w") as f:\n  for i in range(1,11):\n    f.write(str(i)+"\\n")',en:'with open("numbers.txt","w") as f:\n  for i in range(1,11):\n    f.write(str(i)+"\\n")'}},
   {task:{az:'"log.txt" faylına "a" rejimi ilə 3 dəfə "Yeni qeyd\n" əlavə edin. Faylı oxuyun.',en:'Append "New entry\n" to "log.txt" three times using "a" mode. Then read the file.'},
    starter:'',check:o=>(o.match(/Yeni qeyd|New entry/g)||[]).length>=3,hint:{az:'for _ in range(3):\n  with open("log.txt","a") as f:\n    f.write("Yeni qeyd\\n")',en:'for _ in range(3):\n  with open("log.txt","a") as f:\n    f.write("New entry\\n")'}},
   {task:{az:'"data.txt" faylına bir neçə sətir yazın. Sonra hər sətri oxuyun və sətir nömrəsi ilə çap edin.',en:'Write several lines to "data.txt". Read them back and print each with its line number.'},
    starter:'lines = ["Python","Java","C++","JavaScript","Go"]\n',check:o=>o.includes('1')&&o.includes('Python'),hint:{az:'with open("data.txt","w") as f:\n  for l in lines: f.write(l+"\\n")\nwith open("data.txt") as f:\n  for i,l in enumerate(f,1): print(i,l.strip())',en:'with open("data.txt","w") as f:\n  for l in lines: f.write(l+"\\n")\nwith open("data.txt") as f:\n  for i,l in enumerate(f,1): print(i,l.strip())'}},
  ]
 },
  ]
};


/* ============================================================================
   COURSE: HTML & CSS  (renders into an iframe, checks the resulting DOM)
   ============================================================================ */
COURSES.web = {
  mode: 'htmlmixed',
  taskIsHTML: true,   // task text uses entities like &lt;h1&gt;
  indent: 2,
  storage: jsonStorage('webbolt_saves'),
  // After the last lesson, point learners at JSBolt.
  onLesson(i) {
    const last = i === curriculum.length - 1;
    $('cta').style.display = last ? 'block' : 'none';
    if (!last) return;
    $('cta-label').textContent = t('Sonrakı addım', 'Up next');
    $('cta-desc').textContent  = t('HTML və CSS-i bitirdin! İndi JavaScript öyrən.', 'You finished HTML & CSS! Now learn JavaScript.');
    $('cta-btn').textContent   = t('JSBolt-a keç →', 'Go to JSBolt →');
  },
  onExerciseLoad: runCode,   // show the starter code's result straight away
  onReset() { $('preview').srcdoc = ''; },
  run(code) {
    const frame = $('preview');
    $('feedback').textContent = '';
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      doc.open(); doc.write(code); doc.close();
    } catch { frame.srcdoc = code; }

    const ex = currentExercise(), lesson = curLesson, exercise = curExercise;
    setTimeout(() => {                       // let the iframe finish rendering
      if (lesson !== curLesson || exercise !== curExercise) return;   // user already moved on
      try { if (ex.check(frame.contentDocument || frame.contentWindow.document)) exercisePassed(); } catch {}
    }, 80);
  },
  curriculum: [

// ═══ HTML SECTION ══════════════════════════════════════

{id:0, section:{az:'HTML Əsasları',en:'HTML Basics'},
 title:{az:'HTML nədir?',en:'What is HTML?'},
 meta:{az:'Dərs 0 · 3 dəq',en:'Lesson 0 · 3 min'},
 body:{
  az:`<p>HTML (HyperText Markup Language) — veb səhifələrin skeletidir. Teqlər vasitəsilə məzmunu strukturlaşdırır.</p>
<pre><span class="tag">&lt;!DOCTYPE html&gt;</span>
<span class="tag">&lt;html&gt;</span>
  <span class="tag">&lt;head&gt;</span>
    <span class="tag">&lt;title&gt;</span>Səhifəm<span class="tag">&lt;/title&gt;</span>
  <span class="tag">&lt;/head&gt;</span>
  <span class="tag">&lt;body&gt;</span>
    <span class="tag">&lt;h1&gt;</span>Salam, dünya!<span class="tag">&lt;/h1&gt;</span>
  <span class="tag">&lt;/body&gt;</span>
<span class="tag">&lt;/html&gt;</span></pre>
<p>Hər teqin açılış <b>&lt;teq&gt;</b> və bağlanış <b>&lt;/teq&gt;</b> forması var. <b>&lt;!DOCTYPE html&gt;</b> brauzerə HTML5 istifadə etdiyimizi bildirir.</p>`,
  en:`<p>HTML (HyperText Markup Language) is the skeleton of web pages. It structures content using tags.</p>
<pre><span class="tag">&lt;!DOCTYPE html&gt;</span>
<span class="tag">&lt;html&gt;</span>
  <span class="tag">&lt;head&gt;</span>
    <span class="tag">&lt;title&gt;</span>My Page<span class="tag">&lt;/title&gt;</span>
  <span class="tag">&lt;/head&gt;</span>
  <span class="tag">&lt;body&gt;</span>
    <span class="tag">&lt;h1&gt;</span>Hello, world!<span class="tag">&lt;/h1&gt;</span>
  <span class="tag">&lt;/body&gt;</span>
<span class="tag">&lt;/html&gt;</span></pre>
<p>Every tag has an opening <b>&lt;tag&gt;</b> and closing <b>&lt;/tag&gt;</b> form. <b>&lt;!DOCTYPE html&gt;</b> tells the browser we're using HTML5.</p>`
 },
 exercises:[
  {task:{az:'&lt;h1&gt; teqi içinə "Salam, HTML!" yazın.',en:'Write "Hello, HTML!" inside an &lt;h1&gt; tag.'},
   starter:'<h1></h1>\n',
   check:d=>d.querySelector('h1')&&d.querySelector('h1').textContent.trim().length>0,
   hint:{az:'<h1>Salam, HTML!</h1>',en:'<h1>Hello, HTML!</h1>'}},
  {task:{az:'Tam HTML səhifəsi qurun: &lt;!DOCTYPE&gt;, &lt;html&gt;, &lt;head&gt;, &lt;title&gt;, &lt;body&gt; teqləri olsun.',en:'Build a complete HTML page with &lt;!DOCTYPE&gt;, &lt;html&gt;, &lt;head&gt;, &lt;title&gt;, and &lt;body&gt; tags.'},
   starter:'',
   check:d=>!!d.querySelector('title')&&!!d.querySelector('body'),
   hint:{az:'<!DOCTYPE html>\n<html>\n<head><title>Mənim Səhifəm</title></head>\n<body></body>\n</html>',en:'<!DOCTYPE html>\n<html>\n<head><title>My Page</title></head>\n<body></body>\n</html>'}},
  {task:{az:'&lt;body&gt; içinə bir &lt;h1&gt; və bir &lt;p&gt; teqi əlavə edin.',en:'Add one &lt;h1&gt; and one &lt;p&gt; tag inside &lt;body&gt;.'},
   starter:'<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body>\n\n</body>\n</html>',
   check:d=>!!d.querySelector('h1')&&!!d.querySelector('p'),
   hint:{az:'<h1>Başlıq</h1>\n<p>Paraqraf mətni</p>',en:'<h1>Title</h1>\n<p>Paragraph text</p>'}},
 ]
},

{id:1,
 title:{az:'Başlıqlar və Paraqraflar',en:'Headings & Paragraphs'},
 meta:{az:'Dərs 1 · 4 dəq',en:'Lesson 1 · 4 min'},
 body:{
  az:`<p>HTML-də 6 səviyyəli başlıq var: <b>&lt;h1&gt;</b>-dən <b>&lt;h6&gt;</b>-ya qədər. &lt;h1&gt; ən böyük, &lt;h6&gt; ən kiçikdir.</p>
<pre><span class="tag">&lt;h1&gt;</span>Əsas başlıq<span class="tag">&lt;/h1&gt;</span>
<span class="tag">&lt;h2&gt;</span>Alt başlıq<span class="tag">&lt;/h2&gt;</span>
<span class="tag">&lt;h3&gt;</span>Daha kiçik<span class="tag">&lt;/h3&gt;</span></pre>
<p>Paraqraf üçün <b>&lt;p&gt;</b>, sətir sonu üçün <b>&lt;br&gt;</b>, üfüqi xətt üçün <b>&lt;hr&gt;</b> istifadə edilir.</p>
<pre><span class="tag">&lt;p&gt;</span>Bu bir paraqrafdır.<span class="tag">&lt;/p&gt;</span>
<span class="tag">&lt;br&gt;</span>
<span class="tag">&lt;hr&gt;</span></pre>
<p>Mətnin içindəki formatlama: <b>&lt;strong&gt;</b> (qalın), <b>&lt;em&gt;</b> (kursiv), <b>&lt;mark&gt;</b> (vurğu).</p>`,
  en:`<p>HTML has 6 heading levels from <b>&lt;h1&gt;</b> to <b>&lt;h6&gt;</b>. &lt;h1&gt; is largest, &lt;h6&gt; smallest.</p>
<pre><span class="tag">&lt;h1&gt;</span>Main heading<span class="tag">&lt;/h1&gt;</span>
<span class="tag">&lt;h2&gt;</span>Subheading<span class="tag">&lt;/h2&gt;</span>
<span class="tag">&lt;h3&gt;</span>Smaller<span class="tag">&lt;/h3&gt;</span></pre>
<p>For paragraphs use <b>&lt;p&gt;</b>, line break use <b>&lt;br&gt;</b>, horizontal rule use <b>&lt;hr&gt;</b>.</p>
<pre><span class="tag">&lt;p&gt;</span>This is a paragraph.<span class="tag">&lt;/p&gt;</span>
<span class="tag">&lt;br&gt;</span>
<span class="tag">&lt;hr&gt;</span></pre>
<p>Inline formatting: <b>&lt;strong&gt;</b> (bold), <b>&lt;em&gt;</b> (italic), <b>&lt;mark&gt;</b> (highlight).</p>`
 },
 exercises:[
  {task:{az:'h1-dən h3-ə qədər üç ayrı başlıq yazın.',en:'Write three separate headings from h1 to h3.'},
   starter:'',
   check:d=>!!d.querySelector('h1')&&!!d.querySelector('h2')&&!!d.querySelector('h3'),
   hint:{az:'<h1>Birinci</h1>\n<h2>İkinci</h2>\n<h3>Üçüncü</h3>',en:'<h1>First</h1>\n<h2>Second</h2>\n<h3>Third</h3>'}},
  {task:{az:'Bir &lt;h2&gt; başlığı və iki &lt;p&gt; paraqrafı yaradın.',en:'Create one &lt;h2&gt; heading and two &lt;p&gt; paragraphs.'},
   starter:'',
   check:d=>!!d.querySelector('h2')&&d.querySelectorAll('p').length>=2,
   hint:{az:'<h2>Başlıq</h2>\n<p>Birinci paraqraf</p>\n<p>İkinci paraqraf</p>',en:'<h2>Title</h2>\n<p>First paragraph</p>\n<p>Second paragraph</p>'}},
  {task:{az:'Bir paraqraf içinə &lt;strong&gt; ilə qalın və &lt;em&gt; ilə kursiv mətn əlavə edin.',en:'Inside a paragraph add &lt;strong&gt; bold text and &lt;em&gt; italic text.'},
   starter:'<p></p>\n',
   check:d=>!!d.querySelector('strong')&&!!d.querySelector('em'),
   hint:{az:'<p><strong>Qalın</strong> və <em>kursiv</em> mətn</p>',en:'<p><strong>Bold</strong> and <em>italic</em> text</p>'}},
  {task:{az:'İki paraqraf arasına &lt;hr&gt; teqi ilə üfüqi xətt çəkin.',en:'Add a &lt;hr&gt; horizontal line between two paragraphs.'},
   starter:'',
   check:d=>!!d.querySelector('hr')&&d.querySelectorAll('p').length>=2,
   hint:{az:'<p>Birinci</p>\n<hr>\n<p>İkinci</p>',en:'<p>First</p>\n<hr>\n<p>Second</p>'}},
 ]
},

{id:2,
 title:{az:'Keçidlər və Şəkillər',en:'Links & Images'},
 meta:{az:'Dərs 2 · 4 dəq',en:'Lesson 2 · 4 min'},
 body:{
  az:`<p>Keçid (link) üçün <b>&lt;a&gt;</b> teqi, hədəf ünvan üçün <b>href</b> atributu istifadə olunur.</p>
<pre><span class="tag">&lt;a</span> <span class="atr">href</span>=<span class="val">"https://google.com"</span><span class="tag">&gt;</span>Google<span class="tag">&lt;/a&gt;</span>
<span class="tag">&lt;a</span> <span class="atr">href</span>=<span class="val">"#"</span> <span class="atr">target</span>=<span class="val">"_blank"</span><span class="tag">&gt;</span>Yeni tabda aç<span class="tag">&lt;/a&gt;</span></pre>
<p>Şəkil üçün <b>&lt;img&gt;</b> teqi istifadə olunur. Bağlanış teqi yoxdur!</p>
<pre><span class="tag">&lt;img</span> <span class="atr">src</span>=<span class="val">"şəkil.jpg"</span> <span class="atr">alt</span>=<span class="val">"Təsvir"</span> <span class="atr">width</span>=<span class="val">"200"</span><span class="tag">&gt;</span></pre>
<p><b>alt</b> — şəkil yüklənmədikdə göstərilən mətn. SEO üçün vacibdir.</p>`,
  en:`<p>Use the <b>&lt;a&gt;</b> tag for links, with the <b>href</b> attribute for the destination.</p>
<pre><span class="tag">&lt;a</span> <span class="atr">href</span>=<span class="val">"https://google.com"</span><span class="tag">&gt;</span>Google<span class="tag">&lt;/a&gt;</span>
<span class="tag">&lt;a</span> <span class="atr">href</span>=<span class="val">"#"</span> <span class="atr">target</span>=<span class="val">"_blank"</span><span class="tag">&gt;</span>Open in new tab<span class="tag">&lt;/a&gt;</span></pre>
<p>Use the <b>&lt;img&gt;</b> tag for images. It has no closing tag!</p>
<pre><span class="tag">&lt;img</span> <span class="atr">src</span>=<span class="val">"photo.jpg"</span> <span class="atr">alt</span>=<span class="val">"Description"</span> <span class="atr">width</span>=<span class="val">"200"</span><span class="tag">&gt;</span></pre>
<p><b>alt</b> — shown when image fails to load. Important for SEO and accessibility.</p>`
 },
 exercises:[
  {task:{az:'href atributu olan bir &lt;a&gt; keçidi yaradın.',en:'Create an &lt;a&gt; link with an href attribute.'},
   starter:'',
   check:d=>{ const a=d.querySelector('a'); return a&&a.hasAttribute('href'); },
   hint:{az:'<a href="https://example.com">Keçid</a>',en:'<a href="https://example.com">Link</a>'}},
  {task:{az:'&lt;img&gt; teqi əlavə edin. src və alt atributları olsun.',en:'Add an &lt;img&gt; tag with both src and alt attributes.'},
   starter:'',
   check:d=>{ const i=d.querySelector('img'); return i&&i.hasAttribute('src')&&i.hasAttribute('alt'); },
   hint:{az:'<img src="https://picsum.photos/100" alt="Şəkil">',en:'<img src="https://picsum.photos/100" alt="Photo">'}},
  {task:{az:'Bir keçid və bir şəkili bir &lt;p&gt; içinə yerləşdirin.',en:'Put a link and an image together inside one &lt;p&gt;.'},
   starter:'<p>\n\n</p>',
   check:d=>{ const p=d.querySelector('p'); return p&&!!p.querySelector('a')&&!!p.querySelector('img'); },
   hint:{az:'<p><a href="#">Keçid</a> <img src="https://picsum.photos/50" alt="img"></p>',en:'<p><a href="#">Link</a> <img src="https://picsum.photos/50" alt="img"></p>'}},
 ]
},

{id:3,
 title:{az:'Siyahılar',en:'Lists'},
 meta:{az:'Dərs 3 · 3 dəq',en:'Lesson 3 · 3 min'},
 body:{
  az:`<p>HTML-də iki növ siyahı var:</p>
<pre><span class="cm">&lt;!-- Sırasız siyahı (bullet) --&gt;</span>
<span class="tag">&lt;ul&gt;</span>
  <span class="tag">&lt;li&gt;</span>Alma<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>Armud<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ul&gt;</span>

<span class="cm">&lt;!-- Sıralı siyahı (numbered) --&gt;</span>
<span class="tag">&lt;ol&gt;</span>
  <span class="tag">&lt;li&gt;</span>Birinci<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>İkinci<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ol&gt;</span></pre>
<p>Hər element <b>&lt;li&gt;</b> teqi ilə göstərilir. Siyahılar iç-içə ola bilər.</p>`,
  en:`<p>HTML has two types of lists:</p>
<pre><span class="cm">&lt;!-- Unordered list (bullets) --&gt;</span>
<span class="tag">&lt;ul&gt;</span>
  <span class="tag">&lt;li&gt;</span>Apple<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>Pear<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ul&gt;</span>

<span class="cm">&lt;!-- Ordered list (numbers) --&gt;</span>
<span class="tag">&lt;ol&gt;</span>
  <span class="tag">&lt;li&gt;</span>First<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>Second<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ol&gt;</span></pre>
<p>Each item uses an <b>&lt;li&gt;</b> tag. Lists can be nested.</p>`
 },
 exercises:[
  {task:{az:'Ən azı 3 elementli bir &lt;ul&gt; siyahısı yaradın.',en:'Create a &lt;ul&gt; list with at least 3 items.'},
   starter:'',
   check:d=>d.querySelectorAll('ul li').length>=3,
   hint:{az:'<ul>\n  <li>Alma</li>\n  <li>Armud</li>\n  <li>Gilas</li>\n</ul>',en:'<ul>\n  <li>Apple</li>\n  <li>Pear</li>\n  <li>Cherry</li>\n</ul>'}},
  {task:{az:'Ən azı 3 elementli bir &lt;ol&gt; siyahısı yaradın.',en:'Create an &lt;ol&gt; list with at least 3 items.'},
   starter:'',
   check:d=>d.querySelectorAll('ol li').length>=3,
   hint:{az:'<ol>\n  <li>Birinci</li>\n  <li>İkinci</li>\n  <li>Üçüncü</li>\n</ol>',en:'<ol>\n  <li>First</li>\n  <li>Second</li>\n  <li>Third</li>\n</ol>'}},
  {task:{az:'Bir &lt;ul&gt; içinə iç-içə &lt;ul&gt; (nested list) əlavə edin.',en:'Add a nested &lt;ul&gt; inside another &lt;ul&gt;.'},
   starter:'<ul>\n  <li>Ana element\n    \n  </li>\n</ul>',
   check:d=>{ const uls=d.querySelectorAll('ul'); return uls.length>=2; },
   hint:{az:'<ul>\n  <li>Ana\n    <ul>\n      <li>Alt 1</li>\n      <li>Alt 2</li>\n    </ul>\n  </li>\n</ul>',en:'<ul>\n  <li>Parent\n    <ul>\n      <li>Child 1</li>\n      <li>Child 2</li>\n    </ul>\n  </li>\n</ul>'}},
 ]
},

{id:4,
 title:{az:'div, span və Atributlar',en:'div, span & Attributes'},
 meta:{az:'Dərs 4 · 4 dəq',en:'Lesson 4 · 4 min'},
 body:{
  az:`<p><b>&lt;div&gt;</b> — blok konteyner (tam sətir tutur). <b>&lt;span&gt;</b> — sətiriçi konteyner (yalnız məzmun qədər yer tutur).</p>
<pre><span class="tag">&lt;div</span> <span class="atr">class</span>=<span class="val">"kart"</span> <span class="atr">id</span>=<span class="val">"ana"</span><span class="tag">&gt;</span>
  <span class="tag">&lt;p&gt;</span>Bu bir <span class="tag">&lt;span</span> <span class="atr">class</span>=<span class="val">"vurğu"</span><span class="tag">&gt;</span>vacib<span class="tag">&lt;/span&gt;</span> sözdür.<span class="tag">&lt;/p&gt;</span>
<span class="tag">&lt;/div&gt;</span></pre>
<p>Əsas atributlar:</p>
<pre><span class="atr">id</span>=<span class="val">"tekUnikal"</span>     <span class="cm">→ bir elementdə</span>
<span class="atr">class</span>=<span class="val">"sinif1 sinif2"</span> <span class="cm">→ çox elementdə</span>
<span class="atr">style</span>=<span class="val">"color:red"</span>  <span class="cm">→ birbaşa CSS</span></pre>`,
  en:`<p><b>&lt;div&gt;</b> — block container (takes full line). <b>&lt;span&gt;</b> — inline container (only as wide as its content).</p>
<pre><span class="tag">&lt;div</span> <span class="atr">class</span>=<span class="val">"card"</span> <span class="atr">id</span>=<span class="val">"main"</span><span class="tag">&gt;</span>
  <span class="tag">&lt;p&gt;</span>This is an <span class="tag">&lt;span</span> <span class="atr">class</span>=<span class="val">"highlight"</span><span class="tag">&gt;</span>important<span class="tag">&lt;/span&gt;</span> word.<span class="tag">&lt;/p&gt;</span>
<span class="tag">&lt;/div&gt;</span></pre>
<p>Key attributes:</p>
<pre><span class="atr">id</span>=<span class="val">"uniqueId"</span>       <span class="cm">→ one element only</span>
<span class="atr">class</span>=<span class="val">"cls1 cls2"</span>  <span class="cm">→ many elements</span>
<span class="atr">style</span>=<span class="val">"color:red"</span>  <span class="cm">→ inline CSS</span></pre>`
 },
 exercises:[
  {task:{az:'class atributu olan bir &lt;div&gt; yaradın.',en:'Create a &lt;div&gt; with a class attribute.'},
   starter:'',
   check:d=>{ const el=d.querySelector('div'); return el&&el.hasAttribute('class'); },
   hint:{az:'<div class="kart">Məzmun</div>',en:'<div class="card">Content</div>'}},
  {task:{az:'id atributu olan bir &lt;div&gt; içinə bir &lt;span&gt; yerləşdirin.',en:'Put a &lt;span&gt; inside a &lt;div&gt; that has an id attribute.'},
   starter:'',
   check:d=>{ const div=d.querySelector('div[id]'); return div&&!!div.querySelector('span'); },
   hint:{az:'<div id="ana"><span>Sözüm</span></div>',en:'<div id="main"><span>Word</span></div>'}},
  {task:{az:'style atributu ilə bir &lt;p&gt; mətninin rəngini qırmızı edin.',en:'Use the style attribute to make a &lt;p&gt; text color red.'},
   starter:'<p style=""></p>',
   check:d=>{ const p=d.querySelector('p'); return p&&(p.style.color==='red'||p.getAttribute('style').includes('red')); },
   hint:{az:'<p style="color:red">Qırmızı mətn</p>',en:'<p style="color:red">Red text</p>'}},
 ]
},

// ═══ CSS SECTION ══════════════════════════════════════

{id:5, section:{az:'CSS Əsasları',en:'CSS Basics'},
 title:{az:'CSS nədir?',en:'What is CSS?'},
 meta:{az:'Dərs 5 · 4 dəq',en:'Lesson 5 · 4 min'},
 body:{
  az:`<p>CSS (Cascading Style Sheets) — HTML elementlərinin görünüşünü idarə edir. &lt;style&gt; teqi içinə yazılır.</p>
<pre><span class="tag">&lt;style&gt;</span>
  <span class="sel">h1</span> {
    <span class="prop">color</span>: <span class="pval">blue</span>;
    <span class="prop">font-size</span>: <span class="pval">32px</span>;
  }
  <span class="sel">p</span> {
    <span class="prop">color</span>: <span class="pval">gray</span>;
  }
<span class="tag">&lt;/style&gt;</span></pre>
<p>Seçici (selector) hədəf elementi seçir. Xassə (property) nəyi dəyişdirəcəyini, dəyər (value) isə necə dəyişdirəcəyini bildirir.</p>
<pre><span class="sel">seçici</span> { <span class="prop">xassə</span>: <span class="pval">dəyər</span>; }</pre>`,
  en:`<p>CSS (Cascading Style Sheets) controls how HTML elements look. Write it inside a &lt;style&gt; tag.</p>
<pre><span class="tag">&lt;style&gt;</span>
  <span class="sel">h1</span> {
    <span class="prop">color</span>: <span class="pval">blue</span>;
    <span class="prop">font-size</span>: <span class="pval">32px</span>;
  }
  <span class="sel">p</span> {
    <span class="prop">color</span>: <span class="pval">gray</span>;
  }
<span class="tag">&lt;/style&gt;</span></pre>
<p>The selector targets an element. The property says what to change, and the value says how to change it.</p>
<pre><span class="sel">selector</span> { <span class="prop">property</span>: <span class="pval">value</span>; }</pre>`
 },
 exercises:[
  {task:{az:'&lt;style&gt; teqi içinə h1 seçicisi üçün CSS yazın. Rəngini istənilən rəngə çevirin.',en:'Write CSS inside a &lt;style&gt; tag for the h1 selector. Set any color.'},
   starter:'<style>\n\n</style>\n<h1>Salam</h1>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('h1')&&s.textContent.includes('color'); },
   hint:{az:'<style>\nh1 { color: red; }\n</style>',en:'<style>\nh1 { color: red; }\n</style>'}},
  {task:{az:'p seçicisinə font-size: 20px verin.',en:'Give the p selector font-size: 20px.'},
   starter:'<style>\n\n</style>\n<p>Mətn</p>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('p')&&s.textContent.includes('font-size'); },
   hint:{az:'<style>\np { font-size: 20px; }\n</style>',en:'<style>\np { font-size: 20px; }\n</style>'}},
  {task:{az:'.vurgu class seçicisinə background-color: yellow verin. Sonra &lt;span class="vurgu"&gt; əlavə edin.',en:'Give .highlight class selector background-color: yellow. Then add &lt;span class="highlight"&gt;.'},
   starter:'<style>\n\n</style>\n<p>Bu <span>vacib</span> sözdür.</p>',
   check:d=>{ const s=d.querySelector('style'); return s&&(s.textContent.includes('.vurgu')||s.textContent.includes('.highlight'))&&s.textContent.includes('background'); },
   hint:{az:'<style>\n.vurgu { background-color: yellow; }\n</style>\n<p>Bu <span class="vurgu">vacib</span> sözdür.</p>',en:'<style>\n.highlight { background-color: yellow; }\n</style>\n<p>This is <span class="highlight">important</span>.</p>'}},
 ]
},

{id:6,
 title:{az:'Rənglər və Arxa Plan',en:'Colors & Backgrounds'},
 meta:{az:'Dərs 6 · 4 dəq',en:'Lesson 6 · 4 min'},
 body:{
  az:`<p>CSS-də rəngi müxtəlif üsullarla vermək olar:</p>
<pre><span class="prop">color</span>: <span class="pval">red</span>;               <span class="cm">/* ad ilə */</span>
<span class="prop">color</span>: <span class="pval">#ff5733</span>;           <span class="cm">/* hex kod */</span>
<span class="prop">color</span>: <span class="pval">rgb(255, 87, 51)</span>;   <span class="cm">/* RGB */</span>
<span class="prop">color</span>: <span class="pval">rgba(255, 87, 51, 0.5)</span>; <span class="cm">/* şəffaflıq */</span></pre>
<p>Arxa plan xassələri:</p>
<pre><span class="prop">background-color</span>: <span class="pval">#f0f0f0</span>;
<span class="prop">background-image</span>: <span class="pval">url("şəkil.jpg")</span>;
<span class="prop">background-size</span>: <span class="pval">cover</span>;
<span class="prop">background</span>: <span class="pval">linear-gradient(135deg, #667eea, #764ba2)</span>;</pre>`,
  en:`<p>CSS colors can be written in several ways:</p>
<pre><span class="prop">color</span>: <span class="pval">red</span>;               <span class="cm">/* name */</span>
<span class="prop">color</span>: <span class="pval">#ff5733</span>;           <span class="cm">/* hex code */</span>
<span class="prop">color</span>: <span class="pval">rgb(255, 87, 51)</span>;   <span class="cm">/* RGB */</span>
<span class="prop">color</span>: <span class="pval">rgba(255, 87, 51, 0.5)</span>; <span class="cm">/* with alpha */</span></pre>
<p>Background properties:</p>
<pre><span class="prop">background-color</span>: <span class="pval">#f0f0f0</span>;
<span class="prop">background-image</span>: <span class="pval">url("photo.jpg")</span>;
<span class="prop">background-size</span>: <span class="pval">cover</span>;
<span class="prop">background</span>: <span class="pval">linear-gradient(135deg, #667eea, #764ba2)</span>;</pre>`
 },
 exercises:[
  {task:{az:'body seçicisinə background-color verin (istənilən rəng).',en:'Give the body selector a background-color (any color).'},
   starter:'<style>\n\n</style>\n<h1>WebBolt</h1>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('body')&&s.textContent.includes('background'); },
   hint:{az:'<style>\nbody { background-color: #1a1a2e; color: white; }\n</style>',en:'<style>\nbody { background-color: #1a1a2e; color: white; }\n</style>'}},
  {task:{az:'Bir &lt;div&gt;-ə hex rəng kodu (#xxxxxx) ilə background-color verin.',en:'Give a &lt;div&gt; a background-color using a hex color code (#xxxxxx).'},
   starter:'<style>\n.kutu { }\n</style>\n<div class="kutu">Qutu</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('#')&&s.textContent.includes('background'); },
   hint:{az:'<style>\n.kutu { background-color: #3498db; color: white; padding: 10px; }\n</style>',en:'<style>\n.box { background-color: #3498db; color: white; padding: 10px; }\n</style>'}},
  {task:{az:'Bir &lt;div&gt;-ə linear-gradient arxa planı verin.',en:'Give a &lt;div&gt; a linear-gradient background.'},
   starter:'<style>\n.grad { height: 100px; }\n</style>\n<div class="grad"></div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('linear-gradient'); },
   hint:{az:'<style>\n.grad { height: 100px; background: linear-gradient(135deg, #667eea, #764ba2); }\n</style>\n<div class="grad"></div>',en:'<style>\n.grad { height: 100px; background: linear-gradient(135deg, #667eea, #764ba2); }\n</style>\n<div class="grad"></div>'}},
 ]
},

{id:7,
 title:{az:'Qutu Modeli',en:'Box Model'},
 meta:{az:'Dərs 7 · 5 dəq',en:'Lesson 7 · 5 min'},
 body:{
  az:`<p>CSS qutu modeli hər elementin dörd təbəqədən ibarət olduğunu göstərir:</p>
<pre><span class="cm">┌─── margin (xarici boşluq) ───────┐
│  ┌── border (kənar) ───────────┐  │
│  │  ┌─ padding (daxili boşluq)┐│  │
│  │  │   content (məzmun)      ││  │
│  │  └─────────────────────────┘│  │
│  └─────────────────────────────┘  │
└────────────────────────────────────┘</span></pre>
<pre><span class="prop">margin</span>: <span class="pval">20px</span>;            <span class="cm">/* hamısı */</span>
<span class="prop">margin</span>: <span class="pval">10px 20px</span>;       <span class="cm">/* üst/alt sol/sağ */</span>
<span class="prop">padding</span>: <span class="pval">15px</span>;
<span class="prop">border</span>: <span class="pval">2px solid #333</span>;
<span class="prop">border-radius</span>: <span class="pval">8px</span>;       <span class="cm">/* yuvarlaq künc */</span>
<span class="prop">width</span>: <span class="pval">300px</span>;
<span class="prop">height</span>: <span class="pval">150px</span>;</pre>`,
  en:`<p>The CSS box model shows every element has four layers:</p>
<pre><span class="cm">┌─── margin (outer space) ─────────┐
│  ┌── border ───────────────────┐  │
│  │  ┌─ padding (inner space)  ┐│  │
│  │  │   content               ││  │
│  │  └─────────────────────────┘│  │
│  └─────────────────────────────┘  │
└────────────────────────────────────┘</span></pre>
<pre><span class="prop">margin</span>: <span class="pval">20px</span>;            <span class="cm">/* all sides */</span>
<span class="prop">margin</span>: <span class="pval">10px 20px</span>;       <span class="cm">/* top/bottom left/right */</span>
<span class="prop">padding</span>: <span class="pval">15px</span>;
<span class="prop">border</span>: <span class="pval">2px solid #333</span>;
<span class="prop">border-radius</span>: <span class="pval">8px</span>;       <span class="cm">/* rounded corners */</span>
<span class="prop">width</span>: <span class="pval">300px</span>;
<span class="prop">height</span>: <span class="pval">150px</span>;</pre>`
 },
 exercises:[
  {task:{az:'Bir &lt;div&gt;-ə padding: 20px verin.',en:'Give a &lt;div&gt; padding: 20px.'},
   starter:'<style>\n.kutu { }\n</style>\n<div class="kutu">Məzmun</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('padding'); },
   hint:{az:'<style>\n.kutu { padding: 20px; background: #eee; }\n</style>',en:'<style>\n.box { padding: 20px; background: #eee; }\n</style>'}},
  {task:{az:'Bir &lt;div&gt;-ə border: 2px solid black verin.',en:'Give a &lt;div&gt; border: 2px solid black.'},
   starter:'<style>\n.kutu { padding: 15px; }\n</style>\n<div class="kutu">Kənar</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('border')&&s.textContent.includes('solid'); },
   hint:{az:'<style>\n.kutu { padding: 15px; border: 2px solid black; }\n</style>',en:'<style>\n.box { padding: 15px; border: 2px solid black; }\n</style>'}},
  {task:{az:'border-radius: 12px ilə yuvarlaq künclər əlavə edin.',en:'Add rounded corners with border-radius: 12px.'},
   starter:'<style>\n.kutu { padding: 20px; background: #3498db; color: white; }\n</style>\n<div class="kutu">Yuvarlaq</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('border-radius'); },
   hint:{az:'<style>\n.kutu { padding: 20px; background: #3498db; color: white; border-radius: 12px; }\n</style>',en:'<style>\n.box { padding: 20px; background: #3498db; color: white; border-radius: 12px; }\n</style>'}},
  {task:{az:'width: 200px və height: 100px ilə ölçü verin. Fərqi görün.',en:'Set width: 200px and height: 100px. Observe the result.'},
   starter:'<style>\n.kutu { background: #e74c3c; }\n</style>\n<div class="kutu"></div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('width')&&s.textContent.includes('height'); },
   hint:{az:'<style>\n.kutu { background: #e74c3c; width: 200px; height: 100px; }\n</style>',en:'<style>\n.box { background: #e74c3c; width: 200px; height: 100px; }\n</style>'}},
 ]
},

{id:8,
 title:{az:'Mətn Stilləri',en:'Text Styling'},
 meta:{az:'Dərs 8 · 3 dəq',en:'Lesson 8 · 3 min'},
 body:{
  az:`<p>CSS ilə mətni istənilən şəkildə stilləndirmək olar:</p>
<pre><span class="prop">font-family</span>: <span class="pval">'Arial', sans-serif</span>;
<span class="prop">font-size</span>: <span class="pval">18px</span>;
<span class="prop">font-weight</span>: <span class="pval">bold</span>;         <span class="cm">/* və ya 100–900 */</span>
<span class="prop">font-style</span>: <span class="pval">italic</span>;
<span class="prop">text-align</span>: <span class="pval">center</span>;       <span class="cm">/* left, right, justify */</span>
<span class="prop">text-decoration</span>: <span class="pval">underline</span>; <span class="cm">/* none, line-through */</span>
<span class="prop">line-height</span>: <span class="pval">1.6</span>;
<span class="prop">letter-spacing</span>: <span class="pval">2px</span>;</pre>`,
  en:`<p>CSS lets you style text in any way you want:</p>
<pre><span class="prop">font-family</span>: <span class="pval">'Arial', sans-serif</span>;
<span class="prop">font-size</span>: <span class="pval">18px</span>;
<span class="prop">font-weight</span>: <span class="pval">bold</span>;         <span class="cm">/* or 100–900 */</span>
<span class="prop">font-style</span>: <span class="pval">italic</span>;
<span class="prop">text-align</span>: <span class="pval">center</span>;       <span class="cm">/* left, right, justify */</span>
<span class="prop">text-decoration</span>: <span class="pval">underline</span>; <span class="cm">/* none, line-through */</span>
<span class="prop">line-height</span>: <span class="pval">1.6</span>;
<span class="prop">letter-spacing</span>: <span class="pval">2px</span>;</pre>`
 },
 exercises:[
  {task:{az:'h1-ə text-align: center verin.',en:'Give h1 text-align: center.'},
   starter:'<style>\nh1 { }\n</style>\n<h1>Mərkəzdə</h1>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('text-align')&&s.textContent.includes('center'); },
   hint:{az:'<style>\nh1 { text-align: center; }\n</style>',en:'<style>\nh1 { text-align: center; }\n</style>'}},
  {task:{az:'p-ə font-size: 18px və line-height: 1.8 verin.',en:'Give p font-size: 18px and line-height: 1.8.'},
   starter:'<style>\np { }\n</style>\n<p>Bu mətnin ölçüsü dəyişəcək.</p>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('font-size')&&s.textContent.includes('line-height'); },
   hint:{az:'<style>\np { font-size: 18px; line-height: 1.8; }\n</style>',en:'<style>\np { font-size: 18px; line-height: 1.8; }\n</style>'}},
  {task:{az:'Bir elementi font-weight: bold, font-style: italic edin.',en:'Make an element font-weight: bold and font-style: italic.'},
   starter:'<style>\n.guclu { }\n</style>\n<p class="guclu">Bu mətn dəyişəcək</p>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('bold')&&s.textContent.includes('italic'); },
   hint:{az:'<style>\n.guclu { font-weight: bold; font-style: italic; }\n</style>',en:'<style>\n.strong { font-weight: bold; font-style: italic; }\n</style>'}},
 ]
},

{id:9,
 title:{az:'Flexbox',en:'Flexbox'},
 meta:{az:'Dərs 9 · 5 dəq',en:'Lesson 9 · 5 min'},
 body:{
  az:`<p>Flexbox elementləri sıralamaq və hizalamaq üçün güclü bir CSS sistemidir.</p>
<pre><span class="sel">.konteyner</span> {
  <span class="prop">display</span>: <span class="pval">flex</span>;
  <span class="prop">gap</span>: <span class="pval">12px</span>;
  <span class="prop">justify-content</span>: <span class="pval">center</span>;    <span class="cm">/* üfüqi */</span>
  <span class="prop">align-items</span>: <span class="pval">center</span>;       <span class="cm">/* şaquli */</span>
  <span class="prop">flex-wrap</span>: <span class="pval">wrap</span>;           <span class="cm">/* sıra keçidi */</span>
}</pre>
<p>justify-content dəyərləri: <b>flex-start</b>, <b>flex-end</b>, <b>center</b>, <b>space-between</b>, <b>space-around</b></p>
<p>Uşaq elementlər üçün:</p>
<pre><span class="sel">.element</span> {
  <span class="prop">flex</span>: <span class="pval">1</span>;     <span class="cm">/* bərabər yer böl */</span>
}</pre>`,
  en:`<p>Flexbox is a powerful CSS system for arranging and aligning elements.</p>
<pre><span class="sel">.container</span> {
  <span class="prop">display</span>: <span class="pval">flex</span>;
  <span class="prop">gap</span>: <span class="pval">12px</span>;
  <span class="prop">justify-content</span>: <span class="pval">center</span>;    <span class="cm">/* horizontal */</span>
  <span class="prop">align-items</span>: <span class="pval">center</span>;       <span class="cm">/* vertical */</span>
  <span class="prop">flex-wrap</span>: <span class="pval">wrap</span>;           <span class="cm">/* line wrap */</span>
}</pre>
<p>justify-content values: <b>flex-start</b>, <b>flex-end</b>, <b>center</b>, <b>space-between</b>, <b>space-around</b></p>
<p>For child elements:</p>
<pre><span class="sel">.item</span> {
  <span class="prop">flex</span>: <span class="pval">1</span>;     <span class="cm">/* equal width */</span>
}</pre>`
 },
 exercises:[
  {task:{az:'Bir &lt;div&gt;-ə display: flex verin. İçinə 3 uşaq &lt;div&gt; əlavə edin.',en:'Give a &lt;div&gt; display: flex. Add 3 child &lt;div&gt; elements inside.'},
   starter:'<style>\n.flex { }\n.element { background: #3498db; color: white; padding: 10px; }\n</style>\n<div class="flex">\n\n</div>',
   check:d=>{ const s=d.querySelector('style'); const f=d.querySelector('.flex')||d.querySelector('[style*="flex"]'); return s&&s.textContent.includes('flex')&&d.querySelectorAll('div div').length>=3; },
   hint:{az:'<style>\n.flex { display: flex; gap: 8px; }\n.element { background: #3498db; color: white; padding: 10px; }\n</style>\n<div class="flex">\n  <div class="element">1</div>\n  <div class="element">2</div>\n  <div class="element">3</div>\n</div>',en:'<style>\n.flex { display: flex; gap: 8px; }\n.item { background: #3498db; color: white; padding: 10px; }\n</style>\n<div class="flex">\n  <div class="item">1</div>\n  <div class="item">2</div>\n  <div class="item">3</div>\n</div>'}},
  {task:{az:'Flex konteynerinə justify-content: space-between verin.',en:'Give the flex container justify-content: space-between.'},
   starter:'<style>\n.flex { display: flex; }\n.el { background: #e74c3c; color: white; padding: 10px; }\n</style>\n<div class="flex">\n  <div class="el">A</div>\n  <div class="el">B</div>\n  <div class="el">C</div>\n</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('space-between'); },
   hint:{az:'<style>\n.flex { display: flex; justify-content: space-between; }\n</style>',en:'<style>\n.flex { display: flex; justify-content: space-between; }\n</style>'}},
  {task:{az:'Flex konteynerinə 100px hündürlük verin, align-items: center ilə elementləri şaquli mərkəzə aparın.',en:'Give the flex container 100px height, use align-items: center to vertically center the items.'},
   starter:'<style>\n.flex { display: flex; background: #f0f0f0; }\n.el { background: #2ecc71; padding: 10px 20px; }\n</style>\n<div class="flex">\n  <div class="el">Mərkəz</div>\n</div>',
   check:d=>{ const s=d.querySelector('style'); return s&&s.textContent.includes('align-items')&&s.textContent.includes('center'); },
   hint:{az:'<style>\n.flex { display: flex; height: 100px; background: #f0f0f0; align-items: center; justify-content: center; }\n</style>',en:'<style>\n.flex { display: flex; height: 100px; background: #f0f0f0; align-items: center; justify-content: center; }\n</style>'}},
 ]
},
  ]
};
