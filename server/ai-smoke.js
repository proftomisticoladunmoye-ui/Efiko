// Efiko — AI Processing Engine smoke test (Stage 5).
// Generates ONE real capsule with Claude and prints it. Requires ANTHROPIC_API_KEY
// in your .env (or environment). Run:  npm run ai:smoke  [-- "Your topic here"]
import { loadEnv } from './env.js';
loadEnv();
import { isConfigured, AUTHOR_MODEL } from './core/ai/client.js';
import { generateCapsule } from './core/ai/lessonGenerator.js';

if (!isConfigured()) {
  console.error('\n✗ ANTHROPIC_API_KEY is not set.');
  console.error('  Add your key to Efiko PWA/.env, then run: npm run ai:smoke\n');
  process.exit(1);
}

const topic = process.argv.slice(2).join(' ') || 'Explain ANOVA';
console.log(`\nGenerating a capsule with ${AUTHOR_MODEL} for: "${topic}" ...\n`);

const t0 = Date.now();
const capsule = await generateCapsule({ topic });
const secs = ((Date.now() - t0) / 1000).toFixed(1);

if (!capsule) {
  console.error('✗ No capsule returned (refusal or truncation).');
  process.exit(1);
}

const text = capsule.blocks.find((b) => b.type === 'text');
const wb = capsule.blocks.find((b) => b.type === 'whiteboard');
const quiz = capsule.blocks.find((b) => b.type === 'quiz');
const cards = capsule.blocks.find((b) => b.type === 'flashcards');
const summary = capsule.blocks.find((b) => b.type === 'summary');

console.log(`✓ Generated in ${secs}s · id=${capsule.capsuleId} · ~${capsule.totalSizeKB}KB\n`);
console.log(`TOPIC: ${capsule.meta.topic}  (level: ${capsule.meta.level || 'n/a'})\n`);
console.log('TEXT:\n' + text?.value + '\n');
console.log(`WHITEBOARD: ${wb?.caption}  (svg ~${wb?.sizeKB}KB, ${(wb?.inlineSvg || '').slice(0, 40)}...)\n`);
console.log('QUIZ:');
quiz?.items.forEach((it, i) => {
  console.log(`  ${i + 1}. ${it.q}`);
  it.options.forEach((o, oi) => console.log(`     ${oi === it.answer ? '✓' : ' '} ${String.fromCharCode(65 + oi)}. ${o}`));
});
console.log('\nFLASHCARDS:');
cards?.items.forEach((c) => console.log(`  • ${c.front} — ${c.back}`));
console.log('\nSUMMARY:\n' + summary?.value + '\n');

// Basic shape assertions so the smoke test actually fails on bad output.
const ok =
  text?.value &&
  (wb?.inlineSvg || '').includes('<svg') &&
  quiz?.items.length === 3 &&
  quiz.items.every((q) => q.options.length === 4 && q.answer >= 0 && q.answer < 4) &&
  cards?.items.length === 4 &&
  summary?.value;

console.log(ok ? '✓ Shape checks passed.\n' : '✗ Shape checks FAILED — inspect output above.\n');
// Set the code and let the event loop drain — calling process.exit() here races
// the SDK's keep-alive socket teardown and trips a libuv assertion on Windows.
process.exitCode = ok ? 0 : 1;
