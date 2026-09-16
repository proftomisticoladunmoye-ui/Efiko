// Efiko — Teach-Back evaluation (R10). Explaining an idea back in your own words is the best
// test of real understanding, so when a learner does it we don't just say "well done" — Efiko
// reads the explanation and gives an honest, kind assessment: what they got right, what to firm
// up, and a mastery score. The response is small (text only), so it stays cheap on 2G.
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getClient, isConfigured, FAST_MODEL } from './client.js';

const EvalSchema = z.object({
  score: z.number().int(),                             // 0-100 mastery from this explanation
  verdict: z.enum(['mastered', 'almost', 'developing']),
  strengths: z.array(z.string()),                      // specific things they got right
  gaps: z.array(z.string()),                           // gentle next steps (empty if mastered)
  encouragement: z.string()
});

const SYSTEM = `You are Efiko, a warm, encouraging tutor. A student has just explained a concept back to you in their own words — the "teach-back", the best test of real understanding. Assess their explanation FAIRLY and KINDLY.
- "score": 0-100, how well the explanation shows they understand the concept.
- "verdict": "mastered" (85+, accurate and clear), "almost" (60-84, mostly right with a gap or two), or "developing" (<60, a key misunderstanding).
- "strengths": 1-3 SPECIFIC things they got right (paraphrase what they actually said). Genuine, not generic.
- "gaps": 0-3 specific things to firm up, phrased as gentle next steps ("Next, make sure..."). Empty if truly mastered.
- "encouragement": one warm sentence. Never harsh — this is a learner on a hard journey.
Judge only their UNDERSTANDING of the concept — never their spelling, grammar or English fluency.`;

export async function evaluateTeachBack({ topic, explanation }) {
  if (!isConfigured()) return null;
  const client = getClient();
  let res;
  try {
    res = await client.beta.messages.parse({
      model: FAST_MODEL,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Concept: ${String(topic || 'the concept').slice(0, 200)}\n\nStudent's explanation:\n"""${String(explanation).slice(0, 1500)}"""` }],
      output_format: betaZodOutputFormat(EvalSchema)
    });
  } catch { return null; }

  let data = res.parsed;
  if (!data) {
    const b = res.content?.find((x) => x.type === 'text');
    if (b?.text) { try { data = EvalSchema.parse(JSON.parse(b.text)); } catch { /* refusal */ } }
  }
  if (!data) return null;
  data.score = Math.max(0, Math.min(100, Math.round(data.score)));
  data.strengths = (data.strengths || []).slice(0, 3).map((s) => String(s).slice(0, 240));
  data.gaps = (data.gaps || []).slice(0, 3).map((s) => String(s).slice(0, 240));
  data.encouragement = String(data.encouragement || 'Keep going — you are learning well.').slice(0, 240);
  return data;
}

export { isConfigured };
