# Prompt Engineering Audit & Optimization

**Project:** Prompt-to-PWA Toolkit  
**Date:** 2026-08-12  
**Author:** AI Data (Analytics & Prompt Engineering)  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Blueprint Prompt Audit (Gemini Flash)](#1-blueprint-prompt-audit-gemini-flash)
2. [Blueprint Prompt — Optimized Version](#2-blueprint-prompt--optimized-version)
3. [Prompt Enrichment Pipeline](#3-prompt-enrichment-pipeline)
4. [Fallback & Recovery Strategy](#4-fallback--recovery-strategy)
5. [Code Generation Prompt Audit (Claude 3.5 Sonnet)](#5-code-generation-prompt-audit-claude-35-sonnet)
6. [Code Generation Prompt — Optimized Version](#6-code-generation-prompt--optimized-version)
7. [Common Failure Patterns & Prevention](#7-common-failure-patterns--prevention)
8. [Prompt Versioning & Regression Testing](#8-prompt-versioning--regression-testing)

---

## 1. Blueprint Prompt Audit (Gemini Flash)

### Current Prompt (from `generate-blueprint.mjs`)

```
You are a requirements analyst. Extract the core problem from the user's description.
Output ONLY valid JSON (no markdown, no backticks) with keys:
- app_name (string, short and descriptive)
- actors (array of strings, max 5 roles)
- actions (array of strings, max 10 actions)
- data_fields (array of strings, max 10)
- primary_view (one of: list, map, calendar, form, dashboard)
```

### Critical Issues Found

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **No output schema** — Gemini has `responseMimeType: "application/json"` set but no JSON schema. The model must guess field format. | 🔴 Critical | Gemini may omit fields, add extra ones, or use wrong types (e.g., `actors` as string instead of array) |
| 2 | **No few-shot examples** — Zero-shot on a vague task = inconsistent quality across diverse prompts. | 🔴 Critical | Quality variance between "track inventory" (easy) and "schedule my 4 employees" (complex) |
| 3 | **Overly permissive field limits** — `max 10 actions` with no guidance on granularity. Gemini may produce "log in" as an action alongside "generate inventory report." | 🟡 Medium | Inconsistent action granularity breaks the code-gen step |
| 4 | **`primary_view` is too restrictive** — Only 5 options. Many apps need a multi-view description. A CRUD app needs list+form, not just one. | 🟡 Medium | Compiler gets insufficient view guidance |
| 5 | **No `data_fields` type information** — Field names only. Gemini might return `["date", "name"]` when it should suggest `[{name: "date", type: "date"}, {name: "name", type: "text"}]`. | 🟡 Medium | Compiler can't infer data types, leading to generic `localStorage` code |
| 6 | **No confidence scoring** — No way to flag ambiguous extractions for human review. | 🟢 Low | The `needs_review` status path is unreachable without confidence data |
| 7 | **No Wizard context integration** — The `buildGeminiPrompt()` function concatenates wizard data but doesn't weigh it. The `purpose` field is extremely high-signal but gets equal treatment with the raw prompt. | 🟡 Medium | Wizard data is underutilized |

### Token Efficiency Analysis

| Component | Est. Tokens | % of Total |
|-----------|-------------|------------|
| System instruction | ~60 | 30% |
| User prompt text | ~80 | 40% |
| Wizard data (purpose, roles, coreAction) | ~60 | 30% |
| **Total input** | **~200** | 100% |
| Expected output | ~300 | — |

💡 **Finding:** Input is too small. At ~200 tokens, we're giving Gemini Flash almost no context to work with. The model is extremely fast and cheap ($0.00002/input), so increasing input to ~500 tokens costs virtually nothing ($0.00003) while dramatically improving output quality.

---

## 2. Blueprint Prompt — Optimized Version

### System Instruction (replaces current flat prompt)

```text
You are an expert application architect extracting structured blueprints from
business descriptions. Your output is consumed by a code generator that builds
a working HTML/JS/CSS single-page app.

Output ONLY valid JSON (no markdown, no backticks, no explanatory text) matching
this EXACT schema. Every field is REQUIRED unless marked optional:

{
  "app_name": "2-4 word, memorable, descriptive name",
  "app_description": "1-2 sentence elevator pitch of what this app does",
  "actors": [
    {
      "name": "Role Name",
      "description": "What this person needs to do in the app",
      "primary_screen": "which screen they see first"
    }
  ],
  "actions": [
    {
      "id": "action_add_item",
      "label": "Add New Item",
      "description": "User fills a form to create a new record",
      "importance": "core | supporting | nice_to_have"
    }
  ],
  "data_fields": [
    {
      "name": "item_name",
      "type": "text | number | date | boolean | select | file",
      "label": "Human-readable field label",
      "required": true | false,
      "options": ["val1", "val2"]
    }
  ],
  "views": [
    {
      "id": "view_dashboard",
      "type": "list | map | calendar | form | dashboard | detail",
      "name": "Dashboard",
      "description": "Overview of all items with quick stats",
      "is_primary": true | false
    }
  ],
  "user_flows": [
    {
      "id": "flow_add_item",
      "from_view": "view_dashboard",
      "to_view": "view_form",
      "trigger": "User clicks '+ Add' button"
    }
  ],
  "edge_cases": [
    "What happens when localStorage is empty (first visit)",
    "What happens when user submits empty form"
  ],
  "confidence": 0.0-1.0
}

VALIDATION RULES:
- app_name: 2-4 words, start with a capital, no "App" suffix unless essential
- actors: 1-5 entries. Every actor needs a primary_screen from the views list
- actions: 3-8 entries. At least 1 marked "core". Core actions = the ONE thing
  from the user description. Supporting = needed UI. Nice_to_have = extras.
- data_fields: 3-10 entries. Every field needs a type. "select" type needs
  non-empty options array. "file" type means photo/camera upload.
- views: 2-5 entries. At least 1 list view and 1 form view. Exactly 1 is_primary.
- user_flows: 2-5 entries. from_view and to_view must match view IDs.
- edge_cases: 2-5 strings. Think about empty states, error states, and edge
  conditions the code generator must handle.
- confidence: 0.0-1.0. Be honest. Below 0.7 = the prompt was vague. Below 0.5 =
  you are guessing and the blueprint may be unreliable.

CRITICAL: Every string value must be plain text. No markdown. No HTML. No emoji.
```

### Few-Shot Example (prepended to first user message)

```text
EXAMPLE INPUT:
Prompt: "Track customer orders and send me a summary every Friday"
Purpose: customers_sales
Roles: ["Sales Rep", "Manager"]
Core Action: "View all orders this week and export a summary"

EXAMPLE OUTPUT:
{
  "app_name": "OrderTrack Pro",
  "app_description": "A customer order tracker that lets sales reps log orders and managers export weekly summaries.",
  "actors": [
    {"name": "Sales Rep", "description": "Logs new customer orders throughout the week", "primary_screen": "view_orders"},
    {"name": "Manager", "description": "Reviews all orders and exports weekly summaries", "primary_screen": "view_dashboard"}
  ],
  "actions": [
    {"id": "action_add_order", "label": "Add New Order", "description": "Form to create a new customer order with items and total", "importance": "core"},
    {"id": "action_view_orders", "label": "View All Orders", "description": "Filterable list of all orders with status", "importance": "core"},
    {"id": "action_export_summary", "label": "Export Weekly Summary", "description": "Generate a text summary of this week's orders for email", "importance": "core"},
    {"id": "action_filter_by_customer", "label": "Filter by Customer", "description": "Show orders for a specific customer", "importance": "supporting"},
    {"id": "action_mark_fulfilled", "label": "Mark as Fulfilled", "description": "Change order status to fulfilled", "importance": "supporting"}
  ],
  "data_fields": [
    {"name": "customer_name", "type": "text", "label": "Customer Name", "required": true},
    {"name": "order_date", "type": "date", "label": "Order Date", "required": true},
    {"name": "items", "type": "text", "label": "Items Ordered", "required": true},
    {"name": "total_amount", "type": "number", "label": "Total Amount ($)", "required": true},
    {"name": "status", "type": "select", "label": "Order Status", "required": true, "options": ["Pending", "Fulfilled", "Cancelled"]}
  ],
  "views": [
    {"id": "view_dashboard", "type": "dashboard", "name": "Dashboard", "description": "Weekly summary with total orders and revenue", "is_primary": false},
    {"id": "view_orders", "type": "list", "name": "All Orders", "description": "Filterable list of all orders", "is_primary": true},
    {"id": "view_order_form", "type": "form", "name": "Add Order", "description": "Form to create a new order", "is_primary": false},
    {"id": "view_summary", "type": "list", "name": "Weekly Summary", "description": "This week's orders summary ready to share", "is_primary": false}
  ],
  "user_flows": [
    {"id": "flow_add_order", "from_view": "view_orders", "to_view": "view_order_form", "trigger": "User clicks '+ Add Order'"},
    {"id": "flow_save_order", "from_view": "view_order_form", "to_view": "view_orders", "trigger": "User submits the order form"},
    {"id": "flow_view_summary", "from_view": "view_dashboard", "to_view": "view_summary", "trigger": "User clicks 'View Weekly Summary'"}
  ],
  "edge_cases": [
    "First visit: localStorage is empty, show welcome message instead of empty list",
    "Empty form submission: validate all required fields before saving",
    "No orders this week: summary shows 'No orders this week' message",
    "Very long customer name: truncate to 50 chars in list view"
  ],
  "confidence": 0.95
}
```

### Updated `buildGeminiPrompt()` function

```javascript
function buildGeminiPrompt(wizardData) {
  const { prompt, purpose, roles, coreAction } = wizardData;
  const rolesStr = roles.join(', ');
  const purposeLabel = PURPOSE_LABELS[purpose] || purpose;

  // Map purpose to category for analytics
  const category = mapPurposeToCategory(purpose);

  // Build structured context — Wizard data gets privileged position
  return `APP PURPOSE (from Wizard): ${purposeLabel}
Wizard-selected Roles: ${rolesStr || 'Not specified'}
USER'S CORE ACTION (highest priority): ${coreAction || 'Not specified'}
USER'S FULL DESCRIPTION: ${prompt}

Output a blueprint following the schema exactly. The CORE ACTION above is the
single most important feature — at least one action MUST implement it directly.
The purpose "${purposeLabel}" should guide which views to create.
If the user description is vague, set confidence below 0.7 and keep the
blueprint simple (3-4 views, 3-5 actions).`;
}
```

### What changed and why

| Change | Before | After | Rationale |
|--------|--------|-------|-----------|
| Added full JSON schema | Flat key list | Structured schema with types, validation rules | Gemini Flash with `responseMimeType: "application/json"` handles structured schemas perfectly. Eliminates guesswork. |
| Added few-shot example | None | 1 complete example (order tracking) | Single, well-chosen example anchors output format. More than 1 example increases cost with diminishing returns. |
| Made data_fields typed | `["name", "date"]` | `[{name, type, label, required, options}]` | Code generator needs types to generate proper form inputs (`<input type="date">` vs `<input type="text">`). |
| Added `views` array replacing `primary_view` | Single string | Array of view objects with type, name, is_primary | Multi-view apps are the norm. A single `primary_view` cripples the compiler. |
| Added `user_flows` | None | Flow objects connecting views | Gives Claude explicit navigation structure to implement. Prevents "dead-end" screens. |
| Added `edge_cases` | None | Array of edge case strings | Forces Gemini to think about empty states, validation, errors — which Claude MUST handle. |
| Added `confidence` score | None | Float 0.0-1.0 | Enables the `needs_review` status path. Apps with confidence < 0.5 should be flagged for human review. |
| Added `importance` to actions | None | "core" / "supporting" / "nice_to_have" | Lets the compiler prioritize. "Core" actions get full implementation; "nice_to_have" can be simplified. |
| Privileged wizard data | Flat concatenation | Wizard data comes FIRST, labeled as highest priority | The wizard is the highest-signal input. The raw prompt is supplementary context. |
| Purpose-to-category mapping | None | Maps to inventory/staff/customers/scheduling/other | Enables analytics (which category is most popular?) and template matching for caching. |

### Expected Output Token Increase

| Component | Old | New | Increase |
|-----------|-----|-----|----------|
| System instruction | ~60 | ~250 | +190 |
| Few-shot example | 0 | ~350 | +350 |
| User prompt | ~140 | ~200 | +60 |
| **Total input** | **~200** | **~800** | **+600 tokens (+$0.00006)** |
| Expected output | ~300 | ~700 | +400 tokens (+$0.00016) |

**Total cost increase per generation: ~$0.00022** — negligible for the quality improvement.

---

## 3. Prompt Enrichment Pipeline

### The 3 layers of enrichment, in order

```
RAW USER INPUT
    │
    ▼
┌─────────────────────────────────────┐
│ LAYER 1: Wizard Structured Data     │  ← Most signal. Never skip.
│ purpose + roles + coreAction        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ LAYER 2: Intent Classification      │  ← Maps purpose to domain vocabulary
│ "inventory" → stock_level, reorder  │
│ "staff" → schedule, shift, coverage │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ LAYER 3: Prompt Expansion Rules     │  ← Applied before Gemini call
│ If prompt < 20 chars → ask for more │
│ If no roles → default to ["User"]   │
│ If coreAction = "" → derive from    │
│   purpose (e.g., "View and manage") │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ LAYER 4: Blueprint Cache Check      │  ← Check before calling Gemini
│ Hash(purpose + roles + coreAction)  │
│ → If match found, reuse blueprint   │
│ → If partial match, use as template │
└──────────────┬──────────────────────┘
               │
               ▼
       GEMINI FLASH CALL
```

### Purpose-to-Category Mapping

```javascript
const PURPOSE_CATEGORY_MAP = {
  'inventory_stock': 'inventory',
  'staff_crew': 'staff',
  'customers_sales': 'customers',
  'scheduling_jobs': 'scheduling',
  'something_else': 'other',
};

const PURPOSE_VOCABULARY = {
  inventory: {
    nouns: ['stock', 'inventory', 'warehouse', 'supply', 'reorder'],
    verbs: ['track', 'count', 'restock', 'audit', 'alert'],
    views: ['list', 'dashboard', 'form'],
    defaultFields: ['item_name', 'quantity', 'location', 'reorder_point', 'supplier'],
  },
  staff: {
    nouns: ['employee', 'shift', 'schedule', 'crew', 'time-off'],
    verbs: ['schedule', 'assign', 'manage', 'track', 'approve'],
    views: ['calendar', 'list', 'form'],
    defaultFields: ['name', 'role', 'shift_start', 'shift_end', 'job_site'],
  },
  customers: {
    nouns: ['customer', 'order', 'sale', 'lead', 'invoice'],
    verbs: ['track', 'manage', 'follow-up', 'bill', 'contact'],
    views: ['list', 'dashboard', 'form'],
    defaultFields: ['customer_name', 'email', 'phone', 'order_date', 'total'],
  },
  scheduling: {
    nouns: ['appointment', 'booking', 'calendar', 'delivery', 'visit'],
    verbs: ['schedule', 'book', 'assign', 'remind', 'confirm'],
    views: ['calendar', 'list', 'map'],
    defaultFields: ['title', 'date', 'time', 'location', 'assigned_to'],
  },
  other: {
    nouns: [],
    verbs: [],
    views: ['list', 'form'],
    defaultFields: ['name', 'description', 'date'],
  },
};
```

### Enrichment function (add to `generate-blueprint.mjs`)

```javascript
function enrichPromptData(wizardData) {
  const { purpose, roles, coreAction } = wizardData;
  const category = PURPOSE_CATEGORY_MAP[purpose] || 'other';
  const vocab = PURPOSE_VOCABULARY[category];

  // Fill gaps in wizard data
  const enriched = {
    ...wizardData,
    category,
    roles: roles.length > 0 ? roles : ['User'],
    coreAction: coreAction?.trim() || `View and manage ${vocab.nouns[0] || 'items'} in a ${vocab.views[0] || 'list'} view`,
    domainHints: {
      suggestedNouns: vocab.nouns,
      suggestedVerbs: vocab.verbs,
      suggestedViews: vocab.views,
      defaultFields: vocab.defaultFields,
    },
  };
  return enriched;
}
```

---

## 4. Fallback & Recovery Strategy

### When Gemini returns malformed JSON

**Recovery pipeline (in priority order):**

```javascript
async function robustParseGeminiResponse(rawText) {
  // Step 1: Try direct JSON parse
  try {
    return JSON.parse(rawText);
  } catch (e1) {
    console.warn('Direct parse failed, attempting recovery...');
  }

  // Step 2: Strip markdown backticks and try again
  const stripped = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (e2) {
    console.warn('Stripped parse failed, attempting extraction...');
  }

  // Step 3: Extract JSON object from text (find first { to last })
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = rawText.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(extracted);
    } catch (e3) {
      console.warn('Extraction parse failed, attempting repair...');
    }
  }

  // Step 4: JSON repair — fix common Gemini mistakes
  const repaired = repairCommonJSONIssues(rawText);
  try {
    return JSON.parse(repaired);
  } catch (e4) {
    console.error('All recovery attempts failed');
  }

  // Step 5: Graceful degradation — return a minimal valid blueprint
  return generateFallbackBlueprint(wizardData);
}

function repairCommonJSONIssues(text) {
  return text
    .replace(/,(\s*[}\]])/g, '$1')           // Fix trailing commas
    .replace(/'/g, '"')                      // Fix single quotes
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Fix unquoted keys
    .replace(/: NaN/g, ': null')             // Fix NaN
    .replace(/: Infinity/g, ': null')        // Fix Infinity
    .replace(/\}([\s\S]*)$/, '}');           // Fix trailing content
}

function generateFallbackBlueprint(wizardData) {
  return {
    app_name: wizardData.purpose
      ? `${wizardData.purpose.replace(/_/g, ' ')} App`
      : 'My App',
    app_description: `App for ${wizardData.roles?.join(', ') || 'users'} to ${wizardData.coreAction || 'manage data'}.`,
    actors: (wizardData.roles || ['User']).map(r => ({
      name: r,
      description: `${r} of the application`,
      primary_screen: 'view_dashboard',
    })),
    actions: [
      { id: 'action_view', label: 'View Items', description: 'View and browse items', importance: 'core' },
      { id: 'action_add', label: 'Add Item', description: 'Create a new item', importance: 'core' },
    ],
    data_fields: [
      { name: 'name', type: 'text', label: 'Name', required: true },
      { name: 'description', type: 'text', label: 'Description', required: false },
      { name: 'created_at', type: 'date', label: 'Date', required: false },
    ],
    views: [
      { id: 'view_dashboard', type: 'dashboard', name: 'Dashboard', description: 'App overview', is_primary: true },
      { id: 'view_list', type: 'list', name: 'Items', description: 'All items', is_primary: false },
      { id: 'view_form', type: 'form', name: 'Add Item', description: 'Create new item', is_primary: false },
    ],
    user_flows: [
      { id: 'flow_to_form', from_view: 'view_list', to_view: 'view_form', trigger: 'Clicks Add button' },
      { id: 'flow_save', from_view: 'view_form', to_view: 'view_list', trigger: 'Submits form' },
    ],
    edge_cases: ['First visit: no data, show welcome message', 'Empty form: validate required fields'],
    confidence: 0.0,
  };
}
```

### When to flag for human review

```javascript
function shouldFlagForReview(blueprint) {
  if (blueprint.confidence < 0.5) return true;
  if (blueprint.actions.length === 0) return true;
  if (blueprint.data_fields.length === 0) return true;
  if (blueprint.views.length === 0) return true;
  if (blueprint.confidence === 0.0) return true; // Fallback was used
  return false;
}
```

### Circuit breaker

```javascript
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

async function callGeminiWithCircuitBreaker(prompt) {
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    throw new Error('circuit_breaker_open: Too many consecutive Gemini failures');
  }
  try {
    const result = await callGeminiFlash(prompt);
    consecutiveFailures = 0;
    return result;
  } catch (err) {
    consecutiveFailures++;
    throw err;
  }
}
```

---

## 5. Code Generation Prompt Audit (Claude 3.5 Sonnet)

### Current Prompt (from `compile-app.mjs`)

**System prompt:**
```
You are an expert frontend developer. Generate a self-contained HTML document
that implements the following app specification.

RULES:
1. Output ONLY valid HTML with inline CSS using Tailwind CDN.
2. Use vanilla JavaScript for all logic - NO React, NO frameworks.
3. The app must be mobile-first and responsive.
4. Include ALL data storage using localStorage.
5. Do NOT use any external APIs.
6. Output a single complete HTML file starting with <!DOCTYPE html>.
7. Do NOT include markdown backticks or explanations - just the HTML.
```

**User prompt (via `buildInitialPrompt`):**
```
APP SPECIFICATION:
Name: ${appName}
Primary View: ${primaryView}
Actors/Roles: ${actors}
Core Actions: ${numbered list}
Data Fields to Track: ${dataFields}
Original Description: ${originalPrompt}
Implement a complete app with all these features. Include navigation between views if multiple views make sense for the app.
```

### Critical Issues Found

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **No template/skeleton** — Claude must invent structure from scratch each time. Produces inconsistent layouts, missing nav, different patterns. | 🔴 Critical | Every app looks structurally different. Some have nav, some don't. Some use tabs, some use links. |
| 2 | **No UI pattern enforcement** — "mobile-first and responsive" is too vague. Claude may use Tailwind but miss breakpoints or produce desktop-only layouts. | 🔴 Critical | Apps break on mobile devices, which is the primary use case. |
| 3 | **No localStorage pattern** — Claude must design the storage layer fresh each time. Some apps use `localStorage.setItem`; some use arrays; some forget fallback logic. | 🔴 Critical | Data loss on refresh, broken read/write patterns, inconsistent serialization. |
| 4 | **No empty-state requirements** — Claude often generates a static data table with no "empty" state. First visit shows blank screen. | 🔴 Critical | Frank opens his app and sees nothing. He thinks it's broken. |
| 5 | **Missing event handler patterns** — No guidance on `onclick` binding, event delegation, or preventing default form submission. | 🟡 Medium | Forms reload the page, buttons don't work, event listeners on dynamic elements fail. |
| 6 | **No default data seeding** — Empty localStorage = bare UI. No example data to demonstrate functionality. | 🟡 Medium | App looks broken if there's no data to show. User must add data before seeing anything. |
| 7 | **Retry prompt loses context** — The `buildRetryPrompt` function sends only errors + original prompt. It doesn't include the blueprint structure. | 🔴 Critical | Claude may "fix" errors by removing features rather than fixing the code. The 3rd attempt often produces a simpler (but working) app that misses features. |
| 8 | **No output size constraints** — 8,192 max tokens is generous, but Claude may generate verbose HTML with repeated inline styles instead of using Tailwind classes. | 🟢 Low | Larger apps take longer to compile. Not a correctness issue but a performance one. |

---

## 6. Code Generation Prompt — Optimized Version

### Optimized System Prompt — HTML Skeleton Template

Include this exact HTML skeleton in the system prompt so Claude always starts from the same structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>APP_NAME</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 min-h-screen">
  <!-- APP HEADER: fixed top, app name + nav tabs -->
  <header class="bg-white shadow-sm sticky top-0 z-10">
    <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
      <h1 class="text-lg font-bold text-gray-900">APP_NAME</h1>
      <nav class="flex gap-1" id="mainNav">
        <!-- Nav tabs rendered by JS -->
      </nav>
    </div>
  </header>

  <!-- MAIN CONTENT: view containers, only one visible at a time -->
  <main class="max-w-2xl mx-auto px-4 py-6" id="appRoot">
    <!-- Views rendered by JS -->
  </main>

  <!-- MOBILE BOTTOM NAV: fixed bottom for mobile -->
  <nav class="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden" id="mobileNav">
    <!-- Mobile nav rendered by JS -->
  </nav>

  <script type="module">
    // ===== APP STATE =====
    // Single source of truth. Read from localStorage on init.

    // ===== STORAGE HELPERS =====
    // ALWAYS use try/catch for localStorage (private browsing may throw)
    // ALWAYS JSON.parse/stringify for objects
    // ALWAYS provide defaults when storage is empty

    // ===== VIEW RENDERING =====
    // Each view is a function: render[ViewName]View()
    // Only ONE view visible at a time
    // Events attached AFTER rendering via event delegation

    // ===== SEED DATA =====
    // On first visit (when storage is empty), seed 2-3 example items

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', () => { /* ... */ });
  </script>
</body>
</html>
```

### Optimized System Prompt — Rules

```text
You are an expert frontend developer building self-contained single-page
applications. Generate ONLY a complete HTML file. No markdown, no explanations.

=== REQUIRED STRUCTURE ===
Follow the HTML skeleton above exactly. Replace APP_NAME, implement the views
in #appRoot, and fill in the <script type="module"> block.

=== ABSOLUTE REQUIREMENTS ===

1. TAILWIND ONLY: Use Tailwind CDN for ALL styling. No <style> blocks. No
   inline style attributes. Tailwind classes only.

2. VANILLA JS ONLY: No React, Vue, jQuery, Alpine, or any framework. Plain
   JavaScript with <script type="module">.

3. localStorage PATTERN (copy exactly):
```javascript
const STORAGE_KEY = 'app_data';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultData();
  } catch (e) {
    return getDefaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert('Could not save data. Storage may be full.');
  }
}

function getDefaultData() {
  return [  /* 2-3 example items */ ];
}
```

4. NAVIGATION: Every app MUST have navigation:
   - Desktop: Tabs in the header (#mainNav)
   - Mobile: Bottom nav bar (#mobileNav) with emoji icons: 📊 📋 ➕ 📅
   - Active tab highlighted with primary color

5. EMPTY STATES: Every list/dashboard view MUST handle the empty case:
   - Show a friendly message: "No items yet. Tap + to add your first one."
   - Show an illustration (emoji is fine: 📭)
   - Show the Add button prominently

6. FORM HANDLING:
```javascript
function handleFormSubmit(event) {
  event.preventDefault(); // CRITICAL: prevent page reload
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  // Validate, save, switch view, reset form
}
```

7. VALIDATION: Every required form field must be validated before save.
   Show inline error messages in red. Disable submit until all required filled.

8. MOBILE-FIRST: All layouts work on 375px-wide screen.
   - Buttons minimum 44x44px touch target
   - Forms single-column on mobile
   - Lists use full-width cards

9. NO EXTERNAL RESOURCES: No fetch(), no XMLHttpRequest, no CDN other than
   Tailwind, no Google Fonts, no icon libraries. Use emoji for icons.

10. DO NOT output markdown code fences. Start directly with <!DOCTYPE html>.
```

### Optimized Initial User Prompt

```text
=== APP BLUEPRINT ===
Name: {app_name}
Description: {app_description}

=== DATA MODEL ===
{data_fields_formatted}

=== VIEWS ===
{views_formatted}

=== ACTIONS (ordered by importance) ===
{actions_formatted}

=== USER FLOWS ===
{user_flows_formatted}

=== EDGE CASES TO HANDLE ===
{edge_cases_formatted}

=== ACTORS ===
{actors_formatted}

=== CORE ACTION (MUST WORK PERFECTLY) ===
{core_action}

Build this app following the required structure. The core action is the #1
priority — it must work end-to-end with zero bugs. Implement all views, but
prioritize the primary view for polish. Seed 2-3 example data items on first
visit so the app is immediately usable.
```

### Optimized Retry Prompt

```javascript
function buildRetryPrompt(blueprint, errors, previousCode) {
  const errorDetails = errors
    .map(e => `Line ${e.line}:${e.column} — ${e.message}`)
    .join('\n');

  const errorGuidance = categorizeErrors(errors);

  return `=== COMPILATION ERRORS ===
The previous attempt had ${errors.length} JavaScript syntax error(s):

${errorDetails}

${errorGuidance}

=== FIX INSTRUCTIONS ===
1. Fix ONLY the syntax errors listed above. Do NOT remove features.
2. Keep the exact same app structure, views, and data model.
3. If an error is in event handler binding, check that DOM elements exist
   before attaching listeners (use optional chaining: element?.addEventListener).
4. If an error is about undefined variables, check for typos in variable names.
5. If an error is about duplicate declarations, wrap code in blocks { }.
6. Output the COMPLETE corrected HTML file. Do not abbreviate.

=== APP BLUEPRINT (for context) ===
Name: ${blueprint.app_name}
Views: ${(blueprint.views || []).map(v => v.name).join(', ')}
Core Action: ${blueprint.core_action || 'Not specified'}

Return ONLY the complete corrected HTML. No markdown. No explanations.`;
}

function categorizeErrors(errors) {
  const patterns = {
    'Unexpected token': '→ Likely missing/extra brace, bracket, or parenthesis. Check {} [] () balance.',
    'Unexpected identifier': '→ Likely missing semicolon or comma. Check the line above the error.',
    'is not defined': '→ Variable used before declaration. Check for typos.',
    'Cannot read property': '→ Accessing property on null/undefined. Add null checks.',
    'Duplicate declaration': '→ Same variable declared twice. Remove duplicate.',
    'Unexpected end of input': '→ Missing closing brace/bracket. Count your {} and [].',
    'Unterminated string': '→ String missing closing quote. Check for unescaped quotes.',
    'Unexpected reserved word': '→ Using reserved keyword as variable name. Rename.',
  };

  for (const [pattern, guidance] of Object.entries(patterns)) {
    if (errors.some(e => e.message.includes(pattern))) {
      return `SPECIFIC GUIDANCE:\n${guidance}`;
    }
  }
  return 'GENERAL GUIDANCE:\n→ Review each error line carefully.';
}
```

---

## 7. Common Failure Patterns & Prevention

### Pattern 1: Broken Event Handlers

| Symptom | Root Cause | Prevention in Prompt |
|---------|-----------|---------------------|
| "Add" button does nothing | `onclick` set before DOM is ready, or element ID mismatch | System prompt requires `DOMContentLoaded` wrapper + event delegation on `#appRoot` |
| Form submit reloads page | Missing `event.preventDefault()` | Form handling section explicitly shows this pattern |
| Dynamic elements lack listeners | `addEventListener` called before element is rendered | Guidance: "Events attached AFTER rendering via event delegation" |

### Pattern 2: localStorage Failures

| Symptom | Root Cause | Prevention in Prompt |
|---------|-----------|---------------------|
| Data gone after refresh | Not writing to localStorage after mutation | "Write to localStorage after every mutation" in state section |
| `QuotaExceededError` | No error handling around `setItem` | `try/catch` pattern in the exact localStorage helper code |
| Private browsing crash | `localStorage` access throws `SecurityError` | Same `try/catch` — catch returns defaults |
| Corrupt data on load | Missing `JSON.parse` on read | Exact helper shows `JSON.parse` every time |

### Pattern 3: Mobile Layout Issues

| Symptom | Root Cause | Prevention in Prompt |
|---------|-----------|---------------------|
| Buttons too small to tap | Desktop-sized buttons on mobile | "Buttons minimum 44x44px touch target" |
| Horizontal scroll | Content wider than viewport | "Single-column on mobile" + max-w-2xl container |
| Bottom nav missing | Desktop-only navigation | Required mobile bottom nav in skeleton + `md:hidden` on desktop nav |
| Overlapping elements | Missing responsive breakpoints | Tailwind-only approach enforces consistent classes |

### Pattern 4: Empty/First-Visit State

| Symptom | Root Cause | Prevention in Prompt |
|---------|-----------|---------------------|
| Blank screen on first visit | No seed data, no empty state UI | "Seed 2-3 example items" + explicit empty state requirements |
| "Items: 0" with nothing else | Missing UX for empty state | Friendly message, emoji illustration, prominent Add button all required |
| Console errors on empty | Code tries to iterate null/undefined | `getDefaultData()` always returns array |

### Pattern 5: Form Submission Without Persistence

| Symptom | Root Cause | Prevention in Prompt |
|---------|-----------|---------------------|
| Form submits, data disappears on refresh | Data saved to JS variable, not localStorage | `saveData(data)` function is mandatory, called after every form submit |
| Multiple rapid submissions | No form reset or dedup | `form.reset()` after successful save in the pattern |
| Required field validation missing | No validation logic | Explicit section on validation with "Disable submit button until all required fields filled" |

---

## 8. Prompt Versioning & Regression Testing

### Version Tracking

```javascript
// Add to both function files
const PROMPT_VERSION = {
  blueprint: '2.0.0',  // Updated: 2026-08-12 — Added schema, few-shot, typed fields
  compile: '2.0.0',    // Updated: 2026-08-12 — Added skeleton, patterns, edge cases
};

// Log version with every generation
function log(level, message, data) {
  const entry = {
    level,
    message,
    promptVersion: PROMPT_VERSION,
    timestamp: new Date().toISOString(),
  };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
}
```

### A/B Testing Framework

```javascript
// Toggle between prompt versions for A/B testing
const PROMPT_VARIANT = process.env.PROMPT_VARIANT || 'control';

function getSystemPrompt() {
  if (PROMPT_VARIANT === 'experiment') {
    return EXPERIMENTAL_SYSTEM_PROMPT;
  }
  return CONTROL_SYSTEM_PROMPT;
}

// Track which variant produced which result
log('info', 'Generation complete', {
  promptVariant: PROMPT_VARIANT,
  compileAttempts: attempts,
  status: finalStatus,
});
```

### Success Metrics to Track per Prompt Version

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Blueprint parse success rate | > 98% | JSON.parse succeeds without recovery |
| Blueprint validation pass rate | > 95% | All required keys present + valid types |
| Compile first-attempt success | > 70% | Claude output passes acorn on attempt 1 |
| Compile success within 2 attempts | > 90% | Passes acorn on attempt 1 or 2 |
| Confidence score distribution | Median > 0.75 | Track and alert if median drops |
| Average output tokens (Gemini) | 500-900 | Avoid bloat |
| Average output tokens (Claude) | 2000-5000 | Avoid excessive/insufficient code |

---

*End of Prompt Engineering Audit. See `scripts/test-prompts.mjs` for the automated test suite and `docs/COST-OPTIMIZATION.md` for the cost analysis.*
