// EFIKO — public headline stats (social proof). Safe aggregates only.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

export async function fetchPublicStats() {
  try { const r = await fetch(`${GATEWAY}/stats/public`); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

// Round down to a tidy figure and add "+", so a public counter never shows an awkward exact
// small number (e.g. 37 -> "30+", 1240 -> "1,200+").
export function niceCount(n) {
  n = Number(n) || 0;
  if (n < 10) return String(n);
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 50) * 50}+`;
  return `${(Math.floor(n / 100) * 100).toLocaleString()}+`;
}
