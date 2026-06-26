// Efiko — SMS adapter (render). The 2G / feature-phone fallback: plain text only,
// no media, concise (every segment costs money + data). Consumes the SAME engine
// results as WhatsApp — one brain, a leaner mouth. Returns an array of plain strings.

// Strip WhatsApp markdown + the emoji we use elsewhere, and tidy whitespace.
const plain = (s) =>
  String(s || '')
    .replace(/\*/g, '')
    .replace(/[✅❌🔊🖊🎉👍📚✦]/gu, '')
    .replace(/️/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const block = (capsule, type) => capsule.blocks.find((b) => b.type === type);

// Split long text into ~320-char SMS-friendly chunks on line/space boundaries.
function segment(text, limit = 320) {
  if (text.length <= limit) return [text];
  const out = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(' ', limit);
    if (cut < 1) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

const fb = (f) =>
  !f ? '' : f.correct ? 'Correct!\n\n' : `Wrong. Answer: ${String.fromCharCode(65 + f.answerIndex)}. ${f.answerText}\n\n`;

function smsMenu() {
  return [plain(
`EFIKO — learn by SMS
Reply with:
- A topic, e.g. Explain GDP
- A course code, e.g. KIU PSY720 IRT
- QUIZ to test yourself
- HELP`)];
}

function smsHelp() {
  return [plain(
`EFIKO help
Send a topic (e.g. Explain GDP) or a course code (e.g. KIU PSY720 IRT).
Then reply QUIZ, FLASHCARDS or SUMMARY. MENU anytime.`)];
}

function smsCapsule(result) {
  const c = result.capsule;
  const m = c.meta;
  // SMS gets the concise summary (not the full text) to save segments.
  const body = block(c, 'summary')?.value || block(c, 'text')?.value || '';
  const head = `${m.topic.toUpperCase()}${m.course ? ` (${m.university} ${m.course})` : ''}`;
  return segment(plain(`${head}\n\n${body}\n\nReply QUIZ to practice, or MENU.`));
}

function smsSection(section, capsule) {
  if (section === 'summary') {
    return segment(plain(`${capsule.meta.topic} — summary\n\n${block(capsule, 'summary')?.value}`));
  }
  if (section === 'flashcards') {
    let body = `${capsule.meta.topic} — flashcards\n`;
    block(capsule, 'flashcards').items.forEach((card) => { body += `\n- ${card.front}: ${card.back}`; });
    return segment(plain(body));
  }
  if (section === 'voice') {
    return [plain('Voice notes need the app or WhatsApp. On SMS, reply SUMMARY for a recap.')];
  }
  return [plain('Not available on SMS.')];
}

function smsQuizQ(result) {
  let body = fb(result.feedback);
  body += `Q${result.number}/${result.total}: ${result.item.q}\n`;
  result.item.options.forEach((o, i) => { body += `${String.fromCharCode(65 + i)}. ${o}\n`; });
  body += 'Reply A-D.';
  return segment(plain(body));
}

function smsQuizDone(result) {
  const body = fb(result.feedback) + `Quiz done: ${result.score}/${result.total}. Reply MENU, or QUIZ to retry.`;
  return segment(plain(body));
}

export function renderSms(result) {
  switch (result.kind) {
    case 'menu':     return smsMenu();
    case 'help':     return smsHelp();
    case 'capsule':  return smsCapsule(result);
    case 'section':  return smsSection(result.section, result.capsule);
    case 'quizq':    return smsQuizQ(result);
    case 'quizdone': return smsQuizDone(result);
    case 'text':     return segment(plain(result.text));
    case 'notfound':
    default:
      return [plain(`No lesson for "${result.detected?.raw || result.detected?.topic || 'that'}" yet. Try: Explain GDP, or KIU PSY720 IRT. MENU for options.`)];
  }
}
