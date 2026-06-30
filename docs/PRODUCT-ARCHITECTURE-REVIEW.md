# EFIKO — Product Architecture & UX Review (v1)
## A review-board assessment before further feature development

> **Mandate:** stop feature work; assess whether the architecture is logical, scalable,
> intuitive, and internationally credible before building more. **No code is written in
> this phase.** This document is the deliverable to review and approve.
>
> **Method:** every claim about "current state" is grounded in the actual repository, not
> assumptions. Where the brief describes capabilities EFIKO does not yet have, that is
> called out as a gap, not glossed over.

---

## 0. Executive summary (read this first)

**What EFIKO is today (V1 as built):** a lightweight, **offline-first micro-learning PWA**
with a channel-agnostic core ("one brain, many mouths") feeding the PWA (primary),
WhatsApp, SMS, and Campus Wi-Fi sync. It has an AI lesson generator, the new **ALWE
adaptive whiteboard engine** (scenes, voice, adaptive replay, cognitive tutor, teach-back),
an **Exam/Readiness** mode, and **white-label multi-tenancy** (an institution's logo,
colour, and course filter, selected by `?org=`).

**The one structural fact that shapes everything below:** EFIKO currently has **no student
identity and no first-class Course/Programme/Enrolment entities.**
- Students are **anonymous** — all progress lives in the browser's IndexedDB; there are no
  student accounts, no login, no cross-device identity.
- The only server-side identity is the **institution admin** (one role, bearer-token login)
  plus an **operator** gate (`ADMIN_MASTER_KEY`) for creating institutions.
- A "course" is a **string field** (`meta.course`) on a flat catalog of lesson capsules,
  grouped into "packs" by course code. There is no `Course`, `Programme`, `Faculty`,
  `Department`, `Cohort`, `Enrolment`, or `Certificate` entity anywhere in the code.

**The brief** (programmes, enrolment graph, 8 stakeholder roles, marketplace, certificates,
revenue sharing, partner orgs, super/university admins) describes a **full multi-tenant LMS +
course marketplace** — a V2/V3 destination, not the current product.

**Verdict (full detail in §12):** For *what it is*, EFIKO already meets or beats international
norms on its differentiators — offline-first, low-bandwidth, sub-2MB adaptive lessons,
pedagogy. For *what the brief envisions*, it is **not yet structured** to get there, but it
**does not need a rewrite.** The core architecture is sound and extensible. It needs a
**staged restructure**: introduce an **Identity + Course + Enrolment foundation first**, then
layer roles, navigation, studios, and marketplace on top. Building marketplace/certificate
features before that foundation is the main risk to avoid.

---

## Phase 1 — Product Architecture Review

### 1.1 Current functional areas (as built)
| Area | Status | Notes |
|---|---|---|
| Offline-first PWA shell | ✅ | Vite + React, Workbox SW, IndexedDB |
| Channel adapters | ✅ | PWA, WhatsApp, SMS, Campus Wi-Fi sync |
| AI lesson generation (capsules) | ✅ | `/lessons/generate`, Snap & Learn |
| ALWE adaptive whiteboard engine | ✅ | scenes, voice, replay, tutor, teach-back |
| Exam / Readiness mode | ✅ | mastery per capsule |
| White-label tenancy | ✅ | `?org=` + branding + courseFilter |
| Institution admin + branding | ✅ | one role, bearer token |
| Lecturer Studio (capsules) + Whiteboard Studio (ALWE) | ✅ | publish now gated by institution login |
| Published-lesson stores (Neon/kv) | ✅ | `published`, `alwe_lessons`, `institutions` |

### 1.2 Missing / misplaced / duplicated
- **Missing — identity:** no student/lecturer/visitor accounts; no role tiers beyond
  institution-admin + operator. This is the biggest gap.
- **Missing — domain entities:** Programme, Course (as an entity), Module, Faculty/Dept,
  Cohort/Class, Enrolment, Certificate, Order/Payment, Organisation (partner).
