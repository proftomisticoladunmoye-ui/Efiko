// EFIKO — Marketplace console (V2 R5). An institution lists a course/pack for sale. Requires
// the Institution Admin token. Optionally links a listing to one of the institution's courses.
import { useEffect, useState } from 'react';
import { hasAdminToken, fetchCoursesForSelect } from '../classes.js';
import { listMyListings, createListing, deleteListing } from '../marketplace.js';

const money = (a, c) => (a === 0 ? 'Free' : `${c === 'NGN' ? '₦' : c + ' '}${Number(a).toLocaleString()}`);

export default function MarketplaceConsole({ onExit }) {
  const [authed] = useState(hasAdminToken());
  const [courses, setCourses] = useState([]);
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ title: '', description: '', price: '', courseId: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!hasAdminToken()) return;
    fetchCoursesForSelect().then(setCourses);
    listMyListings().then(setItems);
  }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await createListing({ title: f.title.trim(), description: f.description.trim(), price: Number(f.price) || 0, courseId: f.courseId || null, currency: 'NGN' });
      setItems(await listMyListings());
      setF({ title: '', description: '', price: '', courseId: '' });
      setMsg('✓ Listed — it now appears in the Marketplace.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    setItems((p) => p.filter((x) => x.id !== id));
    try { await deleteListing(id); } catch { setItems(await listMyListings()); }
  }

  if (!authed) {
    return (
      <div className="studio">
        <button className="back" onClick={onExit}>← Home</button>
        <h2>Marketplace</h2>
        <p className="studio-sub">Please sign in as your institution first — open <strong>Institution Admin</strong> from Teach and log in, then return here.</p>
      </div>
    );
  }

  return (
    <div className="studio">
      <button className="back" onClick={onExit}>← Home</button>
      <h2>Sell on the Marketplace</h2>
      <p className="studio-sub">List a course or pack for sale. Learners buy it and get a purchase record. Set price 0 for a free listing.</p>

      <form className="studio-form" onSubmit={create}>
        <input className="ask-input" placeholder="Listing title, e.g. GES100 Exam Masterclass" value={f.title} onChange={set('title')} disabled={busy} />
        <textarea className="ask-input" rows={3} placeholder="What the buyer gets (optional)" value={f.description} onChange={set('description')} disabled={busy} />
        <div className="opp-form-row">
          <input className="ask-input" type="number" min="0" placeholder="Price in ₦ (0 = free)" value={f.price} onChange={set('price')} disabled={busy} />
          <select className="ask-input" value={f.courseId} onChange={set('courseId')} disabled={busy} aria-label="Linked course">
            <option value="">Link a course (optional)</option>
            {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
          </select>
        </div>
        <button className="studio-btn" type="submit" disabled={busy || !f.title.trim()}>{busy ? 'Listing…' : 'Create listing'}</button>
      </form>
      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <h3 className="studio-pub-h">Your listings</h3>
      {items.length === 0 ? (
        <p className="studio-sub">None yet — create one above.</p>
      ) : (
        <div className="studio-pub-list">
          {items.map((l) => (
            <div key={l.id} className="pub-row">
              <span className="pub-topic">{l.title} <em>({money(l.price, l.currency)})</em></span>
              <button className="planner-del" onClick={() => remove(l.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
