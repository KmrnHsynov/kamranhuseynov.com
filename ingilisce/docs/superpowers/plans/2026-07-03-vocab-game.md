# Vocabulary Flashcard Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 🃏 Söz vocabulary flashcard game to İngiliscə Öyrən — emoji/word recognition with 5 lives, categories, and admin management.

**Architecture:** New vocab game engine appended to `ingilisce.js` following the exact same pattern as the existing review quiz engine (session object, render/check/result functions). Four new modals in `ingilisce.html`. Vocab items stored in a new Supabase `vocab_items` table, manageable from a second tab in `admin.html`.

**Tech Stack:** Vanilla JS, CSS custom properties (existing vars), Supabase JS v2 (already loaded), no new dependencies.

## Global Constraints

- All Azerbaijani UI copy follows existing app conventions (Azerbaijani language throughout)
- CSS uses existing custom properties: `var(--border)`, `var(--modal-bg)`, `var(--accent)`, `var(--success)`, `var(--bg)`
- `shuffle()` function already defined in `ingilisce.js` at line 493 — do not redefine
- `openModal(id)` / `closeModal(id)` helpers already exist — use them
- `renderLives(containerId, lives)` already exists — use it
- `normalizeAnswer(val)` already exists — use it
- No build step; changes are live immediately when files are saved
- Supabase credentials: URL `https://krrzidmvtudulflxzrqj.supabase.co`, anon key already in both files

---

## Task 1: Supabase Table Setup

**Files:**
- No file changes — SQL run in Supabase dashboard

**Interfaces:**
- Produces: `vocab_items` table readable by all, writable only by Kamran admin profile

- [ ] **Step 1: Run this SQL in the Supabase dashboard (SQL Editor)**

```sql
create table vocab_items (
  id uuid primary key default gen_random_uuid(),
  emoji text not null,
  image_url text,
  english text not null,
  azerbaijani text not null,
  category text not null,
  created_at timestamptz default now()
);

alter table vocab_items enable row level security;

create policy "Public read vocab_items"
  on vocab_items for select using (true);

create policy "Admin insert vocab_items"
  on vocab_items for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and lower(profiles.display_name) = 'kamran'
    )
  );

create policy "Admin delete vocab_items"
  on vocab_items for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and lower(profiles.display_name) = 'kamran'
    )
  );
```

- [ ] **Step 2: Verify table exists**

In Supabase dashboard → Table Editor, confirm `vocab_items` appears with columns: `id`, `emoji`, `image_url`, `english`, `azerbaijani`, `category`, `created_at`.

- [ ] **Step 3: Insert two test rows to confirm RLS works**

