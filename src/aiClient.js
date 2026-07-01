// EFIKO — shared AI client helpers (V2 R3). Attaches the signed-in user's token so AI
// actions are charged to their credits, and notifies the UI to refresh the credit meter.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

export const userToken = () => (typeof localStorage !== 'undefined' && localStorage.getItem('efiko-user-token')) || '';
export const aiHeaders = () => (userToken() ? { Authorization: `Bearer ${userToken()}` } : {});

/** Tell the app an AI action happened, so the credit meter refetches. */
export function notifyAiUsed() {
  try { window.dispatchEvent(new Event('efiko-ai-used')); } catch { /* non-browser */ }
}

export async function fetchCredits() {
  try {
    const r = await fetch(`${GATEWAY}/credits`, { headers: aiHeaders() });
    if (!r.ok) return null;
    return (await r.json()).credits; // { balance, tier, dailyGrant } or null for visitors
  } catch { return null; }
}
