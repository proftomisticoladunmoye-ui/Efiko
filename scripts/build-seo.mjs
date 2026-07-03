// Efiko — prerender step. Runs AFTER `vite build` (see package.json build script). Writes:
//   - a static landing page per product          -> dist/<slug>/index.html
//   - a course hub per catalog course            -> dist/courses/<course>/index.html
//   - a content page per topic (real lesson text) -> dist/courses/<course>/<topic>/index.html
//   - a generated sitemap.xml + robots.txt (domain from seo/site.mjs)
// The logged-in app stays a SPA at "/"; these public pages are separate static documents.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../seo/pages.mjs';
import { renderPage, renderSitemap, renderRobots, renderHomeContent } from '../seo/render.mjs';
import { loadCourses, fetchPublishedCourses, mergeCourses } from '../seo/catalog.mjs';
import { renderCourseHub, renderTopicPage, contentRoutes } from '../seo/renderContent.mjs';
import { ACADEMY } from '../seo/guides.mjs';
import { renderAcademyItem, academyRoutes, academyIndexHtml } from '../seo/renderAcademy.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const writePage = (route, html) => {
  const dir = join(dist, route.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
};

// Catalog-driven content pages: static bundled catalog + (optionally) lecturer-published
// lessons from the live gateway. The fetch is best-effort — if the gateway is unreachable
// the build proceeds with the static catalog only. Set SEO_CONTENT_URL to override, or
// SEO_SKIP_PUBLISHED=1 to disable the fetch entirely (e.g. faster local builds).
const staticCourses = loadCourses();
let courses = staticCourses;
const gatewayUrl = process.env.SEO_CONTENT_URL || process.env.VITE_GATEWAY || 'https://efiko-gateway.onrender.com';
if (!process.env.SEO_SKIP_PUBLISHED) {
  // Generous timeout: the gateway is a separate Render service that may be cold at build time.
  const published = await fetchPublishedCourses(gatewayUrl, Number(process.env.SEO_FETCH_TIMEOUT_MS) || 30000);
  if (published && published.length) {
    courses = mergeCourses(staticCourses, published);
    console.log(`SEO: merged ${published.length} published course(s) from ${gatewayUrl}`);
  } else {
    console.log(`SEO: no published courses fetched (${gatewayUrl}) — using static catalog only`);
  }
}

// "Browse courses" section injected into the /courses product landing (internal linking).
const courseListHtml = courses.length
  ? `<section class="block"><h2>Browse courses</h2><ul class="topics">${courses.map((c) => `<li><a href="/courses/${c.slug}/">${c.university} ${c.course}</a><div class="t-sub">${c.topics.length} topic${c.topics.length !== 1 ? 's' : ''}</div></li>`).join('')}</ul></section>`
  : '';

// Product landing pages (inject course list into /courses, guide/definition list into /academy).
const injected = { '/courses': courseListHtml, '/academy': academyIndexHtml() };
for (const page of PAGES) writePage(page.slug, renderPage(page, injected[page.slug] || ''));

// Academy content pages (guides + definitions).
for (const item of ACADEMY) writePage(`/academy/${item.slug}`, renderAcademyItem(item));
let topicCount = 0;
for (const c of courses) {
  writePage(`/courses/${c.slug}`, renderCourseHub(c));
  for (const t of c.topics) { writePage(`/courses/${c.slug}/${t.slug}`, renderTopicPage(c, t)); topicCount++; }
}

// Homepage: inject crawlable content into the app shell's empty #root (React clears it on
// mount, so users get the app; crawlers/no-JS get a content-rich, internally-linked homepage).
const idxPath = join(dist, 'index.html');
const home = renderHomeContent({ courses, academy: ACADEMY });
const idx = readFileSync(idxPath, 'utf8');
if (idx.includes('<div id="root"></div>')) {
  writeFileSync(idxPath, idx.replace('<div id="root"></div>', `<div id="root">${home}</div>`), 'utf8');
} else {
  console.warn('SEO: could not find empty #root in index.html — homepage content not injected');
}

// Sitemap (products + course content + academy) + robots.
writeFileSync(join(dist, 'sitemap.xml'), renderSitemap([...contentRoutes(courses), ...academyRoutes()]), 'utf8');
writeFileSync(join(dist, 'robots.txt'), renderRobots(), 'utf8');

console.log(`SEO prerender: ${PAGES.length} product pages, ${courses.length} course hubs, ${topicCount} topic pages, ${ACADEMY.length} academy pages + sitemap.xml + robots.txt → dist/`);
