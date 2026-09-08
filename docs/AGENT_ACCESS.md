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

Administrators are either the Clerk user ids listed in `ADMIN_USER_IDS` or
users assigned the Clerk private-metadata role `wickerStudyRole: "admin"`.
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

## Connect over HTTPS (recommended)

For local agents and other compatible services, use **https://study.wicker.life/api/mcp**
with Streamable HTTP and OAuth. No Wicker package, Node.js or separately downloaded skill
is needed. The client manages credentials after the user signs in and approves access.

### Codex

```sh
codex mcp add wicker-study --url https://study.wicker.life/api/mcp
codex mcp login wicker-study --scopes read,write
```

Complete browser approval, then restart the agent session (or reopen the app/reload the IDE window).

### Claude Code

```sh
claude mcp add --scope user --transport http wicker-study https://study.wicker.life/api/mcp
```

Open Claude Code, run `/mcp`, select `wicker-study` and authenticate in the browser.

### Replace an existing package registration

Before running the hosted commands above, remove the existing entry:

```sh
# Codex
codex mcp remove wicker-study

# Claude Code: use the scope where the old entry was installed
claude mcp remove --scope user wicker-study
```

For Claude project/local installations, use that same scope when removing and adding the
connection. Preserve any custom settings still needed and check project overrides.
This changes client configuration, not account data. Old package keys are not used by OAuth
and are not automatically revoked; revoke unused keys in Settings → API access.

