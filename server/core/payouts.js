// EFIKO — payout dispatcher. Presents one payout API to the app and routes to Flutterwave v4
// (OAuth, multi-country bank + mobile money) when configured, else the legacy v3 transfer, else
// "not live". Keeps index.js/marketplace.js free of provider branching.
import { paymentsLive as v3Live, listBanks as v3ListBanks, initiateTransfer as v3Transfer } from './payments.js';
import { v4Configured, v4ListBanks, v4CreateTransfer } from './paymentsV4.js';

// Can we send real payouts at all?
export function payoutsLive() { return v4Configured() || v3Live(); }
export function payoutsProvider() { return v4Configured() ? 'flutterwave_v4' : (v3Live() ? 'flutterwave' : 'none'); }

// Bank list for a country's payout picker.
export async function listPayoutBanks(country = 'NG') {
  if (v4Configured()) return v4ListBanks(country);
  if (v3Live()) return v3ListBanks(country);
  return { ok: true, banks: [] };
}

// Send a payout to a saved destination `d`. Returns { ok, transferId, status, recipientName, detail? }.
export async function sendPayout(d, { amount, currency, reference, narration }) {
  if (v4Configured()) return v4CreateTransfer({ ...d, currency }, { amount, reference, narration });
  if (v3Live()) return v3Transfer({ bankCode: d.bankCode, accountNumber: d.accountNumber, amount, currency, reference, narration });
  return { ok: false, detail: 'Live payments are not configured.' };
}
