# Lesson Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Duolingo-style sequential node-based English lesson path with text lessons, 5-lives quiz system, and localStorage progress tracking.

**Architecture:** Pure HTML/CSS/JS single-page app. `curriculum.json` stores all lesson content and quiz questions. `ingilisce.js` manages app state via localStorage and renders UI dynamically. Modals overlay the main path view for lessons and quizzes.

**Tech Stack:** HTML5, CSS3 (custom properties, flexbox), Vanilla JS (ES6+), Fetch API

---

## File Map

| File | Responsibility |
|---|---|
| `curriculum.json` | All sections, nodes, lesson texts, quiz questions |
| `ingilisce.html` | Page skeleton: header, path container, 4 modal overlays |
| `ingilisce.css` | Blue theme variables, path layout, node states, modal UI, quiz UI |
| `ingilisce.js` | State (localStorage), path rendering, lesson modal, quiz engine, lives system |

> **Note:** `fetch('curriculum.json')` requires a web server — not `file://`. Use VS Code Live Server extension or run `npx serve .` in the project folder.

---

### Task 1: curriculum.json

**Files:**
- Create: `curriculum.json`

- [ ] **Step 1: Write curriculum.json**

The first two nodes (fonetika-1, fonetika-2) have complete content. All other nodes have placeholder text — replace with real content before launch.

