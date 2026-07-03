// Efiko — prerender step. Runs AFTER `vite build` (see package.json build script). Writes:
//   - a static landing page per product          -> dist/<slug>/index.html
//   - a course hub per catalog course            -> dist/courses/<course>/index.html
//   - a content page per topic (real lesson text) -> dist/courses/<course>/<topic>/index.html
//   - a generated sitemap.xml + robots.txt (domain from seo/site.mjs)
// The logged-in app stays a SPA at "/"; these public pages are separate static documents.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../seo/pages.mjs';
import { renderPage, renderSitemap, renderRobots } from '../seo/render.mjs';
import { loadCourses } from '../seo/catalog.mjs';
import { renderCourseHub, renderTopicPage, contentRoutes } from '../seo/renderContent.mjs';
import { ACADEMY } from '../seo/guides.mjs';
import { renderAcademyItem, academyRoutes, academyIndexHtml } from '../seo/renderAcademy.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const writePage = (route, html) => {
  const dir = join(dist, route.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
};

// Catalog-driven content pages.
const courses = loadCourses();

// "Browse courses" section injected into the /courses product landing (internal linking).
const courseListHtml = courses.length
  ? `<section class="block"><h2>Browse courses</h2><ul class="topics">${courses.map((c) => `<li><a href="/courses/${c.slug}">${c.university} ${c.course}</a><div class="t-sub">${c.topics.length} topic${c.topics.length !== 1 ? 's' : ''}</div></li>`).join('')}</ul></section>`
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

// Sitemap (products + course content + academy) + robots.
writeFileSync(join(dist, 'sitemap.xml'), renderSitemap([...contentRoutes(courses), ...academyRoutes()]), 'utf8');
writeFileSync(join(dist, 'robots.txt'), renderRobots(), 'utf8');

console.log(`SEO prerender: ${PAGES.length} product pages, ${courses.length} course hubs, ${topicCount} topic pages, ${ACADEMY.length} academy pages + sitemap.xml + robots.txt → dist/`);
