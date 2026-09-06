# Workspace loads and integrated Tutor views

## Problem and implementation

Earlier production logs included repeated container-startup migration processes. The current deployment uses native Next.js with a separate Node API service (see DEPLOYMENT_SEPARATION.md). Startup now compares tracked SQL hashes to the migration ledger in one read, without spawning the migration CLI when the schema is current. A missing/mismatched ledger or read failure retains the existing fail-closed migration path. Canvas collection now runs as durable bounded Vercel queue tasks.

Sidebar links use bounded Next.js prefetching plus hover/focus intent. Selection changes immediately through a transition, while route loading shells render before data arrives. Visited route payloads are reusable for five minutes. Stable authenticated browser reads last five minutes; live sync/calendar endpoints use at most 30 seconds and their existing polling. Account changes discard data and fence pending replies. Known source/Canvas writes invalidate their dependencies; unknown writes remain conservative.

Course navigation requests only the active programme and compact curriculum placements (38,493 bytes for Computer Science versus 383,200 bytes for the full catalogue); all historical editions remain present. Home requests only Canvas assignments. Updates loads the selected feed, and chapter practice requests only that chapter's bank. Chapter Tutor code loads when opened. Planning and course Canvas catalogue reads share the authenticated memory cache. Sync summaries omit historic course runs, and their independent database queries run together. The log portal retains complete history.

Canvas reads now deduplicate pending calls, fence invalidated requests, and use day-aligned feed windows instead of unique timestamped URLs. A shared account-scoped response cache now also survives cold instances (see DEPLOYMENT_SEPARATION.md). Partial failures are not cached.

## Design lock

Target: existing Wicker DESIGN.md and user screenshots. Keep Archivo, navy ink, existing indigo action color and warm canvas. No new visual theme or bitmap assets.

| Decision | Source | Application |
| --- | --- | --- |
| Inline library navigation and compact rows | Refero Parallel research history, screen a8642d5b-a723-41a6-950e-3c7049bca582 | Conversation / History / Sources below the Tutor title; no modal drawer |
| Quiet grouped controls | Existing Perplexity style research in TUTOR_ACTION_WIDGETS.md | Neutral underline; no hard indigo perimeter |
| History search, visible deletion and source metadata | User's drawer objection and existing file actions | Searchable full-width lists with date, size and status |
| Smaller course header | User's course screenshot request | Title and edition/actions share a row; result, reading and next exam form a compact metadata strip |

The conversation and unsent draft survive view changes. History and Sources fetch independently when opened. Inline answer evidence and Proposed actions remain tied to the current conversation.

## Inspect

- /app/tutor: Conversation, History, Sources; reopen/delete a saved chat; source download/removal; draft preservation.
- /app/courses/BCS2120: compact title/edition header, reading status, tabs.
- /app/courses/alg/01: chapter-scoped practice and deferred Tutor.
- /app/updates: each feed, return visit, explicit refresh.
- /app and /app/settings/canvas: summary versus detailed sync history.

## Validation and limitations

Automated regressions cover concurrent Canvas deduplication, nearby-time cache hits, narrow feed reads, per-resource TTLs, source-mutation dependencies, auth-scope fences and startup schema-ledger fallback. Full verify result and preview inspection are recorded in the PR.

Local browser fixtures validate interaction/request reuse, not production latency. Production preview requires sign-in to inspect private data. This does not claim every endpoint is below a particular time budget: the all-course Practice bank remains available on its dedicated page, and cold Canvas reads still depend on Canvas latency.

## Assignment details and Tutor follow-ups

Assignment priorities link to `/app/updates?tab=assignments&assignment=COURSE_ID%3AASSIGNMENT_ID`.
The selected brief, dates, submission/rubric/comments load separately from lists and
refresh independently. Tutor sends public activity and partial summary text over NDJSON;
the persisted final answer replaces temporary content. Sending a message invalidates
Tutor data rather than every page cache. Secondary catch-up is collapsed and equivalent
proposals/drafts are reused across follow-ups. Fixture timings are not production latency
benchmarks; upstream authentication, Canvas and model latency still need monitoring.
