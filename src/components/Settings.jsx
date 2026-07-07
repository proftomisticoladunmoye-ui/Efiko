// EFIKO — Settings / account hub. For signed-in learners it connects the data we already
// have — account, AI credits, learning stats (XP/level/streak), certificates — into one
// place, with quick links to the sections that manage them. Guests get a sign-in prompt.
import { useEffect, useState } from 'react';
import { fetchCredits } from '../aiClient.js';
import { fetchGamifyStats } from '../gamify.js';
import { fetchMyCertificates } from '../certificates.js';
import { fetchReferral, inviteLink } from '../referral.js';
import ShareButton from './ShareButton.jsx';

export default function Settings({ user, onSignOut, onSignIn, onGoSection }) {
  const [credits, setCredits] = useState(null);
  const [stats, setStats] = useState(null);
  const [certs, setCerts] = useState(null);
  const [ref, setRef] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchCredits().then(setCredits);
    fetchGamifyStats().then(setStats);
    fetchMyCertificates().then((c) => setCerts(c.length));
    fetchReferral().then(setRef);
    const refresh = () => { fetchCredits().then(setCredits); fetchGamifyStats().then(setStats); fetchReferral().then(setRef); };
    window.addEventListener('efiko-ai-used', refresh);
    window.addEventListener('efiko-progress', refresh);
    return () => { window.removeEventListener('efiko-ai-used', refresh); window.removeEventListener('efiko-progress', refresh); };
  }, [user]);

  if (!user) {
    return (
      <div className="settings-page">
        <h2 className="set-h">⚙️ Settings</h2>
        <p className="lib-sub">You're browsing as a guest. <button className="footer-link" onClick={onSignIn}>Sign in</button> to save your progress, credits and certificates across devices.</p>
      </div>
    );
  }

  const tier = credits?.tier || 'free';
  return (
    <div className="settings-page">
      <h2 className="set-h">⚙️ Settings</h2>

      {ref?.code && (
        <section className="set-card set-invite">
          <h3>🎁 Invite friends, earn XP</h3>
          <p className="set-sub">Share EFIKO — when a friend joins with your link, you earn {ref.xpPerReferral || 40} XP and a badge.</p>
          <div className="set-invite-row">
            <input className="ask-input set-invite-link" readOnly value={inviteLink(ref.code)} onFocus={(e) => e.target.select()} aria-label="Your invite link" />
            <ShareButton url={inviteLink(ref.code)} title="Learn on EFIKO" label="Share invite"
              message="Join me on EFIKO — free courses, an AI tutor and real certificates. Learn anywhere, understand everything:" />
          </div>
          <p className="set-sub">{ref.count > 0 ? `🎉 ${ref.count} friend${ref.count !== 1 ? 's' : ''} joined via your link.` : 'No friends yet — share your link to get started.'}</p>
        </section>
      )}

      <div className="set-grid">
        <section className="set-card set-account">
          <div className="set-avatar">{(user.name || '?').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className="set-tier">{tier} plan</span>
          </div>
        </section>

        <section className="set-card">
          <h3>⚡ AI Credits</h3>
          {credits
            ? <><p className="set-big">{credits.balance}<em> / {credits.dailyGrant} today</em></p><p className="set-sub">Refreshes daily · {tier} plan. Used for AI answers, ThinkSpace and voice.</p></>
            : <p className="set-sub">—</p>}
        </section>

        <section className="set-card">
          <h3>🎮 Learning</h3>
          {stats
            ? <><p className="set-big">Level {stats.level}<em> · {stats.xp} XP</em></p><p className="set-sub">🔥 {stats.streak}-day streak · {(stats.badges || []).length} badge{(stats.badges || []).length !== 1 ? 's' : ''}</p></>
            : <p className="set-sub">Start learning to earn XP.</p>}
        </section>

        <button className="set-card set-link" onClick={() => onGoSection('certificates')}>
          <h3>🎓 Certificates</h3>
          <p className="set-big">{certs ?? '—'}</p>
          <p className="set-sub">View & verify your certificates →</p>
        </button>

        <button className="set-card set-link" onClick={() => onGoSection('library')}>
          <h3>📥 Offline & downloads</h3>
          <p className="set-sub">Manage downloaded lessons for offline learning →</p>
        </button>
      </div>

      <div className="set-actions">
        <button className="course-share-btn" onClick={onSignOut}>Sign out</button>
      </div>
      <p className="set-ver">Efiko · Learn Anywhere. Understand Everything.</p>
    </div>
  );
}
