// EFIKO Originals — AI Course Generator (Phase 1). Given a short spec (topic, audience,
// hours, level) Claude authors a full micro-certificate course following the standard EFIKO
// architecture: outcomes -> pre-assessment -> N sessions (each with an interactive whiteboard,
// examples, quiz, flashcards, reflection, summary, discussion prompt) -> final assessment ->
// certificate competencies -> recommended next course.
//
// Two-tier generation keeps each model call bounded and reliable:
//   1) genOutline()  -> course skeleton (title, outcomes, session list, assessments)
//   2) genSession()  -> full content for one session
// Every generated course is a DRAFT and must pass human review before publication.
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getClient, isConfigured, AUTHOR_MODEL } from '../ai/client.js';

export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const kb = (str) => Math.max(1, Math.round(Buffer.byteLength(str || '', 'utf8') / 1024));

// SVG defence-in-depth (rendered via innerHTML in the client).
function sanitizeSvg(svg) {
  if (typeof svg !== 'string') return '';
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}

const McqSchema = z.object({ q: z.string(), options: z.array(z.string()), answer: z.number().int() });

const OutlineSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  category: z.string(),
  level: z.string(),
  audience: z.string(),
  estimatedHours: z.number(),
  description: z.string(),
  outcomes: z.array(z.string()),
  sessions: z.array(z.object({ title: z.string(), objectives: z.array(z.string()), brief: z.string() })),
  preAssessment: z.array(McqSchema),
  finalAssessment: z.array(McqSchema),
  competencies: z.array(z.string()),
  nextCourse: z.string()
});

const SessionSchema = z.object({
  objectives: z.array(z.string()),
  text: z.string(),
  whiteboardSvg: z.string(),
  whiteboardCaption: z.string(),
  example: z.string(),
  quiz: z.array(McqSchema),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  reflection: z.string(),
  summary: z.string(),
  discussionPrompt: z.string()
});

const OUTLINE_SYSTEM = `You are EFIKO's lead curriculum designer, creating a standardized "EFIKO Original" micro-certificate course for African university students and young professionals.

Design a course outline that is evidence-based, practical, competency-based and mobile/offline friendly. Rules:
- Split the course into 4-7 focused SESSIONS, each learnable in 20-40 minutes, in a logical learning order.
- "outcomes": 4-6 measurable learning outcomes (start each with a verb: "Explain...", "Apply...").
- Each session: a clear title, 2-3 objectives, and a one-sentence brief of what it covers.
- "preAssessment": 3 multiple-choice questions to gauge prior knowledge (4 options each, "answer" = 0-based index).
- "finalAssessment": 5 multiple-choice questions covering the whole course (4 options each).
- "competencies": 3-5 concrete competencies the certificate attests.
- "nextCourse": the single best follow-on EFIKO course title for a learning pathway.
- "estimatedHours": realistic total hours (2-10).
Be accurate and academically sound. Plain, warm, inclusive English.`;

const SESSION_SYSTEM = `You are EFIKO authoring ONE session of a micro-certificate course for African university students on low bandwidth.

Produce a complete, self-contained session. Rules:
- "text": the core teaching content (a "whiteboard lesson" narrative), 130-200 words, step-by-step where useful, defining any jargon.
- "whiteboardSvg": a SMALL self-contained SVG illustrating the key idea. viewBox "0 0 480 260", a white background rect, at most ~12 simple shapes/labels, a few colors (#0f766e, #15803d, #b45309, #334155). NO <script>, NO <foreignObject>, NO external images/hrefs. Under ~2KB. ASCII labels only (write "theta", not Greek).
- "whiteboardCaption": one sentence describing the figure.
- "example": one concrete, real-life example relevant to an African student or workplace.
- "quiz": EXACTLY 3 MCQs, EXACTLY 4 options each, "answer" = 0-based index.
- "flashcards": EXACTLY 4 cards (front = term/question, back = short answer).
- "reflection": one open reflection question.
- "summary": 1-2 sentences.
- "discussionPrompt": one prompt the learner could take into the EFIKO AI tutor to go deeper.
Be accurate, practical and encouraging.`;

