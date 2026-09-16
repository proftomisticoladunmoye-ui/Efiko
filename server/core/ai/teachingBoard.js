// Efiko — AI Teaching Whiteboard (R9). Turns a question into a *teaching sequence*: an ordered
// set of steps where the board is drawn up one piece at a time while Efiko narrates, asks the
// odd check question, and finally invites the learner to teach the idea back. This is the
// SEE -> HEAR -> INTERACT -> PRACTICE -> TEACH-BACK loop, not a static diagram.
//
// Two fidelities so it works across the Full / Smart / Lite modes:
//   full     — 5-6 steps, richer boards, narration written to be spoken.
//   moderate — 3-4 steps, simpler boards, tight captions; for low data / poor internet.
// Narration is plain text: the client speaks it with the device's own voice (Web Speech API),
// so there is NO audio to download in either mode. Generating a sequence needs the internet;
// once generated it can be replayed offline.
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getClient, isConfigured, FAST_MODEL } from './client.js';
import { sanitizeSvg } from './lessonGenerator.js';

const MODEL = process.env.EFIKO_ASK_MODEL || FAST_MODEL;
const THINKS = /opus|sonnet/i.test(MODEL);

const StepSchema = z.object({
  title: z.string(),                 // a few words naming this step
  say: z.string(),                   // narration for this step (spoken by the device)
  svg: z.string(),                   // the board AS IT LOOKS at this step (cumulative build)
  check: z.object({                  // optional quick comprehension check
    q: z.string(),
    options: z.array(z.string()),
    answer: z.number().int()
  }).nullable()
});

const SequenceSchema = z.object({
  topic: z.string(),
  steps: z.array(StepSchema),
  teachBackPrompt: z.string()        // the closing "explain it back" question
});

function systemFor(lite) {
  const steps = lite ? '3' : '4 to 5';
  const shapes = lite ? '7' : '11';
  return `You are Efiko, a warm expert tutor teaching African university students at a whiteboard. Turn the topic into a STEP-BY-STEP visual teaching sequence — as if you were drawing on a board and talking through it.

Return ${steps} steps. For EACH step:
- "title": a few words naming the step.
- "say": what you say aloud at this step — 1${lite ? '' : ' to 2'} short, warm sentence(s), plain African-friendly English. This is spoken by the device, so write it to be heard, not read. No markdown.
- "svg": the board AS IT LOOKS AT THIS STEP. The board is CUMULATIVE — each step keeps the previous drawing and ADDS to it, so the picture builds up as the lesson advances. Use viewBox "0 0 480 300" and a white background rect. Keep it SIMPLE: at most ${shapes} shapes/labels, only basic elements (rect, line, circle, path, text), a few colors (#0f766e #15803d #b45309 #334155 #0369a1). ASCII text only (write "theta", "->"). NO gradients, NO <script>, NO <foreignObject>, NO external images or hrefs, NO comments. This is CRITICAL: keep every SVG small and terse so the whole response is never truncated.
- "check": on ${lite ? 'ONE' : 'one or two'} step(s) include a quick multiple-choice check ({q, options: EXACTLY 4, answer: 0-based index}); on the others set it to null.

Finally "teachBackPrompt": one question inviting the learner to explain the idea back in their own words.

Be accurate and academically rigorous. Keep it lightweight — it is delivered on 2G.`;
}

// Cap the payload defensively regardless of what the model returns.
function tidy(seq, lite) {
  const maxSteps = lite ? 4 : 6;
  const steps = (seq.steps || []).slice(0, maxSteps).map((s) => ({
    title: String(s.title || '').slice(0, 80),
    say: String(s.say || '').slice(0, 400),
    svg: sanitizeSvg(s.svg).slice(0, 6000),
    check: s.check && Array.isArray(s.check.options) && s.check.options.length >= 2
      ? { q: String(s.check.q || '').slice(0, 200), options: s.check.options.slice(0, 4).map((o) => String(o).slice(0, 120)), answer: Number(s.check.answer) || 0 }
      : null
  })).filter((s) => s.svg);
  return { topic: seq.topic, steps, teachBackPrompt: String(seq.teachBackPrompt || 'In your own words, how would you explain this to a friend?').slice(0, 240) };
}

// Generate a teaching sequence for a topic. Returns null if AI isn't configured or the model
// failed, so the caller can fall back gracefully.
export async function generateTeachingSequence({ topic, lite = false }) {
  if (!isConfigured()) return null;
  const client = getClient();
  let res;
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: lite ? 6000 : 9000, // SVG-per-step is token-heavy; leave ample room so JSON never truncates
      ...(THINKS ? { thinking: { type: 'adaptive' } } : {}),
      system: systemFor(lite),
      messages: [{ role: 'user', content: `Teach this at the whiteboard: ${String(topic).slice(0, 400)}` }],
      output_format: betaZodOutputFormat(SequenceSchema)
    });
  } catch (e) {
    // The strict parser throws on a truncated/oddly-shaped response — degrade gracefully.
    console.warn('[whiteboard] generation parse failed: %s', e.message);
    return null;
  }

  let data = res.parsed;
  if (!data) {
    const block = res.content?.find((b) => b.type === 'text');
    if (block?.text) { try { data = SequenceSchema.parse(JSON.parse(block.text)); } catch { /* refusal/truncation */ } }
  }
  if (!data || !Array.isArray(data.steps) || !data.steps.length) return null;
  return tidy(data, lite);
}

export { isConfigured };
