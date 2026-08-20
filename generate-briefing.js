// generate-briefing.js v4
// 9 intelligence desks including dedicated MACRO & CENTRAL BANKS desk.
// Each desk is a clean, non-overlapping data source — no cross-desk duplication.
// UPDATED MAY 2026: Added macro/central-bank desk; all feeds verified.
// UPDATED AUG 2026 (v4): Executive intelligence layer — market regime, risk index,
//   region signals, executive pulse, opportunity radar, house view, catalyst
//   calendar — plus impact / conviction / horizon on every desk item. Each of
//   those fields has a deterministic fallback derived from the desks, and the
//   previous data.json is fed back in so house levels move with continuity.

const fs = require("fs");
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

// ─── INTELLIGENCE LAYER VOCABULARIES ──────────────────────────────────────
// Everything the executive layer can emit is constrained to a closed vocabulary
// so the front-end never has to guess, and so day-over-day comparisons are real.

const SCHEMA_VERSION = 2;

const SIGNALS = ["bullish", "bearish", "neutral", "watch"];
const CONVICTIONS = ["low", "medium", "high"];
const HORIZONS = ["0-1M", "1-3M", "3-6M", "6-12M", "12M+"];

const REGIME_TONES = ["CONSTRUCTIVE", "BALANCED", "CAUTIOUS"];
const REGION_VIEWS = ["POSITIVE", "CONSTRUCTIVE", "NEUTRAL", "MIXED", "CAUTIOUS", "NEGATIVE"];
const PRIVATE_MARKET_VIEWS = ["ATTRACTIVE", "SELECTIVE", "NEUTRAL", "TIGHT", "CHALLENGING"];
const HOUSE_VIEWS = ["CONSTRUCTIVE", "SELECTIVE", "NEUTRAL", "CAUTIOUS", "DEFENSIVE"];

// The five stances on one risk axis, most defensive to most constructive.
// This ordering is what makes "upgraded" / "downgraded" a computed fact rather
// than something the model asserts in prose (and sometimes gets wrong).
const VIEW_RANK = { DEFENSIVE: 1, CAUTIOUS: 2, NEUTRAL: 3, SELECTIVE: 4, CONSTRUCTIVE: 5 };
const IMPACT_LEVELS = ["HIGH", "MEDIUM", "LOW"];

// Fixed House View book. Same labels every day → the "change" line is meaningful.
const HOUSE_VIEW_THEMES = [
  "Spain & Madrid Real Estate",
  "European Credit & Financing",
  "Private Capital Deployment",
  "Energy & Commodities",
  "Emerging Markets",
  "Global Risk Appetite"
];

// Signal → directional weight used by every derived metric.
const SIGNAL_DIRECTION = { bullish: 1, bearish: -1, watch: 0, neutral: 0 };
// Signal → risk contribution (bearish adds more risk than a bullish print removes).
const SIGNAL_RISK_WEIGHT = { bullish: -1, bearish: 1.2, watch: 0.6, neutral: 0 };

function pick(value, allowed, fallback) {
  const v = String(value == null ? "" : value).trim().toUpperCase();
  return allowed.includes(v) ? v : fallback;
}

function normalizeSignal(signal) {
  const v = String(signal == null ? "" : signal).trim().toLowerCase();
  return SIGNALS.includes(v) ? v : "neutral";
}

function normalizeConviction(conviction, impact) {
  const v = String(conviction == null ? "" : conviction).trim().toLowerCase();
  if (CONVICTIONS.includes(v)) return v;
  if (impact >= 5) return "high";
  if (impact >= 3) return "medium";
  return "low";
}

function normalizeHorizon(horizon) {
  const v = String(horizon == null ? "" : horizon).trim().toUpperCase().replace(/\s+/g, "");
  return HORIZONS.includes(v) ? v : "1-3M";
}

