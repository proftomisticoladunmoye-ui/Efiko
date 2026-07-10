// EFIKO — Creator Studio. Any signed-in user (lecturer, expert, trainer) can sell a product
// on the marketplace and track earnings (net of the platform fee). Delivered via a link the
// buyer receives after purchase.
import { useEffect, useState } from 'react';
import { createCreatorListing, listMyCreatorListings, deleteCreatorListing, fetchCreatorEarnings, requestPayout, fetchPayoutDetails, savePayoutDetails, fetchBanks } from '../marketplace.js';
import { CURRENCIES, formatMoney } from '../currencies.js';

// Supported payout countries: currency + the payout method(s) that make sense locally, plus
// mobile-money networks where relevant. Bank markets (NG/ZA) use the bank list from Flutterwave.
const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN', methods: ['bank'] },
  { code: 'GH', name: 'Ghana', currency: 'GHS', methods: ['mobile_money', 'bank'], networks: ['MTN', 'VODAFONE', 'AIRTELTIGO'] },
  { code: 'KE', name: 'Kenya', currency: 'KES', methods: ['mobile_money', 'bank'], networks: ['MPESA', 'AIRTEL'] },
  { code: 'UG', name: 'Uganda', currency: 'UGX', methods: ['mobile_money'], networks: ['MTN', 'AIRTEL'] },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', methods: ['bank'] },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', methods: ['mobile_money'], networks: ['AIRTEL', 'TIGO', 'VODACOM', 'HALOTEL'] },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', methods: ['mobile_money'], networks: ['MTN', 'AIRTEL'] }
];
const countryCfg = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];

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
  const [pf, setPf] = useState({ country: 'NG', method: 'bank', bankCode: '', accountNumber: '', network: '', phone: '', firstName: '', lastName: '' });
  const cfg = countryCfg(pf.country);

  // Fetch the bank list for a country (only when live + bank method); clears otherwise.
  function loadBanksFor(country, method, live) {
    if (live && method === 'bank') fetchBanks(country).then(setBanks); else setBanks([]);
  }
  async function load() {
    setListings(await listMyCreatorListings());
    setEarnings(await fetchCreatorEarnings());
    const pd = await fetchPayoutDetails();
    setPayoutInfo(pd);
    loadBanksFor(pf.country, pf.method, pd.live); // deterministic: load banks once details/live are known
  }
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setP = (k) => (e) => setPf((p) => {
    const next = (k === 'country')
      ? { ...p, country: e.target.value, method: countryCfg(e.target.value).methods[0], bankCode: '', network: (countryCfg(e.target.value).networks || [])[0] || '' }
      : { ...p, [k]: e.target.value };
    if (k === 'country' || k === 'method') loadBanksFor(next.country, next.method, payoutInfo.live);
    return next;
  });

  async function savePayout(e) {
    e.preventDefault();
    const isBank = pf.method === 'bank';
    if (isBank ? (!pf.bankCode.trim() || !pf.accountNumber.trim()) : (!pf.network || !pf.phone.trim() || !pf.firstName.trim())) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const payload = isBank
        ? { method: 'bank', country: pf.country, currency: cfg.currency, bankCode: pf.bankCode.trim(), bankName: banks.find((b) => b.code === pf.bankCode)?.name || '', accountNumber: pf.accountNumber.trim() }
        : { method: 'mobile_money', country: pf.country, currency: cfg.currency, network: pf.network, phone: pf.phone.trim(), firstName: pf.firstName.trim(), lastName: pf.lastName.trim() };
      const d = await savePayoutDetails(payload);
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
            <span>Paid to{' '}
              {payoutInfo.details.method === 'mobile_money'
                ? <><strong>{payoutInfo.details.network}</strong> · {payoutInfo.details.phone}{payoutInfo.details.accountName ? ` · ${payoutInfo.details.accountName}` : ''}</>
                : <><strong>{payoutInfo.details.bankName || payoutInfo.details.bankCode}</strong> · {payoutInfo.details.accountNumber}{payoutInfo.details.accountName ? ` · ${payoutInfo.details.accountName}` : ''}</>}
              {' '}({payoutInfo.details.currency})
            </span>
            <button className="ghost" onClick={() => { const c = countryCfg(payoutInfo.details.country || 'NG'); setEditPayout(true); setPf({ country: c.code, method: payoutInfo.details.method || c.methods[0], bankCode: '', accountNumber: '', network: (c.networks || [])[0] || '', phone: '', firstName: '', lastName: '' }); }}>Change</button>
          </div>
        ) : (
          <form className="studio-form cs-payout-form" onSubmit={savePayout}>
            <p className="studio-sub">{payoutInfo.live ? 'Where should we send your earnings? Bank names are confirmed automatically.' : 'Add where your earnings should be sent. (Live transfers activate once payments are configured.)'}</p>
            <div className="opp-form-row">
              <select className="ask-input" value={pf.country} onChange={setP('country')} disabled={busy} aria-label="Country">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
              </select>
              {cfg.methods.length > 1 && (
                <select className="ask-input" value={pf.method} onChange={setP('method')} disabled={busy} aria-label="Payout method">
                  {cfg.methods.map((m) => <option key={m} value={m}>{m === 'mobile_money' ? 'Mobile money' : 'Bank account'}</option>)}
                </select>
              )}
            </div>
            {pf.method === 'bank' ? (
              <>
                {payoutInfo.live && banks.length > 0
                  ? <select className="ask-input" value={pf.bankCode} onChange={setP('bankCode')} disabled={busy} aria-label="Bank"><option value="">Select bank…</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select>
                  : <input className="ask-input" placeholder="Bank code (e.g. 044)" value={pf.bankCode} onChange={setP('bankCode')} disabled={busy} />}
                <input className="ask-input" placeholder="Account number" value={pf.accountNumber} onChange={setP('accountNumber')} disabled={busy} />
              </>
            ) : (
              <>
                <div className="opp-form-row">
                  <select className="ask-input" value={pf.network} onChange={setP('network')} disabled={busy} aria-label="Mobile network">
                    <option value="">Select network…</option>
                    {(cfg.networks || []).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input className="ask-input" placeholder="Mobile money number (e.g. 2547…)" value={pf.phone} onChange={setP('phone')} disabled={busy} />
                </div>
                <div className="opp-form-row">
                  <input className="ask-input" placeholder="First name" value={pf.firstName} onChange={setP('firstName')} disabled={busy} />
                  <input className="ask-input" placeholder="Last name" value={pf.lastName} onChange={setP('lastName')} disabled={busy} />
                </div>
              </>
            )}
            <div className="opp-form-row">
              <button className="studio-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save payout method'}</button>
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
