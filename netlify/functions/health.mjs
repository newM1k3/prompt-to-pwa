// ============================================================================
// netlify/functions/health.mjs
// Health check endpoint — verifies PocketBase connectivity and returns
// system status. Called by monitoring tools and CI post-deploy checks.
// ============================================================================

const POCKETBASE_URL = process.env.POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function log(level, message, data) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
}

async function checkPocketBase() {
  if (!POCKETBASE_URL) {
    return { status: "unconfigured", message: "POCKETBASE_URL not set" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${POCKETBASE_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return { status: "ok", code: data.code || response.status };
    }

    return { status: "error", code: response.status };
  } catch (err) {
    return {
      status: "unreachable",
      message: err.name === "AbortError" ? "timeout" : err.message,
    };
  }
}

function checkEnvVars() {
  const required = {
    POCKETBASE_URL,
    POCKETBASE_ADMIN_EMAIL,
    POCKETBASE_ADMIN_PASSWORD,
    GEMINI_API_KEY,
    ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, val]) => !val)
    .map(([key]) => key);

  const configured = Object.keys(required).filter((k) => !missing.includes(k));

  return {
    total: Object.keys(required).length,
    configured: configured.length,
    missing,
    allConfigured: missing.length === 0,
  };
}

export default async function handler(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();

  // Run checks in parallel
  const [pbHealth, envStatus] = await Promise.all([
    checkPocketBase(),
    Promise.resolve(checkEnvVars()),
  ]);

  const responseTimeMs = Date.now() - startTime;

  // Determine overall status
  let overallStatus = "ok";
  if (!envStatus.allConfigured) {
    overallStatus = "degraded";
  }
  if (pbHealth.status === "error" || pbHealth.status === "unreachable") {
    overallStatus = "degraded";
  }
  if (pbHealth.status === "unreachable" && !envStatus.allConfigured) {
    overallStatus = "unhealthy";
  }

  const result = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: responseTimeMs,
    checks: {
      pocketbase: pbHealth,
      environment: envStatus,
    },
    version: "1.0.0",
  };

  log("info", `Health check: ${overallStatus}`, { responseTimeMs, pbStatus: pbHealth.status });

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return new Response(JSON.stringify(result), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
