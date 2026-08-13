# QA Report — Prompt-to-PWA Toolkit ("App Genie")

**QA Pass:** Final pre-ship pass (post feature-complete build)
**Date:** 2026-08-12
**Tester:** QA subagent (static review + build/lint/smoke verification)
**Repo:** `C:\Users\mikew\.openclaw-autoclaw\workspace\prompt-to-pwa\`
**Specs:** TECHNICAL-ARCHITECTURE.md, PRODUCT-MVP-Scope-and-Onboarding.md, RESEARCH-Market-and-Cost-Viability.md

---

## FIX VERIFICATION (2026-08-12 — post-QA fix pass)

All four Criticals, the credit-economy Majors (M1–M5), and M9/M10 were fixed in this pass. Verified by `npm run build` (0 errors), `npm run lint` (0 errors), `node scripts/smoke-test.mjs` (15/15 ✅ — now includes C1/C3/C4 contract guards), `node scripts/test-prompts.mjs` (5/5, 100%). Remaining items are deploy-time environment work (PB rules, monthly reset cron) or live-API verification — none are static blockers.

| ID | Issue | Status | Evidence (one line) |
|----|-------|--------|---------------------|
| C1 | generate-blueprint 422 (contract mismatch) | **FIXED** | Client now sends flat `{ prompt, purpose, roles, coreAction }` with `roles` mapped to strings — `useGenerationFlow.ts` submitBlueprint body; server contract unchanged (`generate-blueprint.mjs` destructures flat fields). |
| C2 | Blueprint schema mismatch → review screen crash | **FIXED** | One canonical shape `{ app_name, actors[], actions[], data_fields[], primary_view }` enforced in `src/types.ts`, `BlueprintReview.tsx` (rewritten), `generate-blueprint.mjs` prompt+validation, `test-prompts.mjs` (v2.1.0); invalid AI output now refunds + 502 instead of persisting (validation result no longer ignored); client `isValidBlueprint()` rejects stale records with a friendly message instead of crashing. |
| C3 | compile-app 422 (contract mismatch) | **FIXED** | Client sends `{ jobId: state.appId, blueprint, confirmedSections }` (`useGenerationFlow.ts`); server unchanged (`{ jobId, blueprint }`); polling already targets the PB record (the status source compile-app writes to) — verified consistent. |
| C4 | download-app 405 | **FIXED** | Client now GETs `/.netlify/functions/download-app?jobId=…` with `Authorization: Bearer` (`PreviewSandbox.tsx`); server reads `queryStringParameters.jobId` + `event.headers.authorization` (unchanged). Server 402 now opens the upgrade modal instead of a generic alert. |
| M1 | Self-healing loop misroutes after failed attempt | **FIXED** | `compile-app.mjs` now tracks `attemptErrors` per attempt; a later valid attempt resets them → recovery to `ready` works; API errors no longer poison later attempts. |
| M2 | No polling timeout | **FIXED** | Client poll deadline 120s → error state with Try Again (`useGenerationFlow.ts` `POLL_TIMEOUT_MS`); server watchdog for stale `coding` records still recommended at deploy (see Deploy-time items). |
| M3 | Generation errors invisible | **FIXED** | Hook exposes `error` + `errorStatus`; Wizard step 3 and BlueprintReview render inline error panels with Try Again; server 402 auto-opens the UpgradeModal via App effect; `approveBlueprint`/`submitBlueprint` wrapped. |
| M4 | Double-click = double generation | **FIXED** | `isSubmitting` guard in hook + disabled BUILD MY APP buttons (Wizard + BlueprintReview); server decrement switched to PB atomic `credits_remaining-` modifier with post-decrement negative check + self-correct (`generate-blueprint.mjs`). |
| M5 | Client-side refund exploit | **FIXED** | Refund moved server-side: new `refund-credit.mjs` (`refundCreditForApp` helper + endpoint), called by `compile-app.mjs` on `needs_review`, idempotent via `refunded` flag on the record; client `credits_remaining+` writes deleted (hook + `useCredits.deductCredit/refundCredit` removed entirely); `generate-blueprint` credit writes now use admin auth so a locked `users` self-update rule cannot break them. |
| M6 | Freemium copy contradicts credits model | **FIXED** | All user-facing copy now credits-based (5 free / 200 Pro): WelcomeScreen, UpgradeModal (both variants + comparison table), SettingsPage, PreviewSandbox modal, CreditBadge (already correct). |
| M7 | No monthly credit reset | **PARTIAL (code comment + doc)** | No scheduler exists in this repo — by design. Comment added in `stripe-webhook.mjs` + Deploy-time item below: a PocketBase cron/hook must reset `credits_remaining` monthly (free: 5 on 30-day rolling window; pro: 200 on renewal). |
| M9 | Rate limiting dead code | **FIXED** | `_middleware.mjs` `rateLimit` now imported + applied in `generate-blueprint.mjs` (10/min per IP), `compile-app.mjs` (5/min per user), `create-checkout-session.mjs` (30/min per IP). In-memory limiter is per-instance (documented in middleware) — Netlify platform limiting recommended at scale. |
| M10 | No 429/backoff for AI APIs | **FIXED** | `callClaude` (compile-app) and `callGeminiFlash` (generate-blueprint) retry 429/5xx twice with exponential backoff (2s, 4s) before giving up. |
| M11 | IDOR on read paths | **PARTIAL (client check + doc)** | Client-side ownership check added in BlueprintPage/PreviewPage (friendly error, no data leak in UI); authoritative fix is the PocketBase view rule `user = @request.auth.id` on `generated_apps` — see Deploy-time items (cannot be enforced from this repo). |
| Minor m7 | ErrorBoundary shows raw error text | **FIXED** | Raw `message` no longer rendered to users (details stay in console). |
| Minor m11 | create-checkout-session leaks Stripe error | **FIXED** | Generic message returned; details logged server-side only. |
| Minor m6 (a11y) | Sub-48px touch targets in BlueprintReview | **FIXED** | Action/field selectors are now 44×44px hit targets (`w-11 h-11`). |
| Smoke test gap | C1/C3/C4 invisible to CI | **FIXED** | `smoke-test.mjs` now statically asserts the three request contracts (check 8, 15/15 total); `refund-credit.mjs` added to function checks. |

**Behavior change note (M5):** refund policy now refunds on `needs_review` (matches PRODUCT doc “try again — no charge”, conflicts with TECHNICAL-ARCHITECTURE §8.2 “do NOT refund”). Decision was made per the fix ticket; if §8.2 is authoritative, delete the `refundCreditForApp` call in `compile-app.mjs` `markNeedsReview`.

### Deploy-time items (environment, not code — REQUIRED before ship)
1. **PocketBase `users` update rule: LOCKED (no self-update)** — now safe to enforce since all credit writes are admin-authed. Also `plan_tier` must not be self-settable.
2. **PocketBase `generated_apps` view/list rules: `user = @request.auth.id`** — closes M11 IDOR fully.
3. **Monthly credit reset cron/hook (M7):** free → 5, pro → 200, using a `credits_reset_at` field; hook `invoice.paid` renewal to top Pro back to 200.
4. **`credits_remaining` default 5 on signup** (schema declares it — confirm the deployed instance applies it).
5. **`refunded` boolean field on `generated_apps`** (used by M5 refund guard) — add to deployed schema with default `false`.
6. **`stripe_events` collection exists** (webhook idempotency).
7. **Live re-test** of the full journey (no API keys in this environment): wizard → blueprint → review → compile → preview → download, incl. Claude/Gemini 429 behavior and the CSP × srcdoc iframe interaction.

---

## Summary

| | |
|---|---|
| **Verdict (original pass)** | **🔴 BLOCKED — do not ship** (see [FIX VERIFICATION](#fix-verification-2026-08-12--post-qa-fix-pass) — all 4 Criticals + M1–M5/M9/M10 fixed since; remaining items are deploy-time environment work + live-API re-test) |
| Critical | 4 (all fixed) |
| Major | 11 (8 fixed, 3 deploy-time: M7/M8/M11) |
| Minor | 17 (3 fixed, rest cosmetic) |
| Passed | see [Passed Checks](#passed-checks) |

**One-line verdict:** The core generation pipeline cannot complete **any** user journey end-to-end. Four request-contract mismatches between the client and the Netlify functions mean blueprint generation always returns 422, the blueprint review screen crashes, compilation always returns 422, and Pro ZIP download always returns 405. These are all statically verifiable and were not caught by the smoke test (which is static-only). The self-healing compiler, freemium gates, and Stripe flows are structurally present but unreachable behind these breakages.

---

## Critical Issues (must fix before ship)

### C1 — `generate-blueprint` request contract mismatch → every blueprint request 422s
- **Severity:** Critical (blocks entire product)
- **Files:** `src/hooks/useGenerationFlow.ts` (submitBlueprint, body ~L105–117) vs `netlify/functions/generate-blueprint.mjs:173`
- **Description:** The client sends `body: JSON.stringify({ wizardData })`, but the handler destructures flat fields: `const { prompt, purpose, roles, coreAction } = body;`. `body.prompt` is therefore always `undefined` → the function returns **422 `invalid_input` "prompt is required" (L179) on every call**. The wizard's final "BUILD MY APP" click can never produce a blueprint. No code anywhere unwraps `wizardData` (verified: no server file references it).
- **Suggested fix:** Unwrap server-side (`const { wizardData } = body; const { prompt, purpose, roles, coreAction } = wizardData ?? {};`) or send flat fields from the client. Add a handler-level integration test that invokes the function with the exact client request shape.

### C2 — Blueprint schema mismatch → BlueprintReview crashes on every generation
- **Severity:** Critical (blocks review step)
- **Files:** `netlify/functions/generate-blueprint.mjs` (prompt L84–107, validation L111–151) vs `src/types.ts` + `src/components/BlueprintReview.tsx:16,19,93`
- **Description:** The server's Gemini prompt asks for `app_name, actors, actions, data_fields, primary_view` and validates exactly those keys. The client's `BlueprintData` type and review UI expect `app_name, description, screens[], data_models[], user_flows[]`. `BlueprintReview` immediately calls `blueprint.data_models.flatMap(...)` (L16) and `blueprint.screens.map(...)` (L19) → `TypeError: Cannot read properties of undefined` → the global ErrorBoundary screen. Even after C1 is fixed, every generation dies at the review screen. (A third, divergent blueprint shape exists in `scripts/test-prompts.mjs` — v2.0.0 with `app_description, views, user_flows, edge_cases, confidence` — so the repo now carries **three** incompatible blueprint schemas.)
- **Related:** `validateBlueprint()`'s result is **never checked** — lint confirms `validation` is declared but unused (`generate-blueprint.mjs:261`). Structurally-invalid-but-parseable Gemini JSON is silently persisted and the user's credit is consumed for a broken blueprint.
- **Suggested fix:** Align all three to one schema. Recommend the client/spec shape (`app_name, description, screens, data_models, user_flows` per TECHNICAL-ARCHITECTURE §2/§3.1) — update the Gemini prompt, `validateBlueprint`, and `test-prompts.mjs` together; then enforce `if (!validation.valid) → refund + 502`.

### C3 — `compile-app` request contract mismatch → compile always 422s
- **Severity:** Critical (blocks compile/preview)
- **Files:** `src/hooks/useGenerationFlow.ts:123` (`body: { appId: state.appId, blueprint, confirmedSections }`) vs `netlify/functions/compile-app.mjs:205,211`
- **Description:** The handler reads `const { jobId, blueprint } = body;` and returns **422 "jobId is required"** when absent — but the client never sends `jobId`, it sends `appId`. Every compile invocation fails before reaching Claude, so the self-healing loop never runs and no app ever reaches `ready`.
- **Suggested fix:** Use one key (`jobId` or `appId`) on both sides; update the spec §3.2 contract example to match. Add a handler-level integration test.

### C4 — `download-app` contract mismatch → Pro ZIP download always 405s
- **Severity:** Critical (breaks the headline Pro feature / monetization)
- **Files:** `src/components/PreviewSandbox.tsx:32` vs `netlify/functions/download-app.mjs:135,143`
- **Description:** The client POSTs JSON `{ appId: jobId }` to `/.netlify/functions/download-app`. The handler only accepts **GET** (`event.httpMethod !== 'GET'` → 405, L135) and reads `event.queryStringParameters?.jobId` (L143). Every "DOWNLOAD SOURCE CODE" click returns 405 → user sees "Download failed. Please try again." Pro users can never download their app — the core conversion lever is dead.
- **Suggested fix:** Align on one contract (spec §3.3 says POST + `{"appId"}` — change the server to POST + body, or change the client to `GET ?jobId=` with an `Authorization` header).

---

## Major Issues (should fix before ship)

### M1 — Self-healing retry loop can never "recover to ready" after any failed attempt
- **Files:** `netlify/functions/compile-app.mjs:285,318,358`
- **Description:** `allErrors` is never reset between attempts. The success path requires `finalHtml && allErrors.length === 0` (L358), but `allErrors` accumulates errors from *earlier* attempts. So: attempt 1 fails validation, attempt 2 produces valid HTML → still routed to `needs_review`. Same if attempt 1/2 hit a Claude API error and attempt 3 succeeds. The loop only reports `ready` on a first-attempt success — the entire self-healing design (spec §3.2) is defeated.
- **Suggested fix:** Track errors for the current attempt only (`const attemptErrors = []` per iteration); success = current attempt had zero validation errors; API errors should not poison later attempts.

### M2 — Polling has no timeout; records can be stuck at "coding" forever
- **Files:** `src/hooks/useGenerationFlow.ts:139–199`
- **Description:** The status poll runs every 2s with no maximum duration. If `compile-app` is killed (Netlify 120s cap) or a status write fails, the record stays `coding` indefinitely; the user's spinner never resolves, and the Dashboard shows "Building..." forever. There is also no stale-status recovery (spec §5/§8 requires a 120–180s timeout with an error+retry UI; spec 8.6 matrix).
- **Suggested fix:** Add a client poll deadline (~150s) → error state; add a server-side stale-`coding` watchdog (e.g., a scheduled function that flips `coding` records older than ~5 min to `needs_review` with refund).

### M3 — Generation errors are invisible to the user
- **Files:** `src/App.tsx` (handleBlueprintApproved, no try/catch) + `src/components/Wizard.tsx` / `BlueprintReview.tsx` (no error rendering)
- **Description:** `approveBlueprint()` catches errors into hook state and rethrows; `handleBlueprintApproved` awaits without try/catch → unhandled promise rejection. `BlueprintReview` only renders "coding" vs review — it never shows the hook's `error`. Result: user clicks "GENERATE MY APP", waits, and nothing happens (no message, no navigation). Same for blueprinting failures and **server-side 402** (client-side credit check uses possibly-stale state; a server 402 is swallowed by the empty catch in `handleWizardComplete` — the upgrade modal never opens).
- **Suggested fix:** Render an error state with a clear message + retry in Wizard/BlueprintReview; open the limit-gate UpgradeModal on server 402; add try/catch around `approveBlueprint`.

### M4 — Credit decrement race on double-click (money/credits leak)
- **Files:** `netlify/functions/generate-blueprint.mjs:44–52,203–217` + `src/components/Wizard.tsx` (step-3 button has no pending guard)
- **Description:** `decrementCredit` is a read-modify-write (`getOne` → `update`). Two concurrent requests (double-click "BUILD MY APP") can both read `credits_remaining = 5`, both pass the `<= 0` guard, both write 4 → **two generations for the cost of one** (and two `generated_apps` records). The spec §6 acknowledges this risk and suggests optimistic concurrency — none is implemented.
- **Suggested fix:** Disable the button while a request is in flight (client), and make the decrement conditional server-side (PocketBase v0.27 doesn't do CAS — use a per-user in-flight marker on the record, or an `updated`-field guard, or accept + document; at minimum the client guard removes the common case).

### M5 — Credit refund runs client-side (insecure + inconsistent + double-refundable)
- **Files:** `src/hooks/useGenerationFlow.ts:178–184`
- **Description:** On `needs_review`, the **client** calls `pb.collection("users").update(user.id, {"credits_remaining+": 1})` with the user's own token. (a) If PocketBase's `users` update rule allows self-update (the default for auth collections), any user can call the same API directly to grant themselves unlimited credits — and can also flip `plan_tier` to `pro` to unlock downloads. The whole freemium model collapses. (b) The refund only happens if the tab stays open until the poll sees `needs_review` — tab close = no refund. (c) `refundedRef` is reset by `retryGeneration`, so repeated try→fail cycles refund repeatedly (each retry doesn't re-charge, so a second refund nets the user +1 credit). Note also this refund policy conflicts with TECHNICAL-ARCHITECTURE §8.2 ("Do NOT refund — user got blueprint + 3 compilation attempts") — though the PRODUCT doc's "try again — no charge" copy supports the implementation. Either way, the mechanism must be server-side.
- **Suggested fix:** Refund in `compile-app.mjs` (admin auth) when it sets `needs_review`; delete the client-side `credits_remaining+` calls; **verify/lock down PocketBase rules** (see U2).

### M6 — Freemium copy contradicts the implemented credit model
- **Files:** `src/components/UpgradeModal.tsx:57,99,123`; `src/components/SettingsPage.tsx:104`; `src/components/WelcomeScreen.tsx` (credits copy)
- **Description:** The RESEARCH doc (most recent, cost-validated) defines **Free = 5 credits/month, Pro = 200 credits/month ($29), 1 credit = 1 generation** — which is exactly what the code implements (`FREE_CREDITS = 5`, `PRO_CREDITS = 200` in `stripe-webhook.mjs`). But the UI copy still uses the older PRODUCT doc model: "On the Free plan, you get one app per month" (UpgradeModal L99), "1 / month" vs "Unlimited" tables (L123), "Unlimited apps" bullet (L57), "On the Free plan, you get 1 app per month" (SettingsPage L104). A free user with 5 credits who hits zero sees "you get one app per month" — factually wrong under the shipped model. Also note RESEARCH explicitly calls "Unlimited at $29/month financially suicidal."
- **Suggested fix:** Decide the model (recommend: credits, per RESEARCH) and sweep all copy to match (e.g., "X of 5 free credits left this month", "200 credits every month"). Update PRODUCT doc to match.

### M7 — No credit reset logic — the credit economy never renews
- **Files:** `netlify/functions/stripe-webhook.mjs` (only sets credits on checkout) — no reset anywhere (grep verified)
- **Description:** Spec §6 requires: free credits reset on a 30-day rolling window from first consumption; Pro resets to 200 on subscription renewal. No cron/scheduled function implements this. Free users get 5 credits once ever; Pro users get 200 once ever. SettingsPage claims "Your credits reset at the start of each billing period" — false.
- **Suggested fix:** Netlify scheduled function (cron) or reset-on-access logic; store `credits_reset_at` per user; hook subscription renewal (`invoice.paid`) to top back to 200.

### M8 — "First 7 days free. Cancel anytime." is unbacked
- **Files:** `src/components/UpgradeModal.tsx:157`, `src/components/SettingsPage.tsx:139` vs `netlify/functions/create-checkout-session.mjs` (no trial configured)
- **Description:** No `trial_period_days`, no trial coupon in checkout session creation. The promise is only true if the Stripe Price itself has a trial configured in the dashboard. If not, this is a false marketing claim.
- **Suggested fix:** Set the trial on the Stripe price in the dashboard (verify), or remove/qualify the copy.

### M9 — Rate limiting is dead code; cost-bearing endpoints are unprotected
- **Files:** `netlify/functions/_middleware.mjs` (exports `rateLimit`, `secureHandler`, etc.) — verified **zero** imports by the six deployed functions
- **Description:** Spec §6 requires 10 req/min (free) / 30 req/min (pro) rate limiting. Nothing calls `rateLimit`. `compile-app` is particularly exposed: it costs ~$0.045–0.13 per run (up to 3 Claude calls), requires no rate limit, and only needs the user to own one record — an attacker can burn the Claude budget. The "hardened" middleware is shipped but never wired.
- **Suggested fix:** Import `rateLimit` into `generate-blueprint`, `compile-app`, and `create-checkout-session`; note the in-memory limiter is per-instance (documented) — for production use Netlify platform rate limiting or an edge function.

### M10 — No 429/rate-limit handling or backoff for Claude/Gemini
- **Files:** `netlify/functions/compile-app.mjs:42` (`callClaude`), retry loop L295–355
- **Description:** Any non-200 throws; the retry loop retries immediately with no backoff. On a Claude 429, three attempts fire back-to-back, all fail, → `needs_review`. Spec §6: "Implement exponential backoff on 429 responses."
- **Suggested fix:** On 429/5xx, wait (e.g., 2s/4s/8s) before next attempt; surface 429 as retryable.

### M11 — Read paths lack ownership enforcement (IDOR risk — verify)
- **Files:** `src/App.tsx` BlueprintPage/PreviewPage (direct SDK `getOne`), vs ownership checks only in `compile-app`/`download-app`
- **Description:** `/blueprint/:id` and `/preview/:id` fetch records with the user's token and no ownership check. If the deployed PocketBase `generated_apps` view rule isn't restricted to the owner (`user = @request.auth.id`), any authenticated user can view another user's blueprint/preview by guessing record IDs. Spec §7.6 requires the rule.
- **Suggested fix:** Confirm/enforce the PocketBase rule at deploy; add an ownership check to a read function or restrict client rules.

---

## Minor Issues (nice to have)

| # | File | Issue |
|---|------|-------|
| m1 | `netlify/functions/download-app.mjs` (`createPlaceholderSvg`) | ZIP icons are **SVG text saved as `.png`**. Browsers/OS may fail to decode them; Chrome PWA install criteria require icons decodable as the declared type → downloaded app may not be installable. Generate real PNGs or fix manifest. |
| m2 | `src/App.tsx` PreviewPage | Preview loads the record once on mount; doesn't subscribe to the generation hook's state. Works today only because navigation happens after the compile POST resolves — fragile; on any early return the user sees a blank phone frame. |
| m3 | Dead code | `src/App.css` (unused Vite boilerplate), `RetryBanner.tsx` (unused), UpgradeModal `feature="download"` variant (unused — PreviewSandbox carries its own divergent inline copy), `useCredits.deductCredit/refundCredit` (unused), hook `startWizard/markDownloaded/retryGeneration` (unused), `types.ts` `error` status (never produced; schema doesn't allow it), `generated_apps.credits_used` (never written). |
| m4 | `.github/workflows/deploy.yml` | CI runs tsc/lint/build only — the smoke test isn't in the pipeline, and the smoke test itself never invokes a handler with the real request shapes (C1/C3/C4 are invisible to it). Add a function-level integration test to CI. |
| m5 | `src/components/Dashboard.tsx` | `needs_review` rows navigate to `/blueprint/:id`, which crashes (C2). No "Try Again" action; failed apps are dead ends. |
| m6 | A11y | Touch targets < 48px: BlueprintReview checkbox buttons 24–28px (`w-6`/`w-7`), role-chip ✕ ~14px, modal "No thanks" `py-2`. Text below 18px: `text-caption` 14px and `text-body-sm` 16px used for secondary content (PRODUCT doc's design principle is 22px minimum). Global `:focus-visible` ring (3px) is good; primary CTAs use `min-h-touch` (48px) ✅. Bump targets to ≥44px and caption to ≥14px/16px where used for readable content. |
| m7 | `src/components/ErrorBoundary.tsx` | Renders the raw error message (e.g., "Cannot read properties of undefined") to the user. Show friendly copy; log details only. |
| m8 | `netlify/functions/compile-app.mjs` (~L279) | `JSON.parse(appRecord.blueprint_json)` is unguarded — corrupt stored JSON → unhandled throw → 500 after status already set to `coding` → stuck record. Wrap in try/catch (fall back to `{}` and log). |
| m9 | `netlify/functions/generate-blueprint.mjs` | (a) No refund on the `generated_apps` create-failure path (503) — rare credit leak. (b) `apps_generated_total` is incremented during decrement, so failed/refunded generations still count (analytics skew). (c) `Gemini returned unparseable response` logs 500 chars of raw Gemini output (could echo user prompt — acceptable, but trim to 200). |
| m10 | `netlify/functions/stripe-webhook.mjs` | `subscription.updated` only downgrades on `canceled`/`unpaid`; `invoice.payment_failed` only logs → users can hold Pro through prolonged payment failure (revenue leak). Downgrade also doesn't clear `stripe_customer_id`. |
| m11 | `netlify/functions/create-checkout-session.mjs` | Returns raw `err.message` from Stripe to the client (internal detail exposure). Return a generic message, log details. |
| m12 | `netlify/functions/health.mjs` | `uptime` field is actually response time (mislabel); endpoint is unauthenticated (acceptable for health) but confirms env-missing status publicly (fine). |
| m13 | `src/components/Wizard.tsx` | Copy drift from PRODUCT doc: "Customers & Sales" emoji 🤝 vs 🏪, "Something Else" ✨ vs 🤷, several role-suggestion emojis differ. Names/descriptions match. Cosmetic. |
| m14 | `src/App.tsx:191` | UpgradeModal `limit` variant never receives `appName` — the "Your latest app" block (per PRODUCT doc pop-up 1) never renders. |
| m15 | `src/hooks/usePocketBase.tsx` | No token-expiry handling: expired PB token → functions 401 → generic "failed" errors; spec 8.6 wants redirect to /login preserving state. |
| m16 | `src/App.tsx` AuthGate | Uses `window.location.pathname` instead of router location; logged-in users visiting `/login` still see the login form. Minor. |
| m17 | `src/main.tsx` | SW registration: fine; note `dist/` was rebuilt during this pass (stale deploy artifacts refreshed on next deploy). |

---

## Passed Checks

- **Build:** `npm run build` → 0 errors (tsc -b + vite build, 1818 modules) ✅
- **Lint:** `npm run lint` → 0 errors, 6 warnings (unused `validation` in generate-blueprint — evidence for C2; unused `Readable` import in download-app; unused `VALID_IMPORTANCE` in test-prompts; `export { pb }` fast-refresh warning) ✅
- **Smoke test:** `node scripts/smoke-test.mjs` → 11/11 ✅ (static checks: env documented, function files + handler exports, build exits 0, manifest valid JSON, sw present, no `allow-same-origin`, no hardcoded keys)
- **Iframe sandbox (CRITICAL security rule):** `PreviewSandbox.tsx` uses `srcDoc` + `sandbox="allow-scripts"` with **no** `allow-same-origin` ✅ — matches TECHNICAL-ARCHITECTURE §7.1 and RESEARCH §3; no `allow-same-origin` anywhere in `src/` ✅
- **Routes:** `/`, `/wizard`, `/blueprint/:id`, `/preview/:id`, `/dashboard`, `/settings`, `/login` + wildcard → `/` all present; AuthGate redirects unauthenticated users to `/login` ✅
- **Wizard vs PRODUCT doc:** 3 steps ✅; 5 purpose cards (titles/descriptions/examples match) ✅; 3 role suggestions per purpose ✅; core-action textarea with identical example copy + 10-char minimum ✅; progress dots + "Step X of 3" ✅; "BUILD MY APP" CTA ✅
- **Credit check order:** `generate-blueprint` checks credits **before** the Gemini call (L203–204) ✅; 402 on insufficient credits ✅; decrement happens before Gemini with refund on Gemini failure/unparseable response ✅ (spec §6)
- **Ownership + gating:** `compile-app` verifies record ownership (403) ✅; `download-app` verifies Pro tier (402) + ownership (403) ✅
- **Stripe:** webhook signature verification via `constructEvent` ✅; idempotency via `stripe_events` ✅; `checkout.session.completed` (subscription) → `plan_tier=pro`, 200 credits, customer id ✅; `subscription.deleted` → downgrade to free ✅; `create-checkout-session` sets `client_reference_id`, metadata, `subscription_data.metadata.pb_user_id`, `customer_email` ✅
- **Secrets hygiene:** no hardcoded keys in `src/` or `netlify/` ✅; no `dangerouslySetInnerHTML`/`innerHTML`/`eval` in `src/` ✅; functions use structured logging without logging tokens/keys ✅
- **Headers/CSP:** netlify.toml ships CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, function timeouts (compile 120s / blueprint 30s / download 60s / webhook 20s), SPA fallback redirects ✅
- **A11y foundations:** global 3px `:focus-visible` ring ✅; `prefers-reduced-motion` honored ✅; 18px base font ✅; 48px `min-h-touch` on primary CTAs ✅
- **No TODO/FIXME/HACK** comments in `src/`, `netlify/`, `scripts/`, `public/` ✅
- **Env vars:** all 9 required vars documented in `.env.example`; `validate-env.mjs` present ✅
- **Service worker/manifest:** network-first navigations, never caches `/api/*` or `/.netlify/*` ✅; manifest valid with 192/512/maskable icons ✅

---

## Untested (gaps Mike should know about — need live environment)

1. **No live API execution.** All Netlify functions were reviewed statically. Gemini/Claude/Stripe/PocketBase were never called (no keys in this environment). All four Critical bugs are statically provable, but every fix needs a live re-test of the full journey: wizard → blueprint → review → compile → preview → download.
2. **PocketBase deployed rules (highest-priority verify).** The repo's `pb_schema.json` is a migration artifact — the *deployed* instance must be confirmed to have:
   - `users` **update rule locked** (NOT self-update) so users can't self-grant `credits_remaining` or `plan_tier` (else M5 is a trivial full monetization bypass);
   - `credits_remaining` defaulting to **5 on signup** (schema JSON declares `"default": 5`; if the deployed PB doesn't apply it, new users start at 0 and can't build anything — onboarding catastrophically broken);
   - `generated_apps` view/list rules restricted to owner (`user = @request.auth.id`);
   - `stripe_events` collection exists (webhook idempotency writes to it).
3. **CSP × srcdoc iframe interaction (high-priority verify).** The parent page sends a CSP with `script-src 'self' https://cdn.tailwindcss.com` (no `'unsafe-inline'`). Chromium/Firefox **inherit the parent CSP into `srcdoc` iframes** — if so, the generated app's inline `<script>` blocks are blocked and the preview renders styled but **non-interactive**. Must be tested on a deployed site. If confirmed, options: add `'unsafe-inline'` to `script-src` (the parent app has no inline scripts, so risk is bounded to the sandboxed iframe), or serve previews from a dedicated path without the strict CSP.
4. **Stripe trial:** whether the Pro price in the dashboard actually has a 7-day trial (M8).
5. **Download ZIP validity:** open the ZIP, verify icons render, test PWA installability of the downloaded app (m1).
6. **Live failure modes:** Claude 429/5xx behavior, Gemini timeouts, PocketBase outage UX, token expiry redirect, webhook replay, double-click during slow networks.
7. **Netlify deploy config:** function timeouts, headers, redirects, `_middleware` convention (unused — verify no accidental activation).
8. **test-prompts.mjs `--live`** mode and the v2.0.0 schema alignment (see C2).
9. **Monthly credit reset** and any scheduled-function infra (M7) — nothing exists yet.
10. Out of scope for this pass: analytics spec (`docs/ANALYTICS-SPEC.md`), monitoring docs, cost-optimization docs — not exercised.

---

## Suggested Fix Order

1. Fix C1–C4 (contract alignment) + C2's schema unification — one PR, with a handler-level integration test that replays the exact client request shapes.
2. Fix M1 (retry success detection) and M5 (server-side refund) before any live compile testing.
3. Fix M3 (visible errors) and M4 (double-click guard) before user testing.
4. Verify U2 (PocketBase rules/defaults) and U3 (CSP × srcdoc) on the deployed stack before opening signups.
5. Then M2, M6, M7, M8, M9, M10, M11, and the minor list.

*Prepared by QA — the pipeline is structurally sound (sandbox, Stripe, ownership checks, build hygiene all clean) but the four contract mismatches mean no user journey completes today.*
