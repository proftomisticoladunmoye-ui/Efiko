// EFIKO — gamification (XP, levels, streaks, badges). Awards are made SERVER-SIDE on real
// recorded events (progress, teach-back, certificates), so they can't be faked from the
// client. kv-backed, one record per user. Rewards progress, not just completion.
import { kvGet, kvPut } from './kv.js';

const COLL = 'gamification';
const today = () => new Date().toISOString().slice(0, 10);

// XP per event.
const XP = { session: 5, quiz_pass: 20, teachback: 15, course_complete: 100, certificate: 50, referral: 40 };

// Level curve: level L starts at 100*(L-1)^2 XP (1, 100, 400, 900, 1600, …).
export function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const curBase = 100 * (level - 1) ** 2;
  const nextBase = 100 * level ** 2;
  return { level, xpIntoLevel: xp - curBase, xpForLevel: nextBase - curBase, xpToNext: nextBase - xp };
}

// Badge definitions: id -> { label, earned(stats) }.
const BADGES = [
  { id: 'first-steps', label: 'First Steps', icon: '🌱', earned: (s) => s.xp > 0 },
  { id: 'quiz-master', label: 'Quiz Master', icon: '🎯', earned: (s) => s.quizzesPassed >= 10 },
  { id: 'first-course', label: 'Course Complete', icon: '📘', earned: (s) => s.coursesCompleted >= 1 },
  { id: 'scholar', label: 'Scholar', icon: '🎓', earned: (s) => s.coursesCompleted >= 3 },
  { id: 'certified', label: 'Certified', icon: '📜', earned: (s) => s.certificates >= 1 },
  { id: 'streak-3', label: '3-Day Streak', icon: '🔥', earned: (s) => s.longestStreak >= 3 },
  { id: 'streak-7', label: 'Week Warrior', icon: '⚡', earned: (s) => s.longestStreak >= 7 },
  { id: 'connector', label: 'Connector', icon: '🤝', earned: (s) => (s.referrals || 0) >= 1 },
  { id: 'ambassador', label: 'Ambassador', icon: '📣', earned: (s) => (s.referrals || 0) >= 5 }
];

function fresh(userId) {
  return { userId, xp: 0, streak: 0, longestStreak: 0, lastActive: null, quizzesPassed: 0, coursesCompleted: 0, certificates: 0, referrals: 0, badges: [], updatedAt: Date.now() };
}

function updateStreak(s) {
  const d = today();
  if (s.lastActive === d) return; // already counted today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.streak = s.lastActive === yesterday ? s.streak + 1 : 1;
  s.longestStreak = Math.max(s.longestStreak || 0, s.streak);
  s.lastActive = d;
}

export async function getStats(userId) {
  const s = (await kvGet(COLL, userId)) || fresh(userId);
  return { xp: s.xp, ...levelInfo(s.xp), streak: s.streak, longestStreak: s.longestStreak, coursesCompleted: s.coursesCompleted, quizzesPassed: s.quizzesPassed, certificates: s.certificates, referrals: s.referrals || 0, badges: BADGES.filter((b) => (s.badges || []).includes(b.id)).map((b) => ({ id: b.id, label: b.label, icon: b.icon })) };
}

// Award XP for an event and refresh streak + badges. Returns fresh stats.
export async function award(userId, event) {
  if (!userId) return null;
  const s = (await kvGet(COLL, userId)) || fresh(userId);
  updateStreak(s);
  s.xp += XP[event] || 0;
  if (event === 'quiz_pass') s.quizzesPassed = (s.quizzesPassed || 0) + 1;
  if (event === 'course_complete') s.coursesCompleted = (s.coursesCompleted || 0) + 1;
  if (event === 'certificate') s.certificates = (s.certificates || 0) + 1;
  if (event === 'referral') s.referrals = (s.referrals || 0) + 1;
  const have = new Set(s.badges || []);
  for (const b of BADGES) if (!have.has(b.id) && b.earned(s)) have.add(b.id);
  s.badges = [...have];
  s.updatedAt = Date.now();
  await kvPut(COLL, userId, s);
  return getStats(userId);
}
