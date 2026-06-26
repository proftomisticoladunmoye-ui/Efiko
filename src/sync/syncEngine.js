// Efiko — Offline Engine (Stage 3) and the seed of Campus Wi-Fi Sync (Stage 11).
// The "remote" is a static catalog + capsule files; in later stages this is the
// Efiko Gateway. The rules here are offline-first: network is an optimisation,
// never a requirement.
import {
  getCatalog, saveCatalog,
  getCapsule, saveCapsule, listCapsules, deleteCapsule,
  saveAudio, hasAudio, listAudioIds
} from '../storage/capsuleStore.js';

/**
 * Get the catalog: try the network, fall back to the cached copy when offline.
 * When online, also merge in lecturer-published lessons from the gateway (Stage 12).
 * Returns { catalog, source: 'network' | 'cache' }.
 */
export async function fetchCatalog(gatewayBase) {
  try {
    const res = await fetch('/catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('catalog ' + res.status);
    const catalog = await res.json();
    if (gatewayBase) {
      const published = await fetchPublished(gatewayBase);
      if (published.length) {
        const ids = new Set(catalog.capsules.map((c) => c.capsuleId));
        catalog.capsules = [...catalog.capsules, ...published.filter((p) => !ids.has(p.capsuleId))];
      }
    }
    await saveCatalog(catalog);
    return { catalog, source: 'network' };
  } catch (e) {
    const cached = await getCatalog();
    if (cached) return { catalog: cached, source: 'cache' };
    throw e;
  }
}

/** Lecturer Studio (Stage 12): publish a lesson, and list published lessons. */
export async function publishLesson(gatewayBase, capsule) {
  const res = await fetch(`${gatewayBase}/studio/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capsule })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `publish failed (${res.status})`);
  }
  return res.json();
}

export async function fetchPublished(gatewayBase) {
  try {
    const res = await fetch(`${gatewayBase}/studio/published`, { cache: 'no-cache' });
    if (!res.ok) return [];
    return (await res.json()).capsules || [];
  } catch {
    return [];
  }
}

/** Download one capsule and store it. `pin` true marks it as a kept "Download".
 *  Falls back to the gateway for lecturer-published lessons (Stage 12). */
export async function downloadCapsule(capsuleId, pin, gatewayBase) {
  let res = await fetch(`/capsules/${capsuleId}.json`, { cache: 'no-cache' }).catch(() => null);
  if ((!res || !res.ok) && gatewayBase) {
    res = await fetch(`${gatewayBase}/studio/capsule/${capsuleId}`, { cache: 'no-cache' }).catch(() => null);
  }
  if (!res || !res.ok) throw new Error('capsule ' + (res?.status || 'unreachable'));
  const capsule = await res.json();
  return saveCapsule(capsule, { pinned: pin });
}

/**
 * Merge the catalog with what's cached locally, so the UI can show each lesson's
 * state: not downloaded / cached / pinned, and whether a newer version exists.
 */
export async function buildLibrary(catalog) {
  const local = await listCapsules();
  const byId = Object.fromEntries(local.map((c) => [c.capsuleId, c]));
  return (catalog?.capsules || []).map((entry) => {
    const cached = byId[entry.capsuleId];
    return {
      ...entry,
      cached: !!cached,
      pinned: cached?.pinned || false,
      updateAvailable: cached ? (cached.version || 0) < entry.version : false
    };
  });
}

/**
 * Sync: refresh the catalog, then re-download any cached capsule whose version is
 * stale (preserving its pin state). Returns a summary for the UI.
 */
export async function syncAll(onProgress) {
  const { catalog, source } = await fetchCatalog();
  const library = await buildLibrary(catalog);
  let updated = 0;
  for (const item of library) {
    const cached = await getCapsule(item.capsuleId);
    if (cached && cached.version < item.version) {
      await downloadCapsule(item.capsuleId); // pin undefined → preserve
      updated++;
      onProgress?.(item.capsuleId);
    }
  }
  return { catalog, catalogSource: source, updated };
}

// --- Lesson Packs (Stage 8) ---------------------------------------------------
// A pack bundles a course's capsules so a student downloads a whole course at once
// for offline study — the building block for Campus Wi-Fi Sync (Stage 11).

/** Merge pack definitions with local cache state (how many capsules are offline). */
export async function buildPacks(catalog) {
  const local = await listCapsules();
  const have = new Set(local.map((c) => c.capsuleId));
  const sizeOf = (id) => (catalog.capsules || []).find((c) => c.capsuleId === id)?.sizeKB || 0;
  return (catalog.packs || []).map((p) => {
    const total = p.capsuleIds.length;
    const downloaded = p.capsuleIds.filter((id) => have.has(id)).length;
    const sizeKB = p.capsuleIds.reduce((s, id) => s + sizeOf(id), 0);
    return { ...p, total, downloaded, complete: total > 0 && downloaded === total, sizeKB };
  });
}

/** Download every capsule in a pack (pinned), reporting progress. */
export async function downloadPack(pack, onProgress) {
  let done = 0;
  for (const id of pack.capsuleIds) {
    await downloadCapsule(id, true);
    onProgress?.(++done, pack.capsuleIds.length);
  }
  return done;
}

/** Remove all of a pack's capsules from the offline store. */
export async function removePack(pack) {
  for (const id of pack.capsuleIds) await deleteCapsule(id);
}

// --- Campus Wi-Fi Sync (Stage 11) -------------------------------------------
// Pull the WHOLE library for true 0-MB offline: every capsule + its voice-note
// bytes. Delta-aware — skips capsules already at the current version and voice
// already stored. `gatewayBase` is the campus server that synthesizes/serves voice.

/** How much of the library is already offline (for the campus-sync status). */
export async function offlineStatus(catalog) {
  const ids = (catalog.capsules || []).map((c) => c.capsuleId);
  const cached = new Set((await listCapsules()).map((c) => c.capsuleId));
  const withAudio = new Set(await listAudioIds());
  return {
    total: ids.length,
    capsules: ids.filter((id) => cached.has(id)).length,
    voice: ids.filter((id) => withAudio.has(id)).length
  };
}

export async function syncCampus(catalog, gatewayBase, onProgress) {
  const items = catalog.capsules || [];
  let done = 0;
  for (const entry of items) {
    // 1. Lesson capsule (skip if already current).
    const cached = await getCapsule(entry.capsuleId);
    if (!cached || (cached.version || 0) < entry.version) {
      await downloadCapsule(entry.capsuleId, true);
    }
    // 2. Voice-note bytes (skip if already stored).
    if (gatewayBase && !(await hasAudio(entry.capsuleId))) {
      try {
        const res = await fetch(`${gatewayBase}/voice/${entry.capsuleId}.ogg`);
        if (res.ok) {
          const blob = await res.blob();
          await saveAudio(entry.capsuleId, blob, blob.type || 'audio/ogg');
        }
      } catch { /* voice optional — text/whiteboard still work offline */ }
    }
    onProgress?.(++done, items.length);
  }
  return done;
}
