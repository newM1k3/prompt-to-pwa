import PocketBase from 'pocketbase';
import { Parser } from 'acorn';
import { rateLimit } from './_middleware.mjs';
import { refundCreditForApp } from './refund-credit.mjs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POCKETBASE_URL = process.env.POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const MAX_ATTEMPTS = 3;

function log(level, message, data) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
}

async function authenticateUser(pb, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    pb.authStore.save(token, null);
    const user = await pb.collection('users').authRefresh();
    return user.record;
  } catch (err) {
    log('warn', 'User auth failed', { error: err.message });
    return null;
  }
}

async function adminAuth(pb) {
  try {
    await pb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);
    return true;
  } catch (err) {
    log('error', 'PocketBase admin auth failed', { error: err.message });
    return false;
  }
}

// M10: retry Claude on 429/5xx with exponential backoff (2s, 4s) —
// 429s were previously fatal to all 3 attempts.
async function callClaude(messages, system) {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        temperature: 0.3,
        system,
        messages,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error(`Claude returned empty response: ${JSON.stringify(data)}`);
      }
      return content;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const waitMs = 2000 * Math.pow(2, attempt); // 2s, then 4s
    log('warn', `Anthropic API ${response.status} — retrying in ${waitMs}ms`, {
      attempt: attempt + 1,
    });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error('Anthropic API retries exhausted');
}

function extractHtml(text) {
  const doctypeMatch = text.match(/<!DOCTYPE html>/i);
  if (!doctypeMatch) {
    const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i);
    if (htmlMatch) return htmlMatch[0];
    return text;
  }

  const start = doctypeMatch.index;
  const endHtml = text.lastIndexOf('</html>');
  if (endHtml === -1) return text.substring(start);

  return text.substring(start, endHtml + 7);
}