```json
{
  "sections": [
    {
      "id": "fonetika",
      "title": "FONETİKA (Phonetics)",
      "nodes": [
        {
          "id": "fonetika-1",
          "title": "Səs və hərf sistemi",
          "lesson": "İngilis əlifbasında 26 hərf var: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z.\n\nLakin bu 26 hərf 44 fərqli səsi ifadə edir. Bu o deməkdir ki, eyni hərf müxtəlif mövqelərdə müxtəlif səslər verə bilir.\n\nMəsələn:\n• 'c' hərfi 'cat' sözündə [k] kimi, 'city' sözündə isə [s] kimi oxunur.\n• 'th' birləşməsi 'the' sözündə [ð] kimi, 'think' sözündə isə [θ] kimi səslənir.\n\nBu fərqlilik ingilis dilinin fonetikasını öyrənməyi vacib edir.",
          "questions": [
            { "type": "multiple_choice", "question": "İngilis əlifbasında neçə hərf var?", "options": ["24", "26", "28", "30"], "answer": "26" },
            { "type": "multiple_choice", "question": "İngilis dilindəki 26 hərf neçə fərqli səsi ifadə edir?", "options": ["26", "33", "44", "52"], "answer": "44" },
            { "type": "fill_blank", "question": "İngilis dilində ___ hərf, lakin 44 fərqli səs var.", "answer": "26" },
            { "type": "fill_blank", "question": "'city' sözündə 'c' hərfi ___ kimi oxunur.", "answer": "s" },
            { "type": "true_false", "question": "İngilis dilindəki hərflərin sayı səslərin sayına bərabərdir.", "answer": false },
            { "type": "true_false", "question": "'th' birləşməsi həmişə eyni səsi verir.", "answer": false }
          ]
        },
        {
          "id": "fonetika-2",
          "title": "Oxunuş qaydaları",
          "lesson": "İngilis dilində hərflərin oxunuşu sözdəki mövqeyindən asılıdır.\n\nAçıq heca qaydası: Sait hərflə bitən hecada sait öz adı ilə oxunur.\n• make [meɪk] — 'a' öz adı ilə oxunur\n• bike [baɪk] — 'i' öz adı ilə oxunur\n\nQapalı heca qaydası: Samitlə bitən hecada sait qısa oxunur.\n• cat [kæt] — 'a' qısa oxunur\n• bit [bɪt] — 'i' qısa oxunur\n\nSusqun 'e': Sözün sonundakı 'e' adətən oxunmur, lakin əvvəlki saitin uzun oxunmasına səbəb olur.\n• game [ɡeɪm] — sondakı 'e' oxunmur\n• time [taɪm] — sondakı 'e' oxunmur",
          "questions": [
            { "type": "multiple_choice", "question": "'make' sözündə 'a' hərfi necə oxunur?", "options": ["Qısa [æ]", "Öz adı ilə [eɪ]", "Susqun", "Uzun [aː]"], "answer": "Öz adı ilə [eɪ]" },
            { "type": "multiple_choice", "question": "Hansı sözdə sondakı 'e' hərfi oxunmur?", "options": ["egg", "red", "game", "end"], "answer": "game" },
            { "type": "fill_blank", "question": "Sözün sonundakı susqun 'e' əvvəlki saitin ___ oxunmasına səbəb olur.", "answer": "uzun" },
            { "type": "fill_blank", "question": "'cat' sözündə 'a' hərfi ___ oxunur.", "answer": "qısa" },
            { "type": "true_false", "question": "'cat' sözündə 'a' hərfi öz adı ilə oxunur.", "answer": false },
            { "type": "true_false", "question": "'time' sözünün sonundakı 'e' hərfi oxunmur.", "answer": true }
          ]
        },
        {
          "id": "fonetika-3",
          "title": "Saitlər",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "fonetika-4",
          "title": "Samitlər",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "fonetika-5",
          "title": "Heca və Vurğu",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        }
      ]
    },
    {
      "id": "leksikologiya",
      "title": "LEKSİKOLOGİYA (Lexicology)",
      "nodes": [
        {
          "id": "leks-1",
          "title": "Sözün mənası",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "leks-2",
          "title": "Sinonimlər və Antonimlər",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "leks-3",
          "title": "Sözlərin quruluşu",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "leks-4",
          "title": "Phrasal Verbs",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "leks-5",
          "title": "Sözdüzəltmə (Word Formation)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        }
      ]
    },
    {
      "id": "morfologiya",
      "title": "MORFOLOGİYA (Morphology)",
      "nodes": [
        {
          "id": "morf-1",
          "title": "İsim (The Noun)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-2",
          "title": "Artikl (The Article)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-3",
          "title": "Sifət (The Adjective)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-4",
          "title": "Say (The Numeral)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-5",
          "title": "Əvəzlik (The Pronoun)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-6",
          "title": "Feil (The Verb)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "morf-7",
          "title": "Zərf, Ədat və Sözönü",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        }
      ]
    },
    {
      "id": "sintaksis",
      "title": "SİNTAKSİS (Syntax)",
      "nodes": [
        {
          "id": "sint-1",
          "title": "Collocations",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-2",
          "title": "Sadə cümlə",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-3",
          "title": "Xüsusi konstruksiyalar",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-4",
          "title": "Mürəkkəb cümlə",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-5",
          "title": "Budaq cümlələr",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-6",
          "title": "Şərt budaq cümlələri (Conditionals)",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        },
        {
          "id": "sint-7",
          "title": "Vasitəsiz və Vasitəli nitq",
          "lesson": "Dərs mətni əlavə ediləcək.",
          "questions": [
            { "type": "multiple_choice", "question": "Sual əlavə ediləcək.", "options": ["A", "B", "C", "D"], "answer": "A" },
            { "type": "fill_blank", "question": "Boşluq ___ doldurul.", "answer": "A" },
            { "type": "true_false", "question": "İddia əlavə ediləcək.", "answer": true }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

Open browser console and run:
```javascript
fetch('curriculum.json').then(r => r.json()).then(d => console.log('Sections:', d.sections.length))
```
Expected: `Sections: 4`

---

### Task 2: ingilisce.html

**Files:**
- Modify: `ingilisce.html`

- [ ] **Step 1: Replace ingilisce.html with full skeleton**

```html
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>İngiliscə Öyrən</title>
  <link rel="stylesheet" href="ingilisce.css">
