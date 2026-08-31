# Agent and administrator access

Wicker Study has one HTTP API. The web app, agents, and administrators all use
it; personal API keys make it reachable outside the browser.

## Keys and scopes

Create keys under **Account → API access**. Each key acts as the user who created
it and carries scopes:

| Scope | Grants |
| --- | --- |
| `read` | every `GET` endpoint: course material, questions, progress, plan, activity |
| `write` | study mutations: answers, reviews, flashcards, mistakes, mocks, mastery, plan |
| `admin` | editorial content and the programme catalogue (administrators only) |

Administrators are the Clerk user ids listed in `ADMIN_USER_IDS` (comma-separated).
In local development without a database, `local-dev` is an administrator.

Keys are stored as SHA-256 hashes (`api_keys`, db/008). They cannot manage other
keys, reset data, or delete the account — those need a signed-in session.

Send the key as `Authorization: Bearer wsk_…`. Keys work in every mode
(Clerk-protected production and local development).

## Programmes and organisations

Each maintained programme is an organisation. A key acts inside its owner's
memberships: `GET /api/me` lists them (`programmes[]` with `role` `member` or
`admin`); `POST /api/account/programme { programmeId }` joins a programme
whose institution domains match the owner's email. Programme admins may
update their own programme, its institution calendar, and its members
(`/api/admin/programmes/{id}/members[/{userId}]`) without being global
administrators; only global administrators grant the admin role.

## Discovering the API

`GET /api/agent/manifest` returns every endpoint with its scope and body shape.
It is the source of truth; the summary below is for orientation.

- Read: `/api/courses`, `/api/courses/{id}`, `/api/chapter/{course}/{chapter}`,
  `/api/retrieve`, `/api/questions/{course}/{chapter}`, `/api/flashcards/{course}`,
  `/api/sr/due`, `/api/mistakes`, `/api/mocks`, `/api/academics`, `/api/activity`.
- Write: `/api/grade`, `/api/items/{id}` (PATCH), `/api/sr/review`,
  `/api/flashcards/…`, `/api/mistakes/{id}/resolve`, `/api/activity` (read events),
  `/api/academics` (PUT with `expectedRevision`), `/api/academics/documents/analyze`
  + `/apply` (supporting documents → reviewable change set), `/api/academics/calendars` (.ics links).
- Admin: `/api/admin/status`, `/api/admin/editorial-workspace`,
  `/api/admin/editorial-editions/{id}` (+ `/sources`, `/process`, `/estimate`,
  `/generate`, `/publish`), `/api/admin/editorial-contributions/{id}`,
  `/api/admin/editorial-artifacts/{id}`, `/api/admin/courses/{id}` (+ `/chapters`,
  `/materials` with `/materials/extract` for PDFs, `/items`, `/papers`,
  `/chapters/{id}/questions`, `/chapters/{id}/flashcards`), `/api/admin/programmes/{id}`
  (+ `/calendar` for the institution-wide academic calendar).

The editorial workspace is private and versioned; its writes do not affect
students until explicit publication. Legacy `/api/admin/courses/*` writes act
on the **active release** immediately and remain available for small reviewed
corrections. Local servers answer 501 for hosted editorial writes.

Published question banks are stored in `editorial_questions` (db/009), seeded
once from `data/cache/questions/` on the first hosted start. The programme
catalogue is stored in `editorial_programmes`, seeded from
`data/editorial-programmes.json`; editorial flashcards in `editorial_flashcards`
(db/010), seeded from `data/flashcards.template.json`. After seeding, the
database is authoritative.

Course-source PDFs are text-extracted with Poppler and indexed per page;
Tesseract handles scanned pages and images, while `unzip` extracts DOCX/PPTX
text. Public URLs pass DNS and redirect validation before fetching.

## MCP server

`mcp/server.mjs` wraps the API as MCP tools over stdio.

