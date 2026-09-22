# Guide generation economics and maintenance

Decision, 15 September 2026: set the new-student hosted allowance only after
measured pilots. The isolated pilot ceiling is a test budget, not a product
allowance. Existing configured billing limits are unchanged by this change.

## Product workflow

1. Collect authorized Canvas materials and detect changes using stored source
   identities/hashes. Unchanged daily checks should not regenerate guides.
2. Determine module boundaries and readiness from course evidence. Preserve
   current-year exclusions, source gaps and provisional historical coverage.
   Textbook-led courses need the assigned readable chapters; slides or a textbook
   title alone do not establish complete teaching evidence.
3. Generate and review a bounded module guide. Use a deterministic coordinator
   with persisted step state, compact receipts and bounded packets. Keep source
   packets on disk for local agents instead of appending them repeatedly to a
   growing coordination conversation.
4. Publish only after factual and pedagogical checks pass. Retain the readable
   revision during corrections and source updates.
5. On changed sources, revise the affected guide from its saved content. Preserve
   omitted sections/questions; validate the resulting complete artifact. Reuse
   checks only when their content, dependencies and applicable rules still match.

This is the intended default product path; it is not a claim that every step is
fully automatic for every course. Readiness uncertainty and missing textbook
content must remain visible rather than being filled with unsupported claims.

## Implemented maintenance path

`study_guide_maintenance` / `POST /api/study-versions/maintenance` enrolls an
existing completed **local** guide by version ID, expected active revision ID and
explicit current-edition Canvas module bindings. Call with `dryRun: true`, inspect
selection, then submit `dryRun: false` when enrollment is authorized. It does not
create a duplicate guide, convert local execution to hosted AI, or spend credits.

Enrollment is independent of automatic creation of new module guides. Global
recurring-guide pause and Canvas refresh/access permissions still apply. The
same tool can disable maintenance while a local revision is unfinished, without
clearing that revision. Course status includes maintained entries; recurring
activity includes maintenance events. There is no dedicated enrollment editor in
the settings UI yet.

New module materials and course announcements join the baseline selection.
Withdrawn or unreadable sources require attention. Unfinished work is preserved;
a subsequent check can process additional changes after it finishes. The active
revision stays readable until the replacement passes. A disconnected local
agent leaves the work waiting; it never triggers hosted fallback.

Source refresh uses explicit section/question patches with stable identities.
Exact unchanged passages may have citations rebound by source, page and text.
Changed passages are not rebound by guesswork. Required citation, coverage,
rendering, factual-solving and teaching checks still apply.

## Cost controls and remaining limits

Review hashes now canonicalize object keys, so a JSONB persistence round trip
cannot invalidate unchanged checks solely by reordering fields. Arrays retain
order. Located warnings can be repaired with errors in the same bounded patch;
stored severity and review provenance remain unchanged.

Source-review dependencies remain conservative: changed chapter evidence can
invalidate all checks within that chapter. This release does not claim minimal
citation-level invalidation, concurrent local packet leases, or lower prices
from switching models. These are separate measurable optimizations.

The reported local Intro to AI run is a subscription resource audit, not a
hosted per-student bill. Its long coordinator contexts account for a substantial
part of its API-equivalent estimate. Do not extrapolate its total or a single
small hosted fixture to every course.

Before setting a default allowance, measure:

- Initial generation across several representative courses: compact slides,
  mathematical/code-heavy material, and textbook-led modules.
- No-change refresh, one changed card, changed source/scope announcement and
  incomplete current-year material with historical supplements.
- Total paid/uncached/cached input, output (including separately reported
  reasoning), calls, correction rounds, elapsed time and accepted chapters.
- Quality failures and spending-limit pauses, including interrupted calls with
  unknown usage. Unknown usage stays unknown and retains its reservation.

Choose the allowance from the distribution of accepted outcomes and the intended
product margin. Add explicit course-level admission/reservation across all guides
and maintenance before advertising a first-course spending guarantee. Current
per-job and account protections must not be described as that course-wide limit.
Keep local subscription execution and its unknown monetary bill separate.

Any future shared artifact reuse must respect Canvas access, private ownership
and sharing consent. Content deduplication is not permission to share private
course files between students.

## Implemented economics changes after the stopped pilots

