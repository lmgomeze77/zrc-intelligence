// generate-briefing.js
// Fetches free RSS feeds across 8 intelligence desks, then makes ONE Haiku
// call to classify signals and write analytical takeaways.
// Cost: ~$0.01-0.03 per run → ~$0.50-1.00/month

const Parser = require("rss-parser");
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ZRC-Intelligence/1.0" }
});

// ─── RSS FEED SOURCES BY CATEGORY ───────────────────────────────────────────

const FEEDS = {
  geopolitics: {
    label: "Geopolitics & Security",
    icon: "🌍",
    description: "Conflicts, alliances, sanctions, and power shifts",
    sources: [
      { name: "Reuters World", url: "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best" },
      { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { name: "Foreign Affairs", url: "https://www.foreignaffairs.com/rss.xml" },
      { name: "Council on Foreign Relations", url: "https://www.cfr.org/rss.xml" }
    ]
  },
  fdi: {
    label: "FDI & Capital Flows",
    icon: "💰",
    description: "Cross-border investments, sovereign wealth, and capital movements",
    sources: [
      { name: "FT World", url: "https://www.ft.com/world?format=rss" },
      { name: "UNCTAD", url: "https://unctad.org/rss.xml" },
      { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best" },
      { name: "World Bank Blogs", url: "https://blogs.worldbank.org/feed" }
    ]
  },
  "critical-minerals": {
    label: "Critical Minerals & Energy",
    icon: "⚡",
    description: "Supply chains, commodity prices, and energy security",
    sources: [
      { name: "Mining.com", url: "https://www.mining.com/feed/" },
      { name: "Reuters Energy", url: "https://www.reutersagency.com/feed/?best-topics=environment&post_type=best" },
      { name: "OilPrice.com", url: "https://oilprice.com/rss/main" },
      { name: "IEA News", url: "https://www.iea.org/rss/news.xml" }
    ]
  },
  "real-estate": {
    label: "Real Estate & Infrastructure",
    icon: "🏗️",
    description: "Institutional RE, infrastructure projects, and market trends",
    sources: [
      { name: "GlobeSt", url: "https://www.globest.com/feed/" },
      { name: "Property Week", url: "https://www.propertyweek.com/rss" },
      { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best" },
      { name: "Infrastructure Investor", url: "https://www.infrastructureinvestor.com/feed/" }
    ]
  },
  "ma-growth": {
    label: "M&A & Growth Advisory",
    icon: "📊",
    description: "Deal flow, PE/VC activity, and corporate transactions",
    sources: [
      { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best" },
      { name: "PE Hub", url: "https://www.pehub.com/feed/" },
      { name: "Pitchbook News", url: "https://pitchbook.com/feed/news" },
      { name: "Mergermarket", url: "https://www.mergermarket.com/info/rss-feeds" }
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
      { name: "Americas Quarterly", url: "https://www.americasquarterly.org/feed/" }
    ]
  },
  "trade-policy": {
    label: "Trade & Industrial Policy",
    icon: "🏛️",
    description: "Tariffs, sanctions, export controls, and economic statecraft",
    sources: [
      { name: "WTO News", url: "https://www.wto.org/english/news_e/news_e.rss" },
      { name: "PIIE", url: "https://www.piie.com/blogs/feed/realtime-economics" },
      { name: "Reuters Politics", url: "https://www.reutersagency.com/feed/?best-topics=political-general&post_type=best" },
      { name: "Trade.gov", url: "https://www.trade.gov/rss.xml" }
    ]
  },
  "food-agriculture": {
    label: "Food & Agriculture",
    icon: "🌾",
    description: "Food security, agribusiness, and agricultural commodities",
    sources: [
      { name: "FAO News", url: "https://www.fao.org/rss/home.xml" },
      { name: "Reuters Commodities", url: "https://www.reutersagency.com/feed/?best-topics=commodity-markets&post_type=best" },
      { name: "IFPRI", url: "https://www.ifpri.org/rss.xml" },
      { name: "World Food Programme", url: "https://www.wfp.org/rss.xml" }
    ]
  }
};

// ─── FETCH RSS FEEDS ────────────────────────────────────────────────────────

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

async function synthesizeWithAI(allCategoryData) {
  const prompt = buildPrompt(allCategoryData);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: `You are the intelligence analyst for Zenith Rise Capital (ZRC), a geopolitical intelligence and investment advisory firm based in Madrid. 

Your task: Given raw RSS headlines grouped by intelligence desk, select the 4-5 most important items per desk, write a concise analytical summary for each, classify its investment signal, and provide a key takeaway per desk.

CRITICAL: Return ONLY valid JSON, no markdown, no backticks, no preamble.

Return this exact structure:
{
  "categories": {
    "category_id": {
      "items": [
        {
          "headline": "Rewritten concise headline with key data",
          "summary": "2-3 sentence institutional analysis. Include numbers and implications.",
          "source": "Original source name",
          "relevance": "One sentence: why this matters for investment decisions",
          "signal": "bullish" | "bearish" | "neutral" | "watch"
        }
      ],
      "keyTakeaway": "One sentence synthesis of the most important signal"
    }
  },
  "globalBriefing": "2-3 sentence top-level synthesis across all desks"
}

Be specific, data-rich, and analytical. Write in institutional tone. Select only genuinely important items — skip filler. If a desk has no meaningful items, return fewer items rather than padding.`,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error("API error:", result.error);
      return null;
    }

    const textBlock = (result.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    if (!textBlock) return null;

    const clean = textBlock.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("AI synthesis failed:", err.message);
    return null;
  }
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

// ─── MAIN ────────────────────────────────────────────────────────────────────

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
