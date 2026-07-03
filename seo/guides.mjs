// Efiko — Academy content: hand-authored study guides and definitions (the "learn how to
// learn" + glossary traffic). Each becomes an indexable page at /academy/<slug>. Guides with
// `steps` render as HowTo; definitions render as DefinedTerm. Keep copy accurate and useful;
// this is reviewed content, not raw AI output.
export const ACADEMY = [
  {
    slug: 'how-to-study-effectively', kind: 'guide', updated: '2026-07-03',
    title: 'How to Study Effectively at University — A Practical Guide',
    description: 'Five evidence-based study techniques that actually work: active recall, spaced practice, teaching back, interleaving and focused sessions. A practical guide for university students.',
    h1: 'How to study effectively at university',
    intro: 'Most students study by re-reading notes and highlighting — which feels productive but barely moves understanding. Decades of research point to a handful of techniques that do work. Here is how to use them.',
    steps: [
      { name: 'Test yourself instead of re-reading', text: 'Close your notes and try to recall the key ideas from memory. This “active recall” is far more effective than re-reading, because retrieving information strengthens it.' },
      { name: 'Space your revision', text: 'Review a topic today, again in a few days, then a week later. Spaced practice beats cramming because each review at the edge of forgetting deepens memory.' },
      { name: 'Teach it back', text: 'Explain the concept out loud in your own words, as if teaching a friend. Gaps in your explanation reveal exactly what you do not yet understand.' },
      { name: 'Interleave topics', text: 'Mix related problems and topics in one session instead of doing one type at a time. It feels harder, but it builds the ability to choose the right method under exam conditions.' },
      { name: 'Work in focused blocks', text: 'Study in distraction-free blocks of 25–50 minutes with short breaks. Put the phone in another room — attention, not hours, is the scarce resource.' }
    ],
    body: [
      'The theme across all of these is the same: learning that feels effortful is usually learning that lasts. Re-reading is comfortable but shallow; retrieval, spacing and teaching back are harder in the moment and far stronger over time.',
      'You do not need all five at once. Start with active recall and spaced practice — together they account for most of the benefit — and add the others as they become habit.'
    ],
    faqs: [
      { q: 'What is the single most effective study technique?', a: 'Active recall — testing yourself from memory rather than re-reading. It consistently outperforms re-reading and highlighting in studies of learning.' },
      { q: 'How long should a study session be?', a: 'Focused blocks of about 25–50 minutes with short breaks work well for most people. Quality of attention matters more than total hours.' },
      { q: 'Is cramming ever a good idea?', a: 'Cramming can get you through a test tomorrow, but the material fades fast. Spacing the same amount of study over several days remembers far more for the exam and beyond.' }
    ],
    related: ['active-recall', 'spaced-repetition', 'how-to-prepare-for-exams']
  },
  {
    slug: 'how-to-prepare-for-exams', kind: 'guide', updated: '2026-07-03',
    title: 'How to Prepare for Exams — A Step-by-Step Plan',
    description: 'A calm, step-by-step exam preparation plan: map the syllabus, build a spaced revision schedule, practise past questions under timed conditions, and manage exam-day nerves.',
    h1: 'How to prepare for exams',
    intro: 'Good exam results come from a plan you start early and follow steadily — not a panicked all-nighter. Here is a plan you can adapt to any course.',
    steps: [
      { name: 'Map the syllabus', text: 'List every topic that could be examined and mark how confident you feel about each. This turns a vague mountain into a clear checklist.' },
      { name: 'Build a spaced schedule', text: 'Spread revision over the weeks you have, revisiting weaker topics more often. Short, repeated sessions beat long, rare ones.' },
      { name: 'Practise past questions', text: 'Answer real past questions under timed conditions. Exams test how you apply knowledge, so practise applying it — not just reading it.' },
      { name: 'Review your mistakes', text: 'Every wrong answer is a free lesson. Keep a short list of the mistakes you keep making and target them directly.' },
      { name: 'Prepare for the day', text: 'Sleep well the night before, arrive early, read each question carefully, and budget your time by the marks on offer.' }
    ],
    body: [
      'Notice how little of this is about “knowing more” and how much is about practising the exam itself. The students who do best are usually the ones who have already answered questions like these, calmly, many times before the real thing.'
    ],
    faqs: [
      { q: 'How far in advance should I start revising?', a: 'Start as early as you can — a few weeks of spaced revision beats a few days of cramming. Even two or three short sessions per topic, spread out, make a large difference.' },
      { q: 'Are past questions really that useful?', a: 'Yes. Practising past questions under timed conditions is one of the highest-value things you can do, because it trains the exact skill the exam measures.' },
      { q: 'How do I handle exam nerves?', a: 'Preparation is the best cure — familiarity lowers fear. On the day, breathe slowly, read carefully, and start with a question you can answer to build momentum.' }
    ],
    related: ['how-to-study-effectively', 'spaced-repetition', 'active-recall']
  },
  {
    slug: 'how-to-take-better-notes', kind: 'guide', updated: '2026-07-03',
    title: 'How to Take Better Notes — Methods That Aid Memory',
    description: 'Take notes that help you learn, not just transcribe: summarise in your own words, use the Cornell method, connect ideas, and review actively. A practical guide for students.',
    h1: 'How to take better notes',
    intro: 'Notes are not a recording of the lecture — they are a tool for thinking. The best notes are shorter than you expect, written in your own words, and designed to be tested against later.',
    steps: [
      { name: 'Summarise, do not transcribe', text: 'Write ideas in your own words instead of copying verbatim. Rephrasing forces you to understand as you go.' },
      { name: 'Use the Cornell layout', text: 'Split the page: notes on the right, cue questions on the left, a summary at the bottom. The cues turn your notes into a self-test.' },
      { name: 'Connect ideas', text: 'Draw links between new material and what you already know. Learning is mostly about connections, not isolated facts.' },
      { name: 'Review and question', text: 'Within a day, revisit your notes and cover the answers — try to recall them from the cues. This is where notes become memory.' }
    ],
    body: [
      'A good test of your notes is simple: a week later, can you reconstruct the lecture from them? If yes, they are working. If they are a wall of transcription you never revisit, a shorter, question-driven page will serve you far better.'
    ],
    faqs: [
      { q: 'Should I type or handwrite notes?', a: 'Either can work, but writing by hand tends to encourage summarising rather than transcribing, which aids memory. The key is putting ideas in your own words.' },
      { q: 'What is the Cornell note-taking method?', a: 'A page layout with a wide notes column, a narrow cue column for questions, and a summary at the bottom — designed so your notes double as a self-test.' }
    ],
    related: ['how-to-study-effectively', 'active-recall']
  },
  {
    slug: 'active-recall', kind: 'definition', term: 'Active recall', updated: '2026-07-03',
    title: 'What Is Active Recall? Definition and How to Use It',
    description: 'Active recall is the practice of retrieving information from memory — testing yourself — rather than re-reading. It is one of the most effective, evidence-based study techniques.',
    h1: 'What is active recall?',
    short: 'Active recall is a study technique where you retrieve information from memory — by testing yourself — instead of passively re-reading it. The effort of recall strengthens the memory, making it one of the most effective ways to learn.',
    body: [
      'When you close your notes and try to answer a question from memory, you are using active recall. Each successful retrieval makes the information easier to recall next time — a phenomenon known as the “testing effect”.',
      'In practice, active recall looks like flashcards, self-quizzing, answering past questions, or simply explaining a topic from a blank page. It feels harder than re-reading, and that difficulty is precisely why it works.'
    ],
    faqs: [
      { q: 'Why is active recall effective?', a: 'Retrieving information strengthens the memory more than reviewing it does. This “testing effect” means self-quizzing builds far more durable knowledge than re-reading.' }
    ],
    related: ['spaced-repetition', 'how-to-study-effectively']
  },
  {
    slug: 'spaced-repetition', kind: 'definition', term: 'Spaced repetition', updated: '2026-07-03',
    title: 'What Is Spaced Repetition? Definition and How to Use It',
    description: 'Spaced repetition is reviewing material at increasing intervals over time. By revisiting just before you would forget, it builds long-term memory far more efficiently than cramming.',
    h1: 'What is spaced repetition?',
    short: 'Spaced repetition is a learning technique in which you review material at gradually increasing intervals — for example after a day, then a few days, then a week — timing each review to just before you would forget. It builds long-term memory far more efficiently than cramming.',
    body: [
      'Memory fades along a predictable “forgetting curve”. Each time you review at the point of near-forgetting, the curve flattens and the memory lasts longer, so the next review can be further away.',
      'Spaced-repetition apps automate the timing, but you do not need software: reviewing a topic today, in three days, and again next week captures most of the benefit.'
    ],
    faqs: [
      { q: 'How is spaced repetition different from cramming?', a: 'Cramming packs study into one session and is forgotten quickly. Spaced repetition spreads the same study over increasing intervals, which remembers far more for far longer.' }
    ],
    related: ['active-recall', 'how-to-prepare-for-exams']
  },
  {
    slug: 'what-is-gpa', kind: 'definition', term: 'GPA (Grade Point Average)', updated: '2026-07-03',
    title: 'What Is a GPA? Grade Point Average Explained',
    description: 'A GPA (Grade Point Average) is a single number summarising your academic performance, calculated as the credit-weighted average of your course grade points.',
    h1: 'What is a GPA?',
    short: 'A GPA (Grade Point Average) is a single number that summarises your academic performance. It is the average of the grade points you earned in each course, weighted by each course’s credit units.',
    body: [
      'Each grade (A, B, C, and so on) maps to a number of grade points on your institution’s scale. To compute a GPA, multiply each course’s grade points by its credit units, add these up, and divide by the total credit units.',
      'A cumulative GPA (CGPA) applies the same calculation across every course you have taken, giving an overall measure of performance across your programme.'
    ],
    faqs: [
      { q: 'How is GPA calculated?', a: 'Multiply each course’s grade points by its credit units, sum the results, and divide by the total number of credit units taken.' },
      { q: 'What is the difference between GPA and CGPA?', a: 'A GPA usually covers one semester or term, while a CGPA (cumulative GPA) covers all courses taken across your programme so far.' }
    ],
    related: ['how-to-study-effectively', 'how-to-prepare-for-exams']
  }
];
