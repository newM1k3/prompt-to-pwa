# App Genie (Prompt-to-PWA Toolkit) — Handover & TODO

**Date:** 2026-08-12 · **Status:** BUILD COMPLETE, AWAITING DEPLOYMENT · **QA:** BLOCKED → FIXED (see §6)

A PWA where a non-technical business owner describes an app in plain English and gets a working, downloadable PWA prototype in ~2 minutes. Built by the full agent team: Product → Research → Architect → Dave (build) → Art (design) → DevOps (hardening) → AI Data (prompts) → QA (testing).

---

## 1. How to Run It

```bash
cd C:\Users\mikew\.openclaw-autoclaw\workspace\prompt-to-pwa
npm install
npm run dev          # Vite dev server → http://localhost:5173
```

**For full functionality (AI generation + payments) you need a local PocketBase and real API keys:**

```bash
# Terminal 2 — local PocketBase (download from pocketbase.io first)
pocketbase serve

# Copy .env.example → .env and fill in:
VITE_POCKETBASE_URL=http://127.0.0.1:8090
GEMINI_API_KEY=      # blueprint extraction
ANTHROPIC_API_KEY=   # code generation (Claude)
STRIPE_SECRET_KEY=   # billing
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
```

Netlify functions need `netlify dev` instead of plain `vite dev` to run locally:

```bash
npm i -g netlify-cli
netlify dev          # serves static + functions → http://localhost:8888
```

**Useful commands:**

| Command | What it does |
|---|---|
| `npm run build` | Production build (tsc + vite) — currently 0 errors |
| `npm run smoke-test` | 15 automated checks (contracts, security, PWA files) — all ✅ |
| `npm run validate-env` | Checks required env vars are set |
| `npm run lint` | Oxlint |

---

## 2. Click-Through Guide (the user journey)

This is the path a user takes. Click through it in order — every screen exists and renders.

| # | Screen | Route | What should happen | Works? |
|---|--------|-------|--------------------|--------|
| 1 | **Welcome** | `/` | Giant textarea + "BUILD MY APP" button, credit badge shows 5 | ✅ UI |
| 2 | **Wizard Step 1** | `/wizard` | 5 purpose cards (Inventory, Staff, Customers, Scheduling, Other) | ✅ |
| 3 | **Wizard Step 2** | `/wizard` | Role suggestions change based on Step 1 choice, max 3 roles | ✅ |
| 4 | **Wizard Step 3** | `/wizard` | Core-action textarea with examples → "BUILD MY APP" | ✅ |
| 5 | **Blueprint** | `/blueprint/:id` | Shows app name, actors, actions, data fields w/ checkboxes | ⚠️ needs API keys |
| 6 | **Compiling** | `/blueprint/:id` | Animated status while Claude writes code (self-healing, ≤3 retries) | ⚠️ needs API keys |
| 7 | **Preview** | `/preview/:id` | Phone-frame iframe (`sandbox="allow-scripts"`), Download + Try Again | ⚠️ needs API keys |
| 8 | **Download** | `POST /download-app` | ZIP download — Pro only, 402 + upgrade modal on Free | ⚠️ needs Stripe |
| 9 | **Upgrade modal** | any | "You built something worth keeping 👏" — Pro = own your code | ✅ |
| 10 | **Dashboard** | `/dashboard` | Generation history, status badges, pagination (10/page) | ⚠️ needs PB data |
| 11 | **Settings** | `/settings` | Plan + credits display, upgrade / billing links | ✅ UI |
| 12 | **Login** | `/login` | Email/password, auto-redirect if unauthenticated | ✅ UI |

> **Without API keys:** steps 5-8 will show the app's friendly error states ("We couldn't reach our servers") — that's the error UX working, not a bug. To see the real pipeline, fill in `.env` (Gemini + Anthropic keys, ~$0.05 per generation).

---

## 3. What Was Built (file map)

### Frontend — `src/`
| File | Purpose |
|---|---|
| `components/WelcomeScreen.tsx` | Entry screen, giant prompt textarea |
| `components/Wizard.tsx` | 3-step guided wizard (purpose → roles → core action) |
| `components/BlueprintReview.tsx` | Blueprint display + human-in-the-loop checkboxes |
| `components/PreviewSandbox.tsx` | srcdoc iframe preview (sandboxed, no same-origin), download/retry |
| `components/Dashboard.tsx` | Generation history, status badges, pagination |
| `components/UpgradeModal.tsx` | Freemium pop-ups ("upgrade to a superpower") |
| `components/LoginScreen.tsx`, `NavBar.tsx`, `CreditBadge.tsx`, `SettingsPage.tsx` | Auth, nav, credits, billing |
| `components/ErrorBoundary.tsx`, `LoadingState.tsx`, `RetryBanner.tsx` | Error/loading UX |
| `hooks/useGenerationFlow.ts` | The state machine (idle→wizard→blueprinting→reviewing→coding→previewing) |
| `hooks/usePocketBase.tsx`, `useCredits.ts` | Auth + credit logic |
| `design-tokens.css`, `index.css` | Art's design system (colors, type, spacing) |
| `types.ts` | Canonical types (BlueprintData etc.) |

### Backend — `netlify/functions/`
| File | Purpose |
|---|---|
| `generate-blueprint.mjs` | Gemini Flash → blueprint JSON, credit check/decrement, rate limited |
| `compile-app.mjs` | Claude → code, acorn AST check, self-healing loop (≤3 retries), 429 backoff |
| `download-app.mjs` | ZIP export (archiver), Pro gating, ownership check |
| `create-checkout-session.mjs` | Stripe Checkout session creation |
| `stripe-webhook.mjs` | Subscription lifecycle (signature-verified) |
| `refund-credit.mjs` | Server-side credit refund (not exploitable from client) |
| `_middleware.mjs`, `health.mjs` | Rate limiting + health check |