</head>
<body>

  <header class="app-header">
    <h1 class="app-title">İngiliscə Öyrən</h1>
  </header>

  <main class="path-container" id="pathContainer"></main>

  <!-- Dərs Modalı -->
  <div class="modal-overlay hidden" id="lessonOverlay">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title" id="lessonTitle"></h2>
        <button class="modal-close" id="lessonClose">✕</button>
      </div>
      <div class="lives-bar" id="lessonLives"></div>
      <div class="modal-body" id="lessonBody"></div>
      <div class="modal-footer" id="lessonFooter"></div>
    </div>
  </div>

  <!-- Quiz Modalı -->
  <div class="modal-overlay hidden" id="quizOverlay">
    <div class="modal">
      <div class="modal-header">
        <span class="quiz-progress" id="quizProgress"></span>
        <button class="modal-close" id="quizClose">✕</button>
      </div>
      <div class="lives-bar" id="quizLives"></div>
      <div class="modal-body" id="quizBody"></div>
      <div class="modal-footer">
        <button class="btn-primary" id="quizCheck" disabled>Yoxla</button>
      </div>
    </div>
  </div>

  <!-- Uğur Bildirişi -->
  <div class="modal-overlay hidden" id="celebrationOverlay">
    <div class="modal celebration-modal">
      <div class="celebration-icon">🎉</div>
      <h2 id="celebrationTitle">Əla!</h2>
      <p id="celebrationText"></p>
      <button class="btn-primary" id="celebrationClose">Davam et</button>
    </div>
  </div>

  <!-- Can Bitdi -->
  <div class="modal-overlay hidden" id="failOverlay">
    <div class="modal celebration-modal">
      <div class="celebration-icon">💔</div>
      <h2>Canlar Bitdi</h2>
      <p>5 can yeniləndi. Dərsi yenidən oxu.</p>
      <button class="btn-primary" id="failClose">Yenidən başla</button>
    </div>
  </div>

  <script src="ingilisce.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open via Live Server. Expected: blue header "İngiliscə Öyrən", white background, no console errors.

---

### Task 3: ingilisce.css — Base + Path Layout

**Files:**
- Modify: `ingilisce.css`

- [ ] **Step 1: Replace ingilisce.css with base styles**

```css
:root {
  --blue: #1a73e8;
  --blue-dark: #0d47a1;
  --blue-light: #e8f0fe;
  --gray: #9e9e9e;
  --gray-light: #f5f5f5;
  --white: #ffffff;
  --text: #212121;
  --text-muted: #757575;
  --success: #34a853;
  --danger: #ea4335;
  --shadow: 0 2px 12px rgba(0,0,0,0.12);
  --radius: 16px;
  --node-size: 72px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #f0f4ff;
  color: var(--text);
  min-height: 100vh;
}

.app-header {
  background: var(--blue);
  color: var(--white);
  padding: 16px 24px;
  text-align: center;
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-title { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.5px; }

.path-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 16px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-title {
  background: var(--blue);
  color: var(--white);
  padding: 8px 24px;
  border-radius: 24px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 1px;
  margin: 24px 0 8px;
}

.path-line {
  width: 4px;
  height: 40px;
  background: var(--gray);
  border-radius: 2px;
}

.path-line.done { background: var(--blue); }

.node-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.node {
  width: var(--node-size);
  height: var(--node-size);
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.node-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
  max-width: 110px;
  margin-top: 6px;
  line-height: 1.3;
}

.node.locked {
  background: var(--gray-light);
  border-color: var(--gray);
  color: var(--gray);
  cursor: not-allowed;
}

.node.active {
  background: var(--white);
  border-color: var(--blue);
  color: var(--blue);
  box-shadow: 0 0 0 6px var(--blue-light), var(--shadow);
  animation: pulse 2s infinite;
}

.node.completed {
  background: var(--blue);
  border-color: var(--blue-dark);
  color: var(--white);
}

.node.active:hover { transform: scale(1.08); }
.node.completed:hover { transform: scale(1.05); background: var(--blue-dark); }

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 6px var(--blue-light), var(--shadow); }
  50%       { box-shadow: 0 0 0 14px rgba(26,115,232,0.12), var(--shadow); }
}

.hidden { display: none !important; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: var(--white);
  border-radius: var(--radius);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  border-bottom: 1px solid #eee;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  flex: 1;
  padding-right: 12px;
}

.quiz-progress { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }

.modal-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.modal-close:hover { background: var(--gray-light); }

.lives-bar {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  justify-content: center;
  font-size: 1.4rem;
}

.modal-body {
  padding: 20px;
  flex: 1;
  line-height: 1.7;
  font-size: 0.95rem;
  white-space: pre-wrap;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  background: var(--blue);
  color: var(--white);
  border: none;
  padding: 12px 28px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.btn-primary:hover { background: var(--blue-dark); }
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled { background: var(--gray); cursor: not-allowed; }

.quiz-question {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 20px;
  line-height: 1.5;
}

.quiz-options { display: flex; flex-direction: column; gap: 10px; }

.quiz-option {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
  background: var(--white);
  width: 100%;
}
.quiz-option:hover:not(:disabled) { border-color: var(--blue); background: var(--blue-light); }
.quiz-option.selected { border-color: var(--blue); background: var(--blue-light); }
.quiz-option.correct { border-color: var(--success); background: #e6f4ea; color: var(--success); font-weight: 600; }
.quiz-option.wrong   { border-color: var(--danger);  background: #fce8e6; color: var(--danger); }
.quiz-option:disabled { cursor: not-allowed; }

.fill-blank-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s;
  margin-top: 8px;
  font-family: inherit;
}
.fill-blank-input:focus   { border-color: var(--blue); }
.fill-blank-input.correct { border-color: var(--success); background: #e6f4ea; }
.fill-blank-input.wrong   { border-color: var(--danger);  background: #fce8e6; }

.celebration-modal {
  text-align: center;
  padding: 40px 20px;
  gap: 12px;
  align-items: center;
}
.celebration-icon { font-size: 3rem; margin-bottom: 8px; }
.celebration-modal h2 { font-size: 1.5rem; margin-bottom: 8px; }
.celebration-modal p  { color: var(--text-muted); margin-bottom: 20px; }

.feedback {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--white);
  z-index: 200;
  animation: fadeUp 0.3s ease;
  pointer-events: none;
}
.feedback.correct { background: var(--success); }
.feedback.wrong   { background: var(--danger); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 2: Verify in browser**

Refresh. Expected: sticky blue header, light blue page body, no console errors.

---

### Task 4: ingilisce.js — State + Path Rendering

**Files:**
- Modify: `ingilisce.js`

- [ ] **Step 1: Replace ingilisce.js with state management and path renderer**

```javascript
const STORAGE_KEY = 'ingilisce_progress';

