# Hosting: study.wicker.life (Wicker Study)

Last verified: 2026-10-26

Wicker Study runs on the owner's Hetzner server `wicker-01`, managed by Coolify. The central
source of truth for the whole system is the private repo
[davidwickerhf/wicker-infra](https://github.com/davidwickerhf/wicker-infra); this file covers what
is specific to this repo. If the two disagree, the code in this repo wins for env names and
commands, and wicker-infra should be fixed.

There is no Vercel deployment, no Neon database and no Clerk anymore (all removed October 2026).
Docs in this repo that describe Vercel Queues, Vercel Cron, Vercel previews or Neon branches are
history; see [DEPLOYMENT_SEPARATION.md](DEPLOYMENT_SEPARATION.md) for the old design.

## Overview

| | |
|---|---|
| Coolify app | `exam-study-platform`, uuid `bcfxwtksaqi1hl9qpbqump74` |
| Coolify project | Personal (`yzzzxoeygijivcpdwggvphu0`) |
| Build pack | Docker Compose, file `/docker-compose.coolify.yml` |
| Deploy branch | `main` (auto-deploy through the Coolify GitHub App) |
| Services | `web` (Next.js, `deploy/web/Dockerfile`, port 3000, the only public service), `api` (Node API, `Containerfile`, `runner.mjs`, port 8080, internal), `worker` (pg-boss, same image as `web`, `node scripts/worker.mjs`, health on 8081, internal) |
| Domains (on `web`) | https://study.wicker.life, https://study.c.wicker.life (preview/debug hostname) |
| Database | postgres-main / `exam_study` |
| Umami website id | `259e0b2d-4573-4c5f-9369-a3df7d7add22` |

Request path: Traefik → `web:3000`. `web` serves pages and proxies `/api/*`, `/skills/*` and the
OAuth `/.well-known/*` paths to `api` at `WICKER_API_SERVICE_URL` (`http://api:8080`). That URL is
compiled into the Next rewrites, so it is also a build argument in the compose file. The MCP
server and `/api/auth/*` (Better Auth) are served by `api` on the same public origin
(`WICKER_MCP_ORIGIN`).

## Deploy and rollback

- **Merging to `main` deploys to production.** Coolify rebuilds all three services from the same
  commit. Do not trigger a manual deploy on top of a merge; it queues a duplicate.
- `web` and `worker` wait for `api` to become healthy (`/api/health`). `api` applies pending
  migrations before it accepts traffic (see Database), so a failing migration blocks the deploy.
- The compose file is re-read on every deploy. A new env var must be set in Coolify **and**
  mapped into the right service in `docker-compose.coolify.yml`; a service only sees what the
  compose file maps.
- Runtime-only env change: restart the app. `NEXT_PUBLIC_*` and `WICKER_API_SERVICE_URL` are
  build-time: redeploy.
- Watch: Coolify → exam-study-platform → Deployments, or
  `scripts/capi.sh GET "/deployments/applications/bcfxwtksaqi1hl9qpbqump74?take=3"` (from wicker-infra).
- **Roll back:** Coolify → Deployments → redeploy an earlier successful deployment, or `git revert`
  on `main`. Migrations are forward-only; if one was not backward compatible, restore the DB (see
  the [database runbook](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/database.md)).
- Coolify PR previews are off. Verify changes locally (headless browser) before merging.
- Verify after deploy: `curl -sI https://study.wicker.life`, `/api/health` (expects `ok: true` and a
  configured LLM), and the worker log line `pg-boss worker running: ...`.

## Database

| | |
|---|---|
| Instance | postgres-main (`pgvector/pgvector:pg18`, container `oepzupuymcq4a2sf6julevmm`) |
| Database / role | `exam_study` / `exam_study` (about 8.6 GB, the largest DB on the server) |
| Connection | `DATABASE_URL` in Coolify, host = container name, port 5432, no TLS |
| Extensions | `vector` (pgvector) |
| Queue schema | `pgboss` (created by pg-boss in the same DB) |

**Migrations are automatic.** Numbered raw SQL files `db/NNN_*.sql` are applied by
`scripts/db-migrate.mjs` (`npm run db:migrate`), which `runner.mjs` runs in the `api` container on
boot under an advisory lock. Applied files are recorded with a SHA-256 checksum in
`schema_migrations`; never edit an applied migration, add a new one. If the ledger already matches,
the api skips the migration step.

Running a migration by hand (rarely needed) goes through a tunnel, after taking a dump:

```sh
# from the wicker-infra checkout
scripts/dbtunnel.sh oepzupuymcq4a2sf6julevmm 55432
DATABASE_URL=postgres://exam_study:<pw>@127.0.0.1:55432/exam_study npm run db:migrate
pkill -f "L 127.0.0.1:55432"
```

Take the password from the app's `DATABASE_URL` in Coolify (read it into a variable; never print
it) or `/root/.pgpass-exam_study` on the server. For local development, use a throwaway local
Postgres with pgvector, never production. Dumps of this DB are about 7 GB, so delete pre-change
snapshots afterwards. Nightly backups: 03:00, `pg_dump -Fc` to `wicker-01-backups` (hel1).

