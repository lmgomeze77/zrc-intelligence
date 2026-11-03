const { test } = require('node:test');
const assert = require('node:assert/strict');
const { respond } = require('../lib/openai');
const schema = { type: 'object', properties: { status: { type: 'string' } }, required: ['status'], additionalProperties: false };
const env = { OPENAI_API_KEY: 'test-only-key' };
const completed = value => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 10, output_tokens: 5 } });
test('Responses request uses bearer authentication, explicit reasoning and strict schema', async () => {
  const result = await respond({ env, instructions: 'test', input: 'test', schema, fetchImpl: async (url, req) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(req.body);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    assert.deepEqual(body.reasoning, { effort: 'low' });
    assert.equal(body.model, 'gpt-6-astra');
    assert.equal(req.headers.Authorization, 'Bearer test-only-key');
    return { ok: true, json: async () => completed({ status: 'ok' }) };
  } });
  assert.deepEqual(result.value, { status: 'ok' });
});
test('quota/authentication failures stop immediately and do not expose response bodies', async () => {
  let calls = 0;
  await assert.rejects(respond({ env, input: 'test', fetchImpl: async () => {
    calls++;
    return { ok: false, status: 429, json: async () => ({ error: { code: 'insufficient_quota', message: 'sensitive response text' } }) };
  } }), err => /insufficient_quota/.test(err.message) && !err.message.includes('sensitive'));
  assert.equal(calls, 1);
});
test('transient rate limits retry with bounded delays', async () => {
  let calls = 0; const delays = [];
  await respond({ env, input: 'test', sleep: async ms => delays.push(ms), fetchImpl: async () => {
    calls++;
    return calls === 1 ? { ok: false, status: 429, headers: { get: () => '120' }, json: async () => ({ error: { code: 'rate_limit_exceeded' } }) } : { ok: true, json: async () => completed({ status: 'ok' }) };
  } });
  assert.equal(calls, 2); assert.deepEqual(delays, [30000]);
});
test('missing key, incomplete generation, refusal and malformed JSON cannot be published', async () => {
  await assert.rejects(respond({ env: {}, fetchImpl: () => { throw new Error('must not call'); } }), /missing/);
  for (const result of [
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'invalid JSON' }] }] }
  ]) await assert.rejects(respond({ env, input: 'test', schema, fetchImpl: async () => ({ ok: true, json: async () => result }) }));
});