- **Missing — enrolment & access control:** content is global-catalog + per-tenant filter;
  there is no "who can see/do what" model beyond the tenant courseFilter and the paid
  `active` flag.
- **Duplicated/parallel — two content models:** legacy **capsules** (`blocks[]`) and new
  **ALWE packages** (`scenes[]`) are separate catalogs, separate stores, separate players.
  Acceptable today, but they should converge under one **Course Repository** abstraction so
  the rest of the system (search, enrolment, certificates) treats them uniformly.
- **Misplaced — "course" as metadata:** `meta.course` being a free-text string means there
  is no canonical course a learner can enrol in, version, or be certified against.

### 1.3 Recommended system map (target)

```
┌───────────────────────────── CLIENTS ─────────────────────────────┐
│ PWA (students, lecturers, admins) · WhatsApp · SMS · Campus sync   │
└───────────────┬───────────────────────────────────────────────────┘
                │  one API surface (the gateway)
┌───────────────▼───────────────────────────────────────────────────┐
│ GATEWAY (Node) — thin channel-agnostic API                         │
│  Identity & Access  │  Catalog & Enrolment  │  Authoring  │  AI    │
│  (accounts, roles,  │  (programmes, courses,│  (Studios,  │ (gen,  │
│   sessions, RBAC)   │   visibility, enrol)  │   publish)  │ tutor) │
└───────────────┬───────────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────────────────┐
│ CORE DOMAIN ("one brain")                                          │
│  Identity · Org/Tenant · Programme→Course→Module→Lesson            │
│  Enrolment graph · Assessment/Mastery · Certificate · Commerce     │
└───────────────┬───────────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────────────────┐
│ PERSISTENCE                                                        │
│  Neon Postgres (durable: accounts, courses, enrolment, orders)     │
│  IndexedDB (offline: pinned lessons, progress, analytics)          │
│  Object/blob (voice clips, media)                                  │
└────────────────────────────────────────────────────────────────────┘
```

The current code already has the **client → gateway → core → persistence** spine. The work
is to add the **Identity & Access** and **Catalog & Enrolment** capabilities as first-class
core services, and converge capsules + ALWE under one Course Repository.

---

## Phase 2 — User Journey Review (role matrix in Deliverable §2)

EFIKO today effectively has **2.5 roles**: anonymous student, institution admin, operator.
The brief needs **8**. Target journeys:

| Role | Entry | Core flow | Key permissions | Exit |
|---|---|---|---|---|
| **Visitor** | Public link / `?org=` | Browse public/preview courses, try a sample lesson, sign up | Read public catalog only | Sign up / leave |
| **Student** | Login / invite code | Home → enrolled courses → lesson player → assessments → certificate | Enrol (allowed courses), learn, self-progress | Logout (progress persists) |
| **Lecturer** | Institution login | Studio → author/generate → preview → publish → invite students → view cohort progress | Create/publish within their org; manage their classes | Logout |
| **Institution Admin** | Institution login | Branding, members (lecturers/students), programmes/courses, activate features | Manage their org only | Logout |
| **University Admin** | Institution login (scoped) | Faculties/departments, programmes, cross-department reporting | Manage a university tree (super-set of Institution Admin within one tenant) | Logout |
| **Super Admin (operator)** | Privileged console | Create tenants, global settings, abuse/quotas, marketplace moderation | Platform-wide | Logout |
| **Course Creator** | Login (independent) | Author courses, list on marketplace, set price, view sales | Own content + commerce; no org admin | Logout |
| **Partner Organisation** | Org login | Enrol staff (corporate learning), assign courses, track completion/certs | Manage their learner group + bulk enrol | Logout |

Today only the Institution-Admin and (anonymous) Student journeys exist; the rest are
**net-new** and depend on the identity foundation.

---

## Phase 3 — Learning Ecosystem Review

