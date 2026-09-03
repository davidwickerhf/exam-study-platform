---
version: 1
slug: "app-app-page-tsx"
primary_target: "app/app/page.tsx"
related_targets: ["app/app/loading.tsx","lib/workspace/home.mjs","lib/workspace/home.d.mts"]
---

# Dashboard surface brief

- Scope: `/app` authenticated home. Operate mode.
- Job: let an exam-focused student understand what matters now, what is mandatory or urgent, and which study action to take next.
- Chosen direction: **Study Itinerary**, approved from `.impeccable/mocks/decision/dashboard-study-itinerary.webp` (seed `29b43344`).
- Memorable moment: a continuous indigo route connects the current action to the next two academic milestones; the route remains useful when today is empty.
- Priority layer: rank mandatory timetable attendance, incomplete Canvas assignments, and recorded group-project or assessment milestones. Show only evidence present in the calendar, Canvas, or maintained course profile; absence is explicit and no progress is invented.
- Constraints: preserve the workspace shell and existing data sources; no generic metric-card grid, greeting hero, gradients, glass, photography, or decorative illustration.

## Shipped invariants

- The page is a Study Itinerary: a compact date/period band, a ruled four-metric band above the dominant NOW → NEXT → LATER route, and evidenced supporting registers beside it. NOW is the sole dark plane and owns the primary action.
- The teaching-period measure always runs W1–WN. Current, elapsed, and future weeks remain distinguishable by mark weight; the exam marker is rendered only when the chosen next course exam or maintained exam-week event falls within that period.
- The one-pixel route rail is centered through the circular NOW/NEXT/LATER markers and connects NOW to at most two deduplicated future assignment, course-exam, or institution-calendar stops. With no future stops, there is no ornamental rail.
- Page-level rules run edge to edge across their page band. Section heads, rows, notices, and other internal dividers run edge to edge across the plane that owns them; padding belongs to content, not to shortened rules.
- Priorities are evidence-backed by exactly three source families: timetable events, connected Canvas assignments and submission states, and confirmed course assessment rules. Each source exposes checking, connected/verified, absent, or unavailable state; unavailable never means clear, partial coverage is named, and an empty result claims only that nothing is flagged in the sources currently connected.
- The period activity view is a calendar-aligned contribution heatmap covering only `context.start` through `context.end`. Its W1–WN axis spans the full card with Monday-to-Sunday rows and 10px day cells; five neutral-to-indigo intensity levels encode recorded study volume, today is outlined, and future dates are unfilled. The marker names the first in-period course exam, or the maintained in-period exam week only when no course exam exists. The complete visual graphic, including weekday guides and legend, is `aria-hidden`; a screen-reader-only ordered list exposes every maintained period date and its recorded or upcoming state in source order. Loading retains its skeleton and failure retains an explicit unavailable state.
- On desktop the workspace sidebar opens expanded at 248px and restores a saved 224–320px resize. Collapsing leaves a 48px icon rail with tooltips while hiding brand text, search, group labels, and item labels; the centered header trigger or `Cmd/Ctrl+B` reopens the retained width, and a fresh mount starts expanded. On compact screens the trigger opens the sidebar sheet and the five-item bottom navigation remains primary.

## Comp translation

| Ingredient | Implementation | Commitment |
| --- | --- | --- |
| Existing shell | Existing React workspace sidebar | Preserve navigation, search, account control, breakpoints, 224–320px resize memory, 48px collapsed rail, and retained-width reopen. |
| Date + period header | Semantic HTML/CSS | Compact horizontal header; W1–WN remains visible and only an in-period exam receives a marker. |
| Study route | Semantic HTML/CSS with a single CSS route-line reveal | Dominant left column; NOW is the only dark plane; NEXT/LATER are ruled stops on a signal line centered through their markers. |
| Primary action | Next `Link` using button styles | One indigo action chosen from real current state; no invented recommendation. |
| Priorities | Ranked semantic list | Attendance, assignments, and project milestones include source, state, due time, and destination when available. |
| Queue | Semantic links + server counts | Due flashcards and open mistakes use their existing endpoints; question practice is presented as available, not falsely “due.” |
| Course readiness | Ruled course links + progress bars | Real browser read-state only; no readiness score inferred from absent practice data. |
| Activity | Semantic CSS heatmap | Real period activity grouped into W1–WN columns, with weekday guides, per-day states, the exam-week destination, and a restrained intensity legend. |
| Generated raster | Approved decision comp only | Design evidence, not shipped UI. No raster ships in the product surface. |

The mock’s hard-coded weekday, counts, course recommendation, and implied project completion are not literalized; runtime truth wins.
