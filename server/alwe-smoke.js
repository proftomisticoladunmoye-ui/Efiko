// EFIKO ALWE — smoke test: validate the bundled sample lesson against the schema.
// Run: npm run alwe:smoke   (Batch 1 verification; no network, no API keys needed.)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateLessonPackage, SIZE_TARGET_BYTES } from './core/alwe/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(HERE, '..', 'public', 'alwe', 'kiu-psy720-irt-alwe.json');

const pkg = JSON.parse(await readFile(SAMPLE, 'utf8'));
const { ok, errors, warnings, bytes } = validateLessonPackage(pkg);

const sceneCount = pkg.scenes.length;
const segCount = pkg.scenes.reduce((n, s) => n + s.segments.length, 0);
const objCount = pkg.scenes.reduce((n, s) => n + s.objects.length, 0);

console.log(`Lesson: ${pkg.manifest.lessonId}`);
console.log(`Arc nodes: ${pkg.manifest.arc.length} · scenes: ${sceneCount} · objects: ${objCount} · voice segments: ${segCount}`);
console.log(`JSON size: ${(bytes / 1024).toFixed(1)} KB (target < ${(SIZE_TARGET_BYTES / 1048576).toFixed(0)} MB)`);
if (warnings.length) console.log('Warnings:\n  ' + warnings.join('\n  '));

if (!ok) {
  console.error(`\n✗ INVALID — ${errors.length} error(s):\n  ` + errors.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('\n✓ Sample lesson is schema-valid.');
}
