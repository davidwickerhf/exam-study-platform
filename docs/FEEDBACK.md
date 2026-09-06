# Feedback and quality review

Students can open **Feedback** from workspace navigation, or use a contextual report control on Tutor answers, course material, chapters, assignments, announcements, practice questions and Canvas syncs. My feedback is `/app/feedback`; the review team works at `/app/admin/feedback`.

## Student flow and shared data

A Helpful / Not helpful reaction stores only the account, answer ID, answer revision, selected rating and time. Changing or clearing it updates that same reaction. It does not forward the answer text.

Detailed reporting has two steps: prepare an exact preview, then submit it. The preview lists the category, message, surface/reference IDs and every optional attachment. Answer and selected chapter excerpts are opt-in. Screenshots are manually selected; the browser converts them to PNG and the server validates dimensions, decompressed size and checksums and removes ancillary metadata. Up to five attachments, each screenshot under 5 MB and 4096 × 4096 pixels, are accepted within a bounded request. Inspect screenshots for private information before sharing.

The account and submission time accompany a report. Referenced chats, transcripts and private course files are not copied into it, and feedback reviewers do not gain access to those originals by opening a report. Attached evidence and unsubmitted drafts use authenticated encryption. Known credential patterns are redacted before the preview, so the user sees what will actually be stored. Redaction is a safeguard, not a guarantee that arbitrary personal information can be detected.

Reports are durable and scoped to their owner. The receipt links to status, public replies, follow-up and evidence withdrawal. Staff-only notes never appear there or in personal exports. Withdrawal deletes the shared attachment, not the original study file; it cannot undo a review that has already happened. Account export includes submitted reports, public replies, shared evidence, reactions and preferences. Account erasure removes the account's feedback data.

## Diagnostics and AI review

Diagnostics use allowlisted codes and page categories. API failures, Tutor failures/interruption, browser errors and Canvas processing failures can contribute minimized events. They do not include exception messages, bodies, chat text, credentials, raw URLs or local file paths. The feedback preferences allow students to disable them. Slow-operation timing is a separate opt-in. Diagnostics are not a session replay service.

Human reports are grouped by account, exact subject/version and category. Repeated operational events group by sanitized code, surface, stage and release. Transport retries reuse the same draft receipt. The admin can group broader duplicates explicitly while retaining each reporter's separate replies and evidence permissions.

A durable database outbox provides bounded, leased triage work. Deterministic severity suggestions are available first. Optional model-assisted review requires both the student's per-report checkbox and `FEEDBACK_AI_TRIAGE=on`. It reads only the submitted message and up to three attached text excerpts; it has no retrieval or action tools and does not inspect screenshots. It produces a clearly marked, unverified suggestion. There is no second model pass on every Tutor answer and no automatic publication, academic-record correction or outgoing email.

## Review workflow

1. Open the queue. Filter by status, category or assignment. Review report counts, voluntary ratings, open issues and triage age.
2. Open an issue and then the relevant report. Use the exact source/edition references to reproduce it. Opening evidence requires the evidence role and records an access event.
3. Assign an owner and severity. Use internal notes for investigation; explicitly choose a public reply when contacting the student.
4. Follow the existing sync/editorial controls to investigate or fix the underlying issue. These controls retain their own account scope and publication gates; a support role does not confer permission to change another student's study data.
5. Record a resolution and concrete verification evidence before marking resolved. If closing without a change, state why. Public status updates show their exact text before saving. Recurring diagnostics reopen the incident.

Severity: critical for isolation/security incidents or widespread inability to study; high for consequential credits/attendance errors and blocked deadline workflows; normal for localized material or interface defects; low for non-blocking suggestions. Suggestions do not set severity automatically. There is no advertised support SLA.

Global admins can assign support, reliability, editorial and evidence capabilities in the queue. Support is required to triage/reply; reliability permits detailed diagnostic review; evidence permits explicitly submitted attachments. Editorial publication still uses the pre-existing editorial authorization. Global administrators retain all capabilities. Every protected endpoint enforces roles server-side.

## Operations and retention

