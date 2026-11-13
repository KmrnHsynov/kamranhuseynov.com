# Vocabulary Flashcard Game — Design Spec
**Date:** 2026-07-03  
**Project:** İngiliscə Öyrən (`ingilisce/`)  
**Status:** Approved

---

## Overview

A vocabulary practice game added to İngiliscə Öyrən where players identify English words from emoji (or emojis from English words). Lives system, category filtering, 20 rounds per session.

---

## Data Layer

### New Supabase Table: `vocab_items`

| column | type | constraints | notes |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | |
| `emoji` | text | NOT NULL | e.g. `🍎` |
| `image_url` | text | nullable | reserved for future photo upgrade |
| `english` | text | NOT NULL | e.g. `apple` |
| `azerbaijani` | text | NOT NULL | e.g. `alma` (for future AZ mode) |
| `category` | text | NOT NULL | e.g. `food`, `animals`, `colors` |
| `created_at` | timestamptz | default now() | |

### RLS Policies

- **SELECT**: public (anon role) — all users can read
- **INSERT**: authenticated users whose `profiles.display_name = 'kamran'`
- **DELETE**: same as INSERT

### SQL to run in Supabase dashboard

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

---

## Admin Page Changes (`admin.html`)

Add a **second tab** to the existing admin panel: "Söz Oyunu".

### Tab UI
- Two tab buttons at the top: `Suallar` (existing) | `Söz Oyunu` (new)
- Each tab shows its own add-form + list section

### Söz Oyunu tab — Add Form fields
- Emoji (text input, e.g. `🍎`)
- English (text input)
- Azerbaijani (text input)
- Category (text input with datalist suggestions for existing categories)
- Submit → inserts into `vocab_items`

### Söz Oyunu tab — List
- Cards showing: emoji + english + azerbaijani + category badge + delete button
- Grouped or sorted by category

---

## Game UI (`ingilisce.html`)

### Header button
```html
<button class="vocab-game-btn" id="vocabGameBtn" onclick="startVocabGame()">🃏 Söz</button>
```
Placed left of the existing `📝 Təkrar` button. Same style class as `.review-quiz-btn`.

### New modals (3)

#### 1. Category Picker — `#vocabCategoryOverlay`
```
┌─────────────────────────────┐
│  🃏 Söz Oyunu               │
│  Kateqoriya seç:            │
│  [Hamısı] [Yemək] [Heyvan]  │
│  [Rənglər] [Geyim] ...      │
│                             │
│  [Başla]                    │
└─────────────────────────────┘
```
- Fetches distinct categories from `vocab_items`
- "Hamısı" chip always present, pre-selected
- Single-select; clicking a chip selects it
- "Başla" button starts the game session

#### 2. Game Modal — `#vocabOverlay`
Reuses `.modal-overlay` + `.modal` pattern.

Structure:
```
[progress: 5/20]             [✕]
❤️❤️❤️❤️❤️
────────────────────────────
        🍎              ← Mode A: big emoji
   Bu nədir?
 [apple] [banana] [cherry] [grape]   ← 4 word buttons
────────────────────────────
```

OR (Mode B):
```
[progress: 6/20]             [✕]
❤️❤️❤️❤️❤️
────────────────────────────
        apple           ← Mode B: big word
   Emojiini tap!
  [🍎]  [🍌]
  [🍒]  [🍇]            ← 2×2 emoji grid buttons
────────────────────────────
```

- No "Yoxla" button — answer is submitted immediately on option tap
- Correct: button flashes green, 600ms pause, next question
- Wrong: tapped button flashes red, correct button flashes green, heart depletes, 900ms pause, next question
- Buttons disabled during feedback pause

#### 3. Result Modal — `#vocabResultOverlay`
Reuses `.celebration-modal` pattern.

```
🎉 / 👍 / 📚   (based on score)
X/20 düzgün cavab
[wrong item list: emoji + english + azerbaijani]
[Yenidən] [Bağla]
```
- "Yenidən" restarts with same category selection
- Score icons: 🎉 ≥16/20, 👍 ≥10/20, 📚 <10/20

