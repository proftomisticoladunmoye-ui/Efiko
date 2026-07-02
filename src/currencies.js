// EFIKO — supported currencies (V2 R5, Marketplace). Per-listing currency so institutions in
// different countries price in their own money. Codes are ISO 4217; all are Flutterwave-payable.
export const CURRENCIES = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' }
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
const MAP = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export function currencySymbol(code) {
  return MAP[code]?.symbol || `${code} `;
}

// Free -> "Free"; otherwise symbol + grouped amount. Letter-ending symbols (KSh, CFA…) get a
// space; glyphs (₦, $, €) don't.
export function formatMoney(amount, code = 'NGN') {
  if (!amount || amount === 0) return 'Free';
  const sym = MAP[code]?.symbol || `${code} `;
  const sep = /[A-Za-z]$/.test(sym) ? ' ' : '';
  return `${sym}${sep}${Number(amount).toLocaleString()}`;
}
