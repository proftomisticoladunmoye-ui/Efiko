// EFIKO — account segments (server authority). Mirrors the ids in src/segments.js and is the
// single place that decides what an account of each segment becomes: its coarse accountType
// (learner | creator | organization), its base role, and whether it is likely to belong to a
// minor (so later stages can apply age-appropriate protections). Keeping this on the server
// means the client can never grant itself a role it shouldn't have.
const MAP = {
  university:   { accountType: 'learner',      role: 'student'  },
  school:       { accountType: 'learner',      role: 'student',  minorLikely: true },
  professional: { accountType: 'learner',      role: 'student'  },
  creator:      { accountType: 'creator',      role: 'lecturer' },
  institution:  { accountType: 'organization', role: 'student'  },
  corporate:    { accountType: 'organization', role: 'student'  }
};

export const isValidSegment = (id) => Object.prototype.hasOwnProperty.call(MAP, id);

// Derive the account shape from a chosen segment. Unknown/absent → a plain learner, so the
// endpoint never fails on a bad value; it simply falls back to the safe default.
export function deriveFromSegment(id) {
  const m = MAP[id];
  if (!m) return { segment: null, accountType: 'learner', role: 'student', minorLikely: false };
  return { segment: id, accountType: m.accountType, role: m.role, minorLikely: !!m.minorLikely };
}
