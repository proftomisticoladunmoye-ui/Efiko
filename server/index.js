// Efiko Gateway (Stage 1 §3.2) — the single front door.
// Endpoints:
//   GET  /webhook  — WhatsApp Cloud API verification handshake
//   POST /webhook  — inbound WhatsApp messages → core → reply via transport
//   POST /sim      — local simulator: { from, text } → rendered reply (no Meta needed)
//   GET  /health   — liveness + whether live WhatsApp creds are configured
import { createServer } from 'node:http';
import { loadEnv } from './env.js';
loadEnv();
import { createSession, handle } from './core/engine.js';
import { renderResult } from './channels/whatsapp/render.js';
import { sendMessages, isLive } from './channels/whatsapp/transport.js';
import { generateCapsule, generateFromImage, isConfigured as aiConfigured } from './core/ai/lessonGenerator.js';
import { registerCapsule } from './core/content.js';
import { getVoiceAudio, attachVoice, isConfigured as voiceConfigured } from './core/voice/voiceTutor.js';
import { fetchMediaBase64 } from './channels/whatsapp/transport.js';
import { renderSms } from './channels/sms/render.js';
import { sendSms, smsLive } from './channels/sms/transport.js';
import { addPublished, getPublished, listPublished } from './core/published.js';

const PORT = process.env.PORT || 4100;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'Efiko-verify';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';

// In-memory sessions (per phone number). Persistence comes in a later stage.
const sessions = new Map();
const sessionFor = (id) => {
  if (!sessions.has(id)) sessions.set(id, createSession(id));
  return sessions.get(id);
};

// Public base used for voice-note URLs (WhatsApp needs a reachable URL; for the PWA
// the browser hits the gateway directly). Falls back to the request host.
const selfBase = (req) => PUBLIC_BASE_URL || `http://${req.headers.host}`;

// Snap & Learn over WhatsApp: download the photo, read it with Claude vision.
async function handleSnap(from, image, caption) {
  if (!aiConfigured()) return { kind: 'text', text: 'Snap & Learn isn’t available right now.' };
  try {
    const media = await fetchMediaBase64(image.id);
    if (!media) {
      return { kind: 'text', text: '📸 I received your photo. Snap & Learn activates once WhatsApp is connected live.' };
    }
    const capsule = await generateFromImage({ imageBase64: media.base64, mediaType: media.mime, hint: caption });
    if (!capsule) return { kind: 'text', text: 'I couldn’t read that photo clearly. Try a sharper, well-lit picture.' };
    registerCapsule(capsule);
    sessionFor(from).currentCapsuleId = capsule.capsuleId;
    return { kind: 'capsule', capsule, generated: true };
  } catch {
    return { kind: 'text', text: 'Sorry — I had trouble reading that photo. Please try again.' };
  }
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

// SMS providers post either JSON or form-urlencoded. Parse whichever we get and
// normalise the sender + text fields across Africa's Talking / Twilio shapes.
function readSmsInbound(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      let obj = {};
      try { obj = data ? JSON.parse(data) : {}; }
      catch { obj = Object.fromEntries(new URLSearchParams(data)); }
      const from = obj.from || obj.From || obj.msisdn || obj.sender;
      const text = obj.text || obj.Body || obj.message || obj.content || '';
      resolve({ from, text });
    });
  });
}

