// EFIKO — Creator Studio. Any signed-in user (lecturer, expert, trainer) can sell a product
// on the marketplace and track earnings (net of the platform fee). Delivered via a link the
// buyer receives after purchase.
import { useEffect, useState } from 'react';
import { createCreatorListing, listMyCreatorListings, deleteCreatorListing, fetchCreatorEarnings, requestPayout } from '../marketplace.js';
import { CURRENCIES, formatMoney } from '../currencies.js';

export default function CreatorStudio({ onBack }) {
  const [listings, setListings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [f, setF] = useState({ title: '', description: '', price: '', currency: 'NGN', deliverableUrl: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  async function load() { setListings(await listMyCreatorListings()); setEarnings(await fetchCreatorEarnings()); }
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await createCreatorListing({ title: f.title.trim(), description: f.description.trim(), price: Number(f.price) || 0, currency: f.currency, deliverableUrl: f.deliverableUrl.trim() });
      setF({ title: '', description: '', price: '', currency: f.currency, deliverableUrl: '' });
      setMsg('✓ Listed — it’s now on the marketplace.');
      await load();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function remove(id) { setListings((p) => p.filter((x) => x.id !== id)); await deleteCreatorListing(id); load(); }

  async function payout() {
    setBusy(true); setErr(null);
    try { const r = await requestPayout(); setMsg(`✓ Payout requested (${r.count} sale${r.count !== 1 ? 's' : ''}). Our team will process it.`); await load(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  const cur = earnings ? Object.entries(earnings.byCurrency) : [];
  const anyPending = cur.some(([, v]) => v.pending > 0);

  return (
    <section className="market">
      <button className="back" onClick={onBack}>← Marketplace</button>
      <h2>💼 Creator Studio</h2>
      <p className="lib-sub">Sell your own courses, packs or resources. EFIKO takes a {earnings?.feePct ?? 20}% platform fee; you keep the rest.</p>

      {cur.length > 0 && (
        <div className="cs-earnings">
          <h3>Your earnings</h3>
          <div className="cs-earn-grid">
            {cur.map(([c, v]) => (
              <div key={c} className="cs-earn-card">
                <span className="cs-earn-net">{formatMoney(v.net, c)}</span>
                <span className="cs-earn-lbl">earned · {v.sales} sale{v.sales !== 1 ? 's' : ''}</span>
                <span className="cs-earn-pending">{formatMoney(v.pending, c)} pending</span>
              </div>
            ))}
          </div>
          {anyPending && <button className="course-open" disabled={busy} onClick={payout}>{busy ? 'Requesting…' : 'Request payout'}</button>}
        </div>
      )}

      <h3>List a new product</h3>
      <form className="studio-form" onSubmit={create}>
        <input className="ask-input" placeholder="Product title, e.g. Statistics Crash Course" value={f.title} onChange={set('title')} disabled={busy} />
        <textarea className="ask-input" rows={3} placeholder="What the buyer gets (optional)" value={f.description} onChange={set('description')} disabled={busy} />
        <div className="opp-form-row">
          <select className="ask-input" value={f.currency} onChange={set('currency')} disabled={busy} aria-label="Currency">
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
          <input className="ask-input" type="number" min="0" placeholder="Price (0 = free)" value={f.price} onChange={set('price')} disabled={busy} />
        </div>
        <input className="ask-input" placeholder="Delivery link (buyers get this after purchase — Drive, site, etc.)" value={f.deliverableUrl} onChange={set('deliverableUrl')} disabled={busy} />
        <button className="studio-btn" type="submit" disabled={busy || !f.title.trim()}>{busy ? 'Listing…' : 'List product'}</button>
      </form>
      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <h3 className="studio-pub-h">Your products</h3>
      {listings.length === 0 ? <p className="studio-sub">None yet — list one above.</p> : (
        <div className="studio-pub-list">
          {listings.map((l) => (
            <div key={l.id} className="pub-row">
              <span className="pub-topic">{l.title} <em>({formatMoney(l.price, l.currency)})</em></span>
              <button className="planner-del" onClick={() => remove(l.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
