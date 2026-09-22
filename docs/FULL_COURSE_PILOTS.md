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
