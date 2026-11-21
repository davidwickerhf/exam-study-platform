# Resumable local study review and paper imports

Guide compatibility is scoped to an explicit lesson-guide module list in
`study-generation-contract.mjs`; paper preparation/import modules no longer change
its fingerprint. Protocol and schema versions and a review-rule fingerprint are
exposed separately. A changed applicable contract reissues an outstanding request
without replacing its version, source snapshot, ready chapters or completed revisions.
Unaccepted stale uploads are rejected. Accepted identical receipts remain replay-safe
across deployments and are no longer trimmed after 240 steps.

Factual caches bind each solution/verdict to authored content, selected evidence,
relevant teaching/objectives and linked follow-ups, plus the prompt/schema/rules.
A card-only change retains unrelated solvers and answer checks. Generated display IDs
are not substantive dependencies; stable keys alone never justify reuse. Legacy
checks are adopted only against their exact original artifact at the compatible
review version. Factual packets contain at most 24 items and 48,000 artifact characters;
output exhaustion allows two smaller-packet recoveries. Teaching packets contain up
to four objectives, with independent contexts and explicit verdict coverage. Teaching
review retains broader chapter context as a prerequisite dependency, so a section
change may invalidate more teaching checks than factual solvers.

Factual findings and pedagogical findings feed one correction round. Broken links,
invisible control characters, duplicate identities/JSON keys and malformed math
escapes are rejected before model review. A preflight finding may schedule a correction
of the retained draft when the agent resumes; it never resets correction counters.
Previously passed chapters and completed revisions remain unchanged.

`study_generation_usage` exposes recorded tasks, phase/chapter groupings, available
client-reported tokens/cache/reasoning/credits/elapsed time and review-task projections.
Unknown fields remain null. Old trimmed/unclassified receipts do not reconstruct a
complete historical bill. `study_generation_budget` configures a review-task allowance;
new local guides default to 128, and existing guides keep their current allowance.
At the limit, no further reviewer packet is issued, with no hosted fallback or reset.
Deterministic cache reconciliation and guide completion still run at that limit.
This is a task budget, not a guarantee of an external subscription's dollar/credit bill.

## Private papers

1. `study_papers` / `study_generation_sources`: select exact originals.
2. `study_paper_start`: create a private local extraction with explicit page ranges
   for large papers and supportingSourceKeys for external original diagrams.
3. `study_paper_validate`: dry-run the parsed package with the current request ID and
   evidenceManifest.hash. It reports question ID, field and offending citation.
4. `study_paper_submit`: upload the same parsed data, then independently review the
   returned packet. Passing validated review activates the normal private paper set.

Stable parsed IDs, page/subquestion labels, paper-group identity, shared context,
options/labels, explicit marks and original/diagram dependencies are retained. Repeated
identical submissions do not duplicate questions. Generated worked explanations are
stored separately and cannot become official answer keys. Special negative option
scores do not silently use all-or-nothing grading.

A source/page binding can resolve missing chunk IDs, but ordinary text extraction
still requires matching original text (whitespace and typographic ligatures only).
Image-only or interrupted text requires explicit originalTranscription metadata bound
to the authorised original file's hash/page. It remains labelled client-transcribed,
requires the original and requires a separate originalChecks review. Private notes
cannot masquerade as original assets. Textless originals remain in the selected
manifest without fabricated chunks; transcriptions must fall within the selected
page range. Supporting diagram originals are retained and hash-checked too. This is client-reported visual verification,
not independent server-certified OCR. Metadata-only quiz exports remain missing bodies.

## Release evidence

The 2026-09-14 Intro to AI checkpoint identifies six existing guide IDs, 16/21 checked
chapters, three completed revision IDs, and one consumed neural-network manual retry.
No database schema migration is required for this update. A production Neon snapshot
was created before validation: `snap-nameless-credit-av87cu9a` on
`br-muddy-mountain-ave29n69`, project `square-waterfall-19487427`.
The isolated validation copy is `br-aged-glitter-avuk4q2r`.

Use `scripts/verification/study-resume-clone.mjs` only with the explicitly configured
clone host. It checks snapshot/ready-content/revision/receipt/manual-counter preservation,
old-contract rejection and resumable next packets. Its optional seed reads six primary
documents with SELECT only and writes exclusively to the clone. Run again in a fresh
process without seeding to verify restart behavior. The local checkpoint archive is
not substituted for the database snapshot.

Run `study-paper-import-dry-run.mjs` against the clone to inspect the actual 162-question
package without activating it. Selected collection pages remain 15 paper groups, not
15 complete exams. Text mismatches and missing indexed image bodies remain explicit;
no review verdicts or transcription attestations are fabricated by these scripts.
