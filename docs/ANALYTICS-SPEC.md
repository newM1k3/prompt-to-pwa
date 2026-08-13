# Admin Analytics Dashboard Specification

**Project:** Prompt-to-PWA Toolkit  
**Date:** 2026-08-12  
**Author:** AI Data (Analytics & Prompt Engineering)  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Metrics to Track](#1-metrics-to-track)
2. [PocketBase Queries for Each Metric](#2-pocketbase-queries-for-each-metric)
3. [Admin Dashboard Layout](#3-admin-dashboard-layout)
4. [Data Export for Business Reviews](#4-data-export-for-business-reviews)
5. [Alerting Thresholds](#5-alerting-thresholds)

---

## 1. Metrics to Track

### Daily Metrics (Updated Every 15 Min)

| # | Metric | Why It Matters | Data Source | Target |
|---|--------|---------------|-------------|--------|
| 1 | **Daily Active Users (DAU)** | Growth indicator. Flat/down = churn risk. | `users` collection (filter by last login) | +10% week-over-week |
| 2 | **New user signups** | Top of funnel health | `users` collection (created today) | > 20/day |
| 3 | **Apps generated today** | Core product usage | `generated_apps` (created today) | > 50/day |
| 4 | **Success rate** | Quality metric. High failure = user churn | `generated_apps` status=ready / total | > 85% |
| 5 | **Average compile time** | Performance UX. > 60s = user leaves | `generated_apps` compile_duration_ms | < 45s |
| 6 | **Total AI cost today** | Burn rate monitoring | Sum of `total_cost_estimate` | < $3/day at startup |
| 7 | **Failed generations (needs_review)** | Prompt quality signal | `generated_apps` status=needs_review | < 10% |
| 8 | **Pro conversion rate** | Business health | `users` plan_tier=pro / total | > 5% |

### Weekly Metrics

| # | Metric | PocketBase Query |
|---|--------|-----------------|
| 1 | Apps per category (inventory/staff/customers/scheduling/other) | Group by `prompt_category` |
| 2 | Blueprint confidence distribution | Average and histogram of `blueprint_confidence` |
| 3 | Compile attempts distribution | Average `compile_attempts`, histogram |
| 4 | User retention (W1 → W2 active) | Users active this week / users active last week |
| 5 | Credit consumption rate | Sum of credits_used per day, grouped |

### Monthly Metrics

| # | Metric | Purpose |
|---|--------|---------|
| 1 | Monthly Recurring Revenue (MRR) | Stripe webhook data |
| 2 | Customer Acquisition Cost (CAC) | Marketing spend / new Pro users |
| 3 | Lifetime Value (LTV) | Average Pro subscription duration × $29 |
| 4 | Churn rate | Pro cancellations / total Pro users |
| 5 | Top 10 most popular app categories | For "Data Mine" strategy |

---

## 2. PocketBase Queries for Each Metric

All queries use PocketBase filter syntax (`filter` parameter) and assume the analytics fields from `pb_schema_analytics.json` have been applied.

### 2.1 Daily Active Users

```javascript
// PocketBase filter: users who logged in today
const dau = await pb.collection('users').getList(1, 1, {
  filter: `updated >= @todayStart`,
  // Requires PocketBase to support date comparison
  // Fallback: use JavaScript date filtering
});

// JavaScript fallback
const today = new Date();
today.setHours(0, 0, 0, 0);
const dau = users.filter(u => new Date(u.updated) >= today).length;
```

**PocketBase filter (native, if datetime comparison works):**
```
updated >= "2026-08-12 00:00:00.000Z"
```

### 2.2 New Signups Today

```
// Exact PocketBase filter:
created >= @todayStart

// With explicit date:
created >= "2026-08-12 00:00:00.000Z"
```

### 2.3 Apps Generated Today

```
created >= "2026-08-12 00:00:00.000Z"
```

### 2.4 Success Rate

```javascript
// Two-query approach (PocketBase doesn't support aggregate ratios natively)
const total = await pb.collection('generated_apps').getList(1, 1, {
  filter: `created >= "2026-08-12 00:00:00.000Z"`,
});
const success = await pb.collection('generated_apps').getList(1, 1, {
  filter: `created >= "2026-08-12 00:00:00.000Z" && status = "ready"`,
});
const rate = success.totalItems / total.totalItems;
```

### 2.5 Average Compile Time

```javascript
// Fetch all today's records and compute average in JS
const records = await pb.collection('generated_apps').getList(1, 100, {
  filter: `created >= "2026-08-12 00:00:00.000Z" && compile_duration_ms > 0`,
});
const avgTime = records.items.reduce((sum, r) => sum + r.compile_duration_ms, 0) / records.items.length;
```

### 2.6 Total AI Cost Today

```javascript
const records = await pb.collection('generated_apps').getList(1, 100, {
  filter: `created >= "2026-08-12 00:00:00.000Z"`,
});
const totalCost = records.items.reduce((sum, r) => sum + (r.total_cost_estimate || 0), 0);
```

### 2.7 Failed Generations (needs_review)

```
status = "needs_review"
```

### 2.8 Pro Conversion Rate

```javascript
const total = await pb.collection('users').getList(1, 1);
const pro = await pb.collection('users').getList(1, 1, {
  filter: `plan_tier = "pro"`,
});
const rate = pro.totalItems / total.totalItems;
```

### 2.9 Apps Per Category (Grouped)

```javascript
// Fetch all and group in JS
const all = await pb.collection('generated_apps').getList(1, 500, {
  filter: `created >= "2026-08-05 00:00:00.000Z"`,
});

const byCategory = {};
all.items.forEach(app => {
  const cat = app.prompt_category || 'unknown';
  byCategory[cat] = (byCategory[cat] || 0) + 1;
});
// Result: { inventory: 45, staff: 30, customers: 55, scheduling: 20, other: 10 }
```

### 2.10 Blueprint Confidence Distribution

```javascript
const all = await pb.collection('generated_apps').getList(1, 500, {
  filter: `created >= "2026-08-05 00:00:00.000Z" && blueprint_confidence > 0`,
});

const distribution = { high: 0, medium: 0, low: 0, fallback: 0 };
all.items.forEach(app => {
  const c = app.blueprint_confidence || 0;
  if (c === 0) distribution.fallback++;
  else if (c < 0.5) distribution.low++;
  else if (c < 0.8) distribution.medium++;
  else distribution.high++;
});
```

### 2.11 Weekly Active Users (Retention)

```javascript
// Users active this week
const thisWeek = await pb.collection('users').getList(1, 1, {
  filter: `updated >= "2026-08-05 00:00:00.000Z"`,
});

// Users active last week
const lastWeek = await pb.collection('users').getList(1, 1, {
  filter: `updated >= "2026-07-29 00:00:00.000Z" && updated < "2026-08-05 00:00:00.000Z"`,
});

const retention = lastWeek.totalItems > 0
  ? thisWeek.totalItems / lastWeek.totalItems
  : 0;
```

### 2.12 Top 10 Popular App Categories

```javascript
const all = await pb.collection('generated_apps').getList(1, 1000, {
  sort: '-created',
});

const categoryCount = {};
all.items.forEach(app => {
  const cat = app.prompt_category || 'other';
  categoryCount[cat] = (categoryCount[cat] || 0) + 1;
});

const top10 = Object.entries(categoryCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
```

---

## 3. Admin Dashboard Layout

### Page Structure

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                            Last updated: 2m ago │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ DAU     │ │ New     │ │ Apps    │ │ Success │           │
│  │  142    │ │ Signups │ │ Today   │ │  Rate   │           │
│  │  ↑12%   │ │   8     │ │   34    │ │  87%    │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ┌────────────────────────┐ ┌────────────────────────┐      │
│  │ Apps Generated (7-day) │ │ Apps by Category (pie) │      │
│  │  ▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄    │ │  Inventory   35%      │      │
│  │  ▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄    │ │  Customers   28%      │      │
│  │  ▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄    │ │  Staff       18%      │      │
│  │  M T W T F S S         │ │  Scheduling  12%      │      │
│  │                        │ │  Other        7%      │      │
│  └────────────────────────┘ └────────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Compile Performance (7-day)                          │    │
│  │ Avg compile time: 38s  │ 1st attempt: 72%            │    │
│  │ Max compile time: 112s  │ 2nd attempt: 22%           │    │
│  │                         │ 3rd attempt:  6%           │    │
│  │ [==========bar chart: time per day============]      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────┐      │
│  │ AI Cost (7-day)      │ │ Blueprint Confidence     │      │
│  │ Today: $1.72         │ │ High (>0.8):  65%        │      │
│  │ This week: $12.40    │ │ Medium (0.5-0.8): 28%    │      │
│  │ This month: $52.30   │ │ Low (<0.5):     5%       │      │
│  │                      │ │ Fallback (0.0):  2%      │      │
│  │ [bar chart per day]  │ │                           │      │
│  └──────────────────────┘ └──────────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Recent Generations (live feed)            [Export CSV]│    │
│  │ Time     User        App Name       Status   Cost   │    │
│  │ 14:32   frank@...   OrderTrack     ready    $0.05  │    │
│  │ 14:28   sarah@...   CrewScheduler  coding   —      │    │
│  │ 14:25   bob@...     StockAlert     needs_   $0.18  │    │
│  │ ...                                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ User Metrics                          [Time: 7d ▼]   │    │
│  │ Total users: 847   │ Pro users: 53 (6.3%)            │    │
│  │ Avg credits used:  │ Avg apps/user: 4.2              │    │
│  │ [line chart: new users per day]                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Chart Specifications

| Chart | Type | Time Range | Refresh Rate |
|-------|------|-----------|-------------|
| DAU/New users/Success rate | Stat cards (big number + delta) | Today vs. yesterday | 5 min |
| Apps generated | Bar chart (daily for 7 days) | 7 days | 15 min |
| Apps by category | Donut/pie chart | 30 days | 1 hour |
| Compile time | Bar chart (daily avg for 7 days) | 7 days | 15 min |
| AI cost | Bar chart (daily for 7 days) + running total | 7 days | 15 min |
| Blueprint confidence | Stacked bar (high/medium/low %) | 7 days | 15 min |
| User growth | Line chart (cumulative + new per day) | 30 days | 1 hour |
| Recent generations | Table (last 50) | Live | 30 seconds |

### Technical Implementation

Use Chart.js (already in the project) for all charts:

```javascript
// Example: Daily apps generated chart
import { Chart } from 'chart.js/auto';

const dailyAppsData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{
    label: 'Apps Generated',
    data: [28, 34, 42, 31, 45, 22, 30],
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  }],
};

new Chart(ctx, {
  type: 'bar',
  data: dailyAppsData,
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 10 } },
    },
  },
});
```

---

## 4. Data Export for Business Reviews

### Monthly Business Review Export

```javascript
// scripts/export-monthly-review.mjs
async function exportMonthlyReview(pb, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // 1. Fetch all apps for the month
  const apps = await pb.collection('generated_apps').getList(1, 5000, {
    filter: `created >= "${startDate}" && created < "${endDate}"`,
    sort: 'created',
  });

  // 2. Compute metrics
  const totalApps = apps.totalItems;
  const successApps = apps.items.filter(a => a.status === 'ready').length;
  const failedApps = apps.items.filter(a => a.status === 'needs_review').length;
  const totalCost = apps.items.reduce((sum, a) => sum + (a.total_cost_estimate || 0), 0);
  const avgConfidence = apps.items
    .filter(a => a.blueprint_confidence > 0)
    .reduce((sum, a) => sum + a.blueprint_confidence, 0) / totalApps;

  // 3. Category breakdown
  const categories = {};
  apps.items.forEach(a => {
    const cat = a.prompt_category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // 4. User stats
  const users = await pb.collection('users').getList(1, 5000, {
    filter: `created < "${endDate}"`,
  });
  const newUsers = users.items.filter(u => u.created >= startDate).length;
  const proUsers = users.items.filter(u => u.plan_tier === 'pro').length;

  // 5. Output CSV
  const csv = [
    'Monthly Business Review',
    `Period: ${startDate} to ${endDate}`,
    '',
    'METRICS',
    `Total Apps Generated,${totalApps}`,
    `Success Rate,${((successApps / totalApps) * 100).toFixed(1)}%`,
    `Failed/Needs Review,${failedApps} (${((failedApps / totalApps) * 100).toFixed(1)}%)`,
    `Total AI Cost,$${totalCost.toFixed(2)}`,
    `Average Cost per App,$${(totalCost / totalApps).toFixed(4)}`,
    `Average Blueprint Confidence,${(avgConfidence * 100).toFixed(1)}%`,
    '',
    'USERS',
    `Total Users,${users.totalItems}`,
    `New Users This Month,${newUsers}`,
    `Pro Users,${proUsers} (${((proUsers / users.totalItems) * 100).toFixed(1)}%)`,
    '',
    'CATEGORIES',
    ...Object.entries(categories).map(([cat, count]) =>
      `${cat},${count} (${((count / totalApps) * 100).toFixed(1)}%)`
    ),
  ].join('\n');

  return csv;
}
```

### Export Formats

| Format | Use Case | Implementation |
|--------|----------|---------------|
| **CSV** | Spreadsheet analysis, pivot tables | `export-monthly-review.mjs` (above) |
| **JSON** | API consumption, programmatic analysis | Direct PocketBase API response |
| **PDF Report** | Stakeholder presentation | Use `pdf` skill to generate formatted report |

### Scheduled Export (Netlify Scheduled Function)

```toml
# netlify.toml
[functions."export-monthly-stats"]
schedule = "0 9 1 * *"  # 9 AM on the 1st of every month
```

---

## 5. Alerting Thresholds

### Real-Time Alerts (via Netlify Function Logs → monitoring service)

| Alert | Condition | Severity | Action |
|-------|----------|----------|--------|
| High failure rate | `needs_review / total > 25%` in last hour | 🔴 Critical | Investigate Claude/Gemini API status. Check prompt quality. |
| Cost spike | Daily cost > 2× 7-day average | 🟡 Warning | Review recent generations for abuse pattern. |
| Zero generations | No apps generated in last 2 hours | 🟡 Warning | Check API keys, function status. |
| Long compile times | Avg > 90s in last hour | 🟡 Warning | Check Claude API latency, token caps. |
| Low blueprint confidence | Median < 0.5 in last 24h | 🟡 Warning | Review recent prompts for vague inputs. |
| Pro churn spike | > 3 cancellations in 24h | 🔴 Critical | Investigate product issues, review Stripe dashboard. |

### Alert Implementation (v0.1)

```javascript
// Add to a daily cron Netlify function
async function checkAlertThresholds(pb) {
  const alerts = [];

  // Check failure rate
  const recent = await pb.collection('generated_apps').getList(1, 100, {
    filter: `created >= "${oneHourAgo}"`,
  });
  const failed = recent.items.filter(a => a.status === 'needs_review').length;
  if (failed / recent.totalItems > 0.25) {
    alerts.push({
      level: 'critical',
      message: `High failure rate: ${failed}/${recent.totalItems} (${((failed/recent.totalItems)*100).toFixed(0)}%)`,
    });
  }

  // Check cost spike
  const todayCost = recent.items.reduce((s, a) => s + (a.total_cost_estimate || 0), 0);
  const weekAvg = await getWeeklyAvgCost(pb);
  if (todayCost > weekAvg * 2) {
    alerts.push({
      level: 'warning',
      message: `Cost spike: $${todayCost.toFixed(2)} today vs $${weekAvg.toFixed(2)} daily avg`,
    });
  }

  // Log alerts (v0.1: manual review. v0.5: email/Slack integration)
  if (alerts.length > 0) {
    console.error(JSON.stringify({ type: 'alert', alerts }));
  }
}
```

---

*End of Analytics Dashboard Specification. See `pb_schema_analytics.json` for the PocketBase schema additions and `docs/ECOSYSTEM-DATA-STRATEGY.md` for ecosystem data strategy.*
