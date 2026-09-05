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
WICKER_STUDY_URL='https://study.wicker.life' WICKER_STUDY_API_KEY='wsk_…' npx -y wicker-study-mcp@2.8.0 configure
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

## Licence

MIT.
