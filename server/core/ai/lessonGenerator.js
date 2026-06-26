// Efiko — AI Whiteboard / Processing Engine (Stage 5).
// Turns ANY topic into a Learning Capsule conforming to the same LearningResponse
// contract the PWA and WhatsApp already render. Claude (claude-opus-4-8) authors the
// lesson; structured outputs guarantee the shape. Generated capsules are lightweight
// by construction (the data-minimisation ethos drives the prompt).
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getClient, isConfigured, AUTHOR_MODEL } from './client.js';

const SYSTEM = `You are Efiko, an expert university tutor for African students who learn on very low bandwidth (often 2G, often via WhatsApp).

Produce ONE short "learning capsule" — a single 3–5 minute micro-lesson on the requested topic. Rules:
- Be accurate and academically rigorous. Teach the standard university interpretation. If a topic could mean several things, pick the most common university-course meaning.
- Use plain, warm, African-friendly English. Define any jargon you introduce.
- Keep everything LIGHTWEIGHT — it is delivered over 2G/WhatsApp. Be concise.
- "text": the core explanation, 90–140 words, step-by-step where it helps.
- "whiteboardSvg": a SMALL, self-contained SVG illustrating the idea. Use viewBox "0 0 480 260", a white background rect, and at most ~12 simple shapes/labels. Limit to a few colors (e.g. #0f766e, #15803d, #b45309, #334155). NO <script>, NO <foreignObject>, NO external images or hrefs. Keep it under ~2KB. Use ASCII text in labels (write "theta" not the Greek symbol).
- "whiteboardCaption": one sentence describing the figure.
- "quiz": EXACTLY 3 multiple-choice questions; each has EXACTLY 4 options; "answer" is the 0-based index of the correct option.
- "flashcards": EXACTLY 4 cards (front = term, back = short definition).
- "summary": 1–2 sentences.`;

const CapsuleSchema = z.object({
  topic: z.string(),
  level: z.string(),
  text: z.string(),
  whiteboardSvg: z.string(),
  whiteboardCaption: z.string(),
  quiz: z.array(
    z.object({
      q: z.string(),
      options: z.array(z.string()),
      answer: z.number().int()
    })
  ),
  flashcards: z.array(z.object({ front: z.string(), back: z.string() })),
  summary: z.string()
});

// Defence-in-depth: the SVG is rendered via innerHTML in the PWA, so strip anything
// active even though it comes from our own model.
function sanitizeSvg(svg) {
  if (typeof svg !== 'string') return '';
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
}

const slug = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

const kb = (str) => Math.max(1, Math.round(Buffer.byteLength(str || '', 'utf8') / 1024));

function toCapsule(d, { university, course, topic }) {
  const svg = sanitizeSvg(d.whiteboardSvg);
  const id = ('ai-' + [slug(course), slug(d.topic || topic)].filter(Boolean).join('-')).replace(/-+/g, '-');
  const textKB = kb(d.text);
  const svgKB = kb(svg);
  return {
    capsuleId: id,
    version: 1,
    generated: true,
    meta: {
      university: university || 'Efiko',
      course: course || 'AI Tutor',
      topic: d.topic || topic,
      level: d.level || '',
      sequence: 1,
      durationMin: 4
    },
    blocks: [
      { type: 'text', sizeKB: textKB, value: d.text },
      { type: 'whiteboard', sizeKB: svgKB, inlineSvg: svg, caption: d.whiteboardCaption },
      { type: 'voice', sizeKB: 0, codec: 'opus', ref: null, pending: 'Stage 6 — Voice Tutor' },
      { type: 'quiz', items: d.quiz },
      { type: 'flashcards', items: d.flashcards },
      { type: 'summary', sizeKB: kb(d.summary), value: d.summary }
    ],
    actions: ['QUIZ', 'VOICE', 'FLASHCARDS', 'DOWNLOAD'],
    totalSizeKB: textKB + svgKB + kb(d.summary) + 2,
    offlineReady: true
  };
}

/**
 * Generate a Learning Capsule for a topic. Returns null if AI isn't configured or
 * the model declined/failed (caller falls back to the graceful "not found" message).
 */
// Shared authoring path for both text prompts and Snap & Learn images.
async function author(userContent, meta) {
  if (!isConfigured()) return null;
  const client = getClient();
  const res = await client.beta.messages.parse({
    model: AUTHOR_MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    output_format: betaZodOutputFormat(CapsuleSchema)
  });

  // Prefer the SDK's auto-parse; fall back to parsing + validating the JSON text
  // block ourselves (robust against helper/SDK quirks). Same schema either way.
  let data = res.parsed;
  if (!data) {
    const textBlock = res.content?.find((b) => b.type === 'text');
    if (textBlock?.text) {
      try {
        data = CapsuleSchema.parse(JSON.parse(textBlock.text));
      } catch (e) {
        console.warn('[AI] capsule parse failed (stop_reason=%s): %s', res.stop_reason, e.message);
      }
    }
  }
  if (!data) return null; // refusal or truncation
  return toCapsule(data, meta);
}

// Generate a capsule from a topic / course code (Stage 5).
export async function generateCapsule({ university, course, topic }) {
  const ctx = [
    university && `University: ${university}`,
    course && `Course: ${course}`,
    `Topic: ${topic}`
  ].filter(Boolean).join('\n');
  return author(`Create one Efiko learning capsule.\n${ctx}`, { university, course, topic });
}

// Snap & Learn (Stage 7): generate a capsule from a photo via Claude vision.
export async function generateFromImage({ imageBase64, mediaType = 'image/jpeg', hint }) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    {
      type: 'text',
      text:
        'A student sent this photo — it may be handwritten notes, a lecture slide, a textbook page, ' +
        'or an assignment question. Read it carefully, identify the academic topic, and create one ' +
        'Efiko learning capsule that teaches that topic clearly.' +
        (hint ? ` The student added: "${hint}".` : '')
    }
  ];
  return author(content, {});
}

export { isConfigured };
