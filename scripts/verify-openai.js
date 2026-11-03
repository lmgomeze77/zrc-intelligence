// Small paid connectivity/contract check only. Never sends email or publishes.
const fs = require('node:fs');
const { respond } = require('../lib/openai');
const schema = { type: 'object', properties: { status: { type: 'string', enum: ['ok'] } }, required: ['status'], additionalProperties: false };
respond({ instructions: 'Return the required JSON status object.', input: 'Connectivity check. Return status ok.', schema, maxOutputTokens: 2048 })
  .then(({ value, model }) => {
    if (value.status !== 'ok') throw new Error('Unexpected model response');
    console.log(`OpenAI key, model access and Structured Outputs verified: ${model}. No publication or email.`);
  }).catch(err => {
    fs.writeFileSync('failure-reason.txt', err.message);
    console.error(err.message);
    process.exitCode = 1;
  });
