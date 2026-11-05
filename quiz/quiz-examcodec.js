'use strict';

// A published exam is kept in two pieces:
//   exam_index/<key>   public list entry: name, times, number of questions (see examMeta)
//   student_quiz/<key> the same plus `payload`, the questions scrambled with AES-GCM
// The scrambling is only there so the questions are not readable straight from the database or the network tab.
// The key is built from values in this script, so someone who reads the script can still undo it; the real
// gate is the database rule that keeps student_quiz closed until the exam opens.
const EXAM_CODEC_SECRET = 'qc-exam-payload-v1:7f3a91c2e84b';
const EXAM_CODEC_PREFIX = 'v1.';

function codecSubtle(){
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if(!c || !c.subtle) throw new Error('Bu brauzer şifrələməni dəstəkləmir (HTTPS səhifə tələb olunur).');
  return c;
}

function bytesToB64(bytes){
  let s = '';
  for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64){
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for(let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function codecKey(examKey, version){
  const c = codecSubtle();
  const seed = new TextEncoder().encode(`${EXAM_CODEC_SECRET}|${examKey}|${version}`);
  const hash = await c.subtle.digest('SHA-256', seed);
  return c.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encodeQuestions(list, examKey, version){
  const c = codecSubtle();
  const iv = c.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(list));
  const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, await codecKey(examKey, version), plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return EXAM_CODEC_PREFIX + bytesToB64(out);
}

async function decodeQuestions(payload, examKey, version){
  if(typeof payload !== 'string' || !payload.startsWith(EXAM_CODEC_PREFIX)) throw new Error('Sualların formatı tanınmadı.');
  const raw = b64ToBytes(payload.slice(EXAM_CODEC_PREFIX.length));
  const plain = await codecSubtle().subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, await codecKey(examKey, version), raw.subarray(12));
  const list = JSON.parse(new TextDecoder().decode(plain));
  if(!Array.isArray(list)) throw new Error('Sualların formatı tanınmadı.');
  return list;
}

// What the public list shows about an exam. Fields that are not set are left out: Firebase rejects undefined.
function examMeta(exam, qCount){
  const leave = Number(exam.leaveLimit);
  const m = {
    topic: exam.topic || '', examMinutes: Number(exam.examMinutes) || 30, leaveLimit: Number.isFinite(leave) && exam.leaveLimit != null ? leave : 3,
    publishedAt: Number(exam.publishedAt) || 0, qCount: Number(qCount) || 0
  };
  if(exam.opensAt) m.opensAt = exam.opensAt;
  if(exam.closesAt) m.closesAt = exam.closesAt;
  if(exam.oneAttempt === true) m.oneAttempt = true;
  return m;
}

// Exams published before this existed keep their questions as a plain list in student_quiz.
function legacyQuestionCount(exam){
  const q = exam && exam.questions;
  return Array.isArray(q) ? q.length : (q && typeof q === 'object' ? Object.keys(q).length : 0);
}

if(typeof module !== 'undefined') module.exports = { encodeQuestions, decodeQuestions, examMeta, legacyQuestionCount };
