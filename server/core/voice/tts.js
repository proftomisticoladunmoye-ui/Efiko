// Efiko — Voice Tutor: provider abstraction (Stage 6).
// Swappable like the WhatsApp transport. Azure today; Piper / Google / ElevenLabs
// can be added as adapters without touching the rest of the system. No provider
// configured → returns null, and voice stays a graceful "coming soon" placeholder.
import { synthesizeAzure, azureConfigured } from './azure.js';
import { synthesizeDeepgram, deepgramConfigured } from './deepgram.js';

const PROVIDER = (process.env.EFIKO_TTS_PROVIDER || 'deepgram').toLowerCase();

export function isConfigured() {
  if (PROVIDER === 'deepgram') return deepgramConfigured();
  if (PROVIDER === 'azure') return azureConfigured();
  return false;
}

/** text → { audio: Buffer, mime, ext, sizeKB } or null. */
export async function synthesize(text) {
  if (PROVIDER === 'deepgram') return synthesizeDeepgram(text);
  if (PROVIDER === 'azure') return synthesizeAzure(text);
  return null;
}
