# Efiko Gateway — Stage 4: WhatsApp Learning Assistant

WhatsApp is a **primary product**, not an integration. Students learn entirely over
WhatsApp, with no app install. This gateway is the single front door (Stage 1 §3.2).

## Architecture (one brain, many mouths)

```
Student → WhatsApp → Cloud API → Gateway → Core (brain) → Render → Transport → Student
                                   server/   server/core   whatsapp/   whatsapp/
```

- **`core/`** — channel-agnostic brain: `engine` (intent + sessions), `courseCode`
  interpreter, `registry` (universities/topics as DATA), `content` (shared catalog +
  capsules — same source as the PWA), `budget` (Budget Enforcer).
- **`channels/whatsapp/`** — the adapter only: `render` (LearningResponse → WhatsApp
  messages) and `transport` (Cloud API **or** mock). No teaching logic here.

## Run it (no credentials needed — MOCK mode)

```bash
npm run wa:sim        # scripted conversation through the brain, printed to terminal
npm run server        # start the gateway (http://localhost:4100)
```

Try the live simulator endpoint:

```bash
curl -X POST http://localhost:4100/sim -H "Content-Type: application/json" \
  -d '{ "from": "+256700000000", "text": "KIU PSY720 IRT" }'
```

## Going live

Copy `.env.example` → `.env`, set `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
(and your `WHATSAPP_VERIFY_TOKEN`). The transport auto-switches to the real Cloud API;
point Meta's webhook at `GET/POST /webhook`.

## Supported messages

| Send | Efiko replies with |
|------|---------------------|
| `MENU` / `HI` | The numbered menu |
| `KIU PSY720 IRT` | Lesson: text + whiteboard + voice note + footer |
| `Explain GDP` | Resolves topic → lesson |
| `QUIZ` | Practice quiz for the current lesson |
| `FLASHCARDS` | Flashcards for the current lesson |
| `SUMMARY` / `VOICE` | Summary / voice note (voice lands in Stage 6) |
| `HELP` | Usage help |
| unknown topic | Graceful fallback (AI generation arrives later) |
