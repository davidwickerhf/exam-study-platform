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
