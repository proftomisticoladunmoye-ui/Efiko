// EFIKO — learner / customer segments (client single source of truth).
// Shared by the landing page, the signup panel and (as the roadmap advances) role-based
// routing, product analytics and age-appropriate protections. The server mirrors these ids
// in server/core/segments.js and is the authority on what each segment is allowed to become.
export const SEGMENTS = [
  { id: 'university',   icon: '🎓', short: 'University',   title: 'University students',    accountType: 'learner',      line: 'Ace courses with an AI tutor that explains, quizzes and revises with you.' },
  { id: 'school',       icon: '📚', short: 'School',       title: 'Secondary & primary',    accountType: 'learner',      line: 'Clear, patient lessons that meet each learner at their level.' },
  { id: 'professional', icon: '💼', short: 'Professional', title: 'Professionals',          accountType: 'learner',      line: 'Upskill on your schedule and earn certificates that verify.' },
  { id: 'creator',      icon: '✍️', short: 'Creator',      title: 'Course creators',        accountType: 'creator',      line: 'Build visual lessons and sell them to learners across Africa.' },
  { id: 'institution',  icon: '🏫', short: 'Institution',  title: 'Schools & universities', accountType: 'organization', line: 'Run cohorts, track outcomes and brand Efiko as your own.' },
  { id: 'corporate',    icon: '🏢', short: 'Corporate',    title: 'Corporate teams',        accountType: 'organization', line: 'Train teams with measurable progress and completion reporting.' }
];

export const SEGMENT_IDS = SEGMENTS.map((s) => s.id);
export const segmentById = (id) => SEGMENTS.find((s) => s.id === id) || null;
export const segmentLabel = (id) => segmentById(id)?.short || '';
export const accountTypeFor = (id) => segmentById(id)?.accountType || 'learner';
