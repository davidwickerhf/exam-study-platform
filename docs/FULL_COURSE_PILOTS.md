# Full-course generation pilots

The experiment measures the sum across a course's guide bundle, not the cost of
one sample guide. Initial generation of every unit runs before update experiments.
A successful source preflight is not a successful model evaluation.

## Current preparation (15 September 2026)

| Course | Edition selection | Planned guide groups/parts | Source coverage |
| --- | --- | ---: | --- |
| Block Chains | 2026–2027 only | 3 | 103 inventory entries represented by 66 deduplicated sources |
| Intelligent User Interfaces | 2026–2027, 2025–2026, 2024–2025 | 9 | 146 inventory entries; 116 within-year sources, 115 distinct-byte representations with edition aliases |

Both complete bundles pass the real source-snapshot admission checks with no
missing selected source keys or textless exclusions after isolated preparation.
Identical original bytes may be represented once while retaining all year/path
provenance. Different historical material remains separate; it does not establish
current-year exam scope. The bundle split uses complete sources and the existing
600,000-character per-guide ceiling. These groupings are experiment manifests,
not a claim that automatic readiness inference has been evaluated.

Current extracted text included large amounts of generated Android build-cache
content in a Unity archive. The extractor now omits explicitly named build-cache,
version-control and installed-dependency directories, reports the excluded member
count/bytes and sample paths, and preserves the original archive. Authored scripts,
README files and other source text remain. The tested VR archive's extracted text
fell from 824,326 to 506,461 characters; its identical cross-year original needs
only one content representation. This is a context-volume measurement, not a
measured dollar saving. Re-extraction of saved production assets is not automatic
in this change.

Five Solidity files and eight IUI originals without indexed text were inspected
through verified original downloads and prepared locally. Three `.bin` files were
UTF-8 source code; the generic production index still does not infer their format.
These repairs are explicit pilot preparation, not a claim that the current Canvas
index is complete. PDF/chart visual coverage has not been independently audited
for every course file.

## Live execution status

The first Blockchains mapping call was rejected for exhausted provider credits.
No usage was returned: $1.200650 remains an unresolved reservation, not a measured
token bill. After recharge, the saved run resumed and IUI started. Planning and
review optimizations were applied at completed-call checkpoints without discarding
authored work. At the 15 September 09:30 UTC checkpoint, each course had three
checked chapters in its first guide. Measured-usage costs were $27.315904 for
Blockchains and $23.568986 for IUI; the earlier Blockchains reservation is separate.
Both full-course bundles and their subsequent update tests remain unfinished.
These figures include prior attempts and optimization, and are not course prices.

The IUI outline exhausted a hard-coded 10,000-token output limit after its 16
source maps completed ($4.935302 in measured-usage cost across that attempt).
Combined outlines now use the existing 24,000-token planning allowance. The
retry resumes only that stage with its maps and cumulative spending preserved.
The first Blockchains guide's outline contains 23 chapters, highlighting chapter
granularity as a cost concern to evaluate, not evidence of completed coverage.
The earlier synthetic two-chapter $3.06 pilot is not a result for either course.

Each course experiment has a $50 cumulative ceiling, including initial guides,
reviews, corrections, retries and update calls. The default student allowance is
still undecided pending measured results. Do not claim full-course completion or
extrapolate a price from source admission alone.

## Reproduce or resume

Keep private source manifests, originals, credentials and generated course
content outside the repository. A suite manifest contains `course`, `units`
(paths to per-guide manifests), `sourceKeys` (the complete deduplicated coverage
set), and `maximumUsd`. Each unit contains `course`, `title`, `sources` with
page/text data and original provenance, and `updateSourceKeys`. New update sources
are explicitly labelled synthetic evaluation handouts; no existing course
material is withheld from initial generation. Optional `moduleRefs` fixes the
precise maintenance boundaries.

```sh
node scripts/verification/study-course-preflight.mjs /private/course-suite.json /private/preflight.json
node --env-file=.env.local scripts/verification/run-study-course-suite.mjs /private/course-suite.json /private/results
```

The wrapper disables the database connection before importing application code.
The provider remains Astra through Agents SDK + Responses. The local protocol is
exercised by a paid isolated model client, including fresh review contexts and
identical-submission replay checks; it does not bill through the hosted student's
application allowance or claim to test production queue delivery.

Rerunning the same suite/results directory skips successful units and resumes a
failed unit's saved draft. Successful initial guides needing an update remain in
the isolated account until their update finishes. Failed work is preserved.
Unknown usage retains its reservation. Ledgers are written atomically, freeze
the input manifests, and reject corrupted accounting. An exclusive suite lock
prevents concurrent coordinators. After a process crash, an unfinished attempt
blocks automatic continuation: inspect the saved process and report, reconcile
its reservation into the ledger, and remove a stale lock only after confirming
that no child is running. Never reset the results directory to evade
a spending guard or correction limit.

After every initial guide passes, maintenance enrollment, a no-change scheduler
check and a synthetic source addition run through the real recurring scheduler.
The original readable revision must remain active while the new one is generated
and reviewed. Reports include initial/update token usage separately, retained
chapter/section/question counts, source gaps, review findings and retry history.
Full-course success requires all initial units and planned update experiments to
pass. No production guides, course sources or automation preferences are changed.

## Planning optimization under the same caps