## Storage

No object storage. Course material bytes, Canvas originals and retrieval chunks are stored in
Postgres (`editorial_source_assets`, `*_chunks` tables). There are no `S3_*` env vars.
`CANVAS_CORPUS_ASSET_DIR` (default `data/corpus-assets`) is only used by the local corpus worker.

## Auth

- **Better Auth**, served by `api` at `/api/auth/*` (`lib/better-auth.mjs`). Tables `auth_user`,
  `auth_session`, `auth_account`, `auth_verification`, created by `db/050_better_auth.sql`.
- Methods: email + password (verified by a 6-digit code), email sign-in code, password reset by
  code. Google is supported in code but **not configured** in production (`GOOGLE_CLIENT_*` are
  empty; there is no Google Cloud OAuth project for this app).
- Sign-up is limited by `ALLOWED_EMAIL_DOMAINS` / `ALLOWED_EMAILS` (`lib/access-policy.mjs`).
- Admins: `auth_user."wickerStudyRole" = 'admin'`, plus `ADMIN_USER_IDS`.
- Clerk users were imported on 2026-10-26 with a one-off script (now in git history) (ids kept as
  `user_…`). That was a one-off; Clerk is gone.
- No mobile app.

## Mail

- Sent by `api` through nodemailer (`lib/mail.mjs`) using `SMTP_URL` and `EMAIL_FROM`. Without
  `SMTP_URL`, production refuses sign-up, codes and resets.
- **Current bridge:** Hetzner still blocks outbound 25/465, so production sends through Resend SMTP
  on port 587 with `EMAIL_FROM=Wicker Study <noreply@wicker.life>`.
- **Target:** Stalwart sender `noreply@study.wicker.life`
  (`SMTP_URL=smtps://noreply%40study.wicker.life:<pw>@mail.wicker.life:465`), switched after the
  port unblock. See [mail.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/mail.md).
- The code's fallback sender is `no-reply@study.wicker.life` (with a hyphen), which does not match
  the Stalwart account; always set `EMAIL_FROM` explicitly.
- Inbound aliases on study.wicker.life (info, support, privacy, ...) go through forwardemail.net.

## Background jobs and crons

No Coolify scheduled tasks. Everything runs in the `worker` service (pg-boss, exactly one replica):

| Queue | What | Concurrency / schedule |
|---|---|---|
| `canvas-sync-v1` | Canvas collection steps | 2 |
| `study-generation-v1` | student study generation steps (up to 11 min each) | 1 |
| canvas dispatch sweep | former Vercel Cron `/internal/canvas-dispatch`: sweeps the SQL outbox | pg-boss schedule `WICKER_DISPATCH_CRON`, default `* * * * *`; `off` disables it |

The api wakes the dispatcher on `web` (`WICKER_QUEUE_DISPATCHER_URL=http://web:3000`) after
enqueueing. `CRON_SECRET` protects `GET /internal/canvas-dispatch` on `web`. The worker's stop grace
period is 90 s (`WORKER_STOP_TIMEOUT_MS=80000`); unfinished jobs expire and retry.