async function parse(system, userContent, schema, maxTokens) {
  const client = getClient();
  const res = await client.beta.messages.parse({
    model: AUTHOR_MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    system,
    messages: [{ role: 'user', content: userContent }],
    output_format: betaZodOutputFormat(schema)
  });
  let data = res.parsed;
  if (!data) {
    const t = res.content?.find((b) => b.type === 'text');
    if (t?.text) { try { data = schema.parse(JSON.parse(t.text)); } catch (e) { console.warn('[originals] parse failed (%s): %s', res.stop_reason, e.message); } }
  }
  return data || null;
}

async function genOutline({ topic, audience, hours, level }) {
  const spec = [`Topic: ${topic}`, audience && `Target audience: ${audience}`, hours && `Target duration: ${hours} hours`, level && `Level: ${level}`].filter(Boolean).join('\n');
  return parse(OUTLINE_SYSTEM, `Design an EFIKO Original course outline.\n${spec}`, OutlineSchema, 6000);
}

async function genSession(outline, session, index) {
  const ctx = `Course: "${outline.title}" (${outline.level}). Audience: ${outline.audience}.
Session ${index + 1} of ${outline.sessions.length}: "${session.title}".
Objectives: ${session.objectives.join('; ')}.
Brief: ${session.brief}`;
  return parse(SESSION_SYSTEM, `Author this EFIKO session in full.\n${ctx}`, SessionSchema, 6000);
}

function assemble(spec, outline, sessions) {
  const now = Date.now();
  const passMark = 70;
  return {
    courseId: `orig-${slug(outline.title)}`,
    owner: 'EFIKO',
    origin: 'efiko-original',
    status: 'draft',
    title: outline.title,
    subtitle: outline.subtitle,
    category: outline.category,
    level: outline.level,
    audience: outline.audience,
    estimatedHours: outline.estimatedHours,
    description: outline.description,
    outcomes: outline.outcomes,
    competencies: outline.competencies,
    nextCourse: outline.nextCourse,
    preAssessment: { questions: outline.preAssessment },
    finalAssessment: { passMark, questions: outline.finalAssessment },
    sessions: sessions.map((s, i) => ({
      id: `s${i + 1}-${slug(outline.sessions[i]?.title || `session-${i + 1}`)}`,
      order: i + 1,
      title: outline.sessions[i]?.title || `Session ${i + 1}`,
      objectives: s.objectives,
      text: s.text,
      whiteboardSvg: sanitizeSvg(s.whiteboardSvg),
      whiteboardCaption: s.whiteboardCaption,
      example: s.example,
      quiz: s.quiz,
      flashcards: s.flashcards,
      reflection: s.reflection,
      summary: s.summary,
      discussionPrompt: s.discussionPrompt,
      sizeKB: kb(s.text) + kb(s.whiteboardSvg) + 2
    })),
    spec,
    generatedBy: 'ai',
    reviewedBy: null,
    createdAt: now,
    updatedAt: now
  };
}

// Generate a full EFIKO Original (DRAFT). Returns the assembled course, or null if AI is off
// or the outline generation failed.
export async function generateCourse({ topic, audience = 'University students', hours = 4, level = 'Beginner' }) {
  if (!isConfigured()) return null;
  const spec = { topic, audience, hours, level };
  const outline = await genOutline(spec);
  if (!outline || !Array.isArray(outline.sessions) || !outline.sessions.length) return null;
  const sessions = [];
  for (let i = 0; i < outline.sessions.length; i++) {
    const s = await genSession(outline, outline.sessions[i], i);
    if (s) sessions.push(s);
  }
  if (!sessions.length) return null;
  return assemble(spec, outline, sessions);
}
