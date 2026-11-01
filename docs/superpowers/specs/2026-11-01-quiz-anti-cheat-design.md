# Quiz anti-cheat monitoring

Files: `quiz/quiz-student.js`, `quiz/quiz-student.html`, `quiz/quiz-az.js` (teacher), `quiz/quiz-az.html`.

## Goal

Let the teacher see whether students left the exam page, and end the exam automatically when they leave too often.

## Student flow

1. **Lobby disclaimer** (shown above the name field, in Azerbaijani like the rest of the UI):
   "Diqqət: Bu səhifədən çıxmaq (başqa tab, pəncərə) qeydə alınır. {N} dəfə çıxsanız və ya brauzeri bağlasanız, imtahan avtomatik göndəriləcək."
   `{N}` is the exam's leave limit. If the limit is 0, no disclaimer or monitoring.
2. **During the exam**, each time the page loses focus (`visibilitychange` hidden, or window `blur`; de-duplicated so one switch counts once):
   - record an event `{type:'leave', t: secondsSinceStart}`
   - on return, show a blocking warning "Xəbərdarlıq {k}/{N}: imtahan səhifəsini tərk etdiniz" that the student must dismiss
   - add the away time to the running total
3. **At k = N**: call `finishQuiz()` with `autoSubmitted = true` and `autoReason = 'leaves'`. The results screen shows a line explaining why.
4. **Paste / copy**: `paste` into answer inputs is blocked and logged (`{type:'paste'}`); `copy`, `cut` and `contextmenu` on the question text are blocked and logged. These do not count toward the limit.

## Closing the browser

Progress is saved on every answer and every event, not only at the end. Each attempt has a client-generated `attemptId` and one record at `analytics/<examKey>/<attemptId>` with `status: 'in_progress'`. `finishQuiz()` updates the same record to `status: 'done'`.

If the student closes the browser, the record stays `in_progress` with the score from the answers saved so far. The teacher sees it as "closed browser". A best-effort save also runs on `pagehide`.

## Data (extends the existing record)

`studentName, topic, timestamp, totalQuestions, correct, wrong, unanswered, score, maxScore, pct, timeUsed` (unchanged) plus:

- `attemptId`, `status` (`in_progress` | `done`)
- `tabSwitches`, `timeAway` (seconds), `pastes`
- `autoSubmitted` (bool), `autoReason` (`leaves` | absent)
- `events`: `[{type, t}]`, capped at 100 entries

## Teacher side

- Publish settings: new number field "Çıxış limiti" next to the exam minutes, default 3, 0 disables. Stored in `student_quiz/<key>.leaveLimit`. The student page reads it with the exam; exams without the field use 3.
- Analytics tab: new columns "Çıxışlar" (`tabSwitches`, `timeAway`) and a status badge. Red for `autoSubmitted`, orange for `in_progress` (closed browser), yellow for any leaves, none otherwise. Rows can be sorted by leaves.

## Limits (stated to the teacher, not fixed here)

- Everything runs in the student's browser, so a second device or a determined student can get around it. The flags are signals to review, not proof.
- Phone calls and notifications can trigger a leave.
- Firebase rules are not changed, so a student could tamper with their own record.

## Out of scope

Camera or screen monitoring, fullscreen enforcement, server-side validation, changes to Firebase database rules.

## Testing

Manual in the browser: leave and return (counter and warning), reach the limit (auto-submit and flag), paste and copy blocking, close the tab mid-exam (record stays `in_progress` with partial score), limit 0 (no disclaimer or monitoring), teacher view columns and sorting, old records without the new fields still render.
