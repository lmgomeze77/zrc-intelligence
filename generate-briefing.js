// generate-briefing.js v2
// Fixed RSS feeds + Resend email dispatch
// Fetches free RSS feeds across 8 intelligence desks, ONE Haiku call,
// then sends the briefing via Resend to all subscribers.

const Parser = require("rss-parser");
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ZRC-Intelligence/2.0" }
});

// ─── RSS FEED SOURCES BY CATEGORY (UPDATED APRIL 2026) ─────────────────────
// All Reuters feeds replaced — Reuters killed RSS in 2020.
// Google News RSS proxy used where no direct feed exists.
// Every URL below verified as of April 2026.

const FEEDS = {
  geopolitics: {
    label: "Geopolitics & Security",
    icon: "🌍",
    description: "Conflicts, alliances, sanctions, and power shifts",
    sources: [
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml" },
      { name: "Geopolitical Futures", url: "https://geopoliticalfutures.com/feed/" },
      { name: "AP News World", url: "https://rsshub.app/apnews/topics/world-news" },
      { name: "The Diplomat", url: "https://thediplomat.com/feed/" }
    ]
  },
  fdi: {
    label: "FDI & Capital Flows",
    icon: "💰",
    description: "Cross-border investments, sovereign wealth, and capital movements",
    sources: [
      { name: "FT World", url: "https://www.ft.com/world?format=rss" },
      { name: "Brookings", url: "https://www.brookings.edu/feed/" },
      { name: "World Bank Blogs", url: "https://blogs.worldbank.org/en/rss.xml" },
      { name: "Google News FDI", url: "https://news.google.com/rss/search?q=when:48h+foreign+direct+investment&ceid=US:en&hl=en-US&gl=US" }
    ]
  },
  "critical-minerals": {
    label: "Critical Minerals & Energy",
    icon: "⚡",
    description: "Supply chains, commodity prices, and energy security",
    sources: [
      { name: "Mining.com", url: "https://www.mining.com/feed/" },
      { name: "OilPrice.com", url: "https://oilprice.com/rss/main" },
      { name: "Oil & Gas 360", url: "https://www.oilandgas360.com/feed/" },
      { name: "Google News Energy", url: "https://news.google.com/rss/search?q=when:48h+energy+markets+oil+gas&ceid=US:en&hl=en-US&gl=US" }
    ]
  },
  "real-estate": {
    label: "Real Estate & Infrastructure",
    icon: "🏗️",
    description: "Institutional RE, infrastructure projects, and market trends",
    sources: [
      { name: "Bisnow", url: "https://www.bisnow.com/feed" },
      { name: "Infrastructure Investor", url: "https://www.infrastructureinvestor.com/feed/" },
      { name: "Google News CRE", url: "https://news.google.com/rss/search?q=when:48h+commercial+real+estate+investment&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Infra", url: "https://news.google.com/rss/search?q=when:48h+infrastructure+investment+project&ceid=US:en&hl=en-US&gl=US" }
    ]
  },
  "ma-growth": {
    label: "M&A & Growth Advisory",
    icon: "📊",
    description: "Deal flow, PE/VC activity, and corporate transactions",
    sources: [
      { name: "PE Hub", url: "https://www.pehub.com/feed/" },
      { name: "Pitchbook News", url: "https://pitchbook.com/feed/news" },
      { name: "Google News M&A", url: "https://news.google.com/rss/search?q=when:48h+mergers+acquisitions+deal&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News PE", url: "https://news.google.com/rss/search?q=when:48h+private+equity+venture+capital&ceid=US:en&hl=en-US&gl=US" }
    ]
  },
  "emerging-markets": {
    label: "Emerging Markets",
    icon: "🌏",
    description: "Frontier opportunities, risk signals, and market access",
    sources: [
      { name: "Al Jazeera Economy", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "African Business", url: "https://african.business/feed" },
      { name: "Nikkei Asia", url: "https://asia.nikkei.com/rss" },
      { name: "Americas Quarterly", url: "https://www.americasquarterly.org/feed/" },
      { name: "Asia Times", url: "https://asiatimes.com/feed/" }
    ]
  },
  "trade-policy": {
    label: "Trade & Industrial Policy",
    icon: "🏛️",
    description: "Tariffs, sanctions, export controls, and economic statecraft",
    sources: [
      { name: "Trade.gov", url: "https://www.trade.gov/rss.xml" },
      { name: "Google News Tariffs", url: "https://news.google.com/rss/search?q=when:48h+tariffs+trade+policy+sanctions&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News WTO", url: "https://news.google.com/rss/search?q=when:48h+WTO+trade+agreement&ceid=US:en&hl=en-US&gl=US" },
      { name: "Brookings Trade", url: "https://www.brookings.edu/topic/trade/feed/" }
    ]
  },
  "food-agriculture": {
    label: "Food & Agriculture",
    icon: "🌾",
    description: "Food security, agribusiness, and agricultural commodities",
    sources: [
      { name: "Google News Agriculture", url: "https://news.google.com/rss/search?q=when:48h+agriculture+food+security+commodity&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Agribusiness", url: "https://news.google.com/rss/search?q=when:48h+agribusiness+crop+harvest&ceid=US:en&hl=en-US&gl=US" },
      { name: "AgFunder News", url: "https://agfundernews.com/feed" },
      { name: "World Grain", url: "https://www.world-grain.com/rss" }
    ]
  }
};

