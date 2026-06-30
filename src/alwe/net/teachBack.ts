// EFIKO ALWE — online Teach Back grading. Sends the learner's explanation + rubric to the
// gateway (Claude) for nuanced feedback. Only used when online; the offline recall check
// in engine/teachBack.ts always runs.
const GATEWAY = (import.meta.env.VITE_GATEWAY as string) || 'http://localhost:4100';

export async function gradeTeachBack(input: {
  topic: string;
  sceneTitle: string;
  objective: string;
  expectedPoints: string[];
  explanation: string;
}): Promise<string> {
  const res = await fetch(`${GATEWAY}/alwe/teachback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const data = (await res.json().catch(() => ({}))) as { feedback?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `grading failed (${res.status})`);
  return data.feedback || '';
}