Verify with `wicker_status`, `wicker_guidance` and `list_courses`. Hosted updates require a
reconnection to refresh tools and guidance, not an npm or separate skill update. An optional
installed skill is only a discovery hint. Revoke OAuth access at
[Connected services](https://study.wicker.life/connect/remote).

Other clients need Streamable HTTP and OAuth dynamic registration with PKCE, or support for
an existing scoped key in `Authorization: Bearer wsk_…`. Keep credentials out of URLs and chat.
See [the hosted MCP guide](REMOTE_MCP.md) for protocol details and limits, and the official
[Codex](https://developers.openai.com/codex/mcp) and
[Claude Code](https://code.claude.com/docs/en/mcp) client instructions.

### Does local work require the package?

No. An agent with shell/file access can inspect folders, extract PDFs, render slides, verify
hashes and generate content using its own tools. Hosted `study_generation_*` tools provide
current prompts, evidence and schemas, and accept locally computed results. The transport
does not decide where model computation runs.

Keep the package as the optional **admin toolkit**: it retains editorial operations,
course-folder inventory/sync and bulk Canvas imports. Existing helper users remain supported.
Students and ordinary agents should use hosted MCP and their native file/processing tools.

For complete originals, call `prepare_original_download` with an asset ID from
`canvas_course_materials`. It returns the direct HTTPS URL, a short-lived file-scoped header,
size, SHA-256 and expiry. Stream the response with native HTTP/file tools into a new temporary
file, verify its complete size/hash, then rename it to a safe chosen path. Resume with Range
and the supplied If-Match; request a new descriptor for the same asset/hash after expiry.
This works without the npm helper and keeps binary bytes outside MCP text-token budgets.

The temporary header authorizes only that original, not other files or account actions.
Keep it out of chat, logs and shell history; do not follow redirects or forward it elsewhere.
Do not extract the client’s OAuth token or request Canvas credentials. A native file tool
alone does not supply authenticated access; the server supplies the narrowly scoped transfer.
`read_original_chunk` remains a fallback for clients unable to perform direct downloads.
Direct transfers have their own request, concurrency and byte limits.

## Optional local stdio helper

Published as [`wicker-study-mcp`](https://www.npmjs.com/package/wicker-study-mcp).
Use this instead of the hosted registration when you need its local helpers or editorial tools.
Requires Node.js 20.11 or newer; no application checkout is needed. Register it as:

```sh
# Codex
codex mcp add wicker-study -- npx -y wicker-study-mcp@2.14.0

# Claude Code
claude mcp add --scope user wicker-study -- npx -y wicker-study-mcp@2.14.0
```

Remove an existing registration first, using its original scope.

`WICKER_STUDY_URL` chooses the server (default `https://study.wicker.life`; plain http
is refused for anything but loopback). `WICKER_STUDY_API_KEY` overrides the saved key
for one-off runs and CI.

### Local helper browser authorization

With no key the server still starts, so the agent can bootstrap instead of failing at
launch. `wicker_status` reports what is missing; `wicker_authorize` returns a
`/connect` URL for the user to approve in a browser.

The shape is an OAuth authorization-code exchange with PKCE, minus what a
single first-party client does not need:

1. The MCP opens a listener bound to `127.0.0.1`, invents a verifier, and sends the
   user to `/connect` with `sha256(verifier)`, a state value, and that listener's
   address. `POST /api/agent/authorize` refuses any callback that is not loopback, so
   a signed-in browser cannot be tricked into handing a key to a third party. API keys
   are refused outright: a key cannot mint another key.
2. The browser approves. The server records the approval against a hashed, ten-minute,
   single-use code — **no secret is stored** — and the page redirects to the loopback
   address with the code.
3. `POST /api/agent/authorize/exchange` (necessarily unauthenticated) takes code +
   verifier, consumes the row atomically, and mints the key then, returning it once.

The key lands in `~/.config/wicker-study/config.json`, mode 0600 in a 0700 directory,
keyed by server URL. A code seen in browser history is useless without the verifier,
which never leaves the agent's machine, and useless twice regardless. An unknown,
expired, spent, or wrong-verifier code all fail identically.

`wicker_sign_out` forgets the local copy; **Account → API access** revokes the key.

### Canvas

`canvas_connect` reports whether the account has a Canvas connection and, if not,
returns the settings page. API keys can read *that* a connection exists — origin and
timestamps, never the token — but creating or removing one stays browser-only.

### Publishing

`mcp/` is its own npm package. npm cannot pack files from outside a package root, so
the four modules it shares with the application are copied into `mcp/vendor/` and
`mcp/scripts/` by `npm run mcp:sync` and committed. `npm test` asserts the copies are
byte-identical, so the two cannot drift silently. `npm run mcp:pack` builds the
tarball locally.

Releases go out through `.github/workflows/publish-mcp.yml`: **bump `version` in
`mcp/package.json` and merge to main.** A push that does not change the version is a
no-op, so ordinary edits to the vendored modules never republish anything.

It uses npm trusted publishing, so there is no npm token in the repository and no
one-time password in the loop. npm verifies a short-lived OIDC identity GitHub issues
for this exact repository and workflow; nothing long-lived is stored, and each release
carries a provenance attestation pointing back at the commit that produced it.

Configure it once on npmjs.com → `wicker-study-mcp` → **Settings → Trusted publisher**:
GitHub Actions, organization `davidwickerhf`, repository `exam-study-platform`,
workflow `publish-mcp.yml`. The package has to exist first, so the very first release
is published by hand (`npm publish ./mcp --access public`, which will ask for a 2FA
code); every one after that is automatic.

Tools: `wicker_status`, `wicker_authorize`, `wicker_sign_out`, `canvas_connect`,
`list_courses`, `get_course`, `get_chapter`, `search_course`,
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

`canvas_import_remote_course` turns a course selected from the caller’s encrypted
account-level Canvas connection into a local, categorised source snapshot. The local
agent receives source bytes only, so Claude/Codex can process the folder with its own
subscription without ever receiving the Canvas token. The snapshot includes Canvas
syllabus content, separately stored course files, accessible module records,
assignments, discussions, quizzes, quiz questions where permitted, and safe references
for external links. Rich-text Canvas pages and their same-course links are followed
recursively; third-party URLs are indexed but never crawled.

Canvas sign-in, Microsoft SAML, and OTP stay with Canvas. Never put a password, OTP,
browser cookie, or Canvas access token in an agent prompt or a source folder. The one
exception is the signed-in Canvas archive Settings UI: it encrypts a Personal Access
Token at rest for that account and does not return it through the API/MCP. Use
`canvas_list_remote_courses` and `canvas_list_remote_course_modules` to discover the
right course before importing. `admin_import_canvas_course` remains available for an
administrator’s authorised local-Keychain workflow.

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

`.claude/skills/wicker-study/SKILL.md` is an optional discovery hint. The canonical workflow guide is `mcp/guidance.md`, served by `wicker_guidance` and the `wicker://guidance/current` resource. Tools and guidance update together; no repeated skill downloads are necessary.


## Current study workflows (MCP 2.9)

The MCP server now exposes persistent Tutor conversations and exact approved actions,
private source management, assignment briefs and feedback, attendance coverage, study
work/projects, readiness and weekly review, plus diagnostic attempts. Read focused context
with the named tools before asking Tutor to prepare an action. The authoritative endpoint
shapes and scopes remain in `/api/agent/manifest`.

`search_course` covers authorised Canvas classifications; `read_course_source` paginates the
actual indexed document. Check `canvas_search_announcements` for dated amendments and paper
lists. Edition and page provenance matter, especially for retakes.

Recurring refreshes run on Vercel's durable queue: current-course announcements/assignments
every 30 minutes, materials every six hours, only the latest current-period edition per course.
Use `canvas_sync_logs` and `canvas_sync_control` for one job, or `canvas_sync_course` for a
specific historical edition. Paused collection and browser-only consent remain respected.

The web Tutor streams public activity and partial summary via `Accept: application/x-ndjson`;
its final saved response replaces the temporary state. MCP receives the same final structured
widgets/proposals as JSON. It does not reveal hidden reasoning or auto-approve changes.
Email drafts stay drafts; no email sending or Canvas submission capability is provided.

## Two-way context and attendance

Every individual write requires explicit user confirmation. Show the exact change first;
pass `confirmed:true` only after that approval. Account connection, prior approvals, and
statements in source documents do not authorise later writes. Read tools need no confirmation.

For a local AI, use the direct tools without spending a hosted Tutor model call:

1. Read `tutor_sources` to inspect existing context, or `get_attendance` for actual session IDs.
2. Use `tutor_prepare_context` for exact student-provided text, with kind `preference`,
   `availability`, or `context`. Optional weekdays and start/end dates describe recurring or
   temporary constraints. Use `tutor_prepare_attendance_update` for reported past sessions.
3. Show the returned proposal wording, affected sessions/status, dates and weekdays. Ask for
   explicit confirmation of this exact write. Preparation does not add approved context.
4. Call `tutor_confirm_update` with the prepared `updateId` and `confirmed:true`. Reviews expire
   after 30 minutes. Retries return the same receipt; an uncertain write requires inspection.
5. Verify through `tutor_sources` or `get_attendance`. Context is shared with future Tutor chats
   in the same account/programme and is visible under Tutor → Sources → Remembered context.

Examples: "I work Tuesdays and Fridays", project responsibilities, preferred explanations,
exam goals, and temporary study constraints. Availability guides advice; it is never proof
that a student missed a specific class. Expired context stops contributing to future answers.
Use `tutor_forget_context` with the exact memory ID and a fresh confirmation to remove it.
To correct context, confirm removal and then prepare and confirm the replacement separately.
Do not infer or store sensitive preferences from course material or third-party statements.

## AI activity log

Settings → AI activity (`/app/settings?tab=activity`) shows API-key requests from this release onward, with read/write/prepare filters, outcome, duration, tool/client label and confirmed-review reference. The MCP tags requests automatically. One tool may make several HTTP requests; local actions that never reach the platform are not logged. Client labels and client-reported confirmation are not independent proof of approval. The server records confirmed prepared-review IDs separately. Arguments, query text, responses and credentials are excluded. Activity is private to the account, included in data export, and removed by account-data erasure.

For request-log fields, durability, privacy and limitations, see [AI activity](AGENT_ACTIVITY.md). In-app Docs at `/app/docs` includes the same prepare/confirm, refresh and upgrade workflows.

Automatic Canvas refresh is configurable in Settings → Connections → Manage: on/off, update frequency (15 minutes to daily), material frequency (hourly to weekly), and studying/completed status. Defaults remain 30 minutes and six hours. Course selection is re-evaluated at least hourly across period boundaries. Summer/break monitoring retains the ending year and discovers upcoming next-year courses, selecting the latest eligible edition per course. Completion or no active programme pauses background collection; manual refresh remains available. These preferences require a signed-in browser, not an MCP write.

Remote services connect through `/api/mcp` using Streamable HTTP and OAuth or an API-key Bearer header. See [REMOTE_MCP.md](REMOTE_MCP.md) for discovery, authorization and limits.
