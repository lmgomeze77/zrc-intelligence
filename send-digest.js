// send-digest.js v3
// Redesigned IB-level email structure — 6 non-overlapping sections.
// Each section maps 1:1 to exactly one category. Zero content duplication.
// New sections:
//   1. DAILY SYNTHESIS (cross-desk)
//   2. MACRO & CENTRAL BANKS (macro category only)
//   3. GEOPOLITICAL RISK RADAR (geopolitics only)
//   4. TRADE & POLICY SIGNALS (trade-policy only)
//   5. CAPITAL FLOWS & DEALS (fdi + ma-growth)
//   6. COMMODITIES & REAL ASSETS (critical-minerals + food-agriculture + real-estate)
//   7. EMERGING MARKETS (emerging-markets only)

const fs = require("fs");

// ─── SUPABASE ────────────────────────────────────────────────────────────────

async function getSubscribers() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatText(value = "") {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

// Signal badge — colour-coded pill
function signalBadge(rawSignal) {
  const map = {
    bullish:  { label: "BULLISH",  bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
    bearish:  { label: "BEARISH",  bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
    watch:    { label: "WATCH",    bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
    medium:   { label: "WATCH",    bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
    high:     { label: "HIGH",     bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" },
    low:      { label: "LOW",      bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
    neutral:  { label: "NEUTRAL",  bg: "#F3F4F6", color: "#374151", border: "#D1D5DB" },
  };
  const key = String(rawSignal || "neutral").toLowerCase();
  const s = map[key] || map.neutral;
  return `<span style="display:inline-block;background:${s.bg};color:${s.color};border:1px solid ${s.border};font-size:9px;font-weight:800;font-family:Arial,Helvetica,sans-serif;padding:3px 8px;border-radius:3px;letter-spacing:0.9px;vertical-align:middle;">${s.label}</span>`;
}

// Section divider with coloured left rule
function sectionHeader(icon, label, accent = "#0F172A") {
  return `
    <tr><td style="height:32px;"></td></tr>
    <tr>
      <td style="border-left:4px solid ${accent};padding-left:12px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;color:${accent};letter-spacing:1.8px;text-transform:uppercase;">${icon}&nbsp;&nbsp;${escapeHtml(label)}</span>
      </td>
    </tr>
    <tr><td style="height:10px;"></td></tr>
    <tr><td style="border-bottom:1px solid #E5E7EB;height:0;line-height:0;font-size:0;"></td></tr>
    <tr><td style="height:14px;"></td></tr>
  `;
}

// Takeaway chip — appears at bottom of each section
function keyTakeaway(text) {
  if (!text || text === "No significant signals detected.") return "";
  return `
    <tr><td style="height:8px;"></td></tr>
    <tr>
      <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:10px 14px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#64748B;letter-spacing:0.8px;text-transform:uppercase;">KEY TAKEAWAY &nbsp;</span>
        <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#334155;font-style:italic;">${escapeHtml(text)}</span>
      </td>
    </tr>
    <tr><td style="height:6px;"></td></tr>
  `;
}

// Single item row — headline + badge + summary + relevance
function itemRow(item, showSignal = true) {
  const headline = escapeHtml(item.headline || item.title || "");
  const summary  = formatText(item.summary || "");
  const relevance = item.relevance ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#64748B;margin-top:6px;padding-left:10px;border-left:2px solid #E5E7EB;font-style:italic;">${escapeHtml(item.relevance)}</div>` : "";
  const badge = showSignal ? signalBadge(item.signal || item.risk) : "";

  return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0F172A;line-height:1.4;padding-bottom:5px;">
              ${headline}${badge ? `&nbsp;&nbsp;${badge}` : ""}
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;line-height:1.65;">
              ${summary}
            </td>
          </tr>
          ${relevance ? `<tr><td>${relevance}</td></tr>` : ""}
        </table>
      </td>
    </tr>
    <tr>
      <td style="border-bottom:1px solid #F1F5F9;height:0;line-height:0;font-size:0;"></td>
    </tr>
    <tr><td style="height:14px;"></td></tr>
  `;
}

// Renders a full desk section (header + items + takeaway)
function deskSection(cat, accent, max = 3) {
  if (!cat || !Array.isArray(cat.items) || cat.items.length === 0) return "";
  const items = cat.items.slice(0, max);
  return `
    ${sectionHeader(cat.icon || "📌", cat.label, accent)}
    ${items.map(item => itemRow(item, true)).join("")}
    ${keyTakeaway(cat.keyTakeaway)}
  `;
}

// ─── EMAIL HTML BUILDER ───────────────────────────────────────────────────────

function buildEmailHTML(briefing, name, unsubscribeUrl) {
  const greeting = name
    ? `Good morning, <strong>${escapeHtml(name)}</strong>.`
    : "Good morning.";

  const cats = briefing.categories || {};
  const dateText = escapeHtml(briefing.date || "");
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // ── DAILY SYNTHESIS BOX ─────────────────────────────────────────────────
  const synthHtml = briefing.globalBriefing ? `
    <tr><td style="height:20px;"></td></tr>
    <tr>
      <td style="padding:18px 20px;background:#FFFBEB;border-left:4px solid #C9A84C;border-radius:2px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;color:#92400E;letter-spacing:1.8px;margin-bottom:8px;text-transform:uppercase;">ZRC DAILY SYNTHESIS</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.75;color:#1C1917;font-style:italic;">${formatText(briefing.globalBriefing)}</div>
        ${briefing.marketOpen ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#92400E;margin-top:10px;font-weight:700;">⚡ Market open: ${escapeHtml(briefing.marketOpen)}</div>` : ""}
      </td>
    </tr>
  ` : "";

  // ── DESK SECTIONS (1-to-1 mapping, zero overlap) ────────────────────────
  const macroSection       = deskSection(cats["macro"],             "#1D4ED8", 3); // blue
  const geoSection         = deskSection(cats["geopolitics"],       "#B91C1C", 3); // red
  const tradeSection       = deskSection(cats["trade-policy"],      "#7C3AED", 3); // purple
  const flowsSection       = (() => {
    // Merge FDI + M&A into one "Capital Flows & Deals" section
    const fdi = cats["fdi"]?.items?.slice(0, 2) || [];
    const ma  = cats["ma-growth"]?.items?.slice(0, 2) || [];
    const merged = [...fdi, ...ma].slice(0, 4);
    if (merged.length === 0) return "";
    const takeaway = cats["fdi"]?.keyTakeaway || cats["ma-growth"]?.keyTakeaway || "";
    const pseudoCat = { icon: "💰", label: "Capital Flows & Deals", items: merged, keyTakeaway: takeaway };
    return deskSection(pseudoCat, "#0D9488", 4); // teal
  })();
  const commodSection      = (() => {
    // Merge critical-minerals + food-agriculture into "Commodities & Real Assets"
    const cm   = cats["critical-minerals"]?.items?.slice(0, 2)  || [];
    const food = cats["food-agriculture"]?.items?.slice(0, 1)   || [];
    const re   = cats["real-estate"]?.items?.slice(0, 1)        || [];
    const merged = [...cm, ...food, ...re].slice(0, 4);
    if (merged.length === 0) return "";
    const takeaway = cats["critical-minerals"]?.keyTakeaway || "";
    const pseudoCat = { icon: "⚡", label: "Commodities & Real Assets", items: merged, keyTakeaway: takeaway };
    return deskSection(pseudoCat, "#D97706", 4); // amber
  })();
  const emSection          = deskSection(cats["emerging-markets"], "#059669", 3); // green

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>ZRC Morning Intelligence</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F1F5F9;">
    <tr>
      <td align="center" style="padding:20px 0 32px;">
        <table width="680" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:680px;background:#FFFFFF;border:1px solid #E2E8F0;">

          <!-- ── HEADER ─────────────────────────────────────────── -->
          <tr>
            <td style="background:#0F172A;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:20px 28px 16px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;color:#C9A84C;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:6px;">
                      ZENITH RISE CAPITAL &nbsp;·&nbsp; INTELLIGENCE BRIEFING
                    </div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.3px;">
                      Morning Intelligence
                    </div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94A3B8;margin-top:4px;">
                      ${dateText}
                    </div>
                  </td>
                  <td align="right" style="padding:20px 28px 16px;vertical-align:middle;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#64748B;text-align:right;">
                      ${greeting}
                    </div>
                  </td>
                </tr>
                <!-- coloured accent bar -->
                <tr>
                  <td colspan="2" style="height:3px;background:linear-gradient(90deg,#C9A84C 0%,#92400E 50%,#C9A84C 100%);font-size:0;line-height:0;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY ───────────────────────────────────────────── -->
          <tr>
            <td style="padding:8px 28px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

                <!-- Daily Synthesis -->
                ${synthHtml}

                <!-- 1. Macro & Central Banks -->
                ${macroSection}

                <!-- 2. Geopolitical Risk Radar -->
                ${geoSection}

                <!-- 3. Trade & Industrial Policy -->
                ${tradeSection}

                <!-- 4. Capital Flows & Deals -->
                ${flowsSection}

                <!-- 5. Commodities & Real Assets -->
                ${commodSection}

                <!-- 6. Emerging Markets -->
                ${emSection}

                <!-- ── CTA ──────────────────────────────────────── -->
                <tr><td style="height:28px;"></td></tr>
                <tr>
                  <td style="background:#0F172A;padding:1px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding:16px 20px;">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94A3B8;">
                            Full analysis, charts, and source links available on the ZRC Intelligence platform.
                          </span>
                        </td>
                        <td align="right" style="padding:16px 20px;white-space:nowrap;">
                          <a href="https://zenith-news-room.netlify.app" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#0F172A;background:#C9A84C;text-decoration:none;padding:9px 18px;letter-spacing:0.8px;display:inline-block;">
                            FULL BRIEFING →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- ── FOOTER ────────────────────────────────────── -->
                <tr><td style="height:24px;"></td></tr>
                <tr>
                  <td style="border-top:1px solid #E2E8F0;padding-top:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td>
                          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94A3B8;line-height:1.8;">
                            <strong style="color:#64748B;">Zenith Rise Capital</strong> · Calesius Global S.L. · Madrid, Spain<br>
                            This briefing is for informational purposes only and does not constitute investment advice.
                          </div>
                        </td>
                        <td align="right" valign="top">
                          <a href="${unsubscribeUrl}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94A3B8;text-decoration:underline;">Unsubscribe</a>
                        </td>
                      </tr>
                    </table>
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

// ─── SEND DIGEST ──────────────────────────────────────────────────────────────

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
  .catch(err => {
    console.error("Digest error:", err);
    process.exit(1);
  });
