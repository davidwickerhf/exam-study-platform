# Surface brief — `/app/setup`

## Job

Turn a new or incomplete account into a truthful personal study desk in roughly
five minutes. The activation moment is a saved programme: this creates the
course and academic-period frame and immediately makes the workspace useful.

## Flow

One focused, full-viewport workflow replaces both the workspace shell and the
previous conversation/checklist split. The signed-in shell explicitly returns
this route without its desktop sidebar, mobile header, or bottom navigation;
only the compact brand bar and the visible top-right escape action remain.

The server-owned step order is deterministic:

1. Study plan — programme (required), then current-period electives.
2. Academic record — Academic Work overview, then transcript.
3. Schedule — maintained academic calendar, then personal timetable.
4. Canvas — live assignments plus optional private course-material indexing.

The phase strip may open a phase directly, but it chooses that phase's first
unresolved, non-blocked source. After every successful save or deferral, the
surface refreshes server truth and advances to the first remaining actionable
step in the same order. Done means connected according to the server; connected
truth overrides an earlier deferral, and electives are blocked until a
programme exists.

The programme is the activation goal, but onboarding never becomes a lockout.
The always-visible whole-flow “Skip for now” action finishes the first-run gate,
enters `/app`, and leaves an honestly empty workspace without inferring a plan
or source. It is distinct from each optional source's “Do this later” action:
per-source deferral persists a skipped state, changes no academic data, advances
the flow, and leaves that source visible and reopenable in the register. Normal
Finish setup is visible from the start, disabled until the programme is saved,
and available immediately afterward even when optional sources remain.

## Assistant boundary

Programmatic controls and server state own the whole ordinary flow. Wicker is
not a parallel setup mode and never asks for credentials. It appears inline
only when the selected source has a server-reported conflict; the message route
rejects turns when no issue exists and may reopen a previously finished setup
only after a later sync creates an issue. Direct correction and evidence
comparison remain primary. The assistant receives the structured issue, not
credentials or original documents, asks only for the fact needed to distinguish
the conflict, and cannot present unresolved evidence as confirmed. If the model
is unavailable, correction remains usable and the claim remains unverified.

## Priority evidence

Canvas connection and course-material collection are separate permissions. With
collection enabled, the durable worker refreshes the user's Canvas catalogue
daily and refreshes each observed course when its daily freshness window
expires. Active course jobs are unique per user and Canvas course binding.
Failed work retries at bounded delays; after the terminal failure, automatic
rescheduling observes a six-hour cooldown by default instead of hammering the
same source.

Each course refresh versions accessible material, extracts and indexes chunks,
then queries only passages likely to carry assignments, group projects,
presentations, scoped attendance requirements, submissions, deadlines, exams,
minimums, pass rules, or resits. Syllabi and requirement sources rank ahead of
assessments, slides, activities, pages, and general material. Every accepted
attendance rule and assessment component retains valid chunk provenance; the
per-user result is cached by evidence hash as `confirmed`, `needs-review`, or
`not-found`. If structured extraction is unavailable or sources conflict, the
scan becomes `needs-review`, surfaces as a Setup issue, and supplies no
rule-backed Home obligation. A published human-confirmed profile remains
authoritative over a private scan.

Canvas assignments reconcile only with confirmed course components whose kind
is compatible and whose substantive title terms overlap. A genuine match
collapses into one Home row labelled with Canvas and verified-rule provenance.
If their dates disagree, that same actionable Canvas row is marked as a rule
conflict rather than duplicated; a weak match that shares only generic wording
stays separate.

Revoking material collection records a revocation time, cancels pending jobs,
prevents future scheduled collection, and immediately excludes derived scans
from the workspace and conflict feed. Community candidates return to private;
already accepted contributions become withdrawn with an audit note. Existing
private stored material is retained rather than silently deleted and requires a
separate account-data action to remove.

## Visual system

- Warm board canvas, white working plane, near-black ink, one indigo signal.
- Four-phase full-width route; status is a mark, not a rainbow.
- The active task owns one near-black header band, matching Home's “Now”
  hierarchy. Inputs remain white working surfaces; indigo is reserved for
  actions, focus, and selection rather than filling fields.
- All dividers run to the edge of their owning plane. Content padding lives in
  child bands; inset half-rules are avoided.
- The Source register is compact evidence/navigation, not a second sidebar or
  a StudyMap; no decorative inline SVG substitutes for it. On desktop it
  occupies the 20rem right column and begins level with the active task plane;
  on mobile it follows the task plane in document order.
- The global workspace sidebar and mobile navigation are absent during setup.
  A small brand bar and top-right escape action are the only shell.
- Desktop uses a broad task plane plus the 20rem Source register column; mobile
  keeps the phase route first, then stacks the task plane and Source register
  without shrinking controls.

## States to preserve

- loading, API failure, secure-input failure, file-parse failure;
- blocked electives before programme;
- connected, deferred, and not-connected as distinct states;
- transcript proposals requiring explicit selection;
- priority conflicts with direct correction and contextual assistant;
- extraction unavailable, `needs-review`, `not-found`, matching-rule, and
  deadline-conflict priority states;
- material collection enabled privately, enabled for reviewed community reuse,
  revoked, refreshing, cooling down after terminal failure, and manually
  refreshed;
- already-complete accounts that may review or change any source.
