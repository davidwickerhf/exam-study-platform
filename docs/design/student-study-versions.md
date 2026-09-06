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
explicit selection; preview workers require an isolated database and an explicit user allowlist (see below).


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

## Guided visual lessons

New generations use `student-source-teaching-v3`; saved earlier revisions remain readable.
The reader follows the supplied science-scrollytelling pattern: short sequential explanations
and an active diagram beside them on desktop, inline diagrams on mobile, and optional deeper
reasoning. It keeps the existing Wicker Study white/slate/indigo design. Refero references:
Hashnode `001b4b2e-36c5-414f-943c-93047275fc18` for editorial hierarchy and spacing;
Brilliant `41ec1c5f-02d9-4d90-9740-1afa2d3bbf64` for focused practice interactions.
There is no forced empty scroll space or motion requirement.

Each chapter has 3–6 learning goals, 4–7 concise sections, substantive takeaways,
dedicated definition/rule/formula/pitfall callouts with rendered mathematics and citations,
5–8 self-contained summary entries, 8–12 progressive questions with objectives/hints/reasoned
solutions, and at least 10 varied atomic flashcards. Process diagrams, comparison tables,
plots and set diagrams are generated as validated data, never executable model-authored UI.
Source-backed and illustrative visuals are labelled separately. Deterministic checks reject
broken graph relationships, invalid membership, mismatched tables, non-finite plot data,
duplicate prompts and shallow practice; the independent reviewer checks semantic support.
Original slide images remain explicitly unanalysed unless their meaning is independently
established in extracted text. A generated teaching diagram does not imply vision analysis.

PowerPoint extraction version 5 removes embedded image/base64 payloads from accessibility
text while retaining legitimate descriptions. Existing originals are re-extracted during sync.
Administrative slides and visual-coverage markers are excluded from teaching chapter maps.

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
  Preview supports this diagnostic with the configured platform provider or a saved
  personal key. No key is returned to the browser or copied into CLI.
  For real material use `scenario:"sources"`, `course`, `sourceKeys`, `topic`, and
  explicit `includeHistorical` if needed. One chapter accepts at most 36,000 source
  characters, rejects oversized selections, and rechecks source access at each step.
  The fixed reference case additionally corrupts a solution and current exam rules
  to test reviewer sensitivity. A passing diagnostic is not a full-course evaluation.
- Production uses the existing signed Canvas queue dispatcher and minute outbox sweep.
  Preview workers require a dedicated database hostname matching
  `WICKER_PREVIEW_DATABASE_HOST` plus explicit `WICKER_PREVIEW_WORKER_USERS`.
  Dispatch and worker leases enforce the account list. Automatic discovery stays
  off in previews to avoid scheduling copied production accounts. Study generation
  has its own queue capacity; delayed continuations hand off to the current branch
  dispatcher instead of staying pinned to an obsolete deployment.
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

Selections are bounded to 100 files, 600k extracted characters and 24 mapped chapters.
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

Generation output uses JSON Schema derived from the same Zod validators used for
acceptance. The OpenAI adapter requests strict structured output, with citations
restricted to the evidence IDs supplied to that exact generation step. Structural
errors report field paths and validator codes without logging private source text.
Format conformance does not replace deterministic and independent evidence checks.

### Personal edits, feedback and revision history

The chapter's **Edit chapter** side panel offers text-only edits and AI feedback.
A direct edit selects one explanation, callout, takeaway, summary point, question,
answer, hint or flashcard side. Before/after review precedes saving a new immutable
revision. Evidence IDs and visual specifications are not client-editable. A changed
chapter becomes `student-edited`, loses its inherited AI-check badge, and cannot be
published as checked content. Changed practice items receive new IDs; old attempts
retain their original question/answer snapshots. Notes and reading progress remain.

AI feedback uses the same selected source snapshot, generates only the target
chapter and runs its evidence review. Unchanged chapters are preserved byte for
byte, including their existing review status. The resulting revision is a private
proposal; it cannot be used for publishing, exams or saved practice until accepted.
The reader stays on the current revision. A side panel shows textual changes and a
full preview (including diagrams); Apply/Discard are explicit. An outstanding
proposal blocks subsequent edits/refreshes until decided. Compare-and-swap checks
reject stale tabs and conflicting changes. Source access is checked again on apply.

Version history records edit type and label. Restore copies a prior revision into
a new revision; it never erases history or rewrites a published release. Originals
and citations remain those of the restored snapshot, subject to current access.

