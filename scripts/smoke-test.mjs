#!/usr/bin/env node

// ============================================================================
// smoke-test.mjs — Prompt-to-PWA smoke test
// Usage: node scripts/smoke-test.mjs
// Exit code 0 = all checks passed, 1 = one or more checks failed
//
// Checks:
//   1. Required env vars are set in process.env or documented in .env.example
//   2. All Netlify function files exist and export a handler
//   3. `npm run build` exits 0
//   4. public/manifest.webmanifest exists and parses as valid JSON
//   5. public/sw.js exists
//   6. No `allow-same-origin` in src/ (unsafe iframe sandbox flag)
//   7. No hardcoded API keys (sk-, AIza, sk-ant) in src/ + netlify/
// ============================================================================

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// --- Terminal colors ---
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const PASS = `${GREEN}✅${RESET}`;
const FAIL = `${RED}❌${RESET}`;

const results = [];
let failures = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok });
  if (!ok) failures++;
  console.log(
    `  ${ok ? PASS : FAIL} ${BOLD}${name}${RESET}${detail ? ` ${DIM}— ${detail}${RESET}` : ""}`
  );
}

function readDirRecursive(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) readDirRecursive(full, acc);
    else acc.push(full);
  }
  return acc;
}

function fileContains(file, pattern) {
  try {
    return pattern.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|svg)$/i;

console.log(`\n${BOLD}${CYAN}Prompt-to-PWA — Smoke Test${RESET}\n`);

// ---------------------------------------------------------------------------
// 1. Required env vars: set in process.env or documented in .env.example
// ---------------------------------------------------------------------------
console.log(`${BOLD}${DIM}1. Environment variables${RESET}`);

const REQUIRED_ENV_KEYS = [
  "VITE_POCKETBASE_URL",
  "POCKETBASE_ADMIN_EMAIL",
  "POCKETBASE_ADMIN_PASSWORD",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRO_PRICE_ID",
];

const envExamplePath = join(PROJECT_ROOT, ".env.example");
const envExampleContent = existsSync(envExamplePath)
  ? readFileSync(envExamplePath, "utf8")
  : "";
const documentedKeys = new Set(
  envExampleContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean)
);

const missingKeys = [];
for (const key of REQUIRED_ENV_KEYS) {
  const isSet = Boolean(process.env[key]);
  const isDocumented = documentedKeys.has(key);
  if (!isSet && !isDocumented) missingKeys.push(key);
}

record(
  "Required env vars are set or documented in .env.example",
  missingKeys.length === 0,
  missingKeys.length > 0
    ? `missing: ${missingKeys.join(", ")}`
    : `${REQUIRED_ENV_KEYS.length} required keys accounted for`
);

// ---------------------------------------------------------------------------
// 2. Netlify functions exist and export a handler
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}2. Netlify functions${RESET}`);

const FUNCTION_FILES = [
  "generate-blueprint.mjs",
  "compile-app.mjs",
  "download-app.mjs",
  "stripe-webhook.mjs",
  "create-checkout-session.mjs",
  "refund-credit.mjs",
];
const functionsDir = join(PROJECT_ROOT, "netlify", "functions");
const handlerExportPattern =
  /export\s+default\s+(?:async\s+)?function\s+handler\b|\bexport\s*\{[^}]*\bhandler\b[^}]*\}/;

for (const f of FUNCTION_FILES) {
  const filePath = join(functionsDir, f);
  const exists = existsSync(filePath);
  const exportsHandler = exists && fileContains(filePath, handlerExportPattern);
  record(
    `Function ${f} exists and exports a handler`,
    exists && exportsHandler,
    !exists
      ? "file missing"
      : exportsHandler
        ? "export default handler"
        : "no handler export found"
  );
}

// ---------------------------------------------------------------------------
// 3. Production build
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}3. Production build${RESET}`);

let buildOk = false;
let buildDetail = "";
try {
  execSync("npm run build", {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    encoding: "utf8",
    shell: true,
  });
  buildOk = true;
} catch (err) {
  const out = String((err && err.stdout) || "") + String((err && err.stderr) || "");
  buildDetail = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-4)
    .join(" | ");
}
record(
  "npm run build exits 0",
  buildOk,
  buildOk ? "tsc + vite build succeeded" : buildDetail || "build failed"
);

// ---------------------------------------------------------------------------
// 4. PWA manifest
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}4. PWA manifest${RESET}`);

const manifestPath = join(PROJECT_ROOT, "public", "manifest.webmanifest");
let manifestOk = false;
let manifestDetail = "file missing";
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifestOk = Boolean(
      manifest.name && Array.isArray(manifest.icons) && manifest.icons.length > 0
    );
    manifestDetail = manifestOk
      ? `valid JSON (${manifest.icons.length} icons)`
      : "parses as JSON but missing name or icons";
  } catch (e) {
    manifestDetail = `invalid JSON: ${e.message}`;
  }
}
record(
  "public/manifest.webmanifest exists and parses as valid JSON",
  manifestOk,
  manifestDetail
);

// ---------------------------------------------------------------------------
// 5. Service worker
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}5. Service worker${RESET}`);