```json
{
  "mcpServers": {
    "wicker-study": {
      "command": "node",
      "args": ["/path/to/exam-study-platform/mcp/server.mjs"],
      "env": {
        "WICKER_STUDY_URL": "https://study.wicker.life",
        "WICKER_STUDY_API_KEY": "wsk_…"
      }
    }
  }
}
```

Or from a checkout: `WICKER_STUDY_URL=… WICKER_STUDY_API_KEY=… npm run mcp`.

Tools: `list_courses`, `get_course`, `get_chapter`, `search_course`,
`list_questions`, `get_practice_queue`, `get_progress`, `list_flashcards`,
`list_due_cards`, `list_mistakes`, `list_mock_sessions`, `get_mock_session`,
`get_academic_plan`, `list_known_programmes`, `get_activity`, `get_account_summary`,
`submit_answer`, `set_mastery`, `review_card`, `add_to_deck`, `create_flashcard`,
`review_flashcard`, `resolve_mistake`, `record_chapter_read`, `save_academic_plan`,
`set_course_visibility`, and the `admin_*` family (courses, chapters, materials
including `admin_extract_material`, items, papers, questions, flashcards,
programmes, and the complete course-folder/editorial workflow).

### Lazy administrator course workflow

Point the local MCP process at the folder that contains the relevant course
material and ask the agent to maintain the course. It should:

1. Call `admin_inventory_course_folder` and then
   `admin_sync_course_folder` with its default dry run.
2. Show additions, replacements, reused hashes, and possible retirements. Run
   the sync with `dryRun=false`; use `replaceManifest=true` only when the folder
   is the authoritative complete set.
3. Run extraction without AI, then run the course map with AI. Inspect the
   evidence-linked assessment scheme, especially weights, pass rules, and
   deadlines.
4. Call `admin_estimate_course_generation`, show the estimate, and only then
   call `admin_queue_course_generation` with `confirmed=true`.
5. Process bounded batches, inspect failures and drafts, edit/approve artifacts,
   and publish only when the administrator explicitly asks and supplies the
   course-code confirmation.

Re-running the same folder is an incremental update. The MCP never needs the
model to read and resend unchanged source text.

### Canvas Modules import

`admin_import_canvas_course` turns an accessible Canvas course Modules URL into a
local, categorised source snapshot: module folders for downloadable files, readable
records for pages, assignments, discussions and quizzes, and safe references for
external links. It defaults to local-only and produces a hidden import manifest so
the administrator can inspect the collection before Wicker receives any source.

Canvas sign-in, Microsoft SAML, and OTP stay with Canvas. Do not put a password, OTP,
browser cookie, or Canvas access token in Wicker Study, an agent prompt, or a source
folder. After the administrator signs in to Canvas, they may create a short-lived
Personal Access Token if their institution permits it. Calling
`admin_import_canvas_course` with no arguments on macOS opens one local import panel
for the course URL, Finder output folder, and secure one-time token field; it is not
saved. An environment variable is used only when explicitly passed as `accessTokenEnv`.

```json
{}
```

Only after confirming they are authorised to submit the materials should an
administrator set `syncToWicker:true`, `rightsConfirmed:true`, and eventually
`dryRun:false`. This creates private **candidate** contributions. Rights acceptance,
extraction, mapping, generation, and publication remain separate approvals. Re-run the
importer into the same folder for weekly Canvas additions, then use the normal folder
sync to transmit only new or changed files. Paths that disappeared from Canvas are
reported for review and never deleted automatically.

## Claude skill

Install for your user with one command (the skill is published by the app):

```bash
mkdir -p ~/.claude/skills/wicker-study && curl -fsSL https://study.wicker.life/skills/wicker-study/SKILL.md -o ~/.claude/skills/wicker-study/SKILL.md
```

The public `/docs` page carries the same instructions for students.

`.claude/skills/wicker-study/SKILL.md` teaches Claude Code the workflows above
(reading, studying on a student's behalf, maintaining content). It is picked up
automatically in this repository; copy it into another project's
`.claude/skills/` to use it there.
