---
name: wicker-study
description: Work with a Wicker Study deployment as an agent — read course material, questions, and a student's progress; record study activity; and (with an admin key) create, update, or delete courses, chapters, materials, exercises, and known bachelor programmes. Use when asked to study with, tutor from, or maintain content on study.wicker.life or a local Wicker Study server.
---

# Wicker Study

Wicker Study exposes one HTTP API for the web app, agents, and administrators.
Everything is scoped by a personal API key created under **Account → API access**.

- Base URL: `https://study.wicker.life` (production) or `http://localhost:4177` (dev).
- Auth: `Authorization: Bearer wsk_…`. Scopes: `read` (GET), `write` (study
  mutations), `admin` (editorial content; only administrators can mint these).
- Discover everything with `GET /api/agent/manifest` — it lists every endpoint,
  its scope, and body shapes. Read it first when unsure.
- Prefer the MCP server when available: `WICKER_STUDY_URL=… WICKER_STUDY_API_KEY=… npm run mcp`
  from the repository (tools mirror the endpoints below).

## Ids

Course ids are short slugs (`sec`, `alg`, `stats`); chapter ids are zero-padded
strings (`"02"`). Always resolve them with `GET /api/courses` before guessing.

## Reading (scope: read)

| Need | Call |
| --- | --- |
| Courses, chapters, progress counts | `GET /api/courses` |
| One course with mastery items | `GET /api/courses/{courseId}` |
| Chapter text (markdown) | `GET /api/chapter/{courseId}/{chapterId}` |
| Search inside a course | `POST /api/retrieve {courseId, query, limit}` |
| Chapter question bank | `GET /api/questions/{courseId}/{chapterId}` |
| Flashcards / due cards | `GET /api/flashcards/{courseId}`, `GET /api/sr/due` |
| Mistakes, mocks | `GET /api/mistakes?open=true`, `GET /api/mocks` |
| Academic plan, exam dates | `GET /api/academics` |
| Streak and recent activity | `GET /api/activity?days=28` |
| Unified calendar (exams, deadlines, institution dates, timetable feeds) | `GET /api/calendar/events` |

## Studying on the student's behalf (scope: write)

- Grade an answer: `POST /api/grade` with the question object from the bank,
  the attempt, and `_meta: {courseId, chapterId}`. This consumes the student's AI
  allowance — check `GET /api/ai/usage` first and never loop through a bank.
- Spaced repetition: `POST /api/sr/review {questionId, quality 0–5}`.
- Mastery: `PATCH /api/items/{itemId} {mastery 0–4}`.
- Mark read: `POST /api/activity {type:"read", courseId, chapterId}`.
- Plan changes: read `GET /api/academics`, edit the workspace, then
  `PUT /api/academics {workspace, expectedRevision}` (409 means reload and retry).
- Supporting documents (transcript, exam schedule, timetable, academic calendar):
  `POST /api/academics/documents/analyze {kind, documents:[{name, text}]}` returns a
  change set (`changes[]` with kind result | exam-date | new-course | event | profile).
  Show it to the student, then `POST /api/academics/documents/apply {changes, expectedRevision}`
  with the accepted ones. Calendar links: `POST /api/academics/calendars {url}` (saved,
  re-syncable via `/sync`) or `/calendars/preview {url|ics}` for a one-off.

## Maintaining content (scope: admin, hosted only)

Content lives in the active editorial release on Neon. Local servers return 501.

1. Course: `PUT /api/admin/courses/{courseId} {code, name, shortName?, exam?, knowledgeBase?}`.
2. Material: `PUT /api/admin/courses/{courseId}/materials?path=03 Topic/03 Topic.md {content}`.
   Markdown/code is indexed for the tutor; PDFs (`{base64}`) are text-extracted page by
   page and indexed. `POST …/materials/extract?path=` re-extracts a stored PDF.
3. Chapter: `PUT /api/admin/courses/{courseId}/chapters/{chapterId} {name, sourcePath}` —
   `sourcePath` must match the material path from step 2.
4. Questions: `PUT …/chapters/{chapterId}/questions {questions:[…]}` to replace, or
   `PUT …/questions/{questionId}` for one. Shape: `{id, type, question, expected?, options?, answer?, difficulty?, source?}`
   with `type` in written | calc | tf | mc | pseudocode | code | best-option.
5. Mastery items: `PUT …/items/{itemId} {title, type?, category?, chapterId?}`.
6. Papers: `PUT …/papers/mock-exam/{paperId} {label, questionPath, solutionsPath?}`.
7. Editorial flashcards: `PUT …/chapters/{chapterId}/flashcards {cards:[{front, back}]}` to
   replace, `PUT …/flashcards/{cardId}` for one, `GET /api/admin/courses/{courseId}/flashcards` to list.
8. Institution calendar: `PUT /api/admin/programmes/{programmeId}/calendar {events|ics|url|documents}`
   — shown read-only to every student on that programme; students import what they need.
9. Known programmes: `PUT /api/admin/programmes/{programmeId}` with the catalogue
   definition (`institution`, `name`, `degree`, `versions[{id,label,status,courses[]}]`).

Deletes are `DELETE` on the same paths and are irreversible — confirm with the
user before deleting a course, chapter, or programme. Check `GET /api/admin/status`
to see counts before and after bulk changes.

## Conventions

- Send JSON bodies with `Content-Type: application/json`.
- Errors return `{error}`: 401 bad key, 403 scope/admin, 404 unknown id, 409 stale
  revision, 501 editorial write without a hosted database.
- Never store a key in the repository; read it from the environment.