The full-course experiments are paused after their current paid responses were
saved. Stopped measured totals: Blockchains $30.302604 and IUI $26.502596, plus
Blockchains' earlier $1.200650 unresolved reservation. Neither full-course bundle
nor its live update experiment finished. These totals include experimental retries
and optimization; they do not establish a production course price.

### Private course concept index

`study-course-plans` stores validated source-map batches and registered guide
outlines per account, programme, course, edition and period. Compatible subsequent
guides reuse complete matching batches and map only remaining evidence. Cache
identity includes extracted content, source provenance, current scope, mapping
rules/schema and execution mode. Local maps cannot become hosted-trusted maps.
Source access is checked by the pipeline before cache use. Existing in-progress
mapping boundaries and authored/reviewed chapters remain intact. Old artifacts
without this provenance are not silently backfilled into the shared cache.

The index reports named concepts and their guide/chapter assignments through
`study_generation_usage` (`coursePlans`). Exact name overlaps are potential duplicate
responsibilities, not proof of redundant teaching. Nothing is discarded solely
because names match. This is a shared index of accumulated evidence maps and
outlines, not yet an automatic whole-course curriculum planner that resolves
semantic overlap across all modules before any guide begins.

Each new outline returns its chapter/task baseline and overlap findings in
`planning` on guide status and local next/submit responses. A fresh local outline
whose first-pass review requirement exceeds its existing review-task allowance
pauses before authoring. Its outline remains saved; explicitly changing the task
allowance can resume it. Refreshes and partially authored runs retain their
existing correction/reuse behavior. The baseline is not a dollar forecast or an
upper bound; payload splits and corrections add tasks, and cache reuse can reduce
them. Hosted dollar limits remain enforced by the existing reservation ledger.

### Focused reviewer evidence

Blind solvers, answer checkers and teaching reviewers receive evidence selected
from cited sources, objective prerequisites, relevant teaching and linked
follow-ups. Complete available surrounding passages from each selected source
remain, as do all chapter scope-context passages. Ambiguous or missing annotations
fall back to the complete chapter evidence. Unrelated source descriptors are
omitted. Blind reviewers still cannot see authored answers, hints or teaching;
selection uses their references without exposing that authored text. Semantic
criteria, per-item verdicts and source-change cache invalidation remain.

Offline comparison on nine saved pilot chapters found solver prompts 4.4–17.3%
smaller for whole-chapter batches and 6.1–34.7% smaller for single-question batches.
These are character measurements, not live quality results or dollar savings.
They demonstrate that input trimming alone will not solve the course economics.

### Phase-specific model routing, disabled by default

An operator can configure `STUDY_MODEL_ROUTES` as a versioned JSON profile:
`{"version":1,"routes":{"source-mapping":"gpt-5-mini"}}`. A route value may also
be an object that additionally selects the phase's reasoning effort:
`{"source-mapping":{"model":"gpt-5-mini","reasoning":"low"}}`. Only the efforts
the OpenAI provider layer accepts (`minimal`, `low`, `medium`, `high`) are
allowed; anything else fails before a provider call, and the effective effort
actually sent is recorded in the route metadata.
This is configuration syntax, not an evaluated model recommendation. Allowed
phases are `source-mapping`, `course-outline`, `teaching-plan`,
`teaching-plan-check`, `authoring`, `structural-fill`, `pedagogical-precheck`,
`factual-review`, `pedagogical-review`, `correction` and `question-correction`.
`structural-fill` and `question-correction` fall back to
the `authoring` and `correction` routes when a profile leaves them out.

Routing applies only to platform-billed OpenAI guide checkpoints using Agents SDK
+ Responses. Personal-key model selections, local-subscription execution and
unrelated AI calls are unchanged. Unsupported providers/models, malformed profiles
and any route with higher input/output pricing fail before a provider call. Each
reservation and settlement uses the actual routed model; routing does not raise
any cap. The only automatic fallback is the opt-in question-only correction
trial described below, which falls back to the ordinary correction route. Model-route metadata accompanies
usage metadata. No profile has been enabled as part of this change.

The isolated pilot client supports the same policy via
`STUDY_PIPELINE_MODEL_ROUTES`, recording each call's actual model and pricing mixed
models correctly under the cumulative course ledger. Existing pause files still
prevent paid continuation. Before enabling a profile, compare it on grounded
teaching, independent solving, source conflicts and deliberately shallow lessons;
passing mock-provider routing tests is not evidence of model quality.

