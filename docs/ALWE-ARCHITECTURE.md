# EFIKO — Adaptive Learning Whiteboard Engine (ALWE)
## Architecture Design — v0.1 (for review, before implementation)

> **Status:** DESIGN. No engine code is written yet. This document is the contract
> to review and approve. Implementation proceeds in the batches in §18 only after sign-off.

### Decisions already locked (from review)
1. **Stack:** Adapt to Efiko's live stack — React + Vite client, Node gateway, Neon
   Postgres, Deepgram voice, IndexedDB offline. **No** Cloudflare/Supabase rewrite.
2. **Language:** TypeScript for the **new ALWE engine modules only** (`.ts/.tsx`).
   Existing JSX is untouched. Vite compiles both with zero config.
3. **AI vs offline:** **Pre-generate at publish time.** Claude authors the full lesson
   package (scenes, narration, voice clips, several "Explain Again" variants) up front.
   It is bundled and works 100% offline. Live Claude is an *online-only bonus* for
   novel questions, never a dependency for core learning.

### Guiding principle
The whiteboard is **a collection of intelligent learning scenes**, not a video, GIF, or
one long SVG animation. Everything heavy (voice) is segmented; everything visual is
declarative JSON the client draws locally on Canvas/SVG. A complete lesson stays **< 2 MB**.

---

## 1. System Architecture

Four layers. The boundary that matters: **authoring is online and expensive; playback is
offline and free.** Everything a student needs is baked into the package at publish time.

```
┌─────────────────────────────────────────────────────────────────────┐
│ AUTHORING (online, server-side, runs once per lesson)                │
│  Lecturer Studio / AI prompt                                         │
│   → Claude (opus author) builds a SceneGraph: scenes, objects,       │
│     timeline, narration text, pause Qs, Explain-Again variants       │
│   → Deepgram renders narration → many short Opus voice clips         │
│   → Packager assembles the LessonPackage (JSON) + clips              │
│   → Validator enforces size budget, schema, a11y, timing            │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │  publish
┌───────────────────────────────▼─────────────────────────────────────┐
│ DISTRIBUTION (Node gateway + Neon, existing)                         │
│  Neon: lesson manifest + SceneGraph JSON (durable, via kv.js)        │
│  Voice bytes: served by gateway /alwe/clip/:id.ogg (cached)          │
│  Catalog sync hands the manifest to the client                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │  download (once, on Wi-Fi)
┌───────────────────────────────▼─────────────────────────────────────┐
│ CLIENT — ALWE ENGINE (React + TS, offline-first)                     │
│  PackageStore (IndexedDB) ── SceneGraph + clips + progress           │
│  TimelineEngine ── master clock, speed, keyframes                    │
│  SceneRenderer ── draws SVG objects on a layered stage               │
│  VoiceSync ── plays the right clip for the current scene/segment     │
│  PlaybackController ── play/pause/seek/next/prev/replay              │
│  InteractionLayer ── tap objects, pause-point prompts               │
│  ExplainAgain ── serves pre-bundled variants (offline)              │
│  Analytics ── records behaviour locally                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │  signals (replays, fails, dwell time)
┌───────────────────────────────▼─────────────────────────────────────┐
│ COGNITIVE TUTOR (psychometric layer, mostly offline)                 │
│  Behaviour model → diagnosis → targeted intervention                 │
│  "You understand the calculation but not the interpretation…"        │
└─────────────────────────────────────────────────────────────────────┘
```

**Backward compatibility:** existing capsules (single `whiteboard` block, see
`public/capsules/*.json`) keep working through the current renderer. An ALWE lesson is a
**new package type** (`format: "alwe"`); the library shows both. We migrate lessons over
time, we don't break the old ones.

---

## 2. Component Architecture (React)