// Parse the WhatsApp Cloud API inbound shape into simple { from, text } messages.
function extractInbound(body) {
  const out = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        if (msg.type === 'image' && msg.image?.id) {
          out.push({ from: msg.from, image: { id: msg.image.id, mime: msg.image.mime_type }, caption: msg.image.caption });
        } else {
          const text = msg.text?.body || msg.button?.text || msg.interactive?.list_reply?.title || '';
          out.push({ from: msg.from, text });
        }
      }
    }
  }
  return out;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS — the PWA (a different origin/port) calls /lessons/generate from the browser.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (url.pathname === '/health') {
    return json(res, 200, { ok: true, live: isLive(), ai: aiConfigured(), voice: voiceConfigured(), sms: smsLive() });
  }

  // SMS Learning Assistant (Stage 10) — inbound SMS → core → reply via SMS transport.
  if (req.method === 'POST' && url.pathname === '/sms/webhook') {
    const { from, text } = await readSmsInbound(req);
    if (!from) return json(res, 400, { error: 'missing sender' });
    const result = await handle(sessionFor(from), text);
    const messages = renderSms(result);
    await sendSms(from, messages);
    return json(res, 200, { received: 1, sent: messages.length });
  }

  // Lecturer Studio (Stage 12): publish a lesson to the catalog for students.
  if (req.method === 'POST' && url.pathname === '/studio/publish') {
    const { capsule } = await readBody(req);
    if (!capsule?.capsuleId || !capsule.meta?.topic) return json(res, 400, { error: 'a capsule with meta.topic is required' });
    const rec = await addPublished(capsule);
    registerCapsule(rec); // so /voice works for the published lesson
    return json(res, 200, { published: { capsuleId: rec.capsuleId, topic: rec.meta.topic } });
  }
  if (req.method === 'GET' && url.pathname === '/studio/published') {
    return json(res, 200, { capsules: await listPublished() });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/studio/capsule/')) {
    const id = decodeURIComponent(url.pathname.slice('/studio/capsule/'.length).replace(/\.json$/i, ''));
    const capsule = await getPublished(id);
    if (!capsule) return json(res, 404, { error: 'not found' });
    return json(res, 200, capsule);
  }

  // SMS simulator — render the SMS reply for { from, text } (no gateway needed).
  if (req.method === 'POST' && url.pathname === '/sms-sim') {
    const { from = 'sim', text = '' } = await readBody(req);
    const result = await handle(sessionFor(from), text);
    return json(res, 200, { from, text, kind: result.kind, messages: renderSms(result) });
  }

  // Voice Tutor (Stage 6): synthesize + cache an Opus voice note for a capsule.
  if (req.method === 'GET' && url.pathname.startsWith('/voice/')) {
    if (!voiceConfigured()) return json(res, 503, { error: 'voice not configured (set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)' });
    const id = decodeURIComponent(url.pathname.slice('/voice/'.length).replace(/\.ogg$/i, ''));
    try {
      const audio = await getVoiceAudio(id);
      if (!audio) return json(res, 404, { error: 'no audio for that capsule' });
      res.writeHead(200, {
        'Content-Type': audio.mime,
        'Content-Length': audio.audio.length,
        'Cache-Control': 'public, max-age=86400'
      });
      return res.end(audio.audio);
    } catch (e) {
      return json(res, 502, { error: 'tts failed', detail: e.message });
    }
  }

  // AI Processing Engine (Stage 5): generate a capsule for any topic. Channel-neutral
  // — the PWA, WhatsApp, or any client can call this and render the LearningResponse.
  if (req.method === 'POST' && url.pathname === '/lessons/generate') {
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    const { university, course, topic } = await readBody(req);
    if (!topic) return json(res, 400, { error: 'topic is required' });
    try {
      const capsule = await generateCapsule({ university, course, topic });
      if (!capsule) return json(res, 502, { error: 'generation returned no capsule' });
      registerCapsule(capsule);
      attachVoice(capsule, selfBase(req)); // wire the voice note URL when TTS is on
      return json(res, 200, { capsule });
    } catch (e) {
      return json(res, 502, { error: 'generation failed', detail: e.message });
    }
  }

  // Snap & Learn (Stage 7): a photo (base64) → Claude vision → capsule.
  if (req.method === 'POST' && url.pathname === '/lessons/snap') {
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    const { image, mediaType, hint } = await readBody(req);
    if (!image) return json(res, 400, { error: 'image (base64) is required' });
    try {
      const capsule = await generateFromImage({ imageBase64: image, mediaType, hint });
      if (!capsule) return json(res, 502, { error: 'could not read the image clearly' });
      registerCapsule(capsule);
      attachVoice(capsule, selfBase(req));
      return json(res, 200, { capsule });
    } catch (e) {
      return json(res, 502, { error: 'snap failed', detail: e.message });
    }
  }

  // WhatsApp verification handshake.
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge || '');
    }
    res.writeHead(403);
    return res.end('forbidden');
  }

  // Inbound messages from WhatsApp.
  if (req.method === 'POST' && url.pathname === '/webhook') {
    const body = await readBody(req);
    const inbound = extractInbound(body);
    const replies = [];
    for (const item of inbound) {
      const result = item.image
        ? await handleSnap(item.from, item.image, item.caption)
        : await handle(sessionFor(item.from), item.text);
      if (result.capsule) attachVoice(result.capsule, selfBase(req));
      const messages = renderResult(result, PUBLIC_BASE_URL);
      await sendMessages(item.from, messages);
      replies.push({ from: item.from, sent: messages.length });
    }
    return json(res, 200, { received: inbound.length, replies });
  }

  // Local simulator — drive the brain without WhatsApp.
  if (req.method === 'POST' && url.pathname === '/sim') {
    const { from = 'sim-user', text = '' } = await readBody(req);
    const result = await handle(sessionFor(from), text);
    if (result.capsule) attachVoice(result.capsule, selfBase(req));
    const messages = renderResult(result, PUBLIC_BASE_URL);
    return json(res, 200, { from, text, kind: result.kind, messages });
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Efiko Gateway on http://localhost:${PORT}  (WhatsApp ${isLive() ? 'LIVE' : 'MOCK'})`);
});
