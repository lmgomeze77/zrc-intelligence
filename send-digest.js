// send-digest.js v2
// Reads data.json, fetches subscribers from Supabase, sends individual emails via Resend.
// No Broadcast API needed — no RESEND_AUDIENCE_ID required.
// Runs after generate-briefing.js in the GitHub Action.

const fs = require("fs");

// ─── FETCH SUBSCRIBERS FROM SUPABASE ────────────────────────────────────────

async function getSubscribers() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY not set");
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?active=eq.true&select=email,name,unsubscribe_token`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase error ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatText(value = "") {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function sectionTitle(label) {
  return `
    <tr><td style="height: 28px;"></td></tr>
    <tr>
      <td style="color: #0F172A; font-size: 18px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; padding-bottom: 10px;">
        ${escapeHtml(label)}
      </td>
    </tr>
    <tr>
      <td style="border-top: 3px solid #0F172A; height: 0; line-height: 0; font-size: 0;"></td>
    </tr>
    <tr><td style="height: 14px;"></td></tr>
  `;
}

function itemBlock(item, showSignal = true) {
  const signalMap = {
    bullish: { label: "BULLISH", bg: "#DCFCE7", color: "#166534" },
    bearish: { label: "BEARISH", bg: "#FEE2E2", color: "#991B1B" },
    watch: { label: "WATCH", bg: "#FEF3C7", color: "#92400E" },
    medium: { label: "MEDIUM", bg: "#FEF3C7", color: "#92400E" },
    high: { label: "HIGH", bg: "#FEE2E2", color: "#991B1B" },
    low: { label: "LOW", bg: "#DCFCE7", color: "#166534" },
    neutral: { label: "NEUTRAL", bg: "#E5E7EB", color: "#374151" },
  };

  const signalKey = String(item.signal || item.risk || "neutral").toLowerCase();
  const signal = signalMap[signalKey] || signalMap.neutral;

  return `
    <tr>
      <td style="padding: 0 0 14px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="font-size: 0; line-height: 0;" width="8"></td>
            <td style="padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; color: #0F172A; line-height: 1.45; padding-bottom: 6px;">
                    ${escapeHtml(item.headline || item.title || "")}
                  </td>
                  ${
                    showSignal
                      ? `
                  <td align="right" valign="top" width="90" style="padding-bottom: 6px;">
                    <span style="display: inline-block; background: ${signal.bg}; color: ${signal.color}; font-size: 10px; font-weight: 700; font-family: Arial, Helvetica, sans-serif; padding: 5px 10px; border-radius: 4px; letter-spacing: 0.8px;">
                      ${signal.label}
                    </span>
                  </td>`
                      : ""
                  }
                </tr>
              </table>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #3F3F46; line-height: 1.7;">
                ${formatText(item.summary || "")}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="border-bottom: 1px solid #E5E7EB; height: 0; line-height: 0; font-size: 0;"></td>
    </tr>
    <tr><td style="height: 14px;"></td></tr>
  `;
}

function takeFirstItems(cat, max = 3) {
  if (!cat || !Array.isArray(cat.items)) return [];
  return cat.items.slice(0, max);
}

function buildMacroSnapshot(categories) {
  const macroLike = [
    categories["geopolitics"],
    categories["fdi"],
    categories["emerging-markets"],
    categories["trade-policy"],
  ]
    .filter(Boolean)
    .flatMap((cat) => takeFirstItems(cat, 1));

  if (macroLike.length === 0) return "";

  return `
    ${sectionTitle("MACRO SNAPSHOT")}
    ${macroLike.map((item) => itemBlock(item, false)).join("")}
  `;
}

function buildRiskRadar(categories) {
  const riskLike = [
    categories["geopolitics"],
    categories["trade-policy"],
    categories["critical-minerals"],
  ]
    .filter(Boolean)
    .flatMap((cat) => takeFirstItems(cat, 1));

  if (riskLike.length === 0) return "";

  return `
    ${sectionTitle("GEOPOLITICAL RISK RADAR")}
    ${riskLike.map((item) => itemBlock(item, true)).join("")}
  `;
}

function buildSignals(categories) {
  const signalsLike = [
    categories["critical-minerals"],
    categories["food-agriculture"],
    categories["real-estate"],
    categories["ma-growth"],
  ]
    .filter(Boolean)
    .flatMap((cat) => takeFirstItems(cat, 1));

  if (signalsLike.length === 0) return "";

  return `
    ${sectionTitle("COMMODITY & STRATEGIC SIGNALS")}
    ${signalsLike.map((item) => itemBlock(item, false)).join("")}
  `;
}

// ─── BUILD EMAIL HTML ───────────────────────────────────────────────────────

function buildEmailHTML(briefing, name, unsubscribeUrl) {
  const greeting = name ? `Good morning, ${escapeHtml(name)}.` : "Good morning.";
  const categories = briefing.categories || {};

  const dateText = escapeHtml(briefing.date || "");
  const globalBriefing = briefing.globalBriefing
    ? `
      <tr><td style="height: 18px;"></td></tr>
      <tr>
        <td style="padding: 16px 18px; background: #F8F5EE; border-left: 4px solid #C9A84C;">
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; color: #8B6F1A; letter-spacing: 1px; margin-bottom: 6px;">
            DAILY SYNTHESIS
          </div>
          <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #334155; font-style: italic;">
            ${formatText(briefing.globalBriefing)}
          </div>
        </td>
      </tr>
    `
    : "";

  const macroHTML = buildMacroSnapshot(categories);
  const radarHTML = buildRiskRadar(categories);
  const signalsHTML = buildSignals(categories);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #F3F4F6; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 0;">
        <table width="760" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 760px; background: #FFFFFF;">
          
          <tr>
            <td style="padding: 24px 28px 18px 28px; border-bottom: 1px solid #E5E7EB;">
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; color: #0F172A;">
                ZRC Morning Intelligence · ${dateText}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 28px 10px 28px;">
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #475569;">
                ${greeting}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 10px 28px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 800; color: #0F172A; letter-spacing: 0.2px; padding-bottom: 8px;">
                    ZRC MORNING INTELLIGENCE
                  </td>
                </tr>
                <tr>
                  <td style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #6B7280;">
                    ${dateText}
                  </td>
                </tr>

                ${globalBriefing}
                ${macroHTML}
                ${radarHTML}
                ${signalsHTML}

                <tr><td style="height: 18px;"></td></tr>

                <tr>
                  <td align="left" style="padding-top: 6px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background: #C9A84C; padding: 12px 22px; border-radius: 4px;">
                          <a href="https://zenith-news-room.netlify.app" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; color: #111827; text-decoration: none; letter-spacing: 0.8px;">
                            FULL BRIEFING →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr><td style="height: 34px;"></td></tr>

                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 18px;">
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6B7280; line-height: 1.8;">
                      Zenith Rise Capital · Calesius Global S.L. · Madrid
                    </div>
                    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6B7280; line-height: 1.8;">
                      <a href="${unsubscribeUrl}" style="color: #6B7280; text-decoration: underline;">Unsubscribe</a>
                      <span> · For informational purposes only.</span>
                    </div>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── SEND EMAILS ────────────────────────────────────────────────────────────

async function sendDigest() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const BASE_URL = process.env.BASE_URL || "https://zrc-api.onrender.com";

  if (!RESEND_API_KEY) {
    console.log("⚠ RESEND_API_KEY not set. Skipping email digest.");
    return;
  }

  if (!fs.existsSync("data.json")) {
    console.error("❌ data.json not found. Generate briefing first.");
    process.exit(1);
  }

  const briefing = JSON.parse(fs.readFileSync("data.json", "utf8"));
  const totalItems = Object.values(briefing.categories || {}).reduce(
    (sum, c) => sum + (c.items?.length || 0),
    0
  );

  if (totalItems === 0) {
    console.log("⚠ No signals in briefing. Skipping email.");
    return;
  }

  console.log("📋 Fetching subscribers from Supabase...");
  const subscribers = await getSubscribers();
  console.log(`   Found ${subscribers.length} active subscriber(s).`);

  if (subscribers.length === 0) {
    console.log("⚠ No active subscribers. Skipping email.");
    return;
  }

  console.log("📧 Sending emails...");
  const today = new Date().toLocaleDateString("es-ES");
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;
    const html = buildEmailHTML(briefing, sub.name, unsubscribeUrl);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ZRC Intelligence <intelligence@zenithrisecapital.com>",
          to: sub.email,
          subject: `ZRC Morning Intelligence · ${today}`,
          html,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        console.log(`   ✅ ${sub.email}`);
        sent++;
      } else {
        console.error(`   ❌ ${sub.email}: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (err) {
      console.error(`   ❌ ${sub.email}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${sent} sent, ${failed} failed, ${subscribers.length} total.`);
}

sendDigest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Digest error:", err);
    process.exit(1);
  });