const DEFAULT_STATE = {
  completedNodes: [],
  lives: 5,
  currentQuizNode: null
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getAllNodeIds(curriculum) {
  return curriculum.sections.flatMap(s => s.nodes.map(n => n.id));
}

function findNode(nodeId, curriculum) {
  for (const section of curriculum.sections) {
    const node = section.nodes.find(n => n.id === nodeId);
    if (node) return node;
  }
  return null;
}

function getNodeStatus(nodeId, allNodeIds, state) {
  if (state.completedNodes.includes(nodeId)) return 'completed';
  const firstIncomplete = allNodeIds.find(id => !state.completedNodes.includes(id));
  return nodeId === firstIncomplete ? 'active' : 'locked';
}

function renderPath(curriculum) {
  const state = loadState();
  const allNodeIds = getAllNodeIds(curriculum);
  const container = document.getElementById('pathContainer');
  container.innerHTML = '';

  curriculum.sections.forEach((section, si) => {
    const block = document.createElement('div');
    block.className = 'section-block';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title';
    titleEl.textContent = section.title;
    block.appendChild(titleEl);

    section.nodes.forEach((node, ni) => {
      const status = getNodeStatus(node.id, allNodeIds, state);

      if (si > 0 || ni > 0) {
        const line = document.createElement('div');
        line.className = 'path-line' + (status === 'completed' ? ' done' : '');
        block.appendChild(line);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'node-wrapper';

      const nodeEl = document.createElement('div');
      nodeEl.className = `node ${status}`;
      nodeEl.dataset.nodeId = node.id;
      nodeEl.textContent = status === 'locked' ? '🔒' : status === 'completed' ? '✅' : '📖';
      nodeEl.addEventListener('click', () => handleNodeClick(node.id, status, curriculum));

      const label = document.createElement('div');
      label.className = 'node-label';
      label.textContent = node.title;

      wrapper.appendChild(nodeEl);
      wrapper.appendChild(label);
      block.appendChild(wrapper);
    });

    container.appendChild(block);
  });
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function renderLives(containerId, lives) {
  const el = document.getElementById(containerId);
  el.innerHTML = Array.from({ length: 5 }, (_, i) => i < lives ? '❤️' : '🤍').join('');
}

async function init() {
  const res = await fetch('curriculum.json');
  const curriculum = await res.json();
  window.__curriculum = curriculum;
  renderPath(curriculum);
}

init();
```

- [ ] **Step 2: Verify in browser**

Refresh (via Live Server). Expected:
- 4 section headers (FONETİKA, LEKSİKOLOGİYA, MORFOLOGİYA, SİNTAKSİS) with blue pill style
- First node shows 📖 with blue pulsing border
- All other nodes show 🔒 in gray
- Node labels visible below each circle
- No console errors

---

### Task 5: ingilisce.js — Lesson Modal

**Files:**
- Modify: `ingilisce.js`

- [ ] **Step 1: Append lesson modal code to the END of ingilisce.js**

```javascript
function handleNodeClick(nodeId, status, curriculum) {
  if (status === 'locked') return;
  const isReview = status === 'completed';
  openLesson(nodeId, curriculum, isReview);
}

function openLesson(nodeId, curriculum, isReview) {
  const node = findNode(nodeId, curriculum);
  const state = loadState();

  document.getElementById('lessonTitle').textContent = node.title;
  document.getElementById('lessonBody').textContent = node.lesson;
  renderLives('lessonLives', state.lives);

  const footer = document.getElementById('lessonFooter');
  if (isReview) {
    footer.innerHTML = '';
  } else {
    footer.innerHTML = '<button class="btn-primary" id="lessonDone">Bitirdim →</button>';
    document.getElementById('lessonDone').addEventListener('click', () => {
      closeModal('lessonOverlay');
      startQuiz(nodeId, curriculum);
    });
  }

  document.getElementById('lessonClose').onclick = () => closeModal('lessonOverlay');
  openModal('lessonOverlay');
}
```

- [ ] **Step 2: Verify in browser**

Click the first node (📖). Expected:
- Modal opens with title "Səs və hərf sistemi"
- Lesson text visible with 5 ❤️
- "Bitirdim →" button visible
- ✕ closes the modal
- Clicking a 🔒 node does nothing

---

### Task 6: ingilisce.js — Quiz Engine

**Files:**
- Modify: `ingilisce.js`

- [ ] **Step 1: Append quiz engine to the END of ingilisce.js**

```javascript
let quizSession = null;

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function startQuiz(nodeId, curriculum) {
  const node = findNode(nodeId, curriculum);
  quizSession = {
    nodeId,
    curriculum,
    questions: shuffle(node.questions),
    currentIndex: 0
  };
  document.getElementById('quizClose').onclick = () => closeModal('quizOverlay');
  openModal('quizOverlay');
  renderQuestion();
}

function renderQuestion() {
  const { questions, currentIndex } = quizSession;
  const question = questions[currentIndex];
  const state = loadState();

  document.getElementById('quizProgress').textContent = `Sual ${currentIndex + 1}/${questions.length}`;
  renderLives('quizLives', state.lives);

  const body = document.getElementById('quizBody');
  body.innerHTML = '';
  const checkBtn = document.getElementById('quizCheck');
  checkBtn.disabled = true;
  checkBtn.onclick = checkAnswer;

  const qEl = document.createElement('p');
  qEl.className = 'quiz-question';
  qEl.textContent = question.question;
  body.appendChild(qEl);

  if (question.type === 'multiple_choice') {
    renderMCOptions(question, body);
  } else if (question.type === 'true_false') {
    renderTFOptions(body);
  } else if (question.type === 'fill_blank') {
    renderFillBlank(body, checkBtn);
  }
}

function renderMCOptions(question, body) {
  const container = document.createElement('div');
  container.className = 'quiz-options';
  question.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.addEventListener('click', () => selectOption(btn, opt, container));
    container.appendChild(btn);
  });
  body.appendChild(container);
}

function renderTFOptions(body) {
  const container = document.createElement('div');
  container.className = 'quiz-options';
  [{ label: 'Doğrudur ✓', value: 'true' }, { label: 'Yanlışdır ✗', value: 'false' }].forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.addEventListener('click', () => selectOption(btn, value, container));
    container.appendChild(btn);
  });
  body.appendChild(container);
}

