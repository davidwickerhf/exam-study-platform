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

Initial/manual catalogue collection selects current/upcoming courses and concluded
Canvas shells with the same course code. Recurring refresh instead selects only
the latest current-period edition per course. This permits historical fallback without mixing
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

Accessible Canvas-hosted video and audio originals use durable shared asset chunks
in the Vercel queue pipeline, with authenticated byte-range streaming. They no longer
rely on a mounted container directory. Legacy originals that existed only on an old
container require collection again if Canvas still exposes them. Canvas Studio,
Kaltura and external-tool videos can only be archived when an authenticated download
is available; collection does not bypass provider controls or DRM.

Settings exposes both a forced full refresh and a manual course-edition picker.
The picker can queue any course visible to the connected Canvas account,
including old or out-of-period shells.

## Editorial boundary

Private contributions never qualify for editorial mapping or generation.
Community contributions enter as `candidate`; the existing administrator
review must mark them `accepted` before source mapping, lesson generation,
exercise generation, quality review, or publication can consume them.

## Interrupted collection and derived rules

Vercel Queues delivers bounded tasks backed by Neon checkpoints. A task claims an
expiring lease and checks ownership before committing. Downloads, extraction and
indexing resume independently; an interrupted worker does not restart the entire
course. Resource-level failures are isolated and completed originals remain available.
The minute dispatcher recovers due or lost notifications. Do not run the optional
continuous worker alongside production queue consumers. See
[deployment and recovery](DEPLOYMENT_SEPARATION.md) for limits and storage details.

Rule extraction reads syllabus/course-manual context and introductory slides,
including DOCX/PPTX text. Evidence is spread across source files so a long
assignment bank cannot exhaust the entire input budget. Extractor upgrades and
unsuccessful scans schedule a derived-only pass over stored material; they do
not require another upload or full download. Current-year scans feed priorities
and attendance for every selected academic course, including courses without
published Wicker chapters. Independently supported requirements contribute even
when another source passage is disputed; conflicting passages stay excluded.

### Attendance requirements and unknowns

A missing attendance rule is unknown, never evidence that attendance is optional.
The course page distinguishes required, explicitly optional, and unknown sessions.
Rules apply to the same academic year and teaching activity: practicals map to labs;
a mandatory lab rule is not silently assigned to a tutorial or lecture. Mandatory
rules without matching timetable sessions remain visible on the attendance page.
Undated or older editorial rules cannot override current-year source evidence.

Priority extraction version 3 also retains narrow, explicit syllabus sentences
such as “Labs are mandatory”, with their source references, even when AI extraction
misses them or is unavailable. Conditional or disputed rules are not inferred by
this fallback. An attendance-only fallback does not establish complete assessment
coverage. Existing accounts need the next derived-rule scan (or an explicit Canvas
sync/retry) to replace cached extraction; this change does not rewrite stored user
course data during deployment.

### Controls for one course edition

`POST /api/integrations/canvas/corpus/jobs/:id` accepts `action: "stop"` or
`action: "retry"`. It requires an owned course job with retained corpus access;
retry also requires current collection consent. Stop pauses that user's edition
and revokes the running lease. Automatic catalogue, material and priority scans
respect the pause. Retry, or an explicit material refresh, unpauses it and creates
a new job with a `retryOf` reference, preserving the previous attempt.

Stop revokes the lease; later task commits are fenced and stored material is retained. An in-flight
network operation may finish before its next ownership check. The sync page
exposes Stop and Restart for active rows, Retry for stopped/failed rows and Sync
again for completed rows. Controls target the selected edition, not every year.

## Recurring refresh

With collection consent, default frequencies are 30 minutes for announcements and assignments and six hours for materials. Settings → Connections → Manage → Automatic refresh has an enable switch, separate update/material frequencies, and explicit studying/completed status. Updates allow 15/30/60/180/360/1440 minutes; materials allow 60/360/720/1440/10080 minutes. These preferences are account + Canvas-host scoped and browser-only. They do not change sharing consent.

Every catalogue pass resolves today's programme calendar with personal overrides. Discovery runs at the shorter selected interval, capped at one hour, so even a weekly material schedule detects period boundaries. Metadata is fetched only when its own frequency is due; material eligibility uses the student's most recent completed full sync, not another student's shared binding timestamp. Failed full syncs retain the deployment's failure cooldown. Repeated dispatch is protected by unique active-job indexes.

During dated teaching/exam/resit periods, select that period's eligible editions. During breaks, watch the recent ending academic year (within 120 days) and the next year approaching within 60 days. August retains the ending year even if next year's calendar is unpublished. Upcoming Canvas terms must begin within 60 days in a break (14 days during a period). Retakes select only the latest eligible edition per course. Old calendars are not extrapolated indefinitely: use the current Canvas academic year when dated coverage is unavailable. Missing active programme or explicit completed status pauses automatic work; graduation is never inferred from age, earned credits or failed attempts. The stored policy reason/time is visible in Settings.

