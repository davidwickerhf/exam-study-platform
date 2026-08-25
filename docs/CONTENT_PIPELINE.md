# Editorial content pipeline

## Authoring model

Course structure lives in `data/study-state.template.json`. Material files live
under each course's `content/<knowledgeBase>/` directory. Git review is the
publishing workflow: editorial changes are versioned, reviewable and released
to every user, while user notes/progress remain in Neon.

To add content:

1. Add Markdown, PDF, image, office document, code sample, or attachment below
   the relevant course knowledge-base directory. Do not place personal data
   there.
2. For a navigable chapter, add a stable `id`, display `name`, and relative
   `file` entry to the course's `chapters` array. IDs must never be recycled.
3. Run `npm run content:check`. It validates the schema, knowledge-base roots,
   and every chapter path.
4. Run `npm run content:ingest`. This writes `data/content-catalog.json` with a
   type, size and SHA-256 digest for every source asset.
5. Review and commit the source files, template change, and generated catalog
   together.

## PDFs and other attachments

PDFs are first-class `pdf` catalog entries. All cataloged files can be served
inline through:

```text
GET /api/material/:courseId/<URL-encoded path relative to the knowledge base>
```

`GET /api/materials` returns the complete catalog. The server validates the
resolved path against the course root, so catalog access cannot escape into
application or user data.

For very large future libraries, keep the same catalog contract and replace
the material handler with signed object-storage URLs. The hashes provide stable
object keys and change detection.

## AI integration

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
