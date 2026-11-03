const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, published } = require('./helpers');
const { assertSchema, validateSynthesis, validatePublished, formatCatalyst, dayKey } = require('../lib/briefing-contract');
const now = new Date('2026-11-03T08:00:00Z');
test('strict output contract rejects missing fields, wrong enums and extra properties', () => {
  const { value } = fixture(); assertSchema(value);
  const bad = structuredClone(value); delete bad.categories.macro; assert.throws(() => assertSchema(bad), /missing/);
  const extra = structuredClone(value); extra.hallucinated = 1; assert.throws(() => assertSchema(extra), /unexpected/);
  value.categories.macro.items[0].signal = 'strong'; assert.throws(() => assertSchema(value), /invalid/);
});
test('reject unknown/cross-desk sources and unsupported executive references', () => {
  for (const mutate of [
    value => value.categories.macro.items[0].sourceIds = ['geopolitics-1'],
    value => value.executivePulse[0].sourceIds = ['invented']
  ]) { const { raw, value } = fixture(); mutate(value); assert.throws(() => validateSynthesis(value, raw, now), /source|supported/); }
});
test('calendar discards unsupported, past and out-of-window dates; labels derive from actual date', () => {
  const { raw, value } = fixture();
  const event = { title: 'Official event', startAt: '2026-11-04T09:00:00Z', impact: 'MEDIUM', sourceIds: ['macro-1'], dateEvidence: raw.macro[0].summary };
  value.catalysts = [event, { ...event, dateEvidence: 'Invented calendar quotation' }, { ...event, startAt: '2026-11-01T09:00:00Z' }, { ...event, startAt: '2026-11-09T09:00:00Z' }, { ...event, startAt: '2026-11-04T10:00:00Z' }];
  const result = validateSynthesis(value, raw, now);
  assert.equal(result.catalysts.length, 1);
  assert.match(formatCatalyst(result.catalysts[0]).time, /^WED/);
  assert.match(formatCatalyst(result.catalysts[0]).time, /10:00/);
});
test('Madrid business day and DST do not use runner UTC date', () => {
  assert.equal(dayKey('2026-11-02T23:30:00Z'), '2026-11-03');
  assert.equal(dayKey('2026-07-02T22:30:00Z'), '2026-07-03');
  assert.match(formatCatalyst({ startAt: '2026-07-03T08:00:00Z' }).time, /10:00/);
});
test('unsupported house stances carry forward and single-feed confidence is capped', () => {
  const { raw, value } = fixture(); value.categories.macro.items[0].conviction = 'high'; value.houseView[0].view = 'CONSTRUCTIVE';
  const result = validateSynthesis(value, raw, now, { houseView: [{ label: value.houseView[0].label, view: 'CAUTIOUS' }] });
  assert.equal(result.categories.macro.items[0].conviction, 'medium'); assert.equal(result.houseView[0].view, 'CAUTIOUS');
});
test('stale, degraded, future-dated or unsourced publications are rejected before delivery', () => {
  const valid = published(now); validatePublished(valid, { now, requireOpenAI: true });
  for (const candidate of [ { ...valid, generated: '2026-11-02T08:00:00Z' }, { ...valid, degraded: true }, { ...valid, generated: '2026-11-04T08:00:00Z' }, { ...valid, provider: 'anthropic' } ]) assert.throws(() => validatePublished(candidate, { now, requireOpenAI: true }));
  valid.categories.macro.items[0].sources = []; assert.throws(() => validatePublished(valid, { now }), /source/);
});
