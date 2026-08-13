#!/usr/bin/env node

// ============================================================================
// validate-env.mjs — Environment Variable Validator
// Usage: node scripts/validate-env.mjs
// Exit code 0 = all good, 1 = validation failures found
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const ENV_EXAMPLE_PATH = resolve(PROJECT_ROOT, ".env.example");

// --- Terminal colors ---
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function icon(ok) {
  return ok ? `${GREEN}✔${RESET}` : `${RED}✘${RESET}`;
}

// --- Parse .env.example to extract expected keys ---
function parseEnvExample() {
  const content = readFileSync(ENV_EXAMPLE_PATH, "utf-8");
  const keys = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Extract key name before =
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    if (key) keys.push(key);
  }

  return keys;
}

// --- Validation rules per variable ---
const VALIDATORS = {
  VITE_POCKETBASE_URL: (val) => {
    if (!val) return "must be set";
    try {
      const url = new URL(val);
      if (!["http:", "https:"].includes(url.protocol)) return "must be an HTTP(S) URL";
      if (!url.hostname) return "must include a hostname";
    } catch {
      return "must be a valid URL (e.g., https://example.pockethost.io)";
    }
    return null;
  },

  POCKETBASE_ADMIN_EMAIL: (val) => {
    if (!val) return "must be set";
    if (!val.includes("@")) return "must be a valid email address";
    return null;
  },

  POCKETBASE_ADMIN_PASSWORD: (val) => {
    if (!val) return "must be set";
    if (val.length < 8) return "must be at least 8 characters";
    return null;
  },

  GEMINI_API_KEY: (val) => {
    if (!val) return "must be set";
    if (val.length < 20) return "appears too short for an API key";
    if (!val.startsWith("AIza")) {
      return `${YELLOW}warning: expected to start with "AIza" (Gemini keys)${RESET}`;
    }
    return null;
  },

  ANTHROPIC_API_KEY: (val) => {
    if (!val) return "must be set";
    if (val.length < 30) return "appears too short for an API key";
    if (!val.startsWith("sk-ant")) {
      return `${YELLOW}warning: expected to start with "sk-ant" (Anthropic keys)${RESET}`;
    }
    return null;
  },

  STRIPE_SECRET_KEY: (val) => {
    if (!val) return "must be set";
    if (val.length < 20) return "appears too short for an API key";
    if (!val.startsWith("sk_")) {
      return `${YELLOW}warning: expected to start with "sk_" (Stripe secret keys)${RESET}`;
    }
    return null;
  },

  STRIPE_WEBHOOK_SECRET: (val) => {
    if (!val) return "must be set";
    if (val.length < 20) return "appears too short";
    if (!val.startsWith("whsec_")) {
      return `${YELLOW}warning: expected to start with "whsec_" (Stripe webhook secrets)${RESET}`;
    }
    return null;
  },

  VITE_STRIPE_PUBLISHABLE_KEY: (val) => {
    if (!val) return "must be set";
    if (val.length < 20) return "appears too short for an API key";
    if (!val.startsWith("pk_")) {
      return `${YELLOW}warning: expected to start with "pk_" (Stripe publishable keys)${RESET}`;
    }
    return null;
  },

  STRIPE_PRO_PRICE_ID: (val) => {
    if (!val) return "must be set";
    if (!val.startsWith("price_")) {
      return `${YELLOW}warning: expected to start with "price_" (Stripe price IDs)${RESET}`;
    }
    return null;
  },
};

// --- Defines which keys are REQUIRED vs OPTIONAL ---
const REQUIRED_KEYS = new Set([
  "VITE_POCKETBASE_URL",
  "POCKETBASE_ADMIN_EMAIL",
  "POCKETBASE_ADMIN_PASSWORD",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRO_PRICE_ID",
]);

// --- Main ---
function main() {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║   Prompt-to-PWA — Environment Validator     ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}\n`);

  const expectedKeys = parseEnvExample();
  let errors = 0;
  let warnings = 0;
  let passed = 0;
  let skipped = 0;

  for (const key of expectedKeys) {
    const isRequired = REQUIRED_KEYS.has(key);
    const val = process.env[key];
    const label = `${isRequired ? "(required)" : "(optional)"}`;

    if (!val) {
      if (isRequired) {
        console.log(`  ${icon(false)} ${BOLD}${key}${RESET} ${DIM}${label}${RESET}`);
        console.log(`    ${RED}→ missing — must be set in environment${RESET}`);
        errors++;
      } else {
        console.log(`  ${icon(true)} ${key} ${DIM}${label} — not set (optional)${RESET}`);
        skipped++;
      }
      continue;
    }

    // Run validator if one exists
    const validator = VALIDATORS[key];
    if (validator) {
      const result = validator(val);
      if (result) {
        const isWarning = result.startsWith("\x1b[33m") || result.startsWith(`${YELLOW}`);
        console.log(`  ${icon(!isWarning)} ${BOLD}${key}${RESET} ${DIM}${label}${RESET}`);
        console.log(`    ${isWarning ? YELLOW : RED}→ ${result}${RESET}`);
        if (isWarning) warnings++; else errors++;
        continue;
      }
    }

    // All good — mask the value for display
    const masked = val.length > 8
      ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}`
      : "***";
    console.log(`  ${icon(true)} ${BOLD}${key}${RESET} ${DIM}${label} — ${masked}${RESET}`);
    passed++;
  }

  // --- Summary ---
  console.log(`\n${BOLD}${DIM}──────────────────────────────────────────────${RESET}`);
  console.log(`  ${GREEN}${passed} passed${RESET}  ${YELLOW}${warnings} warnings${RESET}  ${RED}${errors} errors${RESET}  ${DIM}${skipped} skipped${RESET}`);

  if (errors > 0) {
    console.log(`\n${RED}${BOLD}VALIDATION FAILED${RESET} — ${errors} required variable(s) missing or invalid.\n`);
    console.log(`${DIM}Set them via Netlify Dashboard or your CI secret store:${RESET}`);
    console.log(`${DIM}  https://app.netlify.com/sites/YOUR_SITE/configuration/env${RESET}\n`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`\n${YELLOW}${BOLD}VALIDATION PASSED WITH WARNINGS${RESET} — review the ${warnings} warning(s) above.\n`);
    process.exit(0);
  } else {
    console.log(`\n${GREEN}${BOLD}ALL REQUIRED VARIABLES VALIDATED${RESET} — ready to deploy.\n`);
    process.exit(0);
  }
}

main();