Log in to `admin.html` as Kamran (we'll build this in Task 2), then verify a public (unauthenticated) fetch returns these rows and a non-Kamran user cannot insert.

---

## Task 2: Admin Page — Söz Oyunu Tab

**Files:**
- Modify: `ingilisce/admin.html`

**Interfaces:**
- Consumes: `vocab_items` table from Task 1
- Produces: Admin UI to add/delete vocab items; `loadVocabItems()`, `addVocabItem()`, `deleteVocabItem(id)` functions

- [ ] **Step 1: Add tab navigation HTML**

In `admin.html`, find the `<div class="admin-wrap" id="adminWrap" ...>` and its `<div class="admin-header">`. After the admin-header div, add a tab bar before the existing add-card:

```html
<!-- Tab bar -->
<div class="admin-tabs" id="adminTabs">
  <button class="admin-tab active" id="tabQuestions" onclick="switchAdminTab('questions')">📝 Suallar</button>
  <button class="admin-tab" id="tabVocab" onclick="switchAdminTab('vocab')">🃏 Söz Oyunu</button>
</div>
```

- [ ] **Step 2: Wrap existing question content in a panel div**

Wrap the existing `.add-card` and `<div class="q-list" ...>` in a single div:

```html
<div id="panelQuestions">
  <!-- existing .add-card here -->
  <!-- existing .q-list here -->
</div>
```

- [ ] **Step 3: Add Söz Oyunu panel HTML after `#panelQuestions`**

```html
<!-- Söz Oyunu panel -->
<div id="panelVocab" style="display:none">
  <div class="add-card">
    <h3>Yeni Söz Əlavə Et</h3>
    <div class="form-grid">
      <div><label>Emoji</label><input type="text" id="vEmoji" placeholder="🍎" maxlength="4"></div>
      <div><label>Kateqoriya</label><input type="text" id="vCategory" placeholder="food" list="categoryList"><datalist id="categoryList"></datalist></div>
      <div><label>İngiliscə</label><input type="text" id="vEnglish" placeholder="apple"></div>
      <div><label>Azərbaycanca</label><input type="text" id="vAz" placeholder="alma"></div>
    </div>
    <div><label style="font-size:0.72rem;opacity:0.4;margin-top:8px;display:block">Şəkil URL (isteğe bağlı — gələcək üçün)</label><input type="text" id="vImageUrl" placeholder="https://..."></div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px">
      <button class="btn btn-primary" onclick="addVocabItem()">Əlavə et</button>
      <span class="status" id="vocabAddStatus"></span>
    </div>
  </div>
  <div class="q-list" id="vocabList"></div>
</div>
```

- [ ] **Step 4: Add tab CSS to the `<style>` block in `admin.html`**

```css
/* Tabs */
.admin-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
.admin-tab {
  padding: 8px 20px; border-radius: 8px; border: 1.5px solid #2a2d3a;
  background: transparent; color: #e8eaf0; font-family: 'Rubik', sans-serif;
  font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.admin-tab.active { background: #4f8ef7; border-color: #4f8ef7; color: #fff; }

/* Vocab cards */
.v-card {
  background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 12px;
  padding: 14px 18px; display: flex; align-items: center; gap: 14px;
}
.v-emoji { font-size: 1.8rem; min-width: 36px; text-align: center; }
.v-content { flex: 1; }
.v-en { font-size: 0.92rem; font-weight: 600; }
.v-az { font-size: 0.8rem; opacity: 0.5; }
.v-cat { font-size: 0.72rem; background: #2a2d3a; border-radius: 6px; padding: 2px 8px; margin-left: 6px; }
```

- [ ] **Step 5: Add tab-switching and vocab functions to the `<script>` block in `admin.html`**

Add these functions before the closing `</script>` tag:

```javascript
function switchAdminTab(tab) {
  document.getElementById('panelQuestions').style.display = tab === 'questions' ? 'block' : 'none';
  document.getElementById('panelVocab').style.display     = tab === 'vocab'     ? 'block' : 'none';
  document.getElementById('tabQuestions').classList.toggle('active', tab === 'questions');
  document.getElementById('tabVocab').classList.toggle('active', tab === 'vocab');
  if (tab === 'vocab') loadVocabItems();
}

async function loadVocabItems() {
  const { data } = await db.from('vocab_items').select('*').order('category').order('english');
  const list = document.getElementById('vocabList');
  list.innerHTML = '';

  if (!data || data.length === 0) {
    list.innerHTML = '<div class="empty">Hələ söz əlavə edilməyib.</div>';
  } else {
    // Populate category datalist
    const cats = [...new Set(data.map(v => v.category))];
    document.getElementById('categoryList').innerHTML = cats.map(c => `<option value="${c}">`).join('');

    data.forEach(v => {
      const card = document.createElement('div');
      card.className = 'v-card';
      card.innerHTML = `
        <span class="v-emoji">${v.emoji}</span>
        <div class="v-content">
          <div class="v-en">${v.english} <span class="v-cat">${v.category}</span></div>
          <div class="v-az">${v.azerbaijani}</div>
        </div>
        <button class="btn btn-danger" onclick="deleteVocabItem('${v.id}')">Sil</button>`;
      list.appendChild(card);
    });
  }
}

async function addVocabItem() {
  const emoji      = document.getElementById('vEmoji').value.trim();
  const english    = document.getElementById('vEnglish').value.trim();
  const azerbaijani = document.getElementById('vAz').value.trim();
  const category   = document.getElementById('vCategory').value.trim().toLowerCase();
  const image_url  = document.getElementById('vImageUrl').value.trim() || null;
  const status     = document.getElementById('vocabAddStatus');

  if (!emoji || !english || !azerbaijani || !category) {
    status.textContent = '⚠️ Emoji, İngiliscə, Azərbaycanca və Kateqoriya mütləqdir.';
    return;
  }

  status.textContent = 'Əlavə edilir...';
  const { error } = await db.from('vocab_items').insert({ emoji, english, azerbaijani, category, image_url });
  if (error) { status.textContent = '❌ ' + error.message; return; }

  ['vEmoji','vEnglish','vAz','vCategory','vImageUrl'].forEach(id => document.getElementById(id).value = '');
  status.textContent = '✓ Əlavə edildi!';
  setTimeout(() => status.textContent = '', 2000);
  loadVocabItems();
}

async function deleteVocabItem(id) {
  if (!confirm('Bu sözü silmək istəyirsiniz?')) return;
  await db.from('vocab_items').delete().eq('id', id);
  loadVocabItems();
}
```

- [ ] **Step 6: Also call `loadQuestions()` on the questions tab (existing function) when that tab is selected**

In `switchAdminTab`, add the call:

```javascript
function switchAdminTab(tab) {
  document.getElementById('panelQuestions').style.display = tab === 'questions' ? 'block' : 'none';
  document.getElementById('panelVocab').style.display     = tab === 'vocab'     ? 'block' : 'none';
  document.getElementById('tabQuestions').classList.toggle('active', tab === 'questions');
  document.getElementById('tabVocab').classList.toggle('active', tab === 'vocab');
  if (tab === 'vocab')     loadVocabItems();
  if (tab === 'questions') loadQuestions();
}
```

- [ ] **Step 7: Verify in browser**

Open `admin.html`, log in as Kamran. Confirm two tabs appear. Click "🃏 Söz Oyunu" → add a test word (🍎 / apple / alma / food). Confirm it appears in the list. Click Sil → confirm it disappears.

- [ ] **Step 8: Commit**

```bash
git add ingilisce/admin.html
git commit -m "feat: add Söz Oyunu tab to admin panel for vocab item management"
```

---

## Task 3: HTML — Header Button + Game Modals

**Files:**
- Modify: `ingilisce/ingilisce.html`

**Interfaces:**
- Consumes: nothing yet (JS engine added in Task 5)
- Produces: `#vocabCategoryOverlay`, `#vocabOverlay`, `#vocabResultOverlay`, `#vocabFailOverlay` modals; `🃏 Söz` header button calling `startVocabGame()`

- [ ] **Step 1: Add header button**

In `ingilisce.html`, find the line:
```html
<button class="review-quiz-btn" id="reviewQuizBtn" onclick="startReviewQuiz()">📝 Təkrar</button>
```

Add the new button immediately before it:
```html
<button class="vocab-game-btn" id="vocabGameBtn" onclick="startVocabGame()">🃏 Söz</button>
```

- [ ] **Step 2: Add category picker modal**

Before the `<!-- Review Quiz -->` comment, add:

```html
<!-- Vocab Category Picker -->
<div class="modal-overlay hidden" id="vocabCategoryOverlay">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">🃏 Söz Oyunu</h2>
      <button class="modal-close" onclick="closeModal('vocabCategoryOverlay')">✕</button>
    </div>
    <div class="modal-body">
      <p style="font-size:0.85rem;opacity:0.6;margin-bottom:12px">Kateqoriya seç:</p>
      <div class="vocab-category-chips" id="vocabCategoryChips"></div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" id="vocabStartBtn" onclick="launchVocabSession()">Başla</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add game modal**

After the category picker modal, add:

```html
<!-- Vocab Game -->
<div class="modal-overlay hidden" id="vocabOverlay">
  <div class="modal">
    <div class="modal-header">
      <span class="quiz-progress" id="vocabProgress"></span>
      <button class="modal-close" onclick="closeModal('vocabOverlay')">✕</button>
    </div>
    <div class="lives-bar" id="vocabLives"></div>
    <div class="modal-body" id="vocabBody"></div>
    <div class="modal-footer" style="display:none" id="vocabFooter"></div>
  </div>
</div>
```

- [ ] **Step 4: Add result modal**

After the vocab game modal, add:

```html
<!-- Vocab Result -->
<div class="modal-overlay hidden" id="vocabResultOverlay">
  <div class="modal celebration-modal">
    <div class="celebration-icon" id="vocabResultIcon">📊</div>
    <h2 id="vocabResultTitle"></h2>
    <p id="vocabResultText"></p>
    <div id="vocabWrongList" class="vocab-wrong-list"></div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:4px">
      <button class="btn-primary" id="vocabResultRetry">Yenidən</button>
      <button class="btn-outline" id="vocabResultClose">Bağla</button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add fail modal**

After the vocab result modal, add:

```html
<!-- Vocab Canlar Bitdi -->
<div class="modal-overlay hidden" id="vocabFailOverlay">
  <div class="modal celebration-modal">
    <div class="celebration-icon">💔</div>
    <h2>Canlar Bitdi</h2>
    <p>Yenidən cəhd et!</p>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:4px">
      <button class="btn-primary" id="vocabFailRetry">Yenidən</button>
      <button class="btn-outline" id="vocabFailClose">Bağla</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Verify HTML structure**

Open `ingilisce.html` in browser. The `🃏 Söz` button should appear in the header. Clicking it will error (JS not yet added) — that's expected. Confirm no layout breakage.

- [ ] **Step 7: Commit**

```bash
git add ingilisce/ingilisce.html
git commit -m "feat: add vocab game modals and header button to ingilisce.html"
```

---

## Task 4: CSS — Vocab Game Styles

**Files:**
- Modify: `ingilisce/ingilisce.css`

**Interfaces:**
- Produces: `.vocab-game-btn`, `.vocab-emoji-display`, `.vocab-word-display`, `.vocab-prompt`, `.vocab-options`, `.vocab-option`, `.vocab-options-grid`, `.vocab-option-emoji`, `.vocab-category-chips`, `.vocab-chip`, `.vocab-wrong-list`, `.vocab-wrong-item`

- [ ] **Step 1: Append vocab CSS to end of `ingilisce.css`**

```css
/* ── Vocab Game ─────────────────────────────────────── */

.vocab-game-btn {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: inherit;
  font-family: 'Rubik', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.vocab-game-btn:hover { background: var(--border); }

.vocab-emoji-display {
  font-size: 5rem;
  text-align: center;
  line-height: 1.2;
  margin: 16px 0 8px;
  user-select: none;
}

.vocab-word-display {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  margin: 16px 0 8px;
}

.vocab-prompt {
  font-size: 0.8rem;
  opacity: 0.5;
  text-align: center;
  margin-bottom: 16px;
}

.vocab-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vocab-option {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: transparent;
  color: inherit;
  font-size: 1rem;
  font-family: 'Rubik', sans-serif;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: center;
}
.vocab-option:hover:not(:disabled) { border-color: var(--accent); }

.vocab-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.vocab-option-emoji {
  aspect-ratio: 1;
  border-radius: 16px;
  border: 2px solid var(--border);
  background: transparent;
  font-size: 2.8rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vocab-option-emoji:hover:not(:disabled) { border-color: var(--accent); }

.vocab-option.correct,
.vocab-option-emoji.correct {
  border-color: var(--success);
  background: rgba(91, 200, 110, 0.15);
}

.vocab-option.wrong,
.vocab-option-emoji.wrong {
  border-color: #e05252;
  background: rgba(224, 82, 82, 0.12);
}

.vocab-category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 8px;
}

.vocab-chip {
  padding: 7px 16px;
  border-radius: 20px;
  border: 2px solid var(--border);
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
  transition: border-color 0.15s, background 0.15s;
}
.vocab-chip.selected {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.vocab-wrong-list {
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  text-align: left;
  margin-top: 8px;
}

.vocab-wrong-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(128,128,128,0.15);
  font-size: 0.83rem;
}
.vocab-wrong-emoji { font-size: 1.4rem; min-width: 28px; }
.vocab-wrong-en { font-weight: 600; flex: 1; }
.vocab-wrong-az { opacity: 0.5; font-size: 0.78rem; }

.btn-outline {
  padding: 11px 22px;
  border-radius: 12px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: inherit;
  font-family: 'Rubik', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-outline:hover { background: var(--border); }
```

- [ ] **Step 2: Verify visually**

Open `ingilisce.html`. Confirm the `🃏 Söz` button appears with correct styling (bordered pill, same row as `📝 Təkrar`). No layout shifts.

- [ ] **Step 3: Commit**

```bash
git add ingilisce/ingilisce.css
git commit -m "feat: add vocab game CSS styles"
```

---

## Task 5: JS — Vocab Game Engine

**Files:**
- Modify: `ingilisce/ingilisce.js` — append after the `// ── Review Quiz ──` block (before `// ── Quiz engine ──` at line 489)

**Interfaces:**
- Consumes: `openModal(id)`, `closeModal(id)`, `renderLives(containerId, lives)`, `shuffle(arr)`, `normalizeAnswer(val)` — all already in `ingilisce.js`
- Consumes: `vocab_items` Supabase table from Task 1
- Produces: `startVocabGame()`, `launchVocabSession()`, `renderVocabQuestion()`, `checkVocabAnswer(btn, selectedValue)`, `showVocabResult()` — called from HTML in Task 3

- [ ] **Step 1: Add vocab session state variable**

After `let reviewSession = null;` (line 370), add:

```javascript
let vocabSession = null;
```

- [ ] **Step 2: Add `startVocabGame()` — fetches categories and opens picker**

```javascript
// ── Vocab Game ─────────────────────────────────────────
async function startVocabGame() {
  const btn = document.getElementById('vocabGameBtn');
  btn.textContent = '⏳';
  btn.disabled = true;

  try {
    const { data, error } = await db.from('vocab_items').select('category');
    if (error || !data || data.length === 0) {
      alert('Söz tapılmadı. Əvvəlcə admin panelindən söz əlavə edin.');
      return;
    }

    const categories = ['Hamısı', ...new Set(data.map(v => v.category).sort())];
    const chips = document.getElementById('vocabCategoryChips');
    chips.innerHTML = '';
    let selectedCategory = 'Hamısı';

    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'vocab-chip' + (cat === 'Hamısı' ? ' selected' : '');
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        chips.querySelectorAll('.vocab-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedCategory = cat;
      });
      chips.appendChild(chip);
    });

    document.getElementById('vocabStartBtn').onclick = () => {
      closeModal('vocabCategoryOverlay');
      launchVocabSession(selectedCategory);
    };

    openModal('vocabCategoryOverlay');
  } finally {
    btn.textContent = '🃏 Söz';
    btn.disabled = false;
  }
}
```

- [ ] **Step 3: Add `launchVocabSession(category)` — builds 20-question session**

```javascript
async function launchVocabSession(category) {
  const query = db.from('vocab_items').select('*');
  const { data: allItems, error } = category === 'Hamısı'
    ? await query
    : await query.eq('category', category);

  if (error || !allItems || allItems.length === 0) {
    alert('Bu kateqoriyada söz tapılmadı.');
    return;
  }

  // Also fetch full pool for distractor fallback
  const { data: fullPool } = await db.from('vocab_items').select('*');

  const pool = shuffle(allItems).slice(0, 20);

  // Assign modes: first 12 Mode A (emoji→word), last 8 Mode B (word→emoji), then shuffle
  const questions = shuffle(pool.map((item, i) => {
    const isA = i < 12;  // 12 Mode A, 8 Mode B before shuffle
    // Build 3 distractors from category pool first, fall back to full pool
    const categoryPool = allItems.filter(v => v.id !== item.id);
    const fallbackPool = (fullPool || allItems).filter(v => v.id !== item.id);
    let distPool = categoryPool.length >= 3 ? categoryPool : fallbackPool;
    const distractors = shuffle(distPool).slice(0, 3);
    // options array: 4 items (correct + 3 distractors), shuffled
    const options = shuffle([item, ...distractors]);
    return { item, mode: isA ? 'A' : 'B', options };
  }));

  vocabSession = {
    questions,
    current: 0,
    lives: 5,
    wrong: [],
    category
  };

  document.getElementById('vocabFailRetry').onclick = () => {
    closeModal('vocabFailOverlay');
    startVocabGame();
  };
  document.getElementById('vocabFailClose').onclick = () => closeModal('vocabFailOverlay');
  document.getElementById('vocabResultRetry').onclick = () => {
    closeModal('vocabResultOverlay');
    startVocabGame();
  };
  document.getElementById('vocabResultClose').onclick = () => closeModal('vocabResultOverlay');

  openModal('vocabOverlay');
  renderVocabQuestion();
}
```

- [ ] **Step 4: Add `renderVocabQuestion()` — renders current question**

```javascript
function renderVocabQuestion() {
  const { questions, current, lives } = vocabSession;
  const { item, mode, options } = questions[current];

  document.getElementById('vocabProgress').textContent = `${current + 1} / ${questions.length}`;
  renderLives('vocabLives', lives);

  const body = document.getElementById('vocabBody');
  body.innerHTML = '';

  if (mode === 'A') {
    // Show emoji → pick English word
    const emojiEl = document.createElement('div');
    emojiEl.className = 'vocab-emoji-display';
    emojiEl.textContent = item.emoji;
    body.appendChild(emojiEl);

    const prompt = document.createElement('p');
    prompt.className = 'vocab-prompt';
    prompt.textContent = 'Bu nədir?';
    body.appendChild(prompt);

    const optContainer = document.createElement('div');
    optContainer.className = 'vocab-options';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vocab-option';
      btn.textContent = opt.english;
      btn.addEventListener('click', () => checkVocabAnswer(btn, opt.id, optContainer, 'id'));
      optContainer.appendChild(btn);
    });
    body.appendChild(optContainer);

  } else {
    // Mode B: Show English word → pick emoji
    const wordEl = document.createElement('div');
    wordEl.className = 'vocab-word-display';
    wordEl.textContent = item.english;
    body.appendChild(wordEl);

    const prompt = document.createElement('p');
    prompt.className = 'vocab-prompt';
    prompt.textContent = 'Emojiini tap!';
    body.appendChild(prompt);

    const optContainer = document.createElement('div');
    optContainer.className = 'vocab-options-grid';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vocab-option-emoji';
      btn.textContent = opt.emoji;
      btn.addEventListener('click', () => checkVocabAnswer(btn, opt.id, optContainer, 'id'));
      optContainer.appendChild(btn);
    });
    body.appendChild(optContainer);
  }
}
```

- [ ] **Step 5: Add `checkVocabAnswer(btn, selectedId, container, _key)` — handles answer logic**

```javascript
function checkVocabAnswer(btn, selectedId, container, _key) {
  const { questions, current } = vocabSession;
  const { item, mode } = questions[current];
  const isCorrect = selectedId === item.id;

  // Disable all buttons
  const btnClass = mode === 'A' ? '.vocab-option' : '.vocab-option-emoji';
  container.querySelectorAll(btnClass).forEach(b => b.disabled = true);

  // Visual feedback: mark correct button green, selected wrong button red
  container.querySelectorAll(btnClass).forEach((b, i) => {
    if (vocabSession.questions[current].options[i].id === item.id) {
      b.classList.add('correct');
    } else if (b === btn && !isCorrect) {
      b.classList.add('wrong');
    }
  });

  if (!isCorrect) {
    vocabSession.lives -= 1;
    renderLives('vocabLives', vocabSession.lives);
    vocabSession.wrong.push({ item });
  }

  const delay = isCorrect ? 600 : 900;

  setTimeout(() => {
    if (!isCorrect && vocabSession.lives <= 0) {
      closeModal('vocabOverlay');
      openModal('vocabFailOverlay');
      return;
    }
    const next = current + 1;
    if (next >= vocabSession.questions.length) {
      closeModal('vocabOverlay');
      showVocabResult();
    } else {
      vocabSession.current = next;
      renderVocabQuestion();
    }
  }, delay);
}
```

- [ ] **Step 6: Add `showVocabResult()` — renders end screen**

```javascript
function showVocabResult() {
  const { questions, wrong } = vocabSession;
  const correct = questions.length - wrong.length;
  const total   = questions.length;
  const pct     = Math.round((correct / total) * 100);

  document.getElementById('vocabResultIcon').textContent  = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
  document.getElementById('vocabResultTitle').textContent = pct >= 80 ? 'Əla nəticə!' : pct >= 50 ? 'Yaxşı cəhd!' : 'Daha çox məşq et!';
  document.getElementById('vocabResultText').textContent  = `${correct} / ${total} düzgün · ${pct}%`;

  const wrongList = document.getElementById('vocabWrongList');
  wrongList.innerHTML = '';
  if (wrong.length > 0) {
    const heading = document.createElement('p');
    heading.className = 'review-wrong-heading';
    heading.textContent = 'Səhvlər:';
    wrongList.appendChild(heading);
    wrong.forEach(({ item }) => {
      const el = document.createElement('div');
      el.className = 'vocab-wrong-item';
      el.innerHTML = `
        <span class="vocab-wrong-emoji">${item.emoji}</span>
        <span class="vocab-wrong-en">${item.english}</span>
        <span class="vocab-wrong-az">${item.azerbaijani}</span>`;
      wrongList.appendChild(el);
    });
  }

  openModal('vocabResultOverlay');
}
```

- [ ] **Step 7: Manual test — full game flow**

1. Add at least 8 vocab words via admin panel (mix of categories: food, animals, colors)
2. Open `ingilisce.html`
3. Click `🃏 Söz` → category picker appears with correct categories
4. Select "Hamısı" → click Başla
5. Game starts: emoji shown, 4 English word buttons → tap correct one → green flash, auto-advances
6. Tap a wrong option → red flash on wrong, green on correct, heart decrements
7. Let all 5 hearts die → `#vocabFailOverlay` appears; click Yenidən → category picker reopens
8. Restart fresh game, complete all 20 → result screen shows score and list of missed words
9. Switch to a category with <4 words — confirm distractors fall back to other categories without crashing
10. Test Mode B: confirm emoji grid 2×2 appears for ~40% of rounds

- [ ] **Step 8: Commit**

```bash
git add ingilisce/ingilisce.js
git commit -m "feat: add vocab flashcard game engine (startVocabGame, launchVocabSession, renderVocabQuestion, checkVocabAnswer, showVocabResult)"
```

---

## Post-Implementation Checklist

- [ ] Admin can add/delete vocab items from both tabs without refreshing
- [ ] Game handles categories with fewer than 4 items (distractor fallback works)
- [ ] Game handles pool of fewer than 20 words (plays with however many exist)
- [ ] `🃏 Söz` button does not interfere with `📝 Təkrar` button or profile dropdown
- [ ] Closing any modal mid-game via ✕ button doesn't leave stale session state (session resets on next `launchVocabSession()` call)
- [ ] `image_url` column is saved correctly even when left blank (stored as `null`)
