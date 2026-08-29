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

## Discovering the API

`GET /api/agent/manifest` returns every endpoint with its scope and body shape.
It is the source of truth; the summary below is for orientation.

- Read: `/api/courses`, `/api/courses/{id}`, `/api/chapter/{course}/{chapter}`,
  `/api/retrieve`, `/api/questions/{course}/{chapter}`, `/api/flashcards/{course}`,
  `/api/sr/due`, `/api/mistakes`, `/api/mocks`, `/api/academics`, `/api/activity`.
- Write: `/api/grade`, `/api/items/{id}` (PATCH), `/api/sr/review`,
  `/api/flashcards/…`, `/api/mistakes/{id}/resolve`, `/api/activity` (read events),
  `/api/academics` (PUT with `expectedRevision`).
- Admin: `/api/admin/status`, `/api/admin/courses/{id}` (+ `/chapters`,
  `/materials`, `/items`, `/papers`, `/chapters/{id}/questions`), `/api/admin/programmes/{id}`.

Editorial writes act on the **active release** in Neon and take effect
immediately (caches are invalidated). Local servers answer 501 for them.

Published question banks are stored in `editorial_questions` (db/009), seeded
once from `data/cache/questions/` on the first hosted start. The programme
catalogue is stored in `editorial_programmes`, seeded from
`data/editorial-programmes.json`. After seeding, the database is authoritative.

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
`set_course_visibility`, and the `admin_*` family (courses, chapters, materials,
items, papers, questions, programmes).

## Claude skill

`.claude/skills/wicker-study/SKILL.md` teaches Claude Code the workflows above
(reading, studying on a student's behalf, maintaining content). It is picked up
automatically in this repository; copy it into another project's
`.claude/skills/` to use it there.