```
<AlwenPlayer lessonId>                         // top-level, owns engine instances
├── <PlayerHeader>                             // title, mode switch, close
├── <SceneStage>                               // the drawing surface
│   ├── <CanvasLayer>                          // static/background draws (fast)
│   ├── <SvgObjectLayer>                       // animated + interactive objects
│   │   └── <SvgObject* />                     // Arrow, Graph, Equation, …
│   └── <PausePrompt>                          // "Why is the X-axis first?" overlay
├── <NarrationCaption>                         // synced text of current voice segment
├── <TimelineBar>                              // scrub, scene ticks, bookmarks
├── <TransportControls>                        // play/pause/prev/next/replay/speed
├── <SceneOutline>                             // jump-to-scene, completion ticks
├── <ToolDock>                                 // Ask AI · Explain Again · Simplify · Notes
├── <ExplainAgainSheet>                        // variant picker (offline)
├── <KnowledgeCheck>                           // inline mini-quiz per scene
└── <TutorNudge>                               // Cognitive Tutor suggestions
```

Engine logic lives **outside** React (plain TS classes) and pushes state via a small
store; components subscribe. This keeps the 60 fps animation loop off React's render path.

---

## 3. Folder Structure

```
src/alwe/                          # all new, TypeScript
  types.ts                         # the data model (see §15) — single source of truth
  engine/
    TimelineEngine.ts              # master clock, keyframes, speed
    PlaybackController.ts          # play/pause/seek/scene nav
    SceneRenderer.ts               # draws objects, manages layers
    VoiceSync.ts                   # clip selection + audio element control
    InteractionController.ts       # taps, pause points
    AdaptiveReplay.ts              # triggers → scene-scoped suggestions
    CognitiveTutor.ts              # behaviour model → diagnosis → intervention
    AnalyticsRecorder.ts           # local behaviour log
  objects/                         # one renderer per SVG object type
    index.ts  Arrow.ts  Graph.ts  Equation.ts  CoordinatePlane.ts  Table.ts …
  store/
    PackageStore.ts                # IndexedDB: packages, clips, progress, analytics
    progress.ts                    # last position, bookmarks, completion
  modes/
    learningModes.ts               # Fast / Normal / Deep transforms
  components/                      # the .tsx tree from §2
  hooks/
    useEngine.ts  usePlayback.ts  useSceneState.ts
  util/
    easing.ts  svgPath.ts  sizeBudget.ts

server/core/alwe/                  # authoring (Node, can stay JS)
  sceneGenerator.js                # Claude → SceneGraph
  voicePackager.js                 # narration → segmented Opus clips
  packager.js                      # assemble + validate LessonPackage
  schema.js                        # runtime validation (mirrors types.ts)
```

---

## 4. Database Schema

### 4.1 Neon Postgres (server, durable) — via existing `kv.js`
Reuse the `efiko_kv (collection, id, data jsonb)` table. New collections:

| collection         | id              | data (JSONB)                                  |
|--------------------|-----------------|-----------------------------------------------|
| `alwe_lessons`     | `lessonId`      | LessonPackage **manifest** + SceneGraph       |
| `alwe_clips_meta`  | `lessonId`      | clip list: `{id, sceneId, segIdx, bytes, ms}` |

Voice bytes themselves: stored as today's audio path (gateway-served, content-hashed
filename, immutable, long cache). Large blobs don't belong in JSONB.

### 4.2 IndexedDB (client, offline) — extend `Efiko` DB to **v5**
Add stores alongside the existing `capsules / meta / audio / mastery`:

| store              | keyPath              | holds                                          |
|--------------------|----------------------|------------------------------------------------|
| `alwe_packages`    | `lessonId`           | full SceneGraph + manifest + pin/version state |
| `alwe_clips`       | `[lessonId, clipId]` | Opus blob per voice segment                     |
| `alwe_progress`    | `lessonId`           | last position, per-scene completion, bookmarks |
| `alwe_analytics`   | `lessonId`           | replay counts, dwell, quiz, help requests      |

The v4→v5 `upgrade` only **adds** stores — existing data is untouched.

---

## 5. Timeline Engine Design

A single **master clock** drives everything; the renderer and voice are slaves to it.

- The clock advances `elapsedMs` each animation frame by `dt * speed`.
- A scene's timeline is a list of **keyframes**: `{ objectId, t, action, duration }`
  where action ∈ `appear | draw | highlight | fade | move | dim`.
