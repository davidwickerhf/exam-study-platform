---
version: 1
slug: "app-app-courses-page-tsx"
primary_target: "app/app/courses/page.tsx"
related_targets: ["components/brand/canvas-mark.tsx", "lib/workspace/course-ledger.mjs", "lib/workspace/course-ledger.d.mts"]
---

# Courses surface brief

- Scope: `/app/courses` authenticated course overview. Operate mode.
- Job: let a student see where active courses sit inside the complete degree, open the right course, and understand which records and sources support the view.
- Chosen direction: **Degree Runway x Active Desk**, a user-approved fusion of `.impeccable/mocks/decision/courses-period-runway.png` and `.impeccable/mocks/decision/courses-active-desk.png` (seed `9c3a16b0`).
- Memorable moment: a single dark degree-length runway exposes each actual programme year and marks the student’s current year and period; the live course desk begins immediately below it.
- Constraints: preserve the workspace shell, warm departure-board language and full-span rules; repeated courses remain flat ruled rows; no invented readiness, coverage or completion data.

## Shipped invariants

- The runway is built from the selected maintained programme and academic record. It displays only programme years that exist in source data.
- Maintained-catalogue placement enriches an existing academic-record course without replacing its richer title, material, attempts or status. Catalogue-only requirements remain visible so the runway cannot silently omit a required course.
- Per-year plan totals include required curriculum courses and electives already present in the student’s academic record. Unselected elective offerings never become requirements.
- Passed counts use the shared academic status rule. Active counts use current-course codes from the calendar context. Exam order uses future dated attempts only.
- Timetable-only courses remain visible as current rows even when they are outside the programme and have no record, Canvas or maintained-library match. They count in the source-coverage denominator without being mistaken for any of those sources.
- The broad course register defaults to the current period, supports code/name search and deterministic sorting, and keeps each row’s actual destination explicit to assistive technology.
- The right rail owns exam order, source coverage and course-group filters. When the container can preserve a 660-pixel register, its full-height separator can be dragged between 256 and 400 pixels, supports arrow/Home/End keys, and persists the chosen width locally. If that minimum cannot fit, the rail stacks below the register even at a desktop viewport; the split also returns to one document flow below desktop.
- Source coverage is the percentage of current courses represented in each real source family, with the covered/total count retained for assistive technology. Canvas uses Instructure's actual open-source Canvas LMS logomark and brand red, not a generic database glyph.
- Programme, catalogue, calendar and Canvas requests keep explicit loading, ready and error phases. Dependent figures render as checking or unavailable instead of turning a failed request into a plausible zero.
- Per-course material coverage measures the two retrievable material channels separately from the study record: indexed Canvas material and maintained-library chapters. Each available channel contributes half; the register names the numerator so the percentage never implies syllabus completeness.
- Section heads, toolbars, rows and footers use edge-to-edge rules inside their owning plane. The rail becomes sticky only at the two-column desktop breakpoint.
- The page introduction is a full-width ruled band, matching the dashboard rather than floating as a padded island.
- The Courses shell inherits the dashboard's 1280-pixel content measure, 32-pixel page heading, 18-pixel primary section heading, 16-pixel widget heading, `rounded-xl` widget corners, flat bordered white planes, and shared dark-sheet shadow. Density changes in the register, but the hierarchy does not.
- On phones, the layout becomes one document flow; placement and exam columns collapse, the status control moves into the register toolbar, and every action remains reachable.

## Reference translation

| Reference | Kept | Rejected |
| --- | --- | --- |
| Refero n8n | disciplined aligned columns | dense enterprise chrome |
| Refero Rox | compact status-first toolbar | CRM-specific scoring |
| Refero ShareWillow | contextual action band | decorative dashboard cards |
| Refero Zapier Learn | persistent filtering beside the list | promotional course tiles |
| Period Runway option | one dark overview plane and programme measure | a short W1-W8 strip |
| Active Desk option | broad working register and contextual right rail | invented readiness percentages |

The generated mock data is decision evidence only. Runtime programme, academic-record, calendar and Canvas truth always wins.
