# Academic planning integration exploration

## Decision

Merge the useful planning capabilities from the personal `academics` project into
Wicker Study, but do not merge the Nuxt application or copy its local-storage
architecture wholesale.

Wicker Study should own one authenticated academic-planning document per
programme workspace in the existing `user_documents` store. The current five
study courses can then link to planning courses by stable course code. Planning
becomes a first-class signed-in area alongside Courses, Practice, Mistakes, and
Mock sessions.

This is an additive feature. Editorial study content remains shared and
release-managed; programme records, grades, attempts, dates, and goals remain
private to the signed-in student.

## Source project inventory

The source project at `/Users/davidwickerhf/Projects/personal/academics` is a
Nuxt/Vue application with browser-only persistence. Its working tree currently
contains uncommitted changes, so it should be treated as a product/logic
reference rather than imported through Git history.

Capabilities worth carrying over:

- multiple programme workspaces;
- course catalogue with code, ECTS, year, period, pass mark, notes, and visibility;
- attempt history (first sit, resit, carry-over), date, status, and grade;
- calendar of exams and manual academic events;
- earned-credit and weighted-GPA summaries;
- configurable progression and thesis gates;
- risk, priority, period-pressure, and minimum-path calculations;
- scenario planning for current attempts and possible resits;
- JSON import/export.

The source currently exposes Dashboard, Courses, Curriculum, Calendar, Credits,
Requirements, Planner, Settings, and New Programme screens. Those nine screens
are too fragmented for Wicker Study's existing navigation and should be
consolidated.

## Boundaries and ownership

| Concern | Owner | Proposed source of truth |
| --- | --- | --- |
| Study course content, chapters, papers | Editorial | Existing active Neon release |
| Programme and academic year | User | `user_documents` |
| Course credits, grades, attempts, exam dates | User | `user_documents` |
| Progression rules and planning scenarios | User | `user_documents` |
| Derived GPA, credit totals, risk, minimum path | Application | Computed from the user document |
| Link from a study course to a planning course | User record + editorial course code | Stable course code, with optional explicit override |

Do not put grades or programme progress into editorial course tables. Likewise,
do not copy editorial chapters or papers into the planning document.

## Proposed document model

Use namespace `academics`, with one `programme:<workspace-id>` document for each
workspace and an `index` document for workspace metadata and the active
workspace. This avoids one oversized account document while preserving atomic
updates within a programme.

```json
{
  "schemaVersion": 1,
  "id": "default",
  "profile": {
    "name": "",
    "university": "",
    "programme": "BSc Computer Science",
    "academicYear": "2025–2026",
    "currentYearKey": "2025-2026",
    "gpaIncludesFailedCourses": false
  },
  "courses": [
    {
      "id": "algorithmic-design",
      "code": "BCS1540",
      "editorialCourseId": "alg",
      "name": "Algorithmic Design",
      "ects": 4,
      "yearLevel": 1,
      "period": "P5",
      "critical": true,
      "passMark": 5.5,
      "notes": "",
      "hiddenFromStats": false,
      "attempts": []
    }
  ],
  "events": [],
  "gates": [],
  "planning": { "objectives": {} }
}
```

The five current editorial mappings can be inferred safely by code:

| Editorial ID | Course code | Planning course |
| --- | --- | --- |
| `alg` | `BCS1540` | Algorithmic Design |
| `stats` | `BCS1520` | Statistics |
| `emb` | `BCS2410` | Embedded Programming |
| `sec` | `BCS2420` | Computer Security |
| `nm` | `BCS2540` | Numerical Methods |

Course code is the portable matching key; `editorialCourseId` is an optional
explicit link. Never match by mutable display name.

## API shape

Add authenticated endpoints backed by `readDocument`/`writeDocument`:

- `GET /api/academics` — workspace index plus active programme;
- `POST /api/academics/programmes` — create a programme workspace;
- `GET /api/academics/programmes/:id` — read one programme;
- `PUT /api/academics/programmes/:id` — replace a validated programme document;
- `DELETE /api/academics/programmes/:id` — delete a programme after explicit confirmation;
- `PUT /api/academics/active` — select the active workspace;
- `POST /api/academics/import` — validate and import a legacy academics export.

The first delivery can use whole-document `PUT`, matching current persistence.
If simultaneous editing or analytics later matter, course/attempt mutations can
move to normalized tables or revision-checked patches without changing the UI
model.

Every write needs structural validation, a payload-size limit, server-generated
workspace IDs, and the authenticated user context already enforced for private
`/api/*` routes. Derived values must not be persisted.

## Product integration

Add one top-level **Planning** destination, not seven new sidebar items. Within
it, use a compact local tab set:

