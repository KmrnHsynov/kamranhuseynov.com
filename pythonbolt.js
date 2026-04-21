let lang = 'az';
function setLang(l) {
  lang = l;
  document.getElementById('btn-az').classList.toggle('active', l === 'az');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');
  renderSidebar();
  loadLesson(curLesson);
}
function t(az, en) { return lang === 'az' ? az : en; }

// ═══════════════════════════════════════════════════════
// CURRICULUM
// ═══════════════════════════════════════════════════════
const curriculum = [
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
];

// ═══════════════════════════════════════════════════════
// STATE & LOGIC
// ═══════════════════════════════════════════════════════
let curLesson = 0, curExercise = 0;
let done = {};
let cm, pyodide = null;

function totalExercises()     { return curriculum.reduce((a, l) => a + l.exercises.length, 0); }
function completedExercises() { return Object.values(done).reduce((a, v) => a + v.length, 0); }

function renderSidebar() {
  document.getElementById('sidebar-title').textContent = t('Dərslər', 'Lessons');
  const list = document.getElementById('lesson-list');
  list.innerHTML = '';
  let lastSection = '';
  curriculum.forEach((l, i) => {
    if (l.section && l.section[lang] !== lastSection) {
      lastSection = l.section[lang];
      const sh = document.createElement('div');
      sh.className = 'section-header';
      sh.textContent = lastSection;
      list.appendChild(sh);
    }
    const allDone = (done[l.id] || []).length === l.exercises.length;
    const d = document.createElement('div');
    d.className = 'lesson-item' + (i === curLesson ? ' active' : '');
    d.innerHTML = `<span class="num">${i}</span>${l.title[lang]}${allDone ? '<span class="check">✓</span>' : ''}`;
    d.onclick = () => {
      curLesson = i; curExercise = 0;
      loadLesson(i);
      if (window.innerWidth <= 768) setMobileView('lesson');
    };
    list.appendChild(d);
  });
  const comp = completedExercises(), total = totalExercises();
  document.getElementById('progress-text').textContent = `${comp}/${total}`;
  document.getElementById('progress-bar-fill').style.width = `${total ? Math.round(comp / total * 100) : 0}%`;
}

function loadLesson(i) {
  curLesson = i; curExercise = 0;
  const l = curriculum[i];
  document.getElementById('lesson-title').textContent = l.title[lang];
  document.getElementById('lesson-meta').textContent  = l.meta[lang];
  document.getElementById('lesson-body').innerHTML    = l.body[lang];
  document.getElementById('task-label').textContent  = t('Tapşırıq', 'Exercise');
  loadExercise(0);
  renderSidebar();
}

function loadExercise(ei) {
  curExercise = ei;
  const ex = curriculum[curLesson].exercises[ei];
  document.getElementById('task-text').textContent = ex.task[lang];
  document.getElementById('ex-title').textContent  = t(`Məşq ${ei + 1}`, `Exercise ${ei + 1}`);
  if (cm) {
    const saved = getSaved(curLesson, ei);
    cm.setValue(saved || ex.starter);
  }
  document.getElementById('output').innerHTML   = `<span class="out-info">▶ ${t('Kodu işlət', 'Run your code')}</span>`;
  document.getElementById('feedback').textContent = '';
  renderExNav();
}

function renderExNav() {
  const nav = document.getElementById('ex-nav');
  nav.innerHTML = '';
  curriculum[curLesson].exercises.forEach((_, ei) => {
    const b = document.createElement('button');
    b.className = 'ex-dot' + (ei === curExercise ? ' active' : '') + ((done[curLesson] || []).includes(ei) ? ' done' : '');
    b.textContent = ei + 1;
    b.onclick = () => loadExercise(ei);
    nav.appendChild(b);
  });
}

function getSaved(l, e) { try { return localStorage.getItem(`pb2_${l}_${e}`); } catch { return null; } }
function setSaved(l, e, v) { try { localStorage.setItem(`pb2_${l}_${e}`, v); } catch {} }

