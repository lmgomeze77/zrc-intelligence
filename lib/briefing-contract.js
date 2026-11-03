const { createHash } = require('node:crypto');
const ZONE = 'Europe/Madrid';
const DESKS = ['macro', 'geopolitics', 'fdi', 'critical-minerals', 'real-estate', 'ma-growth', 'emerging-markets', 'trade-policy', 'food-agriculture'];
const SIGNALS = ['bullish', 'bearish', 'neutral', 'watch'];
const VIEWS = ['CONSTRUCTIVE', 'SELECTIVE', 'NEUTRAL', 'CAUTIOUS', 'DEFENSIVE'];
const THEMES = ['Spain & Madrid Real Estate', 'European Credit & Financing', 'Private Capital Deployment', 'Energy & Commodities', 'Emerging Markets', 'Global Risk Appetite'];
const str = { type: 'string' };
const enumeration = values => ({ type: 'string', enum: values });
const array = (items, minItems = 0, maxItems = 6) => ({ type: 'array', items, minItems, maxItems });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const refs = (min = 1) => array(str, min, 6);
const signal = enumeration(SIGNALS);
const impact = { type: 'integer', minimum: 1, maximum: 5 };
const sensitivity = enumeration(['HIGH', 'MEDIUM', 'LOW']);
const item = object({ headline: str, summary: str, relevance: str, scenario: str, sourceIds: refs(), signal, impact, conviction: enumeration(['low', 'medium', 'high']), horizon: enumeration(['0-1M', '1-3M', '3-6M', '6-12M', '12M+']) });
const schema = object({
  riskIndex: { type: 'integer', minimum: 0, maximum: 100 },
  marketRegime: object({ tone: enumeration(['CONSTRUCTIVE', 'BALANCED', 'CAUTIOUS']), rationale: str }),
  regionSignals: object({ europe: enumeration(['POSITIVE', 'CONSTRUCTIVE', 'NEUTRAL', 'MIXED', 'CAUTIOUS', 'NEGATIVE']), spain: enumeration(['POSITIVE', 'CONSTRUCTIVE', 'NEUTRAL', 'MIXED', 'CAUTIOUS', 'NEGATIVE']), privateMarkets: enumeration(['ATTRACTIVE', 'SELECTIVE', 'NEUTRAL', 'TIGHT', 'CHALLENGING']) }),
  executivePulse: array(object({ title: str, text: str, signal, sourceIds: refs() }), 3, 3),
  opportunityRadar: array(object({ theme: str, direction: enumeration(['up', 'down', 'flat']), conviction: enumeration(['HIGH', 'MEDIUM', 'SELECTIVE']), relevance: impact, sourceIds: refs() }), 0, 6),
  houseView: array(object({ label: enumeration(THEMES), view: enumeration(VIEWS), signal, change: str, sourceIds: refs(0) }), 6, 6),
  catalysts: array(object({ startAt: str, title: str, impact: sensitivity, sourceIds: refs(), dateEvidence: str }), 0, 6),
  categories: object(Object.fromEntries(DESKS.map(id => [id, object({ items: array(item, 0, 3), keyTakeaway: str })]))),
  globalBriefing: str, marketOpen: str
});

