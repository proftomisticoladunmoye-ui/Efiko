// Efiko core — universal course-code interpreter (Stage 1 §3.3).
// Detects: University · Course code · Topic. e.g. "KIU PSY720 IRT".
// The university token is 2–6 letters (so "Explain" — 7 — never false-matches),
// the course is letters+digits (PSY720, ECO110, ACC210), the rest is the topic.
const CODE_RE = /^([A-Za-z]{2,6})\s+([A-Za-z]{2,5}\s?\d{2,4})\s*(.*)$/;

export function parseCourseCode(text) {
  const m = (text || '').trim().match(CODE_RE);
  if (!m) return null;
  const [, uni, course, topic] = m;
  return {
    university: uni.toUpperCase(),
    course: course.replace(/\s+/g, '').toUpperCase(),
    topic: topic.trim(),
    raw: text.trim()
  };
}
