# Efiko — Stage 1: System Architecture

> **Stage 1 of 12.** This document defines *what we build and how the pieces relate* — no
> application code yet. Per the master prompt, we **wait for approval before Stage 2 (PWA
> Foundation)**.
>
> Every decision here is filtered through one question: **"If the student has no internet,
> can this still work?"**

---

## 1. Architectural philosophy

Efiko is **one brain, many mouths**. The intelligence (lesson generation, course-code
interpretation, AI tutoring) is built **once** in the core. Each channel — PWA, WhatsApp,
SMS, Campus Wi-Fi — is a thin **adapter** that translates between the student's surface
and that one brain.

This gives us three properties the master prompt demands:

1. **Channel parity** — a feature built once is available everywhere it physically can be.
2. **Data discipline** — every response passes through one place that enforces the size
   budget, so we cannot accidentally ship a 4 MB WhatsApp reply.
3. **Offline-first** — the core produces *portable lesson capsules* that work with zero
   connectivity; channels are just delivery trucks.

**Design rule:** channels never contain teaching logic. If a WhatsApp handler starts
"explaining ANOVA," the architecture has failed. It calls the core and formats the result.

---

## 2. High-level system diagram

```text
            ┌──────────────────────────── STUDENTS ────────────────────────────┐
            │   PWA browser   WhatsApp   SMS phone   On-campus device           │
            └──────┬─────────────┬──────────┬──────────────┬────────────────────┘
                   │             │          │              │
        ┌──────────▼───┐  ┌──────▼─────┐ ┌──▼──────┐ ┌─────▼────────────┐
        │ PWA Frontend │  │  WhatsApp  │ │   SMS   │ │  Campus Sync     │   ← CHANNEL
        │ + Service    │  │  Adapter   │ │ Adapter │ │  Node (Wi-Fi)    │     ADAPTERS
        │   Worker     │  │ (Business  │ │(SMPP/   │ │                  │
        └──────┬───────┘  │   API)     │ │ gateway)│ └─────┬────────────┘
               │          └──────┬─────┘ └──┬──────┘       │
               │                 │          │              │
               └────────────┬────┴──────────┴──────────────┘
                            │
                  ┌─────────▼──────────┐
                  │   Efiko GATEWAY    │   Auth · session · routing · rate limits
                  │   (API + webhooks)  │
                  └─────────┬──────────┘
                            │
            ┌───────────────┼───────────────────────────────┐
            │               │                               │
   ┌────────▼────────┐  ┌───▼─────────────┐      ┌──────────▼──────────┐
   │ Course Code     │  │  AI PROCESSING   │      │  Lesson / Content    │
   │ Interpreter     │─▶│     ENGINE       │◀────▶│  Store (capsules)    │
   │ (university map) │  │ (Claude + RAG)   │      │  + cache             │
   └─────────────────┘  └───┬──────────────┘      └──────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ RESPONSE GENERATOR │   text · voice(Opus) · whiteboard · quiz · cards
                  │  + BUDGET ENFORCER │   ← every reply sized here (≤ channel budget)
                  └─────────┬──────────┘
                            │
                  ┌─────────▼──────────┐
                  │  Output Asset Store │   compressed, CDN/edge, addressable by capsule id
                  └────────────────────┘
```

---

## 3. The seven core components

### 3.1 Channel Adapters
Thin, stateless translators. Each one: receives an inbound message/request, normalizes it
into a **canonical `LearningRequest`**, calls the Gateway, then renders the returned
**`LearningResponse`** into that channel's native format.

| Adapter | Inbound | Outbound rendering | Notes |
|---|---|---|---|
| PWA | HTTP / fetch | JSON → React UI + cached capsules | Richest; offline via Service Worker |
| WhatsApp | Business API webhook | text + media messages, list/button menus | **Primary product**; image (Snap & Learn) in |
| SMS | Gateway/SMPP webhook | plain text, ≤160-char segments | 2G; text-only, no media |
| Campus Sync | local Wi-Fi pull | bundle of capsules (delta sync) | Zero mobile data |

### 3.2 Efiko Gateway
The single front door. Responsibilities: identify/authenticate the student, attach or
create a **session**, apply rate limits, and route the `LearningRequest` to the right core
service. It is the only component channels talk to.

