// EFIKO — capability model (server authority) for the role-based application architecture.
// A user's segment/accountType + role decides which capabilities their account holds. The
// server computes these and stamps them onto publicUser, so the client renders from a list it
// can trust rather than re-deriving permissions it could tamper with. Endpoints that guard a
// capability should call accountCan() rather than re-checking roles ad hoc, so the rules live
// in exactly one place as the platform grows (creator env, institutions, operations center).
//
// Capabilities (end-user application layer; operator/admin powers live in their own flows):
//   learn               — take courses, ask the tutor, earn certificates (everyone)
//   teach               — author & publish lessons, run classes/programmes
//   sell                — list and sell courses on the marketplace
//   manage_institution  — run an institution: cohorts, branding, outcomes
export function abilitiesFor(user = {}) {
  const role = user.role;
  const accountType = user.accountType || 'learner';
  const caps = ['learn'];
  if (role === 'lecturer' || accountType === 'organization') caps.push('teach');
  if (accountType === 'creator') caps.push('sell');
  if (accountType === 'organization') caps.push('manage_institution');
  return caps;
}

export const accountCan = (user, capability) => abilitiesFor(user || {}).includes(capability);
