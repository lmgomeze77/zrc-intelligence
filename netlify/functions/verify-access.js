// netlify/functions/verify-access.js
// Validates a purchase access token against Supabase `purchases` table.
//
// POST body: { token: "<uuid>" }
// Response:  { valid: true }  or  { valid: false }
//
// Called by page/content.html before revealing course materials.
// Returns 200 in all cases — the `valid` flag drives the UI decision.
//
// Required env vars:
//   SUPABASE_URL              — https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY

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
    return { statusCode: 405, headers, body: JSON.stringify({ valid: false }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("verify-access: missing Supabase env vars");
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false }) };
  }

  let token;
  try {
    const body = JSON.parse(event.body || "{}");
    token = (body.token || "").trim();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ valid: false }) };
  }

  // Basic UUID format check before hitting the database
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/purchases?access_token=eq.${encodeURIComponent(token)}&active=eq.true&select=id`,
      {
        headers: {
          "apikey":        SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("verify-access: Supabase error —", res.status, err);
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
    }

    const rows = await res.json();
    const valid = Array.isArray(rows) && rows.length > 0;

    console.log(`verify-access: token ${token.slice(0, 8)}… → ${valid}`);
    return { statusCode: 200, headers, body: JSON.stringify({ valid }) };

  } catch (err) {
    console.error("verify-access: unexpected error —", err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false }) };
  }
};
