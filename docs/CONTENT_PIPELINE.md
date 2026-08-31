# Editorial content pipeline

Student requests for unsupported courses enter through the private course
intake inbox. Follow `docs/COURSE_INGESTION_PLAYBOOK.md` before adding any
submitted source to a shared edition. The playbook defines curriculum-edition
mapping, assessment requirements, retrieval coverage, authoring, rights review,
quality gates, and ongoing maintenance.

## Preferred hosted workflow

The versioned editorial workspace (`db/016`) is the default authoring path. It
sits between private intake and the active release:

1. Create or select an `editorial_course_edition`. Academic year and period are
   part of its identity, so a rearranged or retaken curriculum is not flattened
   into the current one.
2. Register a source manifest. Files are deduplicated globally by SHA-256 and
   linked to the edition with a relative path and reviewed rights basis. A new
   digest at the same path supersedes the old contribution; optional complete
   manifest mode retires removed administrator paths.
3. Upload missing files in resumable 512 KiB chunks. Extract PDF text page by
   page, OCR scans and images, read DOCX/PPTX XML, fetch public URLs through the
   SSRF guard, and build a private course-edition retrieval index.
4. Map topics and the canonical course profile. The profile includes learning
   outcomes, prerequisites, teaching format, and an evidence-linked assessment
   scheme: components, weights, minimums, deadlines, overall pass rules,
   attendance rules, resits, and unresolved conflicts.
5. Inspect the token estimate. Queue only the required study-page, exercise,
   flashcard, and quality jobs. Each job and artifact is keyed by the accepted
   source hash, so unchanged work is reused when a weekly deck arrives.
6. Review and edit every artifact. Publication requires approved course
   outline, study pages, exercises, flashcards, and quality report; cited
   sources must still have accepted rights.
7. Publish with the course-code confirmation. Approved derivatives are copied
   into the active editorial tables and the originating request is marked live.
   Source originals stay private.

The web interface is under **Account → Admin → Course production**. The same
flow is exposed through `/api/admin/editorial-*` and the MCP tools
`admin_import_canvas_course`, `admin_sync_course_folder`, `admin_process_course_pipeline`,
`admin_estimate_course_generation`, `admin_queue_course_generation`,
`admin_review_course_artifact`, and `admin_publish_course_edition`.

### Canvas source snapshots

For a Canvas course dashboard, run the local MCP tool
`admin_import_canvas_course` with the Modules URL and a dedicated local output folder.
It uses a Canvas Personal Access Token from the local MCP environment, keeps the token
out of Wicker, and writes a categorised snapshot for every accessible module resource.
Canvas passwords, SAML sessions, and OTP values are never collected or automated.
Import locally first, inspect the manifest, then submit only authorised material with
the tool's explicit rights confirmation. Canvas snapshots enter the editorial workspace
as candidate contributions, so extraction, AI work, and publishing cannot happen until
an administrator accepts them. Re-running the same folder is the update path when new
weekly material appears.

## Repository release path

Course structure for the bundled seed corpus lives in `data/study-state.template.json`. Material files live
under each course's `content/<knowledgeBase>/` directory. These local files are
the immutable authoring sources and backup; hosted requests read the active,
versioned editorial release from Neon. User notes/progress remain in separate
Clerk-keyed tables and are never part of an editorial release.

Use this path for repository-authored seed content and disaster recovery:

1. Add Markdown, PDF, image, office document, code sample, or attachment below
   the relevant course knowledge-base directory. Do not place personal data
   there.
2. For a navigable chapter, add a stable `id`, display `name`, and relative
   `file` entry to the course's `chapters` array. IDs must never be recycled.
3. Run `npm run content:check`. It validates the schema, knowledge-base roots,
   and every chapter path.
4. Run `npm run content:ingest`. This writes `data/content-catalog.json` with a
   type, size and SHA-256 digest for every source asset.
5. Review and commit the source files, template change, and generated catalog.
6. Apply migrations and publish the reviewed release:

   ```bash
   npm run db:migrate
   npm run content:publish
   npm run content:extract
   npm run content:index
   ```

`content:publish` hashes the complete definition plus every source file. It
upserts an idempotent staging release, extracts PDF text per page, uploads
binary data in bounded resumable chunks, verifies stored byte totals on retry, and only then
atomically marks the release active. Re-running it skips complete unchanged
files. Older releases stay addressable until deliberately retired.

`content:extract` is an idempotent completeness pass. It finds active PDFs
whose extracted text is empty, retries Poppler extraction, and falls back to
page rendering plus Tesseract OCR for image-only scans. `content:index` then
rebuilds retrieval chunks from the active release only.

## PDFs and other attachments

PDFs are first-class `editorial_materials` rows. Original bytes live in
`editorial_material_chunks`; page-level text lives in `extracted_pages` for AI
and search without repeatedly parsing a binary in production. All materials can be served
inline through:

```text
GET /api/material/:courseId/<URL-encoded path relative to the knowledge base>
```

`GET /api/materials` builds the current catalog from Neon. Byte-range requests
are supported, so browser PDF viewers do not need to redownload whole files.
Material identity is `(release, course, source path)` plus a SHA-256 integrity
digest.

The PDF viewer route (`GET /api/pdf/:courseId/:paperId[/solutions]`) is a
public, read-only editorial route. This is intentional: native browser PDF
iframes can remain open beyond a Clerk token lifetime, and the route contains
no personal data. Every personal and generative endpoint remains authenticated.

## Retrieval and AI integration

`editorial_retrieval_chunks` is the canonical RAG index. It contains bounded,
overlapping chunks of Markdown/code materials and individual PDF pages, with a
PostgreSQL full-text GIN index. Each result retains `course_id`, source path,
and PDF page number. Retrieval is always course-scoped.

Authenticated clients—including the tutor and an MCP adapter—query:

```http
POST /api/retrieve
Content-Type: application/json

{"courseId":"alg","query":"master theorem recurrence cases","limit":8}
```

The response returns ranked chunks with citation metadata. The tutor uses this
route's underlying repository directly and is instructed to cite the supplied
path/page and decline unsupported answers. This lexical retrieval layer works
without an external embedding vendor; an embedding column and reranker can be
added later without changing the API contract.

The practice-paper parser also reads `extracted_pages` from Neon directly. It
never asks the browser to run PDF.js text extraction.

## External enrichment

The existing tutor and question/flashcard generators consume editorial chapter
content server-side. The pipeline also offers a provider-neutral enrichment
hook for embedding, OCR, RAG indexing, or CMS import:

```bash
AI_INGEST_ENDPOINT=https://... \
AI_INGEST_TOKEN=... \
npm run content:ingest -- --ai
```

The hook receives the validated catalog as JSON and must return a successful
HTTP status. SHA-256 values let the receiver skip unchanged documents. Keep AI
outputs in a separate cache/index; never rewrite source lessons automatically.
Human review remains the publication gate.

## Release checklist

- `npm run content:check` passes.
- New/changed chapter IDs and paths are intentional.
- PDF/content redistribution rights have been checked.
- No answer keys or private notes accidentally entered public editorial files.
- `git diff -- content/` contains additions/intentional edits only.
- The generated catalog is committed.
- `npm run content:publish` finishes and reports the new active release.
- `npm run content:extract` reports no PDFs remaining without text.
- `npm run content:index` completes and retrieval smoke tests return citations.
- Hosted `/api/materials` reports `source: "neon"`.
