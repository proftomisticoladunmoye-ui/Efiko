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

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'content', 'originals');
mkdirSync(OUT, { recursive: true });

// Courses to generate this batch. Edit per batch toward the ~100-course library.
const SPECS = [
  { topic: 'Statistics for Research', audience: 'University students and researchers', hours: 6, level: 'Beginner' },
  { topic: 'SPSS for Data Analysis', audience: 'University students and researchers', hours: 5, level: 'Beginner' },
  { topic: 'Python for Research', audience: 'University students and researchers', hours: 6, level: 'Intermediate' },
  { topic: 'Data Visualization', audience: 'University students and professionals', hours: 4, level: 'Beginner' },
  { topic: 'Questionnaire Design', audience: 'University students and researchers', hours: 3, level: 'Beginner' }
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