## Analytics

Umami, loaded in `app/layout.tsx` from `lib/analytics.ts` (`https://analytics.wicker.life/wa.js`,
website id above, `data-domains=study.wicker.life`). The CSP in `lib/security.mjs` allows
`https://analytics.wicker.life`. Events sent with `trackEvent()`:

`setup-finished`, `canvas-connected`, `course-requested`, `practice-answer-graded`,
`mock-exam-completed`, `tutor-question-answered`, `agent-connected`.

Props must stay small enums, counts or opaque ids; never emails, names or student text.

## Environment variables

Names only. Set in Coolify (app level), then mapped per service in `docker-compose.coolify.yml`.
"R" = required in production, "O" = optional.

**Fixed in the compose file (not in Coolify):** `NODE_ENV`, `PORT`, `HOSTNAME`, `WICKER_SERVICE`
(api), `CANVAS_CORPUS_WORKER` (api, `off`), `WICKER_QUEUE_BACKEND` (`pg-boss`),
`WICKER_API_SERVICE_URL` (web, worker), `WICKER_QUEUE_DISPATCHER_URL` (api), `WORKER_HEALTH_PORT`,
`WORKER_STOP_TIMEOUT_MS` (worker).

**Core**
- R `DATABASE_URL` (web, api, worker)
- O `DATABASE_POOL_MAX` (api, default 10)
- R `NEXT_PUBLIC_SITE_URL` (web, build-time)
- R `WICKER_MCP_ORIGIN` (api)
- O `WICKER_TIME_ZONE` (api, default `Europe/Amsterdam`)
- R `CRON_SECRET` (web)
- O `WICKER_DISPATCH_CRON` (worker; not currently mapped in the compose file)

**Auth and access**
- R `BETTER_AUTH_SECRET` (api, web), R `BETTER_AUTH_URL` (api)
- O `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (api; empty in production)
- R `ALLOWED_EMAIL_DOMAINS`, O `ALLOWED_EMAILS`, O `ADMIN_USER_IDS` (api)

**Mail**
- R `SMTP_URL`, R `EMAIL_FROM` (api)

**Encryption keys**
- R `CANVAS_CONNECTION_ENCRYPTION_KEY` (web, api, worker; never rotate casually, it decrypts saved Canvas tokens)
- O `AI_CONNECTION_ENCRYPTION_KEY` (api; falls back to a subkey of the Canvas key)
- O `FEEDBACK_ENCRYPTION_KEY`, `FEEDBACK_SUBMISSIONS`, `FEEDBACK_DIAGNOSTICS`, `FEEDBACK_AI_TRIAGE` (api)

**AI providers and model routes** (api)
- R `LLM_PROVIDER` (`openai` in production), R `OPENAI_API_KEY`, O `ANTHROPIC_API_KEY`
- O `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `ANTHROPIC_MODEL`, `CHAT_MODEL`,
  `CHAT_REASONING_EFFORT`, `EMBEDDING_MODEL`, `LLM_MAP_MODEL`, `LLM_DRAFT_MODEL`,
  `LLM_QUALITY_MODEL`, `STUDY_MODEL_ROUTES`, `STUDY_PIPELINE_MODEL_ROUTES`
- O `AI_INGEST_ENDPOINT`, `AI_INGEST_TOKEN`

**AI allowances and budgets** (api, all O with code defaults)
- `AI_CHAT_REQUESTS_PER_MINUTE`, `AI_CHAT_REQUESTS_PER_DAY`, `AI_CHAT_MAX_OUTPUT_TOKENS`,
  `AI_EXERCISE_REQUESTS_PER_MINUTE`, `AI_EXERCISE_REQUESTS_PER_DAY`, `AI_EXERCISE_MAX_OUTPUT_TOKENS`,
  `AI_INTAKE_REQUESTS_PER_MINUTE`, `AI_INTAKE_REQUESTS_PER_DAY`, `AI_INTAKE_MAX_OUTPUT_TOKENS`,
  `AI_TOKENS_PER_DAY`, `AI_TOKENS_PER_MONTH`
