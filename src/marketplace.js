// EFIKO — Marketplace client (V2 R5). Browse & buy listings; institutions manage their own.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const userToken = () => localStorage.getItem('efiko-user-token') || '';
const orgToken = () => localStorage.getItem('efiko-admin-token') || '';
const userHeaders = () => (userToken() ? { Authorization: `Bearer ${userToken()}` } : {});
const orgHeaders = () => (orgToken() ? { Authorization: `Bearer ${orgToken()}` } : {});

export async function listListings() {
  try {
    const r = await fetch(`${GATEWAY}/market/listings`);
    if (!r.ok) return { listings: [], payments: { provider: 'mock', live: false } };
    return await r.json();
  } catch { return { listings: [], payments: { provider: 'mock', live: false } }; }
}

export async function listPurchases() {
  try {
    const r = await fetch(`${GATEWAY}/market/purchases`, { headers: userHeaders() });
    if (!r.ok) return [];
    return (await r.json()).purchases || [];
  } catch { return []; }
}

export async function buyListing(id) {
  const r = await fetch(`${GATEWAY}/market/listings/${encodeURIComponent(id)}/buy`, { method: 'POST', headers: userHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d; // { purchase } | { already: true }
}

// --- institution-facing (marketplace console) ---
export async function listMyListings() {
  try {
    const r = await fetch(`${GATEWAY}/market/mine`, { headers: orgHeaders() });
    if (!r.ok) return [];
    return (await r.json()).listings || [];
  } catch { return []; }
}

export async function createListing(payload) {
  const r = await fetch(`${GATEWAY}/market/listings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...orgHeaders() }, body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.listing;
}

export async function deleteListing(id) {
  const r = await fetch(`${GATEWAY}/market/listings/${encodeURIComponent(id)}`, { method: 'DELETE', headers: orgHeaders() });
  return r.ok;
}