#### 4. Lives-out Modal — `#vocabFailOverlay` (separate from quiz `#failOverlay`)
```html
<div class="modal-overlay hidden" id="vocabFailOverlay">
  <div class="modal celebration-modal">
    <div class="celebration-icon">💔</div>
    <h2>Canlar Bitdi</h2>
    <p>Yenidən cəhd et!</p>
    <button class="btn-primary" id="vocabFailRetry">Yenidən</button>
    <button class="btn-outline" id="vocabFailClose">Bağla</button>
  </div>
</div>
```
"Yenidən" → re-opens category picker with same category pre-selected.

---

## Game Engine (`ingilisce.js`)

### State
```javascript
let vocabSession = null;
// {
//   questions: [{item, mode, options}],  // 20 items
//   current: 0,
//   lives: 5,
//   wrong: [],
//   category: 'food' | null
// }
```

### Functions

**`startVocabGame()`**
1. Opens `#vocabCategoryOverlay`
2. Fetches distinct categories from `vocab_items`
3. Renders category chips

**`launchVocabSession(category)`**
1. Fetches all `vocab_items` (filtered by category if not "Hamısı")
2. Shuffles, takes up to 20
3. For each item, assigns mode: first 12 get Mode A, next 8 get Mode B, then shuffle the full questions array (so modes are distributed randomly, not front-loaded)
4. Builds distractors: 3 random other items from same category; fills from full pool if needed
5. Shuffles options array (correct answer at random position)
6. Opens `#vocabOverlay`, calls `renderVocabQuestion()`

**`renderVocabQuestion()`**
- Renders current question based on `vocabSession.questions[vocabSession.current]`
- Mode A: shows `item.emoji` large, 4 `item.english` text buttons
- Mode B: shows `item.english` large, 4 `item.emoji` emoji buttons in 2×2 grid
- Updates progress counter and lives bar

**`checkVocabAnswer(selectedOption)`**
- Compares selected to correct
- Applies visual feedback classes
- If wrong: decrements lives; if lives = 0 → `showVocabFail()`
- After pause: advance or `showVocabResult()`

**`showVocabResult()`**
- Closes game overlay, opens result overlay
- Renders score + wrong-answers list

### Distractor logic
```
pool = all items in category (or all if "Hamısı")
distractors = shuffle(pool.filter(x => x.id !== item.id)).slice(0, 3)
if distractors.length < 3:
  fill from full table excluding item and already-chosen distractors
options = shuffle([item, ...distractors])
```

---

## CSS (`ingilisce.css`)

```css
.vocab-game-btn { /* same as .review-quiz-btn */ }

.vocab-emoji-display {
  font-size: 5rem;
  text-align: center;
  line-height: 1.2;
  margin: 16px 0 8px;
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
  /* word button */
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
}

.vocab-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.vocab-option-emoji {
  /* emoji button */
  aspect-ratio: 1;
  border-radius: 16px;
  border: 2px solid var(--border);
  background: transparent;
  font-size: 2.8rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.vocab-option.correct, .vocab-option-emoji.correct {
  border-color: var(--success);
  background: rgba(91, 200, 110, 0.15);
}

.vocab-option.wrong, .vocab-option-emoji.wrong {
  border-color: #e05252;
  background: rgba(224, 82, 82, 0.12);
}

.vocab-category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 20px;
}

.vocab-chip {
  padding: 7px 14px;
  border-radius: 20px;
  border: 2px solid var(--border);
  background: transparent;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
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
  padding: 6px 0;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  font-size: 0.83rem;
}

.vocab-wrong-emoji { font-size: 1.4rem; }
.vocab-wrong-en { font-weight: 600; flex: 1; }
.vocab-wrong-az { opacity: 0.55; }
```

---

## Out of Scope

- Audio pronunciation on reveal
- Streak/XP integration with main lesson system
- Keyboard navigation for emoji grid
- Editing existing vocab items (delete + re-add workflow)
- Azerbaijani→English mode (azerbaijani column reserved for future)
