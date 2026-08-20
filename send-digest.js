// send-digest.js v4
// Two-layer email: the executive read at the top, trimmed desk signals below.
// The email is deliberately a SUMMARY — it carries the house position and the
// hooks, and sends the reader to the platform for the analysis behind them.
//
//   LEVEL 1 — EXECUTIVE
//     0. HOUSE POSITION strip (regime · risk index · Europe / Spain / private markets)
//     1. EXECUTIVE PULSE (three signals, 60-second read)
//     2. DAILY SYNTHESIS (cross-desk) + at the open
//     3. CATALYST CALENDAR (next 72 hours)
//   LEVEL 2 — DESKS (trimmed; full items live on the platform)
//     4. MACRO & CENTRAL BANKS (macro category only)
//     5. GEOPOLITICAL RISK RADAR (geopolitics only)
//     6. TRADE & POLICY SIGNALS (trade-policy only)
//     7. CAPITAL FLOWS & DEALS (fdi + ma-growth)
//     8. COMMODITIES & REAL ASSETS (critical-minerals + food-agriculture + real-estate)
//     9. EMERGING MARKETS (emerging-markets only)
//    10. HOUSE VIEW teaser (positions only — the rationale is the reason to click)
//
// Every executive block returns "" when its field is absent, so a v1-shaped
// data.json still produces a valid, shorter briefing.

const fs = require("fs");

const PLATFORM_URL = "https://zenith-news-room.netlify.app";

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

// ─── EXECUTIVE LAYER BLOCKS ──────────────────────────────────────────────────

function truncate(value = "", max = 200) {
  const s = String(value).trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/[\s,;:.\-–—]+$/, "") + "…";
}

// Small mono label used across the executive strip
function microLabel(text, color = "#64748B") {
  // nowrap: at phone widths a wrapped label knocks the value below its neighbours.
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:800;color:${color};letter-spacing:1.2px;text-transform:uppercase;white-space:nowrap;">${escapeHtml(text)}</div>`;
}

// 0. HOUSE POSITION — regime, risk index, and the three region signals.
function regimeStrip(briefing) {
  const regime = briefing.marketRegime || {};
  const regions = briefing.regionSignals || {};
  const tone = regime.tone || "";
  const risk = briefing.riskIndex != null ? briefing.riskIndex : regime.riskIndex;
  const europe = regions.europe || regime.europe || "";
  const spain = regions.spain || regime.spain || "";
  const priv = regions.privateMarkets || regime.privateMarkets || "";

  if (!tone && risk == null) return "";

  const prev = briefing.riskIndexPrev;
  let delta = "";
  if (risk != null && prev != null && Number.isFinite(Number(prev))) {
    const d = Number(risk) - Number(prev);
    delta = d === 0
      ? "UNCHANGED VS PRIOR"
      : `${d > 0 ? "+" : ""}${d} VS PRIOR`;
  }

  const toneColor = tone === "CONSTRUCTIVE" ? "#6EE7B7" : tone === "CAUTIOUS" ? "#FCA5A5" : "#E2E8F0";

  // Values are kept at 11px without letter-spacing: three columns of long words
  // ("CONSTRUCTIVE") otherwise force the whole email wider than a phone screen.
  const regionCell = (label, value) => value ? `
    <td width="33%" valign="top" style="padding:0 6px 0 0;">
      ${microLabel(label, "#64748B")}
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#E2E8F0;margin-top:3px;">${escapeHtml(value)}</div>
    </td>` : "";

  const regionRow = (europe || spain || priv) ? `
    <tr><td colspan="2" style="height:12px;"></td></tr>
    <tr>
      <td colspan="2" style="border-top:1px solid #1E293B;padding-top:11px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            ${regionCell("Europe", europe)}
            ${regionCell("Spain", spain)}
            ${regionCell("Private mkts", priv)}
          </tr>
        </table>
      </td>
    </tr>` : "";

  return `
    <tr><td style="height:18px;"></td></tr>
    <tr>
      <td style="background:#0F172A;padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td valign="top">
              ${microLabel("Market regime", "#C9A84C")}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;color:${toneColor};letter-spacing:-0.2px;margin-top:4px;">${escapeHtml(tone || "—")}</div>
            </td>
            <td valign="top" align="right">
              ${microLabel("ZRC risk index", "#C9A84C")}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;color:#FFFFFF;margin-top:4px;">
                ${risk != null ? escapeHtml(String(risk)) : "—"}<span style="font-size:11px;font-weight:700;color:#64748B;"> / 100</span>
              </div>
              ${delta ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:800;color:#64748B;letter-spacing:1.2px;margin-top:3px;">${escapeHtml(delta)}</div>` : ""}
            </td>
          </tr>
          ${regionRow}
        </table>
      </td>
    </tr>
  `;
}

// 1. EXECUTIVE PULSE — the three things to know, capped so it stays a teaser.
function pulseSection(briefing) {
  const pulse = Array.isArray(briefing.executivePulse) ? briefing.executivePulse.slice(0, 3) : [];
  if (!pulse.length) return "";

  const rows = pulse.map((p, i) => `
    <tr>
      <td style="padding:0 0 13px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="26" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#C9A84C;padding-top:1px;">0${i + 1}</td>
            <td valign="top">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;color:#0F172A;padding-bottom:4px;">
                ${escapeHtml(p.title || "Key signal")}&nbsp;&nbsp;${signalBadge(p.signal)}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;line-height:1.6;">
                ${formatText(truncate(p.text, 230))}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `
    ${sectionHeader("⚡", "Executive Pulse · 60 second read", "#0F172A")}
    ${rows}
  `;
}

