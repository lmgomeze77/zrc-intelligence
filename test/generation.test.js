const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { main } = require('../generate-briefing');
const { synthesis, published } = require('./helpers');
const { validatePublished } = require('../lib/briefing-contract');
const root = path.resolve(__dirname, '..');
test('complete mocked feed-to-OpenAI pipeline produces a linked edition and preserves the previous one on failure', async () => {
  const cwd = process.cwd(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zrc-generation-'));
  const oldFetch = global.fetch; const oldKey = process.env.OPENAI_API_KEY;
  const now = new Date(); const baseline = JSON.stringify(published(new Date(+now - 86400000)));
  let broken = false; let requests = 0;
  try {
    process.chdir(dir); process.env.OPENAI_API_KEY = 'test-only'; fs.writeFileSync('data.json', baseline);
    global.fetch = async (url, req) => {
      if (url === 'https://api.openai.com/v1/responses') {
        requests++;
        if (broken) return { ok: false, status: 402, json: async () => ({ error: { code: 'insufficient_quota' } }) };
        const request = JSON.parse(req.body);
        const inputs = request.input.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
        const raw = {};
        for (const item of inputs) { const desk = item.id.slice(0, -13); (raw[desk] ||= []).push(item); }
        return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(synthesis(raw)) }] }] }) };
      }
      assert.ok(!String(url).includes('resend'), 'generation must not send email');
      return { ok: true, text: async () => `<rss version="2.0"><channel><title>Wire</title><item><title>Reported development for the daily desk</title><link>https://wire.example/report</link><description>Officially reported facts.</description><pubDate>${now.toUTCString()}</pubDate></item></channel></rss>` };
    };
    await main();
    const generated = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    validatePublished(generated, { requireOpenAI: true });
    assert.equal(generated.provider, 'openai'); assert.equal(generated.verifiedQueries, 0);
    assert.equal(Object.keys(generated.categories).length, 9);
    assert.equal(generated.categories.macro.items[0].sources[0].link, 'https://wire.example/report');
    assert.equal(requests, 1);
    const valid = fs.readFileSync('data.json', 'utf8'); broken = true;
    await assert.rejects(main(), /insufficient_quota/);
    assert.equal(fs.readFileSync('data.json', 'utf8'), valid, 'a provider failure must not replace the published edition');
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    process.chdir(cwd); fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('publication guard resumes delivery for a fresh edition and regenerates stale or legacy ones', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zrc-guard-')); const output = path.join(dir, 'output'); const file = path.join(dir, 'data.json');
  try {
    for (const [edition, expected] of [[published(new Date()), false], [published(new Date(Date.now() - 86400000)), true], [{ ...published(new Date()), provider: 'anthropic' }, true]]) {
      fs.writeFileSync(file, JSON.stringify(edition)); fs.writeFileSync(output, '');
      execFileSync(process.execPath, [path.join(root, 'scripts/pipeline.js'), 'guard', file], { env: { ...process.env, GITHUB_OUTPUT: output } });
      assert.equal(fs.readFileSync(output, 'utf8').trim(), `generate=${expected}`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
