# `data.json` — ZRC Morning Intelligence schema (v2)

Written every morning by `generate-briefing.js`, consumed by `index.html` (site) and
`send-digest.js` (email). Additive relative to v1: every v1 field is still present and
unchanged, so nothing downstream breaks.

The rule that governs this file: **the model proposes, the generator disposes.** Every
executive-layer field is validated against a closed vocabulary and, if the model omits it
or returns something out of range, recomputed deterministically from the desk items. The
file is therefore always complete — the front-end never has to guess or hide a section.

```jsonc
{
  "schemaVersion": 2,
  "generated": "2026-08-17T06:04:11.204Z",
  "date": "Monday, 17 August 2026",

  // ── EXECUTIVE LAYER (level 1) ────────────────────────────────────────────
  "riskIndex": 58,          // 0-100. 0-30 benign · 31-50 normal · 51-70 elevated · 71-100 stressed
  "riskIndexPrev": 44,      // yesterday's value, or null on the first run

  "marketRegime": {
    "tone": "CAUTIOUS",     // CONSTRUCTIVE | BALANCED | CAUTIOUS
    "rationale": "One sentence, data-first.",
    "riskIndex": 58,        // mirrors riskIndex — the front-end reads the regime block whole
    "europe": "MIXED",
    "spain": "CONSTRUCTIVE",
    "privateMarkets": "SELECTIVE"
  },

  "regionSignals": {
    "europe": "MIXED",         // POSITIVE | CONSTRUCTIVE | NEUTRAL | MIXED | CAUTIOUS | NEGATIVE
    "spain": "CONSTRUCTIVE",   // same vocabulary
    "privateMarkets": "SELECTIVE" // ATTRACTIVE | SELECTIVE | NEUTRAL | TIGHT | CHALLENGING
  },

  "executivePulse": [        // exactly 3, one per theme, deduplicated
    { "title": "Rates", "text": "≤240 chars of analysis.", "signal": "bullish" }
  ],

  "opportunityRadar": [      // 4-6 capital-allocation themes
    { "theme": "European bank credit", "direction": "up", // up | down | flat
      "conviction": "HIGH",  // HIGH | MEDIUM | SELECTIVE
      "relevance": 5 }       // 1-5, relevance to the ZRC mandate
  ],

  "houseView": [             // always these 6 labels, always in this order
    { "label": "Spain & Madrid Real Estate",
      "view": "CONSTRUCTIVE",  // CONSTRUCTIVE | SELECTIVE | NEUTRAL | CAUTIOUS | DEFENSIVE
      "previousView": "NEUTRAL", // yesterday's stance, or null
      "direction": "upgraded",   // upgraded | downgraded | unchanged | new — COMPUTED, see below
      "signal": "bullish",
      "change": "The evidence behind today's stance — rationale only, no verdict." }
  ],

  "catalysts": [             // 0-6 events in the next 72h; empty beats fabricated
    { "time": "TUE 11:00 CET", "title": "Eurozone CPI", "impact": "HIGH" } // HIGH | MEDIUM | LOW
  ],

  // ── SYNTHESIS ────────────────────────────────────────────────────────────
  "globalBriefing": "3-sentence cross-desk synthesis.",
  "marketOpen": "Primary risk or catalyst at the open.",

  // ── DESKS (level 2) ──────────────────────────────────────────────────────
  "categories": {
    "macro": {               // 9 desk ids, see FEEDS in generate-briefing.js
      "label": "Macro & Central Banks",
      "icon": "🏦",
      "description": "…",
      "rawCount": 8,         // headlines fetched before curation
      "keyTakeaway": "If X holds, expect Y for Z.",
      "items": [
        {
          "headline": "…", "summary": "…", "source": "…", "relevance": "…",
          "signal": "bullish",   // bullish | bearish | neutral | watch
          "impact": 4,           // 1 marginal … 5 cross-asset repricing
          "conviction": "high",  // low | medium | high — confidence in the read
          "horizon": "1-3M"      // 0-1M | 1-3M | 3-6M | 6-12M | 12M+
        }
      ]
    }
  },

  "degraded": true           // present only when AI synthesis failed and the file is a raw digest
}
```

## Continuity

`generate-briefing.js` reads the **previous** `data.json` before overwriting it and feeds
the prior risk index, regime, region signals and house view into the prompt. Two rules
follow from that:

- The risk index is a *level*, not a daily reading. The model is told to move it more than
  12 points only on an explicit quantified shock, and the derived fallback clamps the move
  to ±12 regardless.
- House view labels are fixed, so `change` is a real day-over-day statement. If the model
  skips a theme, yesterday's stance is carried forward and marked as carried.
- **`direction` is computed, never asserted.** The five stances sit on one axis
  (`DEFENSIVE < CAUTIOUS < NEUTRAL < SELECTIVE < CONSTRUCTIVE`) and the generator compares
  today's `view` against `previousView`. The model is explicitly told not to write the
  verdict into `change` — left to its own devices it produces things like "Upgraded to
  watch from CAUTIOUS" while leaving `view` on CAUTIOUS, or "Upgraded from CONSTRUCTIVE to
  CONSTRUCTIVE". A `view` outside the five-term vocabulary holds yesterday's stance rather
  than resetting the book to NEUTRAL.

Both front-ends colour a stance by the **stance**, never by `signal`: `signal` is a
directional read that can legitimately differ from the stance, and colouring by it made a
CAUTIOUS view render in neutral grey. Briefings written before `direction` existed show no
movement marker at all — inferring one from the prose would republish whatever the prose
got wrong.

This means the very first run after deploying reads as "initial house level" — that is
expected, and it resolves the following morning.

## Who reads what

`index.html` renders everything. `send-digest.js` deliberately renders a subset — the
email is a summary that points at the platform:

| Field | Email | Platform |
| --- | --- | --- |
| `marketRegime`, `riskIndex`, `regionSignals` | house-position strip | regime grid |
| `executivePulse` | all three, text capped at 230 chars | full |
| `globalBriefing`, `marketOpen` | full | full |
| `catalysts` | first 4 | first 6 |
| `houseView` | labels + stance only | stance **and** `change` rationale |
| `opportunityRadar` | — (named in the call to action) | full table |
| `categories[].items` | 2-3 per section, summaries capped at 200 chars | all, plus `relevance` |
| `impact`, `conviction`, `horizon` | — | badge on every signal |

Anything withheld is withheld on purpose. If you add a field, decide which side of that
line it belongs on before wiring it into the email.

## Adding a desk

Add it to `FEEDS` in `generate-briefing.js` **and** to `CATEGORY_ORDER` in `index.html`.
These two lists must stay in sync; a desk missing from `CATEGORY_ORDER` is generated,
costs tokens, and is never displayed.
