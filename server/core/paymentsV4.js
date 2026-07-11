// EFIKO — Flutterwave v4 payment features. Built on flutterwaveV4.js (OAuth + request helper).
// Multi-country by design: payouts go to a bank account OR mobile-money wallet depending on the
// creator's country, using v4's currency-specific payment_instruction. Schemas verified against
// the Flutterwave sandbox (a NGN bank transfer returns 201 with an auto-resolved account name).
import { randomUUID } from 'node:crypto';
import { flwV4, v4Configured, v4Env, v4EncryptionKey } from './flutterwaveV4.js';

export { v4Configured, v4Env, v4EncryptionKey };

// v4 references must be alphanumeric (underscores are rejected).
const ref = (p = 'efiko') => (p + randomUUID().replace(/-/g, '')).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);

// List payout banks for a country (GET /banks?country=NG). Returns [{ code, name }].
export async function v4ListBanks(country = 'NG') {
  const { ok, data } = await flwV4('GET', `/banks?country=${encodeURIComponent(String(country).toUpperCase())}`);
  if (!ok) return { ok: false, detail: data?.error?.message || 'could not load banks' };
  const list = data?.data || data?.banks || [];
  return { ok: true, banks: list.map((b) => ({ code: b.code, name: b.name })).filter((b) => b.code && b.name) };
}

// Create a payout (direct transfer). `d` is the creator's payout destination:
//   bank:         { method:'bank', currency, bankCode, accountNumber }
//   mobile money: { method:'mobile_money', currency, network, phone, firstName, lastName }
// Transfers settle asynchronously — returns the queued transfer ({ status:'NEW' }); the final
// state arrives via the v4 webhook. Returns { ok, transferId, status, reference, recipientName }.
export async function v4CreateTransfer(d, { amount, narration = 'EFIKO creator payout', reference } = {}) {
  const currency = d.currency;
  const type = d.method === 'mobile_money' ? 'mobile_money' : 'bank';
  const recipient = type === 'bank'
    ? { bank: { account_number: d.accountNumber, code: d.bankCode } }
    : { name: { first: d.firstName || 'EFIKO', last: d.lastName || 'Creator' }, mobile_money: { network: d.network, msisdn: d.phone } };
  const payload = {
    action: 'instant',
    reference: reference || ref(),
    narration: String(narration).slice(0, 180),
    type,
    payment_instruction: {
      source_currency: currency,
      destination_currency: currency,
      amount: { value: Number(amount), currency, applies_to: 'destination_currency' },
      recipient
    }
  };
  const { ok, status, data } = await flwV4('POST', '/direct-transfers', { body: payload, idempotent: true });
  if (!ok) {
    const ve = data?.error?.validation_errors;
    return { ok: false, detail: data?.error?.message || `transfer failed (${status})`, validation: ve };
  }
  const r = data.data || data;
  const nm = r.recipient?.name ? `${r.recipient.name.first || ''} ${r.recipient.name.last || ''}`.trim() : '';
  return { ok: true, transferId: r.id, status: r.status, reference: r.reference, recipientName: nm };
}

// --- Checkout (collections): buyer pays for a listing. Mobile money is PCI-safe (no card data
// touches us) and dominant in EFIKO's markets. Flow: customer -> payment_method -> charge; the
// charge returns next_action (a phone-approval prompt) and settles to 'succeeded' async, which
// we confirm by polling GET /charges/{id} (and the webhook as backup). Verified on sandbox. ---
const v4Post = (path, body) => flwV4('POST', path, { body, idempotent: true });

export async function v4CreateCustomer(email) {
  // Email is all that's required. (v4 enforces strict name rules — 2–50 letters — so we omit it
  // rather than risk rejecting the charge over a short/odd display name.)
  const { ok, data } = await v4Post('/customers', { email });
  return ok ? { ok: true, id: (data.data || data).id } : { ok: false, detail: data?.error?.message || 'could not create customer', conflict: data?.error?.code === '10409' || /already exists/i.test(data?.error?.message || '') };
}

// Fall-back lookup when a customer already exists (v4 rejects duplicate emails). The list
// endpoint doesn't actually filter by email, so we match client-side over the returned page.
export async function v4FindCustomerByEmail(email) {
  const { ok, data } = await flwV4('GET', `/customers?email=${encodeURIComponent(email)}`);
  if (!ok) return null;
  const m = (data.data || []).find((c) => String(c.email || '').toLowerCase() === String(email).toLowerCase());
  return m?.id || null;
}

export async function v4CreateMomoMethod({ network, countryCode, phone }) {
  const { ok, data } = await v4Post('/payment-methods', { type: 'mobile_money', mobile_money: { network, country_code: countryCode, phone_number: phone } });
  return ok ? { ok: true, id: (data.data || data).id } : { ok: false, detail: JSON.stringify(data?.error?.validation_errors || data?.error?.message || 'invalid mobile money details') };
}

export async function v4CreateCharge({ customerId, paymentMethodId, amount, currency, reference, redirectUrl }) {
  const { ok, data } = await v4Post('/charges', { reference, currency, customer_id: customerId, payment_method_id: paymentMethodId, amount: Number(amount), redirect_url: redirectUrl });
  const d = data.data || data;
  return ok ? { ok: true, chargeId: d.id, status: d.status, nextAction: d.next_action, reference: d.reference } : { ok: false, detail: data?.error?.message || 'charge failed' };
}

export async function v4GetCharge(chargeId) {
  const { ok, data } = await flwV4('GET', `/charges/${encodeURIComponent(chargeId)}`);
  const d = data.data || data;
  return ok ? { ok: true, status: d.status, chargeId: d.id } : { ok: false, detail: data?.error?.message || 'charge lookup failed' };
}

// mobile-money method -> charge (the customer is created/reused by the caller). Returns
// { chargeId, status, nextAction }.
export async function v4StartMomoCharge({ customerId, network, countryCode, phone, amount, currency, reference, redirectUrl }) {
  const pm = await v4CreateMomoMethod({ network, countryCode, phone }); if (!pm.ok) return pm;
  return v4CreateCharge({ customerId, paymentMethodId: pm.id, amount, currency, reference, redirectUrl });
}

// Card: the browser already encrypted the card fields (AES-256-GCM) — we never see the raw PAN.
// `card` = { nonce, encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year,
// encrypted_cvv }. The charge typically returns a 3DS redirect in next_action.
export async function v4CreateCardMethod(card) {
  const { ok, data } = await v4Post('/payment-methods', { type: 'card', card });
  return ok ? { ok: true, id: (data.data || data).id } : { ok: false, detail: JSON.stringify(data?.error?.validation_errors || data?.error?.message || 'invalid card') };
}
export async function v4StartCardCharge({ customerId, card, amount, currency, reference, redirectUrl }) {
  const pm = await v4CreateCardMethod(card); if (!pm.ok) return pm;
  return v4CreateCharge({ customerId, paymentMethodId: pm.id, amount, currency, reference, redirectUrl });
}
