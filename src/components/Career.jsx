// EFIKO — Career section (V2 R5). A lightweight career hub: a portfolio summary drawn from
// the learner's certificates and mastered courses, plus an opportunities board (jobs,
// internships, scholarships) posted by institutions, which students can bookmark.
import { useEffect, useState } from 'react';
import { listOpportunities, listSaved, toggleSaved } from '../career.js';
import { fetchMyCertificates, fetchMyProgress, CERT_PASS_MARK } from '../certificates.js';

const TYPE_META = {
  job: { label: 'Job', icon: '💼' },
  internship: { label: 'Internship', icon: '🌱' },
  scholarship: { label: 'Scholarship', icon: '🎓' },
  volunteer: { label: 'Volunteer', icon: '🤝' }
};
const fmtDeadline = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function Career({ signedIn }) {
  const [opps, setOpps] = useState([]);
  const [saved, setSaved] = useState([]);
  const [certs, setCerts] = useState([]);
  const [mastered, setMastered] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [o, s, c, p] = await Promise.all([
        listOpportunities(),
        signedIn ? listSaved() : Promise.resolve([]),
        signedIn ? fetchMyCertificates() : Promise.resolve([]),
        signedIn ? fetchMyProgress() : Promise.resolve([])
      ]);
      setOpps(o); setSaved(s); setCerts(c);
      setMastered(p.filter((x) => (x.bestQuizPct ?? -1) >= CERT_PASS_MARK).length);
      setLoaded(true);
    })();
  }, [signedIn]);

  async function save(id) {
    const prev = saved;
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    try { setSaved(await toggleSaved(id)); } catch { setSaved(prev); }
  }

  const types = ['all', 'saved', ...Object.keys(TYPE_META)];
  const shown = opps.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'saved') return saved.includes(o.id);
    return o.type === filter;
  });

  return (
    <section className="career">
      <h2>🚀 Career</h2>
      <p className="lib-sub">Turn your learning into opportunities — track your portfolio and discover roles, internships and scholarships.</p>

      {signedIn && (
        <div className="career-portfolio">
          <div className="career-stat"><strong>{certs.length}</strong><span>Certificates</span></div>
          <div className="career-stat"><strong>{mastered}</strong><span>Courses mastered</span></div>
          <div className="career-stat"><strong>{saved.length}</strong><span>Saved roles</span></div>
        </div>
      )}

      <div className="career-filters">
        {types.map((t) => (
          <button key={t} className={`chip ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : t === 'saved' ? '★ Saved' : `${TYPE_META[t].icon} ${TYPE_META[t].label}`}
          </button>
        ))}
      </div>

      {loaded && opps.length === 0 && <p className="career-empty">No opportunities posted yet. Check back soon — your institution can post roles, internships and scholarships here.</p>}
      {loaded && opps.length > 0 && shown.length === 0 && <p className="career-empty">Nothing matches this filter.</p>}

      <div className="career-list">
        {shown.map((o) => {
          const m = TYPE_META[o.type] || TYPE_META.job;
          const isSaved = saved.includes(o.id);
          return (
            <article key={o.id} className="opp-card">
              <div className="opp-head">
                <span className="opp-type">{m.icon} {m.label}</span>
                {o.deadline && <span className="opp-deadline">Apply by {fmtDeadline(o.deadline)}</span>}
              </div>
              <h3 className="opp-title">{o.title}</h3>
              {(o.org || o.location) && <p className="opp-org">{[o.org, o.location].filter(Boolean).join(' · ')}</p>}
              {o.description && <p className="opp-desc">{o.description}</p>}
              <div className="opp-actions">
                {o.url && <a className="course-open" href={o.url} target="_blank" rel="noreferrer">View & apply</a>}
                {signedIn && (
                  <button className={`opp-save ${isSaved ? 'on' : ''}`} onClick={() => save(o.id)}>
                    {isSaved ? '★ Saved' : '☆ Save'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
