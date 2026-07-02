// EFIKO — Marketplace section (V2 R5). Browse and buy courses/packs listed by institutions.
// Checkout runs through the payment adapter; by default that's a labelled demo checkout, so
// the flow is fully usable before a live provider (Flutterwave) is wired.
import { useEffect, useState } from 'react';
import { listListings, listPurchases, buyListing } from '../marketplace.js';
import { formatMoney as price } from '../currencies.js';

export default function Marketplace({ signedIn, onSignIn }) {
  const [listings, setListings] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [payments, setPayments] = useState({ provider: 'mock', live: false });
  const [checkout, setCheckout] = useState(null); // listing being purchased
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [res, purchases] = await Promise.all([listListings(), signedIn ? listPurchases() : Promise.resolve([])]);
    setListings(res.listings); setPayments(res.payments || { provider: 'mock', live: false });
    setOwnedIds(new Set(purchases.map((p) => p.listingId)));
    setLoaded(true);
  }
  useEffect(() => { load(); }, [signedIn]);

  function startBuy(l) {
    if (!signedIn) return onSignIn();
    if (l.price === 0) { confirmBuy(l); return; } // free items skip checkout
    setErr(null); setCheckout(l);
  }

  async function confirmBuy(l) {
    setBusy(true); setErr(null);
    try {
      await buyListing(l.id);
      setOwnedIds((s) => new Set([...s, l.id]));
      setCheckout(null);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <section className="market">
      <h2>🛒 Marketplace</h2>
      <p className="lib-sub">Premium courses and packs from institutions. Buy once, learn anytime — even offline.</p>
      {!payments.live && <p className="market-demo">🧪 Demo checkout — live payments (Flutterwave) activate once keys are added. No real charge is made.</p>}

      {loaded && listings.length === 0 && <p className="career-empty">No listings yet. Institutions can put a course up for sale from Teach → Marketplace.</p>}

      <div className="career-list">
        {listings.map((l) => {
          const owned = ownedIds.has(l.id);
          return (
            <article key={l.id} className="opp-card">
              <div className="opp-head">
                <span className="market-price">{price(l.price, l.currency)}</span>
                {owned && <span className="market-owned">✓ Owned</span>}
              </div>
              <h3 className="opp-title">{l.title}</h3>
              {l.description && <p className="opp-desc">{l.description}</p>}
              <div className="opp-actions">
                {owned
                  ? <span className="course-open" aria-disabled="true" style={{ opacity: .7 }}>Purchased</span>
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
