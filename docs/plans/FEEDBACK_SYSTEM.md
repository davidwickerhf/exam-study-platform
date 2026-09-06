# Feedback and quality operations — implementation plan

Status: proposed, not implemented. This document is the concrete plan requested by the user; shipping the document does not enable feedback collection. Updated 6 September 2026.

## Outcome

Students can report a problem, suggest an improvement, or rate a Tutor answer without leaving their task. They see exactly what is submitted and can track the result. Administrators get a deduplicated, actionable queue linking each report to the relevant answer, course edition, source version, sync job or deployment.

Operational errors and user feedback share an investigation workflow, but retain different permissions and evidence rules. An error does not grant an administrator access to a private conversation or document. Feedback does not become Tutor memory or alter a student's academic record.

## Existing foundations and gaps

Reuse the authenticated API and account isolation in `server.mjs`, the workspace shell and components, and the existing administration area at `/app/admin`. Existing editorial intake, review and publishing remain authoritative for changes to maintained course material.

Tutor conversations already persist (`lib/tutor-store.mjs`, `lib/tutor-turns.mjs`), but visible messages have no stable message ID. Add stable turn, message and answer-revision IDs before attaching ratings. Canvas already has course-edition bindings, source snapshots, checkpointed jobs and a log portal. The API activity log records bounded request metadata, not payloads; correlate by IDs without importing complete logs automatically.

There is no unified student-feedback store or admin feedback workflow today. Assignment “feedback” in Updates is instructor feedback from Canvas and remains separate.

## Student entry points

| Surface | Interaction | Attached reference by default |
| --- | --- | --- |
| Every workspace page | Persistent “Feedback” item in the account/help menu; keyboard-accessible | Route template and app release |
| Tutor final answer | Helpful / Not helpful, plus “Report a problem” in the answer menu | Answer ID and revision; course edition when applicable |
| Tutor error or interruption | Retry remains primary; secondary “Report this problem” | Safe error code, request ID and stage |
| Tutor conversation | “Send feedback about this” when the student expresses dissatisfaction | A prepared draft only, never silent submission |
| Course material / reader | “Report material” on a source, chapter, page or selected passage | Edition, immutable source/version ID and page/section |
| Assignment / announcement | “Report an issue” in its menu | Connected origin, item ID and edition, without credential-bearing URLs |
| Canvas sync | Report beside a failed job/resource; link to existing incident when known | Job, attempt, stage and safe diagnostic codes |
| Attendance / planning / credits | Report beside the figure or record | Record reference and calculation/version identifier |
| Practice | “Problem with this question” after or during an attempt | Question version, rubric/grader version; the student's answer is optional |
| MCP / local AI | Prepare report → user review → confirm exact report | Tool and permitted resource IDs; explicit confirmation per submission |

Do not prompt after every answer or navigation. Quiet controls remain available. Offer a contextual prompt after a terminal failure, not every retry. Dismissal is remembered for that incident. A satisfaction prompt, if introduced later, is sampled and frequency-capped; absence of a rating never means satisfaction.

### Fast reporting flow

1. Open a compact accessible dialog. In Tutor, use an anchored compact composer for quick reactions and expand to the same dialog for detailed reports. Keep the underlying conversation in place; do not introduce another permanent sidebar.
2. Choose a reason using short chips: incorrect, outdated, missing information, source/citation issue, slow, broken, confusing, accessibility, suggestion, or other. Contextual choices reduce clutter: a source adds wrong edition / incomplete extraction / broken download; an answer adds ignored context / too wordy / wrong action.
3. Write an optional note. One sentence is enough. Attach a screenshot or selected excerpt only if desired.
4. An always-visible “What will be sent” summary lists the exact data. Expand individual items; remove optional items. Show the final snapshot, not a promise that the server will choose an excerpt later.
5. Submit once, with immediate progress. Preserve the draft on failure and offer retry. Show a receipt with a report link and “View my feedback.” Do not show success before the server confirms persistence.

A quick Helpful/Not helpful reaction is an explicit submission of the reaction and answer reference only. The affordance says that no chat text is included. Not helpful can immediately offer optional reasons/details, without forcing another submission or opening a full form. Re-click or change updates the same reaction, with undo. The report dialog separately offers consent to share the answer text and selected messages.

