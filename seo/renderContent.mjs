// Efiko — catalog-driven content pages (the organic-traffic layer):
//   - course hub:  /courses/<course-slug>/           (Course + ItemList + Breadcrumb)
//   - topic page:  /courses/<course-slug>/<topic>/   (LearningResource/Article + Breadcrumb)
// Built on the shared document core in render.mjs. Content is real lesson text from the
// catalog — indexable, useful pages that link into the app to actually learn.
import { SITE, url, href } from './site.mjs';
import { esc, jsonld, htmlDocument, metaTags, breadcrumbSchema, orgRef } from './render.mjs';

const clip = (s, n = 155) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const coursePath = (c) => `/courses/${c.slug}`;
const topicPath = (c, t) => `/courses/${c.slug}/${t.slug}`;
const courseName = (c) => `${c.university} ${c.course}`;

export function renderCourseHub(course) {
  const path = coursePath(course);
  const name = courseName(course);
  const topicNames = course.topics.map((t) => t.topic).join(', ');
  const title = `${name} — Course Topics & Lessons | Efiko`;
  const description = clip(`Study ${name} on Efiko. Topics: ${topicNames}. Adaptive, exam-focused lessons with quizzes — learn online or offline.`);

  const schema = jsonld({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Course', name, description, url: url(path), provider: orgRef,
        hasPart: course.topics.map((t) => ({ '@type': 'Course', name: t.topic, url: url(topicPath(course, t)) })) },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name: name, path }])
    ]
  });

  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${href('/courses')}">Courses</a> › <span>${esc(name)}</span></nav>
    <h1>${esc(name)}</h1>
    <p class="intro">Adaptive, exam-focused lessons for ${esc(name)} — learn with text, whiteboard, voice and quizzes, online or offline.</p>
    <a class="hero-cta" href="/">Open ${esc(name)} in Efiko</a>
    <section class="block"><h2>Topics in this course</h2>
      <ul class="topics">${course.topics.map((t) => `<li><a href="${href(topicPath(course, t))}">${esc(t.topic)}</a><div class="t-sub">${[t.level, t.durationMin ? `${t.durationMin} min` : ''].filter(Boolean).map(esc).join(' · ')}</div></li>`).join('')}</ul>
    </section>
  </main>`;

  return htmlDocument({ metaInner: metaTags({ title, description, path, type: 'website' }), schemaInner: schema, body });
}

export function renderTopicPage(course, topic) {
  const path = topicPath(course, topic);
  const name = courseName(course);
  const title = `${topic.topic} — ${name} | Efiko`;
  const summary = topic.paragraphs[0] || `Learn ${topic.topic} in ${name} on Efiko.`;
  const description = clip(summary);

  const schema = jsonld({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': ['LearningResource', 'Article'], name: topic.topic, headline: topic.topic, description,
        url: url(path), inLanguage: SITE.locale, learningResourceType: 'Lesson',
        ...(topic.level ? { educationalLevel: topic.level } : {}),
        ...(topic.durationMin ? { timeRequired: `PT${topic.durationMin}M` } : {}),
        about: { '@type': 'Thing', name: topic.topic },
        isPartOf: { '@type': 'Course', name, url: url(coursePath(course)) },
        provider: orgRef, publisher: orgRef },
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Courses', path: '/courses' }, { name, path: coursePath(course) }, { name: topic.topic, path }])
    ]
  });

  const chips = [topic.level, topic.durationMin ? `${topic.durationMin} min read` : '', name].filter(Boolean);
  const paras = topic.paragraphs.length ? topic.paragraphs : [`An introduction to ${topic.topic} in ${name}.`];
  const figure = topic.figure ? `<figure><img src="${esc(topic.figure.src)}" alt="${esc(topic.figure.caption || topic.topic)}" loading="lazy"/>${topic.figure.caption ? `<figcaption>${esc(topic.figure.caption)}</figcaption>` : ''}</figure>` : '';
  const siblings = course.topics.filter((t) => t.slug !== topic.slug).slice(0, 6);

  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="${href('/courses')}">Courses</a> › <a href="${href(coursePath(course))}">${esc(name)}</a> › <span>${esc(topic.topic)}</span></nav>
    <h1>${esc(topic.topic)}</h1>
    <div class="meta-chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    <a class="hero-cta" href="/">Learn ${esc(topic.topic)} in Efiko</a>
    <section class="block prose">${figure}${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</section>
    ${siblings.length ? `<section class="block"><h2>More topics in ${esc(name)}</h2><div class="related">${siblings.map((t) => `<a href="${href(topicPath(course, t))}">${esc(t.topic)}</a>`).join('')}</div></section>` : ''}
  </main>`;

  return htmlDocument({ metaInner: metaTags({ title, description, path, type: 'article' }), schemaInner: schema, body });
}

// All content paths (for sitemap + build).
export function contentRoutes(courses) {
  const paths = [];
  for (const c of courses) {
    paths.push(coursePath(c));
    for (const t of c.topics) paths.push(topicPath(c, t));
  }
  return paths;
}
