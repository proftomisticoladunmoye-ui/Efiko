// EFIKO — Creator Studio. Any signed-in user (lecturer, expert, trainer) can sell a product
// on the marketplace and track earnings (net of the platform fee). Delivered via a link the
// buyer receives after purchase.
import { useEffect, useState } from 'react';
import { createCreatorListing, listMyCreatorListings, deleteCreatorListing, fetchCreatorEarnings, requestPayout, fetchPayoutDetails, savePayoutDetails, fetchBanks } from '../marketplace.js';
import { CURRENCIES, formatMoney } from '../currencies.js';

const COUNTRIES = [['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['UG', 'Uganda'], ['ZA', 'South Africa'], ['TZ', 'Tanzania'], ['RW', 'Rwanda']];

export default function CreatorStudio({ onBack }) {
  const [listings, setListings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [f, setF] = useState({ title: '', description: '', price: '', currency: 'NGN', deliverableUrl: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [payoutInfo, setPayoutInfo] = useState({ details: null, live: false });
  const [banks, setBanks] = useState([]);
  const [editPayout, setEditPayout] = useState(false);
  const [pf, setPf] = useState({ country: 'NG', bankCode: '', accountNumber: '' });

  async function load() { setListings(await listMyCreatorListings()); setEarnings(await fetchCreatorEarnings()); setPayoutInfo(await fetchPayoutDetails()); }
  useEffect(() => { load(); }, []);
  // Load the bank list for the picker whenever the editor is open (live mode) and country changes.
  useEffect(() => { if (payoutInfo.live && editPayout) fetchBanks(pf.country).then(setBanks); }, [payoutInfo.live, editPayout, pf.country]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setP = (k) => (e) => setPf((p) => ({ ...p, [k]: e.target.value, ...(k === 'country' ? { bankCode: '' } : {}) }));

  async function savePayout(e) {
    e.preventDefault();
    if (!pf.bankCode.trim() || !pf.accountNumber.trim()) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const bankName = banks.find((b) => b.code === pf.bankCode)?.name || '';
      const d = await savePayoutDetails({ country: pf.country, bankCode: pf.bankCode.trim(), bankName, accountNumber: pf.accountNumber.trim() });
      setPayoutInfo((p) => ({ ...p, details: d }));
      setEditPayout(false);
      setMsg(`✓ Payout method saved${d.accountName ? ` — ${d.accountName}` : ''}.`);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

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

      <div className="cs-payout">
        <h3>💳 Payout method</h3>
        {payoutInfo.details && !editPayout ? (
          <div className="cs-payout-saved">
            <span>Paid to <strong>{payoutInfo.details.bankName || payoutInfo.details.bankCode}</strong> · {payoutInfo.details.accountNumber}{payoutInfo.details.accountName ? ` · ${payoutInfo.details.accountName}` : ''}</span>
            <button className="ghost" onClick={() => { setEditPayout(true); setPf({ country: payoutInfo.details.country || 'NG', bankCode: '', accountNumber: '' }); }}>Change</button>
          </div>
        ) : (
          <form className="studio-form cs-payout-form" onSubmit={savePayout}>
            <p className="studio-sub">{payoutInfo.live ? 'Where should we send your earnings? We’ll verify the account name before saving.' : 'Add where your earnings should be sent. (Live transfers activate once payments are configured.)'}</p>
            <div className="opp-form-row">
              <select className="ask-input" value={pf.country} onChange={setP('country')} disabled={busy} aria-label="Country">
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
              {payoutInfo.live && banks.length > 0
                ? <select className="ask-input" value={pf.bankCode} onChange={setP('bankCode')} disabled={busy} aria-label="Bank"><option value="">Select bank…</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
                : <input className="ask-input" placeholder="Bank code (e.g. 044)" value={pf.bankCode} onChange={setP('bankCode')} disabled={busy} />}
            </div>
            <input className="ask-input" placeholder="Account number" value={pf.accountNumber} onChange={setP('accountNumber')} disabled={busy} />
            <div className="opp-form-row">
              <button className="studio-btn" type="submit" disabled={busy || !pf.bankCode.trim() || !pf.accountNumber.trim()}>{busy ? 'Saving…' : 'Save payout method'}</button>
              {payoutInfo.details && <button type="button" className="ghost" onClick={() => setEditPayout(false)} disabled={busy}>Cancel</button>}
            </div>
          </form>
        )}
      </div>

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
