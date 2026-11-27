---
version: 1
slug: "ingilisce-html"
primary_target: "ingilisce.html"
related_targets: ["admin.html"]
---

# İngiliscə Öyrən: learner app and admin

Scope: ingilisce.html (learner) and admin.html. Mode: Operate.
Audience: adults studying English grammar alone, in Azerbaijani, mostly in short sessions.
Job: find the next topic, read or listen, answer, move on. Admin publishes lesson text, audio and quizzes without touching files.
Constraints: keep the single locked path, 5 lives, daily streak, existing accounts and progress ids. Topics without content stay hidden. Static HTML/CSS/JS plus Supabase.

## Direction contract

THESIS: The course reads as a trusted learner's dictionary: every topic is an entry on a numbered path. Refuses the candy-circle language-app map.
OWN-WORLD: white page, deep blue #12357a head band and index, red #c0262c only for the current entry and pronunciation-style accents, pale blue #eef3fd selection; Source Serif 4 headwords, Source Sans 3 interface; a thumb index of section tabs on the page edge; thin rules, small radii.
STORY: the learner sees which section and entry they are on, presses one button to start, gets an immediate verdict with the right answer, and returns to a path that moved.
FIRST VIEWPORT: blue top bar with name and navigation; thumb index at left, current tab pulled out; section headword with English term; numbered entries joined by a thin line, current one raised with "Dərsə başla"; streak, lives and practice at right (above the path on phones).
FORM: learner's dictionary, user-chosen from the safer register. seed:a3b2bde04a9b7704
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
