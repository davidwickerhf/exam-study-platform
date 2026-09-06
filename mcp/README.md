# wicker-study-mcp

MCP server for [Wicker Study](https://study.wicker.life) — a private, source-grounded academic
workspace. It gives an agent read access to course material and a student's academic record, the
ability to study on their behalf, a Canvas course importer that never sees the Canvas token, and —
with an admin key — the whole editorial content workflow.

Runs from anywhere. Nothing here needs a checkout of the application.

## Use it

The authenticated **Docs** page in Wicker Study can mint a scoped key and place it directly inside
one copy-ready Codex or Claude Code installation block. There is no separate credential field to
copy. The first line stores the embedded key with owner-only permissions and the second registers
the MCP server.

For a manually supplied key, the same secure bootstrap is available as:

```sh
WICKER_STUDY_URL='https://study.wicker.life' WICKER_STUDY_API_KEY='wsk_…' npx -y wicker-study-mcp@2.10.0 configure
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
- **Canvas** — `canvas_connect`, `canvas_updates` (announcements, assignments with
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
- Sync: `canvas_corpus_status`, `canvas_corpus_sync`, `canvas_sync_course`, `canvas_sync_logs`, `canvas_sync_control`. Latest current-period editions refresh updates every 30 minutes and materials every six hours. Historic retakes stay available on demand; unchanged resources reuse their durable originals/indexes.
- Personal study context: `get_study_work`, `get_attendance`, `get_course_obligations`, `get_study_readiness`, `get_weekly_review`.
- Persistent Tutor: `tutor_history`, `tutor_conversation`, `tutor_ask`, `tutor_approve_action`, `tutor_delete_conversation`.
- Private draft/source context: `tutor_sources`, `tutor_add_source`, `tutor_remove_source`.
- Formative practice: `get_study_diagnostic`, `answer_study_diagnostic`.

Direct context reads do not call the model. `tutor_ask` uses the student's AI allowance and can prepare attendance changes, assignment/catch-up trackers, group milestones, focused practice, diagnostics and rubric-based draft reviews. Reuse conversation IDs. Approve only the exact proposal the student reviewed; receipts prevent double application. No tool sends email or submits assignments to Canvas. Personal completion is separate from Canvas submission status.

Update an installed client to `wicker-study-mcp@2.10.0` and restart its MCP connection to discover the new tools. The companion skill is served at [SKILL.md](https://study.wicker.life/skills/wicker-study/SKILL.md); re-download it to update an existing copy.

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
