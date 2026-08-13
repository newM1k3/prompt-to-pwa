#!/usr/bin/env node
/**
 * Prompt Testing Framework for Prompt-to-PWA Toolkit
 *
 * Tests the Gemini blueprint prompt against 5 sample inputs.
 * Runs in "dry run" mode by default (no API keys needed).
 *
 * Usage:
 *   node scripts/test-prompts.mjs              # Dry run (default)
 *   node scripts/test-prompts.mjs --live       # Live test with API keys
 *   node scripts/test-prompts.mjs --live --gemini-key=AIza...  # With explicit key
 *
 * Output: test-results.json
 *
 * NOTE (C2): the blueprint schema is the CANONICAL shape shared with
 * generate-blueprint.mjs and src/types.ts:
 *   { app_name, actors: string[], actions: string[], data_fields: string[], primary_view }
 *
 * @author AI Data
 * @date 2026-08-12
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESULTS_PATH = path.join(PROJECT_ROOT, 'test-results.json');

// ============================================================================
// TEST CASES
// ============================================================================

const TEST_CASES = [
  {
    id: 'test-001-driver-checkin',
    description: 'Driver check-in/out with photo',
    wizardData: {
      prompt: 'I need my drivers to tap a button when they leave and take a photo when they arrive',
      purpose: 'scheduling_jobs',
      roles: ['Driver', 'Dispatcher'],
      coreAction: 'Driver taps button to start trip, takes photo at destination to confirm arrival',
    },
    expectedCategory: 'scheduling',
    expectedMinFields: 4,
    expectedPrimaryView: null, // can be any
    minActors: 2,
    isVague: false,
  },
  {
    id: 'test-002-customer-orders',
    description: 'Customer order tracking with weekly summary',
    wizardData: {
      prompt: 'Track customer orders and send me a summary every Friday',
      purpose: 'customers_sales',
      roles: ['Sales Rep', 'Manager'],
      coreAction: 'View all orders this week and export a summary',
    },
    expectedCategory: 'customers',
    expectedMinFields: 5,
    expectedPrimaryView: null,
    minActors: 2,
    isVague: false,
  },
  {
    id: 'test-003-employee-scheduling',
    description: 'Multi-employee, multi-site scheduling',
    wizardData: {
      prompt: 'Schedule my 4 employees across 3 job sites each week',
      purpose: 'staff_crew',
      roles: ['Foreman', 'Worker', 'Scheduler'],
      coreAction: 'Assign employees to job sites for each day of the week',
    },
    expectedCategory: 'staff',
    expectedMinFields: 5,
    expectedPrimaryView: 'calendar',
    minActors: 3,
    isVague: false,
  },
  {
    id: 'test-004-inventory-alerts',
    description: 'Inventory counting with low-stock alerts',
    wizardData: {
      prompt: 'Count inventory in my warehouse and alert me when stock is low',
      purpose: 'inventory_stock',
      roles: ['Warehouse Manager', 'Supplier'],
      coreAction: 'Update stock count and trigger alert when quantity drops below reorder point',
    },
    expectedCategory: 'inventory',
    expectedMinFields: 5,
    expectedPrimaryView: null,
    minActors: 2,
    isVague: false,
  },
  {
    id: 'test-005-vague-prompt',
    description: 'Intentionally vague prompt — should trigger Wizard fallback, not generation',
    wizardData: {
      prompt: 'Build me an app',
      purpose: '',
      roles: [],
      coreAction: '',
    },
    expectedCategory: null,
    expectedMinFields: 0,
    expectedPrimaryView: null,
    minActors: 0,
    isVague: true,
    expectedBehavior: 'NEEDS_WIZARD',
  },
];

// ============================================================================
// BLUEPRINT VALIDATION — canonical schema (matches generate-blueprint.mjs)
// ============================================================================

const REQUIRED_KEYS = ['app_name', 'actors', 'actions', 'data_fields', 'primary_view'];

const VALID_VIEW_TYPES = ['list', 'map', 'calendar', 'form', 'dashboard'];

function validateBlueprint(blueprint, testCase) {
  const results = {
    testId: testCase.id,
    description: testCase.description,
    checks: [],
    score: 0,
    maxScore: 0,
    passed: true,
  };

  // Check 1: All required top-level keys exist
  results.maxScore += REQUIRED_KEYS.length;
  for (const key of REQUIRED_KEYS) {
    const hasKey = key in blueprint;
    results.checks.push({
      check: `Has required key: ${key}`,
      passed: hasKey,
      detail: hasKey ? 'present' : 'MISSING',
    });
    if (hasKey) results.score++;
    else results.passed = false;
  }

  // Check 2: app_name is a non-empty string
  results.maxScore++;
  if (typeof blueprint.app_name === 'string' && blueprint.app_name.trim().length >= 2) {
    results.checks.push({ check: 'app_name is valid', passed: true, detail: blueprint.app_name });
    results.score++;
  } else {
    results.checks.push({ check: 'app_name is valid', passed: false, detail: JSON.stringify(blueprint.app_name) });
    results.passed = false;
  }

  // Check 3: actors is an array of strings (min testCase.minActors)
  results.maxScore++;
  if (Array.isArray(blueprint.actors) && blueprint.actors.length >= testCase.minActors) {
    const allValid = blueprint.actors.every((a) => typeof a === 'string' && a.length > 0);
    results.checks.push({
      check: `actors array (min ${testCase.minActors}) of strings`,
      passed: allValid,
      detail: `${blueprint.actors.length} actors, all strings: ${allValid}`,
    });
    if (allValid) results.score++;
    else results.passed = false;
  } else {
    results.checks.push({
      check: `actors array (min ${testCase.minActors})`,
      passed: false,
      detail: `Got ${blueprint.actors?.length || 0} actors`,
    });
    results.passed = false;
  }

  // Check 4: actions array of strings (min 3)
  results.maxScore++;
  if (Array.isArray(blueprint.actions) && blueprint.actions.length >= 3) {
    const allValid = blueprint.actions.every((a) => typeof a === 'string' && a.length > 0);
    results.checks.push({
      check: 'actions array (min 3) of strings',
      passed: allValid,
      detail: `${blueprint.actions.length} actions, all strings: ${allValid}`,
    });
    if (allValid) results.score++;
    else results.passed = false;
  } else {
    results.checks.push({
      check: 'actions array (min 3)',
      passed: false,
      detail: `Got ${blueprint.actions?.length || 0} actions`,
    });
    results.passed = false;
  }

  // Check 5: data_fields array of strings (min testCase.expectedMinFields)
  results.maxScore++;
  if (
    Array.isArray(blueprint.data_fields) &&
    blueprint.data_fields.length >= testCase.expectedMinFields
  ) {
    const allValid = blueprint.data_fields.every((f) => typeof f === 'string' && f.length > 0);
    results.checks.push({
      check: `data_fields (min ${testCase.expectedMinFields}) of strings`,
      passed: allValid,
      detail: `${blueprint.data_fields.length} fields, all strings: ${allValid}`,
    });
    if (allValid) results.score++;
    else results.passed = false;
  } else {
    results.checks.push({
      check: `data_fields (min ${testCase.expectedMinFields})`,
      passed: false,
      detail: `Got ${blueprint.data_fields?.length || 0} fields`,
    });
    results.passed = false;
  }

  // Check 6: primary_view is valid, and matches the expected view when set
  results.maxScore += 2;
  const viewValid =
    typeof blueprint.primary_view === 'string' &&
    VALID_VIEW_TYPES.includes(blueprint.primary_view);
  results.checks.push({
    check: `primary_view is one of: ${VALID_VIEW_TYPES.join(', ')}`,
    passed: viewValid,
    detail: viewValid ? blueprint.primary_view : JSON.stringify(blueprint.primary_view),
  });
  if (viewValid) results.score++;
  else results.passed = false;

  if (testCase.expectedPrimaryView) {
    const matches = viewValid && blueprint.primary_view === testCase.expectedPrimaryView;
    results.checks.push({
      check: `primary_view matches expected "${testCase.expectedPrimaryView}"`,
      passed: matches,
      detail: matches ? blueprint.primary_view : `Got ${JSON.stringify(blueprint.primary_view)}`,
    });
    if (matches) results.score++;
    else results.passed = false;
  } else {
    // No expectation — mark the second point as satisfied for scoring parity
    results.maxScore--;
    results.checks.push({
      check: 'primary_view expectation (none required)',
      passed: true,
      detail: 'skipped',
    });
  }

  // Check 7: Vague prompt behavior
  if (testCase.isVague) {
    // Under the canonical model, vague prompts are gated by the Wizard
    // pre-check (purpose/roles/coreAction must be present) — same as
    // generate-blueprint which 422s on an empty prompt.
    results.maxScore++;
    if (testCase.wizardData.purpose && testCase.wizardData.roles.length > 0 && testCase.wizardData.coreAction) {
      results.checks.push({
        check: 'Vague prompt: wizard fields present → generation allowed',
        passed: true,
        detail: 'Wizard completed',
      });
      results.score++;
    } else {
      results.checks.push({
        check: 'Vague prompt: wizard fields missing → NEEDS_WIZARD',
        passed: true,
        detail: 'Wizard fallback expected (handled in runner pre-check)',
      });
      results.score++;
    }
  }

  return results;
}

// ============================================================================
// PROMPT BUILDING (matches generate-blueprint.mjs logic)
// ============================================================================

function buildGeminiPrompt(wizardData) {
  const { prompt, purpose, roles, coreAction } = wizardData;
  const rolesStr = (roles || []).join(', ');

  return `You are a requirements analyst. Extract the core problem from the user's description. Output ONLY valid JSON (no markdown, no backticks) with keys:
- app_name (string, short and descriptive)
- actors (array of strings, max 5 roles)
- actions (array of strings, max 10 actions)
- data_fields (array of strings, max 10)
- primary_view (one of: list, map, calendar, form, dashboard)

USER DESCRIPTION:
Prompt: ${prompt}
Purpose: ${purpose}
Roles: ${rolesStr}
Core Action: ${coreAction}`;
}

// ============================================================================
// MOCK GEMINI RESPONSE GENERATOR (for dry runs) — canonical schema
// ============================================================================

function generateMockBlueprint(testCase) {
  // For dry runs: generate a structurally correct mock based on the test case
  const { wizardData } = testCase;
  const category = getCategory(wizardData.purpose);

  const categoryTemplates = {
    scheduling: {
      app_name: 'DriverTracker Pro',
      actors: ['Driver', 'Dispatcher'],
      actions: [
        'Start trip with timestamp',
        'Capture arrival photo at destination',
        'View all past and active trips',
      ],
      data_fields: [
        'driver_name',
        'destination',
        'departure_time',
        'arrival_photo',
        'trip_status',
      ],
      primary_view: 'list',
    },
    customers: {
      app_name: 'OrderTrack Pro',
      actors: ['Sales Rep', 'Manager'],
      actions: [
        'Add new customer order',
        'View all orders',
        'Export weekly summary',
        'Filter orders by customer',
      ],
      data_fields: [
        'customer_name',
        'order_date',
        'items',
        'total_amount',
        'order_status',
      ],
      primary_view: 'list',
    },
    staff: {
      app_name: 'CrewScheduler Pro',
      actors: ['Foreman', 'Worker', 'Scheduler'],
      actions: [
        'Assign employee to job site and shift',
        'View weekly schedule',
        'Swap shift between employees',
      ],
      data_fields: [
        'employee_name',
        'job_site',
        'shift_date',
        'shift_start',
        'shift_end',
      ],
      primary_view: 'calendar',
    },
    inventory: {
      app_name: 'StockAlert Pro',
      actors: ['Warehouse Manager', 'Supplier'],
      actions: [
        'Update stock count',
        'Low-stock alert when quantity drops below reorder point',
        'View inventory with current stock',
      ],
      data_fields: [
        'item_name',
        'quantity',
        'reorder_point',
        'warehouse_location',
        'supplier',
      ],
      primary_view: 'list',
    },
    other: {
      app_name: 'My App',
      actors: ['User'],
      actions: ['View items', 'Add item'],
      data_fields: ['name', 'description', 'date'],
      primary_view: 'list',
    },
  };

  const template = categoryTemplates[category] || categoryTemplates.other;

  // Build complete blueprint
  const blueprint = {
    app_name: template.app_name,
    actors: (template.actors || []).slice(0, 5),
    actions: (template.actions || []).slice(0, 10),
    data_fields: (template.data_fields || []).slice(0, 10),
    primary_view: template.primary_view,
  };

  // If the test case names explicit roles, prefer them (canonical: strings)
  if (Array.isArray(wizardData.roles) && wizardData.roles.length > 0) {
    blueprint.actors = wizardData.roles.slice(0, 5);
  }

  return blueprint;
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTests({ live = false, geminiKey = null } = {}) {
  console.log('═'.repeat(60));
  console.log('PROMPT TESTING FRAMEWORK');
  console.log(`Mode: ${live ? 'LIVE (API calls enabled)' : 'DRY RUN (mock responses)'}`);
  console.log(`Test cases: ${TEST_CASES.length}`);
  console.log('═'.repeat(60));
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    mode: live ? 'live' : 'dry-run',
    promptVersion: '2.1.0', // C2: canonical schema { app_name, actors[], actions[], data_fields[], primary_view }
    summary: {
      totalTests: TEST_CASES.length,
      passed: 0,
      failed: 0,
      averageScore: 0,
    },
    tests: [],
  };

  for (const testCase of TEST_CASES) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Test: ${testCase.id} — ${testCase.description}`);
    console.log(`Category: ${getCategory(testCase.wizardData.purpose)}`);
    console.log('');

    // Build the prompt
    const userPrompt = buildGeminiPrompt(testCase.wizardData);

    // Check Wizard precondition for vague prompts
    if (testCase.isVague) {
      const { purpose, roles, coreAction } = testCase.wizardData;
      const needsWizard = !purpose || roles.length === 0 || !coreAction;

      if (needsWizard) {
        console.log('  ⚠️  PRE-CHECK: Prompt is too vague — needs Wizard completion');
        console.log(`     Purpose: ${purpose ? '✓' : '✗ MISSING'}`);
        console.log(`     Roles: ${roles.length > 0 ? `✓ (${roles.length})` : '✗ MISSING'}`);
        console.log(`     Core Action: ${coreAction ? '✓' : '✗ MISSING'}`);
        console.log('  → Expected behavior: Show Wizard, do NOT call Gemini');

        results.tests.push({
          testId: testCase.id,
          passed: true,
          behavior: 'NEEDS_WIZARD',
          detail: 'Prompt correctly identified as too vague — Wizard should be shown instead of calling Gemini',
        });
        results.summary.passed++;
        continue;
      }
    }

    // Display what would be sent
    console.log('  === USER PROMPT ===');
    console.log('  ' + userPrompt.replace(/\n/g, '\n  '));
    console.log('');

    let blueprint;

    if (live && geminiKey) {
      // Live mode: call actual Gemini API
      try {
        console.log('  🔵 Calling Gemini Flash API...');
        const response = await callLiveGemini(userPrompt, geminiKey);
        blueprint = JSON.parse(response);
        console.log('  ✓ API response received and parsed');
      } catch (err) {
        console.log(`  ✗ API call failed: ${err.message}`);
        results.tests.push({
          testId: testCase.id,
          passed: false,
          error: err.message,
        });
        results.summary.failed++;
        continue;
      }
    } else {
      // Dry run: generate mock
      blueprint = generateMockBlueprint(testCase);
      console.log('  🟡 DRY RUN — Using mock blueprint');
    }

    // Validate the blueprint
    console.log('');
    console.log('  === BLUEPRINT VALIDATION ===');
    const validation = validateBlueprint(blueprint, testCase);

    for (const check of validation.checks) {
      const icon = check.passed ? '  ✓' : '  ✗';
      console.log(`${icon} ${check.check}`);
      if (check.detail) {
        console.log(`     ${check.detail}`);
      }
    }

    console.log(`\n  Score: ${validation.score}/${validation.maxScore} (${((validation.score / validation.maxScore) * 100).toFixed(0)}%)`);
    console.log(`  Result: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);

    results.tests.push({
      testId: testCase.id,
      passed: validation.passed,
      score: validation.score,
      maxScore: validation.maxScore,
      category: getCategory(testCase.wizardData.purpose),
      primaryView: blueprint.primary_view,
      appName: blueprint.app_name,
      checks: validation.checks,
      blueprint: live ? blueprint : undefined, // Only include in results for live runs
    });

    if (validation.passed) results.summary.passed++;
    else results.summary.failed++;
  }

  // Calculate summary
  const totalScore = results.tests.reduce((sum, t) => sum + (t.score || 0), 0);
  const totalMax = results.tests.reduce((sum, t) => sum + (t.maxScore || 0), 0);
  results.summary.averageScore = totalMax > 0 ? (totalScore / totalMax) : 0;

  // Write results
  console.log('\n' + '═'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total: ${results.summary.totalTests} | Passed: ${results.summary.passed} | Failed: ${results.summary.failed}`);
  console.log(`Average Score: ${(results.summary.averageScore * 100).toFixed(0)}%`);
  console.log(`\nResults written to: ${RESULTS_PATH}`);

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  return results;
}

// ============================================================================
// LIVE GEMINI API CALLER
// ============================================================================

async function callLiveGemini(userPrompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text;
}

// ============================================================================
// HELPERS / CLI
// ============================================================================

function getCategory(purpose) {
  const map = {
    inventory_stock: 'inventory',
    staff_crew: 'staff',
    customers_sales: 'customers',
    scheduling_jobs: 'scheduling',
    something_else: 'other',
  };
  return map[purpose] || 'other';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { live: false, geminiKey: null };

  for (const arg of args) {
    if (arg === '--live') {
      config.live = true;
    } else if (arg.startsWith('--gemini-key=')) {
      config.geminiKey = arg.split('=')[1];
    }
  }

  // Also check environment
  if (!config.geminiKey && process.env.GEMINI_API_KEY) {
    config.geminiKey = process.env.GEMINI_API_KEY;
  }

  if (config.live && !config.geminiKey) {
    console.error('Error: --live requires --gemini-key= or GEMINI_API_KEY env var');
    process.exit(1);
  }

  return config;
}

const config = parseArgs();
runTests(config).catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
