// Efiko — monetization tiers (launch is FREE; payment arrives later).
// During the free launch window everything is unlocked. When payment goes live,
// set FREE_PERIOD = false and the listed features become Premium-only — no other
// code changes needed (call canUse('feature') at the gate points).
export const FREE_PERIOD = true;

// Features that will become Premium once the free window ends.
export const PREMIUM_FEATURES = new Set([
  'unlimited-ai',   // unlimited "Ask Efiko" / Snap generations
  'exam-mode',      // adaptive practice + past-paper predictions
  'offline-packs'   // download whole courses for offline
]);

/** During the free period everything is allowed. Later, gate Premium features. */
export function canUse(/* feature */ _feature, isPremium = false) {
  if (FREE_PERIOD) return true;
  if (!PREMIUM_FEATURES.has(_feature)) return true;
  return isPremium;
}