Migration: `db/032_feedback.sql`. Storage encryption uses `FEEDBACK_ENCRYPTION_KEY` (32-byte base64 key), falling back to the existing Canvas connection encryption key. Rotate keys only with a re-encryption procedure; replacing a key alone makes old evidence unreadable.

Switches: `FEEDBACK_SUBMISSIONS=off` pauses new writes, `FEEDBACK_DIAGNOSTICS=off` disables minimized capture, and `FEEDBACK_AI_TRIAGE=on` enables consented asynchronous suggestions. AI review is disabled by default. Preview deployments do not run automatic diagnostics/maintenance.

The authenticated scheduled dispatcher calls the feedback maintenance operation separately from Canvas processing. Jobs have lease tokens, bounded attempts and persisted status; a failed triage job does not lose a report. Queue metrics expose failed jobs. Drafts expire after 30 minutes and are purged after one day; diagnostics after 30 days; evidence 90 days after issue closure; closed reports after 12 months. Open reports remain until resolved or account deletion. Infrastructure backup retention is separate from live-table deletion.

Verification: `npm run verify`; disposable PostgreSQL isolation/concurrency fixture:

```sh
FEEDBACK_TEST_DATABASE_URL=postgres://...@127.0.0.1:55433/postgres \
  node --experimental-test-module-mocks scripts/verification/feedback.mjs
```

The fixture refuses non-local databases and recreates its schema. Never point it at production.

## Agent integration

MCP 2.10 adds `feedback_prepare`, `feedback_submit`, `feedback_list`, `feedback_read`, `feedback_reply`, `feedback_withdraw_evidence`, and `feedback_react`. Prepare → show the returned preview → obtain fresh explicit approval → submit the same draft ID and revision. Follow-ups, withdrawal and reactions each require their own approval. Do not reuse an earlier “yes” for later writes. Feedback is separate from Tutor memory; reporting dissatisfaction does not authorize saving preferences or attendance. AI activity records the operation without copying its payload.

## Contact email and progress updates

The report form offers **Share my account email for this investigation**, off by default. The server takes the address from the authenticated account, never an arbitrary submitted address. The exact email appears in the preview. It is encrypted separately, excluded from AI triage, and can be withdrawn from the report. Support reviewers must explicitly open it; that access is audited. Sharing it permits the team to reach out for the investigation; the platform does not automatically send emails. Shared contact details expire with evidence 90 days after closure.

The student sees Submitted → Received → In progress → Completed. A browser reviewer opening the report records the first received timestamp once. Every changed review status creates a public timeline event; private investigation text remains private. Completion requires a shared comment and, for resolved issues, verification evidence. A reviewer may turn an AI triage suggestion into a reply draft, edit it and explicitly send it. Such comments are labeled **AI-assisted reply · reviewed by the team**. No AI comment is sent autonomously. An open report refreshes its status and public comments every 15 seconds while the page is visible.

MCP supports `shareContactEmail:true` in `feedback_prepare` only after the student opts in. The returned preview shows the actual address. `feedback_withdraw_contact` removes it after fresh confirmation.

## Screenshots and conversation excerpts

Every report composer accepts up to four PNG, JPEG or WebP screenshots (5 MB each, at most 4096 × 4096 pixels) plus one text excerpt of up to 12,000 characters. Screenshot totals must fit the existing attachment payload limit; the form explains when smaller images are needed. Images are converted to PNG and metadata is removed. Screenshots can be removed individually before preview.

Choose **Attach Tutor conversation text or another excerpt** to paste relevant questions and replies. Reporting a Tutor answer pre-fills that answer for editing, with sharing still off by default. Users can add surrounding conversation or remove private details. No entire conversation is fetched or shared automatically. The exact attachment text and images appear before confirmed submission, and attachments can be withdrawn from the report afterward.


## Report experience

My feedback separates reports from diagnostics preferences. A report opens as a
conversation with its original note, review updates and a reply composer.
Progress and collapsible sharing controls remain alongside the conversation.
Email consent and attachment withdrawal are available under Shared details.
Tutor answer revisions use canonical JSON object ordering so a database JSONB
round-trip does not invalidate Helpful, Not helpful or Report an issue controls;
actual edits to answer text or widgets still invalidate stale feedback.
