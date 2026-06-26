// Efiko — WhatsApp adapter (render). Turns a format-neutral engine result into
// WhatsApp messages. This is the ONLY place that knows WhatsApp formatting; it holds
// no teaching logic (Stage 1 §3.1). Output is a list of { type:'text'|'image'|'audio' }.
import { enforceBudget } from '../../core/budget.js';

const FOOTER = 'Reply *QUIZ*, *VOICE*, *FLASHCARDS* or *MENU*.';

const block = (capsule, type) => capsule.blocks.find((b) => b.type === type);

export function renderMenu() {
  return [{
    type: 'text',
    body:
`*Welcome to Efiko*

1. Explain Topic
2. Snap & Learn
3. Practice Quiz
4. My Courses
5. Download Lesson
6. Flashcards
7. Voice Lesson
8. Help

Send a course code like *KIU PSY720 IRT*, or *Explain GDP*. You can type *QUIZ*, *VOICE* or *FLASHCARDS* anytime.`
  }];
}

export function renderHelp() {
  return [{
    type: 'text',
    body:
`*Efiko Help*

Send any of:
• A course code — *KIU PSY720 IRT*
• *Explain <topic>* — e.g. Explain GDP
• *QUIZ*, *VOICE*, *FLASHCARDS*, *SUMMARY* for the current lesson
• *MENU* anytime`
  }];
}

export function renderCapsule(result, baseUrl = '') {
  const { capsule, detected } = result;
  const m = capsule.meta;
  const messages = [];

  let head = `*${m.topic}*\n${m.university} · ${m.course} · Capsule ${m.sequence} · ${m.durationMin} min`;
  if (detected?.universityName) head += `\n_${detected.universityName}_`;
  if (capsule.generated) head += `\n_✦ generated for you by Efiko AI_`;
  messages.push({ type: 'text', body: `${head}\n\n${block(capsule, 'text')?.value || ''}` });

  const wb = block(capsule, 'whiteboard');
  if (wb?.src) {
    messages.push({ type: 'image', link: baseUrl + wb.src, caption: wb.caption });
  } else if (wb?.caption) {
    // AI capsules carry an inline SVG (no hosted URL) — convey the figure in words.
    messages.push({ type: 'text', body: `🖊️ Whiteboard — ${wb.caption}` });
  }

  const voice = block(capsule, 'voice');
  if (voice?.src) messages.push({ type: 'audio', link: voice.src });
  else if (voice?.pending) messages.push({ type: 'text', body: `🔊 Voice note: coming in ${voice.pending}.` });

  messages.push({ type: 'text', body: FOOTER });
  return messages;
}

function renderQuiz(capsule) {
  const quiz = block(capsule, 'quiz');
  let body = `*Practice Quiz — ${capsule.meta.topic}*\n`;
  quiz.items.forEach((it, i) => {
    body += `\n${i + 1}. ${it.q}\n`;
    it.options.forEach((o, oi) => { body += `   ${String.fromCharCode(65 + oi)}. ${o}\n`; });
  });
  body += `\n_Answers:_ ` + quiz.items.map((it, i) => `${i + 1}${String.fromCharCode(65 + it.answer)}`).join(', ');
  return [{ type: 'text', body }];
}

function renderFlashcards(capsule) {
  const fc = block(capsule, 'flashcards');
  let body = `*Flashcards — ${capsule.meta.topic}*\n`;
  fc.items.forEach((c) => { body += `\n• *${c.front}* — ${c.back}`; });
  return [{ type: 'text', body }];
}

function renderSection(section, capsule) {
  if (section === 'quiz') return renderQuiz(capsule);
  if (section === 'flashcards') return renderFlashcards(capsule);
  if (section === 'summary') {
    return [{ type: 'text', body: `*Summary — ${capsule.meta.topic}*\n\n${block(capsule, 'summary')?.value}` }];
  }
  if (section === 'voice') {
    const v = block(capsule, 'voice');
    if (v?.src) return [{ type: 'audio', link: v.src }];
    return [{ type: 'text', body: `🔊 Voice note: coming in ${v?.pending}.` }];
  }
  return [{ type: 'text', body: 'Not available.' }];
}

function renderNotFound(detected) {
  const what = detected?.raw || detected?.topic || 'that';
  return [{
    type: 'text',
    body:
`I don't have a lesson for *${what}* yet.

Try *KIU PSY720 IRT*, *MAK ECO110 GDP*, or *Explain GDP*.
_(AI-generated lessons for any topic arrive in a later release.)_
Reply *MENU* for options.`
  }];
}

// --- Quiz Engine (Stage 9) ---
function feedbackLine(fb) {
  if (!fb) return '';
  if (fb.correct) return '✅ Correct!\n\n';
  return `❌ Not quite — the answer was *${String.fromCharCode(65 + fb.answerIndex)}. ${fb.answerText}*.\n\n`;
}

function renderQuizQuestion(result) {
  let body = feedbackLine(result.feedback);
  body += `*Question ${result.number} of ${result.total}*\n${result.item.q}\n`;
  result.item.options.forEach((o, i) => { body += `   ${String.fromCharCode(65 + i)}. ${o}\n`; });
  body += `\nReply *A*, *B*, *C* or *D*.`;
  return [{ type: 'text', body }];
}

function renderQuizDone(result) {
  const pct = Math.round((result.score / result.total) * 100);
  const mark = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚';
  let body = feedbackLine(result.feedback);
  body += `*Quiz complete — ${result.topic}*\nYou scored *${result.score}/${result.total}* (${pct}%) ${mark}\n\n`;
  body += pct >= 80 ? 'Excellent work!' : 'Reply *FLASHCARDS* to revise, then try *QUIZ* again.';
  return [{ type: 'text', body }];
}

/** Map an engine result → WhatsApp messages, then enforce the data budget. */
export function renderResult(result, baseUrl = '') {
  let messages;
  switch (result.kind) {
    case 'menu':     messages = renderMenu(); break;
    case 'help':     messages = renderHelp(); break;
    case 'capsule':  messages = renderCapsule(result, baseUrl); break;
    case 'section':  messages = renderSection(result.section, result.capsule); break;
    case 'quizq':    messages = renderQuizQuestion(result); break;
    case 'quizdone': messages = renderQuizDone(result); break;
    case 'text':     messages = [{ type: 'text', body: result.text }]; break;
    case 'notfound':
    default:         messages = renderNotFound(result.detected); break;
  }
  return enforceBudget(messages);
}
