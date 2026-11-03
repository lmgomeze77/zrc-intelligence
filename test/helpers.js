const { DESKS, THEMES } = require('../lib/briefing-contract');
function fixture(now = new Date('2026-11-03T08:00:00Z')) {
  const raw = Object.fromEntries(DESKS.map(desk => [desk, [{ id: `${desk}-1`, title: `Reported development in ${desk}`, summary: 'Official event on 4 November 2026 at 10:00 CET.', source: 'Wire', date: now.toISOString(), link: `https://wire.example/${desk}` }]]));
  return { raw, value: synthesis(raw) };
}
function synthesis(raw) {
  const ids = DESKS.map(d => raw[d]?.[0]?.id).filter(Boolean);
  return {
    riskIndex: 54, marketRegime: { tone: 'BALANCED', rationale: 'Mixed sourced signals.' },
    regionSignals: { europe: 'MIXED', spain: 'NEUTRAL', privateMarkets: 'SELECTIVE' },
    executivePulse: ids.slice(0, 3).map(id => ({ title: 'Signal', text: 'A sourced interpretation.', signal: 'watch', sourceIds: [id] })),
    opportunityRadar: [],
    houseView: THEMES.map(label => ({ label, view: 'NEUTRAL', signal: 'neutral', change: 'No new evidence.', sourceIds: [] })),
    catalysts: [],
    categories: Object.fromEntries(DESKS.map(desk => [desk, { items: (raw[desk] || []).slice(0, 1).map(s => ({ headline: s.title, summary: 'According to the source, the development was reported.', relevance: 'ZRC interpretation: monitor execution risk.', scenario: '', sourceIds: [s.id], signal: 'watch', impact: 3, conviction: 'medium', horizon: '1-3M' })), keyTakeaway: 'If confirmed, monitor financing conditions.' }])),
    globalBriefing: 'Sourced reports show mixed conditions.', marketOpen: 'Watch confirmed developments.'
  };
}
function published(now = new Date('2026-11-03T08:00:00Z')) {
  const { value } = fixture(now);
  return { ...value, provider: 'openai', model: 'gpt-6-astra', schemaVersion: 3, generated: now.toISOString(), date: 'Tuesday, 3 November 2026', categories: Object.fromEntries(Object.entries(value.categories).map(([id, cat]) => [id, { ...cat, items: cat.items.map(x => ({ ...x, source: 'Wire', link: `https://wire.example/${id}`, sources: [{ title: x.headline, source: 'Wire', link: `https://wire.example/${id}`, publishedAt: now.toISOString() }] })) }])) };
}
module.exports = { fixture, synthesis, published };
