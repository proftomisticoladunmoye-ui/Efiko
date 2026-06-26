// Efiko — Voice Tutor: Deepgram Aura TTS adapter (Stage 6).
// Single API key, native Opus output. REST call → Opus-in-Ogg audio (global fetch).
const key = () => (process.env.DEEPGRAM_API_KEY || '').trim();

// Aura voice model. Falls back to the default if a non-Aura value (e.g. a leftover
// Azure voice) is in EFIKO_TTS_VOICE, so switching providers is just one env flip.
const model = () => {
  const v = (process.env.EFIKO_TTS_VOICE || '').trim();
  return v.startsWith('aura') ? v : 'aura-asteria-en';
};

export function deepgramConfigured() {
  return Boolean(key());
}

export async function synthesizeDeepgram(text) {
  if (!deepgramConfigured()) return null;
  const params = new URLSearchParams({ model: model(), encoding: 'opus', container: 'ogg' });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Deepgram TTS ${res.status} ${detail.slice(0, 140)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, mime: 'audio/ogg', ext: 'ogg', sizeKB: Math.max(1, Math.round(audio.length / 1024)) };
}
