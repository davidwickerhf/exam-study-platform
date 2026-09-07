# Canvas groups

Students can open **Groups** in a course or `/app/groups` for all connected
Canvas memberships. Settings → Connections links to the same global view.
Course teams respect the selected academic year; global/account groups remain
separate. The global view is a browsable directory: a roster is fetched only
when its member action opens the detail sheet. A course with exactly one team
keeps its compact inline roster and loads that team automatically.

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

## Directory and roster behavior

`/app/groups` owns one “Your groups” title and a flat directory grouped by Canvas
origin and course within one academic year. The header year selector defaults
to the newest available year and has no combined all-years choice. Course teams
and Global groups remain separate views; course counts reflect the selected year.
Search matches group name, course name/code and global context. “Year not listed”
appears when needed. Switching group type or clearing search preserves the year;
an explicit selection is retained in the URL on reload. Long names wrap in rows.

Each row is a keyboard-operable member action. A known Canvas member count is
shown alongside it; an unknown count says “View members”, never zero. Opening a
row loads only that roster into the shared detail sheet, with course/year context,
an “Open in Canvas” link and “Refresh members”. Closing the sheet leaves the
directory mounted and preserves its search, filters and browsing position; Escape
returns focus to the triggering row. No global roster request occurs on initial
load, including when the directory contains only one group.

The course Groups tab continues to pass its exact course code and selected year.
Exactly one course team uses the compact inline roster; multiple teams use the
directory and sheet. Tutor selection follows the selected group and Canvas origin.
Names remain exactly as returned by Canvas. Decorative initials use Unicode
letter tokens, recognize parenthesized given names, and take first/last initials;
punctuation is not an initial. The “You” label uses Canvas identity evidence only.

On mobile, controls wrap, long names remain readable and the detail sheet uses the
available screen width. Its member list scrolls between the context header and
action footer. The directory remains a single document flow.

## Failure and recovery

Connection absence, membership loading, membership request failure, partial
permission failure, no memberships, unmatched filters and roster failure are
separate states. Filtered empty results offer “Clear filters”; connection absence
links to Settings. Partial membership reads explicitly say coverage is incomplete.

Roster errors take precedence over the selected membership's earlier
`not-loaded` status, so a transport failure cannot leave an endless skeleton.
An unreadable roster is an alert, not an empty team. “Refresh members” invalidates
the groups cache, refreshes memberships and retries the selected roster; “Open in
Canvas” remains available. Only a successfully loaded empty roster may say Canvas
returned no visible members.

## Design decisions

The existing [Wicker Study design system](../DESIGN.md) remains the visual
authority: Archivo, navy ink, white working surfaces, blue actions and thin rules.
This surface changes the browsing interaction without replacing the global world.
The decision ledger below records the source IDs retained in the implementation
direction.

| Decision | Source and translation |
| --- | --- |
| Incumbent navy/white/blue hierarchy | Open Collective Raise, Refero `f72e18d0-98f4-4e88-9754-5426589564ea`: palette roles only; retain Wicker typography and density |
| Scannable membership rows with on-demand detail sheet | Mercury, Refero `ce741341-e1d2-4c81-8662-5455a0753e0b`: list-to-detail pattern |
| Search, quiet filters and secondary course/year metadata | Dropbox, Refero `0f021185-83e8-4842-bdf5-d9a2c65f263a`: browsing controls and hierarchy |
| One page title; course/year sections; wrapping names | Supplied screenshot and 24-membership browsing case: remove duplicate heading and group selector |
| Explicit member action; no initial global roster fetch | Avoid an arbitrary default selection and preserve directory browsing state |
| Single-course, single-team inline roster | Preserve the focused course workflow and exact retake-year boundary |
| Real names, initials and “You”; unknown counts remain unknown | Canvas data and permissions; no fabricated profile photos or plausible zeroes |

The scoped interaction contract lives in
[the Groups surface brief](../.impeccable/surfaces/app-app-groups-page-tsx.md).

## Validation evidence

Four targeted Chromium E2Es passed (29.4 seconds) in the final local run recorded
at `/tmp/groups-redesign-final-e2e.log`:

- Course roster, exact retake years, refresh without stale members, tutor context
  and 390px overflow check.
- Separate global/course groups, no initial roster fetch, denied roster alert and
  Escape focus restoration.
- A 24-membership directory, long names, year/search filtering, keyboard opening,
  Unicode initials, refresh, retained search after closing, mobile sheet width and
  empty-filter recovery.
- Roster transport failure replacing loading, followed by successful refresh and
  removal of the error.

These tests use mocked Canvas responses. They do not establish live-account
permission coverage. Directory scroll preservation is an interaction constraint;
the tests directly assert retained search and focus, not a scroll-offset round trip.
Desktop, mobile, detail, error and recovered screenshots are stored in
`.impeccable/review/groups-{desktop,mobile,detail-desktop,detail-mobile,roster-error,roster-recovered}.png`.
The final design reviewer disposition was **ship** after the roster-error
precedence fix. `npm run verify` passed: 836 tests, zero skipped, TypeScript and
production build. Deployment acceptance is recorded separately in the pull request;
local screenshots alone are not preview evidence.

Year-scoped directory: course teams show one academic year at a time, newest available by default. The header owns the year selector; counts use that selected year. Search clearing and switching to Global groups do not reset the year; reload retains an explicitly selected year through the URL. Courses retain their own existing edition selector.
