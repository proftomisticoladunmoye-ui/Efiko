// EFIKO — Flutterwave v4 low-level client. v4 replaces the v3 API-key model with OAuth2
// client-credentials: exchange FLW_V4_CLIENT_ID + FLW_V4_CLIENT_SECRET for a short-lived
// (10 min) Bearer token at the Flutterwave IDP, then call the v4 REST API. This module owns
// auth (with token caching/refresh) and a generic authed-request helper; feature modules
// (banks, transfers, charges) build on it.
import { randomUUID } from 'node:crypto';

const CLIENT_ID = process.env.FLW_V4_CLIENT_ID || '';
const CLIENT_SECRET = process.env.FLW_V4_CLIENT_SECRET || '';
const ENCRYPTION = process.env.FLW_V4_ENCRYPTION_KEY || '';
// Environment selects the API host. Default to SANDBOX unless explicitly 'live', so a
// misconfigured env can never accidentally move real money.
const ENV = String(process.env.FLW_V4_ENV || '').toLowerCase() === 'live' ? 'live' : 'sandbox';
const BASE = ENV === 'live' ? 'https://api.flutterwave.com' : 'https://developersandbox-api.flutterwave.com';
const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

export const v4Env = () => ENV;
export const v4BaseUrl = () => BASE;
export const v4EncryptionKey = () => ENCRYPTION;
// Live for OUR purposes = provider selected AND both OAuth credentials present.
export function v4Configured() {
  return process.env.PAYMENTS_PROVIDER === 'flutterwave_v4' && !!CLIENT_ID && !!CLIENT_SECRET;
}

let _tok = null; // { token, exp }
// Get a cached access token, refreshing ~1 min before the 10-min expiry.
export async function getAccessToken() {
  if (_tok && Date.now() < _tok.exp - 60000) return _tok.token;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || `auth failed (${r.status})`);
  _tok = { token: d.access_token, exp: Date.now() + (Number(d.expires_in) || 600) * 1000 };
  return _tok.token;
}

// Generic authed v4 request. Returns { ok, status, data }. Set idempotent:true for POSTs that
// must not double-execute (v4 requires X-Idempotency-Key on transfers/charges).
export async function flwV4(method, path, { body, idempotent = false } = {}) {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Trace-Id': randomUUID() };
  if (idempotent) headers['X-Idempotency-Key'] = randomUUID();
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
