// Efiko — SEO site config. SINGLE SOURCE OF TRUTH for the production domain and brand.
// Used by the prerender pipeline (scripts/build-seo.mjs) to generate landing pages,
// sitemap.xml and robots.txt. Change BASE here if the domain ever changes.
export const SITE = {
  base: 'https://efikolearn.online',
  name: 'Efiko',
  tagline: 'Learn Anywhere. Understand Everything.',
  description:
    'Efiko is an AI learning operating system for African university students: adaptive courses, an AI tutor, ThinkSpace, certificates, a study community and a marketplace — built to work even on low or no internet.',
  logo: '/logo.png',
  // Public API gateway (used by the static pages' live learners counter).
  gateway: 'https://efiko-gateway.onrender.com',
  locale: 'en',
  // Social profiles (add real handles when live; used for Organization sameAs + twitter:site).
  sameAs: [],
  twitterHandle: '' // e.g. '@efikolearn' — omitted from tags while empty
};

// Canonical form uses a TRAILING SLASH. On the static host a request to /courses (no slash)
// can be shadowed by the SPA fallback, whereas /courses/ resolves to the prerendered
// <slug>/index.html. So all internal links, canonicals, OG urls and the sitemap use the
// trailing-slash form. Use href() for in-page links and url() for absolute URLs.
export const withSlash = (p = '/') => (p === '/' ? '/' : `/${String(p).replace(/^\/+|\/+$/g, '')}/`);
export const href = withSlash;
export const url = (path = '/') => `${SITE.base}${withSlash(path)}`;