## IUI correction-path findings

The fresh nine-guide IUI experiment stopped on its first chapter after the three
automatic corrections: $6.685974 measured across 35 calls, with no accepted
chapters. Mapping/outlining accounted for $1.675264; this is not a completed
chapter or course price.

Two implementation defects were found in the saved failure. Scope review could
flag objective goals/basis while the repair schema allowed only exclusions,
gaps and caveats. Combined repairs also discarded the specialized transfer and
diagnostic repair directives. Objective repairs now retain stable IDs and
complexity while allowing supported goal/provenance changes, and persist the
updated plan through MCP submission and chapter preparation. Combined packets
carry each selected directive once with one source context and chapter body.
Unselected fields remain unchanged and independent review is still required.

Large repair schemas now share identical citation enums through JSON Schema
`$defs`, preserving exact constraints and local evidence validation. The saved
IUI combined repair schema fell from 82,499 to 26,026 characters; its conservative
Sol reservation fell from $3.793530 to $1.774400. This removes repeated schema
text, not course evidence or review criteria. The first reservation was rejected
before any provider call under a $3 additional validation cap.

The bounded live repair made five calls for $0.833248, retained 14 unchanged
factual judgments after repair, and stopped before Astra teaching review because
its $3.739738 reservation exceeded the remaining $3 segment allowance. Factual
review still found truncated objective/learning-goal wording. The goal ceiling
has since increased from 180 to 400 characters, with explicit complete-sentence
and caveat-disclosure instructions; that subsequent change has offline regression
coverage but no additional paid validation. No chapter was approved. Cumulative
IUI measured spending is $34.332206, leaving $15.667794 under the unchanged $50 cap.

These fixes are not evidence of model-quality parity or affordable course
completion. The three consumed automatic retries and one explicitly requested
manual retry remain recorded; the full-course run is paused.

## Review locations and split chapter responsibilities

The next live IUI repair cost $1.247918 across five measured calls. Its diagnostic
follow-up passed, but a rewritten objective introduced another attribution error;
no chapter passed in that attempt. Cumulative measured spending reached $36.106184.
The implementation now keeps item-level review locations when attaching findings
to a chapter, and recovers lost locations only from an exact saved finding. An
explicitly identified objective repair exposes only those objective keys; generic
blocking scope findings retain broad repair access. Unselected objectives are
preserved automatically. These changes do not alter retry counters or verdicts.

Outline consolidation now retains each mapped concept's supporting evidence.
When evidence capacity requires multiple chapter parts, each part receives its
supported concepts instead of copying the entire parent's responsibilities.
Scope-only concepts belong to the first part while scope evidence remains in every
part. All evidence survives; legacy authored plans stay intact. Changed concept
support invalidates reuse, while a redundant single-concept annotation preserves
legacy input hashes. This addresses within-guide duplication, not yet semantic
overlap between independently selected guide bundles.

The course pilot supports `STUDY_PIPELINE_PLAN_ONLY=1`: it maps/outlines every
initial guide and stops before authoring. Planning uses the same cumulative ledger,
provider caps, isolated account and resumable version IDs. `planningComplete` is
separate from `complete`; planned guides and missing top-up tests never count as
finished output. Inspect all guide outlines and overlapping responsibilities before
resuming without the flag. Planning-only mode rejects correction/recheck/update
flags to avoid accidentally changing authored work during a planning audit.

A subsequent five-call correction cost $1.108752 and passed its factual checks,
but teaching review found that the revised immersive-interface criterion no longer
matched a linked remediation prompt. Cumulative IUI spending reached $37.214936;
there was still no accepted chapter. Objective-level reviewer locations now select
the objective's teaching and practice together, within the existing bounded patch
limits. Large or unlocated findings still require a broader correction. Saved
review locations, severities and actual findings are retained rather than guessed
from similar wording.

Final checkpoint for this iteration: $38.363684 measured, $7.654250 unresolved
provider reservations, $46.017934 committed under the cumulative $50 ceiling.
The latest coherent repair still failed source interpretation review; it does
not establish a stable or affordable course. Paid continuation is paused. A
zero-cost planning checkpoint preserved the draft byte-for-byte and correctly
reported planned rather than generated. Further design work must resolve shared
course-context versus guide teaching responsibilities before another full-course
baseline; the present split fix does not solve cross-guide semantic ownership.

