// Efiko — Institution Admin (Phase B). A paid institution logs in and customizes
// its own branding (name, logo, brand colour, courses). Saving is gated server-side
// to active (paid) institutions.
import { useState, useEffect, useRef } from 'react';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const TOKEN_KEY = 'efiko-admin-token';

// Turn an uploaded image file into a small data URL we can store in the `logo`
// field (rendered everywhere as <img src>). Raster images are downscaled to
// maxDim px so the saved value stays tiny; SVGs are kept as-is (already vector).
function fileToLogoDataUrl(file, maxDim = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const src = reader.result;
      if (file.type === 'image/svg+xml') { resolve(src); return; }
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png')); // PNG preserves logo transparency
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

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
  const fileRef = useRef(null);

  async function onLogoFile(e) {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ''; // let the same file be re-picked
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (PNG, JPG, or SVG).'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('That image is over 5 MB — please use a smaller file.'); return; }
    setErr(null);
    try {
      const logo = await fileToLogoDataUrl(file);
      setForm((f) => ({ ...f, logo }));
      setMsg('Logo loaded — click “Save branding” to publish it.');
    } catch { setErr('Could not read that image. Try a PNG or JPG.'); }
  }

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
          <div className="studio-field">Logo
            <div className="admin-logo-row">
              <span className="admin-logo-preview">
                {form.logo
                  ? <img src={form.logo} alt="Logo preview" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  : <span className="admin-logo-empty">No logo</span>}
              </span>
              <div className="admin-logo-actions">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={onLogoFile} />
                <button type="button" className="ghost" onClick={() => fileRef.current?.click()} disabled={!org.active}>Upload image…</button>
                {form.logo && <button type="button" className="ghost" onClick={() => setForm({ ...form, logo: '' })} disabled={!org.active}>Remove</button>}
              </div>
            </div>
            <input className="ask-input" placeholder="…or paste an image URL (https://your-university.edu/logo.png)" value={form.logo?.startsWith('data:') ? '' : form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} disabled={!org.active} />
          </div>
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
