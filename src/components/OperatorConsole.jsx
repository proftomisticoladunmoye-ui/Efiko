// EFIKO — Platform Operator console (YOU, the owner). Reached at ?operator. A real
// email+password login (distinct from learner and institution logins) unlocks the owner
// dashboard: platform stats, the EFIKO Originals review/publish queue, course generation,
// creator payout approvals, and career-aggregation control. All actions hit operator-gated
// endpoints with the operator bearer token.
import { useState, useEffect, useCallback } from 'react';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const TOKEN_KEY = 'efiko-operator-token';

const STATUS_LABEL = { draft: 'Draft', in_review: 'In review', published: 'Published', archived: 'Archived' };

export default function OperatorConsole({ onExit }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [operator, setOperator] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [originals, setOriginals] = useState(null);
  const [payouts, setPayouts] = useState(null);
  const [note, setNote] = useState(null);
  const [gen, setGen] = useState({ topic: '', audience: 'African university students', hours: 2, level: 'beginner' });

  const authed = useCallback((path, opts = {}) => fetch(`${GATEWAY}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
  }), [token]);

  function logout() { localStorage.removeItem(TOKEN_KEY); setToken(''); setOperator(null); }

  const loadStats = useCallback(async () => {
    try { const r = await authed('/operator/stats'); if (r.ok) setStats(await r.json()); } catch { /* offline */ }
  }, [authed]);
  const loadOriginals = useCallback(async () => {
    try { const r = await authed('/admin/originals'); if (r.ok) setOriginals((await r.json()).courses || []); } catch { /* offline */ }
  }, [authed]);
  const loadPayouts = useCallback(async () => {
    try { const r = await authed('/operator/payouts'); if (r.ok) setPayouts((await r.json()).payouts || []); } catch { /* offline */ }
  }, [authed]);

  // Validate the stored token on mount, then load the dashboard data.
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await authed('/operator/me');
        if (!r.ok) { logout(); return; }
        setOperator((await r.json()).operator);
        loadStats(); loadOriginals(); loadPayouts();
      } catch { /* gateway down */ }
    })();
  }, []); // eslint-disable-line

  async function login(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${GATEWAY}/operator/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Login failed');
      localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token); setOperator(d.operator);
      setEmail(''); setPassword('');
      // token state updates async; fetch with the fresh token directly
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${d.token}` };
      fetch(`${GATEWAY}/operator/stats`, { headers: h }).then((x) => x.ok && x.json().then(setStats));
      fetch(`${GATEWAY}/admin/originals`, { headers: h }).then((x) => x.ok && x.json().then((j) => setOriginals(j.courses || [])));
      fetch(`${GATEWAY}/operator/payouts`, { headers: h }).then((x) => x.ok && x.json().then((j) => setPayouts(j.payouts || [])));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function setStatus(courseId, status) {
    setNote(null);
    try {
      const r = await authed(`/originals/${encodeURIComponent(courseId)}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Update failed'); }
      await loadOriginals(); await loadStats();
      setNote(`✓ ${courseId} → ${STATUS_LABEL[status] || status}`);
    } catch (e2) { setNote(`⚠ ${e2.message}`); }
  }

  async function generate(e) {
    e.preventDefault();
    if (!gen.topic.trim()) return;
    setBusy(true); setNote('Generating course — this can take a minute…');
    try {
      const r = await authed('/originals/generate', { method: 'POST', body: JSON.stringify({ ...gen, hours: Number(gen.hours) || 2 }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Generation failed');
      setNote(`✓ Created “${d.title}” (${d.sessionCount} sessions, ${d.status}). Review it below, then publish.`);
      setGen((g) => ({ ...g, topic: '' }));
      await loadOriginals(); await loadStats();
    } catch (e2) { setNote(`⚠ ${e2.message}`); } finally { setBusy(false); }
  }

  async function markPaid(p) {
    setNote(null);
    try {
      const r = await authed('/operator/payouts/mark-paid', { method: 'POST', body: JSON.stringify({ creatorId: p.creatorId, currency: p.currency }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed');
      setNote(`✓ Marked ${d.paid} earning(s) paid (${p.currency} ${d.net}) for ${p.creatorName}.`);
      await loadPayouts(); await loadStats();
    } catch (e2) { setNote(`⚠ ${e2.message}`); }
  }

  async function runAggregation() {
    setNote('Fetching latest opportunities…');
    try {
      const r = await authed('/career/aggregate', { method: 'POST', body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Aggregation failed');
      setNote(`✓ Aggregation ran. ${d.added || 0} new · ${d.total ?? '?'} in the pool.`);
      await loadStats();
    } catch (e2) { setNote(`⚠ ${e2.message}`); }
  }

  if (!operator) {
    return (
      <div className="admin op-console">
        <button className="back" onClick={onExit}>← Exit</button>
        <h2>🛠️ EFIKO Operator</h2>
        <form className="admin-form" onSubmit={login}>
          <p className="admin-sub">Platform owner sign-in. This is separate from learner and institution accounts.</p>
          <input className="ask-input" type="email" placeholder="Operator email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="ask-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <button className="admin-btn" type="submit" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {err && <p className="error">{err}</p>}
          <p className="admin-sub op-hint">No operator account yet? Set <code>OPERATOR_EMAIL</code> + <code>OPERATOR_PASSWORD</code> in your Render env — the first operator is seeded on startup.</p>
        </form>
      </div>
    );
  }

  const reviewQueue = (originals || []).filter((c) => c.status !== 'published' && c.status !== 'archived');
  const published = (originals || []).filter((c) => c.status === 'published');

  return (
    <div className="admin op-console">
      <button className="back" onClick={onExit}>← Exit</button>
      <div className="op-topbar">
        <h2>🛠️ EFIKO Operator</h2>
        <span className="op-who">{operator.name} · <button className="ghost" onClick={logout}>Sign out</button></span>
      </div>

      <div className="op-tabs">
        {['overview', 'originals', 'payouts', 'careers'].map((t) => (
          <button key={t} className={`op-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'originals' ? `Originals${reviewQueue.length ? ` (${reviewQueue.length})` : ''}` : t === 'payouts' ? `Payouts${(payouts?.length) ? ` (${payouts.length})` : ''}` : 'Careers'}
          </button>
        ))}
      </div>

      {note && <p className="op-note">{note}</p>}

      {tab === 'overview' && (
        <div className="op-stats">
          {stats ? <>
            <Stat n={stats.users} label="Learners" />
            <Stat n={stats.certificates} label="Certificates issued" />
            <Stat n={stats.originals?.published} label="Originals published" />
            <Stat n={stats.originals?.review} label="Awaiting review" warn={stats.originals?.review > 0} />
            <Stat n={stats.opportunities} label="Opportunities live" />
            <Stat n={stats.listings} label="Marketplace listings" />
            <Stat n={stats.payoutsPending} label="Payouts pending" warn={stats.payoutsPending > 0} />
            <div className="op-stat">
              <strong className={stats.durableAccounts ? '' : 'op-bad'}>{stats.durableAccounts ? 'Durable' : 'Ephemeral'}</strong>
              <span>Account storage</span>
            </div>
          </> : <p className="admin-sub">Loading platform stats…</p>}
        </div>
      )}

      {tab === 'originals' && (
        <div className="op-section">
          <form className="op-gen" onSubmit={generate}>
            <h3>Generate a new Original</h3>
            <div className="op-gen-row">
              <input className="ask-input" placeholder="Topic (e.g. Introduction to Epidemiology)" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })} disabled={busy} />
              <select className="ask-input op-sel" value={gen.level} onChange={(e) => setGen({ ...gen, level: e.target.value })} disabled={busy}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <input className="ask-input op-hours" type="number" min="1" max="8" value={gen.hours} onChange={(e) => setGen({ ...gen, hours: e.target.value })} disabled={busy} title="Estimated hours" />
              <button className="admin-btn" type="submit" disabled={busy || !gen.topic.trim()}>{busy ? 'Working…' : 'Generate'}</button>
            </div>
            <input className="ask-input" placeholder="Audience" value={gen.audience} onChange={(e) => setGen({ ...gen, audience: e.target.value })} disabled={busy} />
          </form>

          <h3>Review queue {reviewQueue.length ? `(${reviewQueue.length})` : ''}</h3>
          {originals === null ? <p className="admin-sub">Loading…</p>
            : reviewQueue.length === 0 ? <p className="admin-sub">Nothing awaiting review. 🎉</p>
              : reviewQueue.map((c) => (
                <div key={c.courseId} className="op-course">
                  <div>
                    <strong>{c.title}</strong>
                    <span className="op-meta">{STATUS_LABEL[c.status] || c.status} · {c.sessions?.length || c.sessionCount || 0} sessions</span>
                  </div>
                  <div className="op-course-actions">
                    <button className="admin-btn" onClick={() => setStatus(c.courseId, 'published')}>Publish</button>
                    {c.status === 'draft' && <button className="ghost" onClick={() => setStatus(c.courseId, 'in_review')}>Mark in review</button>}
                  </div>
                </div>
              ))}

          <h3>Published {published.length ? `(${published.length})` : ''}</h3>
          {published.map((c) => (
            <div key={c.courseId} className="op-course op-pub">
              <div><strong>{c.title}</strong><span className="op-meta">Live · {c.sessions?.length || c.sessionCount || 0} sessions</span></div>
              <button className="ghost" onClick={() => setStatus(c.courseId, 'draft')}>Unpublish</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="op-section">
          <h3>Creator payout requests</h3>
          <p className="admin-sub">Approve after you disburse the transfer (Flutterwave or manual). Marking paid settles the creator's requested earnings.</p>
          {payouts === null ? <p className="admin-sub">Loading…</p>
            : payouts.length === 0 ? <p className="admin-sub">No pending payout requests.</p>
              : payouts.map((p) => (
                <div key={`${p.creatorId}:${p.currency}`} className="op-course">
                  <div>
                    <strong>{p.creatorName}</strong>
                    <span className="op-meta">{p.creatorEmail} · {p.count} sale(s)</span>
                  </div>
                  <div className="op-course-actions">
                    <span className="op-amount">{p.currency} {p.net}</span>
                    <button className="admin-btn" onClick={() => markPaid(p)}>Mark paid</button>
                  </div>
                </div>
              ))}
        </div>
      )}

      {tab === 'careers' && (
        <div className="op-section">
          <h3>Career aggregation</h3>
          <p className="admin-sub">Pulls fresh opportunities from permitted job feeds (Remotive, RemoteOK), filters for Africa relevance, and auto-delists expired ones. Normally runs on a schedule (~3×/week); trigger a run manually here.</p>
          {stats?.aggregation && <p className="admin-sub">Last run: {stats.aggregation.at ? new Date(stats.aggregation.at).toLocaleString() : 'never'} · {stats.aggregation.count ?? stats.opportunities} in pool</p>}
          <button className="admin-btn" onClick={runAggregation}>Run aggregation now</button>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, warn }) {
  return (
    <div className="op-stat">
      <strong className={warn ? 'op-warn' : ''}>{n ?? '—'}</strong>
      <span>{label}</span>
    </div>
  );
}
