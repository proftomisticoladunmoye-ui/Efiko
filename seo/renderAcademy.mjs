// Efiko — Academy content pages: study guides (HowTo) and definitions (DefinedTerm) at
// /academy/<slug>. Built on the shared document core in render.mjs.
import { SITE, url } from './site.mjs';
import { esc, jsonld, htmlDocument, metaTags, breadcrumbSchema, orgRef } from './render.mjs';
import { ACADEMY } from './guides.mjs';

const path = (item) => `/academy/${item.slug}`;
const label = (slug) => { const i = ACADEMY.find((x) => x.slug === slug); return i ? (i.term || i.h1) : slug; };

function schemaFor(item) {
  const canonical = url(path(item));
  const graph = [];

  if (item.kind === 'definition') {
    graph.push({ '@type': 'DefinedTerm', '@id': `${canonical}#term`, name: item.term, description: item.short, url: canonical,
      inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Efiko Academy Glossary', url: `${SITE.base}/academy` } });
  } else if (item.steps?.length) {
    graph.push({ '@type': 'HowTo', name: item.h1, description: item.description, url: canonical,
      step: item.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })) });
  } else {
    graph.push({ '@type': 'Article', headline: item.h1, description: item.description, url: canonical });
  }

  // Every Academy page is also an Article (authorship/freshness) unless it already is one.
  if (item.kind !== 'guide' || item.steps?.length) {
    graph.push({ '@type': 'Article', headline: item.h1, description: item.description, url: canonical,
      datePublished: item.updated, dateModified: item.updated, author: orgRef, publisher: orgRef,
      mainEntityOfPage: canonical, inLanguage: SITE.locale });
  }

  graph.push(breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: item.term || item.h1, path: path(item) }]));

  if (item.faqs?.length) graph.push({ '@type': 'FAQPage', mainEntity: item.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });

  return jsonld({ '@context': 'https://schema.org', '@graph': graph });
}

export function renderAcademyItem(item) {
  const heading = esc(item.term || item.h1);
  const intro = item.kind === 'definition'
    ? `<p class="intro">${esc(item.short)}</p>`
    : `<p class="intro">${esc(item.intro)}</p>`;

  const steps = item.steps?.length
    ? `<section class="block"><h2>Step by step</h2><ol class="steps">${item.steps.map((s) => `<li><strong>${esc(s.name)}.</strong> ${esc(s.text)}</li>`).join('')}</ol></section>`
    : '';

  const body = item.body?.length
    ? `<section class="block prose">${item.body.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`
    : '';

  const faqs = item.faqs?.length
    ? `<section class="block faq"><h2>Frequently asked questions</h2>${item.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>`
    : '';

  const related = item.related?.length
    ? `<section class="block"><h2>Related</h2><div class="related">${item.related.map((s) => `<a href="/academy/${s}">${esc(label(s))}</a>`).join('')}</div></section>`
    : '';

  const main = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/academy">Academy</a> › <span>${heading}</span></nav>
    <h1>${esc(item.h1)}</h1>
    ${intro}
    <a class="hero-cta" href="/">Learn with Efiko</a>
    ${steps}${body}${faqs}${related}
  </main>`;

  return htmlDocument({ metaInner: metaTags({ title: item.title, description: item.description, path: path(item), type: 'article' }), schemaInner: schemaFor(item), body: main });
}

export const academyRoutes = () => ACADEMY.map(path);

// "From the Academy" list to inject into the /academy product landing page.
export function academyIndexHtml() {
  const guides = ACADEMY.filter((i) => i.kind === 'guide');
  const defs = ACADEMY.filter((i) => i.kind === 'definition');
  const list = (items) => `<ul class="topics">${items.map((i) => `<li><a href="${path(i)}">${esc(i.term || i.h1)}</a><div class="t-sub">${esc(i.description.slice(0, 90))}…</div></li>`).join('')}</ul>`;
  return `<section class="block"><h2>Study guides</h2>${list(guides)}</section>
    <section class="block"><h2>Definitions</h2>${list(defs)}</section>`;
}
