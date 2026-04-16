// netlify/functions/subscribe.js
// Adds a contact to the Resend audience when someone subscribes.
// Protected by Cloudflare Turnstile (server-side verification) + honeypot.

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { email, firstName, token, website } = JSON.parse(event.body || "{}");

    // ── Honeypot: silently drop bot submissions ───────────
    if (website) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ success: true, message: "OK" })
      };
    }

    // ── Email validation ──────────────────────────────────
    if (!email || !email.includes("@") || !email.includes(".")) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Please enter a valid email address." })
      };
    }

    // ── Turnstile verification ────────────────────────────
    if (!token) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Verification required. Please complete the challenge." })
      };
    }

    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;
    if (!TURNSTILE_SECRET) {
      console.error("Missing TURNSTILE_SECRET env var");
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: "Service configuration error." })
      };
    }

    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:
        "secret=" + encodeURIComponent(TURNSTILE_SECRET) +
        "&response=" + encodeURIComponent(token) +
        "&remoteip=" + encodeURIComponent(event.headers["x-nf-client-connection-ip"] || "")
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.warn("Turnstile verification failed:", JSON.stringify(verifyData));
      return {
        statusCode: 403, headers,
        body: JSON.stringify({ error: "Verification failed. Please try again." })
      };
    }

    // ── Resend audience add ───────────────────────────────
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
    if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
      console.error("Missing Resend environment variables");
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: "Service configuration error." })
      };
    }

    const response = await fetch(
      "https://api.resend.com/audiences/" + RESEND_AUDIENCE_ID + "/contacts",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          first_name: firstName ? firstName.trim() : "",
          unsubscribed: false
        })
      }
    );
    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(result));
      // If contact already exists, treat as success
      if (result.message && result.message.includes("already exists")) {
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, message: "You're already subscribed. See you tomorrow at 06:30 CET." })
        };
      }
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Subscription failed. Please try again." })
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: "Welcome to ZRC Morning Intelligence." })
    };
  } catch (err) {
    console.error("Subscribe error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Something went wrong. Please try again." })
    };
  }
};
