// Efiko core — University registry + topic aliases.
// Stage 1 §3.3: the course-code system must scale to unlimited African universities,
// so institutions are DATA, not code. Add a row to onboard a university or topic.

export const UNIVERSITIES = {
  KIU:  'Kampala International University',
  MAK:  'Makerere University',
  MUBS: 'Makerere University Business School',
  KYU:  'Kyambogo University',
  MUST: 'Mbarara University of Science and Technology',
  UCU:  'Uganda Christian University'
};

// Topic aliases → capsuleId, so "IRT" or "3PL" resolve to the right lesson.
// (In later stages this is generated/extended by the AI Processing Engine.)
export const TOPIC_ALIASES = {
  'kiu-psy720-irt-c1': ['irt', 'item response', 'item response theory', 'icc', 'characteristic curve'],
  'kiu-psy720-irt-c2': ['parameter', 'parameters', '3pl', 'discrimination', 'difficulty', 'guessing'],
  'mak-eco110-gdp-c1': ['gdp', 'gross domestic', 'gross domestic product', 'expenditure', 'national income']
};
