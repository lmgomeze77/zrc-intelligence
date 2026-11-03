# OpenAI briefing operations

## Activation

1. In repository **Settings → Secrets and variables → Actions → New repository secret**, add `OPENAI_API_KEY` from an OpenAI Platform project with billing enabled. Never put the key in a commit, issue or chat. ChatGPT subscriptions and API billing are separate.
2. The `Briefing validation` workflow checks model access and Structured Outputs with a small API request. It does not use subscriber or delivery secrets. Re-run its failed job after adding the key.
3. Once regression and OpenAI preflight pass, merge the migration. In Actions, run `Briefing validation` manually with **Generate a full unpublished preview** enabled to inspect a fresh edition before the next scheduled send. It performs live RSS collection, bounded web verification, synthesis and email rendering; it does not publish or send.
4. The daily workflow uses OpenAI exclusively. Existing `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `ALERT_EMAIL` remain necessary. No Anthropic balance or key is used.

Default model: `gpt-6-astra`, explicit reasoning effort `low`, standard processing, Responses API, strict JSON schema, `store: false`. This is the current resolved migration target, not a claim that the account already has access. GitHub Actions variables `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` can override these after compatibility and preview checks. Run `npm run verify:openai` to confirm access; a missing key, missing model access or quota failure is an activation blocker, not a passed test.

The source task previously used Haiku for one synthesis request. The migration adds **at most three live research requests plus one synthesis request per edition**. Token usage is logged. No monthly price or quality equivalence is asserted until real editions have been measured. Compare at least three unpublished editions before selecting a cheaper model or increasing reasoning. The current target was resolved from official OpenAI guidance; the model-specific Markdown guide could not be fetched in this environment, so the bundled compatibility reference was also consulted. Live preflight remains necessary.

## Publication and delivery

- The existing schedule is retained: 06:17 UTC and backup at 09:17 UTC (07:17 / 10:17 Madrid in winter; 08:17 / 11:17 in summer). GitHub can delay or omit scheduled runs; it is not a guaranteed delivery-time service.
- A separate 11:47 UTC watchdog checks current publication and completed provider-acceptance receipts, then alerts on missing or partial delivery. It still depends on GitHub scheduling and the alert email provider; it is not an independent uptime service.
- Business dates, calendar labels, stale checks and email subject dates use `Europe/Madrid`.
- A fresh validated OpenAI edition skips **generation only**. Delivery always resumes against that edition. Do not regenerate solely to retry email.
- Email acceptance receipts are committed to `delivery-state.json` even on partial failure. Recipient identities use HMAC, never plaintext addresses or unsubscribe tokens. The HMAC secret is the Supabase service key; rotating it changes identities, so avoid rotating during an active retry window.
- Each recipient request uses the same Resend idempotency key across retries and the compatibility route. Editions older than 23 hours cannot be sent, to stay within Resend's 24-hour idempotency window. Partial failures fail the workflow and alert the operator. Provider acceptance is not proof of mailbox delivery; inspect Resend delivery/bounce events when needed.
- The Express compatibility route now delivers the same published edition; it never generates a second unsourced briefing. It requires `CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on its external host. This repository does not contain that host's deployment configuration; redeploy/configure it separately if used. Keep a single daily scheduler. Its in-memory ledger relies on the shared provider idempotency window.
- The browser shows the previous edition with a visible stale notice when today's edition is missing. It does not relabel old analysis as today's.

## Evidence and editorial checks

- All nine desks retain their existing feeds. Dates, longer snippets, stable source IDs and source URLs reach the model. Feed coverage must include at least nine raw items and five populated desks; missing desks remain visible in feed health. Individual feed outages are logged, not presented as a healthy source.
- Up to three consequential headlines are researched with OpenAI web search. Actual returned URL citations and the research note are preserved separately from original feed evidence. This is targeted verification, **not exhaustive verification of every fact**. Google News links may remain aggregator links; the product does not claim full-text access to every publisher.
- Summaries contain attributed reported facts; relevance is ZRC interpretation; scenarios are explicitly conditional. Executive entries cite curated source IDs. Single-feed claims cannot receive high conviction unless from a recognized primary central-bank source.
- The calendar accepts only future ISO timestamps inside 72 hours with an exact supporting excerpt copied from input and a matching explicit date/time (ISO timestamp or day–English month–year plus CET/CEST/UTC time). Display weekdays/times are computed, not model-written. Unsupported events are omitted. Editorial checks still need to assess whether a cited article actually establishes a claim; schema validity alone does not guarantee truth.
- The 0–100 market risk index is calculated consistently from desk signals and impact, capped to a 12-point daily move. It is a house indicator, not a calibrated probability or market quote. Existing legacy baselines remain historical; they have not been retrospectively fact-checked.
- A failed request, truncated response, refusal, invalid structure or invalid evidence leaves the previous `data.json` untouched and records a failure reason. No unedited fallback is sent under the ZRC name.

## Local verification

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run preview:email
npm run verify:openai
```

The first three commands require no API secret and send no email. The last makes a small paid OpenAI request. `ZRC Test Digest` is an explicit single-address send, not a dry run. It cannot modify the published edition or subscriber list.

Official references: [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [model guidance](https://developers.openai.com/api/docs/guides/latest-model), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