“My feedback” at `/app/feedback` lists status, the student's submitted evidence, public replies and resolution. It supports follow-up, withdrawal of optional evidence, and notification preferences. Internal notes and other users' reports remain private.

## Automated capture and Tutor-assisted feedback

### Operational diagnostics

Capture terminal API, streaming, sync, extraction and navigation failures through a shared allow-listed event helper. Record request/turn/job ID, route template, stage, stable error code, release, duration, retry count and outcome. Aggregate recoverable retry failures; distinguish cancelled, unavailable and rate-limited from defects.

Never send raw exception messages, URLs with query strings, request/response bodies, tokens, local filesystem paths, form values, chat content or documents through this channel. Unknown exceptions are reduced to a safe code; any stack is scrubbed and limited to application frames. Diagnostics are for first-party service reliability, clearly described in Settings and privacy documentation. Optional browser performance analytics have their own opt-in; no session replay, screenshot capture, keystroke capture or analytics vendor is part of this plan.

Use local validation after each answer for missing referenced sources, invalid widgets/actions and incomplete streaming. Record metadata for detected failures. Explicit source uncertainty is not automatically a hallucination. Do not run a second model over every response: it increases cost, latency and exposure without establishing correctness.

### Tutor-assisted draft

When a user says “that is wrong,” “you ignored the announcement,” or similar, the Tutor first attempts to resolve the study question. It may also offer “Send this as feedback,” with a prepared draft citing the particular failure. The user reviews the exact excerpt and submits; ordinary criticism is not itself permission to forward the chat to admins.

Tutor can create a report draft and read the student's own report status. It cannot silently submit, close an issue, change official material, or email anyone. MCP follows the existing prepare/confirm receipt pattern and logs both operations in AI activity. Each confirmed write binds to a fixed draft revision; changing evidence invalidates the prior review token.

### Quality signals, not verdicts

Count explicit ratings, source errors, retries and reported slowness separately. A regenerated answer or short conversation is not a negative rating. AI may suggest categories, duplicate clusters and next actions only from evidence already authorized for that report; label its output as a suggestion. Private evidence must not be fed into a classifier by default: initially use deterministic metadata grouping, then offer separately disclosed AI-assisted review on the submitted snapshot.

## Evidence and consent contract

| Evidence | Default | Administrator visibility |
| --- | --- | --- |
| Route, release, safe error code, timing | Included and shown | Support / reliability roles |
| Answer reference and reaction | Included for answer feedback | Reference and aggregate only; cannot dereference private chat |
| Answer text | Optional, previewed | Authorized reviewers of this report |
| Prompt and preceding messages | Off; user selects messages or an excerpt | Only selected snapshot |
| Full conversation or Tutor memory | Never automatically included | No report-based access |
| Public maintained material excerpt | Show exact selection and version | Editorial reviewers |
| Private Canvas or uploaded source excerpt | Off; explicit selection and preview | Restricted report evidence, not general editorial access |
| Screenshot | User attaches, previews and can remove | Restricted attachment access |
| Logs | Allow-listed diagnostic metadata | Reliability reviewers; no full log dump |
| Contact | In-app reply by default; optional contact permission | No unrequested external outreach |

Use structured attachment references and authenticated downloads, not public URLs. Strip EXIF where applicable, validate MIME/size, scan attachments, and render files in a sandbox. Secrets are blocked or redacted before upload; the preview shows any redaction. Scrubbing is defence in depth, not a guarantee that a screenshot contains no private information.

Support pseudonymous reporting with no display name exposed to reviewers; disclose that the backend still associates it with the authenticated account for abuse prevention and replies. Do not call it anonymous. A later public unauthenticated channel needs separate anti-abuse and privacy design.

Proposed retention, to finalize before rollout: operational event detail 30 days; optional attachments/excerpts 90 days after closure; report metadata and user-visible correspondence 12 months after closure. Purge on account erasure except genuinely non-identifying aggregate counts. Withdrawal removes the evidence snapshot and download access; it need not erase the existence of a resolved product defect. Document deletion and backup expiry honestly. Do not train models on feedback by default.

## Data model and APIs

