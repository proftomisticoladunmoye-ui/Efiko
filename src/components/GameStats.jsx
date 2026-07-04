// EFIKO — gamification widget (Home dashboard). Shows the learner's level, XP progress,
// learning streak and earned badges. Refreshes when a learning event is reported.
import { useEffect, useState } from 'react';
import { fetchGamifyStats } from '../gamify.js';

export default function GameStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => fetchGamifyStats().then(setS);
    load();
    window.addEventListener('efiko-progress', load);
    return () => window.removeEventListener('efiko-progress', load);
  }, []);

  if (!s) return null;
  const pct = s.xpForLevel ? Math.min(100, Math.round((s.xpIntoLevel / s.xpForLevel) * 100)) : 0;

  return (
    <section className="gamestats">
      <div className="gs-top">
        <div className="gs-level"><span className="gs-level-num">{s.level}</span><span className="gs-level-lbl">Level</span></div>
        <div className="gs-xp">
          <div className="gs-xp-head"><strong>{s.xp} XP</strong><span>{s.xpToNext} XP to level {s.level + 1}</span></div>
          <div className="gs-bar"><span style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="gs-streak" title="Learning streak">🔥 <strong>{s.streak}</strong><span>day{s.streak !== 1 ? 's' : ''}</span></div>
      </div>
      {s.badges.length > 0 && (
        <div className="gs-badges">{s.badges.map((b) => <span key={b.id} className="gs-badge" title={b.label}>{b.icon} {b.label}</span>)}</div>
      )}
    </section>
  );
}
