import Stripe from 'stripe';
import PocketBase from 'pocketbase';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const POCKETBASE_URL = process.env.POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const PRO_CREDITS = 200;
const FREE_CREDITS = 5;

// M7 (deploy-time): credits must RESET monthly. Free users get FREE_CREDITS
// back on a 30-day rolling window from first consumption; Pro users get
// PRO_CREDITS back on subscription renewal. There is NO automatic reset in
// this codebase yet — a PocketBase cron/hook (or Netlify scheduled function)
// must be deployed to flip `credits_remaining` back each month. Without it,
// free users get 5 credits once ever and Pro users 200 once ever.

function log(level, message, data) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
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

async function isEventProcessed(pb, eventId) {
  try {
    await pb.collection('stripe_events').getFirstListItem(`event_id="${eventId}"`);
    return true;
  } catch {
    return false;
  }
}

async function markEventProcessed(pb, eventId, eventType) {
  try {
    await pb.collection('stripe_events').create({
      event_id: eventId,
      type: eventType,
    });
  } catch (err) {
    log('warn', 'Failed to record stripe event', { error: err.message, eventId });
  }
}

export default async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'method_not_allowed', message: 'Only POST is allowed' }),
    };
  }

  // Validate required env vars
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !POCKETBASE_URL) {
    log('error', 'Missing required environment variables for stripe-webhook');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'server_configuration_error', message: 'Server is not configured properly' }),
    };
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  // Verify webhook signature
  let stripeEvent;
  try {
    // Netlify provides the raw body as event.body (already a string)
    // For webhook signature verification, we need the raw body
    const rawBody = event.body;
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log('error', 'Stripe webhook signature verification failed', { error: err.message });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'invalid_signature', message: 'Webhook signature verification failed' }),
    };
  }

  log('info', `Stripe webhook received: ${stripeEvent.type}`, { eventId: stripeEvent.id });

  // Initialize PocketBase
  const pb = new PocketBase(POCKETBASE_URL);
  const adminOk = await adminAuth(pb);
  if (!adminOk) {
    log('error', 'PocketBase admin auth failed during stripe webhook');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'database_unavailable' }),
    };
  }

  // Check idempotency - already processed?
  const alreadyProcessed = await isEventProcessed(pb, stripeEvent.id);
  if (alreadyProcessed) {
    log('info', 'Duplicate stripe event ignored', { eventId: stripeEvent.id });
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, duplicate: true }) };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.client_reference_id;
        const mode = session.mode;

        if (!userId) {
          log('warn', 'checkout.session.completed without client_reference_id', { sessionId: session.id });
          break;
        }

        if (mode === 'subscription') {
          // Activate Pro subscription
          await pb.collection('users').update(userId, {
            plan_tier: 'pro',
            credits_remaining: PRO_CREDITS,
            stripe_customer_id: session.customer,
          });
          log('info', 'Pro subscription activated', { userId, customerId: session.customer });
        } else if (mode === 'payment') {
          // One-time credit purchase
          const creditsPurchased = parseInt(session.metadata?.credits || '0', 10);
          if (creditsPurchased > 0) {
            const user = await pb.collection('users').getOne(userId);
            await pb.collection('users').update(userId, {
              credits_remaining: (user.credits_remaining || 0) + creditsPurchased,
            });
            log('info', 'Credits purchased', { userId, creditsPurchased, newBalance: user.credits_remaining + creditsPurchased });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;
        if (sub.status === 'canceled' || sub.status === 'unpaid') {
          const userId = sub.metadata?.pb_user_id;
          if (userId) {
            await pb.collection('users').update(userId, {
              plan_tier: 'free',
              credits_remaining: FREE_CREDITS,
            });
            log('info', 'Subscription canceled/unpaid - downgraded to free', { userId });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const userId = sub.metadata?.pb_user_id;
        if (userId) {
          await pb.collection('users').update(userId, {
            plan_tier: 'free',
            credits_remaining: FREE_CREDITS,
          });
          log('info', 'Subscription deleted - downgraded to free', { userId });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        log('warn', 'Invoice payment failed', {
          customerId: invoice.customer,
          invoiceId: invoice.id,
        });
        break;
      }

      default: {
        log('info', `Unhandled stripe event type: ${stripeEvent.type}`, { eventId: stripeEvent.id });
      }
    }

    // Mark event as processed
    await markEventProcessed(pb, stripeEvent.id, stripeEvent.type);
  } catch (err) {
    log('error', 'Error processing stripe webhook event', {
      error: err.message,
      eventType: stripeEvent.type,
      eventId: stripeEvent.id,
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'processing_error', message: 'Failed to process webhook event' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ received: true }),
  };
}