function renderFillBlank(body, checkBtn) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'fill-blank-input';
  input.placeholder = 'Cavabınızı yazın...';
  input.dataset.fillInput = '1';
  input.addEventListener('input', () => {
    quizSession.selectedAnswer = input.value.trim();
    checkBtn.disabled = input.value.trim() === '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !checkBtn.disabled) checkAnswer();
  });
  body.appendChild(input);
  setTimeout(() => input.focus(), 50);
}

function selectOption(btn, value, container) {
  container.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  quizSession.selectedAnswer = value;
  document.getElementById('quizCheck').disabled = false;
}
```

- [ ] **Step 2: Verify in browser**

Click node → "Bitirdim →" → quiz opens. Expected:
- Progress "Sual 1/6" (or however many questions)
- Hearts visible
- MCQ shows 4 option buttons; clicking one highlights it and enables "Yoxla"
- True/False shows "Doğrudur ✓" and "Yanlışdır ✗"
- Fill-blank shows text input that auto-focuses

---

### Task 7: ingilisce.js — Answer Checking, Lives, Completion

**Files:**
- Modify: `ingilisce.js`

- [ ] **Step 1: Append answer checking and completion logic to the END of ingilisce.js**

```javascript
function normalizeAnswer(val) {
  return String(val).trim().toLowerCase();
}

