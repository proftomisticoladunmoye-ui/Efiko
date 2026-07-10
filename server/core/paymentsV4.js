// EFIKO — Flutterwave v4 payment features. Built on flutterwaveV4.js (OAuth + request helper).
// Multi-country by design: payouts go to a bank account OR mobile-money wallet depending on the
// creator's country, using v4's currency-specific payment_instruction. Schemas verified against
// the Flutterwave sandbox (a NGN bank transfer returns 201 with an auto-resolved account name).
import { randomUUID } from 'node:crypto';
import { flwV4, v4Configured, v4Env } from './flutterwaveV4.js';

export { v4Configured, v4Env };

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