Batch teaching-review findings are also scoped to their exact objective, question
or section ownership before saving/reusing objective checks. A located defect no
longer marks every objective in that review batch as defective. Unknown and
course-wide findings remain shared; dependency fingerprints still reject changed
inputs. Existing saved batch rows are scoped on read without discarding the
original review artifact. This reuse fix has regression coverage, including old
rows with duplicated findings, but has not been included in another paid IUI run.

## Measured per-chapter split and the three cost changes (not yet re-measured live)

The newest saved IUI attempt (`guide-1-initial-attempt-21.json`, chapter
`iui-foundations-scope-and-hci-part-2`) records a reviewed chapter at about
$0.60 for its first round: teaching plan 21,648 in / 4,681 out and draft 24,817
in / 12,664 out on gpt-5-mini ($0.046), three factual review calls on gpt-5-mini
($0.025), pedagogical review 19,632 in / 5,529 out on gpt-5.6-sol ($0.189), and
a whole-chapter correction 35,663 in / 10,045 out on gpt-5.6-sol ($0.344).
Output tokens on the correction model dominate: the correction alone is roughly
60% of the chapter.

Three changes target that shape. Bounded repair now also patches named teaching
objectives, so a mixed finding set produces one combined section + objective +
question patch instead of a ~10k-output whole-chapter rewrite; the section bound
is relative to chapter length, and a whole-chapter rewrite is still used when
findings span most of the chapter or cannot be located. The drafting and
teaching-plan prompts state the recurring, evidenced failure classes explicitly
(misconception follow-up targeting, genuine transfer, no unsupported mechanisms,
no internal evidence identifiers in prose, current-edition citation for the core
idea) so fewer chapters earn a correction at all. Pedagogical dependency hashing
is now scoped per objective over that objective's own sections, so a correction
re-reviews only the objectives whose teaching, practice, plan or evidence
changed; other sections still travel as read-only context.

Assuming a patch replaces roughly a quarter of the authored artifact (~2,500
output tokens instead of ~10,000) with the existing chapter still supplied as
input, and that a post-correction re-review carries one of three objectives, the
same first round would cost about $0.45 instead of $0.60, and the full two-round
trace recorded in attempt 21 about $0.77 instead of the $1.14 actually spent.
These are arithmetic projections over the saved call sizes only. No paid run has
been made since the change, so the saving is estimated, not measured, and the
quality effect of the added prompt rules is entirely unverified.

## BCS2130 chapter 4: judgment questions, patch packets and review rounds (not yet re-measured live)

In the newest saved BCS2130 bundle attempt, the chapter
`requirements-elicitation-and-specification` cost $1.93 and still failed after
three of three corrections. By phase: one whole-chapter correction $0.59
(62,782 input / 17,099 output tokens), forced by the deterministic finding
"Practice needs varied skills, …", which named no question; two practice patches
$0.52 (47,627 and 46,766 input tokens, although output fell to 4,676 and 2,398);
three pedagogical reviews $0.63; everything else $0.19. Two of the three final
errors disputed the blind solver's MoSCoW classification, not the lesson.

Four changes follow. Answer comparison now treats prioritisation, classification,
trade-off and "most appropriate" questions as judgments: a written or choice
question whose wording matches that pattern, or one the reviewer marks
`judgment: true` (never a calc, pseudocode or true/false question). A supported
key with a different but defensible solver answer (`defensibleAlternative`)
yields at most a warning. Only an unsupported key or a wrong justification is
still an error. Every answers issue now says whether it is `about` the authored
answer or the independent solution, and solver-only disputes are never chapter
errors. Bounded patches send the targeted items, their objectives, the teaching
they depend on, linked practice without answers, the evidence those cite, and an
id/title outline of the rest of the chapter, instead of the full chapter and
evidence. Replayed against the saved chapter and evidence (82 chunks, 105k
characters of evidence prompt, 85k characters of chapter), the round-2 patch
(8 questions after follow-up expansion) would send about 76k characters,
roughly 19k input tokens instead of 47.6k. The round-3 patch (2 questions) would
send about 29k characters, roughly 7k tokens instead of 46.8k. At $4 per million
input tokens that is about $0.27 less across the two patches. After a correction,
the next review is told which findings it must verify and which items changed.
New errors about accepted, unchanged questions or sections are held as warnings,
and passing transfer and follow-up rows are kept when their own dependencies are
unchanged. Changed content is still fully judged, and factual findings are never
relaxed this way. `draft.reviewRounds` records the resolved, carried and newly
introduced findings for each round. The practice-quality rule now names each
question missing a hint, objective or reasoned answer, and the locator also
matches single-quoted, plan and scope text and "Objective N". The patch
figures come from replaying the saved artifact, not from a live call. The
pedagogical-review saving and the quality effect have not been measured.

