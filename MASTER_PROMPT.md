# Efiko — Master Prompt

> **Efiko is not an app. It is a multi-channel learning ecosystem.**
>
> **Guiding philosophy:** *If a student cannot install the app, they should still be able to learn.*
> This philosophy influences every engineering decision. Before any feature is built, it
> must pass one test: **"If the student has no internet, can this still work?"** If the
> answer is no, the feature is redesigned.

---

## MULTI-CHANNEL LEARNING ECOSYSTEM (CRITICAL REQUIREMENT)

Efiko must **NOT** be built as a standalone application. Efiko is a multi-channel
learning ecosystem. Every educational service must be accessible through **four channels**:

| Channel | Surface | Purpose |
|---|---|---|
| **1** | Progressive Web Application (PWA) | Rich, installable, offline-capable experience |
| **2** | WhatsApp Learning Assistant | Primary product — full learning with no install |
| **3** | SMS Learning Assistant | 2G fallback — learning with no internet |
| **4** | Campus Wi-Fi Synchronization | Zero-data sync of lessons on campus |

A student must be able to learn **even without installing the application**.

---

## WHATSAPP IS A PRIMARY PRODUCT

WhatsApp is **NOT** an optional integration. WhatsApp is a **core platform**.

- Students must be able to use Efiko **entirely** through WhatsApp.
- Students should **never** be forced to install the application.

### WhatsApp user flows

**Explain a topic**

Student sends:
```text
Explain Logistic Regression
```
Efiko responds with:
- Short explanation
- Step-by-step breakdown
- Voice note
- Three practice questions
- Download lesson button (if internet exists)

**University course code**

Student sends:
```text
KIU PSY720 IRT
```
Efiko responds with — Course: `PSY720`, Topic: `Item Response Theory`, and returns:
- Whiteboard lesson
- Voice note
- Quiz
- Flashcards
- Summary

**Statistical / analytical topic**

Student sends:
```text
Explain ANOVA
```
Efiko returns: definition, hypothesis setup, step-by-step explanation,
F-statistic interpretation, three practice questions, voice note.

**Snap & Learn (photo)**

Student sends a photo — handwritten notes, lecture slides, assignment questions, or book
pages. Efiko extracts the content and returns:
- Simplified explanation
- Whiteboard lesson
- Voice note
- Summary
- Flashcards
- Practice quiz

### WhatsApp architecture

```text
Student
  ↓
WhatsApp
  ↓
WhatsApp Business API
  ↓
Efiko Gateway Server
  ↓
AI Processing Engine
  ↓
Response Generator
  ↓
Student
```

### WhatsApp menu system

When a student types `MENU`, display:
```text
Welcome to Efiko

1. Explain Topic
2. Snap & Learn
3. Practice Quiz
4. My Courses
5. Download Lesson
6. Flashcards
7. Voice Lesson
8. Help
```

Students must also be able to type `QUIZ`, `VOICE`, or `FLASHCARDS` at any time to jump
straight to that mode.

---

## UNIVERSAL UNIVERSITY COURSE CODE SYSTEM

Create a universal course code interpreter. Examples:
```text
KIU  PSY720 IRT
MAK  ECO110 GDP
MUBS ACC210 BUDGETING
KYU  EDU310 ASSESSMENT
```

The system must automatically detect: **University · Faculty · Department · Course code ·
Topic · Level**, then generate an appropriate lesson.

The interpreter must be **scalable to support unlimited African universities** — new
institutions are added as data, not code.

---

## DATA OPTIMIZATION REQUIREMENTS

Maximum data consumption per WhatsApp session:

| Asset | Target size |
|---|---|
| Text lesson | 20–50 KB |
| Voice note | 100–250 KB |
| Whiteboard image | 80–200 KB |
| **Entire learning session** | **≤ 500 KB** |

Always prioritize lightweight content. **Avoid:** videos, large images, PDFs above 2 MB,
long audio files. Always compress content.

---

## VOICE NOTE REQUIREMENTS

- Length: **20–60 seconds**
- Codec: **Opus**
- Target size: **100–250 KB**
- Voice characteristics: clear, professional, natural, African-friendly English,
  moderate speed, warm tone.

---

## LEARNING CAPSULE SYSTEM

Break every lesson into micro-lessons. **Never create 1-hour lessons. Always create short
learning capsules.**

```text
Topic
  ↓
Capsule 1   (3–5 min)
  ↓
Capsule 2   (3–5 min)
  ↓
Capsule 3   (3–5 min)
  ↓
Quiz
  ↓
Flashcards
  ↓
Summary
```

---

## CAMPUS WI-FI SYNCHRONIZATION

Build an offline synchronization engine. When students arrive on campus, no mobile data
should be required.

```text
Campus Server
  ↓
Campus Wi-Fi
  ↓
Efiko
  ↓
Lesson Updates
```

Automatically synchronize: new lessons, quizzes, voice notes, flashcards, course updates.

---

## SMS FALLBACK MODE

Students without internet must be able to send:
```text
PSY110 MEMORY
```
Efiko replies:
```text
MEMORY

Definition:
The ability to encode, store and retrieve information.

Key Types:
1. Sensory Memory
2. Short-Term Memory
3. Long-Term Memory

Reply QUIZ for practice questions.
```

The system **must work on 2G networks**.

---

## ENGINEERING PRINCIPLE (VERY IMPORTANT)

Before generating any feature, always ask:

> **"If the student has no internet, can this still work?"**

If the answer is NO, redesign the feature. Every component must satisfy one of these modes:

| Budget | Mode |
|---|---|
| 0 MB | Offline Mode |
| 0.5 MB | WhatsApp Session |
| 1–5 MB | Ultra-Light Mode |
| 5–15 MB | Interactive Mode |

**Never exceed these limits.**

---

## DEVELOPMENT ORDER (MANDATORY)

Build in this exact order. **Never skip stages. Never build everything simultaneously.
Always wait for approval before proceeding.**

1. System Architecture
2. PWA Foundation
3. Offline Engine
4. WhatsApp Learning Assistant
5. AI Whiteboard Engine
6. Voice Tutor
7. Snap & Learn
8. Lesson Packs
9. Quiz Engine
10. SMS Learning Assistant
11. Campus Wi-Fi Synchronization
12. Lecturer Studio

---

## VERSION SCOPE

Delay advanced features — CBET analytics, psychometric learning analytics, and
institutional dashboards — until **at least version 2.0**.

**Version 1.0 has only one obsession:**

> *Can an African student with almost no data still learn effectively?*

If that answer is yes, Efiko has a strong foundation for wider adoption.
