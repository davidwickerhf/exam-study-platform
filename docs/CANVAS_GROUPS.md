# Canvas groups

Students can open **Groups** in a course or `/app/groups` for all connected
Canvas memberships. Settings → Connections links to the same global view.
Course teams respect the selected academic year; global/account groups remain
separate. A group roster is fetched when selected, not for every group up front.

## API and MCP

`GET /api/integrations/canvas/groups` is an account-scoped read, available through
the existing signed-in session or read API key. Optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `courseCode` | Exact course code; filters memberships to matching Canvas editions |
| `academicYear` | `2026-2027`, `undated`, or `all`; used with `courseCode` |
| `scope` | `all`, `course`, or `global`; a course code selects course teams |
| `groupId` | Load teammates for a group returned by the memberships list |
| `canvasUrl` | Restrict to one connected Canvas origin; use for group IDs across hosts |
| `refresh=1` | Bypass and invalidate the private ten-minute cache |

Responses contain `connected`, `groups`, `matchedCourses`, `problems` and cache
metadata. Each group retains its Canvas origin/ID, course/edition, group-set ID,
Canvas permalink and member count. `membersStatus` is `not-loaded`, `loaded` or
`unavailable`; an unreadable roster has `members: null`, never a fabricated empty
team. Members contain only ID, name and `isYou` (null if self identity is unavailable).

MCP exposes `canvas_groups` with the same filters and `refresh: true`.
Tutor exposes `get_course_groups` and cites the membership/roster actually read.
Neither interface joins groups, changes memberships or messages teammates.

## Retrieval and privacy

The existing encrypted Canvas connection supplies credentials. No additional
AI request or material ingestion is needed. Reads use paginated
`users/self/groups`, course `groups?only_own_groups=true`, and the selected group's
`users` endpoint. Course reads supplement the global listing and tolerate partial
permission failures. Non-collaborative Canvas tags are excluded.

An arbitrary group ID cannot retrieve members: it must first appear in the
caller's available memberships within the selected course/edition. Cached results
are partitioned by account, Canvas host and credential, participate in account
erasure, and expire after ten minutes. Partial failures are not cached. Roster data
is never put in shared course material, public study guides or the editorial corpus.

Official source: [Canvas Groups API](https://canvas.instructure.com/doc/api/groups.html).

## Design decisions

Existing Wicker Study course styling is the build target. Refero's
[Open Collective reference](https://opencollective.com) supports the navy/white
hierarchy; the [GlossGenius team roster](https://refero.design/pages/f5e4e1f1-ae88-48b1-99a0-08b36d8669e1)
informs the compact identity rows and “You” marker.

| Decision | Basis |
| --- | --- |
| Groups within the navy course shell | User's focused-course direction; existing course navigation |
| Team name and edition above members | User's membership question; prevents retake confusion |
| Simple group selector only when needed | Existing form controls; keeps small teams immediately visible |
| Names and initials, explicit “You” | Roster reference; no fabricated profile photos |
| Global/course filter and Canvas permalink | Canvas context model; clear route to membership management |
| Distinct disconnected, denied and empty states | Canvas permission semantics; never equate a failed read with no group |
