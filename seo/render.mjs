// Efiko — SEO page renderer. Turns a page definition into a complete, indexable HTML
// document: head metadata (title, description, canonical, Open Graph, Twitter), JSON-LD
// (Breadcrumb + FAQ + a primary schema), visible breadcrumb, content, internal links and a
// CTA into the app. Inline critical CSS keeps LCP fast and CLS at zero (no external CSS,
// no layout shift). Plain string templating — no runtime framework.
import { SITE, url } from './site.mjs';
import { PAGES, NAV, bySlug } from './pages.mjs';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

const CSS = `
:root{--bg:#0b1120;--panel:#111a2e;--ink:#e2e8f0;--muted:#94a3b8;--brand:#0f766e;--brand2:#14b8a6;--line:#1e293b}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
a{color:var(--brand2);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:#0b1220;position:sticky;top:0;z-index:10}
.site .wrap{display:flex;align-items:center;gap:16px;height:56px}
.site img{height:28px;width:auto}
nav.top{display:flex;gap:14px;overflow-x:auto;font-size:14px;flex:1}
nav.top a{color:var(--muted);white-space:nowrap}
.cta{background:var(--brand);color:#04231f;border-radius:999px;padding:8px 16px;font-weight:600;white-space:nowrap}
.crumbs{font-size:13px;color:var(--muted);padding:16px 0}
.crumbs a{color:var(--muted)}
h1{font-size:32px;line-height:1.2;margin:8px 0 12px}
.intro{font-size:19px;color:#cbd5e1;margin:0 0 8px}
section.block{padding:22px 0;border-top:1px solid var(--line)}
h2{font-size:22px;margin:0 0 8px}
.faq h3{font-size:17px;margin:16px 0 4px}
.faq p{margin:0 0 8px;color:#cbd5e1}
.related{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.related a{border:1px solid var(--line);border-radius:999px;padding:6px 12px;color:var(--ink);font-size:14px}
.hero-cta{display:inline-block;margin:16px 0;background:var(--brand);color:#04231f;border-radius:999px;padding:12px 22px;font-weight:700}
footer.site{border-top:1px solid var(--line);margin-top:24px;padding:28px 0;color:var(--muted);font-size:14px}
footer .cols{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:14px}
@media(max-width:560px){h1{font-size:26px}.intro{font-size:17px}}
`;

function head(page) {
  const canonical = url(page.slug);
  const title = page.title;
  const desc = page.description;
  const ogimg = `${SITE.base}${SITE.logo}`;
  const tw = SITE.twitterHandle ? `<meta name="twitter:site" content="${esc(SITE.twitterHandle)}"/>` : '';
  return `
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="theme-color" content="#0f766e"/>
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}"/>
    <meta name="robots" content="index, follow, max-image-preview:large"/>
    <link rel="canonical" href="${canonical}"/>
    <link rel="icon" type="image/png" href="/favicon.png"/>
    <meta property="og:type" content="website"/>
    <meta property="og:site_name" content="${esc(SITE.name)}"/>
    <meta property="og:title" content="${esc(title)}"/>
    <meta property="og:description" content="${esc(desc)}"/>
    <meta property="og:url" content="${canonical}"/>
    <meta property="og:image" content="${ogimg}"/>
    <meta property="og:locale" content="${SITE.locale}"/>
    <meta name="twitter:card" content="summary_large_image"/>${tw}
    <meta name="twitter:title" content="${esc(title)}"/>
    <meta name="twitter:description" content="${esc(desc)}"/>
    <meta name="twitter:image" content="${ogimg}"/>
    <style>${CSS}</style>`;
}

// Primary schema per page type, plus Breadcrumb and FAQ.
function schemas(page) {
  const canonical = url(page.slug);
  const org = { '@type': 'EducationalOrganization', '@id': `${SITE.base}/#organization`, name: SITE.name, url: `${SITE.base}/`, logo: `${SITE.base}${SITE.logo}` };
  const graph = [];

  const primary = {
    course: { '@type': 'Course', name: page.product, description: page.description, url: canonical, provider: org },
    webapp: { '@type': 'WebApplication', name: page.product, description: page.description, url: canonical, applicationCategory: 'EducationApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: org },
    webpage: { '@type': 'WebPage', name: page.title, description: page.description, url: canonical, isPartOf: { '@id': `${SITE.base}/#website` }, publisher: org }
  }[page.schema || 'webpage'];
  graph.push(primary);

  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.base}/` },
      { '@type': 'ListItem', position: 2, name: page.product, item: canonical }
    ]
  });

  if (page.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    });
  }
  return jsonld({ '@context': 'https://schema.org', '@graph': graph });
}

function header() {
  const links = NAV.map((s) => `<a href="${s}">${esc(bySlug[s].nav)}</a>`).join('');
  return `<header class="site"><div class="wrap">
    <a href="/" aria-label="Efiko home"><img src="/logo.png" alt="Efiko" width="52" height="28"/></a>
    <nav class="top" aria-label="Products">${links}</nav>
    <a class="cta" href="/">Open app</a>
  </div></header>`;
}

function footer() {
  const links = NAV.map((s) => `<a href="${s}">${esc(bySlug[s].product)}</a>`).join('');
  return `<footer class="site"><div class="wrap">
    <div class="cols">${links}</div>
    <div>© ${new Date().getFullYear()} ${esc(SITE.name)} — ${esc(SITE.tagline)}</div>
  </div></footer>`;
}

export function renderPage(page) {
  const body = `
  ${header()}
  <main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(page.product)}</span></nav>
    <h1>${esc(page.h1)}</h1>
    <p class="intro">${esc(page.intro)}</p>
    <a class="hero-cta" href="/">Start learning with ${esc(page.product)}</a>
    ${page.sections.map((s) => `<section class="block"><h2>${esc(s.h2)}</h2><p>${esc(s.p)}</p></section>`).join('')}
    ${page.faqs?.length ? `<section class="block faq"><h2>Frequently asked questions</h2>${page.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>` : ''}
    ${page.related?.length ? `<section class="block"><h2>Explore more of Efiko</h2><div class="related">${page.related.map((s) => `<a href="${s}">${esc(bySlug[s].product)}</a>`).join('')}</div></section>` : ''}
  </main>
  ${footer()}`;
  return `<!doctype html><html lang="${SITE.locale}"><head>${head(page)}${schemas(page)}</head><body>${body}</body></html>`;
}

export function renderSitemap() {
  const now = new Date().toISOString().slice(0, 10);
  const entries = [{ loc: `${SITE.base}/`, priority: '1.0', changefreq: 'weekly' },
    ...PAGES.map((p) => ({ loc: url(p.slug), priority: '0.8', changefreq: 'weekly' }))];
  const urls = entries.map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots() {
  return `# Efiko — robots.txt\n# Public content is path-based (e.g. /courses, /ai). App-internal views use query\n# strings (admin consoles, deep links) and are not meant for the index.\n\nUser-agent: *\nAllow: /\nDisallow: /*?\n\nSitemap: ${SITE.base}/sitemap.xml\n`;
}
