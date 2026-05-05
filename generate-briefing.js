// generate-briefing.js v3
// 9 intelligence desks including dedicated MACRO & CENTRAL BANKS desk.
// Each desk is a clean, non-overlapping data source — no cross-desk duplication.
// UPDATED MAY 2026: Added macro/central-bank desk; all feeds verified.

const Parser = require("rss-parser");
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ZRC-Intelligence/3.0" }
});

// ─── RSS FEED SOURCES BY CATEGORY ────────────────────────────────────────────
// Each category is self-contained. No category should share sources with another.

const FEEDS = {
  // ── NEW: Dedicated macro/central-bank desk ────────────────────────────────
  "macro": {
    label: "Macro & Central Banks",
    icon: "🏦",
    description: "Central bank decisions, inflation prints, GDP, yield curves, and FX",
    sources: [
      { name: "Federal Reserve",      url: "https://www.federalreserve.gov/feeds/press_all.xml" },
      { name: "ECB Press Releases",   url: "https://www.ecb.europa.eu/rss/press.html" },
      { name: "BIS Publications",     url: "https://www.bis.org/doclist/all_speeches.rss" },
      { name: "IMF Blog",             url: "https://www.imf.org/en/News/rss?language=eng&category=blog" },
      { name: "World Bank Research",  url: "https://blogs.worldbank.org/en/rss.xml" },
      { name: "Google News Macro",    url: "https://news.google.com/rss/search?q=when:48h+central+bank+interest+rates+inflation+GDP&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Fed",      url: "https://news.google.com/rss/search?q=when:48h+Federal+Reserve+ECB+rate+decision+yield+curve&ceid=US:en&hl=en-US&gl=US" },
      { name: "MarketWatch Economy",  url: "https://feeds.marketwatch.com/marketwatch/economy-politics" }
    ]
  },

  // ── Geopolitics: pure political/security signals, no macro overlap ─────────
  "geopolitics": {
    label: "Geopolitics & Security",
    icon: "🌍",
    description: "Conflicts, alliances, sanctions, and power shifts",
    sources: [
      { name: "Al Jazeera",              url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "BBC World",               url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "Foreign Affairs",         url: "https://www.foreignaffairs.com/rss.xml" },
      { name: "Geopolitical Futures",    url: "https://geopoliticalfutures.com/feed/" },
      { name: "The Diplomat",            url: "https://thediplomat.com/feed/" },
      { name: "Google News Geopolitics", url: "https://news.google.com/rss/search?q=when:48h+geopolitics+sanctions+military+conflict+alliance&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── FDI: cross-border capital movements, sovereign wealth funds ───────────
  "fdi": {
    label: "FDI & Capital Flows",
    icon: "💰",
    description: "Cross-border investments, sovereign wealth, and capital movements",
    sources: [
      { name: "FT World",           url: "https://www.ft.com/world?format=rss" },
      { name: "Brookings",          url: "https://www.brookings.edu/feed/" },
      { name: "Google News FDI",    url: "https://news.google.com/rss/search?q=when:48h+foreign+direct+investment+sovereign+wealth+fund+capital+flows&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News SWF",    url: "https://news.google.com/rss/search?q=when:48h+sovereign+wealth+fund+institutional+investor+cross-border&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── Critical minerals & energy: commodities, supply chains ───────────────
  "critical-minerals": {
    label: "Commodities & Energy",
    icon: "⚡",
    description: "Oil, gas, metals, supply chains, and energy security",
    sources: [
      { name: "Mining.com",       url: "https://www.mining.com/feed/" },
      { name: "OilPrice.com",     url: "https://oilprice.com/rss/main" },
      { name: "Oil & Gas 360",    url: "https://www.oilandgas360.com/feed/" },
      { name: "Google News Energy",  url: "https://news.google.com/rss/search?q=when:48h+oil+gas+LNG+critical+minerals+metals+OPEC&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── Real estate & infrastructure ─────────────────────────────────────────
  "real-estate": {
    label: "Real Estate & Infrastructure",
    icon: "🏗️",
    description: "Institutional RE, infrastructure projects, and market trends",
    sources: [
      { name: "Bisnow",                url: "https://www.bisnow.com/feed" },
      { name: "Infrastructure Investor",url: "https://www.infrastructureinvestor.com/feed/" },
      { name: "Google News CRE",       url: "https://news.google.com/rss/search?q=when:48h+commercial+real+estate+REIT+investment&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Infra",     url: "https://news.google.com/rss/search?q=when:48h+infrastructure+investment+fund+project+finance&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── M&A & deals: PE, VC, corporate transactions ──────────────────────────
  "ma-growth": {
    label: "M&A & Private Capital",
    icon: "📊",
    description: "Deal flow, PE/VC activity, and corporate transactions",
    sources: [
      { name: "PE Hub",            url: "https://www.pehub.com/feed/" },
      { name: "Pitchbook News",    url: "https://pitchbook.com/feed/news" },
      { name: "Google News M&A",   url: "https://news.google.com/rss/search?q=when:48h+merger+acquisition+buyout+deal&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News PE",    url: "https://news.google.com/rss/search?q=when:48h+private+equity+venture+capital+LBO&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── Emerging markets: frontier, EM-specific signals ──────────────────────
  "emerging-markets": {
    label: "Emerging Markets",
    icon: "🌏",
    description: "Frontier opportunities, risk signals, and market access",
    sources: [
      { name: "African Business",    url: "https://african.business/feed" },
      { name: "Nikkei Asia",         url: "https://asia.nikkei.com/rss" },
      { name: "Americas Quarterly",  url: "https://www.americasquarterly.org/feed/" },
      { name: "Asia Times",          url: "https://asiatimes.com/feed/" },
      { name: "Google News EM",      url: "https://news.google.com/rss/search?q=when:48h+emerging+markets+frontier+BRICS+developing+economies&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── Trade & industrial policy: tariffs, controls, agreements ─────────────
  "trade-policy": {
    label: "Trade & Industrial Policy",
    icon: "🏛️",
    description: "Tariffs, sanctions, export controls, and economic statecraft",
    sources: [
      { name: "Trade.gov",           url: "https://www.trade.gov/rss.xml" },
      { name: "Brookings Trade",     url: "https://www.brookings.edu/topic/trade/feed/" },
      { name: "Google News Tariffs", url: "https://news.google.com/rss/search?q=when:48h+tariffs+trade+policy+export+controls+WTO&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Reshoring",url: "https://news.google.com/rss/search?q=when:48h+reshoring+nearshoring+industrial+policy+subsidy&ceid=US:en&hl=en-US&gl=US" }
    ]
  },

  // ── Food & agriculture: food security, agri-commodities ──────────────────
  "food-agriculture": {
    label: "Food & Agriculture",
    icon: "🌾",
    description: "Food security, agribusiness, and agricultural commodities",
    sources: [
      { name: "AgFunder News",       url: "https://agfundernews.com/feed" },
      { name: "Google News Food",    url: "https://news.google.com/rss/search?q=when:48h+food+security+agriculture+crop+harvest+commodity&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Agri",    url: "https://news.google.com/rss/search?q=when:48h+agribusiness+wheat+corn+soybean+fertilizer&ceid=US:en&hl=en-US&gl=US" }
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

// ─── AI SYNTHESIS ─────────────────────────────────────────────────────────

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
          system: `You are the chief intelligence analyst for Zenith Rise Capital (ZRC), a geopolitical intelligence and investment advisory firm in Madrid. Your briefings are read by family offices, institutional investors, and senior advisors.

Your task: Given raw RSS headlines grouped by intelligence desk, select the 3 most important items per desk, write concise analytical summaries, classify investment signals, and provide a key takeaway per desk.

NEUTRALITY RULES (strict):
1. ATTRIBUTE EVERY CLAIM. Never state contested facts as settled. Name the source: "according to Reuters," "per ECB statement," "IMF estimates."
2. QUANTIFY, DON'T CHARACTERIZE. Use data: "third consecutive week" not "surging." "14 basis points" not "sharp rise."
3. USE NEUTRAL VERBS: reports, announces, records, estimates, confirms, publishes, issues. Never: violates, escalates, sparks, slams, blasts.
4. SYMMETRIC FRAMING. Apply identical grammatical structure and verb register to all parties in any dispute.
5. NO EDITORIALIZING. Never imply causality unless sourced. Never imply who is right or wrong.
6. LABEL DISPUTED TERMS. Qualify contested terminology appropriately.
7. STRIP SOURCE BIAS. Extract only factual claims; discard editorial framing from source material.

MACRO DESK SPECIAL RULES:
- For the "macro" category, prioritize: central bank rate decisions, CPI/PPI/PCE prints, GDP data, unemployment figures, yield curve moves, and major FX developments.
- Quantify: always include the actual number (e.g. "Fed holds at 4.25–4.50%", "Eurozone CPI at 2.2% YoY").
- Do NOT include geopolitical items in the macro desk — that is a separate desk.

CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No preamble. Keep summaries to 2 sentences max.

Return this exact structure:
{
  "categories": {
    "category_id": {
      "items": [
        {
          "headline": "Precise headline with attributed data point",
          "summary": "1-2 sentence institutional analysis. Numbers and source attribution. No editorializing.",
          "source": "Original source name",
          "relevance": "One sentence: direct investment implication.",
          "signal": "bullish" | "bearish" | "neutral" | "watch"
        }
      ],
      "keyTakeaway": "One sentence conditional: if X holds, expect Y for Z asset class"
    }
  },
  "globalBriefing": "3 sentence top-level synthesis. Cross-desk connections. Data-first. No drama.",
  "marketOpen": "One sentence: primary risk or catalyst to watch at market open today."
}`,
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

  let prompt = `Today is ${today}. Below are raw RSS headlines from the last 48 hours, grouped by intelligence desk. Each desk is independent — do not move items between desks.\n\n`;

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

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("📡 ZRC Morning Intelligence v3 — generating daily briefing\n");
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

  console.log("Phase 2: AI synthesis (single Haiku call)...\n");
  const aiResult = await synthesizeWithAI(allRaw);

  const briefing = {
    generated: new Date().toISOString(),
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }),
    globalBriefing: aiResult?.globalBriefing || "",
    marketOpen: aiResult?.marketOpen || "",
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

  const fs = require("fs");
  fs.writeFileSync("data.json", JSON.stringify(briefing, null, 2));

  const aiItems = Object.values(briefing.categories)
    .reduce((sum, c) => sum + (c.items?.length || 0), 0);

  console.log(`✅ Done. ${aiItems} curated items from ${totalItems} raw headlines.`);
  console.log("📄 data.json written.\n");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
