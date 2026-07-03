// EFIKO — payment adapter (V2 R5, Marketplace). Follows the same "mock by default, real
// provider when configured" pattern as the WhatsApp/SMS channels.
//
// Default provider is 'mock': checkout settles instantly so the marketplace is fully usable
// as a demo. To go live with Flutterwave:
//   1) set PAYMENTS_PROVIDER=flutterwave
//   2) set FLW_SECRET_KEY   (server, secret — used to verify transactions)
//   3) set FLW_PUBLIC_KEY   (sent to the browser — used to open Flutterwave checkout)
// Then the client opens Flutterwave checkout and the server verifies the transaction here
// before granting access. No other app code changes.
const PROVIDER = process.env.PAYMENTS_PROVIDER || 'mock';
const FLW_SECRET = process.env.FLW_SECRET_KEY || '';
const FLW_PUBLIC = process.env.FLW_PUBLIC_KEY || '';
const FLW_API = 'https://api.flutterwave.com/v3';

export function paymentsProvider() { return PROVIDER; }
export function paymentsLive() { return PROVIDER === 'flutterwave' && !!FLW_SECRET && !!FLW_PUBLIC; }
export function paymentsPublicKey() { return paymentsLive() ? FLW_PUBLIC : ''; }

// Mock/free settlement — instant. Used for free items always, and for paid items in mock mode
// (the demo checkout). Live paid items go through verifyPayment() instead.
export async function settlePayment({ amount, currency = 'NGN', ref }) {
  const reference = ref || `efiko_${Date.now()}`;
  if (amount === 0) return { status: 'paid', ref: reference, provider: 'free' };
  if (PROVIDER === 'mock') return { status: 'paid', ref: reference, provider: 'mock' };
  throw new Error('Live payments are configured — complete checkout via Flutterwave, then verify.');
}

// Verify a completed Flutterwave transaction server-side before granting access. The browser
// sends back the transaction_id after the user pays; we confirm it with Flutterwave using the
// SECRET key and check the charge actually matches the expected amount + currency.
// Returns { ok, ref, provider, detail? }.
export async function verifyPayment({ transactionId, amount, currency = 'NGN' }) {
  if (!paymentsLive()) throw new Error('Live payments are not configured.');
  if (!transactionId) return { ok: false, detail: 'missing transaction id' };
  try {
    const r = await fetch(`${FLW_API}/transactions/${encodeURIComponent(transactionId)}/verify`, {
      headers: { Authorization: `Bearer ${FLW_SECRET}` }
    });
    const body = await r.json().catch(() => ({}));
    const d = body?.data;
    if (!r.ok || body?.status !== 'success' || !d) return { ok: false, detail: body?.message || `verify failed (${r.status})` };
    // Guard against tampering: the charge must be successful and cover the expected price/currency.
    const paid = d.status === 'successful' && Number(d.amount) >= Number(amount) && String(d.currency).toUpperCase() === String(currency).toUpperCase();
    if (!paid) return { ok: false, detail: `charge mismatch (status ${d.status}, ${d.amount} ${d.currency})` };
    return { ok: true, ref: d.tx_ref || String(transactionId), provider: 'flutterwave' };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}