### 3.3 Course Code Interpreter
Turns `KIU PSY720 IRT` into structured intent: `{ university, faculty, department,
courseCode, level, topic }`. Backed by a **data-driven university registry** (not code) so
new African universities are onboarded by adding rows, satisfying "scalable to unlimited
universities." Falls back gracefully when only a free-text topic is given (`Explain ANOVA`).

### 3.4 AI Processing Engine
The brain. Generates teaching content using **Claude (claude-opus-4-8 for authoring,
claude-haiku-4-5 for fast/cheap interactive turns)** grounded in a curriculum knowledge
base (RAG). Handles: topic explanation, Snap & Learn OCR→explanation, quiz generation,
flashcard extraction, summary writing. Output is **structured, format-agnostic content** —
*not* yet sized or rendered.

### 3.5 Response Generator + Budget Enforcer
Converts structured content into concrete assets per channel: text, **Opus voice note
(20–60 s, 100–250 KB)**, whiteboard image (80–200 KB), quiz, flashcards. The **Budget
Enforcer** is mandatory and non-bypassable: it knows each channel's ceiling and degrades
gracefully (drops media, shortens, re-compresses) until the response fits.

### 3.6 Lesson / Content Store (Capsules)
Canonical home of **Learning Capsules** (3–5 min micro-lessons) and their generated assets.
Caches AI output so the same topic isn't regenerated. Source of truth for what Campus Sync
distributes.

### 3.7 Output Asset Store
Compressed, content-addressable binary store (voice notes, whiteboard images) served from
the edge. Assets are immutable and keyed by capsule + format, so they cache forever and
sync as deltas.

---

## 4. Canonical contracts (the "one brain" interface)

Every channel speaks these two shapes. This is what keeps teaching logic out of adapters.

```jsonc
// LearningRequest — produced by any adapter
{
  "channel": "whatsapp | sms | pwa | campus",
  "studentId": "…",
  "sessionId": "…",
  "intent": "explain | snap | quiz | voice | flashcards | menu | course_code | sync",
  "raw": "Explain ANOVA",          // original text, if any
  "courseCode": "KIU PSY720 IRT",  // optional, parsed by interpreter
  "media": [ { "type": "image", "ref": "…" } ], // Snap & Learn
  "budgetKB": 500                  // channel-imposed ceiling
}
```

```jsonc
// LearningResponse — consumed by any adapter
{
  "capsuleId": "psy720-irt-c1",
  "blocks": [
    { "type": "text",       "value": "…", "sizeKB": 12 },
    { "type": "voice",      "ref": "asset://…", "codec": "opus", "sizeKB": 180 },
    { "type": "whiteboard", "ref": "asset://…", "sizeKB": 140 },
    { "type": "quiz",       "items": [ … ] },
    { "type": "flashcards", "items": [ … ] },
    { "type": "summary",    "value": "…" }
  ],
  "actions": [ "QUIZ", "VOICE", "FLASHCARDS", "DOWNLOAD" ],
  "totalSizeKB": 332,              // guaranteed ≤ budgetKB
  "offlineReady": true
}
```

An adapter renders only the `blocks` its channel supports (SMS takes `text`/`summary`;
WhatsApp takes everything; PWA takes everything + stores for offline).

---

## 5. Data budget enforcement (how the philosophy becomes code)

The master prompt's mode ladder is implemented as a **single policy table** the Budget
Enforcer reads. No component may emit a response that violates it.

| Mode | Budget | Channels | What's allowed |
|---|---|---|---|
| Offline | 0 MB | Campus / cached PWA | Pre-synced capsules only |
| WhatsApp Session | ≤ 0.5 MB | WhatsApp | text + 1 voice + 1 whiteboard |
| Ultra-Light | 1–5 MB | PWA on 2G/3G | + small lesson packs |
| Interactive | 5–15 MB | PWA on Wi-Fi | + richer media |
| SMS | ~text only | SMS | text/summary, segmented |

**Degradation order** when over budget: drop whiteboard → shorten text → drop voice →
text-only. The student always gets *something* that teaches.

---

