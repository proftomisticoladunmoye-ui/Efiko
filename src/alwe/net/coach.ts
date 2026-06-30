// EFIKO ALWE — optional online escalation for the Study Coach. Asks the gateway (Claude)
// for a fresh explanation of a concept. Only used when online; the offline tutor works
// without it.
const GATEWAY = (import.meta.env.VITE_GATEWAY as string) || 'http://localhost:4100';

export async function askCoach(input: { topic: string; concept?: string; sceneTitle?: string }): Promise<string> {
  const res = await fetch(`${GATEWAY}/alwe/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `coach failed (${res.status})`);
  return data.text || '';
}
