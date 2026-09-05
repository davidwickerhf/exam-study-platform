# Versioned Canvas corpus

## Contract

Connecting Canvas and collecting lesson material are separate decisions. A
saved token enables personal Canvas features such as deadlines. It does not
start a scrape until the signed-in user explicitly chooses one of:

- **Private** — collect and index material for that account's Tutor and MCP
  clients only.
- **Community** — allow other enrolled students to reuse the same course
  edition. The source becomes an editorial candidate, but administrators must
  still review rights before using it to generate or publish course content.
- **Disabled** — do not collect material. Existing jobs are cancelled; changing
  away from community sharing withdraws unreviewed contributions and prevents
  future editorial use.

API keys and MCP clients may read status or request a refresh under existing
consent. They cannot grant or expand consent.

## Identity and versioning

`canvas_course_bindings` maps an institution's Canvas shell to a stable
`canonical_course_id` and a year/period-specific editorial edition. Course code
is the stable identity when Canvas provides one. Academic year and period are
derived from the term metadata, then from Maastricht's coded shell name, and
finally from teaching dates.

The catalog job selects current/upcoming courses and concluded Canvas shells
with the same course code. This permits historical fallback without mixing
editions. Retrieval always returns `academicYear`, `period`, source path, page,
and scrape timestamps. Supplying `academicYear` is a strict edition filter.

## Background pipeline

1. Explicit consent enqueues one durable `catalog` job.
2. The catalog records account access and enqueues deduplicated `course` jobs.
3. A server-side worker imports syllabus text, module-linked pages, standalone
   course Pages, linked files, assignments, quizzes, discussions, and
   accessible question banks.
4. Every file is SHA-256 content-addressed. Unchanged bytes reuse the global
   asset; changed bytes create a new source snapshot and retire the prior one.
5. Text and PDFs are extracted and chunked. FTS is always indexed; embeddings
   are added when an OpenAI embedding key is configured.
6. Failed jobs retry with backoff. `last_synced_at`, `next_sync_at`, manifest
   hash, and per-source `last_seen_at` make freshness observable.

Jobs live in Neon and therefore survive process restarts. The browser is never
the worker and never receives another account's source bytes or Canvas token.

## Retrieval clients

`POST /api/retrieve` is shared by the hosted Tutor and MCP `search_course`.
It accepts a published `courseId`, stable `courseCode`, or
`canonicalCourseId`, plus optional `academicYear`, `sourceType`, and
`includeHistorical`. Results merge published editorial chunks with authorised
Canvas chunks and retain corpus and edition provenance.

`canvas_corpus_status` exposes consent, jobs, edition source counts, and
freshness. `canvas_corpus_sync` queues a refresh but cannot bypass consent.

## Original documents and media

The worker preserves original PDF, Word, PowerPoint, spreadsheet, image, audio,
and other Canvas file bytes. Authenticated users list these through
`GET /api/corpus/materials` and open them from the first-party
`/api/corpus/assets/:assetId` route without returning to Canvas. The route uses
the same private/community access checks as retrieval.

Accessible Canvas-hosted video and audio files are copied to the server's local
content-addressed media directory (`CANVAS_CORPUS_ASSET_DIR`, default
`data/corpus-assets`). HTTP byte ranges allow playback and seeking without
loading the entire recording. Production must mount this directory on a
persistent encrypted volume. Canvas Studio, Kaltura, or other external-tool
videos can only be archived when Canvas exposes an authenticated downloadable
file; the worker does not bypass provider access controls or DRM.

Settings exposes both a forced full refresh and a manual course-edition picker.
The picker can queue any course visible to the connected Canvas account,
including old or out-of-period shells.

## Editorial boundary

Private contributions never qualify for editorial mapping or generation.
Community contributions enter as `candidate`; the existing administrator
review must mark them `accepted` before source mapping, lesson generation,
exercise generation, quality review, or publication can consume them.

## Interrupted collection and derived rules

Each job owns an expiring lease, renewed every 30 seconds. Running jobs with no
heartbeat for 10 minutes return to the bounded retry queue; completion is fenced
by the lease token. A job has a 30-minute execution limit, and the web supervisor
restarts an exited worker. Partial retrieval indexes are checked against the
expected extracted chunk count before reuse.

Rule extraction reads syllabus/course-manual context and introductory slides,
including DOCX/PPTX text. Evidence is spread across source files so a long
assignment bank cannot exhaust the entire input budget. Extractor upgrades and
unsuccessful scans schedule a derived-only pass over stored material; they do
not require another upload or full download. Current-year scans feed priorities
and attendance for every selected academic course, including courses without
published Wicker chapters. Independently supported requirements contribute even
when another source passage is disputed; conflicting passages stay excluded.

### Controls for one course edition

`POST /api/integrations/canvas/corpus/jobs/:id` accepts `action: "stop"` or
`action: "retry"`. It requires an owned course job with retained corpus access;
retry also requires current collection consent. Stop pauses that user's edition
and revokes the running lease. Automatic catalogue, material and priority scans
respect the pause. Retry, or an explicit material refresh, unpauses it and creates
a new job with a `retryOf` reference, preserving the previous attempt.

The worker releases a cancelled job slot on the next heartbeat (30 seconds),
fences later completion/index writes, and retains stored material. An in-flight
network operation may finish before its next ownership check. The sync page
exposes Stop and Restart for active rows, Retry for stopped/failed rows and Sync
again for completed rows. Controls target the selected edition, not every year.
