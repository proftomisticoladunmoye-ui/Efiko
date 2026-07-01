# EFIKO 2.0 — Product Reorganization (design, for approval)

> **Mandate:** reorganize EFIKO into an elegant, minimal **AI Learning Operating System**
> — not add features. **No implementation code** until this is approved. Every claim about
> "today" is grounded in the actual repository; every "new" is flagged honestly.
>
> **North star (the journey):** Discover → Learn → Practice → Discuss → Reflect → Assess →
> Master → Certificate → Portfolio. Each screen answers one question: *"what is the user
> trying to do right now?"*

---

## 0. Executive summary

EFIKO already has an unusually strong **engine layer** for this vision: identity + roles,
a unified Course model (capsules + adaptive ALWE), enrolment, cohorts/classes, progress,
certificates + public verification, programmes, offline-first storage, and the ALWE
adaptive whiteboard (scenes, voice, tutor, teach-back). What it lacks is the **product
shell** the mockup shows: a coherent **left-sidebar IA**, the **ThinkSpace** workspace with
memory, **tabbed AI responses**, visible **AI Credits**, and role-aware navigation.

**So V2 is mostly a re-organization + one big new pillar (ThinkSpace), not a rewrite.** The
single most valuable, lowest-risk first move is the **navigation shell** — put everything
already built into the sidebar the mockup shows and retire today's scattered query-param
routes + 5-link footer. That alone delivers ~70% of the "world-class" feel. ThinkSpace,
Credits, Library/Export, Community, Marketplace follow as their own phases.

---

## 1. Deliverable 12 first — Feature relationships & First-Task audit (what's really here)

**What exists today (mapped to V2 nav):**
| Current thing (in code) | V2 home |
|---|---|
| Ask Efiko AI (`/lessons/generate`), Snap & Learn | **Learn** (AI Tutor, Snap & Learn) + result opens in **ThinkSpace** |
| Capsule player (`CapsuleView`: text/whiteboard/voice/quiz/flashcards/summary stacked) | **AI response tabs** (same blocks → tabs) |
| ALWE adaptive engine + `AlwenPlayer` + `AlweStudio` | **Whiteboard** (Adaptive Lessons, Replay, Generated) |
| Unified `Course` repo, Programmes, Enrolment, class codes | **Courses** |
| Cohorts/Classes console, rosters, class progress | **Teach console** (lecturer) — *not* the student sidebar |
| Progress reporting, Exam Readiness | **Assessments** + **Progress** widget on Home |
| Certificates + public `?verify` | **Certificates** (+ Passport later) |
| Packs, Campus Wi-Fi sync, IndexedDB offline | **Library** (offline downloads) |
| White-label branding, Institution Admin | **Institution settings** (admin workspace) |
| Rate limits (`gen`/`assist` buckets) | **AI Credits** (surface + meter the same limiter) |
| WhatsApp / SMS channels | background channels (unchanged) |

**First-Task findings (problems to fix in the reorg):**
1. **Three competing AI entry points** — "Ask Efiko AI" (home), a would-be "AI Tutor", and
   ThinkSpace. *Fix:* one input ("Ask Efiko AI", always reachable top-center), one home for
   results (**ThinkSpace**). "AI Tutor" = the same engine, framed as Learn.
2. **Navigation sprawl** — lecturer/institution tools live in **5 footer links + 5
   query-param routes** (`?alwe`, `?alwe-studio`, `?classes`, `?programmes`, `?verify`) with
   repeated logins. *Fix:* a real **left sidebar** + a **role-scoped Teach/Institution
   workspace** with a single login.
3. **Two content players** (capsule stacked view vs ALWE) feel like different apps. *Fix:*
   unify presentation via **tabbed AI responses**; ALWE is the "Whiteboard" tab/mode.
4. **Duplicated discovery** — legacy "My Courses" list vs the new unified **Courses** vs the
   ALWE list. *Fix:* Courses is the single catalog; "My Courses" becomes a filter (Enrolled).
5. **Terminology drift** — "capsule", "pack", "cohort", "tenant". *Fix (learner-facing):*
   Lesson, Course, Class, Institution. Keep internal names in code.
6. **No persistent memory** — every AI ask is one-shot; nothing is saved or continued. *Fix:*
   ThinkSpace discussions with memory (the biggest genuinely new build).

