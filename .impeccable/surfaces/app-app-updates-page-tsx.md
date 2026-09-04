---
version: 1
slug: "app-app-updates-page-tsx"
primary_target: "app/app/updates/page.tsx"
related_targets: ["app/app/updates/loading.tsx", "lib/workspace/updates.mjs", "lib/workspace/updates.d.mts"]
---

# Updates surface brief

- Scope: `/app/updates`, the authenticated read-only Canvas workspace. Operate mode.
- Job: show what changed since the previous visit, make urgent assignments unmistakable, and let the student read Canvas detail without losing their place.
- Chosen direction: **Two-Pane Dispatch with Canvas Briefing**, selected from `.impeccable/mocks/decision/updates-two-pane-dispatch.png` and explicitly fused with the signal strip from `.impeccable/mocks/decision/updates-canvas-briefing.png` (seed `ad40c9d9`).
- Memorable moment: one near-black briefing strip states the new-announcement count, actionable-assignment count, and next real deadline; the selected tab then opens as a ruled dispatch list beside a calm detail pane.
- Primary action: select an item to read it in place, then open the original in Canvas only when needed.
- Proof: live Canvas announcements, assignments and submission states, modules, courses, grades, connection origin, refresh time, and partial-response problems. No demo facts ship in runtime UI.

## Constraints

- Keep the established dashboard and Courses hierarchy: 1280px measure, 32px page title, 18px primary headings, 16px widget headings, 14px major planes, full-span rules, flat white working surfaces, and indigo only for action or selection.
- Preserve the four URL-addressable tabs: Announcements, Assignments, Materials, Courses. Each uses the same master-detail grammar where the data supports it.
- Briefing figures are derived only from the loaded hub and previous-visit watermark. Offline work is not treated as missing, completed work is not actionable, undated work is not presented as the next deadline, and a partial Canvas response is named.
- Announcements and syllabus HTML remain server-sanitized and constrained to the reading pane. Nothing is written back to Canvas or copied into the academic record.
- The actual Canvas mark identifies the integration; Canvas red does not become a general status or action colour.
- Connection, loading, refresh, partial, empty, error, and truncated states remain explicit. A failed request never becomes a plausible zero.
- On wide screens, the dispatch list and reading pane scroll independently below the sticky page header, briefing and tabs. On smaller screens they return to one document flow; selecting a row brings its detail into view and all actions remain reachable.
