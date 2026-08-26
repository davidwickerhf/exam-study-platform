# Hosted architecture

## Data ownership

The application deliberately separates two kinds of data:

| Data | Owner | Source of truth |
| --- | --- | --- |
| Course/chapter definitions, Markdown, PDFs and diagrams | Editorial | Reviewed local/Git sources, published as an active relational Neon release |
| Shipped questions and parsed exams | Editorial | Git (`data/cache/`) pending the same release-table migration |
| Mastery, notes, review log, course ordering/archive preferences | Individual user | `user_documents` in Neon |
| Custom/generated flashcards and spaced-repetition scheduling | Individual user | `user_documents` in Neon |
| Mistakes and mock sessions | Individual user | `user_documents` in Neon |
| Browser attempts, chapter-read flags and UI preferences | Individual user | Browser `localStorage`, synchronized to `user_documents` |

Every personal document is keyed by Clerk `user_id`. The server derives that ID
from a verified session token; it never accepts a user ID from request data.
When Clerk/Neon are not configured, development uses the isolated
`local-dev` account under ignored `data/users/` files.

At read time, the latest editorial template is merged with the user's saved
personal fields. New courses, chapters and corrected editorial metadata
therefore appear without overwriting progress or notes.

## Request flow

1. `public/bootstrap.js` reads `/api/auth/config`.
2. In hosted mode it loads Clerk, presents sign-in, and attaches a fresh Clerk
   token to API requests.
3. The backend verifies the token and binds the Clerk user ID to the async
   request context.
4. Personal repository calls use that context to address Neon rows.
5. Editorial reads and retrieval queries use the active immutable Neon release.

## Database

Apply [db/001_user_documents.sql](../db/001_user_documents.sql) with:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

Personal state uses a JSONB document model; editorial releases use normalized
course, chapter, paper, material, binary-chunk, and retrieval-chunk tables. The
document model is intentional for the first hosted migration: it
preserves the existing API contracts and supports atomic per-document upserts.
It can later be normalized for cross-user analytics without exposing or
coupling editorial content to personal progress.

## Deploy

The production hostname is `https://study.wicker.life`. It is attached to the
`wickerlife/exam-study-platform` Vercel project; its `study` CNAME must point to
the target reported by `vercel domains inspect study.wicker.life --scope wickerlife`.

1. Create a Neon project and copy its pooled `DATABASE_URL`.
2. Create a Clerk application and copy both API keys.
3. Configure the variables from `.env.example` in the hosting platform.
4. Run `npm run db:migrate` once against Neon.
5. Publish the reviewed corpus with `npm run content:publish`.
6. Deploy to Vercel with `Dockerfile.vercel`, or build the standard Dockerfile
   on another Node-capable container host. `.dockerignore` excludes `content/`;
   the hosted runtime reads it from Neon.
7. Verify `/api/health` reports `{ "ok": true, "mode": "neon" }`.

For local hosted-mode verification, put the same values in ignored
`.env.local` (the Clerk CLI uses this filename) or `.env`.

Production must set Clerk and Neon together. If neither is set the application
intentionally enters local development mode; this is visible in startup logs
and `/api/me`.

## Legacy local data

Existing `data/study-state.json`, `data/flashcards.json`, `data/sr-state.json`,
`data/mistakes/`, and `data/mocks/` remain untouched. In local mode they are
used as initial fallback data while new writes go to `data/users/local-dev/`.
The source course material under `content/` is never moved or deleted.

To copy that legacy history into the maintainer's Clerk account after Neon is
configured, use the Clerk user ID shown in the dashboard:

```bash
DATABASE_URL='postgresql://...' npm run user:import -- --user-id user_...
```

This upserts copies into Neon and leaves every local source file in place.
