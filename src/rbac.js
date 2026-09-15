// EFIKO — client capability helper (role-based application architecture).
// The server stamps a server-vouched `abilities` list onto the signed-in user (see
// server/core/rbac.js). The UI renders from that list rather than re-deriving permissions,
// so navigation and routing stay consistent and can't be tampered with client-side.
export const can = (user, capability) =>
  !!user && Array.isArray(user.abilities) && user.abilities.includes(capability);

// Where an account should land right after signing up / in — creators and institutions go
// straight to their workspace; learners (and visitors) go to the learner home.
export function homeSectionFor(user) {
  if (!user) return 'home';
  if (user.accountType === 'creator' || user.accountType === 'organization') return 'teach';
  return 'home';
}
