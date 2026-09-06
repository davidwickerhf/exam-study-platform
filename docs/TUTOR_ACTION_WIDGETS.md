# Tutor answers and proposed actions

Catch-up and planning answers now use a structured response: a short summary,
ranked priority widgets, expandable course recovery rows, optional supporting
explanations, and ready-to-copy email drafts. Concept explanations retain full
Markdown and mathematics and do not need widgets.

The Tutor is instructed to stage useful existing actions while answering a
requested recovery plan. It must use `propose_calendar_action`,
`propose_practice_set`, `propose_remember_plan`, or `propose_planning_update`;
response JSON cannot introduce executable actions. Priority links are filtered
against proposals actually returned by the tools. Approval still runs through
the existing stored-proposal endpoint. Email drafts have a separate copy flow;
there is no email sending integration or implied delivery.

Urgency is explicit (Act now, Coming up, Catch up). Dates distinguish deadlines
from proposed study days. Uncertain attendance/exception rules remain visible.
The prompt forbids speculative informal exceptions and treating a future quiz
as already missed. These are generation instructions, not a guarantee that a
model will never misinterpret a source.

The schema is passed through both normal model rounds and the reserved final
answer round, without adding a formatting model request. Invalid structured
answers fail through the existing visible retry flow. Complete plain text is
stored alongside presentation data for copying and account-scoped chat recall.
Legacy answers still render as Markdown. Existing messages are not regenerated.

The Proposed Actions panel supports priority-to-action focus, selection,
approval, dismissal, completion links, and unsent drafts. Successful actions are
reflected immediately even if a later action in a batch fails. Dismissal remains
local to the open conversation view, as before; reload can show it again.
On narrow screens the panel is collapsed until opened. A new answer opens at
its summary rather than scrolling past urgent items to its end.

## Design reference

Primary reference: repository DESIGN.md and the existing Wicker dashboard's
current-action plane, ruled registers, Archivo/Archivo Narrow, and neutral
surfaces. Refero's Perplexity style reference (5c7acdfb-996b-4c6f-b361-264a3f580f7d)
reinforced quiet grouping and restrained controls. Its teal and typeface were
not adopted. Screen search for chat/action approval patterns was too broad to
justify borrowing a different layout. No new branding, imagery or hard blue
card outlines were introduced.

## Validation

- Focused tests cover structured final responses (including exhausted research
  rounds), actual proposal-tool output, invalid IDs, visible malformed-response
  failures, urgency sorting, uncertainty retention, conceptual Markdown/math,
  persistence and historical recall of widget/draft content.
- Integrated T3 preview, local account `tutor-widget-check`, real application API
  with a controlled model response: generated widgets and an actual calendar
  proposal; followed its review link; approved it; observed “Added to Planning”;
  reloaded the conversation and recovered widgets, draft and receipt.
- Narrow layout checked at 388 CSS pixels inside a 390px same-origin local
  iframe (the T3 resize command timed out). A disposable local proxy allowed
  embedding for this check only; production frame restrictions are unchanged.
  No horizontal overflow; collapsed/expanded actions and draft details checked.
- Live model judgment and response latency were not benchmarked in this session.
  Hosted protected-route rendering can only be checked through sign-in in the
  available browser session.

## Persistent capability infrastructure

The `study-work` account/programme document stores personal tasks, project
milestones, diagnostics, submission reviews, attempts and an append-only audit
history. Atomic compare-and-swap writes handle concurrent changes. Proposal
IDs are idempotency keys; per-item revisions reject stale approvals. Account
export and deletion include the new namespace without a migration.

Tutor tools now read Canvas submission/grade observations separately from
personal completion, propose task/project/attendance changes, prepare grounded
diagnostics and draft reviews, and read practice/mistake/mock evidence and
weekly history. The `/app/tutor/work` route keeps artifacts accessible outside
a conversation. Diagnostic answer keys stay server-side; the answers endpoint
scores against the stored key and survives retries without duplicate attempts.
Task changes use the existing Proposed Actions approval endpoint. There is no
email sender, teammate notification, Canvas submission writer or automatic
study-block rescheduler.

Attendance widgets resolve server-computed report IDs. They keep unmarked
sessions separate from absences and separate lecture/lab requirements. Tutor
can propose attended/missed/clear marks for exact completed timetable sessions,
with previous-mark and programme checks. It cannot grant excused absence.

Course-rule, attendance and briefing tools also read dated Canvas announcements
beyond the old 320-character excerpt. Possible amendments are visible alongside
the indexed rule. Tutor must check wording, edition and effective date and
retrieve a referenced revised syllabus; a vague announcement does not establish
a new threshold or override programme regulations. This is grounded context,
not an automatic mutation of the indexed coursebook.

## Navigation performance

Workspace hooks and legacy `useJson` now share fresh reads for 30 seconds,
deduplicate pending requests and show cached data during background refresh.
Successful data writes invalidate reads; session changes discard them and fence
late responses. The cache is memory-only. Courses and Practice's course index
use the small workspace response. Course detail, Calendar, settings, setup
reminders and tour reads reuse existing data. Closed search controls no longer
download full inventories, and internal settings/Tutor links use client routing.
Timetable and Canvas calendar retrieval start concurrently.

Integrated T3 local checks (development build, fixture account): warm Courses
and Settings headers rendered in 56ms/90ms; repeated API-access/Connections tab
selection took 58ms/46ms with no API requests. These are controlled local
observations, not production latency guarantees. Hosted authentication and
upstream Canvas/Neon cold-response latency still need production observation.

Additional browser check: approved a real catch-up proposal, opened its persisted
checklist beside project milestones, answered a diagnostic (1/2 with corrective
feedback), and recovered the saved attempt in Study work. Fixture content was
explicitly labelled and never written to the student's production account.
