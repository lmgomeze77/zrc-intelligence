const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enrichEvidence } = require('../lib/research');
test('live verification retains only actual web citations and stays within three queries', async () => {
  const raw = { macro: Array.from({ length: 5 }, (_, i) => ({ id: `macro-${i}`, title: `Major merger for $${i + 1} billion`, summary: '', source: 'Feed', date: '2026-11-03T08:00:00Z', link: `https://feed.example/${i}` })) };
  let calls = 0;
  await enrichEvidence(raw, { env: { OPENAI_API_KEY: 'test' }, fetchImpl: async (url, req) => {
    calls++; assert.equal(JSON.parse(req.body).tools[0].type, 'web_search');
    return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Verified amount differs. According to the company, use the corrected amount.', annotations: [{ type: 'url_citation', url: 'https://company.example/announcement', title: 'Announcement' }, { type: 'url_citation', url: 'javascript:alert(1)' }] }] }] }) };
  } });
  assert.equal(calls, 3); assert.equal(raw.macro.length, 8);
  assert.equal(raw.macro[5].researchSources.length, 1);
  assert.match(raw.macro[5].summary, /corrected amount/);
});
test('uncited verification aborts instead of lending unsupported claims credibility', async () => {
  const raw = { macro: [{ id: 'm', title: 'Central bank rate cut', summary: '', link: 'https://example.org', date: '2026-11-03' }] };
  await assert.rejects(enrichEvidence(raw, { env: { OPENAI_API_KEY: 'test' }, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Uncited result' }] }] }) }) }), /no source citations/);
});
