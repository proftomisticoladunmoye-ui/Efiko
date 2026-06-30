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
import { getClient, FAST_MODEL } from './core/ai/client.js';
import { generateLesson, isConfigured as alweAuthorConfigured } from './core/alwe/sceneGenerator.js';
import { addAlweLesson, getAlweLesson, listAlweLessons } from './core/alwe/lessons.js';
import { createUser, authenticate, getUser, publicUser } from './core/users.js';
import { registerCapsule } from './core/content.js';
import { getVoiceAudio, attachVoice, isConfigured as voiceConfigured } from './core/voice/voiceTutor.js';
import { synthesize as ttsSynthesize } from './core/voice/tts.js';
import { createHash } from 'node:crypto';
import { fetchMediaBase64 } from './channels/whatsapp/transport.js';
import { renderSms } from './channels/sms/render.js';
import { sendSms, smsLive } from './channels/sms/transport.js';
import { addPublished, getPublished, listPublished } from './core/published.js';
import { verifyToken, verifyPassword, signToken } from './core/auth.js';
import { createInstitution, findByEmail, getOrg, updateBranding, getBranding, publicOrg, seedFromEnv } from './core/institutions.js';

const PORT = process.env.PORT || 4100;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'Efiko-verify';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || ''; // gate for creating institution accounts

// Resolve the institution behind a Bearer token (Phase B auth).
async function authedOrg(req) {
  const h = req.headers['authorization'] || '';
  const p = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  return p?.orgId ? getOrg(p.orgId) : null;
}

// Resolve the user (student/lecturer) behind a Bearer token (V1.5 identity).
// User tokens carry {userId}; institution tokens carry {orgId} — they don't collide.
async function authedUser(req) {
  const h = req.headers['authorization'] || '';
  const p = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  return p?.userId ? getUser(p.userId) : null;
}

// In-memory sessions (per phone number). Persistence comes in a later stage.
const sessions = new Map();
// ALWE narration cache (text hash → synthesized audio) to dedupe within a session.
const alweTtsCache = new Map();
const sessionFor = (id) => {
  if (!sessions.has(id)) sessions.set(id, createSession(id));
  return sessions.get(id);
};

// Public base used for voice-note URLs (WhatsApp needs a reachable URL; for the PWA
// the browser hits the gateway directly). Falls back to the request host.
const selfBase = (req) => PUBLIC_BASE_URL || `http://${req.headers.host}`;

// Cost guardrail (free period): per-client/day caps so a single user (or abuser) can't
// run up the API bill. Two buckets: "gen" for expensive fresh generations, "assist" for
// the cheaper voice/coach/teach-back calls (generous, but still bounded). Cached/published
// /catalog content is unaffected — only live API calls count.
const DAILY_GEN_LIMIT = Number(process.env.DAILY_GEN_LIMIT || 25);
const DAILY_ASSIST_LIMIT = Number(process.env.DAILY_ASSIST_LIMIT || 300);
const rateCounts = new Map(); // "bucket|ip|date" -> count

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon').split(',')[0].trim();
}
function rateLimited(req, bucket, limit) {
  const today = new Date().toISOString().slice(0, 10);
  if (rateCounts.size > 8000) {
    for (const k of rateCounts.keys()) if (!k.endsWith(today)) rateCounts.delete(k);
  }
  const key = `${bucket}|${clientIp(req)}|${today}`;
  const n = (rateCounts.get(key) || 0) + 1;
  rateCounts.set(key, n);
  return n > limit;
}
function genQuotaExceeded(req) { return rateLimited(req, 'gen', DAILY_GEN_LIMIT); }

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

