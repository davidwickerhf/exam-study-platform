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
`{"version":1,"routes":{"source-mapping":"gpt-5-mini"}}`.
This is configuration syntax, not an evaluated model recommendation. Allowed
phases are `source-mapping`, `course-outline`, `teaching-plan`, `authoring`,
`factual-review`, `pedagogical-review` and `correction`.

Routing applies only to platform-billed OpenAI guide checkpoints using Agents SDK
+ Responses. Personal-key model selections, local-subscription execution and
unrelated AI calls are unchanged. Unsupported providers/models, malformed profiles
and any route with higher input/output pricing fail before a provider call. Each
reservation and settlement uses the actual routed model; routing does not raise
any cap or add automatic fallback/retry calls. Model-route metadata accompanies
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
