# Deploying Efiko

Two pieces can be deployed independently:

| Piece | What it is | Needed for |
|---|---|---|
| **Gateway** (`server/`) | Node API + WhatsApp/SMS webhooks + AI/voice | **Going live on WhatsApp** — do this first |
| **PWA** (`src/` → `dist/`) | The student web app | A public web app at a nice URL (optional, later) |

You do **not** need a custom domain. Render gives a free permanent HTTPS URL
(`https://efiko-gateway.onrender.com`). Buy a domain later, only for the PWA.

---

## Part 1 — Push to GitHub (one time)

From the `Akilia PWA` folder (secrets in `.env` are gitignored and will **not** be pushed):

```bash
git init
git add .
git commit -m "Efiko: initial commit"
git branch -M main
# create an EMPTY repo on github.com (no README), then:
git remote add origin https://github.com/<you>/efiko.git
git push -u origin main
```

---

## Part 2 — Deploy the Gateway to Render

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Connect your GitHub repo. Render reads **`render.yaml`** and proposes the
   `efiko-gateway` web service.
3. It will prompt for the **secret** env vars (marked `sync: false`). Paste:
   - `ANTHROPIC_API_KEY`
   - `DEEPGRAM_API_KEY`
   - `WHATSAPP_TOKEN`  (use a **permanent System User token** for production)
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `PUBLIC_BASE_URL` — leave blank for now; set in step 5.
4. **Apply** → Render builds (`npm install`) and starts (`npm run server`).
   When it's live, copy the URL, e.g. `https://efiko-gateway.onrender.com`.
   Check `https://efiko-gateway.onrender.com/health` → should show
   `{"ok":true,"live":true,"ai":true,"voice":true,...}`.
5. Set **`PUBLIC_BASE_URL`** = that URL (Render → service → Environment) and save
   (triggers a redeploy). This makes WhatsApp voice/whiteboard links reachable.

### Point WhatsApp at it
Meta App Dashboard → **WhatsApp → Configuration → Webhook**:
- **Callback URL:** `https://efiko-gateway.onrender.com/webhook`
- **Verify token:** `Efiko-verify`
- Verify & save, then **Subscribe** to the **`messages`** field.

Message your Efiko test number `MENU` — you should get a live reply. 🎉

---

## Part 3 — Deploy the PWA (optional, later)

Render **Static Site** (or Netlify / Cloudflare Pages / Vercel):
- **Build:** `npm install && npm run build`
- **Publish dir:** `dist`
- **Env var (build-time):** `VITE_GATEWAY = https://efiko-gateway.onrender.com`
  (set this *before* building — Vite inlines it at build time).
- SPA fallback: rewrite all routes to `/index.html`.

Then (optional) buy a domain (e.g. `efiko.app`) and point it at the PWA.

---

## Known limitations to fix before public launch
- **Free tier sleeps** after ~15 min idle (30–60s cold start) → WhatsApp messages
  can be missed while it wakes. Use the **starter plan** (always-on) for students.
- **Ephemeral filesystem** → lecturer-published lessons (`server/data/published.json`)
  reset on each redeploy. Move publishing to a database or a Render **persistent disk**.
- WhatsApp **test mode** allows 5 recipients; go through **Business Verification**
  to reach real students.
