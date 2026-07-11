// EFIKO — Marketplace client (V2 R5). Browse & buy listings; institutions manage their own.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const userToken = () => localStorage.getItem('efiko-user-token') || '';
const orgToken = () => localStorage.getItem('efiko-admin-token') || '';
const userHeaders = () => (userToken() ? { Authorization: `Bearer ${userToken()}` } : {});
const orgHeaders = () => (orgToken() ? { Authorization: `Bearer ${orgToken()}` } : {});

// --- creator marketplace ---
export async function createCreatorListing(payload) {
  const r = await fetch(`${GATEWAY}/market/creator/listings`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.listing;
}
export async function listMyCreatorListings() {
  try { const r = await fetch(`${GATEWAY}/market/creator/listings`, { headers: userHeaders() }); if (!r.ok) return []; return (await r.json()).listings || []; } catch { return []; }
}
export async function deleteCreatorListing(id) {
  const r = await fetch(`${GATEWAY}/market/creator/listings/${encodeURIComponent(id)}`, { method: 'DELETE', headers: userHeaders() });
  return r.ok;
}
export async function fetchCreatorEarnings() {
  try { const r = await fetch(`${GATEWAY}/market/creator/earnings`, { headers: userHeaders() }); if (!r.ok) return null; return (await r.json()).earnings; } catch { return null; }
}
export async function requestPayout() {
  const r = await fetch(`${GATEWAY}/market/creator/payout`, { method: 'POST', headers: userHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d;
}
// Creator payout (bank) details.
export async function fetchPayoutDetails() {
  try { const r = await fetch(`${GATEWAY}/market/creator/payout-details`, { headers: userHeaders() }); if (!r.ok) return { details: null, live: false }; return await r.json(); } catch { return { details: null, live: false }; }
}
export async function savePayoutDetails(payload) {
  const r = await fetch(`${GATEWAY}/market/creator/payout-details`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.details;
}
export async function fetchBanks(country = 'NG') {
  try { const r = await fetch(`${GATEWAY}/payments/banks?country=${encodeURIComponent(country)}`, { headers: userHeaders() }); if (!r.ok) return []; return (await r.json()).banks || []; } catch { return []; }
}

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

// v4 card checkout: the browser encrypts card fields (AES-256-GCM) with the Flutterwave
// encryption key so the raw card number never reaches our server. Returns the fields + nonce.
export async function fetchCardKey() {
  try { const r = await fetch(`${GATEWAY}/payments/card-key`, { headers: userHeaders() }); if (!r.ok) return null; return (await r.json()).key || null; } catch { return null; }
}
export async function encryptCard(card, keyB64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nonce = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = new TextEncoder().encode(nonce);
  const enc = async (v) => {
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, new TextEncoder().encode(String(v)));
    return btoa(String.fromCharCode(...new Uint8Array(ct)));
  };
  return {
    nonce,
    encrypted_card_number: await enc(String(card.number).replace(/\s+/g, '')),
    encrypted_expiry_month: await enc(card.month),
    encrypted_expiry_year: await enc(card.year),
    encrypted_cvv: await enc(card.cvv)
  };
}

// v4 checkout: start a mobile-money charge; returns { reference, status, nextAction } (or { free/already }).
export async function startCharge(id, method) {
  const r = await fetch(`${GATEWAY}/market/listings/${encodeURIComponent(id)}/charge`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify(method) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d;
}
// v4 checkout: poll a charge until it settles. Returns { status, purchase? }.
export async function pollCharge(reference) {
  try { const r = await fetch(`${GATEWAY}/market/charge/${encodeURIComponent(reference)}`, { headers: userHeaders() }); if (!r.ok) return { status: 'pending' }; return await r.json(); } catch { return { status: 'pending' }; }
}

// Live checkout: after Flutterwave payment, verify the transaction server-side to grant access.
export async function verifyPurchase(id, transactionId) {
  const r = await fetch(`${GATEWAY}/market/listings/${encodeURIComponent(id)}/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...userHeaders() }, body: JSON.stringify({ transactionId })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d;
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
