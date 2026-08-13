// ============================================================================
// netlify/functions/_middleware.mjs
// Shared middleware for all Netlify Functions — rate limiting, auth,
// structured logging, and safe error responses.
//
// NOTE: Netlify does NOT natively support a `_middleware` convention for
// functions. This module exports helper functions that each function
// imports and calls at the top of its handler.
//
// Usage in each function:
//   import { rateLimit, secureHandler, withLogging } from "./_middleware.mjs";
// ============================================================================

// ==========================================================================
// Structured JSON Logging
// ==========================================================================

/**
 * Emit a structured JSON log line to stdout (picked up by Netlify log drain).
 * NEVER log API keys, tokens, or full user data.
 */
function log(level, message, data) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  if (data) {
    // Redact any sensitive fields that may slip through
    const safe = { ...data };
    for (const key of Object.keys(safe)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("key") ||
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization")
      ) {
        safe[key] = "[REDACTED]";
      }
    }
    entry.data = safe;
  }
  console[level](JSON.stringify(entry));
}

// ==========================================================================
// Rate Limiting (in-memory, per-function-instance)
// ==========================================================================

/**
 * Simple in-memory rate limiter.
 *
 * WARNING: This is per-Lambda-instance only. Netlify Functions scale
 * horizontally, so multiple instances each have their own counters.
 * For production with serious traffic, use:
 *   - Netlify's built-in rate limiting (available on Pro/Enterprise plans)
 *   - Redis-backed counter (Upstash, etc.)
 *   - A Netlify Edge Function for pre-function rate limiting
 *
 * This implementation is adequate for MVP traffic (<several hundred RPM).
 */

/** @type {Map<string, {count: number, resetAt: number}>} */
const rateLimitStore = new Map();

// Periodic cleanup — purge stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if a request exceeds rate limits.
 *
 * @param {"generate-blueprint"|"compile-app"|"default"} endpoint
 * @param {string} identifier — IP address or user ID
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
function checkRateLimit(endpoint, identifier) {
  cleanupStore();

  const limits = {
    "generate-blueprint": { max: 10, windowMs: 60_000 },    // 10/min per IP
    "compile-app":         { max: 5,  windowMs: 60_000 },    //  5/min per user
    "default":             { max: 30, windowMs: 60_000 },    // 30/min per IP
  };

  const config = limits[endpoint] || limits.default;
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true };
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Extract a stable client identifier from the Netlify event.
 * Uses client IP. For authenticated endpoints, prepend user ID for
 * per-user rate limiting.
 */
function getClientIdentifier(event, userId) {
  const ip =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown";

  return userId ? `${userId}:${ip}` : ip;
}

/**
 * Apply rate limiting. Returns a 429 response if exceeded, or null if allowed.
 *
 * @param {object} event — Netlify function event
 * @param {"generate-blueprint"|"compile-app"|"default"} endpoint
 * @param {string|null} userId — authenticated user ID (if available)
 * @returns {object|null} 429 response object, or null if allowed
 */
function rateLimit(event, endpoint = "default", userId = null) {
  const identifier = getClientIdentifier(event, userId);
  const result = checkRateLimit(endpoint, identifier);

  if (!result.allowed) {
    log("warn", "Rate limit exceeded", {
      endpoint,
      identifier: `${identifier.substring(0, 8)}...`,
      retryAfterMs: result.retryAfterMs,
    });

    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
        "X-RateLimit-Reset": (Date.now() + result.retryAfterMs).toString(),
      },
      body: JSON.stringify({
        error: "rate_limited",
        message: `Too many requests. Please wait ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
        retryAfterMs: result.retryAfterMs,
      }),
    };
  }

  return null; // allowed
}

// ==========================================================================
// Error Response Helpers — NEVER leak API keys or stack traces
// ==========================================================================

/**
 * Build a safe error response from any caught error.
 * Strips API keys, stack traces, and sensitive details from the response body.
 */
function safeErrorResponse(statusCode, error, extra = {}) {
  // NEVER include raw error message in 500 responses — may contain API keys,
  // internal URLs, or stack traces
  const isInternalError = statusCode >= 500;

  const message = isInternalError
    ? "An internal error occurred. Our team has been notified."
    : error?.message || "An error occurred";

  log("error", "Request error", {
    statusCode,
    errorMessage: isInternalError ? "[REDACTED]" : error?.message,
    errorName: error?.name,
  });

  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: error?.name || "error",
      message,
      ...extra,
    }),
  };
}

// ==========================================================================
// Authorization Header Validator
// ==========================================================================

/**
 * Extract and validate the Authorization header format.
 * Does NOT verify the token itself — callers must do PocketBase verification.
 *
 * @returns {{ valid: true, token: string } | { valid: false, error: object }}
 */
function extractAuthToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader) {
    return {
      valid: false,
      error: { statusCode: 401, body: { error: "unauthorized", message: "Missing Authorization header" } },
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: { statusCode: 401, body: { error: "unauthorized", message: "Authorization header must use Bearer scheme" } },
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return {
      valid: false,
      error: { statusCode: 401, body: { error: "unauthorized", message: "Empty Bearer token" } },
    };
  }

  return { valid: true, token };
}

// ==========================================================================
// Structured Handler Wrapper
// ==========================================================================

/**
 * Wraps a Netlify function handler with:
 *   - CORS headers (OPTIONS preflight)
 *   - Structured JSON error logging
 *   - Safe error responses (no stack traces leaked)
 *
 * Usage:
 *   export default async function handler(event) {
 *     return secureHandler(event, { allowedMethods: ["POST"] }, async () => {
 *       // ... your logic here
 *       return { statusCode: 200, body: JSON.stringify({ ok: true }) };
 *     });
 *   }
 *
 * @param {object} event
 * @param {{ allowedMethods?: string[], requireAuth?: boolean }} opts
 * @param {() => Promise<object>} fn
 */
async function secureHandler(event, opts = {}, fn) {
  const allowedMethods = opts.allowedMethods || ["GET", "POST"];

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": allowedMethods.join(", "),
        "Access-Control-Max-Age": "86400",
      },
      body: "",
    };
  }

  // Validate HTTP method
  if (allowedMethods.length > 0 && !allowedMethods.includes(event.httpMethod)) {
    return safeErrorResponse(405, new Error(`Method ${event.httpMethod} not allowed. Use: ${allowedMethods.join(", ")}`));
  }

  // Run the actual handler with top-level error boundary
  try {
    const result = await fn();
    return result;
  } catch (err) {
    // Determine status code from error type
    let statusCode = 500;

    if (err.name === "CreditError" || err.message?.includes("insufficient_credits")) {
      statusCode = 402;
    } else if (err.name === "AuthError" || err.message?.includes("unauthorized")) {
      statusCode = 401;
    } else if (err.name === "ValidationError") {
      statusCode = 422;
    } else if (err.message?.includes("not found") || err.status === 404) {
      statusCode = 404;
    } else if (err.message?.includes("forbidden") || err.status === 403) {
      statusCode = 403;
    }

    return safeErrorResponse(statusCode, err);
  }
}

export {
  log,
  rateLimit,
  checkRateLimit,
  extractAuthToken,
  safeErrorResponse,
  secureHandler,
};
