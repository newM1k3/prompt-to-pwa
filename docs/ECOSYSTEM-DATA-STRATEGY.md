# Ecosystem Data Strategy

**Project:** Prompt-to-PWA Toolkit  
**Date:** 2026-08-12  
**Author:** AI Data (Analytics & Prompt Engineering)  
**Status:** Ready for Implementation

---

## Table of Contents

1. [The 5-Lens Analysis Recap](#1-the-5-lens-analysis-recap)
2. [Tracking Popular App Categories](#2-tracking-popular-app-categories)
3. [Critical Mass Threshold for Standalone Products](#3-critical-mass-threshold-for-standalone-products)
4. [Community Blueprint Library — Data Model](#4-community-blueprint-library--data-model)
5. [User Consent & Privacy Model](#5-user-consent--privacy-model)
6. [Blueprint Quality Score](#6-blueprint-quality-score)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. The 5-Lens Analysis Recap

From the ecosystem strategy, five lenses frame how the Prompt-to-PWA toolkit creates value beyond the app builder:

| Lens | Strategy | Data Needed |
|------|----------|------------|
| **1. Data Mine** | Track what categories are most popular → build polished standalone versions | App category distribution over time |
| **2. Community Flywheel** | Users share blueprints → better quality → more users | Blueprint share/remix data |
| **3. Template Library** | Curated starting points for common use cases | Blueprint quality scores, popularity |
| **4. AI Training Data** | Anonymized prompt→blueprint→code triples for future model fine-tuning | Full generation pipeline data |
| **5. Competitive Moat** | Category-specific benchmarks that improve with scale | Compile success rate per category |

---

## 2. Tracking Popular App Categories

### Category Taxonomy (from Wizard Step 1)

```
inventory     → Inventory & Stock management
staff         → Staff & Crew management
customers     → Customers & Sales tracking
scheduling    → Scheduling & Jobs planning
other         → Something else (free text)
```

### Tracking Queries

```javascript
// Weekly category distribution
async function getCategoryDistribution(pb, daysBack = 7) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const apps = await pb.collection('generated_apps').getList(1, 1000, {
    filter: `created >= "${since}"`,
  });

  const distribution = {
    inventory: 0,
    staff: 0,
    customers: 0,
    scheduling: 0,
    other: 0,
  };

  apps.items.forEach(app => {
    const cat = app.prompt_category || 'other';
    distribution[cat] = (distribution[cat] || 0) + 1;
  });

  return distribution;
}
```

### Trend Detection

```javascript
// Detect which categories are growing week-over-week
async function detectTrendingCategories(pb) {
  const thisWeek = await getCategoryDistribution(pb, 7);
  const lastWeek = await getCategoryDistribution(pb, 14); // days 7-14 ago

  // Adjust to get only last week (not the overlap)
  const lastWeekOnly = {};
  for (const cat of Object.keys(lastWeek)) {
    lastWeekOnly[cat] = lastWeek[cat] - (thisWeek[cat] / 2); // rough approximation
  }

  // Find fastest growing
  const growth = {};
  for (const cat of Object.keys(thisWeek)) {
    if (lastWeekOnly[cat] > 0) {
      growth[cat] = ((thisWeek[cat] - lastWeekOnly[cat]) / lastWeekOnly[cat]) * 100;
    }
  }

  return Object.entries(growth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // Top 3 growing categories
}
```

### Dashboard Widget

```
┌─────────────────────────────────────────┐
│ TRENDING CATEGORIES (30-day)             │
│                                          │
│ 🔥 Inventory  +42%  (128 apps)          │
│ 📈 Scheduling +28%  (87 apps)           │
│ 📊 Staff      +15%  (95 apps)           │
│ 📉 Customers   -3%  (112 apps)          │
└─────────────────────────────────────────┘
```

---

## 3. Critical Mass Threshold for Standalone Products

### Definition of "Critical Mass"

A category hits critical mass for a standalone product when the data suggests:
1. **Consistent demand:** > 100 generations/week in the category for 4 consecutive weeks
2. **Revenue potential:** > 50 unique Pro users generating in this category per month
3. **Feature divergence:** Common actions in this category differ significantly from the generic builder

### Threshold Calculator

```javascript
function shouldBuildStandalone(categoryStats) {
  const {
    weeklyGenerations,       // Array of last 4 weeks' generation counts
    uniqueProUsers,          // Unique Pro users this month
    uniqueFeatures,          // Set of features specific to this category
  } = categoryStats;

  // Check 1: Consistent demand
  const consistentDemand = weeklyGenerations.every(w => w > 100);
  if (!consistentDemand) return { decision: 'wait', reason: 'Insufficient weekly volume' };

  // Check 2: Revenue potential
  if (uniqueProUsers < 50) return { decision: 'wait', reason: 'Insufficient Pro user base' };

  // Check 3: Feature divergence
  if (uniqueFeatures.size < 5) return { decision: 'wait', reason: 'Category too generic for standalone' };

  return {
    decision: 'build',
    confidence: Math.min(1, (weeklyGenerations[3] / 500) * (uniqueProUsers / 200)),
    estimatedDevCost: uniqueFeatures.size * 5, // ~5 hours per unique feature
    estimatedRevenue: uniqueProUsers * 29,     // Monthly at current Pro price
  };
}
```

### Standalone Product Decision Framework

| Category | Weekly Vol | Pro Users | Unique Features | Verdict |
|----------|-----------|-----------|-----------------|---------|
| Inventory | 128/week | 67 Pro | auto-reorder alerts, barcode scan, supplier mgmt, par levels, audit log | ✅ **BUILD** |
| Customers | 87/week | 45 Pro | CRM pipeline, quote-to-invoice, follow-up reminders | ⏳ Monitor |
| Scheduling | 42/week | 28 Pro | drag-drop calendar, conflict detection, availability | ⏳ Monitor |
| Staff | 35/week | 22 Pro | shift swaps, certification tracking, time-off accrual | ❌ Not yet |

### When to Pull the Trigger

```javascript
// Cron job: weekly check
async function checkStandaloneReadiness(pb) {
  const categories = ['inventory', 'staff', 'customers', 'scheduling'];

  for (const cat of categories) {
    const stats = await getCategoryStats(pb, cat);
    const decision = shouldBuildStandalone(stats);

    if (decision.decision === 'build') {
      // Log for review — not automatic
      console.log(JSON.stringify({
        type: 'standalone_opportunity',
        category: cat,
        decision,
        timestamp: new Date().toISOString(),
      }));
    }
  }
}
```

---

## 4. Community Blueprint Library — Data Model

### PocketBase Collection: `community_blueprints`

```json
{
  "name": "community_blueprints",
  "type": "base",
  "schema": [
    {
      "name": "title",
      "type": "text",
      "required": true,
      "options": { "min": 3, "max": 200 }
    },
    {
      "name": "description",
      "type": "text",
      "required": true,
      "options": { "min": 10, "max": 500 }
    },
    {
      "name": "category",
      "type": "select",
      "required": true,
      "options": {
        "values": ["inventory", "staff", "customers", "scheduling", "other"]
      }
    },
    {
      "name": "blueprint_json",
      "type": "json",
      "required": true
    },
    {
      "name": "anonymized_prompt",
      "type": "text",
      "required": false,
      "options": { "max": 500 }
    },
    {
      "name": "quality_score",
      "type": "number",
      "required": true,
      "options": { "min": 0, "max": 1, "default": 0.5 }
    },
    {
      "name": "downloads",
      "type": "number",
      "required": true,
      "options": { "min": 0, "default": 0 }
    },
    {
      "name": "remixes",
      "type": "number",
      "required": true,
      "options": { "min": 0, "default": 0 }
    },
    {
      "name": "ratings",
      "type": "json",
      "required": false
    },
    {
      "name": "tags",
      "type": "json",
      "required": false
    },
    {
      "name": "created",
      "type": "autodate",
      "required": false,
      "options": { "onCreate": true, "onUpdate": false }
    }
  ]
}
```

### Anonymization Rules

When sharing a blueprint to the community library:

```javascript
function anonymizeBlueprint(originalPrompt, blueprintJson) {
  // 1. Strip PII from the original prompt
  let anonymized = originalPrompt
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[Name]')       // Full names
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]')          // Emails
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')     // Phone numbers
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]')               // SSN
    .replace(/\b\d{1,5}\s+\w+\s+\w+,?\s+\w+\s+\d{5}\b/g, '[address]'); // Addresses

  // 2. Replace business-specific names in the blueprint
  const bp = JSON.parse(JSON.stringify(blueprintJson)); // Deep clone

  // Replace company names in app_name
  if (bp.app_name) {
    bp.app_name = bp.app_name
      .replace(/[A-Z][a-z]+('s)?\s*(Supply|Construction|Roofing|Plumbing|Electric|HVAC)/g, '[Business]')
      .replace(/\b(Walmart|Amazon|Target|Home Depot|Lowe's)\b/gi, '[Business]');
  }

  // 3. Remove any field names that look like business-specific identifiers
  if (bp.data_fields) {
    bp.data_fields = bp.data_fields.map(f => ({
      ...f,
      name: f.name.replace(/\b(account_number|tax_id|ssn|license|routing)\b/gi, 'id_number'),
    }));
  }

  return { anonymizedPrompt: anonymized, blueprint: bp };
}
```

### Remix Tracking

```javascript
async function trackRemix(pb, originalBlueprintId, newAppId) {
  // Increment remix counter on the original
  const original = await pb.collection('community_blueprints').getOne(originalBlueprintId);
  await pb.collection('community_blueprints').update(originalBlueprintId, {
    remixes: (original.remixes || 0) + 1,
  });

  // Link the new app to the blueprint it was based on
  await pb.collection('generated_apps').update(newAppId, {
    based_on_blueprint: originalBlueprintId,
  });
}
```

---

## 5. User Consent & Privacy Model

### Consent Flow

```
User generates an app
    │
    ▼
App status = "ready"
    │
    ▼
┌─────────────────────────────────────────┐
│ "Share your blueprint?" modal (optional) │
│                                          │
│  Your app's blueprint can help other     │
│  business owners build similar tools.    │
│                                          │
│  What we share:                          │
│  ✅ App structure (screens, fields)      │
│  ✅ Category (e.g., "Inventory")         │
│  ❌ Your original prompt text            │
│  ❌ Your email or account info           │
│  ❌ Your actual data                     │
│                                          │
│  [  No thanks  ]  [  Share Anonymously  ]│
└─────────────────────────────────────────┘
```

### Consent Database Fields

Add to `users` collection:

```json
{
  "name": "data_sharing_consent",
  "type": "select",
  "required": true,
  "options": {
    "values": ["none", "prompts_only", "blueprints_only", "full"],
    "default": "none"
  }
},
{
  "name": "consent_date",
  "type": "date",
  "required": false
}
```

Add to `generated_apps`:

```json
{
  "name": "shared_to_community",
  "type": "boolean",
  "required": true,
  "options": { "default": false }
},
{
  "name": "share_consent_level",
  "type": "select",
  "required": false,
  "options": {
    "values": ["none", "anonymized", "attributed"]
  }
}
```

### GDPR/Privacy Compliance Checklist

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Explicit opt-in | Modal shown after generation, default = "No thanks" | ✅ Designed |
| Right to withdraw consent | "Remove from community library" button in settings | ⏳ To build |
| Data portability | User can export all their blueprints as JSON | ⏳ To build |
| Data deletion | Delete all shared blueprints on account deletion | ⏳ To build |
| Clear disclosure | Modal explains exactly what is shared | ✅ Designed |
| No PII in shared data | `anonymizeBlueprint()` function strips PII | ✅ Designed |

### Opt-In Rates Estimation

Based on industry benchmarks for optional data sharing:
- **Default (opt-in modal):** 15-25% will share
- **Required opt-in (GDPR style):** < 5% will share
- **Incentivized (extra credits for sharing):** 40-60% will share

**Recommendation:** Use the default modal approach for v0.1. Add credit incentives in v0.2 if collection is too low.

---

## 6. Blueprint Quality Score

### Score Components

```javascript
function calculateBlueprintQualityScore(blueprint, compileStats) {
  // Component 1: Completeness (0-25 points)
  const completeness = calculateCompleteness(blueprint);

  // Component 2: Compile success rate (0-35 points)
  const compileScore = calculateCompileScore(compileStats);

  // Component 3: User engagement (0-25 points)
  const engagementScore = calculateEngagementScore(compileStats);

  // Component 4: Editor/curator review (0-15 points)
  const curatorScore = compileStats.curator_rating || 0;

  return completeness + compileScore + engagementScore + curatorScore;
}

function calculateCompleteness(blueprint) {
  let score = 0;
  if (blueprint.app_name && blueprint.app_name.length > 2) score += 3;
  if (blueprint.app_description && blueprint.app_description.length > 20) score += 3;
  if (blueprint.actors && blueprint.actors.length >= 1) score += 3;
  if (blueprint.actions && blueprint.actions.length >= 3) score += 4;
  if (blueprint.data_fields && blueprint.data_fields.length >= 3) score += 4;
  if (blueprint.views && blueprint.views.length >= 2) score += 4;
  if (blueprint.user_flows && blueprint.user_flows.length >= 2) score += 2;
  if (blueprint.edge_cases && blueprint.edge_cases.length >= 2) score += 2;
  return score; // Max 25
}

function calculateCompileScore(compileStats) {
  const { totalAttempts, successCount } = compileStats;
  if (totalAttempts === 0) return 0;

  const successRate = successCount / totalAttempts;
  if (successRate >= 0.95) return 35;
  if (successRate >= 0.85) return 30;
  if (successRate >= 0.70) return 22;
  if (successRate >= 0.50) return 12;
  return 5; // Below 50% = poor quality
}

function calculateEngagementScore(compileStats) {
  const { downloads, remixes, views } = compileStats;
  let score = 0;
  if (downloads >= 10) score += 10;
  else if (downloads >= 5) score += 6;
  else if (downloads >= 1) score += 2;

  if (remixes >= 5) score += 8;
  else if (remixes >= 2) score += 4;
  else if (remixes >= 1) score += 1;

  if (views >= 50) score += 7;
  else if (views >= 20) score += 4;
  else if (views >= 5) score += 1;

  return score; // Max 25
}
```

### Quality Tiers

| Score Range | Tier | Label | Treatment |
|-------------|------|-------|-----------|
| 85-100 | ⭐⭐⭐ | Featured | Promoted on homepage, search boost |
| 65-84 | ⭐⭐ | Verified | Available in library with "verified" badge |
| 40-64 | ⭐ | Community | Available in library, no badge |
| 0-39 | — | Unlisted | Hidden from browse, accessible by direct link only |

### Auto-Moderation

```javascript
function autoModerateBlueprint(blueprint) {
  const flags = [];

  // Check for placeholder/generic names
  if (/my app|untitled|new app|test/i.test(blueprint.app_name)) {
    flags.push('generic_name');
  }

  // Check for too-few fields (low quality)
  if (blueprint.data_fields && blueprint.data_fields.length < 2) {
    flags.push('insufficient_fields');
  }

  // Check for very low confidence
  if (blueprint.confidence !== undefined && blueprint.confidence < 0.3) {
    flags.push('low_confidence');
  }

  // Check for suspicious patterns
  if (blueprint.app_description && /test|debug|dummy|placeholder/i.test(blueprint.app_description)) {
    flags.push('test_content');
  }

  return {
    approved: flags.length === 0,
    flags,
    requires_review: flags.length > 0 && !flags.includes('test_content'),
  };
}
```

---

## 7. Implementation Roadmap

### Phase 1: Data Collection (v0.1 — Ship with MVP)

- [ ] Add analytics fields to `generated_apps` (see `pb_schema_analytics.json`)
- [ ] Track `prompt_category` from wizard data
- [ ] Track `blueprint_confidence` from Gemini output
- [ ] Track `compile_attempts` and `compile_duration_ms`
- [ ] Track `total_cost_estimate` per generation
- [ ] Build basic admin dashboard (see `docs/ANALYTICS-SPEC.md`)

### Phase 2: Community Library (v0.5 — Post-MVP)

- [ ] Add `community_blueprints` collection to PocketBase
- [ ] Build "Share to Community Library" modal
- [ ] Implement anonymization pipeline
- [ ] Implement quality scoring
- [ ] Build community library browse/search page
- [ ] Add "Use this blueprint" button to start generation from a template

### Phase 3: Standalone Products (v1.0 — Scale)

- [ ] Build category trend detection
- [ ] Implement critical mass calculator
- [ ] Design standalone product templates for top categories
- [ ] A/B test standalone vs. generic builder for each category

### Phase 4: AI Training Data (v2.0+ — Long-Term Moat)

- [ ] Curate high-quality prompt→blueprint→code triples
- [ ] Fine-tune Gemini Flash on domain-specific blueprint extraction
- [ ] Fine-tune Claude on domain-specific code generation
- [ ] Reduce reliance on general-purpose models → lower costs, better quality

---

*End of Ecosystem Data Strategy. See `pb_schema_analytics.json` for the PocketBase schema additions and `docs/ANALYTICS-SPEC.md` for the admin dashboard spec.*
