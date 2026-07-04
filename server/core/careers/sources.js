// EFIKO — Career aggregation SOURCES. Pulls genuine opportunities from services that publish
// OPEN, aggregation-friendly APIs (not scraping sites that forbid it), and always links back
// to the original posting. Each adapter returns normalised opportunities; add more adapters
// here (incl. Africa-specific job/scholarship/volunteer feeds) — the aggregator picks them up.
//
// Relevance: we keep roles open to African applicants — remote-worldwide/anywhere and any
// posting that mentions Africa or an African country.
const AFRICA = /\b(africa|african|nigeria|kenya|ghana|south\s?africa|egypt|uganda|tanzania|rwanda|ethiopia|morocco|senegal|remote|worldwide|anywhere|emea|global)\b/i;
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n = 300) => { const t = stripHtml(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const typeOf = (title = '') => (/\bintern(ship)?\b/i.test(title) ? 'internship' : (/\bvolunteer\b/i.test(title) ? 'volunteer' : (/\bscholarship|fellowship|grant\b/i.test(title) ? 'scholarship' : 'job')));

async function getJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'EfikoCareerBot/1.0 (+https://efikolearn.online)', Accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// --- pure normalisers (unit-testable without network) ---

// Remotive — free remote-jobs API (https://remotive.com/api/remote-jobs). Worldwide roles.
export function mapRemotive(jobs) {
  return (jobs || []).map((j) => ({
    source: 'Remotive', extId: String(j.id), title: j.title, org: j.company_name,
    location: j.candidate_required_location || 'Remote', url: j.url,
    type: typeOf(j.title), description: clip(j.description), tags: j.category ? [j.category] : [],
    postedAt: j.publication_date ? Date.parse(j.publication_date) : Date.now()
  })).filter((o) => AFRICA.test(`${o.location} ${o.title}`));
}

// RemoteOK — free remote-jobs API (https://remoteok.com/api). Global worldwide-remote roles,
// generally open to African applicants. The first array element is legal/metadata (skipped).
export function mapRemoteOK(rows) {
  return (rows || []).filter((j) => j && j.id && j.position).map((j) => ({
    source: 'RemoteOK', extId: String(j.id), title: j.position, org: j.company,
    location: j.location || 'Worldwide', url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    type: typeOf(j.position), description: clip(j.description), tags: (j.tags || []).slice(0, 4),
    postedAt: j.date ? Date.parse(j.date) : Date.now()
  })).filter((o) => AFRICA.test(`${o.location} ${o.title}`));
}

const remotive = async () => mapRemotive((await getJson('https://remotive.com/api/remote-jobs?limit=100')).jobs);
const remoteok = async () => mapRemoteOK(await getJson('https://remoteok.com/api'));

// All source adapters. Each is best-effort; a failing source never blocks the others.
// Both are global worldwide-remote boards (Africa-accessible). Add Africa-specific job,
// scholarship and volunteer feeds here as adapters — the aggregator picks them up.
export const SOURCES = [remotive, remoteok];
export const SOURCE_NAMES = ['Remotive', 'RemoteOK']; // active sources — used to prune decommissioned ones

export async function fetchAllSources() {
  const results = await Promise.allSettled(SOURCES.map((fn) => fn()));
  const out = [];
  for (const r of results) if (r.status === 'fulfilled' && Array.isArray(r.value)) out.push(...r.value);
  // sanity: drop entries without a title or apply URL
  return out.filter((o) => o.title && o.url);
}