function assertSchema(value, spec = schema, path = '$') {
  if (spec.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected object`);
    for (const key of spec.required) if (!(key in value)) throw new Error(`${path}.${key}: missing`);
    for (const [key, val] of Object.entries(value)) {
      if (!spec.properties[key]) throw new Error(`${path}.${key}: unexpected field`);
      assertSchema(val, spec.properties[key], `${path}.${key}`);
    }
  } else if (spec.type === 'array') {
    if (!Array.isArray(value) || value.length < spec.minItems || value.length > spec.maxItems) throw new Error(`${path}: invalid array length`);
    value.forEach((x, i) => assertSchema(x, spec.items, `${path}[${i}]`));
  } else if (spec.type === 'integer') {
    if (!Number.isInteger(value) || value < spec.minimum || value > spec.maximum) throw new Error(`${path}: invalid integer`);
  } else if (typeof value !== 'string' || (spec.enum && !spec.enum.includes(value))) throw new Error(`${path}: invalid string`);
}
function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}
function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function sourceId(desk, value) { return `${desk}-${createHash('sha256').update(value).digest('hex').slice(0, 12)}`; }
function catalogSources(raw) {
  return Object.fromEntries(Object.entries(raw).flatMap(([desk, items]) => items.map(x => [x.id, { ...x, desk }])));
}
function evidenceSupportsDate(excerpt, startAt) {
  // Conservative formats only: exact ISO timestamp, or explicit English date,
  // clock time and CET/CEST/UTC. Never infer a date/time from an event name.
  if (excerpt.includes(startAt)) return true;
  const match = excerpt.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b[\s\S]{0,40}?\b(\d{1,2}):(\d{2})\s*(CET|CEST|UTC|GMT)\b/i);
  if (!match) return false;
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month = String(months.indexOf(match[2].toLowerCase()) + 1).padStart(2, '0');
  const zone = { CET: '+01:00', CEST: '+02:00', UTC: 'Z', GMT: 'Z' }[match[6].toUpperCase()];
  const expected = `${match[3]}-${month}-${match[1].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5]}:00${zone}`;
  return Date.parse(expected) === Date.parse(startAt);
}
function validateSynthesis(value, raw, now = new Date(), previous = null) {
  assertSchema(value);
  const catalog = catalogSources(raw);
  const curated = new Set();
  for (const [desk, cat] of Object.entries(value.categories)) {
    for (const row of cat.items) {
      if (!row.headline.trim() || !row.summary.trim()) throw new Error(`Empty item in ${desk}`);
      for (const id of row.sourceIds) {
        if (!catalog[id] || catalog[id].desk !== desk) throw new Error(`Unknown or cross-desk source ${id}`);
        curated.add(id);
      }
      const sources = row.sourceIds.map(id => catalog[id]);
      const corroborated = new Set(sources.map(s => { try { return new URL(s.link).hostname; } catch { return ''; } })).size >= 2;
      const primary = sources.some(s => /(^|\.)(ecb\.europa\.eu|federalreserve\.gov)$/.test(new URL(s.link).hostname));
      if (row.conviction === 'high' && !corroborated && !primary) row.conviction = 'medium';
    }
    if (raw[desk]?.length && !cat.items.length) throw new Error(`Missing coverage for populated desk ${desk}`);
  }
  if (curated.size < 3) throw new Error('Insufficient sourced desk coverage');
  for (const row of [...value.executivePulse, ...value.opportunityRadar, ...value.houseView]) {
    if (row.sourceIds.some(id => !curated.has(id))) throw new Error('Executive claim is not supported by a curated desk item');
  }
  if (new Set(value.houseView.map(x => x.label)).size !== THEMES.length) throw new Error('House view themes are missing or duplicated');
  for (const row of value.houseView) {
    if (!row.sourceIds.length) {
      row.view = previous?.houseView?.find(x => x.label === row.label)?.view || 'NEUTRAL';
      row.signal = 'neutral';
      row.change = 'Carried forward — no new sourced evidence.';
    }
  }
  // Calendar dates must be quoted verbatim from input evidence, not recalled.
  value.catalysts = value.catalysts.filter(row => {
    const ts = Date.parse(row.startAt);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(row.startAt)
      && Number.isFinite(ts) && ts >= +now && ts <= +now + 72 * 3600000
      && row.sourceIds.every(id => catalog[id]) && row.dateEvidence.length >= 10
      && evidenceSupportsDate(row.dateEvidence, row.startAt)
      && row.sourceIds.some(id => `${catalog[id].title} ${catalog[id].summary}`.includes(row.dateEvidence));
  });
  return value;
}
function formatCatalyst(row) {
  return { ...row, time: new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(row.startAt)).toUpperCase() };
}
function validatePublished(briefing, { now = new Date(), requireToday = true, requireOpenAI = false } = {}) {
  if (!briefing || briefing.degraded || !Number.isFinite(Date.parse(briefing.generated))) throw new Error('Invalid or degraded briefing');
  if (Date.parse(briefing.generated) > +now + 300000) throw new Error('Briefing timestamp is in the future');
  if (requireToday && dayKey(briefing.generated) !== dayKey(now)) throw new Error('Published briefing is stale for Europe/Madrid');
  if (requireOpenAI && briefing.provider !== 'openai') throw new Error('Generate a validated OpenAI edition before delivery');
  const cats = Object.values(briefing.categories || {});
  if (!cats.some(x => Array.isArray(x.items) && x.items.length)) throw new Error('Briefing contains no items');
  if (briefing.provider === 'openai') {
    for (const desk of DESKS) if (!briefing.categories[desk]) throw new Error(`Missing desk ${desk}`);
    for (const row of cats.flatMap(x => x.items || [])) {
      if (!row.sources?.length || row.sources.some(x => !safeUrl(x.link))) throw new Error('Briefing item lacks valid source URLs');
    }
  }
  return briefing;
}
module.exports = { schema, assertSchema, DESKS, THEMES, ZONE, dayKey, safeUrl, sourceId, catalogSources, validateSynthesis, formatCatalyst, validatePublished, evidenceSupportsDate };