---

## 2. Deliverable 1 — Information Architecture

Two IAs, by role (the mockup is the **learner** IA):

### Learner IA (left sidebar — canonical, from the brief)
```
Home · Learn · ThinkSpace · Courses · Whiteboard · Assessments ·
Certificates · Library · Study Planner · Career · Community · Marketplace · Settings
```
Everything else folds under these (avoids the "long menu" the brief warns against):
- **Learn** → AI Tutor · Snap & Learn · Quick Explain · Daily Challenge · Learning Capsules · Revision
- **Courses** → My (Enrolled) · University · Public · Certificate · Marketplace · Saved · Recommended
- **Whiteboard** → My · Adaptive Lessons · Replays · Generated · Lecturer · Interactive
- **Assessments** → Quizzes · Mock Exams · Assignments · Practice · Adaptive Tests · Results · Analytics
- **Certificates** → Certificates · Badges · Competencies · Learning Passport · Credentials
- **Library** → Notes · Documents · PDFs/Word · Whiteboards · Voice · SVG · Flashcards · Summaries · Saved discussions · Bookmarks
- **Community** → Study Groups · Peer Learning · Mentors · Rooms · University Communities
- **Marketplace** → Courses · Lesson Packs · Templates · Question Banks · Flashcards · Resources

> The mockup's extra sidebar items (AI Tutor, Quizzes, Notes, Progress) fold into
> Learn / Assessments / Library / Home respectively — recommended, to keep the rail short.

### Teacher/Institution IA (separate workspace, one login)
```
Dashboard · Author (Lecturer Studio · Whiteboard Studio) · Classes (cohorts + rosters) ·
Programmes · Course library · Reports/Analytics · Branding · Members · Billing/Credits
```
This is where today's footer routes (Studios, Classes, Programmes, Institution Admin) go —
consolidated, gated by one institution login.

---

## 3. Deliverable 2 — Navigation Map

```
                         ┌───────────── TOP BAR (all screens) ─────────────┐
                         │ Logo │   ▸ Ask Efiko AI (input)   │ Credits · 🔔 · Avatar│
                         └───────┬─────────────────────────────────┬────────┘
   LEFT SIDEBAR (learner)        │        MAIN CONTENT            │   THINKSPACE (right)
   Home                          │  (route-specific)             │   collapsible panel
   Learn ─────────────┐          │                               │   discussions + memory
   ThinkSpace         │          │   e.g. Home dashboard,        │   + AI tools + insights
   Courses            │          │   Course, Whiteboard player,  │
   Whiteboard         │          │   Assessment, Library…        │
   Assessments        │          │                               │
   Certificates       │          └───────────────────────────────┘
   Library · Planner · Career · Community · Marketplace · Settings
```
- **Top bar** is constant: brand, the **Ask Efiko AI** input (Fitts-friendly, center), the
  **Credits meter**, notifications, account menu (role-aware).
- **ThinkSpace** is a docked right panel on desktop (persistent), collapsible on tablet,
  slide-over on mobile. It never covers learning content.
- Role switch (Learner ⇄ Teacher) lives in the account menu; teachers get the Teach IA.

---

## 4. Deliverable 3 — Screen hierarchy

```
App
├─ Home (Continue Learning · Resume Discussion · Ask AI · Today's Progress ·
│        Upcoming Classes · Recent Courses · Quick Actions)   ← nothing else
├─ Learn → AI Tutor / Snap / Quick Explain / Daily Challenge / Capsules / Revision
├─ ThinkSpace → Discussion list → Discussion (chat + generated resources + memory)
├─ Courses → Catalog (filters) → Course → Lesson (Learning Workspace)
├─ Whiteboard → Adaptive Lessons → Player (scenes/voice/tutor/teach-back)
├─ Assessments → Quiz/Mock/Practice → Attempt → Results/Analytics
├─ Certificates → list → Certificate (printable) → public Verify
├─ Library → resource browser (filter by type)
├─ Study Planner · Career · Community · Marketplace · Settings
└─ Teacher workspace → Dashboard/Author/Classes/Programmes/Reports/Branding
```

**Learning Workspace (open a lesson):** desktop splits — **left** lesson/whiteboard/voice/
quiz, **right** ThinkSpace (notes, bookmarks, AI chat about *this* lesson). Mobile: lesson
full-width, ThinkSpace slides in.

