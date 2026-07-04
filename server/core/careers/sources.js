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

// Arbeitnow — free job-board API (https://www.arbeitnow.com/api/job-board-api). Remote roles.
export function mapArbeitnow(data) {
  return (data || []).filter((j) => j.remote).map((j) => ({
    source: 'Arbeitnow', extId: j.slug, title: j.title, org: j.company_name,
    location: j.remote ? 'Remote' : (j.location || ''), url: j.url,
    type: (j.job_types || []).some((t) => /intern/i.test(t)) ? 'internship' : typeOf(j.title),
    description: clip(j.description), tags: (j.tags || []).slice(0, 4),
    postedAt: j.created_at ? j.created_at * 1000 : Date.now()
  }));
}

const remotive = async () => mapRemotive((await getJson('https://remotive.com/api/remote-jobs?limit=80')).jobs);
const arbeitnow = async () => mapArbeitnow((await getJson('https://www.arbeitnow.com/api/job-board-api')).data);

// All source adapters. Each is best-effort; a failing source never blocks the others.
export const SOURCES = [remotive, arbeitnow];

export async function fetchAllSources() {
  const results = await Promise.allSettled(SOURCES.map((fn) => fn()));
  const out = [];
  for (const r of results) if (r.status === 'fulfilled' && Array.isArray(r.value)) out.push(...r.value);
  // sanity: drop entries without a title or apply URL
  return out.filter((o) => o.title && o.url);
}
