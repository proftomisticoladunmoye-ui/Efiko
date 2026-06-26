// Efiko — Voice Tutor: Azure Neural TTS adapter (Stage 6).
// REST call → Opus-in-Ogg audio. Chosen for native African-English neural voices
// (en-KE, en-NG, en-TZ, en-ZA) and native Opus output. No SDK needed (global fetch).
const key = () => (process.env.AZURE_SPEECH_KEY || '').trim();
const region = () => (process.env.AZURE_SPEECH_REGION || '').trim();
const voiceName = () => (process.env.EFIKO_TTS_VOICE || 'en-KE-AsiliaNeural').trim();

// Opus @ 24kHz mono — ~150–200 KB for a 40–60s note (meets the 100–250 KB budget).
const OUTPUT_FORMAT = 'ogg-24khz-16bit-mono-opus';

export function azureConfigured() {
  return Boolean(key() && region());
}

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const localeOf = (voice) => {
  const m = /^([a-z]{2}-[A-Z]{2})/.exec(voice);
  return m ? m[1] : 'en-US';
};

export async function synthesizeAzure(text) {
  if (!azureConfigured()) return null;
  const voice = voiceName();
  const locale = localeOf(voice);
  // Moderate, warm delivery: slightly slower than default for low-bandwidth clarity.
  const ssml =
    `<speak version='1.0' xml:lang='${locale}'>` +
    `<voice xml:lang='${locale}' name='${voice}'>` +
    `<prosody rate='-4%'>${xmlEscape(text)}</prosody>` +
    `</voice></speak>`;

  const res = await fetch(`https://${region()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key(),
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'Efiko-voice'
    },
    body: ssml
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Azure TTS ${res.status} ${detail.slice(0, 140)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, mime: 'audio/ogg', ext: 'ogg', sizeKB: Math.max(1, Math.round(audio.length / 1024)) };
}
