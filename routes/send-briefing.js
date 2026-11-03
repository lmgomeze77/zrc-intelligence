// Compatibility endpoint: deliver the validated Actions edition; never invent news.
const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const { getSubscribers, buildEmailHTML, buildSubject } = require('../send-digest');
const { deliver } = require('../lib/delivery');
const { validatePublished } = require('../lib/briefing-contract');
const router = express.Router();
router.post('/', async (req, res) => {
  const expected = Buffer.from(process.env.CRON_SECRET || '');
  const supplied = Buffer.from(String(req.headers['x-cron-secret'] || ''));
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const response = await fetch('https://raw.githubusercontent.com/lmgomeze77/zrc-intelligence/main/data.json', { signal: AbortSignal.timeout(30000), cache: 'no-store' });
    if (!response.ok) throw new Error('Published briefing unavailable');
    const briefing = validatePublished(await response.json(), { requireOpenAI: true });
    const subscribers = await getSubscribers();
    if (!subscribers.length) throw new Error('No active subscribers');
    // Same daily idempotency keys as Actions; deliver() limits retries to 23h.
    const result = await deliver({ briefing, subscribers, env: process.env, buildEmailHTML, buildSubject, ledger: { version: 1, editions: {} } });
    return res.json(result);
  } catch (err) {
    console.error('Compatibility delivery failed:', err.message);
    return res.status(503).json({ error: 'Delivery incomplete. Check server logs and retry the published edition.' });
  }
});
module.exports = router;