Combined outlines now return short mapped-concept references. The server resolves
their full evidence unions and rejects missing, unknown or duplicate assignments.
This removes long citation-list copying from model output. Consolidation retains
concept titles for teaching plans and source gaps; teaching quality still needs
its existing independent review, not just a successful structural check.

Chapter splitting now uses the actual remaining 72,000-character packet capacity
after scope context, rather than the 36,000-character mapping batch size. Shared
scope is counted once and every evidence passage survives any necessary split.
No context ceiling or spending allowance was raised. The teaching planner sees
neighboring chapter responsibilities to reduce duplicate objectives and practice
while keeping necessary prerequisite explanations.

`STUDY_PIPELINE_REPLAN_REMAINING=1` lets the isolated pilot regroup only unstarted
chapters when resuming. Authored chapters, checks, maps and correction counters
remain; the old outline/plans are archived in the draft. At most two regrouping
attempts are allowed, with a rejected proposal supplied to its correction. These
calls count against the same course ledger. This is an experiment continuation
helper, not a new production control or a reset of the generation budget.

The first live whole-course bundle run accepted all 71 source-mapping batches and
then lost the run on one outline call that omitted two mapped concepts, because
the bundle outline had no correction loop. The outline stage now feeds a rejected
proposal and its exact issues back into the same `course-outline` phase, at most
twice per outline, counted in the draft's persisted automatic-correction ledger
so a pilot resume continues that bound instead of resetting it. A `stage: outline,
status: failed` draft therefore resumes into the correction path with its maps
intact, and an exhausted bound fails with the same error without buying another
proposal.

A later 320-concept/71-map run still exhausted the correction bound: the base
call and both corrections each omitted 1-2 concepts, last `map-67-topic-3`.
Below max(3, 2% of all mapped concepts) a dropped concept with no other
error-level issue is now placed deterministically instead of rejected, and an
exhausted `stage: outline` draft re-checks its saved proposal under the current
rules on resume, so that exact saved attempt is accepted with zero provider
calls instead of repeating the same failure.

The next resumed run reached a structurally valid 71-map outline that failed
only because evidence-capacity splitting pushed the whole course past a single
guide's 40-chapter ceiling, outside the correction path. Chapter ceilings now
apply per guide (24 planned, 40 after splitting, 2–12 guides), the prompt states
the per-chapter evidence allowance and minimum chapter count, and a post-split
breach becomes a correctable rejection with the proposal saved. A `stage: outline`
draft with no saved correction resumes into one fresh outline call under these rules.

Set `STUDY_PIPELINE_PAUSE_FILE` to a private file path before starting a pilot.
Creating that file pauses before the next paid call after preserving the current
response; remove it before resuming. Failed or paused runs keep their isolated
account. A full-course pass still requires every initial guide and update test.

The live Blockchains regrouping reduced its first guide from 23 to 9 chapters.
IUI initially failed the regrouping guard because old-year syllabi/announcements
were automatically copied into every chapter: 55,800 scope characters. Automatic
scope now uses the target edition (and conservatively retains undated scope).
Historical originals stay in the snapshot and are included whenever explicitly
selected as teaching evidence. IUI's automatic scope becomes 28,846 characters;
its exact saved proposal revalidates to 16 chapters instead of 26 without another
model call or resetting its two planning attempts. These are planning results,
not completed-course cost or teaching-quality results.


## Review and request-cost optimizations

Blind solving and answer comparison accept up to 48 items within a 48K-character
payload bound. The bound counts the actual transmitted fields, including independent
solutions in answer comparison. Teaching review groups up to eight objectives
within its existing size bound. All verdicts remain required, reviewer contexts
remain isolated, and bounded output-limit recovery still splits factual batches.
The blind solver's arithmetic check accepts a rounded result within half a unit of its last written decimal place, and a calculation that still fails is isolated to its own question (re-solved alone, bounded to two re-solves, then handed to the ordinary correction path) instead of discarding the rest of the batch or failing the pipeline.
Answer comparison also attributes a failing verdict's fault (authored, independent-solution, both or none); a verdict blaming only the independent solution clears that question's solution and judgment and re-solves it alone under the same bounded retry counter instead of recording a chapter finding, and a chapter that failed review purely on now-stale answers judgments (for example after this attribution was added) re-enters review for free instead of needing a fresh correction.
The scripted browser evaluation retains all seven checks in 11 calls instead of
13. This plumbing result is not a measured live quality or cost comparison.

