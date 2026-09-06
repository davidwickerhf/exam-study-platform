# Student study versions

## Product contract

A student can generate private, source-grounded chapters, summaries, exercises,
flashcards and practice exams without an editorial request. Course identity,
academic edition, ownership, sharing, review and freshness remain separate.
Editorial releases stay read-only; personal copies never inherit editorial approval.
Refresh creates an immutable revision and preserves personal annotations/attempts.
Historical sources are opt-in supplements; generated practice never asserts an
unverified current assessment format. Collection completeness is not syllabus coverage.

## Reference lock

Existing Wicker course page and semantic tokens are the primary build target:
compact chapter rows, neutral canvas, restrained primary actions, 12–14px metadata,
reading-width prose and the existing rounded bordered sections. No new font or palette.
Refero shadcn style c14c0a94-1037-449e-bf5b-4cb972656ac7 supports flat component
surfaces; Fonts In Use 470e5fb7-8e29-4b30-acc5-fb2907d86b51 informs compact source
registers only. Hashnode flow 3944 informs explicit generation progress followed by
separate publishing. Jasper screen cc0d202d-9205-4acb-9ff1-0292c9776194 informs
labeled note input and an explicit audience choice, without importing its colors.

| Decision | Basis | Reason |
| --- | --- | --- |
| Personal version next to editorial guide | User brief / existing course page | Immediate study without replacing trusted releases |
| Source chooser with year and type | User brief / archive reference | Make historical supplements and notes identifiable |
| Resumable progress, readable finished chapters | Hashnode flow / user brief | Show actual work and preserve progress through interruption |
| Separate sharing and editorial submission | User brief / Jasper audience control | Private generation does not expand source permissions |
| Sources and revision details next to lesson | User brief | Inspectable evidence and freshness |
| Step-through explanations, static readable fallback | Supplied scrollytelling reference | Useful interactive teaching without arbitrary generated code |

## Implementation architecture

Account-scoped version, revision and study-progress documents use the existing durable
user document store. A generation draft has a lease, source snapshot, completed steps
and retry state. Each queue invocation performs one bounded AI step. Revision activation
uses compare-and-swap; Stop invalidates the lease. SQL outbox discovery and the existing
signed Vercel dispatch path recover interrupted work. Private documents participate in
existing account export/deletion. Shared snapshots have an explicit audience and every
read rechecks source eligibility. Editorial submission transfers only explicitly selected
and permitted source evidence into the existing review inbox.

## Cost and quality contract

Development and Vercel preview environments have no application AI usage caps.
Production accounts whose server-resolved, verified primary Clerk email is
`davidwickerhf@gmail.com` or `d.wicker@student.maastrichtuniversity.nl` are also
uncapped. This applies to study generation, private quality evaluations, background
priority scans, tutor/exercise/import quotas and the AI-specific request bucket.
Queued work resolves its owner's identity; submitted email or billing flags cannot
grant exemptions. Other production accounts retain the limits below. Costs and
tokens are still recorded, while Settings displays “Unlimited AI usage” and hides
spending-cap fields. Provider limits, job leases, finite context/output bounds,
timeouts and general HTTP abuse protections remain. Personal keys still require
explicit selection; preview workers remain disabled to avoid consuming shared jobs.


Platform study generation defaults to 6 newly generated chapters per UTC day and
30 per UTC month, plus $0.50/day and $3/month per account. The shared study budget
is $10/day and $100/month. All limits are configurable. Mapping, outline building,
writing, independent evidence checks and retries reserve their maximum cost
atomically before contacting a provider. Measured usage releases unused reserves;
unknown usage retains the conservative bound. A five-minute account lease prevents
concurrent requests from racing the budget. Reading, saved practice exams and
reusing unchanged chapters cost no AI tokens. These budgets cover the new study
pipeline; existing tutor/intake quotas remain separate.

The default per-generation cap is $1, adjustable explicitly between $0.05 and $10.
The earliest applicable cap pauses work; the advertised chapter count is a maximum,
not a promise that every source selection fits the token or money allowance.
A student can choose an encrypted personal API key in Settings. It has an independent
monthly Wicker cap ($5 default), 2M daily tokens and the same request/concurrency
controls. It bypasses included chapter limits, never falls back to platform billing,
and key replacement/removal pauses queued work until the student explicitly resumes.
Only first-party OpenAI and Anthropic endpoints and priced models are allowed.
Provider subscriptions are separate from API billing; taxes and use outside Wicker
are not counted by these application-level estimates.

