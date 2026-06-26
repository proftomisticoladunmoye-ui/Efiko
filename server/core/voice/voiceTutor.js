// Efiko — Voice Tutor (Stage 6). Derives a short spoken script from a capsule,
// synthesizes it once, and caches the Opus audio. Fills the VOICE placeholder
// across both channels. Generation is on-demand + cached, so cost stays near zero.
import { isConfigured, synthesize } from './tts.js';
import { getCapsule } from '../content.js';

const _cache = new Map(); // capsuleId -> { audio, mime, ext, sizeKB }

export { isConfigured };

/** What Efiko reads aloud: a dedicated voice script, else the lesson text, capped
 *  to keep the note in the 20–60s window (≈ ≤130 words). */
export function voiceScriptFor(capsule) {
  if (!capsule) return '';
  if (capsule.voiceScript) return capsule.voiceScript;
  const text = capsule.blocks?.find((b) => b.type === 'text')?.value;
  const summary = capsule.blocks?.find((b) => b.type === 'summary')?.value;
  let script = (text || summary || '').replace(/\s+/g, ' ').trim();
  const words = script.split(' ');
  if (words.length > 130) script = words.slice(0, 130).join(' ') + '.';
  return script;
}

/** Synthesize (and cache) the voice note for a capsule id. null if TTS off / unknown. */
export async function getVoiceAudio(capsuleId) {
  if (_cache.has(capsuleId)) return _cache.get(capsuleId);
  const capsule = await getCapsule(capsuleId);
  if (!capsule) return null;
  const script = voiceScriptFor(capsule);
  if (!script) return null;
  const audio = await synthesize(script);
  if (!audio) return null;
  _cache.set(capsuleId, audio);
  return audio;
}

/** Point a capsule's voice block at the gateway's /voice endpoint when TTS is on. */
export function attachVoice(capsule, base) {
  if (!capsule || !isConfigured()) return capsule;
  const v = capsule.blocks?.find((b) => b.type === 'voice');
  if (v) {
    v.src = `${base}/voice/${capsule.capsuleId}.ogg`;
    delete v.pending;
  }
  return capsule;
}
