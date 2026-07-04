// EFIKO Originals — batch generator. Authors courses with the AI Course Generator and writes
// robust ones as committed seed files (server/content/originals/*.json), so the EFIKO-owned
// launch library ships with the platform. Run: node scripts/gen-originals.mjs
// Optional arg: a JSON file of specs; otherwise the built-in AI pathway is used.
import { loadEnv } from '../server/env.js';
loadEnv();
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCourse } from '../server/core/originals/generator.js';
import { getOriginal } from '../server/core/originals/store.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'content', 'originals');
mkdirSync(OUT, { recursive: true });

// New courses to generate (AI pathway). AI Literacy already exists in kv and is exported below.
const SPECS = [
  { topic: 'AI for Research', audience: 'University students and early researchers', hours: 5, level: 'Intermediate' },
  { topic: 'AI for Productivity', audience: 'Students and professionals', hours: 4, level: 'Beginner' },
  { topic: 'AI Ethics and Responsible Use', audience: 'University students', hours: 3, level: 'Beginner' }
];

// A course must clear this bar to be published as a seed.
function robustness(c) {
  const p = [];
  if (!c) return ['null'];
  if ((c.sessions || []).length < 4) p.push('sessions<4');
  if ((c.outcomes || []).length < 4) p.push('outcomes<4');
  if ((c.finalAssessment?.questions || []).length < 4) p.push('final<4');
  if ((c.preAssessment?.questions || []).length < 3) p.push('pre<3');
  if ((c.competencies || []).length < 3) p.push('comps<3');
  for (const s of (c.sessions || [])) {
    if (!s.voiceScript || s.voiceScript.length < 200) p.push(`${s.id}:voice`);
    if ((s.quiz || []).length < 3) p.push(`${s.id}:quiz`);
    if ((s.flashcards || []).length < 4) p.push(`${s.id}:cards`);
    if (!s.whiteboardSvg || !s.whiteboardSvg.includes('<svg')) p.push(`${s.id}:svg`);
    if (!s.text || s.text.length < 500) p.push(`${s.id}:text`);
    if (!(s.keyPoints || []).length) p.push(`${s.id}:keypoints`);
  }
  return p;
}

function save(c) {
  c.status = 'published';
  c.reviewedBy = 'operator';
  writeFileSync(join(OUT, `${c.courseId}.json`), JSON.stringify(c, null, 2), 'utf8');
}

// 1) Export the existing AI Literacy pilot from kv as a seed (no regeneration).
const ail = await getOriginal('orig-ai-literacy-essentials').catch(() => null);
if (ail) {
  const prob = robustness(ail);
  if (prob.length === 0) { save(ail); console.log(`bundled from kv: ${ail.courseId} (${ail.sessions.length} sessions)`); }
  else console.log(`AI Literacy in kv not robust (${prob.slice(0, 5).join(', ')}) — skipped`);
} else console.log('AI Literacy not found in kv — will not bundle');

// 2) Generate the new AI-pathway courses.
for (const spec of SPECS) {
  process.stdout.write(`generating "${spec.topic}"... `);
  try {
    const c = await generateCourse(spec);
    const prob = robustness(c);
    if (prob.length) { console.log(`SKIPPED (not robust: ${prob.slice(0, 6).join(', ')})`); continue; }
    save(c);
    console.log(`OK -> ${c.courseId} (${c.sessions.length} sessions, ${c.finalAssessment.questions.length} final Qs)`);
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}
console.log('done.');
