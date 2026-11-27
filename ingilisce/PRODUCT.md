# Product

<!-- impeccable:product-schema 1 -->

Scope: the `ingilisce/` app only. Other apps in this repository are separate products.

## Platform

web

## Users

Adults learning English on their own, in Azerbaijani, who find the site and study without a teacher. One administrator, the site owner, writes the content.

## Product Purpose

A self-study English grammar course. A learner reads (and sometimes listens to) a short lesson, answers a few questions, and unlocks the next topic. Separate review quizzes and a word game give extra practice. Success is a learner coming back and moving further along the course.

## Positioning

Grammar explained in Azerbaijani, in one fixed order from phonetics onwards, written by the person who runs the site.

## Operating Context

- Learner: signs up with a name and password, studies in short sessions, resumes where they stopped.
- Administrator: adds review questions (one at a time or pasted from a spreadsheet) and vocabulary words, and needs to add lesson text, audio and lesson quizzes from the admin page without editing files in the repository.

## Capabilities and Constraints

- Static site on GitHub Pages: plain HTML, CSS and JavaScript, no build step. Supabase provides sign-in, data and access rules.
- Interface language is Azerbaijani. Lesson content mixes Azerbaijani and English.
- The course is a single path: topics unlock in order. Five lives, reset daily and after running out. A streak counts study days.
- Lesson question types: multiple choice, true/false, fill the blank.
- The course outline has 150 topics; at the time of the redesign 22 had lesson text. Topics without content are hidden from learners until the administrator writes them.
- A SAT curriculum file (`sat_curriculum.json`) is kept in the repository but the app does not load it; its mode switch was never exposed.
- Existing accounts and saved progress (keyed by topic id) must keep working.
- Decided: the boy/girl avatar choice is removed; learners are shown by name or initial.

## Brand Commitments

The name "İngiliscə Öyrən" and the Azerbaijani interface. Nothing else from the current look has to carry over.

## Evidence on Hand

Real lesson text and questions in `ingilisce/curriculum.json` and `ingilisce/sat_curriculum.json`; five audio recordings in `ingilisce/audio/`. No testimonials, user numbers or results claims.

## Product Principles

1. The learner can always see where they are and what comes next.
2. Lessons are for reading and listening; long text must be comfortable on a phone.
3. Practice gives an immediate, clear verdict and shows the right answer.
4. Publishing content never requires editing files.
5. Never present a topic that has nothing in it.
