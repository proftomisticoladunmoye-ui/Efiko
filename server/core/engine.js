// Efiko core — the brain. Channel-agnostic: it returns a format-neutral result
// that any adapter (WhatsApp, SMS, PWA) renders. No teaching logic lives in channels
// (Stage 1 §3.1). The engine classifies intent, resolves a capsule, and tracks a
// per-user session (current lesson) so QUIZ / VOICE / FLASHCARDS have context.
import { getCatalog, getCapsule, registerCapsule } from './content.js';
import { UNIVERSITIES, TOPIC_ALIASES } from './registry.js';
import { parseCourseCode } from './courseCode.js';
import { generateCapsule, isConfigured as aiConfigured } from './ai/lessonGenerator.js';

// Try the AI Processing Engine (Stage 5). Returns a registered capsule, or null so
// the caller can fall back to the graceful "not found" message.
async function tryGenerate(args) {
  if (!aiConfigured()) return null;
  try {
    const capsule = await generateCapsule(args);
    if (capsule) return registerCapsule(capsule);
  } catch (e) {
    console.error('AI generation failed:', e.message);
  }
  return null;
}

// QUIZ is handled by the interactive Quiz Engine (Stage 9), not as a one-shot section.
const SECTION_KEYWORDS = { VOICE: 'voice', FLASHCARDS: 'flashcards', SUMMARY: 'summary' };
const GREETINGS = new Set(['MENU', 'HI', 'HELLO', 'START', '0']);
const ANSWER_RE = /^[A-Da-d1-4]$/;

const letterToIndex = (s) => {
  const u = s.trim().toUpperCase();
  return /[A-D]/.test(u) ? u.charCodeAt(0) - 65 : parseInt(u, 10) - 1;
};

export function createSession(userId) {
  return { userId, currentCapsuleId: null, quiz: null, createdAt: Date.now() };
}

// --- Quiz Engine (Stage 9): step-by-step, scored ---
function startQuiz(session, capsule) {
  const quiz = capsule?.blocks.find((b) => b.type === 'quiz');
  if (!quiz?.items?.length) return { kind: 'text', text: 'This lesson has no quiz yet.' };
  session.quiz = { capsuleId: capsule.capsuleId, index: 0, score: 0, total: quiz.items.length, topic: capsule.meta.topic };
  return { kind: 'quizq', item: quiz.items[0], number: 1, total: quiz.items.length };
}

async function gradeQuizAnswer(session, picked) {
  const capsule = await getCapsule(session.quiz.capsuleId);
  const quiz = capsule.blocks.find((b) => b.type === 'quiz');
  const item = quiz.items[session.quiz.index];
  const correct = picked === item.answer;
  if (correct) session.quiz.score++;
  const feedback = { correct, answerIndex: item.answer, answerText: item.options[item.answer] };

  session.quiz.index++;
  if (session.quiz.index >= session.quiz.total) {
    const done = { kind: 'quizdone', feedback, score: session.quiz.score, total: session.quiz.total, topic: session.quiz.topic };
    session.quiz = null;
    return done;
  }
  return { kind: 'quizq', feedback, item: quiz.items[session.quiz.index], number: session.quiz.index + 1, total: session.quiz.total };
}

function aliasMatch(capsuleId, topicLower, catalogTopic) {
  const aliases = TOPIC_ALIASES[capsuleId] || [];
  return aliases.some((a) => topicLower.includes(a)) ||
    catalogTopic.toLowerCase().includes(topicLower);
}

async function resolveByCourse({ course, topic }) {
  const catalog = await getCatalog();
  const candidates = catalog.capsules.filter((c) => c.course.toUpperCase() === course.toUpperCase());
  if (candidates.length === 0) return null;
  const t = (topic || '').toLowerCase();
  if (t) {
    const hit = candidates.find((c) => aliasMatch(c.capsuleId, t, c.topic));
    if (hit) return hit.capsuleId;
  }
  return [...candidates].sort((a, b) => a.sequence - b.sequence)[0].capsuleId;
}

async function resolveByTopic(topic) {
  const catalog = await getCatalog();
  const t = (topic || '').toLowerCase().trim();
  if (!t) return null;
  const hit = catalog.capsules.find((c) => aliasMatch(c.capsuleId, t, c.topic));
  return hit ? hit.capsuleId : null;
}

/**
 * Handle one inbound message. Mutates `session` (current lesson) and returns:
 *   { kind: 'menu' | 'help' | 'capsule' | 'section' | 'text' | 'notfound', ... }
 */
export async function handle(session, rawText) {
  const text = (rawText || '').trim();
  const upper = text.toUpperCase();

  if (GREETINGS.has(upper)) { session.quiz = null; return { kind: 'menu' }; }
  if (upper === 'HELP' || upper === '8') { session.quiz = null; return { kind: 'help' }; }

  // Active quiz: an A–D / 1–4 reply is a quiz answer.
  if (session.quiz && ANSWER_RE.test(text)) {
    return gradeQuizAnswer(session, letterToIndex(text));
  }
  session.quiz = null; // any other input exits an active quiz

  // Start the interactive quiz for the current lesson.
  if (upper === 'QUIZ') {
    if (!session.currentCapsuleId) {
      return { kind: 'text', text: 'Send a topic first — e.g. *KIU PSY720 IRT* or *Explain GDP* — then reply *QUIZ*.' };
    }
    return startQuiz(session, await getCapsule(session.currentCapsuleId));
  }

  // Section keywords need a current lesson in the session.
  if (SECTION_KEYWORDS[upper]) {
    if (!session.currentCapsuleId) {
      return { kind: 'text', text: `Send a topic first — e.g. *KIU PSY720 IRT* or *Explain GDP* — then reply *${upper}*.` };
    }
    const capsule = await getCapsule(session.currentCapsuleId);
    return { kind: 'section', section: SECTION_KEYWORDS[upper], capsule };
  }

  // Course code: "KIU PSY720 IRT"
  const cc = parseCourseCode(text);
  if (cc && UNIVERSITIES[cc.university]) {
    const detected = { ...cc, universityName: UNIVERSITIES[cc.university] };
    const id = await resolveByCourse(cc);
    if (id) {
      session.currentCapsuleId = id;
      return { kind: 'capsule', capsule: await getCapsule(id), detected };
    }
    // Not in the catalog — let the AI Processing Engine author it.
    const ai = await tryGenerate({ university: detected.universityName, course: cc.course, topic: cc.topic });
    if (ai) {
      session.currentCapsuleId = ai.capsuleId;
      return { kind: 'capsule', capsule: ai, detected, generated: true };
    }
    return { kind: 'notfound', detected: cc };
  }

  // "Explain <topic>" or a bare topic.
  const explain = /^explain\s+(.*)/i.exec(text);
  const topic = explain ? explain[1] : text;
  const id = await resolveByTopic(topic);
  if (id) {
    session.currentCapsuleId = id;
    return { kind: 'capsule', capsule: await getCapsule(id) };
  }
  // Nothing catalogued — generate on demand.
  const ai = await tryGenerate({ topic });
  if (ai) {
    session.currentCapsuleId = ai.capsuleId;
    return { kind: 'capsule', capsule: ai, generated: true };
  }

  return { kind: 'notfound', detected: { topic } };
}