## 6. Recommended technology stack

Chosen for low operational cost, low data footprint, and a single language across PWA +
backend. **These are recommendations for your approval — flag any you want changed.**

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js (LTS)** | One language end-to-end; huge ecosystem for WhatsApp/SMS |
| API/Gateway | **Fastify** (or Express) | Lightweight, fast, webhook-friendly |
| PWA frontend | **Vite + React + Workbox SW** | Installable, offline cache, small bundles |
| Offline storage | **IndexedDB (PWA)**, file bundles (Campus) | Capsules survive zero connectivity |
| Data store | **PostgreSQL** + JSON fallback | Registry, sessions, capsule metadata |
| AI | **Anthropic Claude** (opus-4-8 authoring, haiku-4-5 interactive) | Quality + cheap fast turns |
| Voice (TTS) | Opus-encoding TTS pipeline | Meets 100–250 KB / Opus requirement |
| Whiteboard | Server-rendered SVG → PNG, palette-limited | Hits 80–200 KB |
| WhatsApp | **WhatsApp Business API** (Cloud API) | Required channel |
| SMS | SMPP / local aggregator gateway | 2G reach in target markets |
| Hosting | Container + edge asset cache | Scales per channel independently |

> **Open decision for you:** WhatsApp Cloud API (Meta-hosted, simplest) vs. an on-prem /
> BSP provider (more control, often cheaper at African SMS/WhatsApp volume). I recommend
> starting on Cloud API and abstracting it behind the adapter so we can swap later.

---

## 7. Data model sketch (first pass)

```text
University(id, name, code, country)
Faculty(id, universityId, name)
Department(id, facultyId, name)
Course(id, departmentId, code, title, level)
Topic(id, courseId, name, aliases[])
Capsule(id, topicId, sequence, title, durationMin)
Asset(id, capsuleId, type, codec, sizeKB, ref, hash)
Student(id, channelIds{ whatsapp, sms, pwa }, lastSeen)
Session(id, studentId, channel, startedAt, budgetKB)
SyncBundle(id, campusId, capsuleIds[], builtAt)
```

The `University→…→Topic` chain is what the **Course Code Interpreter** walks; adding a
university is inserting rows, never code.

---

## 8. Offline & sync model (why this isn't an afterthought)

- **PWA**: Service Worker + IndexedDB cache capsules on first view; "Download Lesson"
  pins a capsule permanently. App opens and teaches with no network.
- **Campus Sync**: a local node on campus Wi-Fi holds a `SyncBundle`. Devices pull
  **deltas** (by asset `hash`) — only new/changed capsules transfer, costing zero mobile
  data.
- **Immutable assets**: because assets are content-addressed, sync is a cheap hash diff
  and caches are never stale-but-wrong.

---

## 9. Security & privacy (baseline)

- Student identity is **channel-native** (phone number for WhatsApp/SMS) — minimal PII.
- Gateway enforces rate limits per student to control AI cost and abuse.
- Inbound Snap & Learn images are processed then **discarded** unless the student saves.
- WhatsApp/SMS webhooks are signature-verified at the Gateway.

---

## 10. What Stage 1 deliberately defers

To keep v1.0's single obsession (*can a low-data student still learn?*), the following are
**out of scope until ≥ v2.0**: CBET analytics, psychometric learning analytics,
institutional dashboards, Lecturer Studio (Stage 12 — built but feature-light in v1).

---

## 11. Proposed Stage 2 (for approval)

**Stage 2 — PWA Foundation:** scaffold the Vite/React PWA, install the Service Worker +
IndexedDB capsule cache, render a single hard-coded Learning Capsule fully offline, and
prove the `LearningResponse` contract end-to-end on one channel. No AI yet — that's Stage 4+.

---

### ✋ Approval gate

Per the mandated build order, I will **not** start Stage 2 until you approve. Please confirm:

1. Architecture shape (one-brain / thin-adapters) — **approve / change?**
2. Tech stack (Node + Vite/React PWA + Postgres + Claude) — **approve / change?**
3. WhatsApp transport (start on Cloud API, abstracted) — **approve / change?**
4. Proceed to **Stage 2 — PWA Foundation**? — **yes / not yet?**
