// EFIKO — Marketplace section (V2 R5). Browse and buy courses/packs listed by institutions.
// Checkout runs through the payment adapter; by default that's a labelled demo checkout, so
// the flow is fully usable before a live provider (Flutterwave) is wired.
import { useEffect, useState } from 'react';
import { listListings, listPurchases, buyListing, verifyPurchase } from '../marketplace.js';
import { formatMoney as price } from '../currencies.js';
import CreatorStudio from './CreatorStudio.jsx';

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

  function startBuy(l) {
    if (!signedIn) return onSignIn();
    if (l.price === 0) return confirmBuy(l);           // free items settle instantly
    if (payments.live) return payLive(l);              // real Flutterwave checkout
    setErr(null); setCheckout(l);                      // demo checkout modal
  }

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
      {!payments.live && <p className="market-demo">🧪 Demo checkout — live payments (Flutterwave) activate once keys are added. No real charge is made.</p>}

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
    </section>
  );
}
