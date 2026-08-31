---
name: wicker-study
description: Study with or maintain a Wicker Study deployment. Read course material and progress, reconcile academic documents, collect a private Canvas course snapshot through an account connection without receiving its token, or—with an admin key—ingest authorised local material into the versioned editorial workflow, generate evidence-grounded content, review it, and publish it. Use for study.wicker.life or a local Wicker Study server.
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

### Editorial writing standard (admin content only)

Generated pages are source-preserving teaching derivatives. Keep authorised original
sources intact and private while they remain authorised; never silently discard,
rewrite, or reconcile a meaningful curriculum, teaching, or assessment claim. Map it
to an edition-specific topic, record the conflict/gap, or leave it visibly for review.
Do not confuse clear writing with copying source text verbatim.

Teach the concept itself. A publishable study page gives a precise definition, explains
how or why it works, walks through a realistic example, identifies assumptions/limits
and common mistakes, then offers a self-check or practice bridge. Never use “this
course/chapter covers X” or a topic list as the lesson—explain X. Keep every
course-specific claim, rule, example, question, and answer tied to approved source
chunks. Clearly label editorial inference and do not invent missing facts.

The quality report blocks publication for missing citations, unextracted sources,
incomplete topic packages, thin/meta-summary pages, and unresolved factual or coverage
issues. An administrator may edit an artifact after genuine source review, but must
not clear a blocker merely to make a release pass.

For a student content request, private upload is the default. Only call
`admin_prepare_content_request` when the request records separate shared-use permission,
then accept or reject its rights basis with `admin_review_contribution`. A withdrawal
blocks future publication from that contribution. Never treat ordinary upload, account
creation, or course access as contribution consent.

The matching HTTP endpoints are listed in `GET /api/agent/manifest`; use them when MCP
is unavailable. Folder sync remains an MCP-only convenience because the client must
hash and upload local bytes.

### Canvas source collection

Canvas passwords, MFA/OTP codes, browser cookies, and session exports are never
accepted. A Canvas Personal Access Token (PAT) is the only supported credential.
**Never ask for it in chat, put it in an MCP argument, echo it, or put it in a source
folder.** There are two intentionally separate collection paths.

#### Account connection → local Claude/Codex snapshot (normal user path)

The student saves their PAT themselves in **Wicker Study → Canvas archive** while
signed in to the website. Wicker encrypts it server-side at rest, scopes it to that
account and Canvas origin, and never returns it in an API response, account export, or
MCP result. API keys cannot create, read, or delete this credential. The service must
have `CANVAS_CONNECTION_ENCRYPTION_KEY` configured; if it is not, fail closed and tell
the student to contact the service administrator.

A local Claude/Codex MCP process still needs its own Wicker `wsk_…` API key, but only
to authenticate as that user. It must use the account-connection tools below instead
of local Keychain tools; the proxy streams source bytes, not the PAT.

1. Call `canvas_list_remote_courses({ query? })`. It includes active and concluded
   enrolments. Search by title, course code, term, or initials: `IUI` finds
   *Intelligent User Interfaces*. Preserve separate Canvas IDs and terms rather than
   merging retakes or similarly named courses.
2. For a precise choice, call `canvas_list_remote_course_modules({ courseUrl })`.
   Omit `moduleIds` only when the student asked for the full course.
3. Call `canvas_import_remote_course({ courseUrl, outputFolder, moduleIds? })`.
   The snapshot is written to the local filesystem of the Claude/Codex MCP process so
   the subscription model can inspect it without consuming Wicker generation tokens.
   For “all IUI courses across the years”, use
   `canvas_import_remote_course_set({ query:"IUI", outputFolder })`; each Canvas
   course receives a distinct term/code/id folder.
4. Read the generated `README.md` and `.wicker-canvas-import.json`. The snapshot
   contains the Canvas rich-text syllabus, separately stored course-manual/syllabus
   files, accessible module content, ungrouped assignments/quizzes/discussions, and
   quiz questions only where Canvas permits them. Rich-text Canvas pages are followed
   recursively inside the same course; linked Canvas files are downloaded; every URL
   is recorded in a nearby `link-index`. Third-party sites are recorded, never crawled.

Re-run into the same local folder when weekly materials appear. The manifest flags
paths Canvas no longer reports and never deletes local material automatically.

#### Direct browser ZIP → Wicker Local (device hand-off)

The Canvas archive screen lets a student choose a course and module subset, then make a
ZIP directly on their own device. It uses **Wicker Local**, an opt-in loopback process
on `127.0.0.1`, and a host-scoped macOS Keychain token. The course bytes and Keychain
token do not pass through the production server in this path. Start it with
`npm run canvas:agent`; after copying a PAT in Canvas, use the UI’s **Use copied Canvas
token** control. The local bridge never accepts a token over HTTP.

#### Admin / editorial path (separate rights gate)

An administrator may instead use `admin_save_canvas_token_from_clipboard`,
`admin_list_canvas_courses`, `admin_list_canvas_course_modules`,
`admin_import_canvas_course`, `admin_import_canvas_course_set`, and
`admin_export_canvas_course_zip` with a host-scoped local Keychain token. This is for
authorised editorial collection, not normal student use.

Importing creates a private source snapshot only. Do not make it shared content merely
because a user uploaded or downloaded it. Only after the administrator confirms rights
may they use the separate `admin_sync_course_folder` dry run and rights-review flow.
Candidate sources must be reviewed before extraction, mapping, generation, or
publication. If Canvas does not offer PAT access, do not automate password-plus-OTP or
attempt to bypass MFA.

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
