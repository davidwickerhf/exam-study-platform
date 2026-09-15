# AI usage observability

## Entry points

- Administrators: `/app/admin?tab=usage`, backed by admin-only `GET /api/admin/ai-usage`.
- Account owners: Settings → AI usage, backed by `GET /api/ai/calls`.
- Both accept `from`/`to` UTC dates (up to 93 days), `feature`, `model`, and `payer`. Only administrators may filter another `userId`. Personal requests always use the authenticated owner.
- Global API access requires an administrator, and an API key additionally requires the `admin` scope.

The interface shows daily cost/token graphs, breakdowns by feature, model, payer, generation phase, status and (admin only) user, plus the latest 100 calls. Top-group limits do not limit totals: PostgreSQL aggregates all matching events before response shaping. Missing dates are zero-filled. Unknown usage and unpriced calls have explicit counters.

## Capture and acceptance

`ai-call-tracking.mjs` persists a pending record **before** sending a provider request, then settles the same UUID. Every retry is a separate call. The platform's Chat Completions, Agents SDK/Responses, Anthropic Messages, embeddings and legacy CLI dispatch paths are instrumented. Tool execution, quota reservations and SDK aggregate summaries do not create duplicate provider events. Tutor, onboarding, feedback triage, study generation/review, exercise/paper processing, academic intake and editorial jobs use those shared boundaries. Feature/phase/job/chapter and payer labels flow through async-local context without copying prompts or credentials.

Hosted calls must have nonnegative integer provider input and output counts before their result is accepted. Embeddings require input counts and have zero output tokens. Streaming requests explicitly set `stream_options.include_usage`; missing stream usage fails acceptance. Zero is valid. No character-count estimate replaces missing provider counts in this ledger. A missing-usage failure is non-retryable (`provider_usage_missing`); it does not repeat the paid request to obtain accounting data.

Timeouts, cancellations, failed responses and process termination cannot guarantee a usage response from the provider. They remain failed/aborted/pending with unavailable counts, never fictitious measured zeros. Available usage is preserved on errors. If settlement storage fails, the pre-existing pending row remains and a sanitized `AI_USAGE_SETTLEMENT_FAILED` event identifies it. No telemetry failure triggers a second model request. Existing quota and conservative spending-reservation ledgers remain separate and unchanged.

Stored fields: owner, timestamp, provider, requested model, operation, feature, phase, payer, job/chapter IDs, app/MCP/background source, status, input/output/total counts, cached/cache-write counts, reasoning/audio/prediction breakdowns when returned, provider response/request IDs, duration, usage availability and versioned estimated token cost. Cached input and reasoning are subsets of input/output, not additional tokens.

## Cost semantics and limits

Costs are estimates from provider-reported token usage and the versioned standard price table, not invoices or hard-cap balances. Unsupported models, custom endpoints, nonstandard service tiers, missing pricing details, and unreported usage are unpriced. New cache-write models require the write split before pricing. Provider tool fees, subscription fees, discounts and invoice adjustments are not inferred. Pricing references:

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/models/text-embedding-3-small
- https://platform.claude.com/docs/en/about-claude/pricing
- Usage schema: https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create

External agents generating through their own subscriptions do not expose their underlying provider requests to Wicker's MCP server. Uploading a lesson is not counted as a free provider call. Legacy CLI invocations are recorded with unavailable usage when they return text only; the platform cannot attest to hidden requests inside those processes. Experimental managed-agent and standalone evaluation scripts are outside the production call path; the included `ai-usage-live.mjs` verifies all four hosted OpenAI transport paths explicitly.

Tracking starts at deployment. Previous quota entries and guide reservations are not re-imported as per-call usage, which would misattribute models or double-count spending. Records persist in `ai_call_events` (migration 037); local development stores one document per event under each user. Personal exports include `aiCalls`, and account deletion removes the user's records. Neither source content nor API secrets are stored in these records.

## Validation

- Unit/transport tests cover raw OpenAI and Anthropic normalization, cache/reasoning subsets, missing usage, zero counts, pricing gaps, user isolation, administrator scope, concurrent context separation, idempotent writes, failure settlement, streaming usage, embeddings and native SDK no-retry behavior.
- `scripts/verification/ai-usage-postgres.mjs` tests real SQL persistence and aggregations in a disposable localhost database; it also runs in CI.
- `e2e/ai-usage.spec.mjs` checks personal API isolation, admin denial, fixture-backed admin display, filters, unavailable usage and mobile layout.
- `scripts/verification/ai-usage-live.mjs` makes four small real provider calls in isolated local storage. On 14 September 2026: 50 input + 82 output = 132 total tokens; estimated USD 0.00017581; no missing usage or failed calls.

## Rollout

Apply migration 037 before enabling this code; its pre-call persistence deliberately fails closed if the ledger is unavailable. Do not merge/deploy while the user's existing guide generation is running. No production settings, jobs, contracts or saved guides were modified during this change.

UI direction: retain Wicker's existing neutral admin tables and typography, with daily bars and tabular token/cost breakdowns informed by the OpenAI usage/cost example surfaced in Refero (screen 09af6f92-c0be-4185-b57b-2d77731bab9d). No new decorative visual system.