Use new relational tables, tenant-scoped queries and append-only issue events. Do not pack a growing admin inbox into `user_documents`.

- `feedback_reports`: account, channel, category, subject reference, report text, status, created/updated time, consent snapshot/version, idempotency key and optional parent issue. Client-submitted classifications are untrusted.
- `feedback_reactions`: account + answer/version unique key, value, reason codes, timestamps. A changed vote updates one record.
- `feedback_evidence`: report-owned immutable snapshots, media type, checksum, size, scope, expiry and encrypted storage reference. No live private-resource dereference for reviewers.
- `feedback_issues`: title, type, severity, owner, workflow status, affected versions, first/last seen, occurrence and unique-account counts, root cause, resolution and verification.
- `feedback_issue_events`: actor, transition, public reply or internal note, action receipts. Internal/public visibility is explicit and enforced server-side.
- `quality_events`: minimized operational events, deterministic fingerprint, release, safe diagnostic fields, expiry. Aggregation is separate from individual reports.
- `feedback_jobs` / outbox: durable notifications, deduplication and optional AI classification, with retries and idempotency.

Student endpoints: `POST /api/feedback/drafts`, `POST /api/feedback/reports`, `GET /api/feedback/reports`, `GET /api/feedback/reports/:id`, `POST /api/feedback/reports/:id/replies`, `DELETE /api/feedback/reports/:id/evidence/:evidenceId`, and `PUT /api/feedback/reactions/:answerId`. Draft confirmation binds to a revision/hash and expiry; all referenced resources are ownership-checked on both preparation and submission.

Admin endpoints under `/api/admin/feedback`: paginated issue/report queries; assignment, status and reply operations; evidence access; linked action preparation/confirmation. Fine-grained support, reliability and editorial capabilities supplement existing admin authentication. Record every evidence access and action in an admin audit ledger. Never trust a UI-only role check.

Deduplicate transport retries by idempotency key. Fingerprint operational errors by code + component + stage + release family, excluding user data. Group user reports by exact subject/version and category first; AI can suggest broader grouping, but an admin confirms uncertain merges. Preserve individual reports, votes, affected-account counts and consent after grouping. Never merge away contradictory reports or label a duplicate report “resolved” while its issue is open.

## Administrator workspace

Add a Feedback destination using the normal admin shell. Use a filterable issue list and a dedicated issue detail page, not a wide drawer. Preserve filters/back navigation. Start with saved views: New, Needs triage, Assigned to me, Blocking failures, Answer quality, Material issues, Suggestions, and Recently resolved.

Each list row shows a clear title, type, severity, affected course/edition or component, unique reporters/occurrences, age, owner and status. Filter by release, course edition, source, channel and time; cursor-pagination and bounded summaries keep the page fast.

The detail page has a short problem summary, impact, sanitized evidence, reproduction information and activity timeline. Separate public correspondence from internal notes. Show “Not shared” for missing private context rather than attempting to fetch it. Request additional evidence through an in-app message; the user decides what to share.

Statuses: new → triaged → investigating → planned/in progress → awaiting verification → resolved. Also needs information and closed without change, with a stated reason. Severity and priority differ: a frequently requested cosmetic change need not outrank an incorrect attendance requirement. Mark AI category/priority suggestions as unconfirmed.

### Concrete admin actions

- Retry or inspect a linked sync/extraction resource through existing scoped controls; preserve original files and checkpoints.
- Open the exact source edition in editorial review. Propose a correction or re-extraction, validate it, then publish through the existing release gate.
- Investigate missing retrieval with source IDs, edition filters, extraction/index versions and safe request metadata; run a controlled replay only with authorized evidence.
- Link a code fix / release / incident to the issue. GitHub export is an explicit later integration, never an automatic upload of private evidence.
- Send an in-app reply, request clarification, assign an owner, or apply an internal label.
- After verification, publish a plain-language resolution to affected reports. Batch notifications only to linked reporters; never expose identities across reports.

A report can never directly modify attendance, grades, course rules, private memory or published material. User-facing corrections and editorial releases keep their existing approval boundaries.

## Performance and resilience

