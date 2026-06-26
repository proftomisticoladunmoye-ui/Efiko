// Efiko — Voice Tutor smoke test (Stage 6). Synthesizes a sample voice note and
// writes it to disk so you can listen. Requires AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
// in .env. Run:  npm run voice:smoke  [-- "Text to speak"]
import { writeFile } from 'node:fs/promises';
import { loadEnv } from './env.js';
loadEnv();
import { isConfigured, synthesize } from './core/voice/tts.js';

if (!isConfigured()) {
  console.error('\n✗ Voice not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.\n');
  process.exit(1);
}

const text =
  process.argv.slice(2).join(' ') ||
  'Hello, and welcome to Efiko. Today we look at one small idea, step by step, so you can learn even on a slow connection.';

console.log(`\nVoice: ${process.env.EFIKO_TTS_VOICE || 'en-KE-AsiliaNeural'}`);
console.log(`Synthesizing ${text.length} characters...\n`);

try {
  const t0 = Date.now();
  const out = await synthesize(text);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!out) {
    console.error('✗ No audio returned.');
    process.exitCode = 1;
  } else {
    const path = 'server/voice-sample.ogg';
    await writeFile(path, out.audio);
    console.log(`✓ ${out.sizeKB} KB ${out.mime} in ${secs}s → ${path}`);
    // Budget is an upper bound — smaller is better for low-data. Only flag oversize.
    console.log(out.sizeKB <= 300 ? '✓ Within data budget (≤ 300 KB).\n' : '⚠ Larger than the 250 KB target.\n');
  }
} catch (e) {
  console.error('✗ TTS failed:', e.message);
  process.exitCode = 1;
}
