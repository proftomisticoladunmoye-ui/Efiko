// EFIKO ALWE — author a full LessonPackage with Claude, gated by the runtime validator.
// We don't trust the model blindly: generate → validate → one repair pass with the exact
// errors → validate again. Output is offline-ready EXCEPT voice (clips are synthesized
// later by the DownloadManager). See docs/ALWE-ARCHITECTURE.md §15 & Batch 10.
import { getClient, AUTHOR_MODEL } from '../ai/client.js';
import { validateLessonPackage } from './schema.js';

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const SPEC = `Produce ONE JSON object for an EFIKO Adaptive Learning Whiteboard (ALWE) lesson. JSON ONLY — no markdown, no commentary.

Shape:
{
  "manifest": {
    "lessonId": string, "format": "alwe", "version": 1,
    "meta": { "university": string, "course": string, "topic": string, "level": string, "sequence": 1 },
    "defaultMode": "normal", "offlineReady": false, "totalBytesEstimate": 24000,
    "arc": [ ordered nodes ]
  },
  "scenes": [ scene objects ]
}

arc nodes (in this order): {"kind":"intro","title","body"}, then for EACH scene {"kind":"scene","sceneId"}, a {"kind":"miniQuiz","quiz":[2 questions]} after the 2nd scene, then {"kind":"reflection","title","body"}, {"kind":"summary","title","body"}, {"kind":"finalQuiz","quiz":[3 questions]}.

A scene:
{
  "id": string (matches an arc sceneId), "title", "objective", "estimatedMs": 45000,
  "difficulty": "intro"|"core"|"stretch",
  "objects": [ 2-4 objects ],
  "segments": [ 2-3 voice segments ],
  "pausePoints": [ 1 pause point ],
  "knowledgeCheck": { "q", "options":[4], "answer": index, "conceptTags":[string] },
  "teachBack": { "prompt", "expectedPoints":[2-3 strings] },
  "explain": { "simpler","detailed","practicalExample","africanContext","realLifeScenario","visualAnalogy","commonMistakes","memoryTip" }  // ALL 8 keys, each a sentence
}

An object: { "id", "type", "props": {object}, "animation": {"kind":"draw"|"appear"|"highlight"|"fade","startMs":number,"durationMs":number,"easing":"easeInOut"}, "explainText", "voiceSegmentId" (must equal a segment id in this scene), "conceptTags":[string], "interactive": true, "onTapExplain" }
Prefer object types that render richly: "coordinatePlane" (props x,y,w,h,xRange,yRange), "label" (props x,y,text), "text" (props x,y,text), "equation" (props x,y,latex), "line"/"arrow" (props x1,y1,x2,y2). Canvas viewBox is 540x330; keep coordinates inside it.

A voice segment: { "id", "sceneId" (THIS scene's id), "startMs", "endMs", "text" (10-30s of narration), "clipId": null }

Rules: every arc scene node's sceneId MUST exist in scenes[]. Every segment.sceneId MUST equal its scene's id. Every object.voiceSegmentId MUST be a segment id in the same scene. conceptTags are short kebab-case ids reused between an object and the matching quiz question so wrong answers map back to the teaching scene. Use real African university examples where natural. Make it pedagogically excellent and accurate.`;

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

async function callModel(client, messages) {
  const msg = await client.messages.create({ model: AUTHOR_MODEL, max_tokens: 8000, messages });
  return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export function isConfigured() {
  return Boolean(getClient());
}

/** Generate a validated LessonPackage for a topic. Throws if it can't be made valid. */
export async function generateLesson({ topic, course = '', university = '', level = 'Undergraduate' }) {
  const client = getClient();
  if (!client) throw new Error('AI not configured (set ANTHROPIC_API_KEY)');
  if (!topic) throw new Error('topic is required');

  const lessonId = `${slug(university) || 'efiko'}-${slug(course) || 'gen'}-${slug(topic)}-${Date.now().toString(36)}`;
  const ask = `${SPEC}\n\nLesson to author:\n- topic: ${topic}\n- course: ${course || 'General'}\n- university: ${university || 'EFIKO'}\n- level: ${level}\n- use lessonId exactly: "${lessonId}"\nReturn the JSON now.`;

  let text = await callModel(client, [{ role: 'user', content: ask }]);
  let pkg = extractJson(text);
  let { ok, errors } = validateLessonPackage(pkg);

  if (!ok) {
    // One repair pass with the exact validator errors.
    const repair = `The JSON you produced failed validation with these errors:\n${errors.join('\n')}\n\nReturn the COMPLETE corrected JSON object (same shape), fixing every error. JSON only.`;
    text = await callModel(client, [
      { role: 'user', content: ask },
      { role: 'assistant', content: text },
      { role: 'user', content: repair }
    ]);
    pkg = extractJson(text);
    ({ ok, errors } = validateLessonPackage(pkg));
  }

  if (!ok) throw new Error(`generated lesson invalid: ${errors.slice(0, 4).join('; ')}`);
  pkg.manifest.lessonId = lessonId; // enforce our id regardless
  return pkg;
}