## Contract-first lesson pipeline (22 September 2026, not yet measured live)

The chapter pipeline now follows the order in the 22 September diagnosis.
Every deterministic check runs free before any paid call:

1. **Plan and practice blueprint.** The teaching-plan call also returns a
   per-objective practice skeleton (keys, stage, skill, difficulty, kind and a
   diagnosed misconception with its follow-up for every core question of a
   difficult objective). It is checked against the chapter contract before
   drafting; a failing blueprint is re-planned once on the plan route with the
   exact issues. Gap/exclusion entries that are leaked schema vocabulary or
   placeholders are dropped and recorded. A plan whose estimated draft exceeds
   the output budget is split along its objectives before drafting.
2. **Draft against the contract.** The draft prompt carries the rendered
   per-objective contract and the blueprint, and the response schema keys
   practice by objective and stage with the contract minimums, so a missing
   stage question or diagnosis cannot be emitted.
3. **Free repair, then structural fill.** Mechanical violations (duplicate
   identities, a missing first hint or objective, a reversed true/false pair)
   are repaired deterministically. A chapter that still lacks an item goes to
   an additive fill on the authoring route: it may only add keyed items for
   the named objectives, is validated on the merged chapter, is retried at
   most three times and never uses a correction slot.
4. **Review** is unchanged: factual review on its route, pedagogical review on
   its own route (gpt-5.6-sol in the pilot profile).
5. **Corrections that cannot regress.** Every correction is told the full
   contract for its packet. Replacement questions keep difficulty, skill and
   kind unless a finding names them. Scope and objective patches cannot
   change complexity, except that an explicit understated-complexity finding
   may upgrade an objective and add the practice it then needs. An unnamed
   scope finding patches only the scope fields. The merged chapter is
   validated before acceptance: a regression anywhere, or a targeted
   deterministic finding left unresolved, is re-prompted once and then
   discarded, keeping the saved chapter and plan. No review is bought for a
   rejected result. Review focus no longer holds back an error on an
   unchanged question whose dependencies changed.
6. **Scoped re-review.** Each round records its factual and pedagogical calls
   (`reviewRounds[].calls`), so re-review cost can be measured.

**Question-only correction A/B trial.** A route profile that sets a
`question-correction` route distinct from its `correction` route switches the
trial on. Question-only patches then try that route first. If the merged-chapter
validation (after its one re-prompt) or the scoped re-review rejects the
result, the same correction is redone on the `correction` route without
spending another correction. `draft.correctionTrials` records, per correction,
the first route, the route whose patch was accepted, whether a fallback
occurred and why, and the review outcome. Without the route there is no trial.
No saving has been measured yet. The only prior evidence on gpt-5-mini
corrections is negative (whole-chapter rewrites), so this is an experiment,
not a default.

**Prompt caching.** Retries, re-plans, fill retries and merge re-prompts re-send
the identical prompt with their note appended last, so a same-schema retry can
reuse a cached prefix. Cross-phase prefix sharing is not attempted: each phase
sends a different structured-output schema, and OpenAI documents the schema as
part of the cached prefix. Explicit gpt-5.6 breakpoints stay off. Their write
premium on every call would exceed the expected reads with today's
selective evidence packets. `cachedInputTokens` is recorded per call for the
next measured run.

## Multi-patch rounds and the cheap pre-review (22 September 2026)

The first fresh chapter under the contract-first pipeline had ten located
pedagogical findings. Its corrections converged without the old regressions,
but the mixed finding set exceeded one bounded schema and therefore bought two
whole-chapter rewrites at about $0.55 each.

