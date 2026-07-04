// EFIKO — gamification client. XP, level, streak and badges for the signed-in learner.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';

export async function fetchGamifyStats() {
  if (!token()) return null;
  try {
    const r = await fetch(`${GATEWAY}/gamify`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!r.ok) return null;
    return (await r.json()).stats;
  } catch { return null; }
}