### Config & Ops
| File | Purpose |
|---|---|
| `public/manifest.webmanifest`, `public/sw.js` | PWA installability (the toolkit is itself a PWA) |
| `netlify.toml` | CSP/security headers, function config |
| `pb_schema.json` | PocketBase schema (users + generated_apps) |
| `pb_schema_analytics.json` | Analytics fields (AI Data) |
| `.github/workflows/deploy.yml` | CI/CD → Netlify |
| `scripts/smoke-test.mjs`, `scripts/validate-env.mjs` | CI checks |
| `docs/` | DESIGN-GUIDE, DEPLOYMENT, MONITORING, SECURITY-AUDIT, PROMPT-ENGINEERING, COST-OPTIMIZATION, ANALYTICS-SPEC, ECOSYSTEM-DATA-STRATEGY, QA-REPORT |

### Planning docs (workspace root)
`PRODUCT-MVP-Scope-and-Onboarding.md` · `RESEARCH-Market-and-Cost-Viability.md` · `TECHNICAL-ARCHITECTURE.md`

---

## 4. ✅ What's Verified

- `npm run build` — 0 errors, 0 warnings (both before and after QA fixes)
- `npm run smoke-test` — **15/15 ✅** (incl. contract regression checks for C1/C3/C4, iframe security, no hardcoded keys)
- QA's 4 critical contract bugs (C1-C4) — **FIXED**, verified in code
- 8 of 11 major issues — **FIXED** (double-click guard, server-side refund, rate limiting wired, 429 backoff, polling timeout, error surfacing)
- iframe sandbox: `allow-scripts` only, zero `allow-same-origin` matches
- No hardcoded API keys anywhere in src/ or netlify/

---

## 5. ⚠️ What's NOT Verified (needs real environment)

These could not be tested without live keys/deployment — QA flagged them explicitly:

- **Actual Gemini/Claude calls** — prompt quality, JSON shape from real models
- **Self-healing loop in production** — does the 3rd retry actually produce working code?
- **Stripe checkout + webhook end-to-end** — real card flow, subscription events
- **PocketBase auth + rules** — deploy-time rule configuration (see §7)
- **CSP × srcdoc iframe interaction** — netlify.toml already allows `https://cdn.tailwindcss.com` in script-src (the generated code uses the Tailwind CDN), so this was anticipated; still needs a live verification
- **Real browser click-through at 375px / 1024px**
- **Lighthouse PWA audit** (installability likely OK; offline behavior basic)

---

## 6. QA History (why BLOCKED → FIXED)

QA's original verdict was **BLOCKED** — the four request contracts disagreed between client and server, so no journey could complete (e.g., client sent `{wizardData}`, server wanted flat `{prompt}`). All four were unified to the server/architecture spec, plus 8 majors fixed. Full evidence log: `docs/QA-REPORT.md` → "FIX VERIFICATION".

---

## 7. TODO — Deploy Checklist (what it takes to ship)

### Before deploy (env/config, not code)
- [ ] 1. Fill **Netlify env vars**: `POCKETBASE_URL`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` (+ `SITE_URL`)
- [ ] 2. **PocketBase collection rules**: `generated_apps` view/list = `user = @request.auth.id` (closes M11 IDOR)
- [ ] 3. **Monthly credit reset** hook/cron: free → 5, pro → 200, using `credits_reset_at` field
- [ ] 4. Confirm `credits_remaining` default = 5 on signup in deployed schema
- [ ] 5. Add `refunded` boolean field to `generated_apps` (refund guard)
- [ ] 6. Create `stripe_events` collection (webhook idempotency)
- [ ] 7. **Verify CSP × srcdoc** (already partly handled): netlify.toml already allows `https://cdn.tailwindcss.com` in script-src for the generated-app iframe — confirm it works in production
- [ ] 8. Deploy PocketBase (pockethost.io / VPS / Fly.io — see `docs/DEPLOYMENT.md`)

### After deploy (verification)
- [ ] 9. Real end-to-end generation: prompt → blueprint → code → preview (check API costs vs $0.045 model)
- [ ] 10. Stripe test-mode checkout → webhook → plan upgrade → ZIP download
- [ ] 11. Lighthouse PWA audit + real-device install test
- [ ] 12. Mobile/desktop click-through at 375px and 1024px

### Product/ops backlog
- [ ] 13. **README.md is still the Vite default** — needs a real one (Dave's task got cut off)
- [ ] 14. Analytics: wire `pb_schema_analytics.json` fields + admin dashboard (spec in `docs/ANALYTICS-SPEC.md`)
- [ ] 15. Blueprint cache (cost optimization — `docs/COST-OPTIMIZATION.md`)
- [ ] 16. Community blueprint library + consent flow (`docs/ECOSYSTEM-DATA-STRATEGY.md`)
- [ ] 17. v0.5 features: Design Tweaker, Deploy-to-subdomain (deliberately deferred)
- [ ] 18. Monitoring alerts once live (`docs/MONITORING.md` thresholds)

---

## 8. Quick Facts Worth Knowing

- **Cost model:** ~$0.045 per generation (Gemini Flash blueprint + Claude code + retries). Free = 5 credits, Pro = $29/200 credits. "Unlimited" was explicitly rejected by Research as suicidal.
- **Competition:** v0/Softr/Glide/Bubble all require database-schema thinking; we're the only "wish → working app with storage" where the user never sees a schema.
- **Security posture:** iframe sandbox is the battle-tested Gmail/CodePen pattern. Never add `allow-same-origin`.
- **Target user:** non-technical, over-50 business owners. 18px+ text, 48px+ touch targets, plain English throughout.