### 3.1 Programmes
Recommend a **Programme** entity that **owns an ordered set of Courses** and **belongs to an
owner** (University → Faculty → Department, **or** an independent Provider). Discovery via a
catalog with facets (owner, level, subject, free/premium). Enrolment at the programme level
auto-enrols/*unlocks* its courses. Institutions publish programmes from the admin portal.
**Not built today** — there is no Programme entity.

### 3.2 Courses — one repository, many lenses
**Recommendation: a single normalised Course Repository, not many libraries.** Everything —
Lecturer-Studio capsules, Whiteboard-Studio ALWE lessons, AI capsules, institution-owned,
public, premium, certificate, micro-lessons — is a **Course** (or a **Lesson** inside a
course) with **attributes**, not a separate store:

```
Course {
  id, type: capsule | alwe | external,
  ownerType: university | provider | efiko,  ownerId,
  visibility, accessModel, price, certificateEligible,
  subject, level, version, status: draft|review|published|archived,
  lessons: [ lessonRef ... ]   // capsule blocks OR alwe package
}
```
"One central repository with facets" beats "many libraries" for search, reuse, enrolment,
certificates, and analytics. The two current content formats (capsules, ALWE) become a
`type` discriminator under one Course. **Today these are two parallel catalogs — converging
them is the highest-leverage structural change.**

### 3.3 Course visibility & access control
Recommend an **explicit access model** on every course (replacing today's tenant
courseFilter-only approach):

| accessModel | Who can see/enrol |
|---|---|
| `public` | Anyone, incl. visitors |
| `registered` | Any signed-in EFIKO user |
| `org` | Members of owner org (university/institute) |
| `cohort` | Specific class/cohort only |
| `premium` | Paid subscribers |
| `corporate` | Members of a partner org |
| `marketplace` | Discoverable; enrol = purchase/enrolment |

Implement as **RBAC + relationship checks** (role × ownership × enrolment edge), evaluated
server-side on every read/enrol. Today access is effectively "global catalog, filtered by
tenant" with paid `active` gating branding only — **not sufficient** for the above.

### 3.4 Short certificate courses — lifecycle (target)
`Create → Submit for approval → Approve (org/EFIKO) → Publish → Discover → Enrol (free/paid)
→ Learn → Assess (pass threshold) → Generate certificate (signed, verifiable ID) → Verify
(public URL/QR) → Marketplace listing → Revenue share (creator/EFIKO/partner)`. **None of
this exists yet**; it depends on Course, Enrolment, Assessment, Certificate, and Commerce
entities.

### 3.5 Lecturer → student invitations
Recommend **two primary, scalable mechanisms** plus fallbacks:
1. **Class code / join link (+QR)** — primary: zero-friction, works offline-to-online, great
   for African mobile context (share a code in WhatsApp/in class). 
2. **Bulk upload (CSV) + email/SMS invite** — for institutions onboarding cohorts.
Email/student-number/institution-enrolment are variants layered on top. **Not built today.**

### 3.6 Student enrolment & entity relationships (target)
```
University ─< Faculty ─< Department ─< Programme ─< Course ─< Lesson
       │                                   │           │
       └─< Cohort/Class >── Enrolment ──────┘           │
Student ──< Enrolment >── (Programme | Course | Cohort) ─┘
Student ──< Membership >── (University | Institute | Partner Org)
StudyGroup ──< Student (peer, optional)
```
`Membership` = belonging to an org; `Enrolment` = access to a learning unit; `Cohort` = a
time-boxed class a lecturer teaches. These are the **new core tables**.

---

## Phase 4 — Navigation Architecture

**Recommendation: hybrid, role-aware, mobile-first.**
- **Mobile (primary):** **bottom navigation** (3–5 items) — Home · Learn (my courses) ·
  Explore (catalog) · Progress · Profile. Thumb-reachable; matches Duolingo/Khan mobile.
- **Desktop/tablet:** **collapsible left sidebar** with the same destinations grouped, plus
  contextual sub-nav inside Studios/Admin.
- **Studios & Admin** get their own **context navigation** (a focused workspace), reachable
  from Profile/role menu — not mixed into the student bottom bar.

Why hybrid: students need a dead-simple, low-cognitive-load bottom bar on phones; lecturers/
admins need a richer sidebar for management. One nav model can't serve both well.

Today: a single-page `view` switch (library/capsule/studio/admin) + `?alwe` routes + footer
links. Functional for V1, **not scalable** to the role/feature set above.

### 4.1 Home screen (after login) — by role, clutter-free
- **Student:** "Continue learning" (resume), today's goal/streak, enrolled courses, exam
  readiness, a single "Explore" entry. (≤4 blocks.)
- **Lecturer:** my courses/drafts, cohort activity (who's stuck), "Create lesson", invites.
- **Institution Admin:** members, programmes/courses, branding, activation status.
- **Visitor:** value proposition, featured/public courses, "try a lesson", sign-up.

### 4.2 Sidebar hierarchy (desktop, role-filtered)
```
LEARN        Home · My Courses · Explore · Exam Readiness · Certificates
CREATE       Lecturer Studio · Whiteboard Studio · Assessment Studio   (lecturer+)
MANAGE       Members · Programmes · Cohorts · Branding · Reports        (admin+)
PLATFORM     Tenants · Moderation · Quotas · Settings                  (super admin)
ACCOUNT      Profile · Offline downloads · Help · Sign out
```
Each section renders only if the role permits — short menus per role, not one long list.

---

## Phase 5 — UX/UI Evaluation

| Criterion | Current | Assessment |
|---|---|---|
| Industry standard | Clean dark theme, consistent components | Good baseline; needs a design system + light mode option |
| Creative standard | Distinct brand (owl), ALWE is genuinely novel | **Above average** — ALWE differentiates strongly |
| Educationally effective | Pause points, teach-back, adaptive replay, cognitive tutor | **Strong** — evidence-based, beats most incumbents on pedagogy |
| Mobile-first | Responsive; bottom-nav not yet adopted | Partial — needs the nav model in Phase 4 |
| Accessible | Focus-visible, keyboard, reduced-motion, ARIA (ALWE) | Good in ALWE; audit the rest of the app |
| Scalable (UI) | Single-view switch | Needs role-aware shell |

**Versus incumbents:** Coursera/Canvas/Moodle (rich but heavy, desktop-biased, poor offline),
Google Classroom (simple but not adaptive), Khan/Duolingo (excellent mobile + motivation,
not institution-aware), LinkedIn Learning (catalog + certs, not low-bandwidth). **EFIKO's
edge to lean into:** offline-first, sub-2MB adaptive lessons, WhatsApp/SMS reach, the
cognitive tutor + teach-back — none of the incumbents combine these for low-bandwidth
markets. **Don't copy their feature breadth; win on reach + adaptivity + cost.**

---

## Phase 6 — Responsiveness Review
- **Verified:** ALWE player + Library render with no horizontal overflow at 375px; reduced-
  motion + focus-visible + control wrapping in place.
- **Recommend:** adopt the bottom-nav (mobile) / sidebar (desktop) shell; define responsive
  layouts per page (Home, Course, Player, Studio, Admin) at breakpoints 360 / 768 / 1024 /
  1280; test on a throttled low-end Android profile; confirm PWA install + offline on Android
  Chrome and iOS Safari (iOS SW/PWA caveats). ALWE already targets 60fps + <2MB lessons.

---

## Phase 7 — Studio Review
| Studio | Exists? | Assessment / recommendation |
|---|---|---|
| Lecturer Studio (capsules) | ✅ | Works; converge its output into the Course Repository |
| Whiteboard Studio (ALWE) | ✅ | Strong; add inline login (publish needs it now), and scene editing |
| Institution Admin Portal | ✅ (basic) | Branding + (future) members/programmes; needs the management nav |
| Course Creation Studio | ❌ | New — wraps Programme→Course→Lesson assembly + publish/price |
| Certificate Studio | ❌ | New — template, signing, verification |
| Assessment Studio | ❌ | New — question banks, rubrics, pass thresholds (ALWE checks are a start) |

Recommendation: the Studios should be **one "Creator workspace"** with tabs/sub-nav, sharing
auth, draft state, and the Course Repository — not separate disconnected routes.

---

## Phase 8 — Scalability Assessment
- **100k learners:** achievable with current stack **if** student progress/identity moves to
  Postgres (today it's client-only, which actually scales *reads* well but gives no central
  identity). Move the gateway off Render free tier (cold starts) to always-on.
- **1M learners / multi-university / international:** needs (a) the normalised data model
  above with proper indexes, (b) a shared rate-limit/session store (currently in-memory per
  instance), (c) CDN for static + voice blobs, (d) per-tenant data isolation in queries, (e)
  background jobs for AI authoring/voice (currently synchronous request path), (f) regional
  deployment. The "one brain, many mouths" design **scales conceptually**; the gaps are
  operational (stateful caches, sync AI calls, single-region, no job queue).
- **Corporate/certification/partners:** require Commerce + Certificate + Org entities (none
  exist). Architecturally additive, not a rewrite.

**Weaknesses to fix before scale:** in-memory rate counts & sessions; synchronous AI/voice in
the request path; no student identity; no job queue; single region; two parallel content
models.

---

# DELIVERABLES

### D1. System architecture diagram — see §1.3 (target) and §0 (current spine).

### D2. Role & permission matrix (target)
| Resource → / Role ↓ | Public course | Org course | Author | Publish | Manage org | Enrol students | Platform admin | Commerce |
|---|---|---|---|---|---|---|---|---|
| Visitor | read | – | – | – | – | – | – | – |
| Student | read+enrol | read (if enrolled) | – | – | – | – | – | buy |
| Lecturer | read | author | ✓ (own) | ✓ (org-gated) | – | ✓ (own cohorts) | – | – |
| Institution Admin | read | manage | ✓ | ✓ | ✓ (own org) | ✓ | – | – |
| University Admin | read | manage (tree) | ✓ | ✓ | ✓ (univ tree) | ✓ | – | – |
| Super Admin | all | all | ✓ | ✓ | ✓ (all) | ✓ | ✓ | ✓ |
| Course Creator | read | – | ✓ (own) | ✓ (marketplace) | – | – | – | ✓ (own sales) |
| Partner Org | read | assigned | – | – | ✓ (own staff) | ✓ (staff) | – | ✓ (seats) |

*Current reality:* only Institution Admin (manage own org/branding, publish) and Operator
(≈Super Admin via master key) are implemented; Student is anonymous-read.

### D3. Navigation architecture — see Phase 4 (hybrid; bottom-nav mobile, sidebar desktop, role-filtered).

### D4. Course & programme architecture — see Phase 3 (single Course Repository with facets; Programme owns Courses; ownership tree University→Faculty→Dept or independent Provider).

### D5. Information architecture (top level)
```
Home · Learn(My Courses, Player, Readiness, Certificates) · Explore(Catalog, Programmes,
Marketplace) · Create(Studios) · Manage(Org, Members, Cohorts, Reports, Branding) ·
Platform(Tenants, Moderation, Settings) · Account(Profile, Downloads, Help)
```

### D6. Screen hierarchy (abridged)
```
Auth: Landing/Visitor → Sign up/in → (role) Home
Student: Home → Course → Lesson Player(ALWE/Capsule) → Assessment → Certificate
Lecturer: Creator Home → Studio(author→preview→publish) → Cohort → Invites → Reports
Admin: Admin Home → Members → Programmes/Courses → Branding → Reports
Super: Console → Tenants → Moderation → Quotas/Settings
```

### D7. Feature hierarchy — Core (identity, course repo, enrolment, player, offline) → Pedagogy (ALWE, exam, tutor, teach-back) → Institution (branding, members, cohorts, reports) → Commerce (marketplace, certificates, payments, revenue share) → Platform (multi-tenant ops, moderation, scale).

### D8. Database ERD (high level, target)
```
Organisation(id,type[university|institute|provider|partner],parentId)        // tree
User(id, name, ...)  —— Membership(userId, orgId, role) ——< Organisation
Programme(id, ownerOrgId, ...) ──< Course(id, programmeId?, ownerOrgId, type,
   visibility, accessModel, price, status, version) ──< Lesson(id, courseId, kind, payload)
Cohort(id, courseId|programmeId, lecturerId, code)
Enrolment(id, userId, target[programme|course|cohort], status, progress)
Assessment(id, courseId, items) — Attempt(userId, assessmentId, score)
Certificate(id, userId, courseId, serial, issuedAt, verifyUrl)
Order(id, userId, courseId, amount, split) // commerce + revenue share
```
*Current tables:* `institutions`, `published`(capsules), `alwe_lessons` (+ client IndexedDB
stores). Everything in **bold-italic above is new.**

### D9. Mobile responsiveness — see Phase 6.
### D10. UX improvements — see Phase 5 (design system, role-aware shell, light mode, full-app a11y audit, motivational layer like streaks already partially present via readiness).
### D11. Scalability — see Phase 8 (move identity/progress to Postgres, shared session/rate store, async AI/voice jobs, CDN, multi-region, converge content models).

### D12. Final recommendation — does EFIKO meet international best practice?

**Two honest answers:**

1. **As a lightweight offline-first adaptive micro-learning PWA (what it is):** **Yes —
   it meets and in places exceeds best practice.** The offline engine, sub-2MB adaptive
   lessons, multi-channel reach (WhatsApp/SMS/Wi-Fi), and the ALWE pedagogy (pause points,
   teach-back, cognitive tutor) are genuinely ahead of incumbents *for low-bandwidth African
   higher-ed.* Ship/iterate this with confidence.

2. **As the multi-stakeholder LMS + marketplace the brief describes (where it's going):**
   **Not yet — but it does NOT require a rewrite.** It requires a **staged restructure** that
   adds the missing foundation in the right order. Building marketplace/certificates/roles
   before the identity + course + enrolment layer would cause exactly the "major restructuring
   later" the brief wants to avoid.

**Recommended phased roadmap (no rewrite):**
- **V1.0 (now):** consolidate current product; harden (done); keep students anonymous-local.
- **V1.5 — Foundation:** introduce **User identity + roles (RBAC)**, the **Course entity**
  (converge capsules + ALWE), and **Enrolment** (class code / join link). This unlocks
  everything else and is the single most important next investment.
- **V2.0 — Institution depth:** Programmes, University/Dept tree, Cohorts, Lecturer accounts,
  reports, Assessment Studio, Certificates.
- **V3.0 — Marketplace & scale:** Course Creators, premium/corporate access, payments +
  revenue share, Partner orgs, async jobs, multi-region, international.

**Bottom line:** the foundation is solid and the differentiators are real; do **not** rewrite.
**Approve the V1.5 Foundation (identity + course + enrolment) as the next build** — then the
ambitious V2/V3 features slot in cleanly instead of forcing a restructure.

---

## Appendix — current vs. target, at a glance
| Dimension | Current | Target (brief) |
|---|---|---|
| Student identity | Anonymous (IndexedDB) | Accounts + roles |
| Roles | Institution admin + operator | 8 stakeholder roles |
| Course | `meta.course` string | First-class entity, one repository |
| Enrolment | None (tenant filter) | Programme/Course/Cohort enrolment graph |
| Visibility | Tenant courseFilter + paid `active` | 7-way access model + RBAC |
| Certificates / commerce | None | Full lifecycle + revenue share |
| Navigation | Single view-switch + footer | Hybrid role-aware (bottom-nav/sidebar) |
| Persistence of progress | Client-only | Postgres + offline cache |
| Content models | 2 parallel (capsule, ALWE) | Converged under Course |
