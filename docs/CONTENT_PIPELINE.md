# Editorial content pipeline

## Authoring model

Course structure lives in `data/study-state.template.json`. Material files live
under each course's `content/<knowledgeBase>/` directory. These local files are
the immutable authoring sources and backup; hosted requests read the active,
versioned editorial release from Neon. User notes/progress remain in separate
Clerk-keyed tables and are never part of an editorial release.

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
5. Review and commit the source files, template change, and generated catalog.
6. Apply migrations and publish the reviewed release:

   ```bash
   npm run db:migrate
   npm run content:publish
   ```

`content:publish` hashes the complete definition plus every source file. It
upserts an idempotent staging release, extracts PDF text per page, uploads
binary data in bounded resumable chunks, verifies stored byte totals on retry, and only then
atomically marks the release active. Re-running it skips complete unchanged
files. Older releases stay addressable until deliberately retired.

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
- `npm run content:publish` finishes and reports the new active release.
- Hosted `/api/materials` reports `source: "neon"`.
