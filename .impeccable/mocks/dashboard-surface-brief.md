# Dashboard surface brief

- Scope: `/app` authenticated home. Operate mode.
- Job: let an exam-focused student understand what matters now, what is mandatory or urgent, and which study action to take next.
- Chosen direction: **Study Itinerary**, approved from `.impeccable/mocks/decision/dashboard-study-itinerary.webp` (seed `29b43344`).
- Memorable moment: a continuous indigo route connects the current action to the next two academic milestones; the route remains useful when today is empty.
- Priority layer: rank mandatory timetable attendance, incomplete Canvas assignments, and recorded group-project or assessment milestones. Show only evidence present in the calendar, Canvas, or maintained course profile; absence is explicit and no progress is invented.
- Constraints: preserve the workspace shell and existing data sources; no generic metric-card grid, greeting hero, gradients, glass, photography, or decorative illustration.

## Comp translation

| Ingredient | Implementation | Commitment |
| --- | --- | --- |
| Existing shell | Existing React workspace sidebar | Preserve navigation, search, account control, and breakpoints. |
| Date + period header | Semantic HTML/CSS | Compact horizontal header; period measure remains visible. |
| Study route | Semantic HTML/CSS with a single CSS route-line reveal | Dominant left column; NOW is the only dark plane; NEXT/LATER are ruled stops on one continuous signal line. |
| Primary action | Next `Link` using button styles | One indigo action chosen from real current state; no invented recommendation. |
| Priorities | Ranked semantic list | Attendance, assignments, and project milestones include source, state, due time, and destination when available. |
| Queue | Semantic links + server counts | Due flashcards and open mistakes use their existing endpoints; question practice is presented as available, not falsely “due.” |
| Course readiness | Ruled course links + progress bars | Real browser read-state only; no readiness score inferred from absent practice data. |
| Activity | CSS bars | Real 28-day activity; decorative chart chrome stays subordinate. |
| Generated raster | Approved decision comp only | Design evidence, not shipped UI. No raster ships in the product surface. |

The mock’s hard-coded weekday, counts, course recommendation, and implied project completion are not literalized; runtime truth wins.
