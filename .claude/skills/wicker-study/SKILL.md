---
name: wicker-study
description: Study with or maintain a Wicker Study deployment. Read course material and progress, record study activity, reconcile academic documents, or—with an admin key—import a Canvas course or ingest a local course folder into the versioned editorial workflow, generate evidence-grounded content, review it, and publish it. Use for study.wicker.life or a local Wicker Study server.
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

## Course ingestion and editorial workflow (scope: admin, hosted only)

Use the versioned editorial workflow for a new course, a weekly material update, or a
student-contributed draft. It keeps sources private, deduplicates identical files by
SHA-256, reuses unchanged topic artifacts, and separates generation from publication.
Local servers without hosted storage return 501.

Prefer the MCP tools for local folders because HTTP cannot read an administrator's
filesystem. The safe workflow is:

1. Call `admin_inventory_course_folder` or `admin_sync_course_folder` with its default
   `dryRun:true`. Inspect the file manifest and the add/replace/reuse/retire diff.
2. Create or select the precise course edition: programme, canonical course, academic
   year, and period are identity, not display labels. Never merge materials across
   editions merely because course names look similar.
3. After the user authorises the shown sync, call `admin_sync_course_folder` with
   `dryRun:false`. Keep `replaceManifest:false` for ordinary weekly additions;
   `replaceManifest:true` retires absent paths and is only for a complete authoritative
   folder. `admin_register_course_urls` adds allowed web sources.
4. Run extraction without AI using `admin_process_course_pipeline` with
   `types:["extract"]`. Inspect failed sources. Legacy `.doc`/`.ppt` files must be
   converted to PDF or their XML successor format.
5. Run `types:["map"]`, `useAi:true`. Review the resulting topics and course profile.
   In particular, verify the assessment scheme against cited syllabus/course-manual or
   introductory-deck pages: components, percentages, minimum grades, deadlines, pass
   conditions, attendance and resit rules. Treat totals other than 100%, missing
   evidence, and source conflicts as unresolved; never infer a rule from convention.
6. Call `admin_estimate_course_generation` before expensive work. On approval, call
   `admin_queue_course_generation` with `confirmed:true`, then process the requested
   study pages, exercises, flashcards, and quality report in bounded batches. Adding a
   new weekly deck should reuse unchanged extracts and topic artifacts.
7. Inspect `admin_list_editorial_workspace`. Use `admin_review_course_artifact` to edit
   or approve each evidence-grounded artifact. Do not publish a quality report as a
   substitute for human review.
8. Call `admin_publish_course_edition` only when the user explicitly asks to publish;
   it requires typing the course code as confirmation. Publication creates a new,
   reviewable release and never exposes the original source files.

For a student content request, private upload is the default. Only call
`admin_prepare_content_request` when the request records separate shared-use permission,
then accept or reject its rights basis with `admin_review_contribution`. A withdrawal
blocks future publication from that contribution. Never treat ordinary upload, account
creation, or course access as contribution consent.

The matching HTTP endpoints are listed in `GET /api/agent/manifest`; use them when MCP
is unavailable. Folder sync remains an MCP-only convenience because the client must
hash and upload local bytes.

### Canvas course import (local MCP only)

When an administrator gives a Canvas course Modules URL, use
`admin_import_canvas_course`, not browser scraping or a request for account
credentials. Canvas authentication stays with Canvas: never ask for, receive, store,
or paste a Canvas password, MFA/OTP code, browser cookie, or session export.

- The administrator completes Canvas SAML/OTP in Canvas and creates a short-lived
  Personal Access Token if their institution permits it. On macOS, call
  `admin_import_canvas_course` with no arguments: one local native panel collects the
  Modules URL, selects the output folder in Finder, and accepts the token in a secure,
  one-time field. It is never saved. An existing local `CANVAS_ACCESS_TOKEN` is used
  only when explicitly passed as the optional `accessTokenEnv` shortcut.
- The importer collects accessible module files, pages, assignments, discussions,
  quizzes, and external-link references into a stable, categorised folder with a hidden
  manifest. It does not fetch third-party links.
- Inspect the local `README.md`, manifest, and skipped items. Re-run into the same
  folder whenever Canvas publishes new weekly material; unchanged files are reused by
  hash during the later folder sync. Paths no longer returned by Canvas are flagged for
  review and never deleted automatically.
- Only if the administrator confirms they are authorised to submit the material, call
  the importer again with `syncToWicker:true`, `rightsConfirmed:true`, and first keep
  `dryRun:true`. Show the plan. On explicit confirmation, use `dryRun:false`.
  Imported sources are still **candidate** rights-review records, not accepted
  editorial material. Do not extract, map, generate, or publish until the relevant
  contribution has been reviewed and accepted.
- If Canvas Personal Access Tokens are unavailable, report that the importer cannot
  safely automate a password-plus-OTP flow. Do not attempt to bypass MFA, automate an
  interactive OTP challenge, or substitute a saved browser session.

## Direct content maintenance (scope: admin, hosted only)

Use these endpoints for a narrow, deliberate fix to an already published course. For
substantial ingestion or generation, use the editorial workflow above.

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

## Programmes (organisations)

`whoami` shows the student's programme memberships. If `needsProgramme` is true and
`eligible` lists several programmes, ask which one applies and call `join_programme`.
Programme admins can update their own programme, its calendar, and its members
(`admin_list_members`, `admin_set_member`, `admin_remove_member`); only global admins
grant the admin role.

## Conventions

- Send JSON bodies with `Content-Type: application/json`.
- Errors return `{error}`: 401 bad key, 403 scope/admin, 404 unknown id, 409 stale
  revision, 501 editorial write without a hosted database.
- Never store a key in the repository; read it from the environment.
