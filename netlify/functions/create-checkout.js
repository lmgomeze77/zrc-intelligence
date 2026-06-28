// netlify/functions/create-checkout.js
// Creates a Stripe Hosted Checkout session for ZRC-ACAD-GRM-01 (€29 one-time).
//
// POST body (optional): { email }
// Response:             { url }   ← frontend redirects the browser to this URL
//
// Required env vars:
//   STRIPE_SECRET_KEY  — sk_live_... (or sk_test_... for testing)
//
// After successful payment Stripe redirects to:
//   /academia/courses/geopolitical-risk-management/page/course-page.html
//     ?payment=success&session_id={CHECKOUT_SESSION_ID}
//
// The stripe-webhook function handles checkout.session.completed to record
// the purchase in Supabase and send the access email via Resend.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const COURSE = {
  id:          "ZRC-ACAD-GRM-01",
  name:        "Gestión del Riesgo Geopolítico para la Inversión",
  description: "Masterclass 28 min · Manual ES+EN · 21 diapositivas · 4 ejercicios de análisis · Subtítulos SRT",
  amount:      2900,  // unit amount in cents (€29.00)
  currency:    "eur",
};

const RETURN_PATH = "/academia/courses/geopolitical-risk-management/page/course-page.html";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type":                 "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("create-checkout: missing STRIPE_SECRET_KEY");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Service configuration error." }),
    };
  }

  try {
    // Optional: pre-fill customer email in Stripe Checkout
    const body = event.body ? JSON.parse(event.body) : {};
    const rawEmail = (body.email || "").trim().toLowerCase();
    const customerEmail = rawEmail.includes("@") && rawEmail.includes(".") ? rawEmail : undefined;

    // Build base URL from Netlify-injected headers
    const host  = event.headers["x-forwarded-host"] || event.headers.host || "localhost:8888";
    const proto = event.headers["x-forwarded-proto"] || "https";
    const base  = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      locale:               "auto",
      allow_promotion_codes: true,
      customer_creation:    "always",

      ...(customerEmail && { customer_email: customerEmail }),

      line_items: [{
        price_data: {
          currency:     COURSE.currency,
          unit_amount:  COURSE.amount,
          product_data: {
            name:        COURSE.name,
            description: COURSE.description,
            metadata:    { course_id: COURSE.id },
          },
        },
        quantity: 1,
      }],

      // Propagate course_id to both the session and the underlying PaymentIntent
      // so the webhook can identify the purchase from either object.
      metadata: { course_id: COURSE.id },
      payment_intent_data: {
        metadata: { course_id: COURSE.id },
      },

      success_url: `${base}${RETURN_PATH}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}${RETURN_PATH}?payment=cancelled`,
    });

    console.log(`create-checkout: session created — ${session.id} (${customerEmail || "anon"})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error("create-checkout error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Could not create checkout session. Please try again." }),
    };
  }
};
