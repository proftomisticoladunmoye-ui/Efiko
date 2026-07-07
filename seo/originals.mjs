// EFIKO Originals — SEO pages. One rich, indexable page per EFIKO Original (the free
// micro-certificate courses), built from the bundled seed content at server/content/originals.
// URL: /courses/<title-slug>/  (matches the product vision, e.g. /courses/ai-literacy-essentials).
import { SITE, url, href } from './site.mjs';
import { esc, jsonld, htmlDocument, metaTags, breadcrumbSchema, orgRef } from './render.mjs';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'content', 'originals');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const clip = (s, n = 155) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const coursePath = (c) => `/courses/${slugify(c.title)}`;
export const originalPath = coursePath;

export function loadOriginals() {
  if (!existsSync(SEED_DIR)) return [];
  const out = [];
  for (const f of readdirSync(SEED_DIR)) {
    if (!f.endsWith('.json')) continue;
    try { const c = JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')); if (c?.courseId && c.title) out.push(c); } catch { /* skip */ }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

export const originalRoutes = (courses) => courses.map(coursePath);

// Standard FAQs, grounded in the course data (good for FAQ rich results).
function faqs(c) {
  return [
    { q: `Is the ${c.title} course free?`, a: `Yes. ${c.title} is a free EFIKO Original micro-certificate course — you can learn it at no cost and earn a verifiable certificate on completion.` },
    { q: `Do I get a certificate for ${c.title}?`, a: `Yes. Pass the final assessment and you earn a verifiable EFIKO certificate with a QR code and public verification link, listing the competencies you achieved.` },
    { q: `How long does ${c.title} take?`, a: `About ${c.estimatedHours || 4} hours across ${(c.sessions || []).length} short sessions, each with a lesson, quiz and flashcards. You can learn at your own pace, even offline.` },
    { q: `Who is ${c.title} for?`, a: c.audience ? `It is designed for ${c.audience.toLowerCase()}, at a ${String(c.level || 'beginner').toLowerCase()} level. No prior experience is assumed.` : `Any learner at a ${String(c.level || 'beginner').toLowerCase()} level — no prior experience assumed.` }
  ];
}

export function renderOriginal(c, ogImage = null) {
  const p = coursePath(c);
  const canonical = url(p);
  const title = `${c.title} — Free Online Course with Certificate | Efiko`;
  const description = clip(c.description || `Learn ${c.title} free on Efiko: ${(c.sessions || []).length} sessions, quizzes and a verifiable certificate.`);
  const sample = (c.sessions || [])[0];

  const schema = jsonld({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course', name: c.title, description: c.description || description, url: canonical,
        provider: orgRef, inLanguage: SITE.locale, isAccessibleForFree: true,
        ...(c.level ? { educationalLevel: c.level } : {}),
        ...(c.competencies?.length ? { teaches: c.competencies } : {}),
        ...(c.estimatedHours ? { timeRequired: `PT${c.estimatedHours}H` } : {}),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', category: 'Free', availability: 'https://schema.org/InStock' },
        hasCourseInstance: {
          '@type': 'CourseInstance', courseMode: 'online',
          ...(c.estimatedHours ? { courseWorkload: `PT${c.estimatedHours}H` } : {}),
          instructor: { '@type': 'Organization', name: SITE.name }
        }
      },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name: c.title, path: p }]),
      { '@type': 'FAQPage', mainEntity: faqs(c).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  });

  const chips = [c.category, c.level, c.estimatedHours && `${c.estimatedHours} hours`, `${(c.sessions || []).length} sessions`, 'Free · Certificate'].filter(Boolean);

  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${href('/courses')}">Courses</a> › <span>${esc(c.title)}</span></nav>
    <p class="o-seo-badge">⭐ EFIKO Original · Free micro-certificate</p>
    <h1>${esc(c.title)}</h1>
    ${c.subtitle ? `<p class="intro">${esc(c.subtitle)}</p>` : ''}
    <div class="meta-chips">${chips.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <a class="hero-cta" href="/">Start this free course</a>
    ${c.description ? `<section class="block prose"><p>${esc(c.description)}</p></section>` : ''}
    ${c.outcomes?.length ? `<section class="block"><h2>What you'll learn</h2><ul class="topics">${c.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></section>` : ''}
    ${c.sessions?.length ? `<section class="block"><h2>Course sessions</h2><ol class="steps">${c.sessions.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(clip(s.summary || (s.objectives || [])[0] || '', 140))}</li>`).join('')}</ol></section>` : ''}
    ${sample ? `<section class="block prose"><h2>Sample lesson: ${esc(sample.title)}</h2><p>${esc(clip(sample.text, 320))}</p></section>` : ''}
    ${c.competencies?.length ? `<section class="block"><h2>Competencies you'll gain</h2><ul class="topics">${c.competencies.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    <section class="block faq"><h2>Frequently asked questions</h2>${faqs(c).map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>
    <section class="block"><a class="hero-cta" href="/">Start ${esc(c.title)} — free</a></section>
  </main>`;

  const meta = ogImage
    ? metaTags({ title, description, path: p, type: 'website', image: ogImage, imageW: 1200, imageH: 630 })
    : metaTags({ title, description, path: p, type: 'website' });
  return htmlDocument({ metaInner: meta, schemaInner: schema, body });
}

// "Free courses" list injected into the /courses product landing.
export function originalsIndexHtml(courses) {
  if (!courses.length) return '';
  return `<section class="block"><h2>Free EFIKO Original courses</h2><ul class="topics">${courses.map((c) => `<li><a href="${href(coursePath(c))}">${esc(c.title)}</a><div class="t-sub">${esc([c.category, c.level, `${(c.sessions || []).length} sessions`].filter(Boolean).join(' · '))}</div></li>`).join('')}</ul></section>`;
}
