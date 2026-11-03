const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deliver, deliveryKey } = require('../lib/delivery');
const { published } = require('./helpers');
const now = new Date('2026-11-03T08:00:00Z');
const briefing = published(now);
const env = { RESEND_API_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test-hmac-secret' };
const subscribers = [{ email: 'one@example.org', name: 'One', unsubscribe_token: 'a' }, { email: 'two@example.org', name: 'Two', unsubscribe_token: 'b' }];
const base = { briefing, env, subscribers, buildSubject: () => 'Subject', buildEmailHTML: () => '<p>Body</p>', now };
test('partial delivery fails visibly; retry skips accepted recipients and reuses the failed request key', async () => {
  const ledger = { version: 1, editions: {} }; const first = []; const checkpoints = [];
  await assert.rejects(deliver({ ...base, ledger, checkpoint: x => checkpoints.push(structuredClone(x)), fetchImpl: async (url, request) => {
    first.push(request.headers['Idempotency-Key']);
    const fail = JSON.parse(request.body).to.startsWith('two');
    return { ok: !fail, status: fail ? 503 : 200, json: async () => fail ? {} : { id: 'msg1' } };
  } }), /1 failed, 1 accepted/);
  const retried = [];
  const result = await deliver({ ...base, ledger, fetchImpl: async (url, request) => {
    retried.push(request.headers['Idempotency-Key']); return { ok: true, json: async () => ({ id: 'msg2' }) };
  } });
  assert.deepEqual(result, { accepted: 1, skipped: 1, failed: 0, total: 2 });
  assert.deepEqual(retried, [first[1]]);
  assert.ok(checkpoints.length >= 1);
  assert.ok(!JSON.stringify(ledger).includes('@example.org'));
});
test('crash retry with no saved ledger has identical provider idempotency key; duplicate addresses collapse', async () => {
  const keys = [];
  for (let i = 0; i < 2; i++) await deliver({ ...base, subscribers: [subscribers[0], subscribers[0]], ledger: { version: 1, editions: {} }, fetchImpl: async (url, req) => { keys.push(req.headers['Idempotency-Key']); return { ok: true, json: async () => ({ id: 'same-message' }) }; } });
  assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});
test('changed edition contents, stale editions, expired retry window and missing credentials refuse network sends', async () => {
  const noNetwork = () => { throw new Error('network must not run'); };
  const ledger = { version: 1, editions: {} };
  await deliver({ ...base, subscribers: [], ledger, fetchImpl: noNetwork });
  await assert.rejects(deliver({ ...base, briefing: { ...briefing, globalBriefing: 'Changed' }, ledger, fetchImpl: noNetwork }), /changed/);
  await assert.rejects(deliver({ ...base, now: new Date('2026-11-04T08:00:00Z'), ledger, fetchImpl: noNetwork }), /stale/);
  const midnight = published(new Date('2026-11-02T23:00:00Z'));
  await assert.rejects(deliver({ ...base, briefing: midnight, now: new Date('2026-11-03T22:01:00Z'), ledger, fetchImpl: noNetwork }), /retry window/);
  await assert.rejects(deliver({ ...base, env: {}, ledger, fetchImpl: noNetwork }), /RESEND/);
});
test('test and production sends have different private recipient identities', () => {
  assert.notEqual(deliveryKey(briefing, 'one@example.org', 'secret'), deliveryKey(briefing, 'one@example.org', 'secret', 'test'));
  assert.equal(deliveryKey(briefing, 'One@example.org', 'secret'), deliveryKey(briefing, 'one@example.org', 'secret'));
});
