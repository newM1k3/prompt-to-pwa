# Prompt-to-PWA — Monitoring & Alerts

Last updated: 2026-08-12

## Table of Contents

1. [Health Check Endpoint](#health-check-endpoint)
2. [What to Monitor](#what-to-monitor)
3. [Monitoring Tools](#monitoring-tools)
4. [Alert Thresholds](#alert-thresholds)
5. [Dashboard (DIY)](#dashboard-diy)
6. [Incident Response](#incident-response)

---

## Health Check Endpoint

**URL:** `GET /.netlify/functions/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-12T12:00:00.000Z",
  "uptime": 42,
  "checks": {
    "pocketbase": {
      "status": "ok",
      "code": 200
    },
    "environment": {
      "total": 6,
      "configured": 6,
      "missing": [],
      "allConfigured": true
    }
  },
  "version": "1.0.0"
}
```

**Status values:**
| Status | Meaning | HTTP Code |
|--------|---------|-----------|
| `ok` | Everything nominal | 200 |
| `degraded` | One or more checks non-critical failure | 200 |
| `unhealthy` | Critical failure (PB unreachable + env incomplete) | 503 |

**Set up an uptime monitor** (e.g., UptimeRobot, Better Uptime, or Healthchecks.io) to hit this endpoint every 60 seconds. Alert if it returns non-200 or `status: "unhealthy"` for more than 2 consecutive checks.

---

## What to Monitor

### Tier 1 — Critical (Alert Immediately)

| Metric | Source | Why |
|--------|--------|-----|
| **Function error rate** | Netlify Analytics / Logs | >5% error rate means users can''t generate apps. Compile-app failures cascade to lost credits. |
| **PocketBase connectivity** | Health endpoint / PB uptime | If PB is down, the entire app is down. Users can''t log in, apps can''t be saved. |
| **Stripe webhook failures** | Stripe Dashboard → Webhooks | Failed webhooks = users not getting Pro access after paying = support tickets + chargebacks. |
| **Site down** | Uptime monitor | Self-explanatory. |

### Tier 2 — Important (Alert Within 1 Hour)

| Metric | Source | Why |
|--------|--------|-----|
| **Compile-app failure rate** | Netlify Functions logs | >20% failure rate = Claude is having issues or the prompt needs adjustment. |
| **Average response time** | Netlify Analytics | >10s avg for compile-app = users waiting too long = churn. |
| **Daily AI API cost** | Google Cloud Console / Anthropic Console | >$50/day = either an abuse spike or unusual usage pattern. |
| **Credit exhaustion rate** | PocketBase query | If >50% of users hit 0 credits within the first week, pricing may need adjustment. |
| **Stripe subscription churn** | Stripe Dashboard | >10% monthly churn = value prop isn''t working. |

### Tier 3 — Informational (Weekly Review)

| Metric | Source | Why |
|--------|--------|-----|
| **Unique daily users** | Netlify Analytics | Growth tracking. |
| **Generations per user per day** | PocketBase query | Usage patterns, power user identification. |
| **Average attempts to success** | Functions logs | Claude retry behavior — if it rises, Claude quality may be degrading. |
| **Blueprint-to-compile conversion** | PocketBase query | % of blueprints that proceed to compilation. Low = blueprint UX issue. |
| **Pro conversion rate** | Stripe Dashboard | Free → Pro conversion. Target: >3%. |
| **Cost per generation (actual)** | API billing + function count | Compare to estimated $0.045 average. |
| **Average credit utilization** | PocketBase query | Are free users using all 5? Are Pro users hitting 200? |

---

## Monitoring Tools

### Netlify Analytics (Built-in)

**What it gives you:**
- Page views, unique visitors
- Top pages, referrers
- Function invocation counts
- Function error rates
- Bandwidth usage

**Setup:** Enable in Netlify Dashboard → Analytics (free on Pro plan, $9/mo on Starter).

### Netlify Log Drains

Send function logs to an external service for search and alerting:

```bash
# Available log drain destinations:
# - Datadog
# - LogDNA / Mezmo
# - New Relic
# - Custom HTTP endpoint

# Set up via Netlify CLI:
netlify logs:drain:create \
  --provider datadog \
  --api-key YOUR_DD_API_KEY
```

### Sentry — Error Tracking (Recommended)

**Setup (frontend):**
```bash
npm install @sentry/react
```

```ts
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.PROD ? "production" : "development",
  tracesSampleRate: 0.1,        // 10% of traces
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
});
```

**Setup (Netlify Functions):**
```bash
npm install @sentry/node
```

```js
// In each Netlify function:
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
});
```

### Stripe Dashboard

Monitor at [dashboard.stripe.com](https://dashboard.stripe.com):

- **Webhooks**: Check for failed deliveries in Developers → Webhooks
- **Revenue**: Dashboard → Analytics
- **Subscriptions**: Dashboard → Billing → Subscriptions
- **Churn**: Dashboard → Analytics → Subscription churn

### Google Cloud Console + Anthropic Console

- **Gemini usage/cost**: [console.cloud.google.com](https://console.cloud.google.com) → APIs → Gemini API
- **Claude usage/cost**: [console.anthropic.com](https://console.anthropic.com) → Usage
- Set up budget alerts in both to notify when approaching limits

### Uptime Monitoring

**Free tier options:**
- [UptimeRobot](https://uptimerobot.com) — 50 monitors, 5-min checks (free)
- [Better Uptime](https://betterstack.com/better-uptime) — 10 monitors, 3-min checks (free)
- [Healthchecks.io](https://healthchecks.io) — cron job monitoring (free)

**Configure monitors for:**
1. `https://your-app.netlify.app` — home page (expects HTTP 200)
2. `https://your-app.netlify.app/.netlify/functions/health` — health endpoint (expects `status: "ok"`)
3. `https://pb.yourdomain.com/api/health` — PocketBase health (expects HTTP 200)

---

## Alert Thresholds

### Critical Alerts (Pager-worthy)

| Condition | Threshold | Check Interval | Channel |
|-----------|-----------|---------------|---------|
| Site returns non-200 | 2 consecutive failures | 1 min | Email + Slack/Discord |
| Health endpoint `unhealthy` | 2 consecutive | 1 min | Email + Slack/Discord |
| Function error rate > 5% | Rolling 5-min window | 5 min | Slack/Discord |
| Stripe webhook failure rate > 10% | Rolling 1-hour window | 15 min | Email (Stripe retries are automatic) |
| Daily AI cost > $100 | Daily | 1 day | Email |
| PocketBase unreachable > 5 min | Consecutive | 1 min | Email + Slack/Discord |

### Warning Alerts (Review Soon)

| Condition | Threshold | Check Interval | Channel |
|-----------|-----------|---------------|---------|
| Daily AI cost > $50 | Daily | 1 day | Slack/Discord |
| Compile-app failure rate > 20% | Rolling 1-hour window | 1 hour | Slack/Discord |
| Avg response time > 10s | Rolling 15-min window | 15 min | Slack/Discord |
| Credit exhaustion > 50% of active users | Daily | 1 day | Slack/Discord |
| Pro churn rate > 10% monthly | Monthly | 1 month | Slack/Discord |

---

## Dashboard (DIY)

### Netlify Functions Dashboard

A quick dashboard using Netlify''s function metrics. Access at:
`https://app.netlify.com/sites/YOUR_SITE/functions`

### Weekly Health Report (Script)

```bash
#!/bin/bash
# scripts/weekly-health.sh
# Run via cron: 0 9 * * MON /path/to/weekly-health.sh

echo "=== Prompt-to-PWA Weekly Health Report ==="
echo "Week of: $(date +%Y-%m-%d)"
echo ""

# Check PocketBase
PB_HEALTH=$(curl -s https://pb.yourdomain.com/api/health)
echo "PocketBase: $(echo $PB_HEALTH | jq -r ''.code'')"

# Check site
SITE_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://your-app.netlify.app)
echo "Site Status: HTTP $SITE_CODE"

# Check function health
HEALTH=$(curl -s https://your-app.netlify.app/.netlify/functions/health)
echo "Health Endpoint: $(echo $HEALTH | jq -r ''.status'')"

# Stripe webhook status (check last 24h)
echo ""
echo "Stripe Webhooks (last 24h):"
echo "Check: https://dashboard.stripe.com/webhooks"
```

---

## Incident Response

### Severity 1 — Site Down / PB Down

1. **Check Netlify**: [netlifystatus.com](https://www.netlifystatus.com)
2. **Check PocketBase**: SSH into VPS, `sudo systemctl status pocketbase`
3. **Check logs**: `journalctl -u pocketbase -n 100`
4. **Restart if needed**: `sudo systemctl restart pocketbase`
5. **If VPS issue**: Check provider status (DigitalOcean, Hetzner, etc.)
6. **Communicate**: Post status update via your status page or social media

### Severity 2 — AI API Degradation

1. **Check API status**:
   - Gemini: [Google Cloud Status](https://status.cloud.google.com)
   - Claude: [Anthropic Status](https://status.anthropic.com)
2. **Check API keys**: Verify in Netlify env vars
3. **Check rate limits**: Review function logs for 429 responses
4. **Fallback**: If Gemini is down, generate-blueprint will return 502 (retryable). If Claude is down, compile-app will exhaust all retries.

### Severity 3 — Stripe Webhook Failures

1. **Check Stripe Dashboard**: Webhook deliveries
2. **Manual sync**: If events were missed, manually update affected users
3. **Replay events**: Use Stripe Dashboard → Webhooks → Resend

### Escalation Contacts

| Role | Contact | When |
|------|---------|------|
| Developer | [Your contact] | Any Sev-1, any Sev-2 lasting >1 hour |
| Business owner | [Your contact] | Stripe issues, churn alerts |

---

## Quick Reference — Useful Queries

### PocketBase Admin Queries

```javascript
// Users with 0 credits (at risk of churn)
// In PocketBase admin → Collections → users → Filter:
credits_remaining = 0

// Apps stuck in "coding" status (compile might have silently failed)
// In generated_apps:
status = "coding" && created < @now - 600  // older than 10 min

// Most active users this week
// Sort by apps_generated_total descending

// Daily generation count
// Filter by created > @now - 86400 (last 24 hours)
```

### Stripe Queries

```bash
# List recent failed webhook deliveries
# Stripe Dashboard → Developers → Webhooks → Your endpoint → Filter: Failed

# List recent subscriptions
# Stripe Dashboard → Billing → Subscriptions

# Revenue this month
# Stripe Dashboard → Analytics → This month
```
