import PocketBase from 'pocketbase';

// ============================================================================
// refund-credit.mjs
// Server-side, idempotent credit refund (M5).
//
// The client NEVER touches credits_remaining — refunds must happen here (or
// via the shared helper imported by compile-app.mjs) using admin auth, and
// only once per app record (guarded by the `refunded` boolean field).
//
// Also exported as a Netlify function for manual/support refunds:
//   POST /.netlify/functions/refund-credit  { appId }
// Requires the owner's Bearer token; verifies ownership before refunding.
// ============================================================================

const POCKETBASE_URL = process.env.POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

function log(level, message, data) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
}

async function adminAuth(pb) {
  try {
    await pb.admins.authWithPassword(
      POCKETBASE_ADMIN_EMAIL,
      POCKETBASE_ADMIN_PASSWORD
    );
    return true;
  } catch (err) {
    log('error', 'PocketBase admin auth failed', { error: err.message });
    return false;
  }
}

/**
 * Refund 1 credit for an app record — exactly once.
 * Requires an already-admin-authed pb client.
 *
 * @param {import('pocketbase')} pb
 * @param {string} appId  generated_apps record id
 * @param {string} userId owner id (used to find the user to credit)
 * @returns {Promise<{ refunded: boolean, alreadyRefunded: boolean }>}
 */
export async function refundCreditForApp(pb, appId, userId) {
  const record = await pb.collection('generated_apps').getOne(appId);
  if (record.refunded) {
    log('info', 'Refund skipped — record already refunded', { appId });
    return { refunded: false, alreadyRefunded: true };
  }

  const user = await pb.collection('users').getOne(userId);
  await pb.collection('users').update(userId, {
    'credits_remaining+': 1,
  });

  // Mark the record as refunded BEFORE the credit write would be considered
  // durable by any concurrent caller (PocketBase has no CAS — this flag is
  // the double-refund guard).
  await pb.collection('generated_apps').update(appId, { refunded: true });

  log('info', 'Credit refunded server-side', {
    appId,
    userId,
    newBalance: (user.credits_remaining || 0) + 1,
  });
  return { refunded: true, alreadyRefunded: false };
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
      body: JSON.stringify({
        error: 'method_not_allowed',
        message: 'Only POST is allowed',
      }),
    };
  }

  if (!POCKETBASE_URL || !POCKETBASE_ADMIN_EMAIL || !POCKETBASE_ADMIN_PASSWORD) {
    log('error', 'Missing required environment variables');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'server_configuration_error',
        message: 'Server is not configured properly',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'invalid_json',
        message: 'Request body must be valid JSON',
      }),
    };
  }

  const { appId } = body;
  if (!appId) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        error: 'invalid_input',
        message: 'appId is required',
        field: 'appId',
      }),
    };
  }

  const pb = new PocketBase(POCKETBASE_URL);

  const user = await authenticateUser(pb, event.headers.authorization);
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: 'unauthorized',
        message: 'Invalid or expired session',
      }),
    };
  }

  // Ownership check before refunding.
  let appRecord;
  try {
    appRecord = await pb.collection('generated_apps').getOne(appId);
  } catch {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'not_found',
        message: 'App record not found',
      }),
    };
  }
  if (appRecord.user !== user.id) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        error: 'forbidden',
        message: 'You do not own this app',
      }),
    };
  }

  const adminOk = await adminAuth(pb);
  if (!adminOk) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'database_unavailable',
        message: 'Unable to authenticate with database',
        retryable: true,
      }),
    };
  }

  try {
    const result = await refundCreditForApp(pb, appId, user.id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        refunded: result.refunded,
        alreadyRefunded: result.alreadyRefunded,
      }),
    };
  } catch (err) {
    log('error', 'Refund failed', { error: err.message, appId });
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'refund_failed',
        message: 'Unable to process refund',
        retryable: true,
      }),
    };
  }
}
