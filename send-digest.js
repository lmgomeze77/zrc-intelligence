// send-digest.js
// Reads data.json and sends the morning briefing email to all subscribers via Resend Broadcast API
// Runs after generate-briefing.js in the GitHub Action

const fs = require("fs");

function buildEmailHTML(briefing) {
  const signalColors = {
    bullish: { bg: "#0D3B2E", color: "#34D399" },
    bearish: { bg: "#3B1A1A", color: "#F87171" },
    watch: { bg: "#3B2E0D", color: "#FBBF24" },
    neutral: { bg: "#2A2A3A", color: "#A5B4C8" }
  };

  let categoriesHTML = "";

  const categoryOrder = [
    "geopolitics", "fdi", "critical-minerals", "real-estate",
    "ma-growth", "emerging-markets", "trade-policy", "food-agriculture"
  ];

  for (const catId of categoryOrder) {
    const cat = briefing.categories[catId];
    if (!cat || !cat.items || cat.items.length === 0) continue;

    let itemsHTML = "";
    for (const item of cat.items) {
      const sc = signalColors[item.signal] || signalColors.neutral;
      const signalLabel = (item.signal || "neutral").toUpperCase();

      itemsHTML += `
        <tr>
          <td style="padding: 14px 18px; border-left: 3px solid rgba(201,168,76,0.4); background: #0C1628; border-radius: 4px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="color: #E8DCC8; font-size: 15px; font-weight: 600; font-family: Georgia, serif; line-height: 1.4; padding-bottom: 6px;">
                ${item.headline}
              </td>
              <td width="80" align="right" valign="top">
                <span style="background: ${sc.bg}; color: ${sc.color}; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; padding: 3px 7px; border-radius: 3px; font-family: monospace;">
                  ${signalLabel}
                </span>
              </td>
            </tr></table>
            <div style="color: #A5B4C8; font-size: 13px; line-height: 1.6; margin-bottom: 8px; font-family: Georgia, serif;">
              ${item.summary}
            </div>
            <div style="color: #C9A84C; font-size: 11px; font-family: Georgia, serif;">
              ⚡ ${item.relevance}
            </div>
            <div style="color: #5A6A80; font-size: 10px; font-family: monospace; letter-spacing: 0.5px; margin-top: 6px;">
              SOURCE: ${(item.source || "").toUpperCase()}
            </div>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
      `;
    }

    let takeawayHTML = "";
    if (cat.keyTakeaway) {
      takeawayHTML = `
        <tr>
          <td style="padding: 12px 16px; background: rgba(201,168,76,0.06); border: 1px solid rgba(201,168,76,0.12); border-radius: 4px;">
            <div style="color: #C9A84C; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; font-family: monospace; margin-bottom: 4px;">KEY TAKEAWAY</div>
            <div style="color: #E8DCC8; font-size: 13px; font-style: italic; line-height: 1.5; font-family: Georgia, serif;">${cat.keyTakeaway}</div>
          </td>
        </tr>
      `;
    }

    categoriesHTML += `
      <tr><td style="height: 24px;"></td></tr>
      <tr>
        <td>
          <div style="color: #E8DCC8; font-size: 17px; font-weight: 600; font-family: Georgia, serif; margin-bottom: 4px;">
            ${cat.icon || ""} ${cat.label}
          </div>
          <div style="color: #5A6A80; font-size: 11px; font-family: Georgia, serif; margin-bottom: 14px;">
            ${cat.description || ""}
          </div>
        </td>
      </tr>
      ${itemsHTML}
      ${takeawayHTML}
    `;
  }

  let globalHTML = "";
  if (briefing.globalBriefing) {
    globalHTML = `
      <tr>
        <td style="padding: 16px 20px; background: rgba(201,168,76,0.05); border: 1px solid rgba(201,168,76,0.1); border-radius: 6px;">
          <div style="color: #C9A84C; font-size: 10px; font-weight: 700; letter-spacing: 2px; font-family: monospace; margin-bottom: 6px;">DAILY SYNTHESIS</div>
          <div style="color: #E8DCC8; font-size: 14px; font-style: italic; line-height: 1.6; font-family: Georgia, serif;">${briefing.globalBriefing}</div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #060D18; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #060D18;">
    <tr><td align="center" style="padding: 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

        <!-- HEADER -->
        <tr>
          <td style="padding: 28px 0 20px; border-bottom: 1px solid rgba(201,168,76,0.15);">
            <div style="color: #C9A84C; font-size: 10px; font-weight: 700; letter-spacing: 3px; font-family: monospace; margin-bottom: 6px;">
              ● ZENITH RISE CAPITAL
            </div>
            <div style="color: #E8DCC8; font-size: 28px; font-weight: 600; font-family: Georgia, serif; letter-spacing: -0.5px;">
              Morning Intelligence
            </div>
            <div style="color: #5A6A80; font-size: 13px; margin-top: 4px;">
              ${briefing.date} · Geopolitical Observatory · Advisory Signals
            </div>
          </td>
        </tr>

        <tr><td style="height: 20px;"></td></tr>
        ${globalHTML}
        ${categoriesHTML}

        <!-- FOOTER -->
        <tr><td style="height: 32px;"></td></tr>
        <tr>
          <td style="border-top: 1px solid rgba(201,168,76,0.1); padding: 20px 0; text-align: center;">
            <div style="color: #3A4555; font-size: 11px; font-family: monospace; letter-spacing: 1px; margin-bottom: 6px;">
              ZENITH RISE CAPITAL · GEOPOLITICAL INTELLIGENCE & INVESTMENT ADVISORY
            </div>
            <div style="color: #2A3340; font-size: 10px; font-family: Georgia, serif; margin-bottom: 12px;">
              Calesius Global S.L. · Madrid · This briefing is for informational purposes only and does not constitute investment advice.
            </div>
            <div style="margin-bottom: 8px;">
              <a href="https://zenith-news-room.netlify.app" style="color: #C9A84C; font-size: 11px; font-family: monospace; letter-spacing: 0.5px; text-decoration: none;">
                VIEW FULL BRIEFING ONLINE →
              </a>
            </div>
            <div>
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #5A6A80; font-size: 10px; font-family: monospace; text-decoration: underline;">
                Unsubscribe
              </a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `;
}

async function sendDigest() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
    console.log("⚠ Resend keys not configured. Skipping email digest.");
    return;
  }

  // Read the generated briefing
  if (!fs.existsSync("data.json")) {
    console.error("❌ data.json not found. Generate briefing first.");
    process.exit(1);
  }

  const briefing = JSON.parse(fs.readFileSync("data.json", "utf8"));
  const totalItems = Object.values(briefing.categories)
    .reduce((sum, c) => sum + (c.items?.length || 0), 0);

  if (totalItems === 0) {
    console.log("⚠ No signals in briefing. Skipping email.");
    return;
  }

  console.log("📧 Building email digest...");
  const html = buildEmailHTML(briefing);

  // Step 1: Create the broadcast
  console.log("  Creating broadcast...");
  const createRes = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      audience_id: RESEND_AUDIENCE_ID,
      from: "ZRC Intelligence <intelligence@zenrisecapital.com>",
      subject: "ZRC Morning Intelligence — " + briefing.date,
      html: html
    })
  });

  const createResult = await createRes.json();

  if (!createRes.ok) {
    console.error("❌ Failed to create broadcast:", JSON.stringify(createResult));
    return;
  }

  const broadcastId = createResult.id;
  console.log("  Broadcast created: " + broadcastId);

  // Step 2: Send the broadcast
  console.log("  Sending broadcast...");
  const sendRes = await fetch("https://api.resend.com/broadcasts/" + broadcastId + "/send", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json"
    }
  });

  const sendResult = await sendRes.json();

  if (!sendRes.ok) {
    console.error("❌ Failed to send broadcast:", JSON.stringify(sendResult));
    return;
  }

  console.log("✅ Email digest sent to all subscribers.");
}

sendDigest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Digest error:", err);
  process.exit(1);
});
