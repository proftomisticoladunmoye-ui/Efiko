// EFIKO — About + Privacy Policy pages. Crawlable static documents (real HTML, work without JS),
// built from the company's approved copy. Rendered with the shared site chrome (header/footer).
import { SITE, url, href } from './site.mjs';
import { esc, metaTags, htmlDocument, breadcrumbSchema, jsonld, orgRef } from './render.mjs';

const crumb = (name, path) => jsonld(breadcrumbSchema([{ name: 'Home', path: '/' }, { name, path }]));

export const aboutPath = '/about';
export const privacyPath = '/privacy';

export function renderAbout() {
  const title = 'About Efiko — AI Learning for African Universities';
  const description = 'Efiko is an AI learning operating system for African university students: an AI tutor, adaptive courses, whiteboard lessons and assessments — built to work on low bandwidth and fully offline.';
  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>About</span></nav>
    <h1>About Efiko</h1>
    <p class="intro">Learn Anywhere. Understand Everything.</p>

    <section class="block prose">
      <h2>Our Mission</h2>
      <p>Across Africa, millions of university students are bright, ambitious, and under-served — held back not by ability, but by expensive data, unreliable internet, and limited access to personal academic support. Efiko exists to close that gap.</p>
      <p>Efiko is an AI learning operating system built for African university students. It combines an AI tutor, adaptive courses, whiteboard explanations, assessments, and a study community into one platform — designed from the ground up to work on low bandwidth, and to keep working fully offline once content is downloaded.</p>
    </section>

    <section class="block prose">
      <h2>How Efiko Works</h2>
      <p>Efiko is built around one simple learning loop:</p>
      <p><strong>Ask → Understand → Practice → Assess</strong></p>
      <p>A student asks any question — from organic chemistry to econometrics — and Efiko AI responds with a clear, step-by-step explanation grounded in their course and level. Every answer can become a whiteboard animation, a voice lesson, flashcards, or a graded quiz. Everything a student opens can be saved for offline revision, so a weak connection never stops learning.</p>
    </section>

    <section class="block prose">
      <h2>Where We Are Today</h2>
      <p>Efiko is currently piloting with university students in Uganda, with live courses aligned to programmes at Kampala International University (KIU) and Makerere University. We are expanding course coverage and institutional partnerships across East Africa.</p>
    </section>

    <section class="block prose">
      <h2>Who Is Behind Efiko</h2>
      <p>Efiko is developed by Psychtrix Initiative Limited, a Ugandan education and psychometric technology company founded by Associate Prof. E.O. Oladunmoye, Associate Professor of Psychometrics and Quantitative Methods at Kampala International University. The platform draws on his research expertise in learning assessment, measurement, and applied data science in African educational contexts — meaning Efiko is not only built to teach, but built to rigorously measure whether learning is actually happening.</p>
    </section>

    <section class="block prose">
      <h2>Partner With Us</h2>
      <p>We welcome collaboration with universities, lecturers, funders, and organisations working to expand access to quality higher education in Africa.</p>
      <p>📧 Contact: <a href="mailto:support@efikolearn.online">support@efikolearn.online</a><br/>🌍 Web: <a href="/">efikolearn.online</a></p>
    </section>

    <section class="block"><a class="hero-cta" href="/">Open the Efiko app</a></section>
  </main>`;
  return htmlDocument({ metaInner: metaTags({ title, description, path: aboutPath, type: 'website' }), schemaInner: crumb('About', aboutPath), body });
}

export function renderPrivacy() {
  const title = 'Privacy Policy — Efiko';
  const description = 'How Efiko (Psychtrix Initiative Limited) collects, uses, stores and protects your personal data, in line with the Data Protection and Privacy Act, 2019 (Uganda).';
  const li = (items) => `<ul class="topics">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  const body = `<main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Privacy Policy</span></nav>
    <h1>Efiko Privacy Policy</h1>
    <p class="intro">Effective date: 6 June 2026 · Last updated: 13 July 2026</p>
    <section class="block prose">
      <p>Efiko (“we”, “us”, “our”) is operated by Psychtrix Initiative Limited, Kampala, Uganda. This policy explains how we collect, use, store, and protect your personal data when you use efikolearn.online and the Efiko applications (together, the “Platform”). We are committed to handling your data in accordance with the Data Protection and Privacy Act, 2019 (Uganda) and its Regulations.</p>

      <h2>1. Information We Collect</h2>
      <p><strong>Information you provide:</strong></p>
      ${li(['Account details: name, email address, phone number, university/institution, programme, and level of study', 'Content you create: questions asked to the AI tutor, notes, whiteboard content, community posts, and assessment responses'])}
      <p><strong>Information collected automatically:</strong></p>
      ${li(['Usage data: courses opened, lessons downloaded, quizzes attempted, scores, session duration, and feature usage', 'Technical data: device type, operating system, app version, and approximate connection quality (used to optimise low-data delivery)'])}
      <p>We do not collect national ID numbers, financial account details, or biometric data. We do not knowingly collect data from anyone under 18; Efiko is designed for university-level learners.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use your data to:</p>
      ${li(['Provide and personalise learning — tailoring explanations, courses, and assessments to your programme and level', 'Enable offline learning — managing content you download to your device', 'Track your academic progress and issue certificates', 'Improve the Platform — analysing anonymised usage patterns to make Efiko more effective', 'Communicate with you about your account, courses, and important updates', 'Conduct educational research — only in anonymised or aggregated form, and where individual-level research participation is involved, only with your separate, explicit consent'])}
      <p>We do not sell your personal data. We do not use your data for third-party advertising.</p>

      <h2>3. AI Processing</h2>
      <p>Questions you submit to Efiko AI are processed by artificial intelligence systems to generate explanations, whiteboard content, voice lessons, and quizzes. Your questions may be processed by trusted third-party AI service providers under contractual safeguards. We do not permit these providers to use your personal data to train their models where such controls are available, and we minimise the personal information included in AI requests.</p>

      <h2>4. Legal Basis for Processing</h2>
      <p>We process your data on the basis of: (a) your consent, given when you create an account; (b) performance of our service to you; and (c) our legitimate interest in improving the Platform, consistent with the Data Protection and Privacy Act, 2019.</p>

      <h2>5. Data Sharing</h2>
      <p>We share data only with:</p>
      ${li(['Service providers (e.g., hosting, AI processing, analytics) bound by confidentiality and data-processing agreements', 'Your institution, only where you enrol through an institutional partnership and only regarding your participation and progress in that institution’s courses', 'Authorities, where required by law'])}

      <h2>6. Data Storage and Security</h2>
      <p>Your data is stored on secure cloud infrastructure with encryption in transit and at rest, access controls, and regular security review. Where data is stored or processed outside Uganda, we ensure safeguards consistent with Ugandan data protection requirements.</p>

      <h2>7. Data Retention</h2>
      <p>We retain your account data for as long as your account is active. If you delete your account, we delete or anonymise your personal data within 90 days, except where retention is required by law. Anonymised, aggregated learning data may be retained for research and platform improvement.</p>

      <h2>8. Your Rights</h2>
      <p>Under the Data Protection and Privacy Act, 2019, you have the right to:</p>
      ${li(['Access the personal data we hold about you', 'Request correction of inaccurate data', 'Request deletion of your data', 'Object to or restrict certain processing', 'Withdraw consent at any time'])}
      <p>To exercise any of these rights, contact us at <a href="mailto:support@psychtrixinnovative.com">support@psychtrixinnovative.com</a>. You also have the right to lodge a complaint with the Personal Data Protection Office (PDPO) of Uganda.</p>

      <h2>9. Cookies and Local Storage</h2>
      <p>The Platform uses essential cookies and local device storage to keep you signed in, save your preferences, and store downloaded lessons for offline use. Downloaded content remains on your device under your control.</p>

      <h2>10. Changes to This Policy</h2>
      <p>We may update this policy from time to time. We will notify you of material changes through the Platform or by email. Continued use after changes take effect constitutes acceptance of the updated policy.</p>

      <h2>11. Contact Us</h2>
      <p>Data Controller: Psychtrix Initiative Limited<br/>📍 Kampala, Uganda<br/>📧 <a href="mailto:support@psychtrixinnovative.com">support@psychtrixinnovative.com</a></p>
    </section>
    <section class="block"><a class="hero-cta" href="/">Open the Efiko app</a></section>
  </main>`;
  return htmlDocument({ metaInner: metaTags({ title, description, path: privacyPath, type: 'website' }), schemaInner: crumb('Privacy Policy', privacyPath), body });
}