Located mixed findings now become up to four non-overlapping patches in one
correction round. Each patch is applied to the working chapter and checked
against the complete contract before the next patch runs; the round consumes
one correction attempt. `STUDY_MAX_CORRECTION_PATCHES` may set a bound from two
to eight (default four). Chapter-scoped or unlocated findings, and a partition
over the cap, still use a whole-chapter rewrite. `correctionScopes[].partition`
records each part's kind, finding count, targets, planned and actual route,
fallback and outcome.

An offline replay of that chapter's first ten findings produces three patches:
one practice packet (12 questions including linked targets), one two-section
packet and one objective-plan packet. Based on their prompt/schema sizes and
the configured mini-first question route, the correction is estimated at
about $0.14 instead of the measured $0.55 whole rewrite; this is a projection,
not a measured saving.

A new opt-in `pedagogical-precheck` route runs once for each new chapter content
hash after deterministic checks and before the independent reviews. It sends a lean
view of objectives, visible teaching, questions and only cited evidence to look
for the four recurring faults: mismatched misconception follow-ups, untaught or
unsupported assessment, copied transfer, and incomplete objective teaching.
It returns located findings only. Those findings use the same bounded patches
as one free pre-review repair pass and do not increment the chapter correction
counter. It therefore checks both first drafts and merged corrections before
the expensive full review; a repaired hash is recorded so the check cannot
loop. The ordinary
factual review and full gpt-5.6-sol pedagogical review always run afterwards.

The first live mixed repair used one mini question patch and one Sol section
patch rather than a whole-chapter rewrite, but the full review found semantic
regressions: a shared remediation had been rewritten without seeing all of its
incoming misconceptions, and new assessment reasoning was not explicitly
taught. Patch packets now include the complete incoming misconception context,
teaching patches run before practice patches, and the pre-review runs again on
the merged correction. This run is diagnostic evidence, not a passing cost or
quality result.

The first clean chapter then exposed two earlier-stage causes. `reviewCalls`
accounting was accidentally included in the lesson-content hash, so every
factual checkpoint invalidated the precheck: 11 prechecks and four free repair
cycles ran around what should have been one precheck per actual content
revision. Review accounting is now excluded from that hash. The structurally
valid blueprint also broadened its source objectives into latency engineering,
fault localisation, online vector updates and high-stakes control design. The
new opt-in `teaching-plan-check` route reviews objectives and blueprint tasks
against their cited evidence before drafting. Blocking findings receive at
most two evidence-narrowing re-plans; a third failed check stops with its findings instead of buying a
known-bad draft and whole-chapter rewrite. `planSemanticLog` records the checks.

The next measured profile is:
`{"version":1,"routes":{"teaching-plan":"gpt-5-mini","teaching-plan-check":{"model":"gpt-5-mini","reasoning":"low"},"authoring":"gpt-5-mini","structural-fill":"gpt-5-mini","pedagogical-precheck":"gpt-5-mini","factual-review":"gpt-5-mini","pedagogical-review":"gpt-5.6-sol","correction":"gpt-5.6-sol","question-correction":"gpt-5-mini"}}`.

A clean-account target run then completed all 71 source-map batches for
$0.453056, but the segment guard refused the course outline before calling the
model: its prompt was 423,256 characters and conservatively reserved $4.99173.
The outline response contains mapped refs, never citation arrays or mapper gap
prose, while the resolver already restores both from the immutable maps. Bundle
outline prompts now send only each concept's ref, id and title; omit per-passage
capacity arrays already represented by the scope policy's per-concept sizes;
and leave the complete saved gap ledger to deterministic resolution. On the
same 363-concept checkpoint this reduces the prompt to 77,843 characters and
the full-call reservation to $0.88017 without changing the stored map, resolver
or response schema. The stopped outline made no model call.

A subsequent clean run exposed a second deterministic outline cost: three
proposals repeatedly placed the same mapped ref in two chapters. Bundle
resolution now retains the ref's first declared owner and removes later exact
duplicates before resolving evidence, recording each removal in
`deduplicatedRefs`. Unknown refs, omitted concepts and different refs that give
the same concept multiple guide owners are still rejected; only identical ref
placement is repaired mechanically.
