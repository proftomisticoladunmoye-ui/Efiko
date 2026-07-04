// EFIKO — Career aggregator. Runs the source adapters, normalises + dedupes the results, and
// stores them as "aggregated" opportunities (distinct from institution-posted ones). The
// Career board shows both. Refresh is triggered by an operator endpoint or, opportunistically,
// when the stored data goes stale — no persistent cron needed.
import { kvGet, kvPut, kvAll, kvDel } from '../kv.js';
import { fetchAllSources, SOURCE_NAMES } from './sources.js';

const COLL = 'agg_opps';
const META = 'agg_meta';
const MAX_AGE = 45 * 86400000; // drop postings older than ~45 days
const STALE = 12 * 3600000;    // refresh if last run > 12h ago

const idFor = (o) => `agg_${o.source}_${o.extId}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 90);

let _running = false;

// Fetch from all sources and upsert. Returns { added, total } or null on failure.
export async function refreshAggregated() {
  if (_running) return null;
  _running = true;
  try {
    const items = await fetchAllSources();
    if (!items.length) return { added: 0, total: (await listAggregated()).length };
    let added = 0;
    const now = Date.now();
    for (const o of items) {
      const id = idFor(o);
      const existing = await kvGet(COLL, id);
      if (!existing) added++;
      await kvPut(COLL, id, { id, aggregated: true, ...o, deadline: o.deadline || null, fetchedAt: now });
    }
    await kvPut(META, 'last', { at: now, sources: [...new Set(items.map((x) => x.source))] });
    // prune very old postings and any from decommissioned sources
    const active = new Set(SOURCE_NAMES);
    for (const rec of await kvAll(COLL)) {
      if (!active.has(rec.source) || now - (rec.postedAt || rec.fetchedAt || 0) > MAX_AGE) await kvDel(COLL, rec.id);
    }
    return { added, total: (await kvAll(COLL)).length };
  } catch {
    return null;
  } finally {
    _running = false;
  }
}

export async function listAggregated() {
  return (await kvAll(COLL)).sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
}

// Kick a background refresh if the data is stale (fire-and-forget; never blocks the caller).
export async function refreshIfStale() {
  const meta = await kvGet(META, 'last');
  if (meta && Date.now() - meta.at < STALE) return;
  refreshAggregated().catch(() => {});
}

export async function lastRun() {
  return (await kvGet(META, 'last')) || null;
}