**AI response = tabs, not one long page:** `Text · Whiteboard · Voice · SVG · Quiz ·
Flashcards · Summary · Related · References · Discussion · Export`. (Today `CapsuleView`
already produces all these blocks — V2 renders them as instant tabs, exactly the mockup.)

---

## 5. Deliverable 4 — User journeys (condensed)

- **Visitor:** land → try Ask Efiko AI (limited credits) → see value → sign up.
- **Student:** Home "Continue learning"/"Resume discussion" → Learn or Course → Lesson
  (Workspace + ThinkSpace) → Practice (Assessments) → Discuss (ThinkSpace/Community) →
  Assess → Certificate → Library/Passport.
- **Lecturer:** switch to Teacher → Author (Studio) → publish → create Class → share code →
  Reports. (One login, one workspace.)
- **Institution admin:** Teacher workspace → Members · Branding · Programmes · Credits.

---

## 6. Deliverable 9 — ThinkSpace architecture (the flagship new pillar)

ThinkSpace is an **Academic Intelligence Workspace**, not a chatbot. It is a right-docked
panel holding **Discussions**, each with independent **memory**.

**Model (new):**
```
Discussion { id, userId, title, kind: research|assignment|revision|career|project|notes,
             context: { courseId?, programmeId?, institutionId?, objectives[] },
             createdAt, updatedAt }
Message    { id, discussionId, role: user|ai, text, attachments[], createdAt }
Resource   { id, discussionId, type: whiteboard|svg|voice|quiz|flashcards|summary|doc,
             ref, createdAt }          // everything the AI generated, kept with the thread
Memory     { discussionId, summary, keyConcepts[], lastSceneId?, quizPerf, bookmarks[] }
```
**Behaviour:** each ask appends to the discussion; the AI is given a **rolling memory**
(summary + key concepts + course/programme context + prior resources) so it can *continue*:
*"Yesterday we discussed IRT — continue from Scene 6?"* Generated whiteboards/SVG/voice/
quizzes/flashcards/summaries are **saved into the discussion** (Recent Resources / Saved
Items in the mockup). Works online; the **downloaded** artifacts remain available offline.

**Reuse:** the ALWE generator, `/alwe/coach`, `/alwe/tts`, and `/lessons/generate` become
the tools ThinkSpace calls — no new AI plumbing, just persistence + memory + orchestration.

---

## 7. Deliverable 10 — AI Memory architecture

- **Per-discussion memory** (above) — rolling summary + key concepts + generated-resource
  index, refreshed after each turn (cheap: summarize on write, not on read).
- **Cross-discussion / learner memory** — a lightweight profile: current course/programme/
  institution, `quizByConcept` mastery (already captured in `alwe_analytics` + server
  `progress`), saved notes, bookmarks. Feeds "continue where you left off" and recommended.
- **Grounding, not fine-tuning** — memory is retrieved and injected as context; transparent
  and offline-friendly. No model training. (Fits the psychometrics/explainability stance.)

---

## 8. Deliverable 11 — Database changes

Additive collections (kv/Neon), no migration of existing data:
```
discussions, messages, resources, memory   (ThinkSpace)
library_items                              (unified resource store; may derive from resources)
credits { userId|orgId, balance, tier, refreshedAt, dailyGrant }   (AI Credits)
badges, competencies                       (Certificates → Passport)
community_groups, memberships              (Community, later)
marketplace_listings, orders               (Marketplace, later)
notifications                              (top-bar bell)
```
Existing (`users, institutions, courses(derived), enrolments, cohorts, progress,
certificates, programmes, published, alwe_lessons`) are unchanged.

---

## 9. Deliverable — AI Credits

