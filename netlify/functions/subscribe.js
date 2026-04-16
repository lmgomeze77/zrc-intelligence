// netlify/functions/subscribe.js
// Adds a contact to Resend audience AND Supabase subscribers table.
// Protected by Cloudflare Turnstile (server-side verification) + honeypot.
// Supabase has a case-insensitive unique index on email — duplicates return 409.

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

    // ── Normalize email ───────────────────────────────────
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = firstName ? firstName.trim() : "";

    // ── Insert into Supabase (source of truth for briefings) ──
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let isAlreadySubscribed = false;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supaRes = await fetch(
        SUPABASE_URL + "/rest/v1/subscribers",
        {
          method: "POST",
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            email: cleanEmail,
            name: cleanName,
            active: true
          })
        }
      );

      if (!supaRes.ok) {
        const supaBody = await supaRes.text();

        // 409 = unique constraint violation (duplicate email)
        if (supaRes.status === 409 || supaBody.includes("23505")) {
          console.log("Supabase: subscriber already exists — " + cleanEmail);
          isAlreadySubscribed = true;
        } else {
          // Log but don't block — Resend insert can still proceed
          console.error("Supabase insert error:", supaRes.status, supaBody);
        }
      } else {
        console.log("Supabase: new subscriber added — " + cleanEmail);
      }
    } else {
      console.warn("Supabase env vars missing — skipping Supabase insert");
    }

    // ── Add to Resend audience (for contact management) ───
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

    if (RESEND_API_KEY && RESEND_AUDIENCE_ID) {
      const resendRes = await fetch(
        "https://api.resend.com/audiences/" + RESEND_AUDIENCE_ID + "/contacts",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + RESEND_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: cleanEmail,
            first_name: cleanName,
            unsubscribed: false
          })
        }
      );
      const resendResult = await resendRes.json();

      if (!resendRes.ok) {
        if (resendResult.message && resendResult.message.includes("already exists")) {
          console.log("Resend: contact already exists — " + cleanEmail);
          isAlreadySubscribed = true;
        } else {
          // Log but don't fail the request — Supabase insert may have succeeded
          console.error("Resend error:", JSON.stringify(resendResult));
        }
      } else {
        console.log("Resend: contact added — " + cleanEmail);
      }
    } else {
      console.warn("Resend env vars missing — skipping Resend insert");
    }

    // ── Response ──────────────────────────────────────────
    if (isAlreadySubscribed) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          message: "You're already subscribed. See you tomorrow at 06:30 CET."
        })
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        message: "Welcome to ZRC Morning Intelligence."
      })
    };

  } catch (err) {
    console.error("Subscribe error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Something went wrong. Please try again." })
    };
  }
};
