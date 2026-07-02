// Efiko — public landing-page definitions. One entry per major product. The prerender
// pipeline turns each into a static, indexable HTML document with its own metadata,
// breadcrumb + schema, content and internal links. Keep copy factual and useful.

// Nav / internal-link order (also the header nav).
export const NAV = ['/ai', '/thinkspace', '/courses', '/whiteboard', '/assessments', '/certificates', '/marketplace', '/community', '/jobs', '/research', '/academy'];

export const PAGES = [
  {
    slug: '/ai', product: 'Efiko AI', nav: 'AI Tutor',
    title: 'Efiko AI — Your Personal AI Tutor for University',
    description: 'Ask any question and get a clear, worked explanation. Efiko AI is a low-data AI tutor for African university students — voice, whiteboard and step-by-step answers, online or offline.',
    h1: 'Efiko AI — an AI tutor that meets you where you are',
    intro: 'Efiko AI turns any question into a clear, patient explanation. Type or speak a topic and get a structured answer, a drawn-out whiteboard, spoken audio and a quick quiz to check understanding — designed to work on low bandwidth and to keep helping once content is downloaded.',
    sections: [
      { h2: 'Ask anything, understand everything', p: 'From organic chemistry mechanisms to econometrics, Efiko AI explains concepts step by step, with concrete examples grounded in your course and level.' },
      { h2: 'Built for low data', p: 'Answers are compact, voice is optional, and everything you open can be saved for offline revision — so a weak connection never stops learning.' },
      { h2: 'More than a chatbot', p: 'Every answer can become a whiteboard animation, a voice lesson, flashcards or a graded quiz, so you move from reading to understanding to practice.' }
    ],
    faqs: [
      { q: 'Is Efiko AI free to use?', a: 'Yes. Every signed-in learner gets a daily allowance of free AI credits, and downloaded lessons keep working at no cost, even offline.' },
      { q: 'Does Efiko AI work without internet?', a: 'Answers need a connection to generate, but any lesson, whiteboard or voice clip you open can be downloaded and revised fully offline.' },
      { q: 'Which subjects does it cover?', a: 'Efiko AI supports any university subject — sciences, engineering, humanities, business and more — tailored to your course and level.' }
    ],
    schema: 'course', related: ['/thinkspace', '/courses', '/whiteboard']
  },
  {
    slug: '/thinkspace', product: 'Efiko ThinkSpace', nav: 'ThinkSpace',
    title: 'Efiko ThinkSpace — A Thinking Space That Remembers',
    description: 'ThinkSpace is your persistent AI study workspace: discussions that remember context, plus one-tap Summary, Quiz and Flashcard tools generated from your conversation.',
    h1: 'ThinkSpace — where your ideas and your AI tutor grow together',
    intro: 'ThinkSpace is a persistent workspace for thinking out loud with Efiko AI. Discussions remember what you talked about, so you can pick up where you left off — and turn any conversation into study notes, a quiz or flashcards in one tap.',
    sections: [
      { h2: 'Discussions with memory', p: 'Unlike a one-off chat, ThinkSpace keeps the thread of your thinking. Ask a follow-up days later and it still remembers the context.' },
      { h2: 'AI tools that build resources', p: 'Generate a summary, a practice quiz or a set of flashcards straight from a discussion, and save them to revise later.' },
      { h2: 'Export your work', p: 'Take any discussion out as Markdown, Word or PDF for your notes, your group, or your lecturer.' }
    ],
    faqs: [
      { q: 'What makes ThinkSpace different from a normal AI chat?', a: 'ThinkSpace discussions are persistent and context-aware — they remember earlier turns — and they can generate saved study resources from the conversation.' },
      { q: 'Can I export my discussions?', a: 'Yes — export any discussion to Markdown, Word or PDF from the Library.' }
    ],
    schema: 'webapp', related: ['/ai', '/courses', '/assessments']
  },
  {
    slug: '/courses', product: 'Efiko Courses', nav: 'Courses',
    title: 'Efiko Courses — Adaptive University Courses, Offline-Ready',
    description: 'Browse adaptive, exam-focused university courses that work offline. Learn with text, animated whiteboards, voice and quizzes, and earn a verifiable certificate.',
    h1: 'Efiko Courses — adaptive learning built for real exams',
    intro: 'Efiko Courses bring together bite-sized capsules and adaptive whiteboard lessons into one catalogue. Enrol with a class code from your lecturer or explore openly, and learn in whatever format helps — text, whiteboard, voice or quiz.',
    sections: [
      { h2: 'One catalogue, many formats', p: 'Each course opens as tabs — read it, watch it drawn out, hear it, or test yourself — so you can learn the way that works for you.' },
      { h2: 'Adaptive and exam-focused', p: 'Lessons adapt to how you answer, and quizzes map to real exam expectations, tracking your readiness as you go.' },
      { h2: 'Works offline', p: 'Download a course and keep learning with zero data — voice and whiteboards included.' }
    ],
    faqs: [
      { q: 'How do I join my class?', a: 'Enter the class code your lecturer shares, or open a course’s join link. You can also browse courses without an account.' },
      { q: 'Can I take courses offline?', a: 'Yes. Download any course to learn fully offline, including the voice and whiteboard content.' },
      { q: 'Do I get a certificate?', a: 'Master a course (by passing its assessment) and you can claim a verifiable Efiko certificate.' }
    ],
    schema: 'course', related: ['/ai', '/whiteboard', '/certificates']
  },
  {
    slug: '/whiteboard', product: 'Efiko Whiteboard', nav: 'Whiteboard',
    title: 'Efiko Whiteboard — Concepts Drawn Out, Step by Step',
    description: 'The Adaptive Learning Whiteboard Engine animates concepts as they are explained — scene by scene, with voice — and adapts to how you learn. Offline-first and low-data.',
    h1: 'Efiko Whiteboard — see ideas built, not just told',
    intro: 'The Efiko Whiteboard is an adaptive engine that draws concepts out the way a great teacher would — building each idea on a scene, narrating it, pausing to check understanding, and adapting to your pace.',
    sections: [
      { h2: 'Concepts that animate', p: 'Instead of a wall of text, watch a diagram assemble itself while a voice explains each step.' },
      { h2: 'Adaptive and interactive', p: 'The board pauses to ask questions, responds to your answers, and can switch modes — from guided to “teach it back”.' },
      { h2: 'Tiny and offline-first', p: 'Lessons are just data, not video, so they load fast on weak networks and replay perfectly offline.' }
    ],
    faqs: [
      { q: 'Is the whiteboard a video?', a: 'No — it is a lightweight, data-driven animation, so it is far smaller than video and works offline once opened.' },
      { q: 'What is Teach Back mode?', a: 'Teach Back asks you to explain the concept in your own words, then gives feedback — one of the most effective ways to learn.' }
    ],
    schema: 'course', related: ['/courses', '/ai', '/assessments']
  },
  {
    slug: '/assessments', product: 'Efiko Assessments', nav: 'Assessments',
    title: 'Efiko Assessments — Quizzes and Exam Readiness',
    description: 'Practice with adaptive quizzes, track your exam readiness, and see exactly where to focus next. Feedback is instant and works offline on downloaded courses.',
    h1: 'Efiko Assessments — practice that shows you what to study',
    intro: 'Efiko Assessments turn practice into direction. Every quiz is scored with instant feedback, and your results roll up into an exam-readiness view so you always know the next best thing to revise.',
    sections: [
      { h2: 'Instant, step-by-step feedback', p: 'See not just the right answer but the reasoning, so a wrong answer becomes a lesson.' },
      { h2: 'Exam readiness at a glance', p: 'Your scores across courses combine into a readiness signal that highlights weak spots before the exam does.' },
      { h2: 'Feeds your progress and certificates', p: 'Quiz results track your mastery and unlock verifiable certificates when you pass.' }
    ],
    faqs: [
      { q: 'Do quizzes work offline?', a: 'Yes — quizzes in downloaded courses are scored on your device, no connection required.' },
      { q: 'How is exam readiness calculated?', a: 'It combines your best quiz scores across a course’s topics to estimate how prepared you are.' }
    ],
    schema: 'webapp', related: ['/courses', '/certificates', '/ai']
  },
  {
    slug: '/certificates', product: 'Efiko Certificates', nav: 'Certificates',
    title: 'Efiko Certificates — Verifiable Proof of Mastery',
    description: 'Earn verifiable certificates when you master a course. Each has a unique serial and a public verification link that anyone — including employers — can check.',
    h1: 'Efiko Certificates — achievement you can prove',
    intro: 'When you master a course, Efiko issues a certificate you actually own. Each certificate carries a unique serial and a public verification page, so employers and institutions can confirm it in seconds.',
    sections: [
      { h2: 'Verifiable by anyone', p: 'Every certificate has a public link and serial number — no login needed to verify it.' },
      { h2: 'Earned, not bought', p: 'Certificates unlock only when you pass a course’s assessment, so they mean something.' },
      { h2: 'Build your portfolio', p: 'Your certificates form a portfolio you can share on the Career Hub and with employers.' }
    ],
    faqs: [
      { q: 'How does certificate verification work?', a: 'Each certificate has a public verification URL and serial. Anyone can open it to confirm the holder, course and date.' },
      { q: 'What do I need to earn one?', a: 'Pass the course assessment at or above the passing mark, then claim your certificate.' }
    ],
    schema: 'webpage', related: ['/courses', '/assessments', '/jobs']
  },
  {
    slug: '/marketplace', product: 'Efiko Marketplace', nav: 'Marketplace',
    title: 'Efiko Marketplace — Premium Courses and Study Packs',
    description: 'Buy premium courses and study packs from institutions and educators, in your own currency. Own it once, learn anytime — even offline.',
    h1: 'Efiko Marketplace — learn from the best, in your currency',
    intro: 'The Efiko Marketplace lets institutions and educators sell premium courses and study packs, and lets learners buy them in local currency. What you buy is yours to learn anytime, including offline.',
    sections: [
      { h2: 'Priced for Africa and beyond', p: 'Listings support many currencies — Naira, Cedi, Shilling, Rand, USD and more — so pricing feels local.' },
      { h2: 'Own it, offline', p: 'Purchased courses download for offline study, so your money buys lasting access, not just streaming.' },
      { h2: 'For educators', p: 'Institutions can list a course in minutes and reach learners across the network.' }
    ],
    faqs: [
      { q: 'Which currencies are supported?', a: 'Twelve to start, including NGN, GHS, KES, ZAR, UGX, TZS, RWF, XOF, EGP, USD, EUR and GBP.' },
      { q: 'Can I access purchases offline?', a: 'Yes — buy once and download the course to learn without a connection.' }
    ],
    schema: 'webpage', related: ['/courses', '/academy', '/certificates']
  },
  {
    slug: '/community', product: 'Efiko Community', nav: 'Community',
    title: 'Efiko Community — Study Groups That Keep You Going',
    description: 'Join or start a study group and hold focused discussions with peers. Low-data, offline-friendly, and organised around your courses.',
    h1: 'Efiko Community — learn together, stay motivated',
    intro: 'Learning sticks when you do it with others. Efiko Community lets you create or join study groups and hold focused, member-only discussions — light on data and easy to follow, even on a slow connection.',
    sections: [
      { h2: 'Study groups for every course', p: 'Start a group around a subject or class and invite your peers to think it through together.' },
      { h2: 'Focused discussions', p: 'Member-only feeds keep conversations on-topic and free of noise, with simple moderation.' },
      { h2: 'Low-data by design', p: 'No heavy video calls required — text-first discussions that work on any connection.' }
    ],
    faqs: [
      { q: 'Who can see a group’s discussion?', a: 'Only members. You join a group to read and post in its discussion feed.' },
      { q: 'Can I start my own group?', a: 'Yes — any signed-in learner can create a study group in seconds.' }
    ],
    schema: 'webpage', related: ['/courses', '/ai', '/academy']
  },
  {
    slug: '/jobs', product: 'Efiko Career Hub', nav: 'Career Hub',
    title: 'Efiko Career Hub — Jobs, Internships and Scholarships',
    description: 'Turn learning into opportunity. Discover jobs, internships and scholarships posted by institutions, and build a portfolio from your courses and certificates.',
    h1: 'Efiko Career Hub — where learning becomes opportunity',
    intro: 'The Career Hub connects what you learn to where you are going. Browse jobs, internships and scholarships posted by institutions and partners, save the ones that fit, and grow a portfolio from your certificates and mastered courses.',
    sections: [
      { h2: 'Opportunities that fit', p: 'Filter jobs, internships, scholarships and volunteer roles, and save the ones you want to pursue.' },
      { h2: 'A portfolio that proves it', p: 'Your certificates and completed courses become a portfolio you can show employers.' },
      { h2: 'Posted by institutions', p: 'Universities and partners post opportunities directly to reach motivated learners.' }
    ],
    faqs: [
      { q: 'Who posts the opportunities?', a: 'Institutions and partner organisations post jobs, internships and scholarships to the Career Hub.' },
      { q: 'How do I build my portfolio?', a: 'Earn certificates and master courses — they automatically form the portfolio shown on your Career Hub.' }
    ],
    schema: 'webpage', related: ['/certificates', '/courses', '/academy']
  },
  {
    slug: '/research', product: 'Efiko Research', nav: 'Research',
    title: 'Efiko Research — Guided Support for Projects and Papers',
    description: 'Get structured help with research: finding sources, framing questions, understanding methods and writing clearly — grounded in your field and level.',
    h1: 'Efiko Research — think through your project with a guide',
    intro: 'Efiko Research helps students and early researchers work through projects and papers — framing a question, understanding a method, making sense of a source, and writing it up clearly — with AI guidance grounded in your field.',
    sections: [
      { h2: 'From question to structure', p: 'Turn a vague idea into a focused research question and a clear outline you can build on.' },
      { h2: 'Understand the methods', p: 'Get plain-language explanations of methods and concepts so you can apply them with confidence.' },
      { h2: 'Write with clarity', p: 'Draft, tighten and explain your writing — the goal is your understanding, not shortcuts.' }
    ],
    faqs: [
      { q: 'Does Efiko write my paper for me?', a: 'No. Efiko Research helps you understand, structure and improve your own work — it is a guide, not a ghostwriter.' },
      { q: 'What levels does it support?', a: 'From undergraduate projects to early postgraduate research, tailored to your field.' }
    ],
    schema: 'webpage', related: ['/ai', '/academy', '/thinkspace']
  },
  {
    slug: '/academy', product: 'Efiko Academy', nav: 'Academy',
    title: 'Efiko Academy — Guides, Study Tips and Learning Skills',
    description: 'Free guides on how to learn: study techniques, exam preparation, note-taking, time management and subject explainers — practical advice for university students.',
    h1: 'Efiko Academy — learn how to learn',
    intro: 'Efiko Academy is a growing library of free, practical guides on how to study well: proven techniques, exam preparation, note-taking, managing your time, and clear explainers on tricky topics.',
    sections: [
      { h2: 'Study smarter', p: 'Evidence-based techniques — spaced practice, active recall, teaching back — explained simply and ready to use.' },
      { h2: 'Prepare for exams', p: 'Plan revision, manage pressure, and walk into the exam hall ready.' },
      { h2: 'Explainers on demand', p: 'Short, clear guides on the concepts students search for most.' }
    ],
    faqs: [
      { q: 'Is the Academy free?', a: 'Yes — the Academy’s guides are free to read.' },
      { q: 'How often is it updated?', a: 'New guides and explainers are added regularly, reviewed before they are published.' }
    ],
    schema: 'webpage', related: ['/ai', '/courses', '/research']
  }
];

export const bySlug = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