const swPath = join(PROJECT_ROOT, "public", "sw.js");
record(
  "public/sw.js exists",
  existsSync(swPath),
  existsSync(swPath) ? "service worker present" : "file missing"
);

// ---------------------------------------------------------------------------
// 6. No unsafe iframe sandbox flags in src/
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}6. Security: no allow-same-origin in src/${RESET}`);

const srcDir = join(PROJECT_ROOT, "src");
const srcFiles = readDirRecursive(srcDir).filter((f) => TEXT_EXT.test(f));
const sandboxHits = srcFiles.filter((f) => fileContains(f, /allow-same-origin/));
record(
  "Zero matches for allow-same-origin in src/",
  sandboxHits.length === 0,
  sandboxHits.length > 0
    ? `found in: ${sandboxHits.map((f) => f.replace(PROJECT_ROOT + "\\", "")).join(", ")}`
    : "clean"
);

// ---------------------------------------------------------------------------
// 8. Client/server request-contract consistency (guards C1/C3/C4 regressions)
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}8. Request-contract consistency (C1/C3/C4)${RESET}`);

const srcDir2 = join(PROJECT_ROOT, "src");
const useGenerationFlowPath = join(srcDir2, "hooks", "useGenerationFlow.ts");
const previewSandboxPath = join(srcDir2, "components", "PreviewSandbox.tsx");
const generateBlueprintPath = join(functionsDir, "generate-blueprint.mjs");
const compileAppPath = join(functionsDir, "compile-app.mjs");
const downloadAppPath = join(functionsDir, "download-app.mjs");

const genFlow = existsSync(useGenerationFlowPath)
  ? readFileSync(useGenerationFlowPath, "utf8")
  : "";
const sandbox = existsSync(previewSandboxPath)
  ? readFileSync(previewSandboxPath, "utf8")
  : "";
const genBp = existsSync(generateBlueprintPath)
  ? readFileSync(generateBlueprintPath, "utf8")
  : "";
const compile = existsSync(compileAppPath)
  ? readFileSync(compileAppPath, "utf8")
  : "";
const download = existsSync(downloadAppPath)
  ? readFileSync(downloadAppPath, "utf8")
  : "";

// C1: client sends flat { prompt, purpose, roles, coreAction }; server destructures flat
const c1ok =
  /prompt:\s*wizardData\.prompt/.test(genFlow) &&
  /roles:\s*wizardData\.roles\.map/.test(genFlow) &&
  /const \{ prompt, purpose, roles, coreAction \} = body;/.test(genBp);
record(
  "C1 generate-blueprint: client sends flat shape, server reads flat shape",
  c1ok,
  c1ok ? "useGenerationFlow + generate-blueprint aligned" : "MISMATCH"
);

// C3: client sends jobId; server reads { jobId, blueprint }
const c3ok =
  /jobId:\s*state\.appId/.test(genFlow) &&
  /const \{ jobId, blueprint \} = body;/.test(compile);
record(
  "C3 compile-app: client sends jobId, server reads { jobId, blueprint }",
  c3ok,
  c3ok ? "useGenerationFlow + compile-app aligned" : "MISMATCH"
);

// C4: client GETs ?jobId= with Authorization; server accepts GET + query param
const c4ok =
  /download-app\?jobId=/.test(sandbox) &&
  /method: "GET"/.test(sandbox) &&
  /event\.httpMethod !== 'GET'/.test(download) &&
  /queryStringParameters\?\.jobId/.test(download);
record(
  "C4 download-app: client GET ?jobId= + Bearer, server GET + query param",
  c4ok,
  c4ok ? "PreviewSandbox + download-app aligned" : "MISMATCH"
);

// ---------------------------------------------------------------------------
// 9. No hardcoded API keys in src/ + netlify/
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}9. Security: no hardcoded API keys (sk-, AIza, sk-ant)${RESET}`);

const keyPattern = /(sk-|AIza|sk-ant)/;
const keyHits = [];
for (const dir of [srcDir, join(PROJECT_ROOT, "netlify")]) {
  for (const f of readDirRecursive(dir)) {
    if (TEXT_EXT.test(f) && fileContains(f, keyPattern)) keyHits.push(f);
  }
}
record(
  "Zero matches for (sk-, AIza, sk-ant) in src/ + netlify/",
  keyHits.length === 0,
  keyHits.length > 0
    ? `found in: ${keyHits.map((f) => f.replace(PROJECT_ROOT + "\\", "")).join(", ")}`
    : "clean"
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${BOLD}${DIM}──────────────────────────────────────────────${RESET}`);
if (failures === 0) {
  console.log(
    `  ${GREEN}${BOLD}ALL CHECKS PASSED${RESET} — ${results.length}/${results.length} ✅\n`
  );
  process.exit(0);
} else {
  console.log(
    `  ${RED}${BOLD}${failures} CHECK(S) FAILED${RESET} — ${results.length - failures}/${results.length} passed\n`
  );
  process.exit(1);
}
