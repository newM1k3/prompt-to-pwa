# Prompt-to-PWA — Security Audit

Last audited: 2026-08-12
Auditor: DevOps

## Table of Contents

1. [Iframe Sandbox Audit](#1-iframe-sandbox-audit)
2. [API Key Exposure Audit](#2-api-key-exposure-audit)
3. [CORS Configuration Audit](#3-cors-configuration-audit)
4. [PocketBase Access Rules Audit](#4-pocketbase-access-rules-audit)
5. [CSP Header Audit](#5-csp-header-audit)
6. [Stripe Webhook Security](#6-stripe-webhook-security)
7. [API Key Rotation Procedure](#7-api-key-rotation-procedure)
8. [Security Checklist (Pre-Launch)](#8-security-checklist-pre-launch)

---

## 1. Iframe Sandbox Audit

### Critical Finding: Configurations to NEVER Use

The following sandbox attribute combinations are **SECURITY VIOLATIONS**. If any of these are found in the codebase, they must be removed immediately:

**KILL SWITCH — NEVER ADD `allow-same-origin`:**
```html
<!-- ❌ CRITICAL VIOLATION — attacker can steal PocketBase tokens -->
<iframe srcdoc={html} sandbox="allow-scripts allow-same-origin" />

<!-- ❌ CRITICAL VIOLATION — attacker can steal parent localStorage -->
<iframe srcdoc={html} sandbox="allow-scripts allow-same-origin allow-forms" />
```

**Why `allow-same-origin` is dangerous:**
- Without it: iframe origin is `null`, cannot access parent''s cookies, localStorage, DOM
- With it: iframe origin matches parent (e.g., `https://yourapp.netlify.app`), can access parent''s PocketBase auth token from localStorage, can make authenticated API calls as the user

**SECONDARY VIOLATIONS — NEVER add these either:**
- `allow-top-navigation` — attacker can redirect parent to phishing page
- `allow-forms` — attacker can POST data to external servers (limited by CSP, but defense in depth)
- `allow-popups` — attacker can open popups for phishing
- `allow-popups-to-escape-sandbox` — allows popups to break out of sandbox restrictions

### Current Implementation Audit

**Source file:** `src/components/PreviewSandbox.tsx`

```bash
# Find all sandbox attributes in the codebase
grep -rn "sandbox" src/ netlify/
```

**Checklist:**
- [ ] Search for `allow-same-origin` — must return ZERO results
- [ ] Search for `allow-top-navigation` — must return ZERO results
- [ ] Search for `allow-forms` — must return ZERO results
- [ ] Search for `allow-popups` — must return ZERO results
- [ ] Search for `allow-popups-to-escape-sandbox` — must return ZERO results
- [ ] Verify `sandbox="allow-scripts"` is the EXACT attribute (no additional permissions)

**Risk accepted (documented):**
- `allow-scripts` permits `eval()` and `new Function()` inside the iframe
- AI-generated code could contain cryptominers (CPU-bound, stops when tab closes)
- AI-generated code could crash the browser tab (infinite loops — user closes tab)
- **Mitigation:** These are bounded risks within the sandbox. Cannot affect parent or exfiltrate data.

### Defense-in-Depth Recommendations

**v0.2 — Client-side sanitization:**
```ts
function sanitizeGeneratedHTML(html: string): string {
  return html
    .replace(/eval\s*\(/gi, ''/* eval blocked */ ('')
    .replace(/new\s+Function\s*\(/gi, ''/* Function blocked */ ('')
    .replace(/WebAssembly\.instantiate\s*\(/gi, ''/* WASM blocked */ ('')
    .replace(/setTimeout\s*\(\s*[''\"`]/gi, ''/* string timeout blocked */ setTimeout(0');
}
```

**v0.2 — CSP for iframes:**
Add `Content-Security-Policy: sandbox allow-scripts;` as a meta tag inside the generated HTML to apply an additional layer of restrictions within the iframe itself.

---

## 2. API Key Exposure Audit

### Codebase Scan

Run these commands and verify ZERO matches for any real API key patterns:

```bash
# Search for hardcoded API keys (Gemini, Anthropic, Stripe)
grep -rn "AIza" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"
grep -rn "sk-ant" src/ netlify/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"
grep -rn "sk_live_" src/ netlify/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"
grep -rn "sk_test_" src/ netlify/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"
grep -rn "whsec_" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs"

# Search for common hardcoded patterns
grep -rn "api_key\|apikey\|api-key\|secret\|password" src/ netlify/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" | grep -v "process.env" | grep -v "import.meta.env" | grep -v "// "
```

### Key Storage Matrix

| Key | Client Access | Server Access | Storage Location |
|-----|--------------|---------------|-----------------|
| `GEMINI_API_KEY` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `ANTHROPIC_API_KEY` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `STRIPE_SECRET_KEY` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `STRIPE_WEBHOOK_SECRET` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `POCKETBASE_ADMIN_EMAIL` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `POCKETBASE_ADMIN_PASSWORD` | ❌ Never | ✅ `process.env` | Netlify env vars |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ Safe (public) | N/A | `VITE_` prefix in env |
| `VITE_POCKETBASE_URL` | ✅ Safe (URL only) | N/A | `VITE_` prefix in env |

### Findings

**Netlify Functions — Correct pattern used:**
```js
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
```

All functions use `process.env.*` — no hardcoded keys in function code.

**Error Responses — Safe pattern verified:**
- 500 errors return generic messages, never raw errors with potential key leakage
- All `safeErrorResponse()` calls strip stack traces for 5xx responses

**Vite Build — VITE_ prefix only:**
- ✅ `VITE_POCKETBASE_URL` — safe (it''s a URL)
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` — safe (it''s public)
- ❌ No server-only keys use VITE_ prefix
- ❌ No AI API keys have VITE_ prefix

### Git History Check

```bash
# Ensure no keys were ever committed
git log -p | grep -E "(AIza|sk-ant|sk_live_|whsec_)"
# MUST return empty
```

⚠️ If keys were ever committed: [Rotate them immediately](#7-api-key-rotation-procedure) and use `git filter-branch` or `BFG Repo-Cleaner` to purge from history.

---

## 3. CORS Configuration Audit

### Current Configuration

**netlify.toml global headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

**Per-function OPTIONS handlers (in each .mjs):**
```js
headers: {
  ''Access-Control-Allow-Origin'': ''*'',
  ''Access-Control-Allow-Headers'': ''Content-Type, Authorization'',
  ''Access-Control-Allow-Methods'': ''POST, OPTIONS'',
}
```

### Assessment

- ⚠️ `Access-Control-Allow-Origin: *` — Acceptable for this application since:
  1. Authentication is via Bearer tokens (not cookies), so there''s no CSRF risk
  2. All write operations require a valid PocketBase session token
  3. The app has no session cookies that could be exploited
- ✅ `Authorization` header is explicitly allowed
- ✅ OPTIONS preflight is handled correctly
- ✅ `Access-Control-Max-Age: 86400` reduces preflight requests

### Recommendation

If the app scales or handles sensitive operations, restrict to the specific Netlify domain:
```
Access-Control-Allow-Origin: https://your-app.netlify.app
```

---

## 4. PocketBase Access Rules Audit

### Required Rules for `generated_apps` Collection

Must be set in PocketBase admin UI → Collections → generated_apps → API Rules:

| Rule | Expression | Rationale |
|------|-----------|-----------|
| List/Search | `user = @request.auth.id` | Users can only see their own apps |
| View | `user = @request.auth.id` | Users can only view their own apps |
| Create | `@request.auth.id != ""` | Any authenticated user can create |
| Update | `user = @request.auth.id` | Users can only update their own apps |
| Delete | `user = @request.auth.id` | Users can only delete their own apps |
| Manage | *(leave blank — admin only)* | Only admins can manage collection schema |

### Required Rules for `stripe_events` Collection

| Rule | Expression | Rationale |
|------|-----------|-----------|
| List/Search | *(leave blank — admin only)* | Stripe event IDs should not be enumerable |
| View | *(leave blank — admin only)* | Sensitive billing metadata |
| Create | *(leave blank — admin only)* | Only the webhook function creates records |
| Update | *(leave blank — admin only)* | Immutable log |
| Delete | *(leave blank — admin only)* | Immutable log |

### Verify Rules Programmatically

```bash
# Test: unauthenticated user should NOT see generated_apps
curl -s https://pb.yourdomain.com/api/collections/generated_apps/records | jq ''.totalItems''
# Expected: 0

# Test: user A cannot see user B''s apps
# (Requires two user tokens to test properly — verify in PocketBase admin)
```

---

## 5. CSP Header Audit

### Current CSP in netlify.toml

```
default-src ''self'';
script-src ''self'' https://cdn.tailwindcss.com;
style-src ''self'' ''unsafe-inline'' https://cdn.tailwindcss.com;
img-src ''self'' data: blob:;
connect-src ''self'' https://*.pockethost.io wss://*.pockethost.io https://*.fly.dev;
frame-src ''none'';
object-src ''none'';
base-uri ''self'';
form-action ''self'';
font-src ''self'' data:;
```

### Assessment

| Directive | Value | Assessment |
|-----------|-------|------------|
| `default-src` | `''self''` | ✅ Strict baseline — blocks everything not explicitly allowed |
| `script-src` | `''self'' https://cdn.tailwindcss.com` | ✅ Parent uses bundled scripts; Tailwind CDN needed for iframe srcdoc |
| `style-src` | `''self'' ''unsafe-inline'' https://cdn.tailwindcss.com` | ⚠️ `unsafe-inline` is required for Tailwind utility classes in generated apps (iframe srcdoc) |
| `img-src` | `''self'' data: blob:` | ✅ Allows local assets, inline data URIs, and blob objects |
| `connect-src` | `''self'' https://*.pockethost.io wss://*.pockethost.io https://*.fly.dev` | ✅ Client only connects to PocketBase. AI APIs called from Netlify Functions, not client |
| `frame-src` | `''none''` | ✅ No external frames allowed. Previews use srcdoc, not src |
| `object-src` | `''none''` | ✅ Blocks Flash, Java, and other plugins |
| `base-uri` | `''self''` | ✅ Prevents base tag injection |
| `form-action` | `''self''` | ✅ Prevents form submission to external sites |
| `font-src` | `''self'' data:` | ✅ Allows bundled fonts and inline data URIs |

### Netlify-Generated Headers to Monitor

Netlify may inject additional headers. Verify with:
```bash
curl -I https://your-app.netlify.app | grep -iE "(content-security|x-frame|x-content|referrer|permissions)"
```

Expected:
```
content-security-policy: default-src ''self''; script-src ''self'' https://cdn.tailwindcss.com; ...
x-frame-options: DENY
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=(), ...
```

---

## 6. Stripe Webhook Security

### Validated in stripe-webhook.mjs

- ✅ Webhook signature verification via `stripe.webhooks.constructEvent()`
- ✅ Idempotency check — `stripe_events` collection prevents duplicate processing
- ✅ `client_reference_id` used to match Stripe sessions to PocketBase users
- ✅ Subscription downgrade on cancel/unpaid/deleted
- ✅ Error logging without key exposure

### Stripe Dashboard Configuration

- [ ] Webhook endpoint URL: `https://your-app.netlify.app/api/stripe-webhook`
- [ ] Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] API version: Latest (or pinned to a specific version if preferred)
- [ ] Verify webhook secret matches between Stripe Dashboard and `STRIPE_WEBHOOK_SECRET` env var

---

## 7. API Key Rotation Procedure

### When to Rotate

- **Immediately**: Any key was accidentally committed to git or exposed in logs
- **Quarterly**: As a proactive security measure
- **On employee departure**: Anyone who had access to production keys leaves

### Gemini API Key Rotation

```bash
# 1. Generate new key
# Go to https://aistudio.google.com/apikey → Create API Key

# 2. Update in Netlify
# Dashboard → Site settings → Environment variables → GEMINI_API_KEY → Update

# 3. Verify the new key works
curl -X POST https://your-app.netlify.app/api/generate-blueprint \
  -H "Content-Type: application/json" \
  -d ''{"prompt": "test"}''

# 4. Delete old key
# Go to https://console.cloud.google.com/apis/credentials → Delete old key

# 5. Trigger a new deploy (to pick up env var change on edge)
netlify deploy --prod
```

### Anthropic API Key Rotation

```bash
# 1. Generate new key
# Go to https://console.anthropic.com/settings/keys → Create Key

# 2. Update in Netlify
# ANTHROPIC_API_KEY → Update

# 3. Verify
curl -X POST https://your-app.netlify.app/api/compile-app \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d ''{"jobId": "test_id"}''

# 4. Delete old key from Anthropic console
```

### Stripe Key Rotation

```bash
# 1. Generate new keys
# Go to https://dashboard.stripe.com/apikeys → Roll key

# 2. Update ALL three in Netlify:
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET (must match what you set in Stripe Dashboard → Webhooks)
# VITE_STRIPE_PUBLISHABLE_KEY

# 3. Update webhook secret in Stripe Dashboard
# Developers → Webhooks → Your endpoint → Reveal signing secret → Update

# 4. Verify webhooks still work
# Stripe Dashboard → Webhooks → Send test webhook

# 5. Trigger deploy
netlify deploy --prod
```

### PocketBase Admin Password Rotation

```bash
# 1. Login to PocketBase admin UI: https://pb.yourdomain.com/_/

# 2. Go to Settings → Admins → Your admin → Change password

# 3. Update POCKETBASE_ADMIN_PASSWORD in Netlify env vars

# 4. Trigger deploy (all functions use admin auth for writes)
netlify deploy --prod
```

---

## 8. Security Checklist (Pre-Launch)

### Infrastructure

- [ ] PocketBase CORS allows ONLY the Netlify domain (not `*`)
- [ ] PocketBase collection access rules set for generated_apps (user-scoped)
- [ ] PocketBase collection access rules set for stripe_events (admin-only)
- [ ] Netlify env vars set for ALL required values
- [ ] Stripe webhook endpoint configured and tested
- [ ] Stripe webhook secret matches between Netlify and Stripe Dashboard
- [ ] Custom domain has SSL (auto via Netlify)
- [ ] PocketBase has SSL (via Let''s Encrypt or pockethost.io)

### Code

- [ ] `allow-same-origin` does NOT appear anywhere in the codebase
- [ ] No hardcoded API keys in source code (verified via `grep`)
- [ ] No server-only env vars prefixed with `VITE_`
- [ ] `netlify.toml` CSP headers are restrictive and correct
- [ ] `netlify.toml` security headers present (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] Function timeouts configured (compile-app=120s)
- [ ] Error responses do not leak stack traces or API keys
- [ ] Rate limiting is enforced on generate-blueprint and compile-app
- [ ] Health check endpoint returns correct status

### Configuration

- [ ] `.gitignore` includes `.env` (not just `.env.example`)
- [ ] `.env.example` has ALL required variables listed (no undocumented env vars)
- [ ] GitHub Actions secrets configured (NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID)
- [ ] CI/CD pipeline validates environment variables before deploy
- [ ] Stripe is in live mode (not test mode)
- [ ] Stripe price IDs are from live mode

### Operational

- [ ] Uptime monitoring configured (UptimeRobot, Better Uptime, etc.)
- [ ] Daily backup of PocketBase configured
- [ ] Alert thresholds configured (error rate, cost, churn)
- [ ] API key rotation procedure documented and tested
- [ ] Incident response contacts identified
- [ ] Tested full user flow: register → login → generate blueprint → compile → preview
- [ ] Tested Stripe flow: upgrade to Pro → check credits → download ZIP → webhook fires correctly
- [ ] Tested on mobile (responsive design verified)

### Post-Launch Verification

```bash
# 1. Homepage loads
curl -s -o /dev/null -w "%{http_code}" https://your-app.netlify.app
# Expected: 200

# 2. Health check passes
curl -s https://your-app.netlify.app/.netlify/functions/health | jq ''.status''
# Expected: "ok"

# 3. CSP header present
curl -I https://your-app.netlify.app 2>/dev/null | grep -i content-security-policy
# Must not be empty

# 4. Security headers present
curl -I https://your-app.netlify.app 2>/dev/null | grep -iE "x-frame|x-content|referrer-policy|permissions-policy"
# All must be present

# 5. Functions accessible
curl -s -X POST https://your-app.netlify.app/api/generate-blueprint | jq ''.error''
# Expected: "unauthorized" (no auth header)
```

---

*End of Security Audit. All items must be verified before production launch.*
