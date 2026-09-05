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
Comparison details expand into paired source results with disagreements first.
