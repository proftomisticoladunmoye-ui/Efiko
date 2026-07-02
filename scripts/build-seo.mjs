// Efiko — prerender step. Runs AFTER `vite build` (see package.json build script). Writes a
// static, indexable HTML document per product page into dist/<slug>/index.html, plus a
// generated sitemap.xml and robots.txt (domain sourced from seo/site.mjs). The logged-in app
// stays a SPA at "/"; these public pages are separate static documents for search + social.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../seo/pages.mjs';
import { renderPage, renderSitemap, renderRobots } from '../seo/render.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let count = 0;
for (const page of PAGES) {
  const dir = join(dist, page.slug.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderPage(page), 'utf8');
  count++;
}

writeFileSync(join(dist, 'sitemap.xml'), renderSitemap(), 'utf8');
writeFileSync(join(dist, 'robots.txt'), renderRobots(), 'utf8');

console.log(`SEO prerender: ${count} product pages + sitemap.xml + robots.txt → dist/`);
