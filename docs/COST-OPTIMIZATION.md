# Cost Optimization Strategy

**Project:** Prompt-to-PWA Toolkit  
**Date:** 2026-08-12  
**Author:** AI Data (Analytics & Prompt Engineering)  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Current Cost Baseline](#1-current-cost-baseline)
2. [Token Usage Analysis](#2-token-usage-analysis)
3. [Cost Reduction Strategies](#3-cost-reduction-strategies)
4. [GPT-4o Fallback Economics](#4-gpt-4o-fallback-economics)
5. [Blueprint Cache Design](#5-blueprint-cache-design)
6. [Caching Break-Even Analysis](#6-caching-break-even-analysis)
7. [Cost Per Status Outcome](#7-cost-per-status-outcome)
8. [Monthly Cost Projections](#8-monthly-cost-projections)

---

## 1. Current Cost Baseline

### API Pricing (August 2026)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Source |
|-------|---------------------|----------------------|--------|
| Gemini 2.0 Flash | $0.10 | $0.40 | ai.google.dev |
| Claude 3.5 Sonnet | $3.00 | $15.00 | platform.claude.com |
| GPT-4o | $2.50 | $10.00 | openrouter.ai |

### Per-Generation Cost (Weighted Average: ~$0.045)

Based on the Research doc cost model with updated token estimates after prompt optimization:

| Step | Input Tokens | Output Tokens | Input Cost | Output Cost | Subtotal |
|------|-------------|--------------|------------|-------------|----------|
| Gemini Flash (blueprint) | 800 | 700 | $0.00008 | $0.00028 | $0.00036 |
| Claude Sonnet (compile, attempt 1) | 2,500 | 3,500 | $0.00750 | $0.05250 | $0.06000 |
| Claude Sonnet (retry 1, 20% prob) | 3,000 | 3,500 | $0.00900 | $0.05250 | $0.06150 |
| Claude Sonnet (retry 2, 8% prob) | 3,200 | 3,500 | $0.00960 | $0.05250 | $0.06210 |
| **Weighted total** | | | | | **~$0.050** |

**Updated estimate:** After optimized prompts (larger input, structured output), the weighted average increases slightly to **~$0.050/generation** — still well within the $0.045-$0.060 range.

---

## 2. Token Usage Analysis

### Current Token Split (per generation attempt)

```
GEMINI FLASH (2% of total cost):
┌──────────────┬──────┬──────────┐
│ Input:  800  │ 73%  │ $0.00008 │
│ Output: 700  │ 27%  │ $0.00028 │
│ Total:  1500 │      │ $0.00036 │
└──────────────┴──────┴──────────┘

CLAUDE SONNET (98% of total cost):
┌──────────────┬──────┬──────────┐
│ Input:  2500 │ 42%  │ $0.00750 │
│ Output: 3500 │ 58%  │ $0.05250 │
│ Total:  6000 │      │ $0.06000 │
└──────────────┴──────┴──────────┘
```

### Key Insight: Claude Output is the Cost Driver

**88% of total generation cost is Claude's output tokens.** This means:

- **Optimizing Gemini has negligible financial impact.** Even if we halved Gemini's token usage, we'd save $0.00018 — 0.4% of total cost.
- **Reducing Claude's output by 20% saves $0.010 — 20% of total cost.**
- **Reducing Claude retries from 30% to 10% saves $0.012 — 24% of total cost.**
- **Switching Claude to GPT-4o saves $0.017 — 34% of total cost.**

### Token Efficiency Targets

| Metric | Current | Target | Savings |
|--------|---------|--------|---------|
| Claude output tokens | 3,500 | 2,500 | $0.015 (30%) |
| Compile attempts (avg) | 1.3 | 1.1 | $0.012 (24%) |
| Gemini input tokens | 800 | 500 | $0.00003 (negligible) |

---

## 3. Cost Reduction Strategies

### Strategy 1: Claude Output Token Cap (HIGH IMPACT — 30% savings)

**Current:** `max_tokens: 8192` — Claude can generate up to 8K tokens even when it only needs 3K.

**Proposed:** `max_tokens: 5000` — Still generous enough for a complete app but prevents verbose output.

```javascript
// In callClaude()
body: JSON.stringify({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 5000,  // Reduced from 8192
  temperature: 0.3,
  system,
  messages,
})
```

**Risk:** Complex apps with many views may get truncated. Mitigation: Use tiered caps based on blueprint complexity.

```javascript
function getMaxTokens(blueprint) {
  const viewCount = (blueprint.views || []).length;
  const actionCount = (blueprint.actions || []).length;
  const complexity = viewCount + actionCount;

  if (complexity <= 5) return 3500;  // Simple: 2-3 views
  if (complexity <= 8) return 5000;  // Medium: 4-5 views
  return 6500;                        // Complex: 6+ views
}
```

### Strategy 2: Prompt Compression (MEDIUM IMPACT — 5-10% savings)

Compress the system prompt for retry attempts. The first attempt gets the full system prompt; retries get a compressed version.

```javascript
const COMPRESSED_SYSTEM_PROMPT = `Fix JavaScript errors in this HTML file. Return ONLY the corrected complete HTML. No markdown. Same structure. Same features. Just fix syntax errors.`;

function getSystemPrompt(attempt) {
  return attempt === 1 ? FULL_SYSTEM_PROMPT : COMPRESSED_SYSTEM_PROMPT;
}
```

**Savings:** ~$0.0005 per retry (reducing system prompt from ~800 tokens to ~100 tokens).

### Strategy 3: First-Attempt Quality Investment (HIGH IMPACT — 24% savings)

The best way to reduce cost is to make the first attempt succeed more often. Every avoided retry saves $0.060.

**Tactics:**
1. **Better system prompt** (see PROMPT-ENGINEERING.md Section 6) — the HTML skeleton eliminates structural guesswork
2. **Better blueprint** — typed data_fields and user_flows from optimized Gemini prompt
3. **Temperature 0.2 instead of 0.3** — more deterministic output, fewer syntax errors

**Projected impact:** Reduce retry rate from 30% to 10%, saving $0.012/generation.

### Strategy 4: Caching Frequent Blueprints (see Section 5)

### Strategy 5: Client-Side Pre-Validation (LOW IMPACT — but free)

Validate the generated HTML in the browser before sending to the server. Catch obvious issues (missing `<!DOCTYPE>`, missing `</html>`, empty body) without consuming a retry.

```javascript
// In the Netlify function, before acorn validation:
function quickValidate(html) {
  if (!html.includes('<!DOCTYPE html>')) return { valid: false, reason: 'Missing DOCTYPE' };
  if (!html.includes('</html>')) return { valid: false, reason: 'Missing closing html tag' };
  if (!html.includes('<script')) return { valid: false, reason: 'No script tags found' };
  if (html.length < 500) return { valid: false, reason: 'HTML too short' };
  return { valid: true };
}
```

### Cost Strategy Summary

| Strategy | Savings/Gen | Difficulty | Priority |
|----------|------------|------------|----------|
| Output token cap (tiered) | $0.015 (30%) | Low | 🥇 Implement immediately |
| Improve first-attempt success | $0.012 (24%) | Medium (prompt work) | 🥇 Implement with optimized prompts |
| Prompt compression on retries | $0.001 (2%) | Low | 🥈 Nice to have |
| Blueprint cache | $0.00036 (0.7%) | Medium | 🥉 Phase 2 for scale |
| Quick pre-validation | Free (reduces wasted retries) | Low | 🥈 Free defense layer |

---

## 4. GPT-4o Fallback Economics

### Cost Comparison

| | Claude 3.5 Sonnet | GPT-4o | Savings |
|---|---|---|---|
| Input ($/1M tokens) | $3.00 | $2.50 | 17% |
| Output ($/1M tokens) | $15.00 | $10.00 | 33% |
| Per compile attempt (2500 in / 3500 out) | $0.060 | $0.041 | $0.019 (32%) |
| Per generation (weighted) | $0.050 | $0.036 | $0.014 (28%) |

### Fallback Architecture

```
Compile requested
    │
    ▼
┌──────────────────────────┐
│ Attempt 1: Claude 3.5    │ ← Primary (best quality)
│ Sonnet                   │
└──────────┬───────────────┘
           │
    ┌──────▼──────┐
    │ Valid JS?   │
    ├──────┬──────┤
    │ Yes  │ No   │
    ▼      ▼
  Done   ┌──────────────────────────┐
         │ Attempt 2: Claude with   │
         │ error context            │
         └──────────┬───────────────┘
                    │
             ┌──────▼──────┐
             │ Valid JS?   │
             ├──────┬──────┤
             │ Yes  │ No   │
             ▼      ▼
           Done   ┌──────────────────────────┐
                  │ Attempt 3: GPT-4o        │ ← Fallback
                  │ (different model may     │
                  │  interpret errors        │
                  │  differently)            │
                  └──────────────────────────┘
```

### A/B Testing Plan

```javascript
const MODEL_STRATEGY = process.env.COMPILE_MODEL || 'claude-primary';

async function selectModel(attempt, strategy) {
  switch (strategy) {
    case 'claude-primary':
      // Claude for attempts 1-2, GPT-4o for attempt 3
      return attempt <= 2 ? 'claude-3-5-sonnet-20241022' : 'gpt-4o';

    case 'gpt4o-primary':
      // GPT-4o for all attempts (22% cheaper, test quality)
      return 'gpt-4o';

    case 'round-robin':
      // Alternate models (for A/B comparison)
      return attempt % 2 === 1
        ? 'claude-3-5-sonnet-20241022'
        : 'gpt-4o';

    default:
      return 'claude-3-5-sonnet-20241022';
  }
}
```

### When to Switch Permanently to GPT-4o

Track these metrics for both models:

| Metric | Claude Threshold | GPT-4o Must Beat |
|--------|-----------------|-----------------|
| First-attempt JS validation pass | 70% | > 60% (acceptable trade for 28% savings) |
| User-reported bugs per 100 apps | Baseline | < 1.5x baseline |
| Visual quality score (manual review) | Baseline | > 90% of baseline |
| Average compile time | Baseline | < 1.2x baseline |

**Decision rule:** If GPT-4o achieves > 60% first-attempt success AND visual quality is > 90% of Claude, switch GPT-4o to primary. Annual savings at 10,000 generations: **$140.**

---

## 5. Blueprint Cache Design

### Why Cache Blueprints?

Two users with similar business needs should get similar blueprints. Every cache hit saves ~$0.00036 (Gemini call + 200ms latency).

### Cache Key Design

```javascript
function buildCacheKey(wizardData) {
  const { purpose, roles, coreAction } = wizardData;
  // Normalize: sort roles, lowercase everything, strip punctuation
  const normalized = {
    purpose: purpose.toLowerCase().trim(),
    roles: [...roles].sort().map(r => r.toLowerCase().trim()),
    coreAction: coreAction.toLowerCase().replace(/[^\w\s]/g, '').trim(),
  };
  // Create deterministic hash
  return `${normalized.purpose}:${normalized.roles.join('|')}:${normalized.coreAction}`;
}
```

### Similarity Matching (Beyond Exact Match)

```javascript
function findSimilarBlueprints(cacheKey, threshold = 0.7) {
  const scores = cache.entries().map(([key, blueprint]) => {
    const similarity = computeJaccardSimilarity(cacheKey, key);
    return { key, blueprint, similarity };
  });

  return scores
    .filter(s => s.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3); // Top 3 matches
}

function computeJaccardSimilarity(a, b) {
  const tokensA = new Set(a.split(/[:|]/));
  const tokensB = new Set(b.split(/[:|]/));
  const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}
```

### Cache Storage Options

| Option | Latency | Capacity | Cost | Best For |
|--------|---------|----------|------|----------|
| **In-memory (Netlify Function)** | 0ms | Limited (~100 entries before cold start) | Free | MVP — simple, zero setup |
| **PocketBase `blueprint_cache` collection** | ~50ms | Unlimited | Hosting cost only | Production — persistent across function instances |
| **Redis (Upstash free tier)** | ~10ms | 10K entries (free) | Free | Scale — fast lookups |

### Recommended: PocketBase `blueprint_cache` Collection

```json
{
  "name": "blueprint_cache",
  "type": "base",
  "schema": [
    {
      "name": "cache_key",
      "type": "text",
      "required": true,
      "options": { "min": 1, "max": 500, "unique": true }
    },
    {
      "name": "purpose",
      "type": "text",
      "required": true
    },
    {
      "name": "category",
      "type": "text",
      "required": true
    },
    {
      "name": "blueprint_json",
      "type": "json",
      "required": true
    },
    {
      "name": "hit_count",
      "type": "number",
      "required": true,
      "options": { "min": 0, "default": 1 }
    },
    {
      "name": "last_hit",
      "type": "autodate",
      "required": false,
      "options": { "onCreate": true, "onUpdate": true }
    },
    {
      "name": "success_rate",
      "type": "number",
      "required": false,
      "options": { "min": 0, "max": 1 }
    }
  ]
}
```

### Cache Implementation

```javascript
// In generate-blueprint.mjs
async function getCachedBlueprint(pb, cacheKey) {
  try {
    const records = await pb.collection('blueprint_cache').getList(1, 1, {
      filter: `cache_key = "${cacheKey}"`,
    });
    if (records.items.length > 0) {
      const cached = records.items[0];
      await pb.collection('blueprint_cache').update(cached.id, {
        hit_count: cached.hit_count + 1,
      });
      log('info', 'Blueprint cache hit', { cacheKey, hitCount: cached.hit_count + 1 });
      return cached.blueprint_json;
    }
  } catch (err) {
    log('warn', 'Cache lookup failed', { error: err.message });
  }
  return null;
}

async function setCachedBlueprint(pb, cacheKey, blueprint, category) {
  try {
    await pb.collection('blueprint_cache').create({
      cache_key: cacheKey,
      purpose: blueprint.purpose || '',
      category,
      blueprint_json: JSON.stringify(blueprint),
      hit_count: 1,
    });
  } catch (err) {
    // Duplicate key = race condition, ignore
    if (!err.message?.includes('unique')) {
      log('warn', 'Cache write failed', { error: err.message });
    }
  }
}
```

### Cache Invalidation

```javascript
const CACHE_TTL_DAYS = 30;

async function shouldInvalidateCache(blueprint) {
  // Invalidate if blueprint quality was poor
  if (blueprint.confidence < 0.5) return true;
  // Invalidate if blueprint is older than TTL
  const age = Date.now() - new Date(blueprint.last_hit).getTime();
  if (age > CACHE_TTL_DAYS * 86400000) return true;
  return false;
}
```

---

## 6. Caching Break-Even Analysis

### Cost to Store vs. Cost to Regenerate

| Operation | Cost |
|-----------|------|
| Gemini Flash generation | $0.00036 |
| PocketBase write (cache store) | ~$0.00001 (hosting amortized) |
| PocketBase read (cache lookup) | ~$0.000005 (hosting amortized) |
| **Cache hit savings** | **$0.000345** |

### Break-Even: How Many Cache Hits to Justify Building the System?

```
Development cost = ~4 hours engineering time
At $0.000345 saved per cache hit:
Break-even = 4 hours / $0.000345 ≈... let's use meaningful metrics instead

With 100 generations/day:
  - Assume 10% are cacheable (10/day)
  - Daily savings: 10 × $0.000345 = $0.00345
  - Monthly savings: ~$0.

10
  - Annual savings: ~$1.26

With 10,000 generations/day:
  - Cacheable: 1,000/day
  - Daily savings: 1,000 × $0.000345 = $0.345
  - Monthly savings: ~$10.35
  - Annual savings: ~$124
```

**Verdict: Cache for latency, not for cost.** The financial savings are trivial at any scale. The real value is:

1. **Faster generation** — skip the 500ms Gemini API call
2. **Consistency** — same blueprint for similar apps = predictable compiler behavior
3. **Analytics** — cache hit patterns reveal popular app categories

**Recommendation:** Implement cache as a PocketBase collection (1 hour of work) for the latency and analytics benefits. Don't expect meaningful cost savings until > 5,000 generations/day.

---

## 7. Cost Per Status Outcome

Understanding where the money goes by outcome:

| Outcome | Probability | Blueprint Cost | Compile Cost | Total Cost | Credit Worth? |
|---------|------------|----------------|--------------|------------|---------------|
| **Success on attempt 1** | 70% | $0.00036 | $0.060 | **$0.060** | Yes (cost < credit value) |
| **Success on attempt 2** | 20% | $0.00036 | $0.122 | **$0.122** | Yes |
| **Success on attempt 3** | 5% | $0.00036 | $0.184 | **$0.184** | Marginal |
| **Max retries — `needs_review`** | 4% | $0.00036 | $0.184 | **$0.184** | No value to user |
| **Gemini failure (refunded)** | 1% | $0.00036 | $0 | **$0.00036** | Refunded (net $0) |
| **Weighted average** | 100% | | | **$0.050** | |

### Credit Pricing Under Cost Model

At $29/month for 200 credits:

| Metric | Value |
|--------|-------|
| Revenue per credit | $29 / 200 = $0.145 |
| Cost per credit (weighted avg) | $0.050 |
| **Gross margin per credit** | **$0.095 (66%)** |
| Worst case cost per credit (3 retries) | $0.184 |
| **Worst case margin** | **-$0.039 (-27%)** |

**Risk:** If 20% of users hit 3-retry worst case (instead of 5%), the average cost rises to $0.062, reducing margin to 57%. Still profitable but worth monitoring.

### GPT-4o With Same Credit Pricing

| Metric | Claude | GPT-4o  |
|--------|--------|---------|
| Cost per credit (weighted avg) | $0.050 | $0.036 |
| Margin at $0.145/credit | 66% | 75% |
| Margin improvement | — | +9 percentage points |

---

## 8. Monthly Cost Projections

### Startup Phase (0-500 users)

| Tier | Users | Gens/User/Month | Total Gens | Monthly Cost |
|------|-------|-----------------|------------|-------------|
| Free | 400 | 2 | 800 | $40 |
| Pro | 100 | 50 | 5,000 | $250 |
| **Total** | **500** | | **5,800** | **$290** |

**Revenue:** 100 Pro × $29 = $2,900/month → **$2,610 margin (90%)**

### Growth Phase (500-5,000 users)

| Tier | Users | Gens/User/Month | Total Gens | Monthly Cost |
|------|-------|-----------------|------------|-------------|
| Free | 4,000 | 3 | 12,000 | $600 |
| Pro | 1,000 | 80 | 80,000 | $4,000 |
| **Total** | **5,000** | | **92,000** | **$4,600** |

**Revenue:** 1,000 Pro × $29 = $29,000/month → **$24,400 margin (84%)**

### Scale Phase (5,000-50,000 users) — With Optimizations

| Optimization Applied | Savings | New Avg Cost/Gen |
|---------------------|---------|-----------------|
| Tiered max_tokens | -$0.015 (30%) | $0.035 |
| Improved first-attempt | -$0.012 (24%) | $0.023 |
| GPT-4o switch | -$0.014 (28%) | $0.009 |

At 1,000,000 generations/month with full optimizations:
- **Cost: $9,000/month**
- **Revenue: ~$72,500/month** (assuming same Pro conversion rate)
- **Margin: 87%**

---

*End of Cost Optimization Strategy. See `docs/PROMPT-ENGINEERING.md` for prompt optimization details and `scripts/test-prompts.mjs` for automated testing.*