// ─── FETCH RSS FEEDS ───────────────────────────────────────────────────────

async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;

    return (feed.items || [])
      .filter(item => {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        return pubDate > cutoff;
      })
      .slice(0, 5)
      .map(item => ({
        title: (item.title || "").trim(),
        summary: (item.contentSnippet || item.content || "").substring(0, 300).trim(),
        source: source.name,
        date: item.pubDate || "",
        link: item.link || ""
      }));
  } catch (err) {
    console.warn(`  ⚠ Failed: ${source.name} (${err.message})`);
    return [];
  }
}

async function fetchCategory(categoryId) {
  const config = FEEDS[categoryId];
  const results = [];

  for (const source of config.sources) {
    const items = await fetchFeed(source);
    results.push(...items);
  }

  const seen = new Set();
  const unique = results.filter(item => {
    const key = item.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return item.title.length > 10;
  });

  unique.sort((a, b) => new Date(b.date) - new Date(a.date));
  return unique.slice(0, 10);
}

// ─── AI SYNTHESIS (ONE SINGLE HAIKU CALL) ────────────────────────────────────

const MAX_RETRIES = 2;

async function synthesizeWithAI(allCategoryData) {
  const prompt = buildPrompt(allCategoryData);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${MAX_RETRIES}...`);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          system: `You are the intelligence analyst for Zenith Rise Capital (ZRC), a geopolitical intelligence and investment advisory firm based in Madrid.

Your task: Given raw RSS headlines grouped by intelligence desk, select the 3-4 most important items per desk, write a concise analytical summary for each, classify its investment signal, and provide strategic insights.

NEUTRALITY RULES (strict — apply to every headline, summary, and takeaway you write):
1. ATTRIBUTE EVERY CLAIM. Never state a contested fact as settled. Name the source.
2. QUANTIFY, DON'T CHARACTERIZE. Use data instead of judgment.
3. USE NEUTRAL VERBS ONLY. Permitted: reports, announces, records, documents, states, confirms, denies, claims, estimates.
4. SYMMETRIC FRAMING. Apply the same structure and verb register to all parties.
5. NO EDITORIALIZING. Never assess who is right or wrong.
6. LABEL DISPUTED TERMS with qualifiers.
7. STRIP SOURCE BIAS. Extract only factual claims and attributed quotes.

CRITICAL: Return ONLY valid JSON, no markdown, no backticks, no preamble. Keep summaries concise (2 sentences max).

Return this exact structure:
{
  "categories": {
    "category_id": {
      "items": [
        {
          "headline": "Rewritten concise headline — neutral verb, attributed, with key data point",
          "summary": "1-2 sentence institutional analysis. Include numbers and source attribution.",
          "source": "Original source name",
          "relevance": "One sentence: why this matters for investment decisions",
          "signal": "bullish" | "bearish" | "neutral" | "watch"
        }
      ],
      "keyTakeaway": "One sentence synthesis framed as a conditional: if X holds, expect Y"
    }
  },
  "globalBriefing": "2-3 sentence top-level synthesis across all desks. Data-first, no drama."
}

Be specific, data-rich, and dispassionate. Select only genuinely important items — skip filler.`,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const result = await response.json();

      if (result.error) {
        console.error(`  API error (attempt ${attempt}):`, result.error);
        continue;
      }

      const textBlock = (result.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("");

      if (!textBlock) {
        console.error(`  Empty response (attempt ${attempt})`);
        continue;
      }

      if (result.stop_reason && result.stop_reason !== "end_turn") {
        console.warn(`  ⚠ Response truncated (stop_reason: ${result.stop_reason}), retrying...`);
        continue;
      }

      const clean = textBlock.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      console.log("  ✅ AI synthesis successful.");
      return parsed;

    } catch (err) {
      console.error(`  AI synthesis failed (attempt ${attempt}): ${err.message}`);
      if (attempt < MAX_RETRIES) {
        console.log("  Retrying in 3 seconds...");
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.error("  ❌ All AI synthesis attempts failed.");
  return null;
}

function buildPrompt(allCategoryData) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  let prompt = `Today is ${today}. Below are raw RSS headlines from the last 48 hours, grouped by intelligence desk. Analyze and synthesize them.\n\n`;

  for (const [catId, items] of Object.entries(allCategoryData)) {
    const config = FEEDS[catId];
    prompt += `=== ${config.label.toUpperCase()} (id: ${catId}) ===\n`;
    if (items.length === 0) {
      prompt += "(No recent items)\n\n";
      continue;
    }
    for (const item of items) {
      prompt += `- [${item.source}] ${item.title}\n`;
      if (item.summary) prompt += `  ${item.summary.substring(0, 200)}\n`;
    }
    prompt += "\n";
  }

  return prompt;
}

// ─── EMAIL DISPATCH VIA RESEND ──────────────────────────────────────────────

async function sendBriefingEmail(briefing) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM || "ZRC Intelligence <intelligence@zenithrisecapital.com>";
  const SUBSCRIBER_EMAILS = process.env.SUBSCRIBER_EMAILS; // comma-separated

  if (!RESEND_API_KEY) {
    console.warn("  ⚠ RESEND_API_KEY not set — skipping email dispatch.");
    return;
  }

  if (!SUBSCRIBER_EMAILS) {
    console.warn("  ⚠ SUBSCRIBER_EMAILS not set — skipping email dispatch.");
    return;
  }

  const recipients = SUBSCRIBER_EMAILS.split(",").map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("  ⚠ No recipients — skipping email dispatch.");
    return;
  }

  // Build HTML email
  const html = buildEmailHTML(briefing);
  const subject = `ZRC Morning Intelligence — ${briefing.date}`;

  console.log(`  📧 Sending to ${recipients.length} recipient(s)...`);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: recipients,
        subject: subject,
        html: html
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`  ✅ Email sent successfully (id: ${result.id})`);
    } else {
      console.error(`  ❌ Resend error:`, result);
    }
  } catch (err) {
    console.error(`  ❌ Email dispatch failed: ${err.message}`);
  }
}

function buildEmailHTML(briefing) {
  const signalColor = { bullish: "#22C55E", bearish: "#EF4444", neutral: "#A1A1AA", watch: "#F59E0B" };

  let categoriesHTML = "";
  for (const [catId, cat] of Object.entries(briefing.categories)) {
    if (!cat.items || cat.items.length === 0) continue;

    let itemsHTML = "";
    for (const item of cat.items) {
      const color = signalColor[item.signal] || "#A1A1AA";
      itemsHTML += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #27272A;">
            <div style="display: inline-block; padding: 2px 6px; background: ${color}20; color: ${color}; font-size: 10px; font-family: monospace; font-weight: 600; letter-spacing: 0.1em; border: 1px solid ${color}40; margin-bottom: 6px;">
              ${(item.signal || "neutral").toUpperCase()}
            </div>
            <div style="font-size: 14px; font-weight: 500; color: #FAFAFA; margin-bottom: 4px;">${item.headline}</div>
            <div style="font-size: 12px; color: #A1A1AA; line-height: 1.5; margin-bottom: 4px;">${item.summary}</div>
            <div style="font-size: 11px; color: #71717A; font-style: italic;">${item.relevance || ""}</div>
            <div style="font-size: 10px; color: #71717A; margin-top: 4px; font-family: monospace;">${item.source}</div>
          </td>
        </tr>`;
    }

    categoriesHTML += `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
        <tr>
          <td style="padding-bottom: 12px; border-bottom: 1px solid rgba(212,168,83,0.25);">
            <span style="font-size: 12px; color: #D4A853; font-family: monospace; letter-spacing: 0.15em;">${cat.icon} ${cat.label.toUpperCase()}</span>
            ${cat.keyTakeaway ? `<div style="font-size: 12px; color: #A1A1AA; margin-top: 6px; font-style: italic;">Key takeaway: ${cat.keyTakeaway}</div>` : ""}
          </td>
        </tr>
        ${itemsHTML}
      </table>`;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #09090B; font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #09090B;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid rgba(212,168,83,0.25);">
              <div style="font-size: 11px; color: #D4A853; font-family: monospace; letter-spacing: 0.3em; margin-bottom: 8px;">ZENITH RISE CAPITAL</div>
              <div style="font-size: 24px; font-weight: 300; color: #FAFAFA; font-family: Georgia, serif;">Morning Intelligence Brief</div>
              <div style="font-size: 12px; color: #71717A; font-family: monospace; margin-top: 6px;">${briefing.date}</div>
            </td>
          </tr>

          <!-- Global Briefing -->
          ${briefing.globalBriefing ? `
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #27272A;">
              <div style="font-size: 10px; color: #D4A853; font-family: monospace; letter-spacing: 0.15em; margin-bottom: 8px;">GLOBAL OVERVIEW</div>
              <div style="font-size: 14px; color: #FAFAFA; line-height: 1.6;">${briefing.globalBriefing}</div>
            </td>
          </tr>` : ""}

          <!-- Categories -->
          <tr>
            <td style="padding-top: 24px;">
              ${categoriesHTML}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid rgba(212,168,83,0.25); text-align: center;">
              <div style="font-size: 10px; color: #71717A; font-family: monospace; letter-spacing: 0.1em;">
                © 2026 Calesius Global SL · CIF B56399207<br>
                MADRID · LUXEMBOURG · GLOBAL<br><br>
                <a href="https://zenithrisecapital.com" style="color: #D4A853; text-decoration: none;">zenithrisecapital.com</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── MAIN ───────────────────────────────────────────────────────────