function checkAnswer() {
  const { questions, currentIndex, selectedAnswer, nodeId, curriculum } = quizSession;
  const question = questions[currentIndex];

  const correctVal = question.type === 'true_false'
    ? String(question.answer)
    : String(question.answer);

  const isCorrect = normalizeAnswer(selectedAnswer) === normalizeAnswer(correctVal);

  disableQuizInputs();
  showVisualFeedback(question, isCorrect);
  showFeedbackToast(isCorrect);

  const state = loadState();
  if (!isCorrect) {
    state.lives -= 1;
    saveState(state);
    renderLives('quizLives', state.lives);
  }

  setTimeout(() => {
    if (!isCorrect && state.lives <= 0) {
      state.lives = 5;
      saveState(state);
      closeModal('quizOverlay');
      openModal('failOverlay');
      document.getElementById('failClose').onclick = () => {
        closeModal('failOverlay');
        openLesson(nodeId, curriculum, false);
      };
      renderPath(curriculum);
    } else {
      const next = currentIndex + 1;
      if (next >= questions.length) {
        completeNode(nodeId, curriculum);
      } else {
        quizSession.currentIndex = next;
        quizSession.selectedAnswer = null;
        renderQuestion();
      }
    }
  }, 1200);
}

function disableQuizInputs() {
  document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
  const input = document.querySelector('.fill-blank-input');
  if (input) input.disabled = true;
  document.getElementById('quizCheck').disabled = true;
}

function showVisualFeedback(question, isCorrect) {
  if (question.type === 'multiple_choice') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      if (normalizeAnswer(btn.dataset.value) === normalizeAnswer(question.answer)) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected') && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  } else if (question.type === 'true_false') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      if (btn.dataset.value === String(question.answer)) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected') && !isCorrect) {
        btn.classList.add('wrong');
      }
    });
  } else {
    const input = document.querySelector('.fill-blank-input');
    if (input) input.classList.add(isCorrect ? 'correct' : 'wrong');
  }
}

function showFeedbackToast(isCorrect) {
  const existing = document.querySelector('.feedback');
  if (existing) existing.remove();
  const fb = document.createElement('div');
  fb.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  fb.textContent = isCorrect ? '✓ Düzgün!' : '✗ Yanlış!';
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 1400);
}

function completeNode(nodeId, curriculum) {
  const state = loadState();
  if (!state.completedNodes.includes(nodeId)) {
    state.completedNodes.push(nodeId);
  }
  state.lives = 5;
  saveState(state);
  closeModal('quizOverlay');

  const allNodeIds = getAllNodeIds(curriculum);
  const hasNext = allNodeIds.indexOf(nodeId) < allNodeIds.length - 1;
  document.getElementById('celebrationTitle').textContent = 'Əla!';
  document.getElementById('celebrationText').textContent = hasNext
    ? 'Node tamamlandı! Növbəti mövzu açıldı.'
    : 'Bütün dərslər tamamlandı! 🎓';

  openModal('celebrationOverlay');
  document.getElementById('celebrationClose').onclick = () => {
    closeModal('celebrationOverlay');
    renderPath(curriculum);
  };
  renderPath(curriculum);
}
```

- [ ] **Step 2: Verify full flow in browser**

Test the complete journey:

1. Click active node → lesson opens ✓
2. Click "Bitirdim →" → quiz opens ✓
3. Answer correctly → green toast "✓ Düzgün!", correct option turns green, next question loads ✓
4. Answer incorrectly → red toast "✗ Yanlış!", one heart disappears ✓
5. Answer all questions → celebration modal opens, node turns ✅, next node becomes 📖 (active) ✓
6. Lose all 5 lives → "💔 Canlar Bitdi" modal, clicking button reopens the lesson ✓
7. Refresh page → completed nodes still show ✅, progress preserved ✓
8. Click completed ✅ node → lesson opens in read-only mode (no "Bitirdim" button) ✓
9. Click ✕ on quiz → modal closes, no lives lost, node stays active ✓
```
