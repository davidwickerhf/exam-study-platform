---
version: 1
slug: "app-app-groups-page-tsx"
primary_target: "app/app/groups/page.tsx"
related_targets: ["components/workspace/canvas-groups.tsx", "docs/CANVAS_GROUPS.md", "e2e/student-study.spec.mjs"]
---

# Groups surface brief

- Scope: `/app/groups` and the shared course Groups tab. Operate mode.
- Job: find a course team or community among many Canvas memberships, then inspect its real teammates without losing the directory context.
- Chosen direction: **Browsable directory with roster sheet**. Course/year sections replace the global group selector; a course with exactly one team retains its inline roster.
- Primary action: activate a group's member row to open its roster. Canvas remains the destination for membership management.
- Proof: actual membership names, Canvas origin, course/year, known member counts, loaded members, self-identity evidence and permission problems. No generated avatars or invented people/counts.
- Visual authority: existing `DESIGN.md`; keep Archivo, navy ink, white work surfaces, blue actions and thin rules. This brief owns the new interaction, not a replacement visual world.

## Constraints

- Render one global page title. Group memberships by origin, course and academic year; keep global groups separate. Long names wrap in flat ruled rows.
- Search by team, course name/code or context; expose Course teams and Global groups controls plus the available academic years. Unknown years remain explicitly unlisted. The top-of-page year selector defaults to the newest available course year. There is no combined all-years view. Switching scope preserves the selected year, and the year query parameter preserves it on reload. Global communities are not tied to academic years.
- Do not fetch any global roster before its row is opened, even for a one-group global directory. The focused course exception automatically loads the sole team; multiple course teams use the directory.
- Key selection by Canvas origin and group ID. Preserve exact course/year request boundaries and selected tutor context.
- Member-count actions display Canvas's known count or “View members” when unknown. Never convert unavailable data into zero.
- The shared sheet contains group name, course/year context, roster, Canvas permalink and refresh. Keep the directory mounted so search, filters and browsing position survive closing. Keyboard activation opens it; Escape closes it and restores trigger focus.
- Keep Canvas names intact. Initials use Unicode letter tokens and parenthesized given names; initials cannot consist of punctuation. Show “You” only when the payload confirms identity.
- Loading, disconnected, membership failure, partial permissions, no memberships, filtered empty and roster failure remain distinct. Provide connection, clear-filter and retry actions in the relevant states.
- A roster error overrides stale `not-loaded` membership state. Stop the skeleton and show the alert; refresh invalidates the cache, reloads memberships and retries the roster. Only a loaded empty response becomes a no-visible-members message.
- At 390px, controls wrap and rows do not force horizontal page scroll. The sheet fills available width with a scrollable roster between header and footer; closing returns to the same directory.

## Reference translation

| Source | Applied decision |
| --- | --- |
| Open Collective Raise — Refero `f72e18d0-98f4-4e88-9754-5426589564ea` | Navy/white/blue roles within incumbent Wicker typography and density |
| Mercury — Refero `ce741341-e1d2-4c81-8662-5455a0753e0b` | Scannable team list and on-demand detail sheet |
| Dropbox — Refero `0f021185-83e8-4842-bdf5-d9a2c65f263a` | Search, quiet filters and secondary context metadata |
| Supplied screenshot and 24-membership case | Remove duplicated page title and hidden dropdown browsing; expose course/year groupings and long names |
| Canvas response semantics | Unknown counts, denied reads, exact retake boundaries and explicit refresh recovery |

## Validation evidence

- Final targeted Chromium run: four E2Es passed in 29.4 seconds; log `/tmp/groups-redesign-final-e2e.log`.
- Covered course/retake isolation, refreshed roster and tutor context; global/course separation and denied roster; 24-membership directory browsing, year/search filters, no upfront global roster fetch, keyboard opening, Escape focus, initials, retained search and 390px layouts; transport-error recovery through Refresh members.
- Search retention and focus restoration are directly asserted. Scroll-position preservation remains the intended mounted-directory behavior without a dedicated scroll-offset assertion.
- Screenshots: `.impeccable/review/groups-desktop.png`, `groups-mobile.png`, `groups-detail-desktop.png`, `groups-detail-mobile.png`, `groups-roster-error.png`, `groups-roster-recovered.png`.
- Final design review: ship after the sole required roster-error precedence fix.
- `npm run verify` passed: 836 tests, zero skipped, TypeScript and production build.
- Browser evidence uses mocked Canvas responses. Deployment acceptance is recorded separately in the pull request; no live-account or deployment claim follows from local tests.

Year-scoped directory: course teams show one academic year at a time, newest available by default. The header owns the year selector; counts use that selected year. Search clearing and switching to Global groups do not reset the year; reload retains an explicitly selected year through the URL. Courses retain their own existing edition selector.
