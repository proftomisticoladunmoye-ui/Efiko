// Efiko — white-label tenancy (Phase A). A paid institution gets its own branded
// view (logo, name, brand colour, its courses), chosen by ?org=<id> or subdomain.
// Configs live in /tenants.json; onboarding a university = add a config there.
const FALLBACK = { id: 'default', name: 'Efiko', institution: '', logo: '/logo.png', color: '#14b8a6' };
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

function orgId() {
  const param = new URLSearchParams(location.search).get('org');
  if (param) return param.toLowerCase();
  // subdomain: kiu.efiko.app -> "kiu" (ignore apex, www, and Render's host)
  const host = location.hostname;
  const parts = host.split('.');
  if (parts.length > 2 && !host.includes('onrender') && !['www', 'efiko'].includes(parts[0])) {
    return parts[0].toLowerCase();
  }
  return 'default';
}

// Mix a colour toward white, for the lighter accent variable.
function lighten(hex, amt = 0.35) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amt);
  g = Math.round(g + (255 - g) * amt);
  b = Math.round(b + (255 - b) * amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function applyTheme(tenant) {
  if (!tenant?.color) return;
  const root = document.documentElement.style;
  root.setProperty('--brand', tenant.color);
  root.setProperty('--brand-2', lighten(tenant.color, 0.4));
}

/** Resolve the active tenant (network → localStorage cache → default) and theme the app. */
export async function resolveTenant() {
  const org = orgId();
  let tenant = null;

  // 1. Self-edited branding from the gateway (Phase B) wins, when the org has an account.
  if (org !== 'default') {
    try {
      const r = await fetch(`${GATEWAY}/tenants/${encodeURIComponent(org)}`, { cache: 'no-cache' });
      if (r.ok) tenant = await r.json();
    } catch { /* offline / gateway down — fall through */ }
  }

  // 2. Static /tenants.json fallback (seeded institutions), cached for offline.
  if (!tenant) {
    let tenants;
    try {
      const res = await fetch('/tenants.json', { cache: 'no-cache' });
      tenants = await res.json();
      localStorage.setItem('efiko-tenants', JSON.stringify(tenants));
    } catch {
      try { tenants = JSON.parse(localStorage.getItem('efiko-tenants') || '{}'); } catch { tenants = {}; }
    }
    tenant = tenants && (tenants[org] || tenants.default);
  }

  tenant = tenant || FALLBACK;
  applyTheme(tenant);
  return tenant;
}