- The engine maintains an ordered keyframe cursor; on each tick it applies any keyframes
  whose start time has passed and interpolates in-progress ones (eased).
- **Pause points** are timeline markers; when the cursor reaches one the clock halts and
  an interaction is surfaced. The clock resumes only on student action.
- **Seeking** sets `elapsedMs` and recomputes object visibility deterministically from the
  keyframe list (every object's state is a pure function of time → instant scene switch).

Determinism is the key property: scene state = `f(elapsedMs)`, so scrub/seek/replay/resume
are all the same operation. No imperative animation state to get out of sync.

```
TimelineEngine
  load(scene)              build keyframe list, compute scene duration
  tick(dt)                 elapsed += dt*speed; applyDueKeyframes(); emit('frame')
  seek(ms)                 elapsed = ms; recomputeState()
  setSpeed(x)              speed = x  (also retimes audio playbackRate)
  pauseAt / resume         hard stops at pause points
  state(objectId)          → {visible, drawProgress, opacity, transform}
```

---

## 6. SVG Object Model

No giant SVG. Each scene is a **list of declarative objects** the renderer draws. Objects
are **reusable across lessons** (a `CoordinatePlane` is the same component everywhere).

Supported types: `text, arrow, circle, rectangle, triangle, line, graph, table, chart,
equation, coordinatePlane, timeline, flowchart, icon, label, highlight, underline, pointer`.

Every object carries (see `AlweObject` in §15): unique `id`, `type`, geometry `props`,
`animation {start, duration, easing, kind}`, `explain` text, `voiceSegment` ref,
`interactive` flag + `onTapExplain`, and `replay` metadata. **Visibility is derived from
the timeline**, never stored imperatively.

Rendering split for performance:
- **Static / background** geometry → drawn once to `<canvas>` (cheap, no per-frame DOM).
- **Animated + interactive** objects → SVG nodes (hit-testing, crisp scaling, a11y roles).

"Draw-on" effect reuses the proven `stroke-dashoffset` technique already in
`CapsuleView.jsx`, but driven by the timeline clock instead of fixed CSS delays.

---

## 7. Scene Management System

- A **LessonPackage** has an ordered `scenes[]` plus structural nodes
  (`intro, miniQuiz, reflection, summary, finalQuiz`). The standard arc:
  `Intro → S1..S4 → Mini-Quiz → S5..S6 → Reflection → Summary → Final-Quiz`,
  **but the count is dynamic** — the generator emits as many scenes as the topic needs.
- Each scene is **self-contained and independently stored** (own objects, own voice clips,
  own knowledge check), so replay/seek touches only that scene and nothing else loads.
- Scene lifecycle: `locked → ready → playing → paused → checking → completed`.
- `SceneManager` exposes: `next/prev/jumpTo/replayScene`, emits completion, and persists
  per-scene status to `alwe_progress`.

---

## 8. Playback Engine

- A single `requestAnimationFrame` loop owned by `PlaybackController`; it computes `dt`,
  calls `TimelineEngine.tick`, and lets `VoiceSync` keep audio aligned.
- Controls: `play, pause, resume, replayScene, replayLesson, next, prev, jumpTo,
  skipScene, setSpeed, bookmark, continueFromLast`.
- **Continue from last position:** on close we persist `{sceneId, elapsedMs, speed, mode}`;
  on open we restore it (offer "Continue" vs "Restart").
- Speeds `0.25–2×` change the clock multiplier **and** the audio `playbackRate`, so
  narration and drawing stay locked together.
- Tab hidden / blur → auto-pause (saves battery on low-end Android).

---

## 9. Adaptive Replay Engine

Listens to learning signals and proposes **scene-scoped** help — never replays the whole
lesson unless asked.

| Trigger                               | Suggested intervention(s)                          |
|---------------------------------------|----------------------------------------------------|
| Fails the scene's knowledge check     | Replay this scene · Simpler explanation            |
| Same mistake twice                    | Revisit prerequisite scene · Another example       |
| Dwell ≫ scene's estimated time        | Explain more slowly · African example              |
| Taps "Ask AI" / Help                  | Variant menu · Practice question                   |
| Low quiz score on a concept           | Targeted replay of the scene that taught it        |

Mapping from a concept/quiz item → the scene that taught it comes from each object's
`conceptTags`, set at authoring time. Interventions draw from the **pre-bundled** Explain-
Again variants (offline); online, the tutor may additionally call Claude for a fresh take.

---

## 10. Explain Again Engine

Every scene ships a pre-generated `explain` bundle, so it works offline:
`simpler, detailed, practicalExample, africanContext, realLifeScenario, visualAnalogy,
commonMistakes, memoryTip`. The UI shows these as chips; selecting one swaps the caption
and (if a matching short clip was generated) plays it. Online-only: a "Still unclear? Ask
in your words" box that calls Claude and *caches the answer into the package* so it's there
next time offline.

---

## 11. Voice Synchronization Engine

- Narration is authored **per segment** (10–30 s each), one or more segments per scene.
  Each segment → its own **Opus/Ogg** clip (`alwe_clips`), independently replayable.
- A segment has `{ startMs, endMs, sceneId, text }` on the scene timeline. `VoiceSync`
  watches the clock: when `elapsedMs` enters a segment it plays that clip; on seek it
  picks the right clip and offsets into it.
- Speed changes set `audio.playbackRate`. Pause points pause audio with the clock.
- Captions are the segment `text` (also powers screen-reader and "no headphones" use).
- **Size:** ~12 kbps Opus → a 25 s clip ≈ 35–40 KB. ~12 segments ≈ **~0.5 MB**, the
  dominant cost; everything else (JSON/SVG) is tens of KB. Well under the 2 MB budget.

---

## 12. Offline Storage Strategy

- **Download once (on Wi-Fi)** pins the whole package: SceneGraph JSON + every voice clip
  → `alwe_packages` + `alwe_clips`. After that, **zero network** to learn.
- Service Worker (existing Workbox setup) precaches the engine assets; clips are fetched
  by the app and stored as blobs (not via SW) so we control eviction and pinning.
- Progress/bookmarks/analytics write to IndexedDB synchronously during play; they sync up
  opportunistically when online (for cross-device "Continue Learning" later).
- Versioning: a package has a `version`; a newer publish updates the manifest without
  un-pinning or wiping progress (same discipline as `saveCapsule`).

---

## 13. Performance Optimization Plan

| Target                         | How                                                            |
|--------------------------------|---------------------------------------------------------------|
| Package 1–2 MB (max 3)         | Opus voice, declarative SVG-as-JSON, shared object library; validator hard-fails over budget |
| Load < 2 s                     | Lazy-load engine chunk; parse only scene 1, hydrate rest idle  |
| Scene switch instant           | Scenes pre-parsed; state = f(time) so no rebuild on jump       |
| 60 fps on mid Android          | Canvas for static layers; SVG only for animated/interactive; transform/opacity only (no layout thrash); object pooling |
| Low memory                     | Unload off-screen scene SVG nodes; keep only current ±1        |
| No heavy libs                  | No animation library; hand-rolled eased keyframes (~a few KB)  |

---

## 14. React Components (delivery list)
`AlwenPlayer, PlayerHeader, SceneStage, CanvasLayer, SvgObjectLayer, PausePrompt,
NarrationCaption, TimelineBar, TransportControls, SpeedMenu, SceneOutline, ToolDock,
ExplainAgainSheet, KnowledgeCheck, BookmarksPanel, NotesPanel, TutorNudge, ModeSwitch,
DownloadManager`.

---

## 15. TypeScript Source Code — the data model (the contract to review)

This is the **only** code in this document. It is the schema everything else depends on;
approving it unblocks the batches. (Implementation of the engine classes comes later.)

```ts
// src/alwe/types.ts
export type ObjectType =
  | 'text' | 'arrow' | 'circle' | 'rectangle' | 'triangle' | 'line'
  | 'graph' | 'table' | 'chart' | 'equation' | 'coordinatePlane'
  | 'timeline' | 'flowchart' | 'icon' | 'label' | 'highlight'
  | 'underline' | 'pointer';

export type AnimationKind = 'appear' | 'draw' | 'highlight' | 'fade' | 'move' | 'dim';
export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
export type LearningMode = 'fast' | 'normal' | 'deep';
export type Difficulty = 'intro' | 'core' | 'stretch';

export interface AlweAnimation {
  kind: AnimationKind;
  startMs: number;      // on the scene clock
  durationMs: number;
  easing?: Easing;
}

export interface ExplainBundle {            // pre-generated, offline
  simpler: string;
  detailed: string;
  practicalExample: string;
  africanContext: string;
  realLifeScenario: string;
  visualAnalogy: string;
  commonMistakes: string;
  memoryTip: string;
}

export interface AlweObject {
  id: string;                 // unique within lesson; reusable type across lessons
  type: ObjectType;
  props: Record<string, unknown>;   // geometry/styling per type (typed per renderer)
  animation: AlweAnimation;
  explainText?: string;             // one-line "what this is"
  voiceSegmentId?: string;          // segment that narrates this object
  conceptTags?: string[];           // links object → concept → quiz item (adaptive replay)
  interactive?: boolean;
  onTapExplain?: string;            // shown/narrated when tapped
  modes?: LearningMode[];           // which modes include this object (default: all)
}

export interface VoiceSegment {
  id: string;
  sceneId: string;
  startMs: number; endMs: number;   // position on the scene clock
  text: string;                     // caption + a11y + TTS source
  clipId: string;                   // → alwe_clips blob
  bytes?: number;
}

export interface PausePoint {
  atMs: number;
  prompt: string;                   // "Why is the X-axis drawn first?"
  expectKind?: 'reflect' | 'tapObject' | 'mcq';
  answer?: KnowledgeCheck;          // optional gate
}

export interface KnowledgeCheck {
  q: string; options: string[]; answer: number;
  conceptTags?: string[];           // wrong answer → adaptive replay target
}

export interface Scene {
  id: string;
  title: string;
  objective: string;
  estimatedMs: number;
  difficulty: Difficulty;
  objects: AlweObject[];
  segments: VoiceSegment[];
  pausePoints: PausePoint[];
  knowledgeCheck?: KnowledgeCheck;
  explain: ExplainBundle;           // scene-level Explain Again
  replay?: { prerequisiteSceneId?: string };
}

export type StructuralKind =
  | 'intro' | 'scene' | 'miniQuiz' | 'reflection' | 'summary' | 'finalQuiz';

export interface LessonNode {       // ordered lesson arc
  kind: StructuralKind;
  sceneId?: string;                 // for kind:'scene'
  quiz?: KnowledgeCheck[];          // for quiz nodes
}

export interface LessonManifest {
  lessonId: string;
  format: 'alwe';
  version: number;
  meta: { university: string; course: string; topic: string; level?: string; sequence?: number };
  arc: LessonNode[];
  totalBytesEstimate: number;
  defaultMode: LearningMode;
  offlineReady: boolean;
}

export interface LessonPackage {
  manifest: LessonManifest;
  scenes: Scene[];                  // resolved scenes referenced by arc
}

// ---- client-only state (IndexedDB) ----
export interface LessonProgress {
  lessonId: string;
  lastSceneId: string;
  lastElapsedMs: number;
  speed: number;
  mode: LearningMode;
  completedSceneIds: string[];
  bookmarks: { sceneId: string; atMs: number; note?: string }[];
  updatedAt: number;
}

export interface LessonAnalytics {
  lessonId: string;
  scenesCompleted: number;
  replayCountByScene: Record<string, number>;
  dwellMsByScene: Record<string, number>;
  quizByConcept: Record<string, { correct: number; total: number }>;
  replayedObjects: Record<string, number>;
  avgSpeed: number;
  helpRequests: number;
  hardestSceneId?: string;          // derived
  updatedAt: number;
}
```

---

## 16. Testing Strategy

- **Unit (Vitest):** TimelineEngine determinism (`state(t)` pure & monotonic); seek ==
  play-to-t; speed retiming; keyframe application order; size-budget validator.
- **Object renderers:** snapshot the SVG output of each object type at t=0, mid, end.
- **VoiceSync:** clip selection at boundaries; seek mid-segment offset; speed → playbackRate.
- **Adaptive replay:** trigger table → expected suggestion set; concept→scene mapping.
- **Storage:** v4→v5 migration keeps existing capsules/audio/mastery; pin/version/progress.
- **Integration (preview browser):** load a real converted lesson, play through, pause
  point gates, tap-to-explain, scene jump, Explain Again offline, Continue-from-last.
- **Performance:** budget assertion in CI (fail >3 MB); manual 60 fps check on a throttled
  mid-range Android profile; load-time check < 2 s.
- **Offline:** DevTools offline after download → full lesson still plays.
- **A11y:** keyboard nav across controls; SVG roles/labels; caption presence; contrast.

---

## 17. Cognitive Tutor (your psychometrics layer — the real differentiator)

Sits above Adaptive Replay. Instead of only "Replay this scene?", it **diagnoses** from
behaviour and intervenes specifically:

- *"You replayed this concept three times — want a simpler explanation?"*
- *"Wrong twice here. Let's revisit only the prerequisite, not the whole lesson."*
- *"You get the calculation but not the interpretation — here's a worked example."*

**Model (offline, lightweight):** a per-concept state from `LessonAnalytics` —
`exposure, errors, dwell, replays` → a coarse mastery/confusion estimate per `conceptTag`.
Rules map evidence patterns to interventions (calculation-correct + interpretation-wrong is
detectable because quiz items and objects are tagged by sub-skill). This is a transparent,
explainable model — fitting for a psychometrician's product, and it runs with no network.
Online, it can escalate to Claude for a bespoke explanation, cached back into the package.

---

## 18. Implementation in Batches (proposed order)

Each batch is independently shippable and verified in the preview before the next.

| Batch | Deliverable | Why first/next |
|------|--------------|----------------|
| **0** | This architecture doc — **review & approve** | Locks the contract |
| **1** | `types.ts` + `schema.js` validator + `PackageStore` (IndexedDB v5) + **one hand-authored sample lesson** | Foundation; proves the data model end-to-end |
| **2** | TimelineEngine + SceneRenderer + 4 core objects (text, line/arrow, coordinatePlane, equation) + minimal player → **one scene plays** | The vertical slice; everything else hangs off this |
| **3** | PlaybackController + TransportControls + TimelineBar + SceneOutline (play/pause/seek/next/prev/speed/continue) | Makes it a real player |
| **4** | VoiceSync + segmented Opus packaging + captions | Adds narration locked to drawing |
| **5** | Pause points + InteractionLayer (tap-to-explain) + per-scene KnowledgeCheck | Interactivity |
| **6** | ExplainAgain (offline bundle) + Learning Modes (Fast/Normal/Deep) | Pedagogical depth |
| **7** | AnalyticsRecorder + Adaptive Replay engine | Behaviour-driven help |
| **8** | Cognitive Tutor (diagnosis + nudges) | The differentiator |
| **9** | `sceneGenerator.js` (Claude authoring) + Studio "Publish ALWE lesson" | Scales authoring beyond hand-made |
| **10** | Accessibility pass + performance hardening + CI budget gate | Production-ready |

Remaining object types (graph, table, chart, flowchart, timeline, triangle, icon,
highlight/underline/pointer) are filled in across batches 2/5/6 as lessons need them.

---

## 19. Open questions for review
1. **Authoring source of truth:** generate ALWE lessons from the existing AI capsule
   pipeline (reuse `lessonGenerator.js`), or a fresh `sceneGenerator.js`? (Proposed: fresh,
   but it may call the same Claude client.)
2. **First real lesson to convert:** I suggest **PSY720 — Item Response Theory (the ICC
   curve)** since it already exists and is visual (coordinate plane + curve + labels) — a
   perfect showcase for tap-to-explain (slope/difficulty/asymptote).
3. **Voice cost at authoring:** Deepgram per-lesson clip generation is cheap, but confirm
   we pre-render voice for *every* scene at publish (vs lazily on first download).
4. **Studio scope now vs later:** ship batches 1–8 against hand/AI-authored sample lessons,
   and do the Lecturer-facing Studio UI (batch 9) once the engine is proven?
```
