# wicker-study-mcp

MCP server for [Wicker Study](https://study.wicker.life) — a private, source-grounded academic
workspace. It gives an agent read access to course material and a student's academic record, the
ability to study on their behalf, a Canvas course importer that never sees the Canvas token, and —
with an admin key — the whole editorial content workflow.

Runs from anywhere. Nothing here needs a checkout of the application.

## Finding published courses and Canvas materials

`list_courses` lists published study courses with chapters and progress; it is not
an inventory of Canvas enrolments or stored originals. `get_course` accepts the
exact published `id` from that list, not a Canvas numeric ID or course code.
An empty list or a missing published course does **not** establish that Canvas
material is absent.

For Canvas material, discover the stable course code and academic-year editions
with `canvas_corpus_status` (or find course codes in `get_academic_plan`). Call
`canvas_course_materials({courseCode, academicYear})` for the stored originals,
and `search_course({courseCode, query, academicYear})` for indexed passages.
`search_course` requires a nonblank query and at least one nonblank `courseId`,
`courseCode`, or `canonicalCourseId`; use `courseCode` even if the course has no
published study guide. Omit `academicYear` only when searching across editions.
If an inventory or search is empty, check collection status and sync logs before
claiming that Canvas itself has no material. A tool error is not an empty result.

MCP discovery includes explicit `readOnlyHint` annotations. These describe tool
behavior; they do not replace key scopes or the student's confirmation for
writes. Draft preparation, local file downloads and generation continuations
can still write even when no additional approval is needed for that step.

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
See [the hosted MCP guide](../docs/REMOTE_MCP.md) for protocol details and limits, and the official
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

## Optional local package setup

Use the package for the helper workflows described above. It requires Node.js 20.11 or newer.
Register it as a stdio server below, then let `wicker_authorize` open browser approval when no
saved key exists. No key needs to be pasted into the agent conversation.

For a manually supplied key, the same secure bootstrap is available as:

```sh
WICKER_STUDY_URL='https://study.wicker.life' WICKER_STUDY_API_KEY='wsk_…' npx -y wicker-study-mcp@2.14.2 configure
```

```jsonc
// Claude Desktop / Claude Code / Cursor MCP config
{
  "mcpServers": {
    "wicker-study": {
      "command": "npx",
      "args": ["-y", "wicker-study-mcp"]
    }
  }
}
```

Then ask the agent to connect. It calls `wicker_status`, finds no key, calls `wicker_authorize`,
and gives you a URL to approve in your browser. The key comes straight back to your machine over
loopback and is saved for every future session.

No environment variable is required. Two are honoured when set:

| Variable | Meaning |
| --- | --- |
| `WICKER_STUDY_URL` | Which server to use. Default `https://study.wicker.life`. Use `http://localhost:4177` for a local development server; plain http is refused for anything else. |
| `WICKER_STUDY_API_KEY` | Use this key instead of the saved one. Always wins, so a one-off run and CI never pick up a developer's saved key. |

## Where the key lives

`~/.config/wicker-study/config.json`, mode `0600` in a `0700` directory, keyed by server URL so a
local and a production key never overwrite each other. `wicker_sign_out` removes it. Revoke the key
itself under **Account → API access** in the web app.

The key is never printed, never a tool argument, and never sent to a host other than the one it was
minted for. Wicker Study will only deliver it to a loopback address, so a link that asks for
anything else is refused by the approval page.

## Canvas

Canvas material is reached through the account's own encrypted connection, not through the agent.
Call `canvas_connect` first: it reports whether the account has a Canvas connection and, if not,
returns the page where the student pastes their Canvas Personal Access Token — in their browser.

**Never ask a user for a Canvas token, password, MFA code, cookie, or session export in chat.** The
agent receives proxied course data and nothing else.

## Tools

`wicker_status`, `wicker_authorize`, `wicker_sign_out`, and `canvas_connect` work without a key —
they are how a key is obtained. Everything else needs one.

- **Reading** — `list_courses`, `get_course`, `get_chapter`, `get_course_outline`, `search_course`, `list_regulation_sources`, `search_regulations`,
  `list_materials`, `list_questions`, `get_practice_queue`, `get_progress`, `list_flashcards`,
  `list_due_cards`, `list_mistakes`, `list_mock_sessions`, `get_mock_session`, `get_academic_plan`,
  `get_planning_context`, `list_known_programmes`, `get_calendar`, `get_activity`,
  `get_account_summary`, `whoami`
- **Studying** — `submit_answer`, `set_mastery`, `review_card`, `add_to_deck`, `create_flashcard`,
  `review_flashcard`, `resolve_mistake`, `record_chapter_read`, `save_academic_plan`,
  `update_planning_objective`, `set_course_visibility`, `join_programme`
- **Documents and calendars** — `analyze_documents`, `apply_changes`, `preview_calendar`,
  `save_calendar_link`, `sync_calendar_link`, `remove_calendar_link`
- **Canvas** — `canvas_groups` (your course teams and global memberships; pass a group ID to read teammates), `canvas_connect`, `canvas_updates` (announcements, assignments with
  submission state, events, grades), `canvas_course_requirements` (syllabus and the
  module item carrying the assessment rules), `canvas_list_remote_courses`,
  `canvas_list_remote_course_modules`, `canvas_import_remote_course`,
  `canvas_import_remote_course_set`
- **Editorial (admin key)** — the `admin_*` family: course editions, source folders, rights review,
  extraction, mapping, generation, artifact review, and publication.

`GET /api/agent/manifest` (also exposed as the `wicker-study://manifest` resource) is the
authoritative list of endpoints and scopes.

## Study workflow tools (2.9)

- Source reading: `read_course_source`, `canvas_course_materials`, `canvas_search_announcements`.
- Assignment details: `canvas_assignment_detail` returns the full brief, deadlines, own submission, rubric and comments; link to the first-party Updates assignment view.
- Refresh course materials: `refresh_course_materials({canvasCourseId, canvasUrl, confirmed:true})` queues an immediate refresh of one exact Canvas edition, matching the course page. Discover the ID, host and academic year with `canvas_corpus_status`; existing collection consent is required. Follow status/logs to completion, then read `canvas_course_materials`. Available through hosted MCP and the optional local package.
- Sync: `canvas_corpus_status`, `canvas_corpus_sync`, `canvas_sync_course`, `canvas_sync_logs`, `canvas_sync_control`. Latest current-period editions refresh updates every 30 minutes and materials every six hours. Historic retakes stay available on demand; unchanged resources reuse their durable originals/indexes.
- Personal study context: `get_study_work`, `get_attendance`, `get_course_obligations`, `get_study_readiness`, `get_weekly_review`.
- Persistent Tutor: `tutor_history`, `tutor_conversation`, `tutor_ask`, `tutor_approve_action`, `tutor_delete_conversation`.
- Private draft/source context: `tutor_sources`, `tutor_add_source`, `tutor_remove_source`.
- Formative practice: `get_study_diagnostic`, `answer_study_diagnostic`.

Direct context reads do not call the model. `tutor_ask` uses the student's AI allowance and can prepare attendance changes, assignment/catch-up trackers, group milestones, focused practice, diagnostics and rubric-based draft reviews. Reuse conversation IDs. Approve only the exact proposal the student reviewed; receipts prevent double application. No tool sends email or submits assignments to Canvas. Personal completion is separate from Canvas submission status.

Hosted users reconnect to discover the current tools. Optional package users update to `wicker-study-mcp@2.14.2` and restart their local MCP process. The matching workflow guide is served by `wicker_guidance` and `wicker://guidance/current`. No separate skill update is needed.

### Complete original downloads and remembered context

Prefer `prepare_original_download` with native HTTP/file tools on either connection. It provides a resumable direct transfer without exposing account credentials or putting binary bytes into MCP results. The helper below remains available for existing local clients.

Use `canvas_course_materials` to choose an exact asset/course/year, then call `download_course_original({assetId, courseCode, academicYear, outputFolder})`. The MCP streams the full stored original to a new private local subfolder and returns its path, size and SHA-256 only after verifying the complete file. PDFs, slide decks, images, spreadsheets and archives retain their original bytes. Existing files are never overwritten. Failed or incomplete downloads are removed. The maximum is 1 GB per file; larger files remain available through the authenticated web download. A remote MCP's filesystem may not be accessible to its client. This tool uses read scope and never scrapes Canvas or sends file bytes into the chat.

The server-supplied workflow guide instructs the agent to notice lasting preferences, project decisions, constraints and availability during normal discussions. It reads `tutor_sources` to avoid duplicates, prepares the exact new context, and asks for confirmation before saving with `tutor_confirm_update`. The agent reports a successful receipt instead of treating a draft or an ordinary chat reply as saved memory. Transient remarks and speculation are not stored, and tasks/attendance continue using their dedicated workflows.

## Licence

MIT.

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

Automatic Canvas refresh is configurable in Settings → Connections → Manage: on/off, update frequency (15 minutes to daily), material frequency (hourly to weekly), and studying/completed status. Defaults remain 30 minutes and six hours. Course selection is re-evaluated at least hourly across period boundaries. Summer/break monitoring retains the ending year and discovers upcoming next-year courses, selecting the latest eligible edition per course. Completion or no active programme pauses background collection; manual refresh remains available. These preferences require a signed-in browser, not an MCP write.

## Feedback (2.10)

Use `feedback_prepare` to create an exact report preview, then show it and obtain explicit user approval before `feedback_submit` with the unchanged draft ID and revision. `feedback_list` and `feedback_read` expose only the user’s reports and public replies. `feedback_reply`, `feedback_withdraw_evidence`, and `feedback_react` each require a fresh `confirmed:true` after individual approval. A prepared draft is not a submitted report. Never attach chat or source excerpts without the user choosing to share them. Feedback is separate from remembered Tutor context.

Students can follow reports and withdraw evidence at `/app/feedback`; authorized staff review them at `/app/admin/feedback`. See [the operations guide](../docs/FEEDBACK.md) for data boundaries and retention.

Contact sharing is optional per report: use `shareContactEmail:true` only when the student chooses it and show the returned address in the preview. `feedback_withdraw_contact` stops sharing it after fresh confirmation. Reports show receipt, investigation and completion updates with public comments; AI-assisted replies are labeled and reviewed by the team.

## Updating the optional package

Most users can switch to hosted MCP using the instructions above. If keeping the package, [Docs → Optional local helper](https://study.wicker.life/app/docs#local-tools) has its setup instructions. Reuse your saved credentials; do not generate a new API key or run `configure` again.

### Codex

```sh
codex mcp remove wicker-study
codex mcp add wicker-study -- npx -y wicker-study-mcp@2.14.2
```

Quit and reopen the Codex app, restart the CLI session, or reload the IDE extension window so the local MCP process restarts.

### Claude Code

```sh
claude mcp remove --scope user wicker-study
claude mcp add --scope user wicker-study -- npx -y wicker-study-mcp@2.14.2
```

Exit and restart Claude Code, then check `/mcp`. `claude mcp add` does not overwrite an existing registration. If you originally installed with `project` or `local` scope, use that same scope in both commands.

### Claude Desktop and custom configurations

In Claude Desktop, use Settings → Developer → Edit Config. Change only the package argument in the existing `wicker-study` entry to `wicker-study-mcp@2.14.2`, preserve its other settings, then fully quit and reopen Claude Desktop. For custom Codex/Claude Code configurations with environment variables or a server URL, update the package argument in place instead of replacing the registration. Check project overrides if an older version still loads.

The standard helper credentials stay in `~/.config/wicker-study/config.json`. These registration commands do not delete that file. After restarting, ask the agent to call `wicker_status` and `wicker_guidance` to verify connectivity and availability of the new tools. The optional companion skill is a stable discovery hint; the current guide comes from MCP.

Official client references: [Codex MCP configuration](https://developers.openai.com/codex/mcp), [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).

## Local study generation

Both hosted MCP and package 2.14.2 expose `study_generation_contract`, `study_generation_sources`, `study_generation_start`, `study_generation_next`, `study_generation_submit`, `study_generation_refresh`, `study_generation_stop`, and `study_generation_add_notes`. The package is not required for this workflow; an agent can use its own model and file tools with the hosted connection.

1. Read the current contract and list the course edition’s sources. If needed, obtain originals through `prepare_original_download` and stream/verify them with the client’s file tools, or use the optional package’s download/import helpers. Inspect graphics and preserve page numbers. Add supplementary extraction as explicitly labelled local notes.
2. Start the student-requested private run with its exact source selection, or continue a version prepared in the web UI.
3. Fetch `study_generation_next`. Use its exact evidence, prompt and response schema to compute one complete response locally. Use a fresh critique context for review steps and report real findings.
4. Submit with its `requestId` and `contractId`. Retry network failures with the identical payload. Fetch next again until complete. Failed content can be corrected with `retry:true`; ready chapters remain saved.

Prompts and schemas are fetched from the deployed platform every step. An implementation fingerprint rejects submissions after pipeline changes; fetch next again. No platform generation worker, model call or AI allowance is used. Your local provider/subscription costs still apply. Local semantic reviews are agent-supplied; platform schema, citations and deterministic quality checks are enforced. This is not independent editorial verification, and nothing is shared automatically.

## Hosted connections

Connect to **https://study.wicker.life/api/mcp** using Streamable HTTP. Choose OAuth in your MCP client, sign in and review the service name, callback origin and scopes. Discovery, dynamic client registration, S256 PKCE, resource-bound authorization codes, one-hour access tokens, rotating refresh tokens (30-day connection lifetime), and revocation are supported. Existing API keys also work in `Authorization: Bearer wsk_…`. OAuth is authorization-code based; client-credentials grants and anonymous account access are not supported.

Hosted tools share their schemas and implementations with this package. Filesystem imports and clipboard operations remain local. Hosted consumers can stream complete originals using `prepare_original_download` and native HTTP/file tools; verify the returned SHA-256 and byte size. `read_original_chunk` is a fallback. Only use tools listed by your connection. Guidance is served by MCP, so hosted clients reconnect to refresh it without npm or skill downloads.

See [remote MCP operations](../docs/REMOTE_MCP.md) for limits and configuration. Disconnect OAuth services under [Connected services](https://study.wicker.life/connect/remote). Revoke API keys separately in Settings → API access.