1. **Overview** — upcoming exams, earned/target ECTS, GPA, blockers, and focus;
2. **Courses** — curriculum, attempts, grades, and per-course editing;
3. **Calendar** — exams plus manual registration/deadline events;
4. **Scenarios** — pass/fail and resit planning, gates, and minimum path.

Programme creation/switching belongs in the Planning header. Planning-specific
settings belong inside Planning; account/privacy settings remain in the existing
Settings page.

On each linked Wicker Study course page, show only a small contextual planning
summary (next exam, attempt type, credit value, status) with a link to the full
Planning area. Study actions remain primary.

## Generalization required before porting logic

The source logic is reusable, but `GATE_CONFIG` and default records are specific
to one Maastricht Computer Science scenario. Before shipping:

- store gate definitions per programme rather than in a global constant;
- support course, credit-by-level, all-courses-in-level, and total-credit gates;
- treat risk and minimum-path outputs as guidance, not authoritative university
  decisions;
- make periods and year levels strings so other programmes are not constrained
  to `P1`–`P6` or years 1–2;
- use ISO dates for storage and locale-aware formatting for display;
- preserve multiple attempts and never infer a pass solely from a non-null grade;
- allow courses with no matching study content;
- allow study courses that are absent from the active programme.

## Legacy import

Provide an explicit one-time import from the academics JSON export. The importer
should accept both the raw `AppStore` and its `{ version, data }` export wrapper,
then:

1. validate and normalize profile, courses, attempts, events, and dates;
2. generate a new programme workspace unless the user explicitly chooses an
   empty target;
3. match editorial courses by exact normalized course code;
4. report matched, unmatched, and rejected records before saving;
5. preserve the input export locally and make no changes to the source repo.

The hard-coded date migrations and IT Management repair in the source
`useStore.ts` should run only inside a legacy-v1 importer, not in normal reads.

## Delivery slices

### Slice 1 — persistence and migration

- Add schema validation and academics repository functions.
- Add authenticated programme CRUD endpoints.
- Add tests for user isolation, validation, legacy import, export, and account
  deletion coverage.
- Seed no personal Maastricht data into new accounts.

### Slice 2 — planning core

- Add the Planning destination and programme switcher.
- Ship Overview, Courses, and Calendar.
- Port attempt, credits, GPA, upcoming-exam, and event calculations as pure
  JavaScript modules with unit tests.

### Slice 3 — scenarios and study links

- Add configurable gates, risk, minimum-path, and resit scenarios.
- Link study courses and planning courses by code.
- Add contextual exam/status summaries to linked course pages.

### Slice 4 — hardening

- Add accessible empty/loading/error states and mobile layouts.
- Add conflict protection if multi-tab editing proves common.
- Confirm export/deletion copy and privacy documentation cover academic records.

## Acceptance criteria for the first shippable increment

- A signed-in user can create a programme, add/edit a course and attempt, and
  see correct earned ECTS, GPA, and upcoming exam dates.
- The record survives reload and another browser through Neon.
- One user cannot read or mutate another user's academic record.
- An academics legacy export imports without losing attempt history.
- Current study workflows and editorial course releases are unchanged.
- Account export includes academics documents and account deletion removes them
  through the existing generic `user_documents` behavior.

## Key risks

- **Rules presented as truth:** university progression rules change and differ by
  cohort. Display a configurable-rule disclaimer and last-reviewed metadata.
- **Identity drift:** course names change. Use course code plus explicit override.
- **Overloaded navigation:** consolidate planning into one destination.
- **Private-data exposure:** keep all academic records in authenticated personal
  storage; do not add them to public pages or editorial releases.
- **Source contamination:** the academics repo is dirty and includes personal
  defaults. Port reviewed logic only; do not copy its state or commit history.

## Recommendation

Proceed with Slice 1 and Slice 2 as the minimum useful merge. They deliver the
core value—credit-to-completion tracking and exam dates—on the hosted data model.
Keep scenarios and deep course-page integration behind that stable foundation.

## Implemented on this branch

The branch now includes the generalized planning workspace rather than the
Maastricht-specific defaults from the source project:

- multiple private programme/cohort workspaces;
- editable course metadata and complete first-sit, resit, carry-over, and other
  attempt histories;
- personal exam dates and grades on individual attempts;
- curriculum, calendar/manual events, credits, GPA, requirements, scenario
  planning, risk priority, period pressure, and minimum credit paths;
- JSON programme import/export;
- revision-checked writes to prevent silent stale-tab overwrites;
- account isolation through the existing authenticated `user_documents` store.

No editorial course, curriculum, progression rule, exam date, or personal grade
is seeded into a new account. Exact course code is available as a link key, but
the student's programme record remains authoritative.
