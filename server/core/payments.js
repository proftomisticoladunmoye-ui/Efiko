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
const FLW_WEBHOOK_HASH = process.env.FLW_WEBHOOK_HASH || '';
const FLW_API = 'https://api.flutterwave.com/v3';

export function paymentsProvider() { return PROVIDER; }
export function paymentsLive() { return PROVIDER === 'flutterwave' && !!FLW_SECRET && !!FLW_PUBLIC; }
export function paymentsPublicKey() { return paymentsLive() ? FLW_PUBLIC : ''; }

// A Flutterwave GET helper (secret-key auth).
async function flwGet(path) {
  const r = await fetch(`${FLW_API}${path}`, { headers: { Authorization: `Bearer ${FLW_SECRET}` } });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && body?.status === 'success', body };
}

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

// --- Payouts (creator disbursement via Flutterwave Transfers) ---

// List the banks for a country (e.g. NG, GH, KE, UG, ZA) so a creator can pick where to be
// paid. Returns [{ code, name }].
export async function listBanks(country = 'NG') {
  if (!paymentsLive()) throw new Error('Live payments are not configured.');
  const { ok, body } = await flwGet(`/banks/${encodeURIComponent(String(country).toUpperCase())}`);
  if (!ok) return { ok: false, detail: body?.message || 'could not load banks' };
  return { ok: true, banks: (body.data || []).map((b) => ({ code: b.code, name: b.name })) };
}

// Resolve an account number to its owner name (confirmation before saving payout details).
export async function resolveAccount({ bankCode, accountNumber }) {
  if (!paymentsLive()) throw new Error('Live payments are not configured.');
  try {
    const r = await fetch(`${FLW_API}/accounts/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${FLW_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode })
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body?.status !== 'success') return { ok: false, detail: body?.message || 'could not resolve account' };
    return { ok: true, accountName: body.data?.account_name || '' };
  } catch (e) { return { ok: false, detail: e.message }; }
}

// Initiate a transfer to a creator's bank account. Transfers settle asynchronously — this
// returns the queued transfer ({ id, status: 'NEW'|'PENDING'|... }); the final state arrives
// via the /payments/webhook (transfer.completed). Returns { ok, transferId, status, reference }.
export async function initiateTransfer({ bankCode, accountNumber, amount, currency = 'NGN', reference, narration = 'EFIKO creator payout', beneficiaryName }) {
  if (!paymentsLive()) throw new Error('Live payments are not configured.');
  try {
    const r = await fetch(`${FLW_API}/transfers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${FLW_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_bank: bankCode,
        account_number: accountNumber,
        amount: Number(amount),
        currency,
        reference: reference || `efiko_payout_${Date.now()}`,
        narration,
        ...(beneficiaryName ? { beneficiary_name: beneficiaryName } : {})
      })
    });
    const body = await r.json().catch(() => ({}));
    const d = body?.data;
    if (!r.ok || body?.status !== 'success' || !d) return { ok: false, detail: body?.message || `transfer failed (${r.status})` };
    return { ok: true, transferId: d.id, status: d.status, reference: d.reference, fee: d.fee };
  } catch (e) { return { ok: false, detail: e.message }; }
}

// Verify a Flutterwave webhook using the shared secret hash (set FLW_WEBHOOK_HASH here and in
// the Flutterwave dashboard). If no hash is configured we can't verify — reject to be safe.
export function verifyWebhook(req) {
  if (!FLW_WEBHOOK_HASH) return false;
  return req.headers['verif-hash'] === FLW_WEBHOOK_HASH;
}
