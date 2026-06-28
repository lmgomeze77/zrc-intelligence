// netlify/functions/stripe-webhook.js
// Handles Stripe webhook events for ZRC Academia course purchases.
//
// Listens for: checkout.session.completed
// On success:
//   1. Inserts a row into Supabase `purchases` table
//   2. Sends access email via Resend with a one-click link
//
// Required env vars:
//   STRIPE_SECRET_KEY        — sk_live_... / sk_test_...
//   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe Dashboard → Webhooks)
//   SUPABASE_URL             — https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL        — e.g. academia@zenithrisecapital.com
//
// Supabase table required (run once in Supabase SQL editor):
//
//   CREATE TABLE purchases (
//     id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     email             text NOT NULL,
//     course_id         text NOT NULL,
//     stripe_session_id text UNIQUE NOT NULL,
//     access_token      uuid NOT NULL DEFAULT gen_random_uuid(),
//     created_at        timestamptz NOT NULL DEFAULT now(),
//     active            boolean NOT NULL DEFAULT true
//   );
//   CREATE INDEX purchases_token_idx ON purchases (access_token);
//   CREATE INDEX purchases_email_idx ON purchases (email);
//
// Netlify webhook endpoint to register in Stripe Dashboard:
//   https://YOUR_NETLIFY_DOMAIN/.netlify/functions/stripe-webhook
// Events to select:  checkout.session.completed

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const CONTENT_PATH = "/academia/courses/geopolitical-risk-management/page/content.html";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // ── Verify Stripe signature ───────────────────────────
  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("stripe-webhook: missing STRIPE_WEBHOOK_SECRET");
    return { statusCode: 500, body: "Service configuration error." };
  }

  let stripeEvent;
  try {
    // event.body is the raw payload string — required for signature verification
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.warn("stripe-webhook: signature verification failed —", err.message);
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  // ── Only handle completed checkout sessions ───────────
  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const session = stripeEvent.data.object;
  const courseId = session.metadata?.course_id;
  const email    = session.customer_details?.email?.trim().toLowerCase();

  if (!email || !courseId) {
    console.error("stripe-webhook: missing email or course_id in session", session.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, warning: "missing metadata" }) };
  }

  console.log(`stripe-webhook: processing purchase — ${email} / ${courseId} / ${session.id}`);

  // ── Insert purchase record in Supabase ────────────────
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let accessToken = null;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("stripe-webhook: missing Supabase env vars");
  } else {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
      method: "POST",
      headers: {
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
      },
      body: JSON.stringify({
        email,
        course_id:         courseId,
        stripe_session_id: session.id,
        active:            true,
      }),
    });

    if (supaRes.ok) {
      const [row] = await supaRes.json();
      accessToken = row?.access_token;
      console.log(`stripe-webhook: Supabase record created — token ${accessToken}`);
    } else {
      const body = await supaRes.text();
      // 409 = duplicate session (webhook retried by Stripe) — safe to continue
      if (supaRes.status === 409 || body.includes("23505")) {
        console.log("stripe-webhook: duplicate session, fetching existing token");
        const fetchRes = await fetch(
          `${SUPABASE_URL}/rest/v1/purchases?stripe_session_id=eq.${encodeURIComponent(session.id)}&select=access_token`,
          {
            headers: {
              "apikey":        SUPABASE_KEY,
              "Authorization": `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        if (fetchRes.ok) {
          const [row] = await fetchRes.json();
          accessToken = row?.access_token;
        }
      } else {
        console.error("stripe-webhook: Supabase insert error —", supaRes.status, body);
      }
    }
  }

  // ── Send access email via Resend ──────────────────────
  const RESEND_API_KEY   = process.env.RESEND_API_KEY;
  const RESEND_FROM      = process.env.RESEND_FROM_EMAIL || "academia@zenithrisecapital.com";

  if (!RESEND_API_KEY) {
    console.error("stripe-webhook: missing RESEND_API_KEY");
    return { statusCode: 200, body: JSON.stringify({ received: true, warning: "email not sent" }) };
  }

  // Derive base URL from Stripe success_url stored in the session
  const successUrl = session.success_url || "";
  const baseUrl    = successUrl ? new URL(successUrl).origin : "https://zenithrisecapital.com";
  const accessUrl  = accessToken
    ? `${baseUrl}${CONTENT_PATH}?token=${accessToken}`
    : `${baseUrl}${CONTENT_PATH}`;

  const emailHtml = buildAccessEmail({ email, courseId, accessUrl, baseUrl });

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    `Zenith Academia <${RESEND_FROM}>`,
      to:      [email],
      subject: "Tu acceso al curso ZRC-ACAD-GRM-01 · Gestión del Riesgo Geopolítico",
      html:    emailHtml,
    }),
  });

  if (resendRes.ok) {
    console.log(`stripe-webhook: access email sent → ${email}`);
  } else {
    const err = await resendRes.text();
    console.error("stripe-webhook: Resend error —", err);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// ── Email template ────────────────────────────────────────
function buildAccessEmail({ email, courseId, accessUrl, baseUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060D18;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060D18;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0B2545;border-radius:8px 8px 0 0;padding:32px 40px;border-bottom:2px solid #C9A227;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A227;font-weight:700;">Zenith Academia · Zenith Rise Capital</p>
          <h1 style="margin:12px 0 0;font-size:24px;color:#ffffff;line-height:1.2;">Tu acceso al curso está listo</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#0D1B2A;padding:32px 40px;">
          <p style="color:#B8C8D8;font-size:15px;line-height:1.7;margin:0 0 20px;">Gracias por tu compra. A continuación tienes tu enlace de acceso personal a la masterclass <strong style="color:#C9A227;">Gestión del Riesgo Geopolítico para la Inversión</strong> (ZRC-ACAD-GRM-01).</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td align="center">
              <a href="${accessUrl}"
                 style="display:inline-block;background:#C9A227;color:#060D18;font-weight:700;font-size:15px;letter-spacing:1px;text-transform:uppercase;padding:16px 36px;border-radius:6px;text-decoration:none;">
                Acceder al curso
              </a>
            </td></tr>
          </table>

          <p style="color:#7A9ABB;font-size:13px;line-height:1.6;margin:0 0 12px;">O copia este enlace en tu navegador:</p>
          <p style="background:#060D18;border:1px solid #1E3A5C;border-radius:4px;padding:12px 16px;font-size:12px;color:#C9A227;word-break:break-all;margin:0 0 28px;">${accessUrl}</p>

          <hr style="border:none;border-top:1px solid #1E3A5C;margin:28px 0;">

          <p style="color:#B8C8D8;font-size:14px;line-height:1.6;margin:0 0 8px;"><strong style="color:#ffffff;">Materiales incluidos en tu compra:</strong></p>
          <ul style="color:#B8C8D8;font-size:14px;line-height:1.9;margin:0 0 28px;padding-left:20px;">
            <li>Masterclass en vídeo · 28 minutos</li>
            <li>Manual escrito ES + EN (~3.500 palabras)</li>
            <li>21 diapositivas de presentación (ES + EN)</li>
            <li>4 ejercicios de análisis con soluciones y rúbrica</li>
            <li>Subtítulos SRT en español e inglés</li>
          </ul>

          <p style="color:#7A9ABB;font-size:13px;line-height:1.6;margin:0;">Guarda este email — contiene tu enlace de acceso permanente. Si tienes alguna duda escríbenos a <a href="mailto:academia@zenithrisecapital.com" style="color:#C9A227;">academia@zenithrisecapital.com</a></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#060D18;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
          <p style="color:#3A5070;font-size:11px;margin:0;">© 2025 Zenith Rise Capital · Calesius Global S.L. · Todos los derechos reservados</p>
          <p style="color:#3A5070;font-size:11px;margin:6px 0 0;">${baseUrl}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
