# Canvas sync logs

Open `/app/settings/canvas-sync/logs` from **Sync logs** on the Canvas sync page. Each attempt in run history also links to its own timeline through `?job=<job-id>`.

The portal reads durable account-scoped events for queue transitions, course discovery, downloads, document text extraction, retrieval indexing and course-rule analysis. It refreshes every five seconds while visible; Pause updates freezes the view without stopping collection. Older events use an ID cursor and stop automatic refresh while being inspected. Stage and warning/error filters apply on the server. The process selector lists the latest 100 syncs with active work first; a direct link also retrieves older owned jobs.

Worker heartbeats and progress events are separate. After five minutes without a progress event, the portal explains that a large file or analysis might still be processing. A running worker whose heartbeat is over 90 seconds old is flagged as potentially interrupted. Neither timer proves a process has failed. Stop and retry remain on Canvas sync.

## Storage and access

Migration `028_canvas_sync_events.sql` adds events with a cascading job foreign key and an atomic status-transition trigger. Heartbeats do not create events. All reads check the signed-in account and current access to the course edition. Worker writes require the current running job lease, so a stopped or superseded worker cannot append new progress. Job deletion, including account deletion, cascades to the timeline.

Events carry operational messages, filenames, counts, stage and attempt identifiers. They do not copy source passages, request payloads, provider responses or download URLs. The writer additionally strips links, recognizable credential assignments and control characters. Operational events are buffered and flushed in one ordered batch per second, with their original timestamps. The buffer is capped at 1,000 pending events; overflow produces an explicit omitted-event warning. Completion drains the final batches while the worker still holds its lease. Queue events omit an attempt label until an actual worker attempt starts. Failure logging is best effort so an unavailable event write does not abort material collection; job transitions remain transactional.

Detailed events begin with deployment; older runs are not reconstructed. Logs show phase and completed-unit counts, not a synthetic overall percentage. Text extraction and semantic-indexing warnings can coexist with a completed sync because original files/text search may still be available.

## Design and validation

The visual foundation remains `DESIGN.md`: Archivo, Wicker's paper canvas, quiet separators and signal color for actions/status. The previously reviewed Vectary style contributes compact secondary metadata; Refero's GitHub Actions screen (`a9c57b88-e48f-4edc-b18a-ce5fc68e9663`) informs the process selector, filter toolbar, timestamped rows and pagination. No decorative imagery or terminal styling is needed.

Validation includes importer progress callbacks, payload bounds/redaction, account/access scope, lease fences and cursor pagination. An isolated local PostgreSQL check exercised the migration and queries, including status transitions, silent heartbeat updates, cancelled-worker writes, foreign-job rejection, access revocation and deletion cascade. The integrated T3 browser covers populated/empty timelines, stage and warning filters, pagination, paused polling and connection-error recovery using a local fixture. Hosted previews do not run corpus workers; the hosted route requires sign-in.
