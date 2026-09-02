# Hosted architecture

## Data ownership

The application deliberately separates two kinds of data:

| Data | Owner | Source of truth |
| --- | --- | --- |
| Course/chapter definitions, Markdown, PDFs and diagrams | Editorial | Reviewed local/Git sources, published as an active relational Neon release |
| Shipped questions and parsed exams | Editorial | Git (`data/cache/`) pending the same release-table migration |
| Mastery, notes, review log, course ordering/archive preferences | Individual user | `item_progress` and `course_settings` in Neon |
| Custom/generated flashcards and spaced-repetition scheduling | Individual user | `flashcards` and `sr_cards` in Neon |
| Mistakes and mock sessions | Individual user | `mistakes`, `mock_sessions`, `mock_session_answers` in Neon |
| Browser attempts, chapter-read flags and UI preferences | Individual user | Browser `localStorage`, synchronized to `browser_state` |
| Personal extra exercises | Individual user | `personal_exercises` in Neon |
| Study activity ledger (answers, reviews, mocks, resolved mistakes, reads) | Individual user | `activity_events` in Neon |
| Academic plan: programmes, courses, attempts, events, gates | Individual user | `academic_*` tables in Neon |
| AI request/token ledger | Individual user | `ai_usage_events` in Neon |
| Course requests and optional contribution permission | Individual user | `course_content_requests` and private source chunks in Neon |
| Versioned editions, source manifests, evidence maps, jobs, drafts, review and releases | Editorial | `editorial_course_*`, `editorial_source_*`, `editorial_processing_jobs`, and `editorial_generated_artifacts` in Neon |

Every personal document is keyed by Clerk `user_id`. The server derives that ID
from a verified session token; it never accepts a user ID from request data.
When Clerk/Neon are not configured, development uses the isolated
`local-dev` account under ignored `data/users/` files.

At read time, the latest editorial template is merged with the user's saved
personal fields. New courses, chapters and corrected editorial metadata
therefore appear without overwriting progress or notes.

## Request flow

1. The custom Node server sends API requests to the established backend router
   and delegates document and static-asset requests to Next.js.
2. Next.js App Router renders the public, legal, access, and workspace routes.
   A fresh CSP nonce is attached to each dynamically rendered document.
3. In hosted mode `@clerk/nextjs` presents sign-in and the workspace adapter
   attaches a fresh Clerk token to protected API requests.
4. The backend verifies the token and binds the Clerk user ID to the async
   request context.
5. Personal repository calls use that context to address Neon rows.
6. Editorial reads and retrieval queries use the active immutable Neon release.
7. Editorial intake and generation happen in a separate private workspace;
   only an approved publish action copies derivatives into the active release.

Public product and legal pages (`/`, `/about`, `/courses`, `/privacy`, and
`/terms`) do not initialize Clerk or load the study-workspace dependencies.
`/sign-in` is the dedicated Clerk surface and `/app` is the authenticated
workspace entrypoint. `/app` translates historical hash links into React
routes.

The public, legal, authentication, and study-workspace layers are fully React
and TypeScript. The server API and personal-data contracts remain unchanged.

## Database

Apply the migrations in `db/` (001–016; `user_documents` now only holds the local-mode migration marker — every personal record has its own table) with:

```bash
DATABASE_URL='postgresql://...' npm run db:migrate
```

Personal state uses a JSONB document model; editorial releases use normalized
course, chapter, paper, material, binary-chunk, and retrieval-chunk tables. The
document model is intentional for the first hosted migration: it
preserves the existing API contracts and supports atomic per-document upserts.
It can later be normalized for cross-user analytics without exposing or
coupling editorial content to personal progress.

## AI boundary and quotas

Students do not generate course banks, flashcards, paper parses, tutor hints,
or grading responses. Those surfaces use reviewed editorial content and local
reference-answer checks. Student model access is limited at the server boundary to:

- retrieval-grounded tutor chat;
- personal extra exercises explicitly requested from a chapter;
- reviewed academic-document intake used to propose changes to the student's private plan.

Administrators have a separate staged editorial workflow for source extraction,
evidence-grounded draft generation, review, and explicit publication. Generated
drafts never become student-facing content without an administrator publication
decision.

Before a student call starts, the server reserves a per-user request and token
allowance. It persists the completed input/output counts in `ai_usage_events`,
uses provider counts when available, and records a conservative estimate for
CLI providers. Failed calls release the token reservation but still count
toward short-term request throttling. `/api/ai/usage` returns the authenticated
user's current allowance and reset times; HTTP 429 responses include
`Retry-After` and a structured `AI_RATE_LIMITED` payload.

## User privacy controls

Settings exposes the same authenticated usage summary returned by
`GET /api/ai/usage`, including request and daily/monthly token allowances.
`GET /api/account/export` produces a no-store JSON download containing the
current Clerk account fields, every personal table (study record, academic
programmes, activity), and the user's own AI usage ledger.

Permanent deletion is an explicit two-stage action: the interface requires the
user to type `DELETE`, and `DELETE /api/account` independently validates that
confirmation. The backend deletes only rows keyed by the authenticated Clerk
user ID, withdraws that account's sources from future editorial processing,
deletes source bytes when no independently authorised contribution still
supplies the same asset, and then deletes the corresponding Clerk identity.
Published reviewed derivatives are separate editorial content and are not
automatically removed. Hosting, database,
and identity-provider backup or security-log retention remains governed by the
configured provider agreements and operational retention settings.

The product pages provide transparency and self-service controls, but legal
compliance also depends on real operator details, monitored contact addresses,
provider data-processing agreements, transfer safeguards, retention policy,
and an appropriate legal review before broad production use.

## Deploy

The production hostname is `https://study.wicker.life`. It is attached to the
`wickerlife/exam-study-platform` Vercel project; its `study` CNAME must point to
the target reported by `vercel domains inspect study.wicker.life --scope wickerlife`.

1. Create a Neon project and copy its pooled `DATABASE_URL`.
2. Create a Clerk application and copy both API keys.
3. Configure the variables from `.env.example` in the hosting platform.
4. Run `npm run db:migrate` once against Neon. The production runner also
   applies the same idempotent migrations under a database advisory lock before
   accepting traffic, so deploys cannot start against an older schema.
5. Publish the reviewed corpus with `npm run content:publish`.
6. Deploy to Vercel with `Dockerfile.vercel`, or build the standard Dockerfile
   on another Node-capable container host. `.dockerignore` excludes `content/`;
   the hosted runtime reads it from Neon.
7. The image runs `next build` before pruning development dependencies and
   starting the combined Node/Next runtime.
8. Verify `/api/health` reports `ok: true`, `mode: "neon"`, and an `integrations.llm` object with the expected provider/model and `configured: true`. This is a configuration check; the release smoke test should also exercise one authenticated, retrieval-grounded model call.

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