window.addEventListener('DOMContentLoaded', () => {
  cm = CodeMirror.fromTextArea(document.getElementById('editor'), {
    mode: 'python', theme: 'dracula', lineNumbers: true, indentUnit: 4,
    extraKeys: { "Tab": cm => cm.replaceSelection("    ") }
  });
  cm.on('change', () => setSaved(curLesson, curExercise, cm.getValue()));
  loadLesson(0);
  renderSidebar();
  loadPyodide();

  // Set initial mobile view
  if (window.innerWidth <= 768) setMobileView('lesson');
});

async function loadPyodide() {
  const st = document.getElementById('pyodide-status');
  try {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
    s.onload = async () => {
      pyodide = await window.loadPyodide();
      st.textContent = '✅ Python hazırdır';
      document.getElementById('run-btn').disabled = false;
      setTimeout(() => st.style.display = 'none', 2500);
      document.getElementById('output').innerHTML = `<span class="out-info">${t('Python hazırdır. Kodu yazıb işlət!', 'Python ready. Write and run your code!')}</span>`;
    };
    document.head.appendChild(s);
  } catch (e) { st.textContent = '❌ Pyodide yüklənmədi'; }
}

async function runCode() {
  const code  = cm.getValue();
  const outEl = document.getElementById('output');
  const fbEl  = document.getElementById('feedback');
  if (!pyodide) {
    outEl.innerHTML = `<span class="out-info">⏳ ${t('Python hələ hazır deyil...', 'Python not ready yet...')}</span>`;
    return;
  }
  outEl.innerHTML = ''; fbEl.textContent = '';
  let lines = [];
  pyodide.globals.set('print', (...args) => {
    const line = args.map(a => typeof a === 'boolean' ? (a ? 'True' : 'False') : String(a)).join(' ');
    lines.push(line);
    const d = document.createElement('div');
    d.className = 'out-ok'; d.textContent = line; outEl.appendChild(d);
  });
  try {
    await pyodide.runPythonAsync(code);
    setSaved(curLesson, curExercise, code);
    const ex = curriculum[curLesson].exercises[curExercise];
    const combined = lines.join('\n');
    if (ex.check(combined)) {
      fbEl.innerHTML = `<span class="fb-pass">✅ ${t('Düzgündür! Əla!', 'Correct! Well done!')}</span>`;
      if (!done[curLesson]) done[curLesson] = [];
      if (!done[curLesson].includes(curExercise)) done[curLesson].push(curExercise);
      renderExNav(); renderSidebar();
      setTimeout(() => {
        const ne = curExercise + 1, nl = curLesson + 1;
        if (ne < curriculum[curLesson].exercises.length) loadExercise(ne);
        else if (nl < curriculum.length) { curLesson = nl; loadLesson(nl); }
      }, 1400);
    } else {
      fbEl.innerHTML = `<span class="fb-hint">💡 ${t('Hint: ', 'Hint: ')}${ex.hint[lang]}</span>`;
    }
  } catch (err) {
    const d = document.createElement('div');
    d.className = 'out-err'; d.textContent = '❌ ' + err.message; outEl.appendChild(d);
  }
}

function resetCode() {
  const ex = curriculum[curLesson].exercises[curExercise];
  cm.setValue(ex.starter);
  document.getElementById('output').innerHTML   = `<span class="out-info">↺ ${t('Sıfırlandı.', 'Reset.')}</span>`;
  document.getElementById('feedback').textContent = '';
}

function showHint() {
  const ex = curriculum[curLesson].exercises[curExercise];
  document.getElementById('feedback').innerHTML = `<span class="fb-hint">💡 ${ex.hint[lang]}</span>`;
}

// ═══════════════════════════════════════════════════════
// MOBILE TAB NAVIGATION
// ═══════════════════════════════════════════════════════
function setMobileView(view) {
  document.getElementById('sidebar').classList.toggle('mob-active', view === 'sidebar');
  document.getElementById('lesson-panel').classList.toggle('mob-active', view === 'lesson');
  document.getElementById('exercise-panel').classList.toggle('mob-active', view === 'code');

  document.querySelectorAll('.mob-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  // Refresh CodeMirror layout when switching to code view
  if (view === 'code' && cm) setTimeout(() => cm.refresh(), 60);
}
