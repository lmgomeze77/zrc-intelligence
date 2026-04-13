// generate-briefing.js
// Fetches free RSS feeds across 8 intelligence desks, then makes ONE Haiku
// call to classify signals and write analytical takeaways.
// Cost: ~$0.01-0.03 per run → ~$0.50-1.00/month
//
// UPDATED APRIL 2026: All broken Reuters/UNCTAD/CFR/FAO/WFP feeds replaced
// with working alternatives. Google News RSS proxy used where no direct feed exists.

const Parser = require("rss-parser");
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ZRC-Intelligence/2.0" }
});

// ─── RSS FEED SOURCES BY CATEGORY (VERIFIED APRIL 2026) ─────────────────────

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
      { name: "The Diplomat", url: "https://thediplomat.com/feed/" },
      { name: "Google News Geopolitics", url: "https://news.google.com/rss/search?q=when:48h+geopolitics+sanctions+conflict&ceid=US:en&hl=en-US&gl=US" }
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
      { name: "Google News FDI", url: "https://news.google.com/rss/search?q=when:48h+foreign+direct+investment+capital+flows&ceid=US:en&hl=en-US&gl=US" }
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
      { name: "Google News Energy", url: "https://news.google.com/rss/search?q=when:48h+energy+oil+gas+critical+minerals&ceid=US:en&hl=en-US&gl=US" }
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
      { name: "Brookings Trade", url: "https://www.brookings.edu/topic/trade/feed/" },
      { name: "Google News Tariffs", url: "https://news.google.com/rss/search?q=when:48h+tariffs+trade+policy+sanctions&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News WTO", url: "https://news.google.com/rss/search?q=when:48h+WTO+trade+agreement&ceid=US:en&hl=en-US&gl=US" }
    ]
  },
  "food-agriculture": {
    label: "Food & Agriculture",
    icon: "🌾",
    description: "Food security, agribusiness, and agricultural commodities",
    sources: [
      { name: "AgFunder News", url: "https://agfundernews.com/feed" },
      { name: "Google News Agriculture", url: "https://news.google.com/rss/search?q=when:48h+agriculture+food+security+commodity&ceid=US:en&hl=en-US&gl=US" },
      { name: "Google News Agribusiness", url: "https://news.google.com/rss/search?q=when:48h+agribusiness+crop+harvest&ceid=US:en&hl=en-US&gl=US" }
    ]
  }
};

// ─── FETCH RSS FEEDS ───────────────────────────────────────────────────────

async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const cutoff = Date.now() - 48 * 60 * 60 * 1000; // last 48h

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

  // Deduplicate by title similarity and sort by date
  const seen = new Set();
  const unique = results.filter(item => {
    const key = item.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return item.title.length > 10;
  });

  unique.sort((a, b) => new Date(b.date) - new Date(a.date));
  return unique.slice(0, 10); // top 10 per category
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
1. ATTRIBUTE EVERY CLAIM. Never state a contested fact as settled. Name the source: "according to OCHA," "per Reuters," "IDF spokesperson confirmed."
2. QUANTIFY, DON'T CHARACTERIZE. Use data instead of judgment. Say "third consecutive weekly increase" not "surging." Say "14 incidents recorded by UNRWA in March" not "violations persist."
3. USE NEUTRAL VERBS ONLY. Permitted: reports, announces, records, documents, states, confirms, denies, claims, estimates, publishes, issues. Forbidden: violates, provokes, escalates, slams, blasts, sparks outrage, persists (when implying wrongdoing).
4. SYMMETRIC FRAMING. Apply the same grammatical structure and verb register to all parties in a conflict or dispute. If one side "announces," the other side also "announces" — never "admits" or "claims" asymmetrically.
5. NO EDITORIALIZING. Never assess who is right or wrong. Never imply causality unless explicitly sourced. Never use "but" to undercut a party's position.
6. LABEL DISPUTED TERMS. Use qualifiers for contested terminology: "what Ukraine describes as occupied territory," "settlements considered illegal under international law by the ICJ," "what Israel designates a security zone."
7. STRIP SOURCE BIAS. RSS feeds carry editorial tone from their publishers. Extract only factual claims and attributed quotes. Discard opinion, commentary, and editorial framing from the source material before synthesizing.

CRITICAL: Return ONLY valid JSON, no markdown, no backticks, no preamble. Keep summaries concise (2 sentences max) to stay within token limits.

Return this exact structure:
{
  "categories": {
    "category_id": {
      "items": [
        {
          "headline": "Rewritten concise headline — neutral verb, attributed, with key data point",
          "summary": "1-2 sentence institutional analysis. Include numbers and source attribution. No editorializing.",
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

Be specific, data-rich, and dispassionate. Model your tone on Bloomberg Terminal headlines. Select only genuinely important items — skip filler. If a desk has no meaningful items, return fewer items rather than padding. When in doubt, be boring. Precision and credibility outrank engagement.`,
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

      // Check if response was truncated (stop_reason !== "end_turn")
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

  // Merge AI analysis with category metadata
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
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