Feedback controls render with the answer/page and do not add blocking page-load requests. Lazy-load the full dialog. Keep reactions small (target under 2 KB) and metadata events bounded (target under 4 KB). Upload optional evidence separately with strict limits; proposed screenshot maximum 10 MB and five attachments per report.

Use idempotent POSTs and a durable outbox. Retry transient failures with backoff; show an honest unsent state. Keep sensitive drafts in memory by default; do not silently persist private excerpts to browser storage. Aggregate repetitive errors, cap per-session/browser reports, rate-limit server-side by account, and put a circuit breaker on the reporting channel itself. A failed telemetry request must never recursively report itself or block a Tutor answer.

Targets to verify: no additional blocking request for navigation or answer rendering; immediate local button feedback; typical persisted reaction/report metadata acknowledgement within 500 ms in the deployed region, reported as a measurement rather than a guarantee. Track p50/p95 submission latency, failure/retry rates, reports per 100 answered turns, triage age, resolution age and recurrence by release. Do not optimize for raw positive ratings or incentivize hiding reports.

## Delivery sequence and acceptance gates

1. **Contract and identity.** Stable message/turn IDs with legacy backfill, schema/migrations, subject references, consent previews, role matrix, privacy copy and retention jobs. Verify older conversations remain readable and references survive reload/retry without cross-user access.
2. **Manual vertical slice.** Global entry, answer ratings/reporting, report receipt, My feedback, admin list/detail and public replies. Ship end-to-end before expanding entry points. Verify exact payload preview, retry idempotency, error recovery, keyboard/mobile operation and no navigation slowdown.
3. **Materials and study surfaces.** Reader/page/selection reporting, assignment/announcement references, practice, credits and attendance. Integrate source versions and editorial actions. Test wrong-edition reports, private/public evidence isolation and source withdrawal.
4. **Diagnostics.** API/Tutor/Canvas failures, performance timings, durable outbox, deterministic incident grouping, volume controls and retention. Inject stream interruption, extraction failure, rate limiting and telemetry outage. Confirm no prompts, tokens or private document text reach events.
5. **Tutor and MCP assistance.** Prepared reports, exact per-write confirmation, own-report reads and AI activity receipts. Optional AI triage only after the submitted-evidence boundary is proven. Test expired/changed drafts, replayed confirmations and criticism without submission consent.
6. **Operations and refinement.** Assignment/severity workflows, issue recurrence, editorial verification, notifications, dashboards and controlled rollout. Add authorized answer/source replay fixtures and regression tests for actual resolved defects.

Roll out behind separate flags for submission, diagnostics and AI-assisted triage. Begin with internal accounts, then a small opted-in cohort. Feedback failure must leave studying usable. Run `npm run verify`, database isolation/concurrency tests, permission negative tests, and T3 desktop/mobile browser checks at each shipped slice. Check both preview and production with a synthetic non-private report, then remove the fixture.

## Required test scenarios

- Two clicks/network retries create one report; a vote change does not inflate counts.
- A deleted chat or expired source reference does not leak private content to support.
- An admin without evidence permission can triage metadata but cannot download attachments.
- Exact preview bytes match submitted evidence; editing the draft invalidates prior approval.
- An error with a token in its raw message produces only a safe diagnostic code.
- A failed reporting endpoint neither blocks Tutor nor generates a reporting loop.
- Duplicate grouping preserves individual consent, public replies and user isolation.
- Summer/course-year changes retain correct source editions in reports.
- Resolving an issue requires recorded verification; a reopened recurrence is visible.
- Account erasure removes reports, attachments, linkage and private classification inputs.
- An MCP client cannot submit a write without explicit per-report confirmation.
- Feedback does not silently become Tutor memory, an official course rule or a training example.

## Documentation deliverables

Public and signed-in docs: where to report, exact shared data, report status and withdrawal. Settings/privacy: diagnostics, optional analytics/AI review, retention and evidence access. Admin handbook: severity rubric, triage, response tone, investigation, escalation, publishing boundaries and resolution verification. Developer docs: event schema, fingerprinting, consent contract, integration helpers and example failure fixtures. MCP README, manifest and companion skill: prepare/read/confirm feedback tools with one-confirmation-per-write examples. Mark proposed features as planned until their routes ship.
