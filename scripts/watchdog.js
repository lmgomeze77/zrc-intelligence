const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { validatePublished } = require('../lib/briefing-contract');
try {
  const briefing = validatePublished(JSON.parse(fs.readFileSync('data.json', 'utf8')), { requireOpenAI: true });
  const ledger = JSON.parse(fs.readFileSync('delivery-state.json', 'utf8'));
  const id = createHash('sha256').update(briefing.generated).digest('hex');
  const edition = ledger.editions?.[id];
  if (!edition?.complete || !Object.values(edition.recipients || {}).some(x => x.acceptedAt)) throw new Error('Delivery has no completed provider-acceptance receipt for the current edition');
  console.log('Watchdog: current edition published and email provider acceptance recorded.');
} catch (err) {
  fs.writeFileSync('failure-reason.txt', `Watchdog: ${err.message}`);
  console.error(err.message);
  process.exitCode = 1;
}
