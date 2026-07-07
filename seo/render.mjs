// Efiko — SEO page renderer. Turns page definitions into complete, indexable HTML documents:
// head metadata (title, description, canonical, Open Graph, Twitter), JSON-LD, visible
// breadcrumb, content, internal links and a CTA into the app. Inline critical CSS keeps LCP
// fast and CLS at zero. Plain string templating — no runtime framework.
//
// Exposes a shared document core (metaTags / htmlDocument / siteHeader / siteFooter / esc)
// reused by the catalog-driven content pages in renderContent.mjs.
import { SITE, url, href } from './site.mjs';
import { PAGES, NAV, bySlug } from './pages.mjs';

export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

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
.prose p{margin:0 0 14px;color:#dbe4ee}
.meta-chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
.o-seo-badge{display:inline-block;font-size:12px;font-weight:700;color:#fbbf24;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.4);border-radius:999px;padding:4px 12px;margin:4px 0}
.chip{font-size:12px;color:var(--brand2);border:1px solid var(--line);border-radius:999px;padding:4px 10px}
.faq h3{font-size:17px;margin:16px 0 4px}
.faq p{margin:0 0 8px;color:#cbd5e1}
ul.topics{list-style:none;padding:0;margin:8px 0}
ul.topics li{border-top:1px solid var(--line);padding:12px 0}
ul.topics a{font-size:17px;font-weight:600}
ul.topics .t-sub{color:var(--muted);font-size:13px}
ol.steps{padding-left:20px;margin:8px 0}
ol.steps li{margin:0 0 12px;color:#dbe4ee}
ol.steps strong{color:var(--ink)}
.related{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.related a{border:1px solid var(--line);border-radius:999px;padding:6px 12px;color:var(--ink);font-size:14px}
.hero-cta{display:inline-block;margin:16px 0;background:var(--brand);color:#04231f;border-radius:999px;padding:12px 22px;font-weight:700}
figure{margin:16px 0}figure img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:10px;background:#0d1526}
figcaption{font-size:13px;color:var(--muted);margin-top:6px}
footer.site{border-top:1px solid var(--line);margin-top:24px;padding:28px 0;color:var(--muted);font-size:14px}
footer .cols{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:14px}
@media(max-width:560px){h1{font-size:26px}.intro{font-size:17px}}
`;

// Head meta shared by every page (title, description, canonical, OG, Twitter).
export function metaTags({ title, description, path, image = SITE.logo, imageW, imageH, type = 'website' }) {
  const canonical = url(path);
  const ogimg = `${SITE.base}${image}`;
  const tw = SITE.twitterHandle ? `<meta name="twitter:site" content="${esc(SITE.twitterHandle)}"/>` : '';
  const dims = (imageW && imageH)
    ? `\n    <meta property="og:image:width" content="${imageW}"/>\n    <meta property="og:image:height" content="${imageH}"/>`
    : '';
  return `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}"/>
    <meta name="robots" content="index, follow, max-image-preview:large"/>
    <link rel="canonical" href="${canonical}"/>
    <meta property="og:type" content="${type}"/>
    <meta property="og:site_name" content="${esc(SITE.name)}"/>
    <meta property="og:title" content="${esc(title)}"/>
    <meta property="og:description" content="${esc(description)}"/>
    <meta property="og:url" content="${canonical}"/>
    <meta property="og:image" content="${ogimg}"/>${dims}
    <meta property="og:locale" content="${SITE.locale}"/>
    <meta name="twitter:card" content="summary_large_image"/>${tw}
    <meta name="twitter:title" content="${esc(title)}"/>
    <meta name="twitter:description" content="${esc(description)}"/>
    <meta name="twitter:image" content="${ogimg}"/>`;
}

export const breadcrumbSchema = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE.base}${it.path}` }))
});

export const orgRef = { '@type': 'EducationalOrganization', '@id': `${SITE.base}/#organization`, name: SITE.name, url: `${SITE.base}/`, logo: `${SITE.base}${SITE.logo}` };

export function siteHeader() {
  const links = NAV.map((s) => `<a href="${href(s)}">${esc(bySlug[s].nav)}</a>`).join('');
  return `<header class="site"><div class="wrap">
    <a href="/" aria-label="Efiko home"><img src="/logo.png" alt="Efiko" width="52" height="28"/></a>
    <nav class="top" aria-label="Products">${links}</nav>
    <a class="cta" href="/">Open app</a>
  </div></header>`;
}

export function siteFooter() {
  const links = NAV.map((s) => `<a href="${href(s)}">${esc(bySlug[s].product)}</a>`).join('');
  return `<footer class="site"><div class="wrap">
    <div class="cols">${links}</div>
    <div>© ${new Date().getFullYear()} ${esc(SITE.name)} — ${esc(SITE.tagline)}</div>
  </div></footer>`;
}

