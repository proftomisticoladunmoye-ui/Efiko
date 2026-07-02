// EFIKO — payment adapter (V2 R5, Marketplace). Follows the same "mock transport by default,
// real provider when configured" pattern as the WhatsApp/SMS channels.
//
// Default provider is 'mock': checkout settles instantly so the marketplace is fully usable
// as a demo. To go live, set PAYMENTS_PROVIDER=flutterwave and FLW_SECRET_KEY, then implement
// the redirect + verify flow marked below. Nothing else in the app needs to change.
const PROVIDER = process.env.PAYMENTS_PROVIDER || 'mock';
const FLW_SECRET = process.env.FLW_SECRET_KEY || '';

export function paymentsProvider() { return PROVIDER; }
export function paymentsLive() { return PROVIDER === 'flutterwave' && !!FLW_SECRET; }

// Settle a payment for a listing. Returns { status:'paid', ref, provider }.
// amount is in major currency units (e.g. naira). Free items (amount 0) always settle.
export async function settlePayment({ amount, currency = 'NGN', email, ref }) {
  const reference = ref || `efiko_${Date.now()}`;
  if (amount === 0 || PROVIDER === 'mock') {
    return { status: 'paid', ref: reference, provider: PROVIDER === 'mock' ? 'mock' : 'free' };
  }
  // --- Flutterwave (to implement when going live) ---
  // Real flow is a client redirect, not a server-side charge:
  //   1) client calls FlutterwaveCheckout({ public_key, tx_ref, amount, currency, customer })
  //   2) after payment the client returns with transaction_id
  //   3) verify here: GET https://api.flutterwave.com/v3/transactions/:id/verify
  //        headers: { Authorization: `Bearer ${FLW_SECRET}` }
  //      and confirm data.status==='successful' && data.amount>=amount && data.currency===currency
  // Until that is wired, refuse rather than pretend a real charge happened.
  throw new Error('Live payments are not configured yet. Set PAYMENTS_PROVIDER=flutterwave and FLW_SECRET_KEY to enable checkout.');
}
