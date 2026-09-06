# Academic document verification

Academic Work and transcripts are independent evidence. A merged workspace is
never proof that two documents agree. The register retains derived source rows
and validation results, not the original PDF, extracted prose, name or student
number. Old imports without source rows must be read again to be corroborated.

Supported Maastricht text exports use deterministic parsers. Academic Work uses
one parser in both upload paths. Known layouts reject unread result rows,
invalid dates/years, inconsistent grades/status/credit awards, duplicate rows,
and an explicitly labelled earned-credit total that disagrees with unique
passed courses. Partial credit awards are stored separately from attempted ECTS.
Current enrolments do not require a matching transcript result. Failed and
superseded electives remain in history without earning credits.

The comparison matches course code, or an exact normalized title (including
AI / artificial intelligence), then academic year, outcome, grade and credits.
It reports agreements, conflicts, ambiguous sittings and results only present in
one source. One undated result cannot confirm multiple dated attempts. Missing
historical failures or different publication dates may explain gaps; these are
not silently called confirmed. This compares academic facts, not document
authenticity or student identity.

Transcript changes remain reviewable. Conflicts and unsupported/model-assisted
layouts require explicit selection. A server-stored review binds the inspected
source and changes to the account, programme, revision and one-hour expiry;
client metadata cannot manufacture corroboration. Source removal clears its
independent evidence and pending reviews. Academic Work's direct import refuses
conflicting source results before writing a snapshot.

There is no PDF page-count cutoff. Every page is read sequentially; unread pages
are reported. Browser PDF resources are released after reading. Files retain the
15 MB upload bound. Supported text parsing accepts up to two million characters;
model-assisted layouts retain a smaller explicit capacity. Exceeding a capacity
is an error, never a successful partial import. Unsupported layouts and scans
cannot be given an automatic correctness guarantee.

Inspect `/app/setup?step=record`, `/app/setup?step=transcript`, and the document
review in `/app/planning`. `GET /api/academics/document-check` returns the saved
source comparison. The UI uses Wicker's DESIGN.md canvas, type and hairline rules;
Refero's Vectary document reference informs only the compact metadata hierarchy.
Comparison details open in a side panel with disagreements first.

Setup keeps document collection independent of comparison. A saved Academic Work
record offers Continue to transcript; a saved transcript offers the next outstanding
step. Either document can be skipped. A single source supplies its own credit total
but produces no cross-document comparisons or artificial unmatched-result counts.
The saved comparison is shown after both attachments exist and never gates Continue.
Proposed changes and comparisons open in separate side panels with a fixed close
action. The setup card retains its file summary, Apply and Continue actions without
expanding a long list. Selections survive closing a panel. The original PDF or text
file can be previewed from View document during the review; its bytes stay in the
browser for the setup session, including after saving. Existing imports offer a local-file chooser for preview without reimporting or changing saved results. Reloading releases local files. Academic Work historical curriculum changes and conflict evidence also open in side panels, and Continue appears before reconciliation details. The shared PDF renderer accepts a
local File directly, and setup parsing uses the same installed PDF.js worker.

Review validation compares nested values with strict structural equality. PostgreSQL
JSONB can reorder object keys, so serialized JSON text is not a valid integrity check.
Values, types, array order, owner/programme scope, revision and expiry remain checked.
Regression coverage includes the real browser record-to-transcript import/apply flow,
optional transcript skip/resume, a 40-result side-panel fixture with a real local PDF preview, and a PostgreSQL JSONB
round trip that accepts unchanged changes and rejects altered or stale submissions.