Turning automation off or marking completed cancels automatic jobs and revokes their leases while preserving originals/checkpoints and manual jobs. Individual course pauses and withdrawn consent remain authoritative. Manual historical collection is still available. A network operation already in flight can finish before its next lease check. Unchanged versioned files reuse complete originals/indexes; changed and unversioned files are collected again. Frequency is a scheduling target, not a guarantee of Canvas or worker completion time.


## Material browser and structured formats

Course material uses readable titles, search and file-type filters. Select a title
to preview it, use the download icon for the unchanged original, or the More menu
to report a problem. Previews load on demand; switching worksheets is local and
the viewer caches its last eight inspected archive members while open.

- Jupyter notebooks: Markdown, code cells, saved text output and bounded PNG plots.
  No code, HTML output or interactive widget is executed.
- Code files: searchable text and read-only source previews, including Python,
  JavaScript/TypeScript, Java/C/C++, R, Julia, SQL and common shell/config files.
  The shared supported-format registry is `lib/course-file-formats.json`.
- XLSX and legacy XLS: sheet selection and saved cell values. XLSX also retains
  formula text. No formula recalculation, macros or exact Office layout.
- CSV/TSV: quoted delimiters are respected. The preview shows at most 100 rows
  and 40 columns; large files are indexed as labelled dataset profiles, not as
  an exhaustive searchable copy of every cell.
- ZIP: a searchable inventory and previews of supported members. Indexing retains
  readable member paths and content; binary members remain in the original.
- PDF: first-party PDF.js canvas rendering with page navigation, fit/zoom and an
  accessible copyable page-text view. Authenticated fetch supplies bytes to the
  worker. Documents are never embedded in blocked iframes or sent to an external
  document-viewing service. PDF.js worker/fonts/decoders are copied from the pinned
  dependency by `prebuild` and `pretest:e2e`, under a versioned local asset path.
- PPT/PPTX: on-demand LibreOffice conversion to static PDF slide pages, preserving
  graphics, charts and layout, with an extracted-text/notes alternative. Animations
  remain in the original. Conversion is capped at 64 MB and 60 seconds, one deck at
  a time per server, with deduplicated requests and a bounded 15-minute memory cache.
  The private `/api/corpus/assets/<assetId>/slides.pdf` endpoint checks the same
  current account access as downloading the original, before consulting the cache.
  The API image includes LibreOffice and fallback fonts. Local use requires
  `soffice` on PATH, or `LIBREOFFICE_PATH` pointing to its executable.
- Images, audio and video retain native media controls. HTML files are inspected as
  non-executing extracted text rather than embedded active documents.

Interactive previews accept originals up to 64 MB and have a 20-second processing
budget. Notebook, sheet and archive previews explicitly disclose display limits.
Preview failure never deletes the original or marks collection as failed.
The preview endpoint applies the same per-account corpus access check as downloads.

Previously unsupported, now-supported originals and ZIP/PPTX/DOCX files indexed with the older
format registry are re-extracted on the next fresh course sync without downloading
unchanged bytes again. A retry resumes its existing checkpoints; use a fresh scan
to upgrade already-completed resources. Legacy XLS parsing uses pinned
`xlrd==2.0.2` in the API and worker images; for local Python installs, provide the
same module on `PYTHONPATH`.


### Slide extraction and visual coverage

PPTX extraction joins formatting runs inside paragraphs without adding spaces or
newlines, follows presentation relationships for slide order, and preserves table
rows/cells and speaker notes (excluding page-number/header/footer placeholders).
Preview text and retrieval use this same parser. Original alt descriptions remain
explicitly attributed. Images, charts, diagrams and structured equations receive
visual-coverage markers; flattened equation symbols are not presented as a correct
formula. Diagram meaning and graph values are not inferred from text alone.

These checks cost no model tokens. They preserve visual evidence for the viewer;
they do not claim to interpret it. A future vision pass should analyze only selected
slides that need it, cache by original hash + slide + extraction/model version,
reserve image-token cost under the same billing cap, and cite the slide for every
interpretation. Until such a pass exists, generation must disclose relevant visual
gaps and avoid unsupported graph/diagram claims. AI visual interpretation is not
silently enabled by opening a document.

Extraction format version 3 upgrades existing indexes during a fresh course sync.
Study source fingerprints include extracted evidence, so corrected text or newly
extracted notes can trigger a refresh even when the original file SHA is unchanged.
