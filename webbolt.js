let lang = 'az';
function setLang(l) {
  lang = l;
  document.getElementById('btn-az').classList.toggle('active', l === 'az');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');
  renderSidebar();
  loadLesson(curLesson);
}
function t(az, en) { return lang === 'az' ? az : en; }

// ── Mobile helpers ─────────────────────────────────────
function isMobile() { return window.innerWidth <= 700; }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

let activeTab = 'lesson';
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tab-lesson').classList.toggle('active', tab === 'lesson');
  document.getElementById('tab-code').classList.toggle('active', tab === 'code');
  document.getElementById('lesson-panel').classList.toggle('tab-active', tab === 'lesson');
  document.getElementById('exercise-panel').classList.toggle('tab-active', tab === 'code');
  if (tab === 'code' && cm) setTimeout(() => cm.refresh(), 50);
}

// ── CURRICULUM ────────────────────────────────────────
const curriculum = [

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

];

// ── State ─────────────────────────────────────────────
let curLesson = 0, curExercise = 0;
const done = {};
let cm;

const SAVE_KEY = 'webbolt_saves';
function getSaved(l, e) {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); return (d[l]||{})[e]||null; } catch { return null; }
}
function setSaved(l, e, code) {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    if (!d[l]) d[l] = {};
    d[l][e] = code;
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch {}
}

// ── Sidebar ───────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('lesson-list');
  let html = '';
  let lastSection = null;
  curriculum.forEach((lesson, i) => {
    if (lesson.section) {
      lastSection = lesson.section;
      html += `<div class="section-header">${lesson.section[lang]}</div>`;
    }
    const allDone = lesson.exercises.every((_, ei) => done[i] && done[i].includes(ei));
    html += `<div class="lesson-item${i===curLesson?' active':''}" onclick="loadLesson(${i})">
      <span class="num">${i}</span>${lesson.title[lang]}${allDone?'<span class="check">✓</span>':''}
    </div>`;
  });
  list.innerHTML = html;
  updateProgress();
}

function updateProgress() {
  const total = curriculum.reduce((s, l) => s + l.exercises.length, 0);
  const comp = Object.entries(done).reduce((s, [li, arr]) => s + arr.length, 0);
  document.getElementById('progress-bar-fill').style.width = total ? (comp/total*100)+'%' : '0%';
  document.getElementById('progress-text').textContent = `${comp}/${total}`;
}

// ── Load lesson ───────────────────────────────────────
function loadLesson(i) {
  curLesson = i;
  const l = curriculum[i];
  document.getElementById('lesson-title').textContent = l.title[lang];
  document.getElementById('lesson-meta').textContent  = l.meta[lang];
  document.getElementById('lesson-body').innerHTML    = l.body[lang];
  document.getElementById('task-label').textContent   = t('Tapşırıq','Exercise');

  const cta = document.getElementById('jsbolt-cta');
  if (i === curriculum.length - 1) {
    cta.style.display = 'block';
    document.getElementById('jsbolt-cta-label').textContent = t('Sonrakı addım', 'Up next');
    document.getElementById('jsbolt-cta-desc').textContent  = t('HTML və CSS-i bitirdin! İndi JavaScript öyrən.', 'You finished HTML & CSS! Now learn JavaScript.');
    document.getElementById('jsbolt-cta-btn').textContent   = t('JSBolt-a keç →', 'Go to JSBolt →');
  } else {
    cta.style.display = 'none';
  }

  renderSidebar();
  loadExercise(0);
  if (isMobile()) switchTab('lesson');
}

function loadExercise(ei) {
  curExercise = ei;
  const ex = curriculum[curLesson].exercises[ei];
  document.getElementById('task-text').innerHTML = ex.task[lang];
  document.getElementById('ex-title').textContent  = t(`Məşq ${ei+1}`,`Exercise ${ei+1}`);

  const saved = getSaved(curLesson, ei);
  cm.setValue(saved !== null ? saved : ex.starter);
  cm.clearHistory();

  document.getElementById('feedback').textContent = '';
  runCode();

  renderExNav();
}

function renderExNav() {
  const exs = curriculum[curLesson].exercises;
  document.getElementById('ex-nav').innerHTML = exs.map((_, i) => {
    const isDone = done[curLesson] && done[curLesson].includes(i);
    const cls    = isDone ? 'done' : i === curExercise ? 'active' : '';
    return `<button class="ex-dot ${cls}" onclick="loadExercise(${i})">${i+1}</button>`;
  }).join('');
}

// ── Run code ──────────────────────────────────────────
function runCode() {
  const code = cm.getValue();
  const iframe = document.getElementById('preview');
  const fbEl   = document.getElementById('feedback');
  fbEl.textContent = '';

  setSaved(curLesson, curExercise, code);

  // write code into iframe
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(code);
    doc.close();
  } catch(e) {
    iframe.srcdoc = code;
  }

  const ex = curriculum[curLesson].exercises[curExercise];
  // wait a tick for iframe to render
  setTimeout(() => {
    try {
      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (ex.check(iDoc)) {
        if (!done[curLesson]) done[curLesson] = [];
        if (!done[curLesson].includes(curExercise)) done[curLesson].push(curExercise);
        renderExNav(); renderSidebar();
        const ne = curExercise + 1, nl = curLesson + 1;
        const hasNext = ne < curriculum[curLesson].exercises.length || nl < curriculum.length;
        fbEl.innerHTML = `<span class="fb-pass">✅ ${t('Düzgündür!','Correct!')}</span>`
          + (hasNext ? `<button class="btn-next" onclick="nextStep()">${t('Növbəti →','Next →')}</button>` : '');
      }
    } catch(e) {}
  }, 80);
}

function nextStep() {
  const ne = curExercise + 1, nl = curLesson + 1;
  if (ne < curriculum[curLesson].exercises.length) loadExercise(ne);
  else if (nl < curriculum.length) { curLesson = nl; loadLesson(nl); }
}

function resetCode() {
  cm.setValue(curriculum[curLesson].exercises[curExercise].starter);
  document.getElementById('preview').srcdoc = '';
  document.getElementById('feedback').textContent = '';
}

function showHint() {
  document.getElementById('feedback').innerHTML =
    `<span class="fb-hint">💡 ${curriculum[curLesson].exercises[curExercise].hint[lang]}</span>`;
}

// ── Init ──────────────────────────────────────────────
cm = CodeMirror.fromTextArea(document.getElementById('editor'), {
  mode: 'htmlmixed',
  theme: 'dracula',
  lineNumbers: true,
  tabSize: 2,
  indentWithTabs: false,
  lineWrapping: false,
  extraKeys: { 'Ctrl-Enter': runCode, 'Cmd-Enter': runCode }
});

document.getElementById('sidebar-title').textContent = t('Dərslər','Lessons');
loadLesson(0);

// mobile sidebar close on resize
window.addEventListener('resize', () => { if (!isMobile()) closeSidebar(); });
