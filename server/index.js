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
import { listCourses, getCourse, courseIdOf } from './core/courses.js';
import { recordProgress, progressForUsers, getProgress, listProgress } from './core/progress.js';
import { issueCertificate, listCertificates, verifyBySerial } from './core/certificates.js';
import { createDiscussion, listDiscussions, getDiscussion, addMessage, touchDiscussion, recentMessages, addResource } from './core/thinkspace.js';
import { getCredits, spend, dailyGrant } from './core/credits.js';
import { addTask, listTasks, toggleTask, deleteTask } from './core/planner.js';
import { createProgramme, listProgrammes, getProgramme, getProgrammeResolved } from './core/programmes.js';
import { enrol, listEnrolments, courseIdForCode, rosterForCohort, cohortsForUser } from './core/enrolments.js';
import { createCohort, getCohort, getCohortByCode, listCohortsByOrg } from './core/cohorts.js';
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
const CERT_PASS_MARK = Number(process.env.CERT_PASS_MARK || 70); // % best-quiz to earn a certificate
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

// AI Credits (R3). Signed-in users spend per-user daily credits; anonymous visitors fall
// back to the per-IP rate limiter. Returns { ok, status?, error? }. Never blocks non-AI use.
const CREDIT_COST_GEN = Number(process.env.CREDIT_COST_GEN || 15);
const CREDIT_COST_ASSIST = Number(process.env.CREDIT_COST_ASSIST || 3);
async function chargeAI(req, kind) {
  const cost = kind === 'gen' ? CREDIT_COST_GEN : CREDIT_COST_ASSIST;
  const user = await authedUser(req);
  if (user) {
    const r = await spend(user.userId, cost);
    if (r.ok) return { ok: true };
    return { ok: false, status: 402, error: "You've used today's AI credits. Downloaded lessons still work — credits refresh tomorrow." };
  }
  const limit = kind === 'gen' ? DAILY_GEN_LIMIT : DAILY_ASSIST_LIMIT;
  if (rateLimited(req, kind, limit)) return { ok: false, status: 429, error: 'Daily AI limit reached. Sign in for your own daily credits, or try again tomorrow.' };
  return { ok: true };
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  // --- ThinkSpace (V2 R2): persistent AI discussions with memory ---
  if (req.method === 'POST' && url.pathname === '/thinkspace/discussions') {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to use ThinkSpace.' });
    const body = await readBody(req);
    return json(res, 200, { discussion: await createDiscussion(user.userId, body) });
  }
  if (req.method === 'GET' && url.pathname === '/thinkspace/discussions') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { discussions: [] });
    return json(res, 200, { discussions: await listDiscussions(user.userId) });
  }
  if (req.method === 'GET' && url.pathname.match(/^\/thinkspace\/discussions\/[^/]+$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'unauthorized' });
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const d = await getDiscussion(user.userId, id);
    if (!d) return json(res, 404, { error: 'not found' });
    return json(res, 200, { discussion: d });
  }
  if (req.method === 'POST' && url.pathname.match(/^\/thinkspace\/discussions\/[^/]+\/ask$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to use ThinkSpace.' });
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured' });
    { const ch = await chargeAI(req, 'assist'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const d = await getDiscussion(user.userId, id);
    if (!d) return json(res, 404, { error: 'not found' });
    const { text } = await readBody(req);
    if (!text || !String(text).trim()) return json(res, 400, { error: 'text is required' });
    await addMessage(id, 'user', String(text));
    try {
      const client = getClient();
      // History = memory. Trim any leading assistant turn so it starts with 'user'.
      let history = (await recentMessages(id, 12)).map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      while (history.length && history[0].role === 'assistant') history.shift();
      const ctx = d.context?.course ? ` The learner is studying ${d.context.course}${d.context.topic ? ` (${d.context.topic})` : ''}.` : '';
      const system = `You are Efiko, a warm, expert tutor for African university students.${ctx} Continue this discussion, remembering earlier context. Be clear and concise; use a concrete example where it helps.`;
      const msg = await client.messages.create({ model: FAST_MODEL, max_tokens: 700, system, messages: history });
      const reply = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
      const aiMsg = await addMessage(id, 'ai', reply);
      let title = d.title;
      if (!title || title === 'New Discussion') { title = String(text).slice(0, 42) + (String(text).length > 42 ? '…' : ''); await touchDiscussion(id, { title }); }
      else { await touchDiscussion(id); }
      return json(res, 200, { message: aiMsg, title });
    } catch (e) {
      return json(res, 502, { error: 'AI failed', detail: e.message });
    }
  }

  // ThinkSpace AI Tools (R2c): generate a resource (summary/quiz/flashcards) from a discussion.
  if (req.method === 'POST' && url.pathname.match(/^\/thinkspace\/discussions\/[^/]+\/generate$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to use ThinkSpace.' });
    if (!aiConfigured()) return json(res, 503, { error: 'AI not configured' });
    const charge = await chargeAI(req, 'assist');
    if (!charge.ok) return json(res, charge.status, { error: charge.error });
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const d = await getDiscussion(user.userId, id);
    if (!d) return json(res, 404, { error: 'not found' });
    if (!d.messages.length) return json(res, 400, { error: 'Ask something first, then generate from the discussion.' });
    const { tool } = await readBody(req);
    const transcript = (await recentMessages(id, 20)).map((m) => `${m.role === 'ai' ? 'Efiko' : 'Student'}: ${m.text}`).join('\n');
    const prompts = {
      summary: 'Summarize the key points of this discussion as concise study notes (3-6 short bullet points). Plain text only.',
      flashcards: 'Create 4-6 study flashcards from this discussion. Return ONLY a JSON array like [{"front":"term or question","back":"answer"}]. No other text.',
      quiz: 'Create 3 multiple-choice questions from this discussion. Return ONLY a JSON array like [{"q":"...","options":["a","b","c","d"],"answer":0}]. No other text.'
    };
    if (!prompts[tool]) return json(res, 400, { error: 'unknown tool' });
    try {
      const client = getClient();
      const msg = await client.messages.create({ model: FAST_MODEL, max_tokens: 800, messages: [{ role: 'user', content: `${prompts[tool]}\n\nDiscussion so far:\n${transcript}` }] });
      const raw = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      let data;
      if (tool === 'summary') data = { text: raw };
      else {
        const s = raw.indexOf('['); const e = raw.lastIndexOf(']');
        const items = s >= 0 && e >= 0 ? JSON.parse(raw.slice(s, e + 1)) : [];
        data = { items };
      }
      const resource = await addResource(id, tool, data);
      await touchDiscussion(id);
      return json(res, 200, { resource });
    } catch (e) {
      return json(res, 502, { error: 'generation failed', detail: e.message });
    }
  }

  // --- Study Planner (V2 R5): personal study tasks tied to the account ---
  if (req.method === 'GET' && url.pathname === '/planner/tasks') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { tasks: [] });
    return json(res, 200, { tasks: await listTasks(user.userId) });
  }
  if (req.method === 'POST' && url.pathname === '/planner/tasks') {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to use the Study Planner.' });
    const { title, courseId, dueAt } = await readBody(req);
    try {
      return json(res, 200, { task: await addTask(user.userId, { title, courseId, dueAt }) });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method === 'POST' && url.pathname.match(/^\/planner\/tasks\/[^/]+\/toggle$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'unauthorized' });
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const t = await toggleTask(user.userId, id);
    if (!t) return json(res, 404, { error: 'not found' });
    return json(res, 200, { task: t });
  }
  if (req.method === 'DELETE' && url.pathname.match(/^\/planner\/tasks\/[^/]+$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'unauthorized' });
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const ok = await deleteTask(user.userId, id);
    return json(res, ok ? 200 : 404, { ok });
  }

  // --- Courses (V1.5 F2): unified catalog over capsules + ALWE lessons ---
  if (req.method === 'GET' && url.pathname === '/courses') {
    return json(res, 200, { courses: await listCourses() });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/courses/')) {
    const id = decodeURIComponent(url.pathname.slice('/courses/'.length));
    const course = await getCourse(id);
    if (!course) return json(res, 404, { error: 'course not found' });
    return json(res, 200, course);
  }

  // --- Programmes (V2): tracks that group courses ---
  if (req.method === 'POST' && url.pathname === '/programmes') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'Sign in as your institution (Institution Admin) to create a programme.' });
    const { title, description, courseIds } = await readBody(req);
    try {
      const p = await createProgramme({ ownerOrgId: org.orgId, title, description, courseIds });
      return json(res, 200, { programmeId: p.programmeId });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }
  if (req.method === 'GET' && url.pathname === '/programmes') {
    return json(res, 200, { programmes: await listProgrammes() });
  }
  if (req.method === 'GET' && url.pathname.match(/^\/programmes\/[^/]+$/)) {
    const id = decodeURIComponent(url.pathname.slice('/programmes/'.length));
    const p = await getProgrammeResolved(id);
    if (!p) return json(res, 404, { error: 'programme not found' });
    return json(res, 200, p);
  }
  // Enrol in a programme → enrol in every course it contains.
  if (req.method === 'POST' && url.pathname.match(/^\/programmes\/[^/]+\/enrol$/)) {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to enrol.' });
    const id = decodeURIComponent(url.pathname.split('/')[2]);
    const p = await getProgramme(id);
    if (!p) return json(res, 404, { error: 'programme not found' });
    for (const cid of p.courseIds || []) if (await getCourse(cid)) await enrol(user.userId, cid);
    return json(res, 200, { courseIds: p.courseIds || [] });
  }

  // --- Enrolment (V1.5 F3): join a course by code, list my courses ---
  if (req.method === 'POST' && url.pathname === '/enrol') {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to enrol.' });
    const { code, courseId } = await readBody(req);
    let target = courseId;
    let cohortId = null;
    if (!target && code) {
      const cohort = await getCohortByCode(code); // a class code takes priority over a course code
      if (cohort) { target = cohort.courseId; cohortId = cohort.cohortId; }
      else target = await courseIdForCode(code);
    }
    if (!target || !(await getCourse(target))) return json(res, 404, { error: 'That class code is not valid.' });
    await enrol(user.userId, target, cohortId);
    return json(res, 200, { courseId: target, cohortId });
  }
  // --- Progress (V2): a signed-in student reports learning events ---
  if (req.method === 'POST' && url.pathname === '/progress') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { ok: false }); // visitors: no-op, not an error
    const body = await readBody(req);
    const courseId = body.courseId || courseIdOf(body.university, body.course);
    if (!courseId) return json(res, 400, { error: 'courseId (or university+course) required' });
    await recordProgress(user.userId, courseId, { event: body.event, score: body.score, total: body.total, cohortId: body.cohortId });
    return json(res, 200, { ok: true });
  }
  // My own progress across courses (drives certificate eligibility in the UI).
  if (req.method === 'GET' && url.pathname === '/progress') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { progress: [] });
    return json(res, 200, { progress: await listProgress(user.userId) });
  }
  // --- Certificates (V2) ---
  if (req.method === 'POST' && url.pathname === '/certificates') {
    const user = await authedUser(req);
    if (!user) return json(res, 401, { error: 'Sign in to claim a certificate.' });
    const { courseId } = await readBody(req);
    const course = await getCourse(courseId);
    if (!course) return json(res, 404, { error: 'course not found' });
    const p = await getProgress(user.userId, courseId);
    if (!p || (p.bestQuizPct ?? -1) < CERT_PASS_MARK) {
      return json(res, 403, { error: `Score at least ${CERT_PASS_MARK}% on a quiz to earn this certificate.`, needed: CERT_PASS_MARK, have: p?.bestQuizPct ?? null });
    }
    const cert = await issueCertificate({ userId: user.userId, userName: user.name, courseId, courseTitle: course.title, score: p.bestQuizPct });
    return json(res, 200, { certificate: cert });
  }
  if (req.method === 'GET' && url.pathname === '/certificates') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { certificates: [] });
    return json(res, 200, { certificates: await listCertificates(user.userId) });
  }
  // Public verification — no auth. Anyone with the serial can confirm authenticity.
  if (req.method === 'GET' && url.pathname.startsWith('/verify/')) {
    const serial = decodeURIComponent(url.pathname.slice('/verify/'.length));
    const cert = await verifyBySerial(serial);
    if (!cert) return json(res, 404, { valid: false });
    return json(res, 200, { valid: true, name: cert.userName, courseTitle: cert.courseTitle, score: cert.score, issuedAt: cert.issuedAt, serial: cert.serial });
  }

  // Lecturer: progress of everyone in a class.
  if (req.method === 'GET' && url.pathname.match(/^\/cohorts\/[^/]+\/progress$/)) {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'unauthorized' });
    const cohortId = decodeURIComponent(url.pathname.split('/')[2]);
    const cohort = await getCohort(cohortId);
    if (!cohort || cohort.ownerOrgId !== org.orgId) return json(res, 404, { error: 'class not found' });
    const roster = await rosterForCohort(cohortId);
    const prog = await progressForUsers(roster.map((r) => r.userId), cohort.courseId);
    const rows = await Promise.all(roster.map(async (r) => {
      const u = await getUser(r.userId);
      const p = prog.get(r.userId) || {};
      return { name: u?.name || 'Student', email: u?.email || '', started: !!p.started, completed: !!p.completed, bestQuizPct: p.bestQuizPct ?? null, lastActiveAt: p.lastActiveAt || null };
    }));
    return json(res, 200, { progress: rows });
  }

  // --- Cohorts / Classes (V2): lecturer creates a class, sees the roster ---
  if (req.method === 'POST' && url.pathname === '/cohorts') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'Sign in as your institution (Institution Admin) to create a class.' });
    const { courseId, title } = await readBody(req);
    if (!courseId || !(await getCourse(courseId))) return json(res, 400, { error: 'a valid courseId is required' });
    const c = await createCohort({ ownerOrgId: org.orgId, courseId, title });
    return json(res, 200, { cohort: { cohortId: c.cohortId, code: c.code, courseId: c.courseId, title: c.title } });
  }
  if (req.method === 'GET' && url.pathname === '/cohorts') {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'unauthorized' });
    const cohorts = await listCohortsByOrg(org.orgId);
    const withCounts = await Promise.all(cohorts.map(async (c) => ({
      cohortId: c.cohortId, code: c.code, courseId: c.courseId, title: c.title,
      students: (await rosterForCohort(c.cohortId)).length
    })));
    return json(res, 200, { cohorts: withCounts });
  }
  if (req.method === 'GET' && url.pathname.match(/^\/cohorts\/[^/]+\/roster$/)) {
    const org = await authedOrg(req);
    if (!org) return json(res, 401, { error: 'unauthorized' });
    const cohortId = decodeURIComponent(url.pathname.split('/')[2]);
    const cohort = await getCohort(cohortId);
    if (!cohort || cohort.ownerOrgId !== org.orgId) return json(res, 404, { error: 'class not found' });
    const roster = await rosterForCohort(cohortId);
    const named = await Promise.all(roster.map(async (r) => {
      const u = await getUser(r.userId);
      return { name: u?.name || 'Student', email: u?.email || '', enrolledAt: r.enrolledAt };
    }));
    return json(res, 200, { roster: named });
  }
  if (req.method === 'GET' && url.pathname === '/enrolments') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { courseIds: [] }); // visitors have none
    return json(res, 200, { courseIds: await listEnrolments(user.userId) });
  }
  // Classes the signed-in student has joined (Home dashboard).
  if (req.method === 'GET' && url.pathname === '/my-classes') {
    const user = await authedUser(req);
    if (!user) return json(res, 200, { classes: [] });
    const ids = await cohortsForUser(user.userId);
    const rows = [];
    for (const id of ids) { const c = await getCohort(id); if (c) rows.push({ cohortId: c.cohortId, title: c.title, code: c.code, courseId: c.courseId }); }
    return json(res, 200, { classes: rows });
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
  // AI Credits balance for the meter (R3).
  if (req.method === 'GET' && url.pathname === '/credits') {
    const u = await authedUser(req);
    if (!u) return json(res, 200, { credits: null }); // visitors: no per-user credits
    const c = await getCredits(u.userId);
    return json(res, 200, { credits: { balance: c.balance, tier: c.tier, dailyGrant: dailyGrant(c.tier) } });
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
    { const ch = await chargeAI(req, 'assist'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
    { const ch = await chargeAI(req, 'gen'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
    { const ch = await chargeAI(req, 'assist'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
    { const ch = await chargeAI(req, 'assist'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
    { const ch = await chargeAI(req, 'gen'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
    { const ch = await chargeAI(req, 'gen'); if (!ch.ok) return json(res, ch.status, { error: ch.error }); }
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
