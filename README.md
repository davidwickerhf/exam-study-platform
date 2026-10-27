# Exam Study Platform

Wicker Study connects a student's programme, academic results, timetable and Canvas
courses to a private study workspace. It includes versioned course material,
practice, assignment briefs, attendance, project progress and a persistent Tutor.
The maintained editorial library includes Statistics, Algorithmic Design,
Embedded Programming, Computer Security and Numerical Methods; connected Canvas
editions extend that library without mixing historical retakes into current rules.

Built with Next.js App Router, React, TypeScript and a Node API, with
self-hosted Better Auth sign-in and PostgreSQL storage. Production runs on a self-hosted
Coolify server (web, API and a pg-boss worker for durable Canvas and study jobs); see
[Hosting](docs/HOSTING.md). Local AI clients use the same account through MCP 2.9;
individual writes require explicit confirmation. Preferences and availability
can be shared with Tutor, and API-key requests are visible in Settings → AI activity.

The public site is available at `/`, with product information at `/about`, the
maintained catalogue at `/courses`, and the current privacy notice and terms at
`/privacy` and `/terms`. Authentication is a separate `/sign-in` surface; the
signed-in product lives at `/app`.

For production hosting (deploys, database, mail, jobs, env vars), see
[Hosting](docs/HOSTING.md). For the data model and content authoring workflow, see
[Hosted architecture](docs/HOSTED_ARCHITECTURE.md) and
[Content pipeline](docs/CONTENT_PIPELINE.md). Current deployment and agent workflows:
[Deployment separation](docs/DEPLOYMENT_SEPARATION.md),
[MCP and confirmed writes](docs/AGENT_ACCESS.md),
[Canvas collection](docs/CANVAS_CORPUS.md), and
[AI activity](docs/AGENT_ACTIVITY.md).

---

## Quick start

```bash
git clone https://github.com/davidwickerhf/exam-study-platform.git
cd exam-study-platform
npm install
npm run setup     # interactive: detects providers, picks one, seeds state
npm run dev       # Next.js + API server at http://localhost:4177
```

That's it. `npm run setup` is idempotent — re-run any time to switch LLM
provider, paste a new API key, or reset cache directories.

After the first start, the only command you need to launch it again is:

```bash
npm start
```

## Prerequisites