// Cap request bodies so a huge payload can't exhaust memory. 4 MB comfortably fits the
// largest valid lesson package (<3 MB) and logo data-URL uploads; bigger is rejected.
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 4 * 1024 * 1024);
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      if (aborted) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) { aborted = true; req.destroy(); return; }
      data += c;
    });
    req.on('end', () => {
      if (aborted) return resolve({});
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Friendly landing so the bare URL doesn't look broken (it's an API, not a site).
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(
      '<!doctype html><meta charset="utf-8"><title>Efiko Gateway</title>' +
      '<body style="font-family:system-ui;background:#0b1120;color:#e2e8f0;text-align:center;padding:60px">' +
      '<h1 style="color:#14b8a6">Efiko Gateway</h1>' +
      '<p>The Efiko learning gateway is running. ✓</p>' +
      '<p style="color:#94a3b8">This is the API server (WhatsApp, SMS, AI). It has no public page.</p>' +
      '<p><a style="color:#14b8a6" href="/health">/health</a></p></body>'
    );
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
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'Sign in as your institution (Institution Admin) to publish.' });
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

  // --- User accounts (V1.5): student/lecturer signup + login ---
  if (req.method === 'POST' && url.pathname === '/auth/signup') {
    const { name, email, password } = await readBody(req);
    try {
      const u = await createUser({ name, email, password, role: 'student' });
      return json(res, 200, { token: signToken({ userId: u.userId, role: u.role }), user: publicUser(u) });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/auth/login') {
    const { email, password } = await readBody(req);
    const u = await authenticate(email || '', password || '');
    if (!u) return json(res, 401, { error: 'Invalid email or password' });
    return json(res, 200, { token: signToken({ userId: u.userId, role: u.role }), user: publicUser(u) });
  }
  if (req.method === 'GET' && url.pathname === '/auth/me') {
    const u = await authedUser(req);
    if (!u) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, { user: publicUser(u) });
  }

  // --- Institution accounts + white-label branding (Phase B) ---
  // Onboard an institution (you create accounts — protected by the master key).
  if (req.method === 'POST' && url.pathname === '/admin/register') {
    if (!ADMIN_MASTER_KEY || req.headers['x-admin-key'] !== ADMIN_MASTER_KEY) return json(res, 401, { error: 'unauthorized' });
    const { orgId, institution, email, password, active } = await readBody(req);
    try {
      return json(res, 200, { org: await createInstitution({ orgId, institution, email, password, active }) });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method === 'POST' && url.pathname === '/admin/login') {
    const { email, password } = await readBody(req);
    const rec = await findByEmail(email || '');
    if (!rec || !verifyPassword(password || '', rec.passwordHash)) return json(res, 401, { error: 'Invalid email or password' });
    return json(res, 200, { token: signToken({ orgId: rec.orgId }), org: publicOrg(rec) });
  }
  if (req.method === 'GET' && url.pathname === '/admin/me') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, { org: publicOrg(org) });
  }
  if (req.method === 'POST' && url.pathname === '/admin/branding') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'unauthorized' });
    if (!org.active) return json(res, 403, { error: 'Customization is a paid feature. Contact Efiko to activate your institution.' });
    const branding = await updateBranding(org.orgId, await readBody(req));
    return json(res, 200, { branding });
  }
  // Public branding for the app's white-label theming.
  if (req.method === 'GET' && url.pathname.startsWith('/tenants/')) {
    const id = decodeURIComponent(url.pathname.slice('/tenants/'.length));
    const branding = await getBranding(id);
    if (!branding) return json(res, 404, { error: 'not found' });
    return json(res, 200, branding);
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

  // ALWE voice (Batch 4): synthesize one short narration segment → Opus bytes. The PWA
  // calls this once per segment when "downloading voice for offline", then stores the
  // clip in IndexedDB so playback needs zero network. Cached by text hash this session.
  if (req.method === 'POST' && url.pathname === '/alwe/tts') {
    if (!voiceConfigured()) return json(res, 503, { error: 'voice not configured (set DEEPGRAM_API_KEY)' });
    if (rateLimited(req, 'assist', DAILY_ASSIST_LIMIT)) return json(res, 429, { error: 'Daily voice limit reached. Try again tomorrow.' });
    const { text } = await readBody(req);
    if (!text || !String(text).trim()) return json(res, 400, { error: 'text is required' });
    try {
      const key = createHash('sha1').update(String(text)).digest('hex');
      let audio = alweTtsCache.get(key);
      if (!audio) { audio = await ttsSynthesize(String(text)); if (audio) alweTtsCache.set(key, audio); }
      if (!audio) return json(res, 502, { error: 'tts returned no audio' });
      res.writeHead(200, { 'Content-Type': audio.mime, 'Content-Length': audio.audio.length, 'Cache-Control': 'public, max-age=86400' });
      return res.end(audio.audio);
    } catch (e) {
      return json(res, 502, { error: 'tts failed', detail: e.message });
    }
  }

  // ALWE authoring (Batch 10): generate a full ALWE lesson with Claude (validated).
  if (req.method === 'POST' && url.pathname === '/alwe/generate') {
    if (!alweAuthorConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    if (genQuotaExceeded(req)) return json(res, 429, { error: 'Daily generation limit reached. Try again tomorrow.' });
    const { topic, course, university, level } = await readBody(req);
    if (!topic) return json(res, 400, { error: 'topic is required' });
    try {
      const pkg = await generateLesson({ topic, course, university, level });
      return json(res, 200, { pkg });
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }
  // Publish a (reviewed) ALWE lesson so students can open it.
  if (req.method === 'POST' && url.pathname === '/alwe/publish') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'Sign in as your institution (Institution Admin) to publish.' });
    const { pkg } = await readBody(req);
    if (!pkg?.manifest?.lessonId) return json(res, 400, { error: 'a valid ALWE package is required' });
    try {
      pkg.publishedBy = org.orgId; // provenance
      const rec = await addAlweLesson(pkg);
      return json(res, 200, { lessonId: rec.lessonId });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  // List published ALWE lessons (catalog rows).
  if (req.method === 'GET' && url.pathname === '/alwe/lessons') {
    return json(res, 200, { lessons: await listAlweLessons() });
  }
  // Fetch one published ALWE lesson package (the PWA opens this).
  if (req.method === 'GET' && url.pathname.startsWith('/alwe/lesson/')) {
    const id = decodeURIComponent(url.pathname.slice('/alwe/lesson/'.length));
    const pkg = await getAlweLesson(id);
    if (!pkg) return json(res, 404, { error: 'lesson not found' });
    return json(res, 200, pkg);
  }

  // ALWE Cognitive Tutor (Batch 8): optional ONLINE escalation. The offline tutor handles
  // diagnosis + pre-generated explanations; this gives a bespoke fresh take on a concept.
  if (req.method === 'POST' && url.pathname === '/alwe/coach') {
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    if (rateLimited(req, 'assist', DAILY_ASSIST_LIMIT)) return json(res, 429, { error: 'Daily coach limit reached. Try again tomorrow.' });
    const client = getClient();
    if (!client) return json(res, 503, { error: 'AI not configured' });
    const { topic = '', concept = '', sceneTitle = '' } = await readBody(req);
    try {
      const focus = concept || sceneTitle || topic;
      const prompt = `A university student in Africa is struggling to understand "${focus}" while studying ${topic || 'this topic'}. Explain it a different, simpler way in 2-3 short sentences, using one concrete everyday or African example. Be warm and encouraging. No preamble, no headings.`;
      const msg = await client.messages.create({ model: FAST_MODEL, max_tokens: 280, messages: [{ role: 'user', content: prompt }] });
      const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      return json(res, 200, { text });
    } catch (e) {
      return json(res, 502, { error: 'coach failed', detail: e.message });
    }
  }

  // ALWE Teach Back (Batch 9): grade the learner's own explanation against the rubric.
  // The protégé effect — explaining to learn. Offline does a recall check; this adds
  // nuanced, encouraging feedback when online.
  if (req.method === 'POST' && url.pathname === '/alwe/teachback') {
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    if (rateLimited(req, 'assist', DAILY_ASSIST_LIMIT)) return json(res, 429, { error: 'Daily limit reached. Try again tomorrow.' });
    const client = getClient();
    if (!client) return json(res, 503, { error: 'AI not configured' });
    const { topic = '', sceneTitle = '', objective = '', expectedPoints = [], explanation = '' } = await readBody(req);
    if (!String(explanation).trim()) return json(res, 400, { error: 'explanation is required' });
    try {
      const points = Array.isArray(expectedPoints) ? expectedPoints.map((p) => `- ${p}`).join('\n') : '';
      const prompt = `You are a warm, encouraging tutor for an African university student studying ${topic || 'this topic'}.
They were asked to explain "${sceneTitle}" (goal: ${objective}) in their own words.

Key points a strong answer covers:
${points}

The student wrote:
"""${String(explanation).slice(0, 1500)}"""

In 3-4 short sentences, give feedback: first what they got right, then the most important thing missing or to fix (at most one misconception), and end with one encouraging line. Plain language, no headings, no preamble.`;
      const msg = await client.messages.create({ model: FAST_MODEL, max_tokens: 320, messages: [{ role: 'user', content: prompt }] });
      const feedback = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      return json(res, 200, { feedback });
    } catch (e) {
      return json(res, 502, { error: 'grading failed', detail: e.message });
    }
  }

  // AI Processing Engine (Stage 5): generate a capsule for any topic. Channel-neutral
  // — the PWA, WhatsApp, or any client can call this and render the LearningResponse.
  if (req.method === 'POST' && url.pathname === '/lessons/generate') {
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured (set ANTHROPIC_API_KEY)' });
    if (genQuotaExceeded(req)) return json(res, 429, { error: 'Daily lesson limit reached. Open a saved lesson, or try again tomorrow.' });
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
    if (genQuotaExceeded(req)) return json(res, 429, { error: 'Daily lesson limit reached. Open a saved lesson, or try again tomorrow.' });
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
  // Bootstrap the first admin account from env vars (no-op if already present).
  seedFromEnv().catch((e) => console.error('[seed] failed:', e.message));
});
