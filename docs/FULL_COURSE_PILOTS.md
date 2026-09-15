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
