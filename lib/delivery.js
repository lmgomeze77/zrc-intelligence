const { createHmac, createHash } = require('node:crypto');
const { validatePublished } = require('./briefing-contract');

function deliveryKey(briefing, email, secret, namespace = 'daily') {
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for private delivery identities');
  return `zrc-${namespace}-${createHmac('sha256', secret).update(`${briefing.generated}\n${email.trim().toLowerCase()}`).digest('hex')}`;
}
function loadLedger(fs, path = 'delivery-state.json') {
  if (!fs.existsSync(path)) return { version: 1, editions: {} };
  const ledger = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (ledger.version !== 1 || !ledger.editions || typeof ledger.editions !== 'object') throw new Error('Invalid delivery ledger; refusing to risk duplicate delivery');
  return ledger;
}
async function deliver({ briefing, subscribers, env, buildEmailHTML, buildSubject, ledger, checkpoint = () => {}, fetchImpl = fetch, now = new Date(), namespace = 'daily' }) {
  validatePublished(briefing, { now, requireOpenAI: true });
  // Resend idempotency lasts 24h. Never retry an edition outside that window,
  // even if a runner crashed before persisting its local delivery ledger.
  if (+now - Date.parse(briefing.generated) >= 23 * 3600000) throw new Error('Edition exceeds safe delivery retry window');
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is missing; delivery did not run');
  const editionId = createHash('sha256').update(briefing.generated).digest('hex');
  const digest = createHash('sha256').update(JSON.stringify(briefing)).digest('hex');
  const existing = ledger.editions[editionId];
  if (existing && existing.digest !== digest) throw new Error('Published edition changed without a new generated timestamp');
  const edition = ledger.editions[editionId] ||= { generated: briefing.generated, digest, recipients: {} };
  let accepted = 0, skipped = 0, failed = 0;
  const unique = [...new Map(subscribers.map(s => [String(s.email).trim().toLowerCase(), s])).values()];
  for (const sub of unique) {
    const key = deliveryKey(briefing, sub.email, env.SUPABASE_SERVICE_ROLE_KEY, namespace);
    if (edition.recipients[key]?.acceptedAt) { skipped++; continue; }
    try {
      const unsubscribeUrl = `${env.BASE_URL || 'https://zrc-api.onrender.com'}/api/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token || '')}`;
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({
          from: 'ZRC Intelligence <intelligence@zenithrisecapital.com>', to: sub.email,
          subject: `${namespace === 'test' ? '[TEST] ' : ''}${buildSubject(briefing)}`,
          html: buildEmailHTML(briefing, sub.name, unsubscribeUrl)
        })
      });
      const result = await res.json();
      if (!res.ok || !result.id) throw new Error(`Resend HTTP ${res.status}`);
      edition.recipients[key] = { acceptedAt: now.toISOString(), messageId: result.id };
      accepted++;
      checkpoint(ledger);
    } catch (err) {
      failed++;
      console.error(`Delivery recipient failed (${err.name === 'TimeoutError' ? 'timeout' : 'provider rejected or request failed'}). Retry uses the same idempotency key.`);
    }
  }
  edition.lastAttemptAt = now.toISOString();
  edition.complete = failed === 0;
  // Keep a week of private HMAC identities, never addresses or unsubscribe tokens.
  for (const [id, row] of Object.entries(ledger.editions)) if (+now - Date.parse(row.generated) > 7 * 86400000) delete ledger.editions[id];
  checkpoint(ledger);
  const summary = { accepted, skipped, failed, total: unique.length };
  if (failed) throw Object.assign(new Error(`Email delivery incomplete: ${failed} failed, ${accepted} accepted, ${skipped} already accepted. Retry delivery; do not regenerate.`), { summary });
  return summary;
}
module.exports = { deliveryKey, loadLedger, deliver };