Enhanced generation explicitly selects GPT-5.4 for OpenAI platform connections;
standard continues to use the configured model. The same choice is offered for
source generation, chapter feedback and retry. Personal keys use the model selected
in AI settings (GPT-5.4 is also available there). Standard prices checked against
https://developers.openai.com/api/docs/pricing on 2026-09-06: GPT-5.4 $2.50 input /
$15 output per million tokens. Each call reserves at its actual model's price;
existing token, chapter, personal, shared and job limits still apply. No automatic
model or billing-source escalation. The model is an option to evaluate, not a claim
that it has passed comparative teaching-quality acceptance.

### Live acceptance, 7 September 2026

GPT-5.4 reference artifact `sqe-3a59c93d-0ece-4a89-888c-601c417fe793`
contains ten worked questions, twelve cards and four structured visuals. Generation
cost $0.092180. Recheck `sqe-c5571ca4-725d-468c-ba22-79efab9d9a5c`
reuses that exact artifact: structural checks, independent source review and the
three-error adversarial check all passed. Its two review calls cost $0.128271.
Earlier reviews/costs remain in the original report and
`sqe-ad1d1e03-6da5-40b9-8a45-07adbde5ee26`; total recorded cost across these
three linked reference reports is $0.484775, including calibration calls.

Calibration corrected reviewer false positives about string-only caveats, valid
consequences of cited equations and conventional mathematical definitions. It did
not relax checks for wrong answers, incorrect diagram membership, invented original
image readings or outdated course rules. A recheck creates a linked diagnostic and
preserves the original results; it does not regenerate an artifact to seek a pass.
This is a small reference test, not comparative proof of model quality across courses.

Live slide-deck testing also exposed title-only pages being expanded into unsupported
teaching. Those passages now appear only as coverage limits; their original source
snapshots are unchanged, and they are excluded from generation citation choices.
A topic with no explanatory evidence stops before any provider call is charged.


### September 7 live acceptance follow-up

The real BCS2120 slide-deck version completed three checked chapters. A targeted GPT-5.4 proposal revised the Turing Test chapter after student feedback, with explicit browser review and Apply. Two residual source-framed flashcards were corrected manually at no AI cost; this chapter is therefore correctly labelled personally edited. The other chapters remained byte-for-byte unchanged. The saved practice answer and ten-question exam retained their original revision and question snapshots across all edits.

Quality failures now permit at most one automatic focused correction per chapter using the saved draft and review findings. All calls use the existing billing reservations and limits. A recheck-only request never triggers a rewrite. Persistent problems still block the affected chapter. Deterministic checks reject slide/lecture recall framing before a paid evidence review; lessons are prompted to teach concepts directly and place source-coverage qualifications in caveats.

The isolated transcript JSONB comparison fix was backported to main in PR #51 with explicit merge authorization. Production deployment dpl_2tXYSsttaWbRQUMhVPcFBQacHuz4 is Ready and serves study.wicker.life. Its standalone regression reproduced the original error, and its verification passed 711 tests. The broader study-generation PR remains unmerged.

## Chapter workspace parity (7 September)

Personal versions now expose the maintained tutor workspace with a server-resolved owner, revision, chapter and optional question lens. The source inspector maps passages to topics and opens original PDFs, presentations, code/notebooks or the exact ingested text. Published editorial exam/tutorial PDFs and solutions are also selectable alongside the student's synced sources.

Practice separates generated chapter questions, additional targeted generated sets, and extracted course papers. Extraction preserves original leaf wording, labels, marks, choices, shared context, page and solution provenance. No supplied answer key means no invented official solution or grade. Unreadable graphical questions require the original and remain unscored. Generated sets have worked references and independent checks; one bounded correction is allowed before returning a failure for review.

Private `study-practice` documents retain immutable question/evidence snapshots, saved answers and criterion-level assessments. Exact choice keys are graded without AI; written answers use the existing budgeted provider/BYOK path. Marks must add up to the original question maximum or an explicit 10-point practice scale. Cache identities deduplicate concurrent identical requests. Generation/review are leased, persisted steps; leaving the page preserves checkpoints and permits explicit resume. They are not unattended queue jobs yet. No automatic paid retries after the bounded correction.

Existing mixed chapter exams can assess completed answers against their original revision. Previous ungraded chapter attempts remain visible. Personal attempts and questions needing review are discoverable from `/app/practice`, with links back to the saved course revision. This does not migrate personal flashcards into the old SM-2 deck or infer a syllabus-wide official exam blueprint.

Validation: `npm run verify` passed 795 tests, type checking and production build. Full Chromium run passed 15/16, exposing duplicate navigation in the mixed-exam layout; replaced the stacked workspaces with separate tabs. Both the affected flow and the new paper/grading/tutor/source-inspector flow then passed. Live model/output checks are recorded separately after preview deployment. No production merge for this feature branch is authorized.
