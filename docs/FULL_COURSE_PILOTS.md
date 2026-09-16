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