The first hosted calls showed only approximately 2% cached-input reuse. The
single-message prompts and strict output schemas change between checkpoints.
On GPT-5.6/6, these SDK checkpoints now use explicit cache mode without breakpoints
to avoid writing single-use input. The first live corrected-question call returned
43,664 input / 1,266 output tokens, zero cache writes and zero cache reads: avoiding
$0.10916 of write premium at the configured Astra rates. Hard reservations remain
conservative; this does not assume a cache hit or lower the safety bound. Future
shared-prefix caching requires stable message boundaries and compatible schemas;
merely enabling a retention setting does not establish reuse. See the
[official cache behavior](https://developers.openai.com/api/docs/guides/prompt-caching).

Missing or malformed actual input/output counters cannot settle a reservation.
Estimated usage remains separate from measured usage. The latest local verification
passed 1,090 tests plus TypeScript and the production build.

## Paid continuation paused for economics redesign

The later 09:39 UTC checkpoint is a deliberate stop: Blockchains $30.302604
measured plus its $1.200650 unresolved reservation; IUI $26.502596 measured.
Current responses were saved before stopping. There are no active paid pilot
processes. Keep the configured pause files present while implementing and
validating the redesign. Do not spend the rest of the $50 ceilings merely to
reach a spending-limit failure.

New offline changes and their limits are documented in
`GUIDE_GENERATION_ECONOMICS.md`: shared course map/index reuse, planning reports,
focused reviewer evidence and opt-in phase-specific routing. No additional real
model calls were made to validate these changes. A future configured model-profile
experiment must remain in the same cumulative course accounting; per-call model
identity now determines measured pricing. Completed-course and live top-up results
are still outstanding.

## Fresh IUI baseline, requested 15 September

A short continuation using Sol factual reviewers was stopped after three calls
($0.310388 measured), before another call. The original IUI account and drafts
remain intact. Cumulative prior IUI experiments now total $26.812984.

A separate empty isolated account is running all nine original IUI guide groups
from source mapping onward. No old maps, authored chapters or reviews were copied.
Its ledger carries the prior experiments as historical cost, leaving $23.187016
under the original cumulative $50 ceiling. Fresh baseline usage is separately
identifiable; the experiment must not report historical costs as fresh generation
costs, or discard them from cap enforcement.

The experimental profile routes mapping, outlining, teaching plans, authoring,
factual review and correction to `gpt-5.6-sol`, retaining `gpt-6-astra` for
pedagogical review. It is not enabled in production. Completion, total fresh
course cost and quality results are pending; no price-per-course claim follows
from starting this run.

The suite now retains one isolated account across its guides, allowing genuine
within-course source-map reuse. Saved legacy attempts retain their original
account on resume. Completed pilot accounts are retained for inspection instead
of being deleted when a unit without a top-up finishes. Source updates still run
only after the complete initial bundle, and initial/update costs remain separate.

For bounded diagnostic segments, `STUDY_PIPELINE_ATTEMPT_MAX_USD` restricts
additional spending without raising the course ceiling, and
`STUDY_PIPELINE_STOP_CHECKED_CHAPTERS` pauses at a checked chapter checkpoint.
Neither option is set for the fresh full-course run. An interrupted or capped
run remains an incomplete full-course measurement, never a passing sample.

### Fresh IUI outcome and bounded repair

The fresh run stopped on its first chapter at the three-correction limit:
$6.685974 measured, 35 calls, 803,588 input and 123,098 output tokens. No guide
or chapter passed. $1.675264 was first-guide source mapping and outlining; the
remainder was planning, authoring and review/correction. The other eight guides
and the live source-update experiment were not reached.

A subsequent explicitly requested repair retained the saved draft and all three
automatic attempts, recording one manual attempt. An initial $3 segment admitted
no call because the repair reservation was too large. After lossless citation-enum
schema compaction, five paid calls cost $0.833248. Fourteen unchanged factual
judgments were retained after the patch. Factual review still found incomplete
goal wording; teaching review was not called because its conservative reservation
exceeded the remaining segment allowance. The chapter remains unapproved.

Cumulative IUI measured spending is $34.332206 with no unknown usage, including
$7.519222 for the fresh experiment and its repair. The full course and top-up tests
remain paused. See `GUIDE_GENERATION_ECONOMICS.md` for the repaired schema/prompt
constraints and the distinction between offline regression results and live
teaching-quality results. The final goal-limit change has not been model-tested.

### Whole-bundle planning checkpoint

Use `STUDY_PIPELINE_PLAN_ONLY=1` with the existing course-suite command to collect
all initial guide outlines before paying for chapter authors and reviewers. It
preserves the same ledger and version IDs and can resume into generation without
that flag. Inspect the saved `draft.planning` and `draft.topics` for each unit.
`planningComplete` does not mean generated or reviewed; `complete` still requires
every initial guide and every requested source-update experiment to pass. Existing
IUI authored drafts have not been discarded or replaced by this new mode.

The IUI plan-only checkpoint (attempt 6: 115 sources, about 2.49M characters,
71 maps, 320 concepts) produced 10 guides and 167 chapters, 668 baseline review
tasks, and paused at the 128-task guard. About 1.06M of those characters are
code and project archives, and 1.33M are older-edition material. Whole-course
bundles now plan under the automatic scope-roles policy described in
`docs/design/student-study-versions.md`: for that saved draft the server derives
about 1.27M characters of core evidence and a 37-chapter course budget (capacity
minimum 30, 3–10 per guide), before any exclusions. That draft has no authored
chapters, so rerunning the suite with `STUDY_PIPELINE_PLAN_ONLY=1` replans only
its outline from the saved maps (one outline call plus at most two corrections,
no mapping calls); the suite no longer skips a planned unit whose saved plan is
stale. The review-task guard still applies when drafting resumes. This is a
planning change, not yet a measured result.

A later attempt under that same scope-roles-v1 policy returned six guides that
were each essentially one giant topic, so the server's evidence-capacity split
mechanically produced 30 chapters (29 numbered "Part" slices with no
conceptual chapter structure) while still fitting the aggregate course and
guide budgets. The policy is now `scope-roles-v2`, which also rejects a
planned chapter needing more than a two-part fallback split or a guide whose
planned chapter count cannot hold its own core evidence, and gives the
planner each concept's core-evidence size so it can shape chapters before the
call is paid for.

### Latest IUI checkpoint (15 September)

The coherent objective repair made five measured calls for $1.148748 plus two
failed provider requests with unknown usage. Independent review still rejected an
overly formal interpretation of a descriptive historical IUI definition. No IUI
chapter or guide has passed. Four manual corrections and the original three
automatic corrections remain recorded; no counters were reset.

The cumulative ledger records $38.363684 measured and $7.654250 in unresolved
reservations ($46.017934 committed against the unchanged $50 ceiling). Unknown
usage is not reported as zero or as confirmed spending. Paid continuation is paused.
Provider errors now retain a validated request correlation ID when supplied, and
the pilot respects bounded retry delays instead of immediately repeating outages.
The two historical failed calls did not retain correlation IDs and remain held.

A zero-call planning-only run reused the saved first-guide outline with an
identical draft and version ID. It reported `planned=true`, `passed=false`; the
next guide stopped at the pause boundary before a provider call. The full bundle
and top-up remain incomplete. This is resume/control validation, not a quality
pass or an affordable-course claim.

### Mapping output-limit behaviour (whole-course bundle attempt)

The whole-course bundle attempt made four `source-mapping` calls on `gpt-5-mini`
at medium effort under a 10,000-token output cap (the pilot ceiling was 32,000;
mapping asks for 10,000). Three maps were accepted with 5,952 / 4,736 / 5,888
reasoning tokens and only 1,815 / 1,442 / 1,204 visible output tokens. The fourth
call spent all 9,984 tokens on reasoning, returned nothing and settled as
`provider_output_limit`. The cap was never tight for the visible map: accepted
maps are 3.8-6.4 KB of JSON, 4-5 concepts and 11-31 citation entries. It was
tight for reasoning, which varied by more than a thousand tokens between calls.

Mapping therefore gets the same bounded recovery the factual review already has:
an output limit halves that one batch, at most twice, and the split is recorded
in the persisted batch list so a resumed run repeats the same boundaries. Accepted
maps and their citations are kept, batches stay identified by content, each
recovery reserves and settles on its own, and no model, effort or cap is raised
automatically. The 36,000-character mapping batch size is unchanged; four calls
are not evidence for a better bound. Note that 17 of the 71 planned batches hold
more than 48 evidence passages (up to 79), and the largest batch in this attempt
was also the one that exhausted its reasoning budget.

`STUDY_MODEL_ROUTES` / `STUDY_PIPELINE_MODEL_ROUTES` can now also set a phase's
reasoning effort, so a cheaper mapping effort can be measured without changing
the model or raising any price. No profile is enabled by default.

### Hosted parity and course top-up coverage

The bundle is now exercised in both execution modes without a provider. A hosted
suite drives `processStudyStep` with mocked responses through mapping (including
one `provider_output_limit` recovery), the bundle outline, chapters and the
fenced publication: it asserts that guides are staged invisibly, that no guide is
ever listed, claimed or discoverable as hosted work, that a half-finished
publication converges on retry with the same identities, and that every call
reserves against the parent course run's single job key and chapter allowance.
`study-pipeline-live.mjs` now passes the bundle flag in its hosted creation
branch too, and a run only passes when every derived guide is itself published,
complete and non-empty.

A second suite covers the top-up: republishing a course keeps surviving guide
identities, keeps the previous guides readable until the replacement passes,
adopts new guides and archives dropped ones instead of deleting them; a local
course run refreshed with an added source reuses unchanged chapters, stays local
and keeps its guides out of the hosted queue. Maintenance is enrolled on the
course run, never on a managed guide, and a withheld source that arrives later
is processed through the parent.

### Stray objective-coverage links no longer burn a correction

The `guide-1-initial-attempt` chapter had failed after exhausting all three automatic corrections on a single stray `workedExampleSectionIds` reference to a section tagged for a different objective; drafted chapters are now normalized to drop such invalid coverage links (recorded in `linkRepairs`) whenever a valid reference remains, instead of rejecting the whole chapter. A chapter saved as `review: failed` for only that reason now resumes straight into factual/pedagogical review on retry, with no new authoring or correction call and an unchanged correction ledger.

### Question-only corrections, unsupported-evidence hygiene, and hosted course pilots

`iui-foundations-scope-and-hci` had failed review three times in a row (10, then
14, then 11 error findings), each retry rewriting the entire chapter with
`gpt-5-mini`. Four changes target that failure mode directly:

- A correction rewrite — automatic or a manual retry through
  `controlStudyGeneration(id,'retry')` — now tags its generate call with an
  explicit `*-correction` phase in `usageMetadata`, so a configured
  `STUDY_MODEL_ROUTES`/`STUDY_PIPELINE_MODEL_ROUTES` `correction` route applies
  to it and it is billed under that phase. A genuine first draft is unaffected:
  it still carries no explicit phase and resolves to `authoring`.
- Before structural checks and review, `stripUnsupportedEvidenceIds` removes
  every internal evidence identifier — supported or not — from a chapter's
  caveats, teaching-plan gaps and teaching-plan exclusions (the id token only,
  never the surrounding prose; an entry left with no words is dropped instead
  of kept), and records each removal in `chapter.evidenceIdRepairs`, mirroring
  `linkRepairs`; it now runs on every accepted draft, first attempt or
  correction, and a chapter saved `review: failed` for only that reason
  recovers on retry with no new authoring or correction call, the same as the
  stray-link recovery above.
- `questionRepairStep` no longer falls back to a whole-chapter rewrite merely
  because more than six questions are affected. When every error-severity
  finding for a chapter resolves to a specific question — misconception/
  follow-up link mismatches, a question assessing untaught content, a
  duplicated transfer scenario — the correction is a question-only patch over
  exactly those questions (and their diagnosed follow-up targets), preserving
  every other question, section, card and the teaching plan. The seven
  misconception-link mismatches that previously exceeded the old six-key bound
  now patch in one bounded call. A mixed finding set (for example a
  question-scoped finding alongside a missing-practice finding) still takes the
  broader combined or whole-chapter path.
- The shared correction prompt (`correctionContext`) now tells the model that
  when a finding says a mechanism or claim is not established by the supplied
  evidence, it must remove that content or clearly relabel it as background
  outside the taught scope, and remove or replace any question assessing it —
  never add new teaching to justify unsupported content.

`study-pipeline-live.mjs` previously required `STUDY_PIPELINE_MODE=local` for
every course pilot. A course pilot may now run its **initial phase** hosted
(`STUDY_PIPELINE_MODE=hosted`, through `processStudyStep`); the
maintenance/update phase still always requires local mode and explicit
synthetic update source keys, and a hosted run with real
`updateSourceKeys` is refused unless it explicitly sets
`STUDY_PIPELINE_DEFER_UPDATE=1` to defer the update phase to a separate local
run. Hosted bundle creation already passed the course-bundle flag. Resuming a
saved draft now prefers a saved run from the exact same execution mode; a saved
draft from the *other* mode (for example, a course's saved draft was generated
locally and this pass is hosted) is never resumed silently — it is refused with
a message naming both modes unless `STUDY_PIPELINE_CONVERT_EXECUTION=1`
explicitly converts the draft's execution for the pilot's isolated account,
which is then recorded on the run as `executionConverted`. Hosted and local
reservations and settlement already shared the same `generate` wrapper, so both
execution modes flow through the same cumulative ledger and attempt cap. This
gating lives in `scripts/verification/study-pilot-execution-gate.mjs`
(`assertPilotExecutionMode`, `resolveSavedPilotRun`), unit-tested without any
provider call.

To run the IUI course pilot in hosted mode for the initial phase only:

```
STUDY_PIPELINE_COURSE_FILE=<pilot-manifest.json> \
STUDY_PIPELINE_MODE=hosted \
STUDY_PIPELINE_DEFER_UPDATE=1 \
OPENAI_API_KEY=<key> \
node scripts/verification/study-pipeline-live.mjs
```

## Two defects from the BCS2130 hosted attempt (20 September 2026)

The newest hosted attempt exposed two faults that have now been fixed. First,
four consecutive `factual-solve` calls recorded no usage, ran for 17–24 minutes
each and then died inside our own error handling with
`error.cause?.code?.startsWith is not a function`: an aborted or stalled request
surfaces a `DOMException` whose legacy `code` is a *number*, so the provider
classifier crashed over the failure it was meant to describe and the real error
never reached the draft. Classification now matches `cause.code` by value
(`providerErrorCode`), can never throw over the original failure, and preserves
its sanitized `x-request-id`; each call also carries an explicit per-call
deadline (`STUDY_GENERATION_LIMITS.callDeadlineMs`, default 420 s, overridable
with `STUDY_CALL_DEADLINE_MS`) that aborts the transport and the SDK together,
settles the abandoned call as an unknown-usage failure that keeps its full
reservation, and is backed by an explicitly-referenced abort controller in
`providerFetch` instead of a collectable `AbortSignal.timeout`; three identical
consecutive failures of one review step now stop the run with a saved error
naming that step. Second, the third chapter's single error finding named no
section, objective or question, so the combined patch path could not place it
and fell back to a whole-chapter rewrite costing about $0.56 — the largest
single cost in that chapter. Pedagogical and factual content review findings now
carry an explicit scope (a section id, objective id, question key, or `chapter`
for genuinely chapter-wide faults), deterministic quality rules name the
question or flashcard group they flag, and `locateReviewIssues` recovers an
unscoped finding by exact-matching its named ids or quoted evidence against the
chapter; only a genuinely chapter-wide or unlocatable finding still forces a
full rewrite. Each correction records its scope decision on the draft
(`correctionScopes`: patch or whole-chapter, the repair kind, its targets, and
the reason), so a pilot report shows which path was taken and why.

## Corrupt teaching-plan prose (BCS2130 attempt 24)

In the same bundle run, chapter `iui-input-reasoning-output-and-feedback` failed
review twice for one reason: its teaching plan's `gaps` list held a fourth entry
that was not prose at all but a fragment of JSON scaffolding (curly quotes
included), emitted by the objective-plan call and copied onto every draft of the
chapter. Both reviewers rightly flagged it, and each flag bought a whole-chapter
correction on gpt-5.6-sol — about $0.58 each, $1.16 of that attempt's $1.77 —
which had no way to rewrite a string it was never asked to touch. Our own
post-processing was not the cause and did not catch it either:
`stripUnsupportedEvidenceIds` only rewrites an entry that contains an
`e-<hex>` token, and the saved chapter carried no `evidenceIdRepairs`. A
deterministic pass now runs beside the other pre-review checks (invisible
control characters, duplicate identities and JSON keys, malformed maths
escapes): every caveat and teaching-plan gap/exclusion that is not coherent
prose — a `":"` key fragment, unbalanced brackets or double quotes, a JSON
opener, an entry truncated on `[`, `{` or a trailing comma — is repaired by
deleting only the corrupt scaffolding, or dropped outright when no sentence
survives, and every action is recorded on `chapter.proseRepairs` like
`evidenceIdRepairs` and `linkRepairs`. Ordinary punctuation (quoted phrases,
colons, parentheses, bracketed citations) is left byte-identical; across the 296
real gap/caveat/exclusion entries in the saved pilot artifacts exactly one entry
is flagged, the corrupt one. The repair runs at the chapter-acceptance point
(`prepareLesson`), on any pending chapter re-entering the review stage from a
saved draft, and the saved objective plan is kept in step so no later correction
is handed the corruption again. A chapter already saved as `review: 'failed'`
whose remaining error findings are all about this corruption is repaired and
re-enters review for free (`recoverFailedChapterByCorruptPlanProse`), including
when its correction allowance is exhausted: no model call, no counter reset, and
the matching stale findings are cleared from the cached factual and pedagogical
audits — exactly as the evidence-id hygiene recovery does. Any other error
finding still blocks it, and a chapter that never carried the corruption is
never eligible.

## Chapter output-limit recovery (BCS2130 course-bundle attempt)

The first draft of chapter `requirements-research-and-prioritisation` (52
evidence sources, 6 planned objectives, on `gpt-5-mini`) spent 44,685 input
tokens and hit the 32,000-token output cap with only 1,024 reasoning tokens:
genuine visible output, not reasoning burn. The run failed with the ordinary
output-limit error and saved everything up to that point; earlier chapters in
the same guide drafted fine near 19,800 output tokens. A first CHAPTER DRAFT
(never a correction, a source refresh or a student edit) that exhausts the
output cap now splits along its already-saved teaching plan instead of
failing outright, mirroring the mapping-batch recovery
(`splitMappingBatch`/`MAPPING_OUTPUT_RECOVERY_LIMIT`, `study-course-plan.mjs`)
and reusing the outline's own "· Part N" convention
(`splitChapterDraft`, `study-version-pipeline.mjs`). The plan's objectives are
divided into two halves; each half keeps its own objectives' complete
definitions (goal, prerequisites, cited evidence) and the scope/context
evidence the chapter already carried, so no objective or evidence ID is ever
dropped — verified directly against this saved draft: 6 objectives split 3+3,
52 evidence IDs split 45/12 with every original ID present in the union and
nothing outside the chapter's valid evidence universe. At most one split per
chapter (a produced half is marked and can never split again), and a split
that would push its guide over `GUIDE_CHAPTER_LIMIT` chapters fails safely
instead of breaching that cap. The split is committed onto the draft, so a
resumed run repeats the same two chapters; a draft already saved as `failed`
with exactly this error resumes straight into the split, before any provider
call, through the same `controlStudyGeneration('retry')` path used by both a
pilot resume and a hosted retry. Passed chapters and every other topic are
untouched.

The same chapter later failed a bounded correction with `objectiveCoverage.5.independentQuestionKeys (too_small)`: `prepareLesson`, the single acceptance point for every draft, a whole-chapter correction and a bounded patch alike, validated the strict chapter schema before `deriveObjectiveCoverage` recomputed coverage from the merged content, so a patch that never touches `objectiveCoverage` was rejected on the chapter's own pre-existing (in this case genuinely deficient) coverage rather than the truth of its current sections and questions; the fix derives coverage from the merged chapter first, so an untouched objective's links now survive a patch unchanged and only a genuine gap — like this one — is caught, and it is now caught by retrying the same step once with the validation error, then routing it through the ordinary correction budget instead of crashing the run.

## Contract-first pipeline and the chapter-5 resume path (22 September 2026)

The pipeline now implements the ordered plan from the 22 September diagnosis:
plan-time blueprint validation, drafting against the contract, a free
mechanical repair plus an additive structural fill, and corrections validated
on the merged chapter before acceptance. See `GUIDE_GENERATION_ECONOMICS.md`
for the order and the question-only correction A/B trial. None of it has run
live yet, and no saving is claimed.

A zero-cost replay against the saved live-account draft showed the following:

- Chapters 1–4 raise no contract finding and stay passed.
- Chapter 5's only saved error is `obj-5` (difficult) lacking guided and
  transfer practice.
- On `controlStudyGeneration('retry')`, the new
  `recoverFailedChapterByStructuralFill` recovery (after the four existing
  ones) moves chapter 5 into the structural fill for `obj-5`. No counter
  changes: automatic corrections stay 3/3 and no manual correction is
  recorded. The saved review judgments for unchanged items are preserved.
- Rebuilding the round-3 edit with `obj-5` reset to `simple`, the merge
  validator rejects the upgrade as a regression.
- The round-3 scope finding would now patch only the scope fields, without
  shipping the whole chapter.
- The prose gate flags the 7 corrupt `gaps` entries in the attempt-4 plan.

For the measured run, set the base model to `STUDY_PIPELINE_MODEL=gpt-6-astra`
as before, with this route profile:
`{"version":1,"routes":{"teaching-plan":"gpt-5-mini","teaching-plan-check":{"model":"gpt-5-mini","reasoning":"low"},"authoring":"gpt-5-mini","structural-fill":"gpt-5-mini","pedagogical-precheck":"gpt-5-mini","factual-review":"gpt-5-mini","pedagogical-review":"gpt-5.6-sol","correction":"gpt-5.6-sol","question-correction":"gpt-5-mini"}}`.
For the Sol baseline chapters, drop `question-correction`. Per chapter, the
draft records `planChecks`, `planSemanticLog`, `planProseRepairs`, `structuralFillLog`,
`mergeValidations`, `correctionTrials` and `reviewRounds[].calls`. The pilot
report's `callDetails` also carries the trial, re-prompt, re-plan and fill
markers.

## GPT-6 Sol target-pipeline pilot (23 September 2026)

GPT-6 Sol began this pilot as an opt-in model. Its verified standard price is
$2 input / $10 output per million
tokens, half the corresponding GPT-5.6 Sol rates. The pilot kept GPT-5 mini for
the plan gates, pre-checks, factual review and question-only corrections, and
used GPT-6 Sol at medium reasoning for drafting, pedagogical review and other
corrections.

The first controlled redraft retained a plan made before the current semantic
gate. The GPT-6 Sol draft reduced the first pedagogical review from the mini
baseline's 23 errors to 7, but the plan itself required administrative course
facts and silently chose between contradictory current evidence. After one
whole-chapter correction the second review still returned 9 errors. This was a
plan failure, not useful evidence that another chapter rewrite would converge.

Plan pre-check version 3 therefore rejects administrative or exam-policy
objectives and unresolved same-edition conflicts. A new gate version gets its
own bounded re-plan allowance, so attempts spent under an older rule set do not
cause an immediate failure. The isolated pilot can rewind one non-passing
chapter to its retained plan with `STUDY_PIPELINE_REDRAFT_TOPIC`; the optional
`STUDY_PIPELINE_REDRAFT_MAX_CORRECTIONS` limit makes a correction target
enforceable rather than observational.

The repeated redraft exercised that new gate. It rejected and re-planned the
old objective before authoring, then passed after exactly one correction round:
one GPT-6 Sol section patch and two GPT-5 mini practice calls (the second was a
merge-validation re-prompt), followed by clean factual and pedagogical reviews.
The first full review contained two localized errors and the second contained
none. Measured cost was $0.578993 across 19 calls: $0.029617 for plan checking
and re-planning, $0.213798 for drafting, $0.157076 for the first review cycle,
$0.056117 for the three bounded patch calls, and $0.122385 for the final review
cycle. This meets the at-most-one-correction target and narrowly misses the
approximately-$0.50 cost target. It is one chapter, not yet evidence of a
stable course-wide rate; the next experiment should repeat the same frozen
profile on fresh chapters rather than tune against this result.

That frozen continuation then produced three untouched derived chapters from
two new topics (both topics were split by the existing pre-draft size gate).
All three passed with the one-correction ceiling unchanged: requirements and
prioritisation part 1 used no correction, part 2 used one correction round, and
elicitation-methods part 1 used one. Total measured cost was $1.418856, or
$0.472952 per passed chapter on average. Allocating each parent topic's shared
planning cost equally across its derived parts gives $0.327599, $0.641848 and
$0.449410 respectively. The correction target therefore held for 3/3 fresh
chapters and the average cost met the approximate $0.50 target, but the target
did not hold chapter-by-chapter: part 2 was expensive because the mini practice
patch needed a GPT-6 Sol fallback and two additional review cycles.

Part 2 initially stopped on its final review because a scope patch preserved
two real gap sentences with an empty generated suffix, `Sources: and.`. This
was the only remaining error; both teaching findings were already resolved.
The deterministic corrupt-prose pass now removes that suffix while retaining
the preceding sentence (or drops the entry when no sentence remains), records
an `empty source placeholder` repair, and recognises the matching stale review
finding. Resuming the saved failed chapter repaired and recovered it without a
new correction or full review cycle. The conservative pilot ledger after these
runs is $40.278892 of the $50 ceiling.

### Production-standard decision

The measured profile is now the default for new hosted OpenAI guides. GPT-6
Sol at medium reasoning handles authoring, pedagogical review and correction;
GPT-5 Mini handles bounded mapping, planning, checks, structural fill and
factual review. Existing jobs keep their selected model, and personal-key,
local-agent, assessment and unrelated calls are unchanged.

The standard profile omits the Mini-first `question-correction` route. That
experiment remains available through an explicit operator profile, but its
failure on requirements part 2 caused a Sol fallback and two extra review
cycles. Sending question patches directly to Sol is the next measured roadmap
step: preserve the one-correction result while reducing the observed cost
variance. The next fresh continuation should compare per-chapter cost and
review-call count against the $0.472952 three-chapter baseline.

The first production-profile continuation passed two fresh chapters before a
third stopped at the plan gate. Requirements elicitation part 2 passed with no
correction for $0.279563. Design intent, mental models and trust passed after
one whole-chapter correction for $0.737011. The third chapter spent $0.069899
on planning only and made no Sol draft: its rejected practice shrank from nine
semantic findings to three and then two, but each re-plan substituted a new
unsupported mechanism. Total incremental cost was $1.086482 across 35 measured
calls; the cumulative conservative ledger is $41.365374 of $50.

Plan pre-check version 4 carries every prior semantic rejection into later
re-plans, forbids replacement tasks from inventing new logs, tools, persistence
policies, algorithms or runtime behavior, and permits an objective to be
lowered to simple when its evidence cannot support a genuine transfer. The
cheap narrowing allowance is three re-plans; a fourth failed check still stops
before authoring. The continuation resumed the failed plan under that new gate;
its second constrained re-plan passed, so the third chapter drafted and passed
after one two-patch correction. Including the earlier failed-plan spend, that
chapter cost $0.466530.

Across the intended three fresh chapters, correction counts were 0, 1 and 1;
the total was $1.483104 and the average was $0.494368. The one-correction and
average-cost targets therefore held for 3/3, while the per-chapter $0.50 target
held for 2/3. The cumulative conservative ledger is $41.762005 of $50.

The remaining $0.737011 outlier exposed an exact correction-routing bug. Its
sole finding named both a faulty transfer question and its remediation target,
but intentionally had no single `itemKey`. The question patcher supports that
two-item diagnostic repair; the multi-patch dispatcher rejected it before the
exact-ID locator ran and bought a whole-chapter rewrite instead. Exact chapter
question IDs are now accepted as a bounded location, and the scope ledger names
the selected patch targets. A no-provider replay of the saved finding selects
one practice patch over the transfer and linked remediation questions.

The next three untouched chapters validated that corrected routing. Core
usability part 1 passed after one bounded practice patch for $0.374003 after
allocating half of its parent topic's shared $0.023215 plan cost. Part 2 passed
without correction for $0.239510 on the same allocation basis. Heuristics and
usability inspection passed after one two-patch section/scope correction for
$0.685757. There were no whole-chapter rewrites and no Mini-to-Sol correction
fallbacks. The segment cost $1.299269 across 43 measured calls.

The heuristics outlier spent $0.147607 on planning: its first structured plan
needed the one format retry, then the semantic gate narrowed five findings to
one, one and zero across all three re-plans. It made no unsupported Sol draft.
This is remaining cost variance, not a correction-count failure.

Across six fresh standard-profile chapters, correction counts were 0, 1, 1,
1, 0 and 1. All 6/6 met the at-most-one-correction target. Total cost was
$2.782373 and average cost was $0.463729; 4/6 chapters were individually below
$0.50. The cumulative conservative pilot ledger is $43.061274 of $50. The
pipeline has therefore reached the stated aggregate target. The next roadmap
work is variance reduction, chiefly plan retries and the cost of a focused
second review, without relaxing the evidence or acceptance gates.

### Variance-reduction continuation and final target result

The next continuation made GPT-6 Sol the standard model wherever the pipeline
needs generative teaching judgment: authoring, pedagogical review, correction,
and the final repair/arbitration path for a plan that exhausts its cheap
narrowing retries. GPT-5 Mini remains standard for bounded mapping, ordinary
plan generation and checks, structural fill, pre-checks and factual review.

Plan retries now send the saved proposal, cited evidence and exact accumulated
findings instead of rebuilding the full course packet. In the measured run,
the compact retry prompts were 15,604–22,014 characters; the comparable earlier
prompts were 142,071–156,652 characters, a reduction of roughly 85–90%. Three
Mini narrowing attempts remain available. If all three fail, the pipeline may
make at most two compact GPT-6 Sol repairs, each followed by an independent Sol
arbitration. It still fails closed if the last arbiter reports an error.

The continuation also found and fixed two state-recovery defects rather than
masking them with model calls:

- A later practice patch reapplied the originally saved plan and could silently
  undo an accepted objective-plan patch from the same correction round. Patch
  series now carry the current merged plan forward, and an integration test
  covers the objective-then-practice sequence.
- Malformed invisible control characters in previously generated text could
  survive every model rewrite because the relevant plan text was immutable to a
  chapter correction. A deterministic rendering-hygiene pass now repairs the
  observed arrow/hyphen corruption, records `renderRepairs`, and reopens any
  saved render-only failure without consuming a correction. Recovery searches
  for an eligible later chapter instead of being blocked by an older genuine
  failure.

The measured continuation spent $2.642884, moving the cumulative isolated
ledger from $44.827543 to $47.470427 of the $50 ceiling. Its final report has
18 passed chapters and zero failed chapters. The newly exercised target cases
were:

- IUI sensing, reasoning and feedback parts 1 and 2: both passed with zero
  corrections. Part 2 exercised all three compact Mini re-plans, two bounded
  Sol plan repairs and their arbiters before its first draft; the draft then
  passed without correction.
- User and context modelling part 2: passed with one bounded practice
  correction. Its post-patch review reused unchanged factual-content results
  and reran only the necessary factual-answer and pedagogical checks.
- User and context modelling part 1: after free recovery from the obsolete
  rendering failure, one real linked-question finding was fixed by one bounded
  question patch and focused review.
- Prototyping and inspecting intelligent behaviour part 2: after replaying the
  historical correction under the state-carrying fix, one remaining local
  follow-up error passed after one bounded practice patch and focused review.

The last two chapters retain inflated historical correction counters because
their saved attempts include calls made before the state and rendering fixes;
they are recovery evidence, not clean cost samples. The clean new chapters
still meet the target of at most one correction, and no target case required a
whole-chapter rewrite or a weakened acceptance rule. The remaining budget is
$2.529573. Further paid work should be reserved for regression sampling rather
than more architecture changes unless a new failure mode appears.