- **Node.js 22+** — the server uses ESM and the global `fetch`. macOS users
  with [Volta](https://volta.sh/) or [nvm](https://github.com/nvm-sh/nvm) are
  set; otherwise grab a build from [nodejs.org](https://nodejs.org).
- **One LLM provider** — pick at setup time:
  - **Codex CLI** — an installed Codex command-line client.
  - **Claude CLI** — `npm install -g @anthropic-ai/claude-code` then `claude login`.
  - **OpenAI API key** — recommended for hosted deployments; create a project or service-account key at [platform.openai.com](https://platform.openai.com/api-keys).
  - **Anthropic API key** — Most universal option. Get one at
    [console.anthropic.com](https://console.anthropic.com/settings/keys);
    setup will prompt for it.

You can also use the platform with **no provider** — chapter reading, published
question banks, flashcards, and local answer checks still work. Only grounded
tutor chat and personal extra exercises need an LLM.

## What you get out of the box

Everything below is shipped in the repo and ready to use immediately, no
generation required:

| Surface | Pre-loaded content |
|---|---|
| Chapter notes | ~50 chapters of markdown, every diagram inlined as SVG |
| Mock exam PDFs | 11 past papers across the 5 courses, with solutions where available |
| Tutorials (Computer Security only) | 8 tutorial sheets, with solutions where available |
| Practice exam parsing | All papers + tutorials pre-parsed into individual questions with model answers (~190 questions in the tutorials alone) |
| Mock question bank | 303 AI-generated questions across the 5 courses, tagged by chapter + topic |
| Flashcards | 743 cards across all 5 courses |
| PDF outlines | All shipped PDFs come with their content TOC pre-built |

Course-team content is read-only in the student UI. Students can add their own
flashcards and request quota-limited personal extra exercises.

## File layout

```
exam-study-platform/
├── content/                  # course materials (copied from vault)
│   ├── BCS1520 Statistics Knowledge Base/
│   ├── BCS1540 Algorithmic Design Knowledge Base/
│   └── ...
├── data/
│   ├── study-state.template.json   # ← committed: shared course definitions
│   ├── study-state.json            # ← gitignored: your progress
│   ├── flashcards.template.json    # ← committed: card content
│   ├── flashcards.json             # ← gitignored: your SR state
│   ├── llm-config.json             # ← gitignored: provider + API key
│   └── cache/                      # ← committed: generated content (questions, etc.)
├── app/                     # Next.js App Router pages and layouts
├── components/              # React site, auth, and workspace boundaries
├── public/                  # static assets and public-site stylesheet
├── lib/                     # typed/shared data plus backend services
├── server.mjs               # Node API and Next.js custom-server integration
├── setup.mjs                # interactive first-run setup
└── package.json
```

The product, legal, authentication, and signed-in study surfaces are React-owned.
Historical `/app#/…` links are translated to their corresponding `/app/*` route.

Run the complete framework verification before deploying:

```bash
npm run verify
```

## Configuration

`setup.mjs` writes `data/llm-config.json`. You can also edit that file
directly. Recognised fields:

```jsonc
{
  "provider": "codex" | "claude" | "openai" | "api",
  "codexBin": "/path/to/codex",                 // optional override
  "claudeBin": "claude",                        // optional override
  "openaiApiKey": "sk-proj-…",                  // required if provider=openai
  "openaiModel": "gpt-5-mini",                  // optional, defaults shown
  "openaiReasoningEffort": "low",                // minimal | low | medium | high
  "anthropicApiKey": "sk-ant-…",                // required if provider=api
  "anthropicModel": "claude-sonnet-4-5"         // optional, defaults shown
}
```

Every field above also has an env-var override:

| Field | Env var |
|---|---|
| `provider` | `LLM_PROVIDER` |
| `codexBin` | `CODEX_BIN` |
| `codexModel` | `CODEX_MODEL` |
| `claudeBin` | `CLAUDE_BIN` |
| `openaiApiKey` | `OPENAI_API_KEY` |
| `openaiModel` | `OPENAI_MODEL` |
| `openaiReasoningEffort` | `OPENAI_REASONING_EFFORT` |
| `anthropicApiKey` | `ANTHROPIC_API_KEY` |
| `anthropicModel` | `ANTHROPIC_MODEL` |

Env vars win over the config file. Useful for one-off testing:

```bash
LLM_PROVIDER=openai OPENAI_API_KEY=sk-proj-xxx npm start
```

## Local test user

By default the app runs from files and every request is `local-dev`. That is
enough for study workflows, but the editorial pipeline, the admin area, and
personal records only exist in the database — so those surfaces cannot be
exercised locally without a way to be somebody against a real database.

`WICKER_LOCAL_USER` is that way. Set it, point `DATABASE_URL` at a database,
and leave `BETTER_AUTH_SECRET` unset:

```bash
# .env — development only, never commit real credentials
DATABASE_URL=postgresql://…            # a throwaway local database, not production
WICKER_LOCAL_USER=user_localtest       # every request acts as this user
WICKER_LOCAL_USER_EMAIL=test@example.com   # optional; drives programme scoping
ADMIN_USER_IDS=user_localtest          # optional; makes that user an admin
```

```bash
npm run dev   # startup prints: Authentication: local-test-user
```

Then open <http://localhost:4177/app/admin>.

Notes:

- **Use a throwaway database, not production.** Run a local Postgres with
  pgvector (or restore a dump into one) and put its connection string in
  `DATABASE_URL`. The test user writes real rows; never point it at the
  production `exam_study` database.
- **Admin rights are explicit.** `ADMIN_USER_IDS` is the same mechanism used in
  production, so name the test user there to reach `#/admin`.
- **It refuses to start where it could matter.** Setting `WICKER_LOCAL_USER`
  with `NODE_ENV=production`, on a Vercel runtime, or alongside `BETTER_AUTH_SECRET` is a startup
  error, not a warning: it would let an unauthenticated caller act as a real
  user.
- **It replaces sign-in entirely.** There is no sign-in page in this mode and
  no session; the browser simply is that user.

## Hosted sign-in (Better Auth)

Sign-in is self-hosted [Better Auth](https://www.better-auth.com), served by
the API service at `/api/auth/*` on the study origin (the web service proxies
it like every other `/api` path). Its tables (`auth_user`, `auth_session`,
`auth_account`, `auth_verification`) come from `db/050_better_auth.sql` and
are applied by `npm run db:migrate`.

| Variable | Service | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | api, web | Signs session cookies (`openssl rand -base64 32`). The web service only checks that it is set. |
| `BETTER_AUTH_URL` | api | Public origin, e.g. `https://study.wicker.life`. |
| `SMTP_URL` | api | nodemailer URL for verification, sign-in and reset codes. Without it production refuses sign-up, codes and resets; development prints codes to the console. |
| `EMAIL_FROM` | api | Sender, default `Wicker Study <noreply@study.wicker.life>`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | Optional Google sign-in. Redirect URI: `https://study.wicker.life/api/auth/callback/google`. |

Methods: email + password (verified once by a 6-digit code), sign-in code by
email, password reset by code, and Google when configured. Account creation is
refused for addresses outside `lib/access-policy.mjs`. The global admin role is
`auth_user."wickerStudyRole" = 'admin'`; `ADMIN_USER_IDS` works as before.

History: Clerk users were moved to Better Auth on 2026-10-26, keeping their
`user_…` ids and bcrypt password digests. Clerk is no longer used; the one-off
import script is in git history.

## Pulling updates

When the maintainer adds new chapters or papers:

```bash
git pull
# Your data/study-state.json and data/flashcards.json keep your progress.
# New course definitions appear in the template; merge them manually if you
# want them in your working state (or rerun `npm run setup` and choose
# "overwrite" if asked).
```

The current template-merge story is intentionally manual — automating it
without trampling on personal progress is a future improvement.

## Privacy and account controls

In local mode, personal state lives in ignored flat files under
`data/users/local-dev/`; only configured AI requests leave the machine. In
hosted mode, self-hosted Better Auth provides sign-in, PostgreSQL stores per-user study state
and AI usage, the service runs on the operator's own server in the EU, and the configured AI provider receives
only requested tutor, further-exercise, or academic-plan extraction inputs.
Curriculum and transcript files are processed as an import draft; the original
files are not retained, and only the academic fields the user reviews and
confirms are saved. Timetables, transcripts, exam schedules, curricula, and
calendar feeds are cross-checked against the courses selected in the active
academic plan. Unselected courses and conflicting facts remain unchecked until
the user explicitly accepts them; a source omission never deletes a course.

Signed-in users can see their AI allowances in Settings, export their active
personal record as JSON, and permanently delete both the stored personal record
and the sign-in identity. The shipped templates and published course
sources are shared editorial content and contain no personal attempts, mistake
history, or mastery scores.

## Maintainer notes

Re-syncing content from a source vault:

```bash
# Adjust the source path to wherever your Obsidian vault lives
rsync -a --delete \
  ~/Projects/personal/notes/University/June\ Exams/ \
  ./content/
```

`VAULT_ROOT` env var: if set, overrides `state.meta.vaultRoot`. Useful when
the maintainer wants the platform to read from the original vault instead of
the bundled `content/` directory while developing.

## License

Personal study material. Course PDFs belong to their respective course
coordinators at Maastricht; please don't redistribute beyond your study
group.

Feedback-system proposal: [implementation plan](docs/plans/FEEDBACK_SYSTEM.md) (planned, not shipped). Automatic Canvas scheduling and its Settings controls are documented in [Canvas collection](docs/CANVAS_CORPUS.md#recurring-refresh).

### Student study versions

On a course page, choose **Create version** to generate source-grounded chapters,
summaries, exercises and flashcards privately. Refresh selected sources as lectures
arrive, keep revision history, and explicitly publish a selected community version or
submit it for editorial review. Settings → **AI key** supports personal OpenAI or
Anthropic billing beyond the included allowance. See [generation, limits and tests](docs/design/student-study-versions.md).
