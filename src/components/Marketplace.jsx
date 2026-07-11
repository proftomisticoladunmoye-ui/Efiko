// EFIKO — Marketplace section (V2 R5). Browse and buy courses/packs listed by institutions.
// Checkout runs through the payment adapter; by default that's a labelled demo checkout, so
// the flow is fully usable before a live provider (Flutterwave) is wired.
import { useEffect, useState } from 'react';
import { listListings, listPurchases, buyListing, verifyPurchase, startCharge, pollCharge, fetchCardKey, encryptCard } from '../marketplace.js';
import { formatMoney as price } from '../currencies.js';
import CreatorStudio from './CreatorStudio.jsx';

// Mobile-money support by currency (country dial code + networks) for v4 checkout.
const MOMO = {
  KES: { dial: '254', networks: ['MPESA', 'AIRTEL'] },
  GHS: { dial: '233', networks: ['MTN', 'VODAFONE', 'AIRTELTIGO'] },
  UGX: { dial: '256', networks: ['MTN', 'AIRTEL'] },
  RWF: { dial: '250', networks: ['MTN', 'AIRTEL'] },
  TZS: { dial: '255', networks: ['AIRTEL', 'TIGO', 'VODACOM', 'HALOTEL'] }
};

// v4 checkout modal. Mobile money: enter number -> approve on phone -> poll. Card: enter card
// (encrypted in-browser) -> usually a 3DS redirect -> return + poll. Unlocks on 'succeeded'.
function V4Checkout({ listing, cardAvailable, onClose, onOwned }) {
  const momo = MOMO[listing.currency];
  const methods = [momo && 'momo', cardAvailable && 'card'].filter(Boolean);
  const [method, setMethod] = useState(methods[0] || null);
  const [network, setNetwork] = useState(momo?.networks[0] || '');
  const [phone, setPhone] = useState('');
  const [card, setCard] = useState({ number: '', month: '', year: '', cvv: '' });
  const [stage, setStage] = useState('form'); // form | pending | redirecting | done | error
  const [note, setNote] = useState(null);
  const [err, setErr] = useState(null);
  const setC = (k) => (e) => setCard((c) => ({ ...c, [k]: e.target.value }));

  async function poll(ref) {
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 4000));
      const s = await pollCharge(ref);
      if (s.status === 'succeeded') { setStage('done'); onOwned(listing.id); return; }
      if (s.status === 'failed') { setStage('error'); setErr('Payment failed or was declined.'); return; }
    }
    setStage('error'); setErr('Timed out waiting for confirmation. If you were charged, it will unlock shortly.');
  }

  async function pay() {
    setErr(null); setStage('pending'); setNote('Starting payment…');
    try {
      let body;
      if (method === 'card') {
        const key = await fetchCardKey();
        if (!key) throw new Error('Card checkout is not available right now.');
        const enc = await encryptCard(card, key);
        body = { type: 'card', card: enc, redirectUrl: `${window.location.origin}/?market` };
      } else {
        body = { network, countryCode: momo.dial, phone: phone.trim(), redirectUrl: window.location.href };
      }
      const r = await startCharge(listing.id, body);
      if (r.already || r.free) { onOwned(listing.id); return onClose(); }
      const redirect = r.nextAction?.redirect_url?.url || r.nextAction?.redirect_url;
      if (redirect) {
        // 3DS: remember the charge, leave for the bank page, resume polling on return.
        localStorage.setItem('efiko-fwcharge', JSON.stringify({ reference: r.reference, listingId: listing.id }));
        setStage('redirecting'); setNote('Redirecting to your bank to authorise…');
        window.location.href = redirect; return;
      }
      setNote(r.nextAction?.payment_instruction?.note || 'Approve the payment, then keep this open.');
      await poll(r.reference);
    } catch (e) { setStage('error'); setErr(e.message); }
  }

  const cardValid = card.number.replace(/\s/g, '').length >= 12 && card.month && card.year && card.cvv.length >= 3;
  const canPay = method === 'card' ? cardValid : !!phone.trim();

  return (
    <div className="auth-overlay" onClick={() => stage === 'form' && onClose()}>
      <div className="v4co" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <h3>Pay {price(listing.price, listing.currency)}</h3>
        <p className="v4co-sub">{listing.title}</p>
        {methods.length === 0 ? (
          <p className="v4co-note">Payment for {listing.currency} isn’t available yet. Please check back soon.</p>
        ) : stage === 'done' ? (
          <p className="v4co-ok">✓ Payment confirmed — enjoy your purchase!</p>
        ) : stage === 'pending' || stage === 'redirecting' ? (
          <div className="v4co-pending"><div className="v4co-spin" />{note && <p>{note}</p>}</div>
        ) : (
          <>
            {methods.length > 1 && (
              <div className="v4co-tabs">
                {methods.map((m) => <button key={m} className={`v4co-tab${method === m ? ' active' : ''}`} onClick={() => setMethod(m)}>{m === 'card' ? '💳 Card' : '📱 Mobile money'}</button>)}
              </div>
            )}
            {method === 'card' ? (
              <>
                <label className="studio-field">Card number
                  <input className="ask-input" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={card.number} onChange={setC('number')} />
                </label>
                <div className="opp-form-row">
                  <input className="ask-input" inputMode="numeric" placeholder="MM" maxLength={2} value={card.month} onChange={setC('month')} aria-label="Expiry month" />
                  <input className="ask-input" inputMode="numeric" placeholder="YY" maxLength={2} value={card.year} onChange={setC('year')} aria-label="Expiry year" />
                  <input className="ask-input" inputMode="numeric" placeholder="CVV" maxLength={4} value={card.cvv} onChange={setC('cvv')} aria-label="CVV" />
                </div>
                <p className="v4co-secure">🔒 Your card is encrypted in your browser — we never see or store it.</p>
              </>
            ) : (
              <>
                <label className="studio-field">Mobile network
                  <select className="ask-input" value={network} onChange={(e) => setNetwork(e.target.value)}>
                    {momo.networks.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="studio-field">Your mobile-money number
                  <input className="ask-input" placeholder={`e.g. ${momo.dial}7XXXXXXXX`} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
              </>
            )}
            <button className="course-open" onClick={pay} disabled={!canPay}>Pay {price(listing.price, listing.currency)}</button>
          </>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}

// Load Flutterwave's checkout script once (only needed in live mode).
function loadFlutterwave() {
  return new Promise((resolve, reject) => {
    if (window.FlutterwaveCheckout) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.flutterwave.com/v3.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment checkout. Check your connection.'));
    document.head.appendChild(s);
  });
}

export default function Marketplace({ signedIn, onSignIn, onGoSection, user }) {
  const [listings, setListings] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [purchases, setPurchases] = useState([]);
  const [sellMode, setSellMode] = useState(false);
  const [payments, setPayments] = useState({ provider: 'mock', live: false, publicKey: '' });
  const [checkout, setCheckout] = useState(null); // listing being purchased (demo modal)
  const [v4co, setV4co] = useState(null); // listing being purchased via v4 mobile money
  const [returning, setReturning] = useState(false); // confirming a charge after a 3DS redirect
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [res, myPurchases] = await Promise.all([listListings(), signedIn ? listPurchases() : Promise.resolve([])]);
    setListings(res.listings); setPayments(res.payments || { provider: 'mock', live: false, publicKey: '' });
    setPurchases(myPurchases);
    setOwnedIds(new Set(myPurchases.map((p) => p.listingId)));
    setLoaded(true);
  }
  useEffect(() => { load(); }, [signedIn]);

  // Resume a card payment after the 3DS redirect: poll the pending charge and unlock on success.
  useEffect(() => {
    let stored; try { stored = JSON.parse(localStorage.getItem('efiko-fwcharge') || 'null'); } catch { stored = null; }
    if (!stored?.reference) return;
    let cancelled = false;
    setReturning(true);
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const s = await pollCharge(stored.reference);
        if (s.status === 'succeeded') { setOwnedIds((o) => new Set([...o, stored.listingId])); break; }
        if (s.status === 'failed' || s.status === 'not_found') break;
        await new Promise((r) => setTimeout(r, 3000));
      }
      localStorage.removeItem('efiko-fwcharge');
      if (!cancelled) { setReturning(false); load(); }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  function startBuy(l) {
    if (!signedIn) return onSignIn();
    if (l.price === 0) return confirmBuy(l);           // free items settle instantly
    if (payments.v4) { setErr(null); return setV4co(l); } // v4 mobile-money checkout
    if (payments.live) return payLive(l);              // real Flutterwave v3 checkout
    setErr(null); setCheckout(l);                      // demo checkout modal
  }
  function ownNow(id) { setOwnedIds((s) => new Set([...s, id])); }

  // Mock/free purchase (demo checkout or free item).
  async function confirmBuy(l) {
    setBusy(true); setErr(null);
    try {
      await buyListing(l.id);
      setOwnedIds((s) => new Set([...s, l.id]));
      setCheckout(null);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  // Live Flutterwave checkout: open their inline modal, then verify the transaction server-side.
  async function payLive(l) {
    setErr(null);
    try {
      await loadFlutterwave();
      window.FlutterwaveCheckout({
        public_key: payments.publicKey,
        tx_ref: `efiko_${l.id}_${Date.now()}`,
        amount: l.price,
        currency: l.currency,
        payment_options: 'card,banktransfer,ussd',
        customer: { email: user?.email || 'learner@efiko.app', name: user?.name || 'Efiko learner' },
        customizations: { title: 'Efiko', description: l.title },
        callback: async (data) => {
          try {
            await verifyPurchase(l.id, data.transaction_id || data.id);
            setOwnedIds((s) => new Set([...s, l.id]));
          } catch (e) { setErr(e.message); }
        }
      });
    } catch (e) { setErr(e.message); }
  }

  if (sellMode) return <CreatorStudio onBack={() => { setSellMode(false); load(); }} />;

  return (
    <section className="market">
      <div className="market-head">
        <h2>🛒 Marketplace</h2>
        {signedIn && <button className="course-enrol" onClick={() => setSellMode(true)}>💼 Sell on EFIKO</button>}
      </div>
      <p className="lib-sub">Premium courses, packs and resources from institutions and creators. Buy once, learn anytime — even offline.</p>
      {!payments.live && !payments.v4 && <p className="market-demo">🧪 Demo checkout — live payments (Flutterwave) activate once keys are added. No real charge is made.</p>}

      {loaded && listings.length === 0 && <p className="career-empty">No listings yet. Institutions and creators can list here — tap “Sell on EFIKO”.</p>}

      <div className="career-list">
        {listings.map((l) => {
          const owned = ownedIds.has(l.id);
          const by = l.ownerType === 'creator' ? `by ${l.creatorName || 'a creator'}` : (l.ownerType === 'org' ? 'Institution' : null);
          const deliverable = owned && purchases.find((p) => p.listingId === l.id)?.deliverableUrl;
          return (
            <article key={l.id} className="opp-card">
              <div className="opp-head">
                <span className="market-price">{price(l.price, l.currency)}</span>
                {owned && <span className="market-owned">✓ Owned</span>}
              </div>
              <h3 className="opp-title">{l.title}</h3>
              {by && <p className="opp-org">{by}</p>}
              {l.description && <p className="opp-desc">{l.description}</p>}
              <div className="opp-actions">
                {owned
                  ? (l.courseId
                      ? <button className="course-open" onClick={() => onGoSection?.('courses')}>Open course →</button>
                      : (deliverable
                          ? <a className="course-open" href={deliverable} target="_blank" rel="noreferrer">Access →</a>
                          : <span className="course-open" aria-disabled="true" style={{ opacity: .7 }}>Purchased</span>))
                  : <button className="course-open" onClick={() => startBuy(l)} disabled={busy}>{l.price === 0 ? 'Get free' : `Buy · ${price(l.price, l.currency)}`}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {err && !checkout && <p className="error">{err}</p>}

      {checkout && (
        <div className="auth-overlay" onClick={() => !busy && setCheckout(null)}>
          <div className="market-checkout" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setCheckout(null)} aria-label="Close">×</button>
            <h3>Checkout</h3>
            <p className="market-co-item">{checkout.title}</p>
            <p className="market-co-total">Total: <strong>{price(checkout.price, checkout.currency)}</strong></p>
            {!payments.live && <p className="market-demo">🧪 Demo mode — this completes the purchase without a real payment.</p>}
            {err && <p className="error">{err}</p>}
            <button className="course-open market-pay" onClick={() => confirmBuy(checkout)} disabled={busy}>
              {busy ? 'Processing…' : payments.live ? `Pay ${price(checkout.price, checkout.currency)}` : 'Complete demo purchase'}
            </button>
          </div>
        </div>
      )}

      {v4co && <V4Checkout listing={v4co} cardAvailable={!!payments.card} onClose={() => setV4co(null)} onOwned={(id) => { ownNow(id); }} />}
      {returning && <div className="auth-overlay"><div className="v4co"><div className="v4co-pending"><div className="v4co-spin" /><p>Confirming your payment…</p></div></div></div>}
    </section>
  );
}
