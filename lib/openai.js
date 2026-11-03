const DEFAULT_MODEL = 'gpt-6-astra';

async function respond({ instructions, input, schema, tools, maxOutputTokens = 20000, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), env = process.env }) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing. Add it to GitHub Actions secrets.');
  const model = env.OPENAI_MODEL || DEFAULT_MODEL;
  const body = {
    model, instructions, input, store: false,
    reasoning: { effort: env.OPENAI_REASONING_EFFORT || 'low' },
    max_output_tokens: maxOutputTokens,
    ...(schema ? { text: { format: { type: 'json_schema', name: 'zrc_briefing', strict: true, schema } } } : {}),
    ...(tools ? { tools } : {})
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(180000)
      });
    } catch (err) {
      if (attempt === 2) throw new Error(`OpenAI request failed: ${err.name || 'network error'}`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const result = await res.json();
    if (!res.ok) {
      const code = result.error?.code || result.error?.type || 'request_error';
      const permanent = ['insufficient_quota', 'billing_hard_limit_reached', 'invalid_api_key'].includes(code);
      if (!permanent && (res.status === 429 || res.status >= 500) && attempt < 2) {
        const retryAfter = Number(res.headers?.get('retry-after'));
        await sleep(Math.min(30000, Math.max(2000 * 2 ** attempt, (retryAfter || 0) * 1000)));
        continue;
      }
      // Never dump response bodies or request headers into logs.
      throw new Error(`OpenAI HTTP ${res.status} (${code}); check API billing, model access and OPENAI_API_KEY.`);
    }
    if (result.status !== 'completed' || result.error) throw new Error(`OpenAI response incomplete (${result.incomplete_details?.reason || result.status || 'unknown'}).`);
    const parts = (result.output || []).filter(x => x.type === 'message').flatMap(x => x.content || []);
    if (parts.some(x => x.type === 'refusal')) throw new Error('OpenAI declined the briefing request.');
    const text = parts.filter(x => x.type === 'output_text').map(x => x.text).join('');
    if (!text) throw new Error('OpenAI returned no output text.');
    const annotations = parts.flatMap(x => x.annotations || []).filter(x => x.type === 'url_citation');
    console.log(`OpenAI ${model}: ${result.usage?.input_tokens || 0} input / ${result.usage?.output_tokens || 0} output tokens`);
    return { value: schema ? JSON.parse(text) : text, annotations, model, usage: result.usage || {} };
  }
}

module.exports = { respond, DEFAULT_MODEL };