- `STUDY_PLATFORM_DAILY_USD`, `STUDY_PLATFORM_MONTHLY_USD`, `STUDY_USER_DAILY_USD`,
  `STUDY_USER_MONTHLY_USD`, `STUDY_CHAPTERS_PER_DAY`, `STUDY_CHAPTERS_PER_MONTH`,
  `STUDY_REQUESTS_PER_MINUTE`, `STUDY_TOKENS_PER_DAY`, `STUDY_PERSONAL_TOKENS_PER_DAY`,
  `STUDY_MAX_JOB_USD`

**Coolify-generated:** `SERVICE_FQDN_WEB`, `SERVICE_URL_WEB`.

**Local development only (never in production):** `WICKER_LOCAL_USER`, `WICKER_LOCAL_USER_EMAIL`,
`WICKER_LOCAL_ACCOUNTS`, `VAULT_ROOT`, `CODEX_BIN`, `CODEX_MODEL`, `CLAUDE_BIN`, `CLAUDE_MODEL`,
`LIBREOFFICE_PATH`, `CANVAS_CORPUS_ASSET_DIR`, `QUEUE_TEST_DATABASE_URL`. `VERCEL_*` variables are
only read by legacy guards and are never set.

See also [.env.example](../.env.example).

## External services

- OpenAI (production provider) and Anthropic (optional), including students' own keys.
- Canvas LMS (Maastricht University) via each student's personal access token.
- Resend SMTP (temporary mail bridge, to be removed after the Stalwart switch).
- forwardemail.net (inbound aliases, to be moved to Stalwart).

## Credentials

Locations only; see [wicker-infra credentials.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/credentials.md).

- Live app secrets: Coolify env vars of app `bcfxwtksaqi1hl9qpbqump74` (read key names with
  `scripts/capi.sh GET /applications/<uuid>/envs | jq -r '.[].key'`; never print values).
- `BETTER_AUTH_SECRET` copy: owner's Mac Keychain, "BETTER_AUTH_SECRET exam-study-platform".
- Stalwart sender password: Keychain "Stalwart SMTP noreply@study.wicker.life".
- DB role password: `/root/.pgpass-exam_study` on the server.
- Clerk CSV export (one-off import): `~/.config/wicker-01/clerk/` on the owner's Mac; delete when no longer needed.

## Gotchas

- Run exactly one `worker` replica; concurrency limits are per process.
- `WICKER_API_SERVICE_URL` is baked into the `web` build (Next rewrites). Changing it needs a redeploy.
- Behind Traefik, `request.url` shows `0.0.0.0:3000`. Build public URLs from `BETTER_AUTH_URL`,
  `NEXT_PUBLIC_SITE_URL` or the `Host` / `x-forwarded-proto` headers.
- `CANVAS_CONNECTION_ENCRYPTION_KEY` must be identical on web, api and worker.
- Migration checksums are immutable; editing an applied `db/*.sql` file makes the api refuse to boot.
- The database is large; manual dumps fill the postgres container layer. Clean up.
- `deploy/worker/Dockerfile` is a leftover from the Vercel era and is not used by Coolify.

## Related wicker-infra docs

- [AGENTS.md (hard rules)](https://github.com/davidwickerhf/wicker-infra/blob/main/AGENTS.md)
- [apps.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/apps.md) ·
  [coolify.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/coolify.md) ·
  [databases.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/databases.md) ·
  [auth.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/auth.md) ·
  [mail.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/mail.md) ·
  [observability.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/observability.md) ·
  [gotchas.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/gotchas.md) ·
  [credentials.md](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/credentials.md)
- Runbooks: [deploy](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/deploy.md) ·
  [database](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/database.md) ·
  [rotate a secret](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/rotate-secret.md) ·
  [mail sender](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/mail-sender.md) ·
  [outage](https://github.com/davidwickerhf/wicker-infra/blob/main/docs/runbooks/outage.md)
