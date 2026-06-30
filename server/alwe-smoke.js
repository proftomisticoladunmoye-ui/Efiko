// EFIKO ALWE — smoke test + size-budget gate. Validates EVERY bundled lesson in
// public/alwe against the schema and the <3 MB ceiling. Run: npm run alwe:smoke
// (Batch 1+ verification; CI gate in Batch 11). No network or API keys needed.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateLessonPackage, SIZE_TARGET_BYTES } from './core/alwe/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'public', 'alwe');

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
if (files.length === 0) { console.log('No ALWE lessons in public/alwe — nothing to check.'); process.exit(0); }

let failed = 0;
for (const file of files) {
  const pkg = JSON.parse(await readFile(join(DIR, file), 'utf8'));
  const { ok, errors, warnings, bytes } = validateLessonPackage(pkg);
  const scenes = pkg.scenes?.length ?? 0;
  const segs = (pkg.scenes || []).reduce((n, s) => n + (s.segments?.length || 0), 0);
  console.log(`\n${file}: ${pkg.manifest?.lessonId}`);
  console.log(`  scenes ${scenes} · voice segments ${segs} · JSON ${(bytes / 1024).toFixed(1)} KB (target < ${(SIZE_TARGET_BYTES / 1048576).toFixed(0)} MB)`);
  if (warnings.length) console.log('  warnings:\n   ' + warnings.join('\n   '));
  if (!ok) { console.error(`  ✗ INVALID:\n   ` + errors.join('\n   ')); failed += 1; }
  else console.log('  ✓ valid');
}

if (failed > 0) { console.error(`\n${failed} lesson(s) failed validation.`); process.exitCode = 1; }
else console.log(`\n✓ All ${files.length} lesson(s) valid and within budget.`);