function validateJavaScript(htmlContent) {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const errors = [];
  let match;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const scriptContent = match[1];
    if (!scriptContent.trim()) continue;

    try {
      Parser.parse(scriptContent, {
        ecmaVersion: 2020,
        sourceType: 'module',
        locations: true,
        allowAwaitOutsideFunction: true,
      });
    } catch (err) {
      errors.push({
        line: err.loc?.line,
        column: err.loc?.column,
        message: err.message,
      });
    }
  }

  if (errors.length === 0) {
    const allScripts = [...htmlContent.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    if (allScripts.length === 0) {
      return { valid: true, errors: [] };
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildSystemPrompt() {
  return `You are an expert frontend developer. Generate a self-contained HTML document that implements the following app specification.

RULES:
1. Output ONLY valid HTML with inline CSS using Tailwind CDN (https://cdn.tailwindcss.com).
2. Use vanilla JavaScript for all logic — NO React, NO frameworks.
3. The app must be mobile-first and responsive.
4. Include ALL data storage using localStorage.
5. Do NOT use any external APIs.
6. Output a single complete HTML file starting with <!DOCTYPE html>.
7. Do NOT include markdown backticks or explanations — just the HTML.`;
}

function buildInitialPrompt(blueprint, originalPrompt) {
  const bp = blueprint || {};
  const actors = (bp.actors || []).join(', ');
  const actions = (bp.actions || []).map((a, i) => `${i + 1}. ${a}`).join('\n');
  const dataFields = (bp.data_fields || []).join(', ');
  const appName = bp.app_name || 'Generated App';
  const primaryView = bp.primary_view || 'list';

  return `APP SPECIFICATION:
Name: ${appName}
Primary View: ${primaryView}
Actors/Roles: ${actors || 'General User'}

Core Actions:
${actions || '1. View and manage data'}

Data Fields to Track: ${dataFields || 'name, description, date'}

Original Description: ${originalPrompt || ''}

Implement a complete app with all these features. Include navigation between views if multiple views make sense for the app.`;
}

function buildRetryPrompt(originalPrompt, blueprint, errors) {
  const errorDetails = errors
    .map((e) => `- Line ${e.line}, Column ${e.column}: ${e.message}`)
    .join('\n');

  return `The previous code had these JavaScript errors:

${errorDetails}

Fix ALL of these errors and return the complete corrected HTML. Make sure every <script> block contains valid JavaScript with no syntax errors.

Original specification:
${originalPrompt || 'See below'}
Blueprint: ${JSON.stringify(blueprint || {}, null, 2)}`;
}

export default async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'method_not_allowed', message: 'Only POST is allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON' }),
    };
  }

  const { jobId, blueprint } = body;

  if (!jobId) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: 'invalid_input', message: 'jobId is required', field: 'jobId' }),
    };
  }

  if (!ANTHROPIC_API_KEY || !POCKETBASE_URL) {
    log('error', 'Missing required environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'server_configuration_error', message: 'Server is not configured properly' }),
    };
  }

  const pb = new PocketBase(POCKETBASE_URL);

  // Authenticate user
  const user = await authenticateUser(pb, event.headers.authorization);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired session' }),
    };
  }

  // M9: rate limit per user (5/min) — compile-app is the most expensive
  // endpoint (up to 3 Claude calls), so it needs protection.
  const limited = rateLimit(event, 'compile-app', user.id);
  if (limited) return limited;

  // Load the generated_apps record
  let appRecord;
  try {
    appRecord = await pb.collection('generated_apps').getOne(jobId);
  } catch (err) {
    log('error', 'Failed to load app record', { error: err.message, jobId });
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'not_found', message: 'App record not found' }),
    };
  }

  // Verify ownership
  if (appRecord.user !== user.id) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'forbidden', message: 'You do not own this app' }),
    };
  }

  // Auth as admin for writes
  const adminOk = await adminAuth(pb);
  if (!adminOk) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to authenticate with database', retryable: true }),
    };
  }

  // Update status to coding
  try {
    await pb.collection('generated_apps').update(jobId, { status: 'coding' });
  } catch (err) {
    log('error', 'Failed to update status', { error: err.message });
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to update app status', retryable: true }),
    };
  }

  const systemPrompt = buildSystemPrompt();
  const originalPrompt = appRecord.original_prompt || '';
  let bp = blueprint || {};
  if (!bp || typeof bp !== 'object' || Object.keys(bp).length === 0) {
    // m8: corrupt stored blueprint_json must not crash the handler after
    // status was already flipped to `coding` (stuck record).
    try {
      bp = appRecord.blueprint_json
        ? JSON.parse(appRecord.blueprint_json)
        : {};
    } catch (err) {
      log('warn', 'Stored blueprint_json is corrupt — falling back to empty blueprint', {
        error: err.message,
        jobId,
      });
      bp = {};
    }
  }
  const baseUserPrompt = buildInitialPrompt(bp, originalPrompt);

  // M1: track errors for the CURRENT attempt only. Earlier API failures must
  // not poison a later successful attempt (previously allErrors accumulated
  // across attempts, so recovery always misrouted to needs_review).
  let attemptErrors = [];
  let finalHtml = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    log('info', `Compile attempt ${attempt}/${MAX_ATTEMPTS}`, { jobId });

    try {
      let userMessage;
      if (attempt === 1) {
        userMessage = baseUserPrompt;
      } else {
        userMessage = buildRetryPrompt(originalPrompt, bp, attemptErrors);
      }

      const claudeResponse = await callClaude(
        [{ role: 'user', content: userMessage }],
        systemPrompt
      );

      const html = extractHtml(claudeResponse);

      // Validate JavaScript
      const validation = validateJavaScript(html);

      if (validation.valid) {
        attemptErrors = [];
        finalHtml = html;
        log('info', `Compile success on attempt ${attempt}`, { jobId });
        break;
      }

      // Record errors for the next attempt only
      attemptErrors = validation.errors;
      log('warn', `JS validation failed on attempt ${attempt}`, {
        jobId,
        errorCount: validation.errors.length,
        errors: validation.errors.slice(0, 3),
      });

      // If this is the last attempt, still save the HTML as best attempt
      if (attempt === MAX_ATTEMPTS) {
        finalHtml = html;
      }
    } catch (err) {
      log('error', `Claude API call failed on attempt ${attempt}`, { error: err.message, jobId });
      attemptErrors = [{ line: 0, column: 0, message: `API Error: ${err.message}` }];

      if (attempt === MAX_ATTEMPTS) {
        // All attempts exhausted - set status to needs_review + refund
        await markNeedsReview(pb, jobId, user.id, finalHtml || '');

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'needs_review',
            error: err.message,
            attempts: MAX_ATTEMPTS,
          }),
        };
      }
    }
  }

  // If we got valid HTML
  if (finalHtml && attemptErrors.length === 0) {
    try {
      await pb.collection('generated_apps').update(jobId, {
        status: 'ready',
        preview_html: finalHtml,
      });
    } catch (err) {
      log('error', 'Failed to save preview HTML', { error: err.message });
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to save compiled app', retryable: true }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ready',
        previewHtml: finalHtml,
        attempts,
      }),
    };
  }

  // Max retries exhausted with errors
  await markNeedsReview(pb, jobId, user.id, finalHtml || '');

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'needs_review',
      error: `All ${MAX_ATTEMPTS} compilation attempts had JavaScript errors`,
      attempts: MAX_ATTEMPTS,
    }),
  };
}

/**
 * M5: transition a failed compile to needs_review and refund the user's
 * credit SERVER-SIDE (idempotent via the `refunded` flag on the record).
 * The client no longer touches credits_remaining at all.
 */
async function markNeedsReview(pb, jobId, userId, html) {
  try {
    await pb.collection('generated_apps').update(jobId, {
      status: 'needs_review',
      preview_html: html,
    });
  } catch (err) {
    log('error', 'Failed to update error status', { error: err.message, jobId });
    return;
  }

  try {
    await refundCreditForApp(pb, jobId, userId);
  } catch (err) {
    log('error', 'Server-side refund failed', { error: err.message, jobId });
  }
}