// 3. CATALYST CALENDAR — dates only. What they imply is on the platform.
function catalystSection(briefing) {
  const catalysts = Array.isArray(briefing.catalysts) ? briefing.catalysts.slice(0, 4) : [];
  if (!catalysts.length) return "";

  const rows = catalysts.map(c => `
    <tr>
      <td style="padding:0 0 9px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="120" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:800;color:#92400E;letter-spacing:0.8px;padding-top:2px;white-space:nowrap;">
              ${escapeHtml(c.time || c.date || "TBC")}
            </td>
            <td valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#334155;line-height:1.45;">
              ${escapeHtml(c.title || "")}
            </td>
            <td align="right" valign="top" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;color:#94A3B8;letter-spacing:0.8px;white-space:nowrap;padding-top:2px;">
              ${escapeHtml(String(c.impact || "MEDIUM").toUpperCase())}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `
    ${sectionHeader("🗓", "Catalyst Calendar · next 72 hours", "#92400E")}
    ${rows}
  `;
}

// 10. HOUSE VIEW teaser — positions only, deliberately without the rationale.
function houseViewSection(briefing) {
  const views = Array.isArray(briefing.houseView) ? briefing.houseView.slice(0, 6) : [];
  if (!views.length) return "";

  // Only movement is marked. An unchanged stance stays quiet — in a summary the
  // point of the section is what moved. The verdict is computed upstream, so it
  // cannot disagree with the stance shown beside it.
  const changeMarker = v => {
    const from = v.previousView ? ` FROM ${String(v.previousView).toUpperCase()}` : "";
    const mark = (text, color) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:8px;font-weight:800;letter-spacing:1px;color:${color};margin-top:5px;">${escapeHtml(text)}</div>`;
    if (v.direction === "upgraded") return mark(`▲ UPGRADED${from}`, "#047857");
    if (v.direction === "downgraded") return mark(`▼ DOWNGRADED${from}`, "#B91C1C");
    return "";
  };

  const viewColor = v => ({
    CONSTRUCTIVE: "#065F46", SELECTIVE: "#92400E", NEUTRAL: "#374151",
    CAUTIOUS: "#9A3412", DEFENSIVE: "#991B1B"
  })[String(v || "").toUpperCase()] || "#374151";

  // Label above the stance rather than beside it — side-by-side in two columns
  // pushes the minimum width past a phone screen.
  const cell = v => v ? `
    <td width="50%" valign="top" style="padding:0 8px 10px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F8FAFC;border:1px solid #E2E8F0;">
        <tr>
          <td style="padding:9px 11px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#334155;line-height:1.35;">
              ${escapeHtml(v.label || "")}
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;letter-spacing:0.9px;color:${viewColor(v.view)};margin-top:4px;">
              ${escapeHtml(String(v.view || "").toUpperCase())}
            </div>
            ${changeMarker(v)}
          </td>
        </tr>
      </table>
    </td>` : `<td width="50%"></td>`;

  const rows = [];
  for (let i = 0; i < views.length; i += 2) {
    rows.push(`<tr>${cell(views[i])}${cell(views[i + 1])}</tr>`);
  }

  return `
    ${sectionHeader("🎯", "ZRC House View", "#0F172A")}
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${rows.join("")}
        </table>
      </td>
    </tr>
    <tr>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94A3B8;line-height:1.6;padding-top:2px;">
        What moved each position since yesterday — <a href="${PLATFORM_URL}" style="color:#92400E;font-weight:700;text-decoration:underline;">read the house view in full</a>.
      </td>
    </tr>
  `;
}

