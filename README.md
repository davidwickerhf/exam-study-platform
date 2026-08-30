# Exam Study Platform

A hosted or local study platform for the Maastricht BCS June 2026 resit window.
With editorial chapter notes, prepared mock exams, question banks, and
flashcards for five courses:

- **BCS1520** — Statistics
- **BCS1540** — Algorithmic Design
- **BCS2410** — Embedded Programming
- **BCS2420** — Computer Security
- **BCS2540** — Numerical Methods

Built with Next.js App Router, React, TypeScript, and an established Node API.
It publishes versioned editorial material to Neon, stores private progress
there behind Clerk authentication, and limits student AI access to
retrieval-grounded tutor chat plus explicitly requested personal extra
exercises. Answer checks run locally against published references.

The public site is available at `/`, with product information at `/about`, the
maintained catalogue at `/courses`, and the current privacy notice and terms at
`/privacy` and `/terms`. Authentication is a separate `/sign-in` surface; the
signed-in product lives at `/app`.

For production setup and the content authoring workflow, see
[Hosted architecture](docs/HOSTED_ARCHITECTURE.md) and
[Content pipeline](docs/CONTENT_PIPELINE.md).

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

- **Node.js 18+** — the server uses ESM and the global `fetch`. macOS users
  with [Volta](https://volta.sh/) or [nvm](https://github.com/nvm-sh/nvm) are
  set; otherwise grab a build from [nodejs.org](https://nodejs.org).
- **One LLM provider** — pick at setup time:
- **Codex CLI** — an installed Codex command-line client.
  - **Claude CLI** — `npm install -g @anthropic-ai/claude-code` then `claude login`.
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
├── public/                  # static assets, shared CSS, legacy study engine
├── lib/                     # typed/shared data plus backend services
├── server.mjs               # Node API and Next.js custom-server integration
├── setup.mjs                # interactive first-run setup
└── package.json
```

The product and legal pages, metadata, fonts, and Clerk access surfaces are
React-owned. The signed-in study engine remains temporarily isolated in
`components/workspace/legacy-workspace.tsx`; its API contract stays stable
while individual workspace destinations move from `public/app.js` into React.

Run the complete framework verification before deploying:

```bash
npm run verify
```

## Configuration

`setup.mjs` writes `data/llm-config.json`. You can also edit that file
directly. Recognised fields:

```jsonc
{
  "provider": "codex" | "claude" | "api",
  "codexBin": "/path/to/codex",                 // optional override
  "claudeBin": "claude",                        // optional override
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
| `anthropicApiKey` | `ANTHROPIC_API_KEY` |
| `anthropicModel` | `ANTHROPIC_MODEL` |

Env vars win over the config file. Useful for one-off testing:

```bash
LLM_PROVIDER=api ANTHROPIC_API_KEY=sk-ant-xxx npm start
```

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
hosted mode, Clerk provides authentication, Neon stores per-user study state
and AI usage, Vercel hosts the service, and the configured AI provider receives
only requested tutor, further-exercise, or academic-plan extraction inputs.
Curriculum and transcript files are processed as an import draft; the original
files are not retained, and only the academic fields the user reviews and
confirms are saved. Timetables, transcripts, exam schedules, curricula, and
calendar feeds are cross-checked against the courses selected in the active
academic plan. Unselected courses and conflicting facts remain unchecked until
the user explicitly accepts them; a source omission never deletes a course.

Signed-in users can see their AI allowances in Settings, export their active
personal record as JSON, and permanently delete both the stored personal record
and Clerk authentication identity. The shipped templates and published course
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
