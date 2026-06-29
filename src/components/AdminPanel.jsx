// Efiko — Institution Admin (Phase B). A paid institution logs in and customizes
// its own branding (name, logo, brand colour, courses). Saving is gated server-side
// to active (paid) institutions.
import { useState, useEffect } from 'react';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const TOKEN_KEY = 'efiko-admin-token';

const brandingForm = (org) => {
  const b = org?.branding || {};
  return {
    name: b.name || org?.institution || '',
    logo: b.logo || '',
    color: b.color || '#14b8a6',
    courseFilter: (b.courseFilter || []).join(', ')
  };
};

export default function AdminPanel({ onBack }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [org, setOrg] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({ name: '', logo: '', color: '#14b8a6', courseFilter: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${GATEWAY}/admin/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { logout(); return; }
        const d = await r.json();
        setOrg(d.org);
        setForm(brandingForm(d.org));
      } catch { /* gateway down */ }
    })();
  }, []); // eslint-disable-line

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setOrg(null);
  }

  async function login(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${GATEWAY}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Login failed');
      localStorage.setItem(TOKEN_KEY, d.token);
      setToken(d.token); setOrg(d.org); setForm(brandingForm(d.org));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function save() {
    setErr(null); setMsg(null); setBusy(true);
    try {
      const body = {
        name: form.name,
        logo: form.logo,
        color: form.color,
        courseFilter: form.courseFilter.split(',').map((s) => s.trim()).filter(Boolean)
      };
      const r = await fetch(`${GATEWAY}/admin/branding`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) throw new Error(d.error || 'Customization is a paid feature.');
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setMsg('✓ Branding saved. Your students will see it at your Efiko link.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="admin">
      <button className="back" onClick={onBack}>← Home</button>
      <h2>Institution Admin</h2>

      {!org ? (
        <form className="admin-form" onSubmit={login}>
          <p className="admin-sub">Sign in to customize your institution's Efiko.</p>
          <input className="ask-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="ask-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <button className="admin-btn" type="submit" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {err && <p className="error">{err}</p>}
        </form>
      ) : (
        <div className="admin-panel">
          <div className="admin-head">
            <span>{org.institution} {org.active ? <em className="badge-paid">Paid</em> : <em className="badge-free">Not active</em>}</span>
            <button className="ghost" onClick={logout}>Sign out</button>
          </div>

          {!org.active && (
            <p className="admin-note">Your institution isn't active yet. Customization unlocks on the paid plan — contact Efiko to activate.</p>
          )}

          <label className="studio-field">Display name
            <input className="ask-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!org.active} />
          </label>
          <label className="studio-field">Logo URL
            <input className="ask-input" placeholder="https://your-university.edu/logo.png" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} disabled={!org.active} />
          </label>
          <label className="studio-field">Brand colour
            <span className="admin-color">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} disabled={!org.active} />
              <input className="ask-input" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} disabled={!org.active} />
            </span>
          </label>
          <label className="studio-field">Course codes (comma-separated)
            <input className="ask-input" placeholder="PSY720, ECO110" value={form.courseFilter} onChange={(e) => setForm({ ...form, courseFilter: e.target.value })} disabled={!org.active} />
          </label>

          <button className="admin-btn" onClick={save} disabled={busy || !org.active}>{busy ? 'Saving…' : 'Save branding'}</button>
          {msg && <p className="studio-msg">{msg}</p>}
          {err && <p className="error">{err}</p>}
          <p className="admin-sub">Your students' link: <code>?org={org.orgId}</code></p>
        </div>
      )}
    </div>
  );
}