Rates, checked 2026-09-06: [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini)
$0.25 input / $2 output per million tokens;
[Claude Sonnet 4.5](https://platform.claude.com/docs/en/about-claude/pricing)
$3 input / $15 output. Cached-token discounts are deliberately not assumed.
Recheck the rate card before changing model aliases or enabling another provider.

Every generated lesson must pass structured-format and citation checks, minimum
teaching depth, reasoned exercise solutions, duplicate-question checks, safe markup,
long-copy detection and simple constant-arithmetic checks. A separate model call
reviews evidence support, solutions, contradictions and historical assessment rules.
This is labeled AI checking, never editorial approval. Human subject review remains
necessary to establish teaching quality across a full course.

## Validation and operations

- `npm run verify`: TypeScript, all Node tests, production build.
- `npm run test:study:postgres`: real PostgreSQL/pgvector migration, source access,
  sharing withdrawal, worker claims and shared-budget concurrency checks. Requires
  a disposable localhost `STUDY_TEST_DATABASE_URL`; it resets that database.
- `npm run test:e2e`: real local Next/API/persistence with an isolated fixture account;
  only model output is fixture-generated. Tests read evidence, save notes/answers,
  complete an exam, publish/withdraw a selection and check mobile layout/settings.
  Install Chromium with `npx playwright install chromium`, or set
  `PLAYWRIGHT_EXECUTABLE_PATH` to a local compatible Chromium executable.
- `npm run test:study:live -- --require-live`: opt-in OpenAI evaluation, capped at
  $0.25 by default (`STUDY_EVAL_MAX_USD`, maximum $1), including an adversarial
  incorrect-answer/historical-rules check. Requires `OPENAI_API_KEY`; no live calls
  occur in ordinary verification. Writes `/tmp/wicker-study-quality-evaluation.json`.
- Signed-in browser evaluations: `POST /api/study-versions/evaluations` with
  `{scenario:"reference",billing:{billingSource:"personal",maxJobUsd:0.25}}`, then
  inspect `/app/study-evaluations/<id>`. The page runs one explicit paid step at a
  time. Each step uses the production provider adapter, prompts and atomic budget
  ledger. A stale revision or duplicate delivery never advances another paid step.
  Reports include model usage, recorded cost, generated teaching, source passages,
  and the independent review's findings. Failed/uncertain calls retain conservative
  budget reservations; settings show the account total. An interrupted request is
  never retried automatically. Evaluations are private, exported with account data,
  and live in a separate namespace with no production queue or publication path.
  Preview supports this diagnostic with a saved personal key while general preview
  generation remains disabled. No key is returned to the browser or copied into CLI.
  For real material use `scenario:"sources"`, `course`, `sourceKeys`, `topic`, and
  explicit `includeHistorical` if needed. One chapter accepts at most 36,000 source
  characters, rejects oversized selections, and rechecks source access at each step.
  The fixed reference case additionally corrupts a solution and current exam rules
  to test reviewer sensitivity. A passing diagnostic is not a full-course evaluation.
- Production uses the existing signed Canvas queue dispatcher and minute outbox sweep.
  Preview generation is disabled so preview workers cannot consume production work.
  Local mode uses resumable in-process steps and a 30-second recovery sweep.
- Apply migration 033 through the normal migration runner. Configure a priced API
  provider (`LLM_PROVIDER=openai`, `OPENAI_MODEL=gpt-5-mini`, or Anthropic Sonnet 4.5).
  CLI providers are not eligible for this spending-controlled generation path.
- Personal credentials require `AI_CONNECTION_ENCRYPTION_KEY` (32 random bytes,
  base64). The existing Canvas encryption master key can be used through a separate
  HMAC-derived subkey. Keys are excluded from exports and deleted with the account.
  Aggregate platform spend counters retain hashed account references for the budget
  period so deleting an account does not erase already incurred platform costs.

## Deliberate limits

Selections are bounded to 100 files, 600k extracted characters and 40 chapters.
Unreadable material and unmapped passages are listed explicitly; scanned notes need
text extraction before generation. Historical and undated sources require opt-in.
A different academic edition gets a separate version rather than overwriting history.
There is no automatic syllabus-completeness claim, human quality guarantee, rich
arbitrary-code scrollytelling, or automatic promotion to editorial status.
Community releases are immutable selected snapshots. Students can read them and
create their own versions from their authorized sources; one-click community forks
and editorial merge/diff workflows are not part of this implementation.
Admin submissions include selected teaching content and cited excerpts, not automatic
access to all of a contributor's original documents. Existing editorial intake/release
review still determines publication. A shared release becomes unavailable if its
sources change or sharing permission is withdrawn; private revision history remains.
