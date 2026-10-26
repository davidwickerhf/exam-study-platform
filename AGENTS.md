# Wicker Study — contributor handoff

When implementation work on a feature branch is ready for review:

1. Run `npm run verify` and record the result. Do not hide skipped or
   unverified behavior.
2. Commit the in-scope work, push the branch, and open a non-draft pull
   request targeting `main` without waiting for separate authorization.
3. Never merge the pull request unless the user explicitly asks.
4. Put the exact routes to inspect, validation performed, and known gaps in
   the pull-request body.
5. There are no hosted preview deployments (Vercel is gone; Coolify PR
   previews are off). Run the changed route locally, verify it renders with a
   headless browser, and put what you checked in the pull-request body.

Preserve unrelated work already present in a shared worktree. If the branch
contains recovered work from another agent, describe that scope honestly in
the pull request rather than silently dropping or splitting it.

## Hosting & infrastructure

Production runs on the owner's Hetzner server via Coolify (compose app: web /
api / worker). Read [docs/HOSTING.md](docs/HOSTING.md) for deploy, database,
mail, jobs and env vars, and the private
[wicker-infra](https://github.com/davidwickerhf/wicker-infra) repo
([README](https://github.com/davidwickerhf/wicker-infra/blob/main/README.md),
[AGENTS.md](https://github.com/davidwickerhf/wicker-infra/blob/main/AGENTS.md))
for the whole system. Key rules:

- **Merging to `main` is a production deploy.** Migrations in `db/` run
  automatically when the api boots.
- Never print, log or commit secret values; docs list names and locations only.
- No AI attribution in commits, PR bodies or code comments.
- Branch names describe the change (`feature/…`, `fix/…`, `docs/…`, …); never
  tool or agent names such as `t3code`, `claude` or `codex`.
- Verify UI with headless browsers only; close browsers and stop every server
  you start.
- Never touch MaastrichtU-BISS services (`citations`, `api`, `test-api`
  on wicker.life and their Vercel projects).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
