# Web, API and processing deployments

The public domain routes to two Vercel services. `web` builds Next.js normally;
`api` builds `deploy/api/Dockerfile.vercel` and runs the existing authenticated
Node API without importing or preparing Next.js. `/api/*` and the published
`/skills/*` document go to `api`; pages, route payloads and assets go to `web`.
Cookies, bearer API keys, URLs, upload chunks, streamed downloads and API
response shapes retain the same origin and contracts.

A third deployment runs `deploy/worker/Dockerfile` on an always-running Docker
host. It consumes the existing Neon `canvas_sync_jobs` queue. Neither web
traffic nor a browser tab is needed for scheduled collection, OCR, indexing,
rule extraction or job recovery. The Canvas sync page still observes the same
jobs, materials and logs and uses the same stop/retry controls.

## Why the API remains a container in this cutover

Several APIs accept large bodies, stream large files or invoke Poppler,
Tesseract and unzip. Moving every API into a native function at once would
change body limits and remove required binaries. This split moves rendering
and static assets to native Next.js, retains those API contracts in their own
service, and removes workers from both request-serving services. It does not
claim that every API is now a native Next.js route.

## Worker deployment

Build from repository root, using `deploy/worker/Dockerfile`. It installs no
frontend build output. Run one replica initially; the queue uses fenced leases
and `FOR UPDATE SKIP LOCKED` to support multiple consumers safely.

Set runtime variables through the host's secret manager:

- `DATABASE_URL`: the same Neon database as the production API.
- `CANVAS_CONNECTION_ENCRYPTION_KEY`: the exact existing API encryption key.
  Do not generate a replacement: it would make saved connections unreadable.
- Existing AI/embedding provider keys and model settings needed for indexing
  and course-rule extraction. Match the production API's settings.
- `PORT`: supplied by the host, default 8080. Health check: `GET /healthz`.
- Optional `CANVAS_CORPUS_WORKER_INTERVAL_MS` (default 5000).

Do not copy Vercel environment markers into the worker. It refuses to start on
Vercel, without its database/key, without extraction tools, or with an
unverified migration ledger. Migrations remain the API runner's responsibility.
The image runs as the unprivileged `node` user, with disposable assets in
`/tmp/corpus-assets`; the database holds persistent assets and job state.

SIGTERM stops claiming jobs, fences late writes, releases the current job for
immediate retry without spending a failure attempt, and exits within 25 seconds.
The host should allow at least 30 seconds for shutdown and restart on failure.
Only a minimal health response is exposed; there is no public processing API.

## Shared Canvas response cache

Sanitised Hub responses use the existing account-scoped `user_documents`
storage, under `canvas-response-cache-v1`, with ten-minute freshness. Keys
include the account, a connection fingerprint, requested parts, course selection
and calendar day. Tokens and raw Canvas API payloads are not persisted.
Revocation/reconnection and forced refresh advance a stored generation. Old
in-flight work cannot become the current cache, including in another instance.
The generation also partitions the existing in-memory request caches.
Partial failures are not persisted. Cache failures fall back to live Canvas.
Account erasure removes these documents with the rest of the account data.

## Local verification

`npm run dev` retains the combined local server. To test the deployed boundary,
run the API with `WICKER_SERVICE=api node server.mjs` on a separate port and
Next with `WICKER_API_ORIGIN=http://127.0.0.1:<api-port> npm run dev:web`.
For a local worker, configure its database/key and run
`npm run canvas:corpus-worker` separately. Existing self-hosted installations
can opt into `CANVAS_CORPUS_WORKER=embedded`; hosted API instances never do so.

Run `npm run verify`, build both Dockerfiles, then inspect in T3 preview:
`/sign-in`, `/app`, `/app/tutor`, `/app/courses`, `/app/settings/canvas-sync`.
Check API health and authentication, upload/download paths, same-origin CSP
hydration, and that API startup contains no Next preparation or worker spawn.
Use an isolated database for worker processing tests; a preview must never
consume production jobs.

## Production cutover and rollback

1. Verify the two-service Vercel preview and both container images.
2. Deploy the independent worker against the existing schema; check `/healthz`
   and verify a queue job and its log entries progress without web traffic.
3. Only after the worker is healthy, promote the split web/API deployment.
   Existing workers may finish concurrently; database leases prevent duplicate
   ownership. Do not cancel jobs just to migrate deployment topology.
4. Verify sign-in, page navigation, Tutor, course files and sync controls.

If verification fails, keep the existing production deployment serving traffic.
Vercel can roll back to its preceding deployment. The queue and cache changes
are backward-compatible and require no destructive database migration. When
rolling back to an embedded-worker version, stop the independent worker after
confirming the old deployment is serving, to avoid unnecessary concurrency.

An always-running worker host and runtime secrets must be configured before
production cutover. A successful web preview alone does not prove background
processing is deployed.