Replace the invisible rate limiter with a **visible credit meter** (top bar, "1200 AI
Credits" in the mockup). Same enforcement point (`rateLimited`), new framing:
- **Tiers:** Free (small daily grant) · Premium student (higher) · Lecturer (higher) ·
  Institution (shared pool). Auto-refresh daily; **never fully block learning** — when
  credits are out, downloaded lessons, whiteboards, courses, flashcards, notes and offline
  mode still work (only *new* AI generation pauses).
- Each AI action costs credits (generation > assist); balance shown, low-credit nudge to
  upgrade. This becomes the monetisation surface (ties to Marketplace/Institution billing).

---

## 10. Deliverables 5–7 — Wireframes (structured)

**Desktop (mockup):** 3 columns — sidebar (icons+labels) │ main (tabbed AI response / route)
│ ThinkSpace. Top bar spans all. This is the target; the mockup matches.

**Tablet:** sidebar collapses to icons; ThinkSpace becomes a toggle drawer; main content
gets priority.

**Mobile:** **bottom nav** (Home · Learn · Courses · Library · Profile) + a top **Ask**
button; sidebar sections open as a drawer; **ThinkSpace slides from the right**; Learning
Workspace stacks (lesson first, ThinkSpace slide-over). Never cover content.

---

## 11. Deliverable 8 — Component library (reuse-first)
`AppShell(TopBar, Sidebar, ThinkSpacePanel)` · `AskBar` · `CreditMeter` · `ResponseTabs` ·
`LessonWorkspace(split)` · `DiscussionList` · `DiscussionThread` · `ResourceCard` ·
`InsightRing` (78% understanding) · `AiToolButton` · `ExportMenu` · `CourseCard` ·
`WhiteboardPlayer`(existing ALWE) · `AssessmentView` · `CertificateCard`(existing) ·
`RoleSwitcher`. Most map to components that already exist; the shell + ThinkSpace are new.

---

## 12. Deliverable 13 — UX justification (against the standards)
- **Cognitive Load / UDL:** tabbed responses + one-question-per-screen cut extraneous load;
  ThinkSpace externalises memory. **Fitts:** persistent top-center Ask + fixed sidebar =
  large, stable targets. **Nielsen:** visibility of status (Credits, Progress ring),
  recognition over recall (sidebar vs remembering `?routes`), consistency (one player).
  **WCAG:** we already have focus-visible, reduced-motion, keyboard activation, ARIA in the
  player — extend app-wide. **Material/HIG:** predictable nav regions, clear hierarchy.
- **Educational psychology:** the journey encodes spacing (revision), retrieval
  (assessments), elaboration (ThinkSpace discuss), feedback (tutor), and mastery→credential.

---

## 13. Deliverables 14–15 — Performance & scalability
- Keep the **lazy-loading** already in place (engine/studios are split chunks); ThinkSpace
  and each heavy section load on demand. AppShell + Home stay lean.
- ThinkSpace memory summarised **on write** to keep prompts small (cost + latency).
- Credits/sessions need a **shared store** (Redis/Postgres) before multi-instance scale
  (today's counters are per-process). Move AI generation + voice to **async jobs** at scale.
- Data model stays additive and tenant-scoped; CDN for static + voice; regional deploy later.

---

## 14. Deliverable 16 — Final recommendation & phased build

**Verdict:** the V2 vision is achievable **without a rewrite** — the engine is already here;
V2 is a **shell + IA reorganization plus ThinkSpace**. Do it in phases; approve them one at
a time (same careful, verified, revertible cadence as everything so far):

| Phase | Scope | Why |
|---|---|---|
| **R1 — App Shell & IA** *(recommended first)* | Left sidebar + top bar + role-aware nav; move existing features into the new sections; retire footer/`?route` sprawl into a Teacher workspace; **tabbed AI responses**; Home dashboard (Continue/Resume/Progress). | ~70% of the "world-class" feel using what's built. Low risk, high impact. No new backend. |
| **R2 — ThinkSpace MVP** | Discussions + memory + saving generated resources; right-dock panel; "continue where we left off". | The flagship new pillar; makes EFIKO an AI Learning OS. |
| **R3 — AI Credits** | Visible meter + tiers over the existing limiter; never block offline/downloaded. | Monetisation surface; clarity. |
| **R4 — Library & Export** | Unified resource store + Word/PDF/Markdown export. | Ties learning artifacts together. |
| **R5 — Community · Marketplace · Career · Study Planner** | The remaining pillars, each its own project. | Ecosystem breadth (later). |

**Recommended immediate step: approve R1 (App Shell & IA).** It reorganizes everything you
already have into the mockup's structure, fixes the navigation sprawl, and gives one
coherent product — before we build the new pillars on top.

**Nothing built is lost** — §1's table shows every current feature's new home. This is
reorganization, exactly as briefed.