function normalizeImpact(impact, signal) {
  const n = Math.round(Number(impact));
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;
  // No usable value from the model → infer a conservative default from the signal.
  return normalizeSignal(signal) === "neutral" ? 2 : 3;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// ─── AI SYNTHESIS ─────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are the chief intelligence analyst for Zenith Rise Capital (ZRC), a geopolitical intelligence and investment advisory firm in Madrid. Your briefings are read by family offices, institutional investors, and senior advisors.

You produce TWO layers every morning.

LEVEL 1 — EXECUTIVE INTELLIGENCE (house level, read in 60 seconds):
market regime, risk index, region signals, executive pulse, opportunity radar, house view, catalyst calendar.

LEVEL 2 — DESK INTELLIGENCE:
for each desk, the 3 most important items, each with analysis and full classification.

Level 1 must be DERIVED FROM Level 2. Never assert at house level something that no desk item supports.

NEUTRALITY RULES (strict):
1. ATTRIBUTE EVERY CLAIM. Never state contested facts as settled. Name the source: "according to Reuters," "per ECB statement," "IMF estimates."
2. QUANTIFY, DON'T CHARACTERIZE. Use data: "third consecutive week" not "surging." "14 basis points" not "sharp rise."
3. USE NEUTRAL VERBS: reports, announces, records, estimates, confirms, publishes, issues. Never: violates, escalates, sparks, slams, blasts.
4. SYMMETRIC FRAMING. Apply identical grammatical structure and verb register to all parties in any dispute.
5. NO EDITORIALIZING. Never imply causality unless sourced. Never imply who is right or wrong.
6. LABEL DISPUTED TERMS. Qualify contested terminology appropriately.
7. STRIP SOURCE BIAS. Extract only factual claims; discard editorial framing from source material.

MACRO DESK SPECIAL RULES:
- For the "macro" desk, prioritize: central bank rate decisions, CPI/PPI/PCE prints, GDP data, unemployment figures, yield curve moves, and major FX developments.
- Quantify: always include the actual number (e.g. "Fed holds at 4.25-4.50%", "Eurozone CPI at 2.2% YoY").
- Do NOT include geopolitical items in the macro desk — that is a separate desk.

CLASSIFICATION SCALES (apply identically every day — these are the spine of the product):
- signal: "bullish" | "bearish" | "neutral" | "watch". The direction of the implication for capital allocation, NOT sentiment about the event. "watch" = direction unresolved but the item is positioned to matter.
- impact: integer 1-5. 1 = marginal, single-name relevance. 3 = changes positioning within one sector or one region. 5 = repricing event across asset classes.
- conviction: "low" | "medium" | "high". Your confidence in the READ, given source quality and corroboration. A single unconfirmed report is "low" regardless of how large the story is.
- horizon: "0-1M" | "1-3M" | "3-6M" | "6-12M" | "12M+". When the implication is expected to be expressed in prices or capital flows.
Reserve impact 5 for genuine cross-asset events. If everything is a 4 or 5, the scale is useless.

RISK INDEX (integer 0-100): the ZRC read on aggregate capital-markets risk.
0-30 benign · 31-50 normal · 51-70 elevated · 71-100 stressed.
You are given yesterday's value. Move it by more than 12 points ONLY if today's headlines contain an explicit, quantified shock. Absent new information, keep it within a few points of yesterday.

REGION SIGNALS — choose exactly one term from each list:
- europe / spain: POSITIVE | CONSTRUCTIVE | NEUTRAL | MIXED | CAUTIOUS | NEGATIVE
- privateMarkets: ATTRACTIVE | SELECTIVE | NEUTRAL | TIGHT | CHALLENGING

MARKET REGIME TONE — exactly one of: CONSTRUCTIVE | BALANCED | CAUTIOUS.

EXECUTIVE PULSE — exactly 3 entries, the three things a principal must know before the working day. Each: a 1-3 word "title" (the theme, not the desk name), "text" of at most 240 characters written as analysis rather than headline restatement, and a "signal". Every pulse entry must trace back to an item you included in a desk.

OPPORTUNITY RADAR — 4 to 6 themes where capital allocation is actually implicated today. "theme" is a capital-allocation theme, not a desk label (e.g. "European bank credit", "LNG shipping capacity"). "direction": "up" | "down" | "flat". "conviction": "HIGH" | "MEDIUM" | "SELECTIVE". "relevance": integer 1-5 for relevance to ZRC's mandate (Spain and Europe, real assets, private capital, cross-border flows).

HOUSE VIEW — return one entry for EACH of these six labels, in this order, every day:
${HOUSE_VIEW_THEMES.map(t => `  - ${t}`).join("\n")}
Each entry: "label" exactly as written above, "view", "signal", and "change".
- "view": one of CONSTRUCTIVE | SELECTIVE | NEUTRAL | CAUTIOUS | DEFENSIVE. These five only. "watch" is a signal value and is never a view.
- "signal": one of bullish | bearish | neutral | watch. It must not contradict the view — a CONSTRUCTIVE view does not carry a bearish signal.
- "change": the evidence behind today's stance, one or two sentences.

Do NOT state in "change" whether the view was upgraded, downgraded, maintained or left unchanged. That verdict is COMPUTED by comparing your "view" against yesterday's, and any claim you write there will be contradicted by it. Write only what you observed and why it supports the stance.
If you think a stance should move, move it by CHANGING the "view" field. Describing a move in prose while leaving "view" untouched publishes a contradiction.
You are given yesterday's house view — do not flip a view without evidence in today's headlines.

CATALYST CALENDAR — up to 6 dated events in the NEXT 72 HOURS that could move prices.
Include an event ONLY if today's headlines reference it, or if it is a scheduled release/meeting you are confident about (central bank decisions, CPI/GDP prints, elections, OPEC meetings, index reviews, major earnings).
NEVER invent an event, a date, or a time. If timing is uncertain, use "TBC" for the time rather than guessing.
"time": short mono-style string, CET (e.g. "TUE 11:00 CET", "WED TBC"). "title": the event. "impact": "HIGH" | "MEDIUM" | "LOW".
If nothing qualifies, return an empty array — an empty calendar is better than a fabricated one.

CRITICAL: Return ONLY valid JSON. No markdown. No backticks. No preamble. Keep summaries to 2 sentences max.

Return this exact structure:
{
  "riskIndex": 0-100,
  "marketRegime": { "tone": "CONSTRUCTIVE" | "BALANCED" | "CAUTIOUS", "rationale": "One sentence, data-first." },
  "regionSignals": { "europe": "...", "spain": "...", "privateMarkets": "..." },
  "executivePulse": [
    { "title": "Rates", "text": "...", "signal": "bullish" }
  ],
  "opportunityRadar": [
    { "theme": "...", "direction": "up", "conviction": "HIGH", "relevance": 4 }
  ],
  "houseView": [
    { "label": "Spain & Madrid Real Estate", "view": "CONSTRUCTIVE", "signal": "bullish", "change": "..." }
  ],
  "catalysts": [
    { "time": "TUE 11:00 CET", "title": "Eurozone CPI", "impact": "HIGH" }
  ],
  "categories": {
    "category_id": {
      "items": [
        {
          "headline": "Precise headline with attributed data point",
          "summary": "1-2 sentence institutional analysis. Numbers and source attribution. No editorializing.",
          "source": "Original source name",
          "relevance": "One sentence: direct investment implication.",
          "signal": "bullish" | "bearish" | "neutral" | "watch",
          "impact": 1-5,
          "conviction": "low" | "medium" | "high",
          "horizon": "0-1M" | "1-3M" | "3-6M" | "6-12M" | "12M+"
        }
      ],
      "keyTakeaway": "One sentence conditional: if X holds, expect Y for Z asset class"
    }
  },
  "globalBriefing": "3 sentence top-level synthesis. Cross-desk connections. Data-first. No drama.",
  "marketOpen": "One sentence: primary risk or catalyst to watch at market open today."
}`;

async function synthesizeWithAI(allCategoryData, previous) {
  const prompt = buildPrompt(allCategoryData, previous);

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
          max_tokens: 20000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`  ❌ HTTP ${response.status} (attempt ${attempt}): ${errBody.substring(0, 500)}`);
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const result = await response.json();

      if (result.error) {
        console.error(`  API error (attempt ${attempt}):`, JSON.stringify(result.error));
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const textBlock = (result.content || [])
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("");

      if (!textBlock) {
        console.error(`  Empty response (attempt ${attempt}). Full result: ${JSON.stringify(result).substring(0, 500)}`);
        continue;
      }

      if (result.stop_reason && result.stop_reason !== "end_turn") {
        console.warn(`  ⚠ Response truncated (stop_reason: ${result.stop_reason}, ${textBlock.length} chars received), retrying...`);
        continue;
      }

      let clean = textBlock.replace(/```json|```/g, "").trim();
      // Guard against any stray preamble/trailing text around the JSON object
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace > 0 || lastBrace < clean.length - 1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }

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

function buildPrompt(allCategoryData, previous) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  let prompt = `Today is ${today}. Below are raw RSS headlines from the last 48 hours, grouped by intelligence desk. Each desk is independent — do not move items between desks.\n\n`;

  if (previous) {
    prompt += `=== PREVIOUS BRIEFING (${previous.date || "prior session"}) — for continuity only ===\n`;
    if (previous.riskIndex != null) prompt += `Risk index: ${previous.riskIndex}\n`;
    if (previous.marketRegime?.tone) prompt += `Market regime: ${previous.marketRegime.tone}\n`;
    if (previous.regionSignals) {
      prompt += `Region signals: europe=${previous.regionSignals.europe}, spain=${previous.regionSignals.spain}, privateMarkets=${previous.regionSignals.privateMarkets}\n`;
    }
    if (Array.isArray(previous.houseView) && previous.houseView.length) {
      prompt += `House view:\n`;
      for (const v of previous.houseView) prompt += `  - ${v.label}: ${v.view}\n`;
    }
    prompt += `Anchor today's executive layer to these values. Change them only where today's headlines justify it, and say so in the "change" fields.\n\n`;
  } else {
    prompt += `=== NO PREVIOUS BRIEFING AVAILABLE — establish the initial house levels ===\n\n`;
  }

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

  prompt += `Desk ids to return, exactly: ${Object.keys(FEEDS).join(", ")}.\n`;

  return prompt;
}

function readPreviousBriefing() {
  try {
    const raw = fs.readFileSync("data.json", "utf8");
    const parsed = JSON.parse(raw);
    console.log(`  ↩ Previous briefing loaded (${parsed.date || "undated"}, risk index ${parsed.riskIndex ?? "n/a"}).`);
    return parsed;
  } catch (err) {
    console.warn(`  ⚠ No usable previous briefing (${err.message}).`);
    return null;
  }
}

function buildFallbackBriefing(allRaw) {
  console.warn("  ⚠ Using fallback (non-AI) briefing from raw headlines.");
  const categories = {};
  for (const [catId, items] of Object.entries(allRaw)) {
    categories[catId] = {
      items: items.slice(0, 3).map(item => ({
        headline: item.title,
        summary: item.summary || "",
        source: item.source,
        relevance: "",
        signal: "neutral",
        link: item.link
      })),
      keyTakeaway: ""
    };
  }
  return {
    categories,
    globalBriefing: "AI synthesis was unavailable today — this is an unedited headline digest from ZRC's intelligence feeds.",
    marketOpen: "",
    degraded: true
  };
}

// ─── DERIVED INTELLIGENCE ─────────────────────────────────────────────────
// Every executive-layer field has a deterministic fallback computed from the
// desk items, so data.json is complete even when the model omits a block.

function normalizeItems(aiCat) {
  const items = Array.isArray(aiCat?.items) ? aiCat.items : [];
  return items
    .filter(item => item && item.headline)
    .map(item => {
      const signal = normalizeSignal(item.signal);
      const impact = normalizeImpact(item.impact, signal);
      return {
        headline: String(item.headline).trim(),
        summary: String(item.summary || "").trim(),
        source: String(item.source || "").trim(),
        relevance: String(item.relevance || "").trim(),
        signal,
        impact,
        conviction: normalizeConviction(item.conviction, impact),
        horizon: normalizeHorizon(item.horizon),
        ...(item.link ? { link: item.link } : {})
      };
    });
}

function flattenItems(categories) {
  return Object.entries(categories).flatMap(([catId, cat]) =>
    (cat.items || []).map(item => Object.assign({ categoryId: catId, categoryLabel: cat.label }, item))
  );
}

function deriveRiskIndex(allItems, previousRisk) {
  if (!allItems.length) return previousRisk != null ? previousRisk : 50;

  let weighted = 0;
  let mass = 0;
  for (const item of allItems) {
    weighted += (SIGNAL_RISK_WEIGHT[item.signal] || 0) * item.impact;
    mass += item.impact;
  }

  const normalized = mass > 0 ? weighted / mass : 0;
  const raw = clamp(Math.round(50 + 35 * normalized), 5, 95);

  // Smooth against the previous session so the index reads as a level, not noise.
  if (previousRisk == null) return raw;
  return clamp(Math.round(previousRisk + clamp(raw - previousRisk, -12, 12)), 5, 95);
}

function deriveRegimeTone(allItems) {
  if (!allItems.length) return "BALANCED";
  const score = allItems.reduce((sum, i) => sum + (SIGNAL_DIRECTION[i.signal] || 0) * i.impact, 0);
  const mass = allItems.reduce((sum, i) => sum + i.impact, 0) || 1;
  const normalized = score / mass;
  if (normalized >= 0.15) return "CONSTRUCTIVE";
  if (normalized <= -0.15) return "CAUTIOUS";
  return "BALANCED";
}

const CONVICTION_RANK = { high: 3, medium: 2, low: 1 };

function rankItems(allItems) {
  return allItems.slice().sort((a, b) =>
    (b.impact - a.impact) ||
    ((CONVICTION_RANK[b.conviction] || 0) - (CONVICTION_RANK[a.conviction] || 0)) ||
    (Math.abs(SIGNAL_DIRECTION[b.signal] || 0) - Math.abs(SIGNAL_DIRECTION[a.signal] || 0))
  );
}

function derivePulse(aiPulse, allItems) {
  const fromAI = (Array.isArray(aiPulse) ? aiPulse : [])
    .filter(p => p && p.title && p.text)
    .slice(0, 3)
    .map(p => ({
      title: String(p.title).trim(),
      text: String(p.text).trim(),
      signal: normalizeSignal(p.signal)
    }));

  if (fromAI.length === 3) return fromAI;

  // Top up from the highest-impact desk items, skipping themes already covered.
  const used = new Set(fromAI.map(p => p.title.toLowerCase()));
  for (const item of rankItems(allItems)) {
    if (fromAI.length >= 3) break;
    const title = item.categoryLabel || "Key signal";
    if (used.has(title.toLowerCase())) continue;
    used.add(title.toLowerCase());
    fromAI.push({
      title,
      text: item.relevance || item.summary || item.headline,
      signal: item.signal
    });
  }

  return fromAI;
}

function deriveRadar(aiRadar, categories) {
  const fromAI = (Array.isArray(aiRadar) ? aiRadar : [])
    .filter(r => r && r.theme)
    .slice(0, 6)
    .map(r => ({
      theme: String(r.theme).trim(),
      direction: ["up", "down", "flat"].includes(String(r.direction).toLowerCase())
        ? String(r.direction).toLowerCase()
        : "flat",
      conviction: pick(r.conviction, ["HIGH", "MEDIUM", "SELECTIVE"], "SELECTIVE"),
      relevance: clamp(Math.round(Number(r.relevance)) || 3, 1, 5)
    }));

  if (fromAI.length >= 4) return fromAI;

  // Short of four themes → top up from the desks, ranked by conviction-weighted impact.
  const derived = Object.values(categories)
    .filter(cat => (cat.items || []).length)
    .map(cat => {
      const items = cat.items;
      const score = items.reduce((s, i) => s + (SIGNAL_DIRECTION[i.signal] || 0) * i.impact, 0);
      const mass = items.reduce((s, i) => s + i.impact, 0);
      const avgImpact = mass / items.length;
      const highConviction = items.filter(i => i.conviction === "high").length;

      return {
        theme: cat.label,
        direction: score > 0 ? "up" : score < 0 ? "down" : "flat",
        conviction: highConviction >= 2 || mass >= 10 ? "HIGH" : mass >= 6 ? "MEDIUM" : "SELECTIVE",
        relevance: clamp(Math.round(avgImpact), 1, 5),
        _rank: Math.abs(score)
      };
    })
    .sort((a, b) => b._rank - a._rank)
    .map(({ _rank, ...row }) => row);

  const seen = new Set(fromAI.map(r => r.theme.toLowerCase()));
  for (const row of derived) {
    if (fromAI.length >= 6) break;
    if (seen.has(row.theme.toLowerCase())) continue;
    seen.add(row.theme.toLowerCase());
    fromAI.push(row);
  }

  return fromAI;
}

// Compare today's stance against yesterday's on the rank axis. Never inferred
// from the model's wording — only from the two view values.
function viewDirection(view, previousView) {
  if (!previousView) return "new";
  const now = VIEW_RANK[view];
  const before = VIEW_RANK[previousView];
  if (!now || !before) return "unchanged";
  if (now > before) return "upgraded";
  if (now < before) return "downgraded";
  return "unchanged";
}

function deriveHouseView(aiHouseView, previousHouseView, regimeTone) {
  const byLabel = new Map(
    (Array.isArray(aiHouseView) ? aiHouseView : [])
      .filter(v => v && v.label)
      .map(v => [String(v.label).trim().toLowerCase(), v])
  );
  const prevByLabel = new Map(
    (Array.isArray(previousHouseView) ? previousHouseView : [])
      .filter(v => v && v.label)
      .map(v => [String(v.label).trim().toLowerCase(), v])
  );

  return HOUSE_VIEW_THEMES.map(label => {
    const key = label.toLowerCase();
    const ai = byLabel.get(key);
    const prev = prevByLabel.get(key);
    const previousView = prev ? pick(prev.view, HOUSE_VIEWS, null) : null;

    if (ai) {
      // An unrecognised view (the model reaching for a signal word like "watch")
      // holds yesterday's stance rather than silently resetting the book to NEUTRAL.
      const view = pick(ai.view, HOUSE_VIEWS, previousView || "NEUTRAL");
      return {
        label,
        view,
        previousView,
        direction: viewDirection(view, previousView),
        signal: normalizeSignal(ai.signal),
        change: String(ai.change || "").trim() || "No new evidence in today's intelligence."
      };
    }

    // Model skipped this theme → carry yesterday's stance forward, flagged as carried.
    if (prev) {
      const view = previousView || "NEUTRAL";
      return {
        label,
        view,
        previousView,
        direction: "unchanged",
        signal: normalizeSignal(prev.signal),
        change: "Carried forward — no new evidence in today's intelligence."
      };
    }

    return {
      label,
      view: regimeTone === "CONSTRUCTIVE" ? "SELECTIVE" : regimeTone === "CAUTIOUS" ? "CAUTIOUS" : "NEUTRAL",
      previousView: null,
      direction: "new",
      signal: "neutral",
      change: "Initial house level — no prior briefing to compare against."
    };
  });
}

function deriveCatalysts(aiCatalysts) {
  return (Array.isArray(aiCatalysts) ? aiCatalysts : [])
    .filter(c => c && c.title)
    .slice(0, 6)
    .map(c => ({
      time: String(c.time || c.date || "TBC").trim().toUpperCase(),
      title: String(c.title).trim(),
      impact: pick(c.impact, IMPACT_LEVELS, "MEDIUM")
    }));
}

function deriveRegionSignals(aiRegionSignals, categories, regimeTone) {
  const ai = aiRegionSignals || {};

  // Fallback: read Europe/Spain off the desks that actually carry regional content.
  const europeItems = flattenItems(categories).filter(i =>
    /europe|euro|ecb|eu |spain|spanish|madrid|germany|france|italy/i.test(
      `${i.headline} ${i.summary} ${i.relevance}`
    )
  );
  const europeTone = europeItems.length ? deriveRegimeTone(europeItems) : regimeTone;
  const toneToRegion = { CONSTRUCTIVE: "CONSTRUCTIVE", BALANCED: "NEUTRAL", CAUTIOUS: "CAUTIOUS" };

  const privateItems = [
    ...(categories["ma-growth"]?.items || []),
    ...(categories["fdi"]?.items || []),
    ...(categories["real-estate"]?.items || [])
  ];
  const privateTone = privateItems.length ? deriveRegimeTone(privateItems) : regimeTone;
  const toneToPrivate = { CONSTRUCTIVE: "ATTRACTIVE", BALANCED: "SELECTIVE", CAUTIOUS: "TIGHT" };

  return {
    europe: pick(ai.europe, REGION_VIEWS, toneToRegion[europeTone]),
    spain: pick(ai.spain, REGION_VIEWS, toneToRegion[europeTone]),
    privateMarkets: pick(ai.privateMarkets, PRIVATE_MARKET_VIEWS, toneToPrivate[privateTone])
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("📡 ZRC Morning Intelligence v4 — generating daily briefing\n");
  console.log("Phase 0: Reading previous briefing for continuity...\n");

  const previous = readPreviousBriefing();

  console.log("\nPhase 1: Fetching RSS feeds...\n");

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
  let aiResult = await synthesizeWithAI(allRaw, previous);

  if (!aiResult) {
    aiResult = buildFallbackBriefing(allRaw);
  }

  console.log("\nPhase 3: Assembling executive intelligence layer...\n");

  // Desks first — the executive layer is derived from them.
  const categories = {};
  for (const catId of Object.keys(FEEDS)) {
    const config = FEEDS[catId];
    const aiCat = aiResult?.categories?.[catId];

    categories[catId] = {
      label: config.label,
      icon: config.icon,
      description: config.description,
      items: normalizeItems(aiCat),
      keyTakeaway: aiCat?.keyTakeaway || "No significant signals detected.",
      rawCount: allRaw[catId].length
    };
  }

  const allItems = flattenItems(categories);
  const previousRisk = Number.isFinite(Number(previous?.riskIndex)) ? Number(previous.riskIndex) : null;

  const aiRisk = Math.round(Number(aiResult?.riskIndex));
  const riskIndex = Number.isFinite(aiRisk) && aiRisk >= 0 && aiRisk <= 100
    ? clamp(aiRisk, 0, 100)
    : deriveRiskIndex(allItems, previousRisk);

  const regimeTone = pick(aiResult?.marketRegime?.tone, REGIME_TONES, deriveRegimeTone(allItems));
  const regionSignals = deriveRegionSignals(aiResult?.regionSignals, categories, regimeTone);

  const briefing = {
    schemaVersion: SCHEMA_VERSION,
    generated: new Date().toISOString(),
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }),

    // ── Executive layer ──
    riskIndex,
    riskIndexPrev: previousRisk,
    marketRegime: {
      tone: regimeTone,
      rationale: String(aiResult?.marketRegime?.rationale || "").trim(),
      riskIndex,
      europe: regionSignals.europe,
      spain: regionSignals.spain,
      privateMarkets: regionSignals.privateMarkets
    },
    regionSignals,
    executivePulse: derivePulse(aiResult?.executivePulse, allItems),
    opportunityRadar: deriveRadar(aiResult?.opportunityRadar, categories),
    houseView: deriveHouseView(aiResult?.houseView, previous?.houseView, regimeTone),
    catalysts: deriveCatalysts(aiResult?.catalysts),

    // ── Synthesis ──
    globalBriefing: aiResult?.globalBriefing || "",
    marketOpen: aiResult?.marketOpen || "",

    // ── Desks ──
    categories
  };

  if (aiResult?.degraded) briefing.degraded = true;

  fs.writeFileSync("data.json", JSON.stringify(briefing, null, 2));

  const aiItems = allItems.length;
  const classified = allItems.filter(i => i.impact && i.conviction && i.horizon).length;

  console.log(`✅ Done. ${aiItems} curated items from ${totalItems} raw headlines.`);
  console.log(`   Regime ${regimeTone} · risk index ${riskIndex}${previousRisk != null ? ` (prev ${previousRisk})` : ""}`);
  console.log(`   ${briefing.executivePulse.length} pulse · ${briefing.opportunityRadar.length} radar themes · ${briefing.houseView.length} house views · ${briefing.catalysts.length} catalysts`);
  console.log(`   ${classified}/${aiItems} items fully classified (impact · conviction · horizon)`);
  console.log("📄 data.json written.\n");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