// Hidden preview line shown by most clients next to the subject.
function preheader(briefing) {
  const bits = [];
  if (briefing.marketRegime?.tone) bits.push(`Regime ${briefing.marketRegime.tone}`);
  if (briefing.riskIndex != null) bits.push(`risk index ${briefing.riskIndex}/100`);
  const lead = Array.isArray(briefing.executivePulse) && briefing.executivePulse[0]
    ? briefing.executivePulse[0].text
    : briefing.globalBriefing;
  if (lead) bits.push(truncate(lead, 110));
  return escapeHtml(bits.join(" · "));
}

// Single item row — "full" mode (featured: headline + badge + summary)
//                   or "compact" mode (headline + badge only, one line)
// Relevance is intentionally dropped from the email; it still lives in data.json
// and is rendered in full on the ZRC platform.
function itemRow(item, mode = "full") {
  const headline = escapeHtml(item.headline || item.title || "");
  // Trimmed on purpose: the email carries the signal, the platform carries the analysis.
  const summary  = formatText(truncate(item.summary || "", 200));
  const badge    = signalBadge(item.signal || item.risk);

  // COMPACT MODE — single-line teaser with gold bullet
  if (mode === "compact") {
    return `
    <tr>
      <td style="padding:0 0 10px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#334155;line-height:1.5;">
              <span style="color:#C9A84C;margin-right:6px;font-weight:800;">›</span>${headline}&nbsp;&nbsp;${badge}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
  }

  // FULL MODE — featured item, no relevance block
  return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#0F172A;line-height:1.4;padding-bottom:5px;">
              ${headline}&nbsp;&nbsp;${badge}
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#475569;line-height:1.6;">
              ${summary}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="border-bottom:1px solid #F1F5F9;height:0;line-height:0;font-size:0;"></td></tr>
    <tr><td style="height:12px;"></td></tr>
  `;
}

// Renders a desk section: 1 featured item (full) + remaining items as compact
// headline-only rows + Key Takeaway chip. Drives traffic to FULL BRIEFING.
function deskSection(cat, accent, max = 3) {
  if (!cat || !Array.isArray(cat.items) || cat.items.length === 0) return "";
  const items = cat.items.slice(0, max);
  const [featured, ...rest] = items;

  // Say what is being held back — the count is the reason to open the briefing.
  const held = cat.items.length - items.length;
  const moreRow = held > 0 ? `
    <tr>
      <td style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94A3B8;">
        <a href="${PLATFORM_URL}" style="color:#94A3B8;text-decoration:none;">+ ${held} further signal${held > 1 ? "s" : ""} on this desk &rsaquo;</a>
      </td>
    </tr>
  ` : "";

  return `
    ${sectionHeader(cat.icon || "📌", cat.label, accent)}
    ${itemRow(featured, "full")}
    ${rest.map(item => itemRow(item, "compact")).join("")}
    ${moreRow}
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

  const deskCount = Object.values(cats).filter(c => (c.items || []).length).length;
  const totalSignals = Object.values(cats).reduce((sum, c) => sum + (c.items?.length || 0), 0);

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

  // ── EXECUTIVE LAYER ─────────────────────────────────────────────────────
  const houseStrip   = regimeStrip(briefing);
  const pulseHtml    = pulseSection(briefing);
  const catalystHtml = catalystSection(briefing);
  const houseHtml    = houseViewSection(briefing);

  // ── DESK SECTIONS (1-to-1 mapping, zero overlap) ────────────────────────
  // Item counts are deliberately below what each desk holds: the executive
  // layer now carries the top of the briefing, and the desks are the teaser.
  const macroSection       = deskSection(cats["macro"],             "#1D4ED8", 2); // blue
  const geoSection         = deskSection(cats["geopolitics"],       "#B91C1C", 2); // red
  const tradeSection       = deskSection(cats["trade-policy"],      "#7C3AED", 2); // purple
  const flowsSection       = (() => {
    // Merge FDI + M&A into one "Capital Flows & Deals" section
    const fdi = cats["fdi"]?.items || [];
    const ma  = cats["ma-growth"]?.items || [];
    const merged = [...fdi.slice(0, 2), ...ma.slice(0, 2)];
    if (merged.length === 0) return "";
    const takeaway = cats["fdi"]?.keyTakeaway || cats["ma-growth"]?.keyTakeaway || "";
    const pseudoCat = { icon: "💰", label: "Capital Flows & Deals", items: merged, keyTakeaway: takeaway };
    return deskSection(pseudoCat, "#0D9488", 3); // teal
  })();
  const commodSection      = (() => {
    // Merge critical-minerals + food-agriculture + real-estate into "Commodities & Real Assets"
    const cm   = cats["critical-minerals"]?.items?.slice(0, 2)  || [];
    const food = cats["food-agriculture"]?.items?.slice(0, 1)   || [];
    const re   = cats["real-estate"]?.items?.slice(0, 1)        || [];
    const merged = [...cm, ...food, ...re];
    if (merged.length === 0) return "";
    const takeaway = cats["critical-minerals"]?.keyTakeaway || "";
    const pseudoCat = { icon: "⚡", label: "Commodities & Real Assets", items: merged, keyTakeaway: takeaway };
    return deskSection(pseudoCat, "#D97706", 3); // amber
  })();
  const emSection          = deskSection(cats["emerging-markets"], "#059669", 2); // green

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>ZRC Morning Intelligence</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;font-size:1px;line-height:1px;">${preheader(briefing)}</div>
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

                <!-- 0. House position: regime · risk index · region signals -->
                ${houseStrip}

                <!-- 1. Executive Pulse -->
                ${pulseHtml}

                <!-- 2. Daily Synthesis -->
                ${synthHtml}

                <!-- 3. Catalyst Calendar -->
                ${catalystHtml}

                <!-- ── LEVEL 2 · DESK SIGNALS ─────────────────────────── -->
                <tr><td style="height:26px;"></td></tr>
                <tr>
                  <td style="border-top:2px solid #0F172A;padding-top:12px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:800;color:#0F172A;letter-spacing:2px;text-transform:uppercase;">Level 2 &nbsp;·&nbsp; Desk signals</span>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94A3B8;">&nbsp;&nbsp;selected items — each desk holds more</span>
                  </td>
                </tr>

                <!-- 4. Macro & Central Banks -->
                ${macroSection}

                <!-- 5. Geopolitical Risk Radar -->
                ${geoSection}

                <!-- 6. Trade & Industrial Policy -->
                ${tradeSection}

                <!-- 7. Capital Flows & Deals -->
                ${flowsSection}

                <!-- 8. Commodities & Real Assets -->
                ${commodSection}

                <!-- 9. Emerging Markets -->
                ${emSection}

                <!-- 10. ZRC House View -->
                ${houseHtml}

                <!-- ── CTA ──────────────────────────────────────── -->
                <tr><td style="height:28px;"></td></tr>
                <tr>
                  <td style="background:#0F172A;padding:1px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding:16px 20px;">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94A3B8;">
                            <strong style="color:#E2E8F0;">${escapeHtml(String(totalSignals))} signals across ${escapeHtml(String(deskCount))} desks</strong> this morning —
                            with the Opportunity Radar, house-view rationale and sources.
                          </span>
                        </td>
                        <td align="right" style="padding:16px 20px;white-space:nowrap;">
                          <a href="${PLATFORM_URL}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;color:#0F172A;background:#C9A84C;text-decoration:none;padding:9px 18px;letter-spacing:0.8px;display:inline-block;">
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

// Subject carries the house position — the reader sees the call before opening.
function buildSubject(briefing) {
  const today = new Date().toLocaleDateString("es-ES");
  const bits = [`ZRC Morning Intelligence · ${today}`];
  if (briefing.marketRegime?.tone) bits.push(briefing.marketRegime.tone);
  if (briefing.riskIndex != null) bits.push(`Risk ${briefing.riskIndex}`);
  return bits.join(" · ");
}

// ─── SEND DIGEST ──────────────────────────────────────────────────────────────

async function sendDigest() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const BASE_URL = process.env.BASE_URL || "https://zrc-api.onrender.com";

  // Two test modes, both of which leave the subscriber list untouched:
  //   DRY_RUN=1              → render email-preview.html and exit. No network at all.
  //   TEST_EMAIL=you@zrc.com → send exactly one real email to that address.
  const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");
  const TEST_EMAIL = (process.env.TEST_EMAIL || "").trim();

  if (!RESEND_API_KEY && !DRY_RUN) {
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

  if (totalItems === 0 && !DRY_RUN) {
    console.log("⚠ No signals in briefing. Skipping email.");
    return;
  }

  if (DRY_RUN) {
    const html = buildEmailHTML(briefing, "Luis", `${BASE_URL}/api/unsubscribe?token=PREVIEW`);
    fs.writeFileSync("email-preview.html", html);
    console.log("🧪 DRY RUN — no email sent, no subscriber lookup.");
    console.log(`   Briefing:  ${briefing.date || "undated"} · ${totalItems} signals`);
    console.log(`   Regime:    ${briefing.marketRegime?.tone || "—"} · risk index ${briefing.riskIndex ?? "—"}`);
    console.log(`   Executive: ${(briefing.executivePulse || []).length} pulse · ${(briefing.catalysts || []).length} catalysts · ${(briefing.houseView || []).length} house views`);
    console.log(`   Written:   email-preview.html (${Math.round(html.length / 1024)} KB)`);
    if (!briefing.executivePulse) {
      console.log("   ⚠ This data.json predates the executive layer — run generate-briefing.js for the full email.");
    }
    return;
  }

  if (TEST_EMAIL) {
    console.log(`🧪 TEST SEND — one email to ${TEST_EMAIL}. Subscriber list not touched.`);
    const html = buildEmailHTML(briefing, "Luis", `${BASE_URL}/api/unsubscribe?token=TEST`);
    const subject = buildSubject(briefing);
    console.log(`   Subject: [TEST] ${subject}`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ZRC Intelligence <intelligence@zenithrisecapital.com>",
        to: TEST_EMAIL,
        subject: `[TEST] ${subject}`,
        html,
      }),
    });
    const result = await res.json();
    if (res.ok) {
      console.log(`   ✅ Sent to ${TEST_EMAIL} (id ${result.id || "n/a"})`);
    } else {
      console.error(`   ❌ Failed: ${JSON.stringify(result)}`);
      process.exit(1);
    }
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
  const subject = buildSubject(briefing);
  console.log(`   Subject: ${subject}`);
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
          subject,
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
