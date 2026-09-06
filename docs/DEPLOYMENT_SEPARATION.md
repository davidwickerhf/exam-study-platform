# Vercel web, API and durable Canvas tasks

The public domain routes pages/assets to native Next.js (`web`), and `/api/*`
and `/skills/*` to the existing Node API container (`api`). Keeping the API
container preserves native extraction tools and existing upload/download
contracts. No continuously running worker or external worker host is required.

## Canvas queue

`/internal/canvas-consume` is a private Vercel Queues push consumer for
`canvas-sync-v1`, with two concurrent callbacks. Each callback invokes one
bounded API task, then publishes the continuation only after its checkpoint is
committed. The API call is authenticated with a timestamped, payload-bound HMAC;
it cannot be invoked with a student's browser credentials. Queue payloads carry
job IDs, never Canvas tokens, source bytes or signed download URLs.

`/internal/canvas-dispatch` runs every minute with Vercel Cron. `CRON_SECRET`
protects it. This sweeps the durable SQL outbox and schedules daily discovery.
An authenticated sync request also wakes the dispatcher. A lost publish or a
message that expires after seven days remains recoverable from Neon. Previews
acknowledge queue probes but never process production jobs.

The same existing `CANVAS_CONNECTION_ENCRYPTION_KEY` must be available to both
services. Do not rotate it during migration. Vercel supplies queue OIDC
credentials automatically. Keep the existing database and AI settings.

## Persistence and recovery

Migration 029 adds per-job API checkpoints, a resource inventory, original-byte
staging and index-batch staging. Foreign keys tie these to the existing job and
account erasure lifecycle. Vercel Queues transports notifications; SQL is the
source of truth. All pipeline mutations lock and check the parent job lease in
the same transaction, so stale workers cannot commit after Stop or Retry.

Discovery replays the existing importer against persisted API responses. This
preserves recursive links, modules (including paginated module items), syllabus,
standalone Pages, assignments, quizzes and accessible question banks,
discussions, announcements and file listings. A checkpoint yield or transient
failure is never converted into a silently skipped resource. Explicit Canvas
403/404 restrictions remain visible in the inventory.

Downloads request 8 MB ranges and checkpoint 512 KB chunks. Resumption verifies
size and ETag, or compares saved prefix bytes if a server ignores Range. Full
byte count and SHA-256 are checked before an atomic promotion marks the original
complete. Audio/video use the same durable storage as other originals; the API
streams bounded batches instead of allocating an entire video in memory.

Text extraction is a separate task. Search embeddings are checkpointed in
64-passage batches and published atomically when complete. Notebook cells are
read without execution; XLSX formulas use saved values; archive expansion is
bounded and unsafe/unreadable content is reported while retaining the original.
No PDF pages are deliberately truncated by this pipeline. The existing 1 GB
per-file and 2,000-resource importer safeguards remain explicit limitations.

Retries reuse original bytes and completed resource/index stages. A failed
resource does not prevent other discovered resources from finishing. Missing
resources in partial scans never automatically retire earlier material. A
changed file at the same path replaces its active snapshot only after the new
original and search index are complete. Old versions remain in history.

## Existing local media

Earlier deployments stored some videos only on container disk. They cannot be
made durable by a schema migration alone: their course needs a fresh collection.
A missing legacy original returns an explicit retry response, not a broken
stream. The first queue refresh downloads it into shared storage. Material
removed from Canvas before that download may be unrecoverable; do not claim a
lossless migration of bytes that were already lost on an old container.

## Validation

- `npm run verify`: typecheck, unit/regression suite and production Next build.
- `node --test test/canvas-queue.test.mjs test/course-structured-text.test.mjs`.
- Disposable local pgvector database:
  `QUEUE_TEST_DATABASE_URL=postgres://...@127.0.0.1:55439/postgres node --experimental-test-module-mocks scripts/verification/canvas-queue.mjs`.
  The script refuses non-local hosts. It recreates the fixture schema and tests
  byte-exact interrupted downloads, duplicate notifications, lease recovery,
  interrupted embeddings, retry reuse, Stop and expired-message recovery.
- Signed POST `{ "probe": true }` to `/internal/canvas-dispatch` publishes a
  harmless queue probe. Verify its identifier in consumer runtime logs.
- Inspect `/sign-in`, `/app/tutor/work`, `/app/settings/canvas-sync`,
  `/app/settings/canvas-sync/logs` and a course material download in T3 preview.

Deploy the additive migration and verify the queue trigger in preview before
merging. After production deployment verify the cron, queue delivery and real
job checkpoints before retiring the old deployment. Rollback to the preceding
Vercel deployment remains available. The old worker ignores new checkpoint
rows; it may repeat collection work, so prefer fixing forward once jobs use the
new pipeline. Never run the old continuous worker alongside queue consumers.

## Shared Canvas response cache

Sanitised Hub responses use account-scoped `user_documents` with ten-minute
freshness. Keys include the account, connection fingerprint, requested parts,
course selection and calendar day. Revocation/reconnection and forced refresh
advance a durable generation, fencing stale in-flight cache writes. Partial
failures are not cached. Account erasure deletes the cache with other documents.

`deploy/worker/Dockerfile` remains an optional self-hosted alternative; it is
not used by the Vercel deployment. Local split verification uses
`WICKER_SERVICE=api node server.mjs` and
`WICKER_API_ORIGIN=http://127.0.0.1:<api-port> npm run dev:web`.
