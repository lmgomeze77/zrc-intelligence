// Rebuild the daily market-risk record from actually published briefing commits.
// Never interpolate missing days or include degraded synthesis outputs.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const path = 'risk-index-history.json';
const current = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const old = JSON.parse(fs.readFileSync(path, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const entries = new Map((old.series || []).filter(p => p.source === 'published').map(p => [p.date, p]));
const commits = execFileSync('git', ['log', '--format=%H', '--', 'data.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

function accept(briefing) {
  const date = String(briefing.generated || '').slice(0, 10);
  if (briefing.degraded || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today ||
      !Number.isInteger(briefing.riskIndex) || briefing.riskIndex < 0 || briefing.riskIndex > 100) return;
  entries.set(date, { date, riskIndex: briefing.riskIndex, tone: briefing.marketRegime?.tone || null, source: 'published' });
}

// Oldest first: a later published revision wins for the same calendar day.
for (const sha of commits.reverse()) {
  try { accept(JSON.parse(execFileSync('git', ['show', sha + ':data.json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }))); }
  catch (error) { console.warn('Skipping unreadable briefing commit', sha, error.message); }
}
accept(current);
const series = [...entries.values()].sort((a, b) => a.date.localeCompare(b.date));
fs.writeFileSync(path, JSON.stringify({
  note: 'Published ZRC Morning Intelligence market-risk readings only. Missing dates are gaps, not interpolated values. Distinct from the weekly ZRC geopolitical index.',
  coverage: { from: series[0]?.date || null, to: series.at(-1)?.date || null, published: series.length },
  series,
}, null, 2) + '\n');
console.log('Verified published daily readings:', series.length, 'last:', series.at(-1)?.date || 'none');