async function main() {
  console.log("📡 ZRC Morning Intelligence — generating daily briefing\n");
  console.log("Phase 1: Fetching RSS feeds...\n");

  const allRaw = {};
  let totalItems = 0;

  for (const catId of Object.keys(FEEDS)) {
    const config = FEEDS[catId];
    console.log(`  ${config.icon} ${config.label}...`);
    const items = await fetchCategory(catId);
    allRaw[catId] = items;
    totalItems += items.length;
    console.log(`     → ${items.length} items`);
  }

  console.log(`\n  Total: ${totalItems} items across ${Object.keys(FEEDS).length} desks\n`);

  // Phase 2: AI synthesis
  console.log("Phase 2: AI synthesis (single Haiku call)...\n");

  const aiResult = await synthesizeWithAI(allRaw);

  // Build final output
  const briefing = {
    generated: new Date().toISOString(),
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }),
    globalBriefing: aiResult?.globalBriefing || "",
    categories: {}
  };

  for (const catId of Object.keys(FEEDS)) {
    const config = FEEDS[catId];
    const aiCat = aiResult?.categories?.[catId];

    briefing.categories[catId] = {
      label: config.label,
      icon: config.icon,
      description: config.description,
      items: aiCat?.items || [],
      keyTakeaway: aiCat?.keyTakeaway || "No significant signals detected.",
      rawCount: allRaw[catId].length
    };
  }

  // Write output
  const fs = require("fs");
  fs.writeFileSync("data.json", JSON.stringify(briefing, null, 2));

  const aiItems = Object.values(briefing.categories)
    .reduce((sum, c) => sum + (c.items?.length || 0), 0);

  console.log(`✅ Done. ${aiItems} curated items from ${totalItems} raw headlines.`);
  console.log("📄 data.json written.\n");

  // Phase 3: Email dispatch
  console.log("Phase 3: Email dispatch via Resend...\n");
  await sendBriefingEmail(briefing);

  console.log("\n🏁 Pipeline complete.\n");
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
