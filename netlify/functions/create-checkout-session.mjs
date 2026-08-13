import Stripe from "stripe";
import PocketBase from "pocketbase";
import { rateLimit } from "./_middleware.mjs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const POCKETBASE_URL = process.env.POCKETBASE_URL;
const SITE_URL =
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "http://localhost:8888";

function log(level, message, data) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  if (data) entry.data = data;
  console[level](JSON.stringify(entry));
}

export default async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "method_not_allowed",
        message: "Only POST is allowed",
      }),
    };
  }

  // M9: rate limit (30/min default per IP) — checkout creation should be
  // cheap but protected against abuse loops.
  const limited = rateLimit(event, "default");
  if (limited) return limited;

  if (!STRIPE_SECRET_KEY || !STRIPE_PRO_PRICE_ID || !POCKETBASE_URL) {
    log("error", "Missing required environment variables for create-checkout-session");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "server_configuration_error",
        message: "Server is not configured properly",
      }),
    };
  }

  // Authenticate user via PocketBase token
  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "unauthorized",
        message: "Missing or invalid Authorization header",
      }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const pb = new PocketBase(POCKETBASE_URL);

  let user;
  try {
    pb.authStore.save(token, null);
    const refreshed = await pb.collection("users").authRefresh();
    user = refreshed.record;
  } catch {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "unauthorized",
        message: "Invalid or expired session",
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
        error: "invalid_json",
        message: "Request body must be valid JSON",
      }),
    };
  }

  const { plan } = body;

  if (plan !== "pro") {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        error: "invalid_plan",
        message: 'Only "pro" plan is available for checkout',
      }),
    };
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${SITE_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/dashboard?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        plan,
        userId: user.id,
        pb_user_id: user.id,
      },
      customer_email: user.email,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          pb_user_id: user.id,
        },
      },
    });

    log("info", "Stripe checkout session created", {
      sessionId: session.id,
      userId: user.id,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    log("error", "Stripe checkout session creation failed", {
      error: err.message,
      userId: user.id,
    });
    // m11: never leak internal Stripe error details to the client.
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "stripe_error",
        message: "Could not start checkout. Please try again.",
      }),
    };
  }
}
