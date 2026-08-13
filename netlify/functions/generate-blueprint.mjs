import PocketBase from 'pocketbase';
import { rateLimit } from './_middleware.mjs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POCKETBASE_URL = process.env.POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

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

async function getCreditsRemaining(pb, userId) {
  const user = await pb.collection('users').getOne(userId);
  return user.credits_remaining;
}

async function decrementCredit(pb, userId) {
  // M4: use PocketBase's atomic `-` modifier instead of read-modify-write so
  // concurrent requests each decrement exactly 1. Then verify we never went
  // negative (double-click race) and self-correct if we did.
  const user = await pb.collection('users').getOne(userId);
  if ((user.credits_remaining || 0) <= 0) {
    throw new Error('insufficient_credits');
  }
  await pb.collection('users').update(userId, {
    'credits_remaining-': 1,
    'apps_generated_total+': 1,
  });
  const after = await pb.collection('users').getOne(userId);
  if (after.credits_remaining < 0) {
    await pb.collection('users').update(userId, { 'credits_remaining+': 1 });
    throw new Error('insufficient_credits');
  }
  return after;
}

async function refundCredit(pb, userId) {
  const user = await pb.collection('users').getOne(userId);
  await pb.collection('users').update(userId, {
    credits_remaining: user.credits_remaining + 1,
  });
  log('info', 'Credit refunded', { userId });
}

// M10: retry Gemini on 429/5xx with exponential backoff (2s, 4s).
async function callGeminiFlash(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini returned empty response: ${JSON.stringify(data)}`);
      }
      return text;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const waitMs = 2000 * Math.pow(2, attempt); // 2s, then 4s
    log('warn', `Gemini API ${response.status} — retrying in ${waitMs}ms`, {
      attempt: attempt + 1,
    });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error('Gemini API retries exhausted');
}

function buildGeminiPrompt(prompt, purpose, roles, coreAction) {
  // roles may arrive as string[] or { name }[] — normalize defensively.
  const rolesStr = (roles || [])
    .map((r) => (typeof r === 'string' ? r : r?.name ?? ''))
    .filter(Boolean)
    .join(', ');
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

function validateBlueprint(blueprint) {
  const errors = [];
  if (!blueprint || typeof blueprint !== 'object') {
    errors.push('Blueprint is not a valid object');
    return { valid: false, errors };
  }
  if (!blueprint.app_name || typeof blueprint.app_name !== 'string') {
    errors.push('Missing or invalid app_name');
  }
  if (!Array.isArray(blueprint.actors)) {
    errors.push('Missing or invalid actors (must be array)');
  } else if (blueprint.actors.length > 5) {
    blueprint.actors = blueprint.actors.slice(0, 5);
  }
  if (!Array.isArray(blueprint.actions)) {
    errors.push('Missing or invalid actions (must be array)');
  } else if (blueprint.actions.length > 10) {
    blueprint.actions = blueprint.actions.slice(0, 10);
  }
  if (!Array.isArray(blueprint.data_fields)) {
    errors.push('Missing or invalid data_fields (must be array)');
  } else if (blueprint.data_fields.length > 10) {
    blueprint.data_fields = blueprint.data_fields.slice(0, 10);
  }
  const validViews = ['list', 'map', 'calendar', 'form', 'dashboard'];
  if (!blueprint.primary_view || !validViews.includes(blueprint.primary_view)) {
    errors.push(`primary_view must be one of: ${validViews.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
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

  // M9: rate limit (per-IP, 10/min) before doing any work.
  const limited = rateLimit(event, 'generate-blueprint');
  if (limited) return limited;

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

  const { prompt, purpose, roles, coreAction } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: 'invalid_input', message: 'prompt is required', field: 'prompt' }),
    };
  }

  if (!GEMINI_API_KEY || !POCKETBASE_URL) {
    log('error', 'Missing required environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'server_configuration_error', message: 'Server is not configured properly' }),
    };
  }

  const pb = new PocketBase(POCKETBASE_URL);

  const user = await authenticateUser(pb, event.headers.authorization);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired session' }),
    };
  }

  // Auth as admin for ALL credit writes — the users collection update rule
  // must be locked against self-update (QA U2/M5); user-token writes would
  // 403 there. Admin auth keeps decrement/refund working regardless.
  const adminOk = await adminAuth(pb);
  if (!adminOk) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to authenticate with database', retryable: true }),
    };
  }

  const credits = await getCreditsRemaining(pb, user.id);
  if (credits < 1) {
    return {
      statusCode: 402,
      headers,
      body: JSON.stringify({
        error: 'insufficient_credits',
        message: `You have ${credits} credits remaining`,
        creditsRemaining: credits,
      }),
    };
  }

  try {
    await decrementCredit(pb, user.id);
  } catch (err) {
    if (err.message === 'insufficient_credits') {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ error: 'insufficient_credits', message: 'No credits remaining' }),
      };
    }
    log('error', 'Failed to decrement credit', { error: err.message });
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to update credits', retryable: true }),
    };
  }

  let geminiResponse;
  try {
    const geminiPrompt = buildGeminiPrompt(prompt, purpose || '', roles || [], coreAction || '');
    geminiResponse = await callGeminiFlash(geminiPrompt);
  } catch (err) {
    log('error', 'Gemini Flash API failed', { error: err.message });
    await refundCredit(pb, user.id).catch((e) => log('error', 'Refund failed', { error: e.message }));
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'ai_failure', message: 'Gemini Flash API returned an error', retryable: true }),
    };
  }

  let blueprint;
  try {
    blueprint = JSON.parse(geminiResponse);
  } catch {
    log('error', 'Gemini returned unparseable response', { raw: geminiResponse.substring(0, 500) });
    await refundCredit(pb, user.id).catch((e) => log('error', 'Refund failed', { error: e.message }));
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'ai_failure', message: 'Failed to parse blueprint from AI response', retryable: true }),
    };
  }

  const validation = validateBlueprint(blueprint);

  // C2: never persist an invalid blueprint — refund the credit and tell the
  // user to retry instead of consuming a credit for a broken record.
  if (!validation.valid) {
    log('warn', 'Blueprint failed validation — refunding credit', {
      errors: validation.errors.slice(0, 5),
    });
    await refundCredit(pb, user.id).catch((e) =>
      log('error', 'Refund failed', { error: e.message })
    );
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'ai_failure',
        message: 'The AI produced an invalid blueprint. Please try again.',
        retryable: true,
      }),
    };
  }

  // (adminAuth already done above — all credit writes + record creation
  // run with admin privileges so a locked users self-update rule can't 403.)
  let record;
  try {
    record = await pb.collection('generated_apps').create({
      user: user.id,
      original_prompt: prompt,
      blueprint_json: JSON.stringify(blueprint),
      app_name: blueprint.app_name,
      status: 'blueprinting',
    });
  } catch (err) {
    log('error', 'Failed to create generated_apps record', { error: err.message });
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'database_unavailable', message: 'Unable to save blueprint', retryable: true }),
    };
  }

  log('info', 'Blueprint generated successfully', { appId: record.id, userId: user.id });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      blueprint,
      appName: blueprint.app_name,
      recordId: record.id,
    }),
  };
}
