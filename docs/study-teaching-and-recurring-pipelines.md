# Teaching quality and recurring course pipelines

Implementation contract: `student-source-teaching-v5` (lesson format 3). Saved formats remain readable. These changes do not regenerate existing saved guides on deployment.

## Teaching and acceptance

Hosted and MCP-led generation use the same durable pipeline and response schemas. Each chapter has a saved objective/evidence plan before drafting. Difficult objectives map to visible explanations, worked reasoning, guided attempts, independent questions and transfer. Optional detail remains enrichment; the summary is a separate revision view. No compact chapter word budget applies.

Question keys connect progressive hints, diagnosed misconceptions and related variations. Formative feedback may identify supplied misconception indices; it must not infer mastery from reading, completion or missing answers. Untimed guided attempts are separate from quiz simulation. The current remediation UI suggests a later transfer question; it does not schedule a delayed assessment or claim longitudinal mastery.

Factual review and pedagogical review run as separate calls. Pedagogical review must identify actual teaching and assessment evidence for every objective. Provider schemas constrain objective IDs, diagnostic fields and comparison-table dimensions. Referential checks reject missing objectives, invented quotes and invalid question links; they cannot prove semantic adequacy. Both reviews must pass before activation. Local agents supply their own semantic review in fresh critique contexts; this is not independent platform or editorial verification.

The opt-in quality evaluation now plans and generates, runs both reviews, tests factual corruption, and reviews positive and deliberately shallow IoT controls. Cases cover missed polling pulses, ISR elapsed time, writes without notification, Ready versus Running, and cooperative blocking. Scripted unit/browser fixtures validate wiring only. `npm run test:study:live` uses an existing `OPENAI_API_KEY` with a spending cap, otherwise explicitly skips (use `-- --require-live` to fail on missing credentials). `npm run test:study:readiness:live` checks weekly, textbook and mixed-year readiness controls. `npm run test:study:pipeline:live` sends real model responses through hosted and local next/submit state machines in disposable local accounts and refuses a database URL. Both extra suites require a usable key and write their reports under `/tmp`. Learning improvement still requires evaluation with students.

## Existing recurrence and the gap fixed

Vercel calls `/internal/canvas-dispatch` every minute. The outbox dispatches durable collection, study and paper jobs. Previews do not sweep copied accounts. Canvas consent, active programme, edition eligibility and user pauses remain prerequisites.

Previously, initial collection was followed only by lightweight freshness jobs. The saved material-frequency value did not cause a second full collection. The scheduler now chooses a full collection when that frequency is due, and lightweight checks between collections. Freshness completions cannot indefinitely postpone full collection. Unchanged resources reuse stored originals/indexes; changed resources are reprocessed.

New connections default to daily material collection and 30-minute announcement/assignment checks. Migration 036 changes only the column default: existing explicit frequencies are preserved. All accessible supported academic editions are discovered, while recurring collection follows the current academic period; unsupported/nonacademic spaces and inaccessible Canvas content are not scraped.

Attendance/priority extraction already runs after collection and on its own derived-evidence schedule (normally daily; shorter retry/correction windows). New or changed mock/practice sources already enqueue idempotent paper jobs. These jobs now respect independent recurring-pipeline controls.

## Automatic module guides

Enable a course under Study guides → Automatic module guides. Choose hosted generation (existing account limits plus a per-revision cap) or a local MCP agent. No course is enabled automatically on deployment. Global guide, paper and priority switches live in Settings → Recurring pipelines. Pausing prevents subsequent calls; an in-flight call can finish its checkpoint. Existing runs retain their payer and execution mode; the selected mode applies to future revisions.

A complete Canvas import saves module boundaries, release dates, placements and collection gaps. Cheap rules nominate modules for review after two days of unchanged content. Weekly candidates use practice, subsequent-week content or release transitions; topic candidates use practice, dated transitions or supplied readings. These are candidate signals, not claims a professor has finished publishing. A separate source-based readiness call must establish a coherent current-year topic scope and identify missing readings, placeholders and unresolved topics. It can decline readiness without fabricating a guide. The same step is supplied to local agents.

The scheduler compares content fingerprints after imports and announcement updates, with a daily fallback. One stable private guide identity is maintained per module. Changed sources create a new revision; the previous checked revision stays readable. Active or student-stopped runs are not silently overwritten. New/changed material during generation blocks stale activation. Readiness failures are visible in the guide and Settings; changed evidence triggers a new attempt, while unchanged failed content needs an explicit retry.

Current-course announcements from the recurring Canvas metadata refresh become private, dated source records. New or edited notice text changes its digest. Announcements/syllabus context are supplied to each affected chapter and participate in reuse fingerprints. Later explicit exam-scope amendments constrain mapping, objectives, questions and cards. Ambiguity is reported; an unrelated notice does not override a syllabus. The refresh is polling-based, not an immediate Canvas webhook. Announcement discovery currently uses the existing 120-day active-announcement window; older notices already collected remain retained. Deletion/retraction detection is not a completeness guarantee.

Automatically maintained module guides receive automatic revisions. Existing manually created guides keep their explicit selections and already display source freshness notices; they are not silently enrolled or regenerated.

## Textbook-led and past-year courses

A textbook title/link or reading assignment establishes a requirement, not access to its content. Supply readable relevant chapters/excerpts as supporting sources. Missing required text blocks readiness. Large books should be provided as relevant chapters rather than exceeding the existing source-selection limit.

Past-year material can be suggested or automatically selected for conservatively matched topics when enabled. Generic week/file numbers are not sufficient matches. The semantic readiness review still checks curricular compatibility. Current-year evidence must establish each scoped topic; old material supplies explanations, never current exam scope, deadlines, rules, exclusions or proof of complete coverage. Conflicting editions and missing current scope are explicit gaps. The reader retains source-year provenance, and the generation contract requires historical/background caveats. Automatic matching is conservative and can miss relevant material; explicit supporting-source selection is available.

## Controls and observability

- `/app/settings?tab=pipelines`: independent processing switches, Canvas frequency controls in right-side drawers, course guide toggles, saved job statuses and up to 100 recent events (50 checks retained per course).
- `/app/settings/canvas-sync`: collection history and retries.
- `/app/settings/canvas-sync/logs`: durable Canvas/priority logs and checkpoints.
- `/app/courses/<courseCode>?year=<academicYear>`: per-course guide settings in a side drawer, source gaps and guide links.
- `/app/study/<versionId>`: exact readiness/review failures, current stage, prior revisions, source freshness and retry controls.

MCP 2.16 adds `study_pipeline_status`, `study_module_guides`, `study_module_guides_configure` (local execution only), and `study_generation_queue`. Continue queued local work with the existing next/submit protocol. A local subscription cannot run unattended on the hosted server; pending work waits until an agent connects. Hosted automatic spending and global controls are configured in the browser.