// Assemble a full document from head meta + JSON-LD + body (header/footer included).
export function htmlDocument({ metaInner, schemaInner = '', body }) {
  return `<!doctype html><html lang="${SITE.locale}"><head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="theme-color" content="#0f766e"/>
    <link rel="icon" type="image/png" href="/favicon.png"/>
    ${metaInner}
    ${schemaInner}
    <style>${CSS}</style>
  </head><body>${siteHeader()}${body}${siteFooter()}</body></html>`;
}

// --- Product landing pages (from seo/pages.mjs) ---
function productSchema(page) {
  const canonical = url(page.slug);
  const primary = {
    course: { '@type': 'Course', name: page.product, description: page.description, url: canonical, provider: orgRef },
    webapp: { '@type': 'WebApplication', name: page.product, description: page.description, url: canonical, applicationCategory: 'EducationApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: orgRef },
    webpage: { '@type': 'WebPage', name: page.title, description: page.description, url: canonical, isPartOf: { '@id': `${SITE.base}/#website` }, publisher: orgRef }
  }[page.schema || 'webpage'];
  const graph = [primary, breadcrumbSchema([{ name: 'Home', path: '/' }, { name: page.product, path: page.slug }])];
  if (page.faqs?.length) graph.push({ '@type': 'FAQPage', mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return jsonld({ '@context': 'https://schema.org', '@graph': graph });
}

export function renderPage(page, extraHtml = '') {
  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(page.product)}</span></nav>
    <h1>${esc(page.h1)}</h1>
    <p class="intro">${esc(page.intro)}</p>
    <a class="hero-cta" href="/">Start learning with ${esc(page.product)}</a>
    ${page.sections.map((s) => `<section class="block"><h2>${esc(s.h2)}</h2><p>${esc(s.p)}</p></section>`).join('')}
    ${extraHtml}
    ${page.faqs?.length ? `<section class="block faq"><h2>Frequently asked questions</h2>${page.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>` : ''}
    ${page.related?.length ? `<section class="block"><h2>Explore more of Efiko</h2><div class="related">${page.related.map((s) => `<a href="${href(s)}">${esc(bySlug[s].product)}</a>`).join('')}</div></section>` : ''}
  </main>`;
  return htmlDocument({ metaInner: metaTags({ title: page.title, description: page.description, path: page.slug }), schemaInner: productSchema(page), body });
}

// Homepage content injected into the app shell's #root. Crawlers and no-JS visitors see this
// content-rich hub (brand + description + links to every section); when the app's JS loads,
// createRoot() clears #root and renders the app, so users are unaffected. This makes "/" — the
// most important URL — indexable and gives the homepage internal links to all sections.
export function renderHomeContent({ courses = [], academy = [] } = {}) {
  const products = NAV.map((s) => `<a href="${href(s)}">${esc(bySlug[s].nav)}</a>`).join('');
  const courseLinks = courses.slice(0, 8).map((c) => `<a href="${href(`/courses/${c.slug}`)}">${esc(`${c.university} ${c.course}`)}</a>`).join('');
  const guideLinks = academy.filter((i) => i.kind === 'guide').map((i) => `<a href="${href(`/academy/${i.slug}`)}">${esc(i.h1)}</a>`).join('');
  const style = '#efiko-home{max-width:820px;margin:0 auto;padding:48px 20px;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e2e8f0;text-align:center}#efiko-home img{height:44px;width:auto}#efiko-home h1{font-size:30px;margin:16px 0 8px}#efiko-home p.lede{font-size:18px;color:#cbd5e1;max-width:640px;margin:0 auto 8px}#efiko-home h2{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:28px 0 10px}#efiko-home .links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}#efiko-home a{color:#14b8a6;text-decoration:none;border:1px solid #1e293b;border-radius:999px;padding:6px 14px}';
  return `<div id="efiko-home"><style>${style}</style>
    <img src="/logo.png" alt="Efiko" width="80" height="44"/>
    <h1>${esc(SITE.name)} — ${esc(SITE.tagline)}</h1>
    <p class="lede">${esc(SITE.description)}</p>
    <h2>Explore Efiko</h2><nav class="links">${products}</nav>
    ${courseLinks ? `<h2>Courses</h2><nav class="links">${courseLinks}</nav>` : ''}
    ${guideLinks ? `<h2>Study guides</h2><nav class="links">${guideLinks}</nav>` : ''}
  </div>`;
}

export function renderSitemap(extra = []) {
  const now = new Date().toISOString().slice(0, 10);
  const entries = [
    { loc: `${SITE.base}/`, priority: '1.0', changefreq: 'weekly' },
    ...PAGES.map((p) => ({ loc: url(p.slug), priority: '0.8', changefreq: 'weekly' })),
    ...extra.map((path) => ({ loc: url(path), priority: '0.6', changefreq: 'monthly' }))
  ];
  const urls = entries.map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots() {
  return `# Efiko — robots.txt\n# Public content is path-based (e.g. /courses, /ai). App-internal views use query\n# strings (admin consoles, deep links) and are not meant for the index.\n\nUser-agent: *\nAllow: /\nDisallow: /*?\n\nSitemap: ${SITE.base}/sitemap.xml\n`;
}
