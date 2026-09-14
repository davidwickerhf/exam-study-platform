# Teaching quality and recurring course pipelines

Implementation contract: `student-source-teaching-v7` (lesson format 3). Saved formats remain readable. These changes do not regenerate existing saved guides on deployment.

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


## Exhaustive acceptance and bounded correction (v6)

Objective coverage links are derived from section/question annotations. Invalid misconception links get a small schema-constrained correction. Neither operation establishes semantic adequacy.

Factual review first solves every question without seeing the generated lesson, hints or answer key, then compares the proposed answer with that independent solution. Each teaching section, revision summary, card group and scope plan receives an explicit verdict. Arithmetic witnesses are checked by a restricted numeric parser. Reviews are checkpointed in groups of four and fingerprinted to the exact content; incomplete or stale reviews cannot activate a chapter. This remains model review rather than a general mathematical proof system.

Pedagogical review has a separate checkpoint for each objective, retaining the visible lesson and relevant assessments. Every transfer and misconception-follow-up question receives a specific check. Aggregation keeps a negative verdict when overlapping objectives disagree. Selected quotations remain exact lesson substrings and avoid provider-invalid quote literals.

Structural, link, factual and pedagogical corrections share a persisted limit of three automatic attempts per chapter. Each correction starts from the latest saved draft and findings. Exhaustion retains that draft and stops generation; an explicit retry requests an additional correction without resetting the automatic count. API and MCP status expose the limit, attempt counts and correction history (phase, base hash and blocking findings). Invalid factual-review responses can retry once without rewriting the chapter. Question-only, section-only and flashcard-only findings use bounded replacement schemas that preserve unaffected content; broader findings request a coherent chapter correction. All corrected content is reviewed again. Spending limits remain in effect and estimates now account for repeated evidence and review calls. A failed correction preserves the prior active guide.

## Tutor SDK and shared MCP study context (2.17)

Tutor tool dispatch and continuation use OpenAI Agents SDK 0.18. Existing account/programme conversation storage, provider configuration, quota accounting, source checks, structured replies and proposal approvals remain authoritative. The SDK model adapter uses the existing billed provider transport. Unsupported drafts never stream to the student or become saved answers. Automatic external tracing is disabled. This migration does not add arbitrary shell tools or permit the Tutor to apply staged actions without approval.

MCP adds `study_session_context`, `study_session_save` and `study_session_forget`. An authorised study session can save checkpoints without paying for a hosted Tutor call. Each checkpoint contains course/year, a concise summary, topics, observations with their basis, and next steps. An observed-answer claim requires the actual student response. Checkpoints cannot update grades or mastery. The same memory enters the in-app Tutor's turn context; a read tool retrieves older or other-course sessions. These are labelled untrusted historical learning context, not course evidence.

Checkpoints use immutable request IDs for retries, compare payloads independently of JSON database key order, and use the existing account/programme-scoped atomic memory store. Read-only MCP credentials cannot save or delete them. Up to 80 recent checkpoints are retained per programme; individual deletion, Tutor export and Tutor-data erasure include them. Existing lasting-preference/context and attendance tools retain their exact-change review workflow. No raw external transcript is imported automatically.

## Generation capacity

These are ceilings, not required lengths. Core explanations have no word target; the concise revision summary is separate.

| Capacity | Previous | Current |
| --- | ---: | ---: |
| Full chapter output, including model reasoning | 20,000 tokens | 64,000 tokens |
| Teaching plan output | 12,000 tokens | 24,000 tokens |
| Selected section/question correction | 20,000 tokens | 32,000 tokens |
| Factual/pedagogical review output | 7,000–9,000 tokens | 32,000 tokens |
| Section/answer text field | 16,000 characters | 32,000 characters |
| Sections / practice questions / flashcards per chapter | 16 / 24 / 20 | 32 / 48 / 40 |
| Default per-guide/revision spending cap | $1 | $5 |
| Default platform-funded account daily / monthly allowance | $0.50 / $3 | $5 / $30 |
| Default account token allowance (platform / personal key), daily | 300,000 / 2,000,000 | 5,000,000 / 10,000,000 |
| MCP request / response envelope | 256 KiB / 128 KiB | 4 MiB / 2 MiB |
| MCP transport bytes, minute / day | 1 million / 4 million | 12 million / 64 million |

Existing saved spending choices, personal monthly caps and environment overrides are preserved. The selectable per-guide maximum remains $10. Shared platform daily/monthly spending caps and account chapter/rate limits still apply; reaching an allowance pauses progress. Local MCP generation does not charge platform AI. No existing guide is regenerated by this change. Source selection and focused evidence batching remain bounded to avoid loading an entire textbook into a single chapter request. Provider timeouts, malformed outputs and access failures still stop safely; larger output capacity does not guarantee successful model review.

## Modern model choices

Hosted generation offers explicit GPT-5.6 Sol (`sol`) and GPT-6 Astra (`astra`) choices alongside the configured platform model and existing GPT-5.4 enhanced option. The same choices are available for automatic module guides; personal-key users select their provider model in AI settings. Existing saved preferences and in-flight billing/model choices are preserved. MCP-led generation uses the model selected in the connected client and does not silently invoke a hosted model.

Official model pricing verified 14 September 2026: [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) costs $4 input / $20 output per million tokens; [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) costs $10 / $50. Spending reservations account for cache-write prices and the >272K long-context surcharge. When the provider returns cache-write/read token counts, settlement uses those counts; otherwise accounting remains conservative. Cache hits are never assumed for a reservation. Structured-output schemas are included in the input reservation.

Guide generation uses structured JSON without model tool calls. Astra's Chat Completions support is sufficient for this path; its tool-calling requirement for Responses means this addition does not migrate the Tutor to Astra. Medium reasoning is retained for guide/review calls. A live Astra structured-output probe correctly returned 108 ms and no notification wake-up from an ordinary variable write. This is compatibility evidence, not an end-to-end teaching-quality evaluation. Sol is being evaluated through the full generation/review/correction pipeline before any default production-model switch.

### Long guide steps

The first Sol end-to-end attempt stopped before returning its initial chapter at the previous 210-second fetch boundary. Guide calls now allow 600 seconds; their draft and paid-call leases last 750 seconds. The study queue callback allows 800 seconds and uses a 900-second message visibility window, with a 660-second service request timeout. The API service also allows 800 seconds. Canvas callbacks retain their existing 300-second runtime/visibility. Timeout failures now identify the time allowance explicitly and retain checkpoints. A regression simulates a six-minute call, rejects a duplicate worker, and verifies that the original result can still commit.

The expanded-capacity GPT-5 mini run made 33 completed model calls (approximately $0.2834 recorded provider-token cost), then stopped after three automatic corrections. Final pedagogical findings concerned two misconception follow-ups that did not target the diagnosed mistake. The draft was retained and never activated. This is evidence of bounded failure, not evidence that automatic generation is consistently successful. Sol comparison resumed from its saved plan after the timeout fix; its final outcome must be reported separately.

### Review the finished lesson

Sol's comparison exposed a review/repair mismatch: factual review rejected a teaching-approach sentence in the immutable plan after the actual lesson was corrected. Chapter corrections cannot edit that internal prose. Factual review version 2 therefore retains objective goals, source authority, exclusions and gaps, while grading examples and explanations in the finished artifact. Pedagogical review likewise does not receive the author's internal approach/demonstration text as evidence of teaching. Source and assessment checks remain intact. Review guidance also distinguishes necessary conditions from sufficient ones. The regression checks that internal prose is excluded while actual teaching and syllabus constraints remain reviewable. A full-review recheck option in the isolated evaluation script clears stale review checkpoints; it does not fabricate acceptance or reset correction counts.

### Evaluation outcome, 14 September 2026

- GPT-5 mini, expanded capacity: 33 completed calls, approximately $0.2834 recorded token cost, failed after three automatic corrections with two diagnostic-follow-up findings. No activation.
- Sol after extending the timeout, still using the previous reviewer: 44 calls, approximately $2.2255 recorded token cost, failed at three corrections. The final finding was a follow-up question that did not practise recovering an unknown intersection from a supplied union. Internal planning prose had also consumed correction attempts earlier in the run.
- Recheck with the corrected review scope: interrupted before a final verdict. A checkpoint retry confirmed HTTP 429 with “You have no credits remaining.” Failed requests retain conservative reservations in the evaluation report; those reservations are not a claim of actual provider charges. Production Vercel masks its protected key on export, so no alternate usable credential was recovered. No production database configuration was loaded for these tests.
- Astra: accessible to the key and passed the live structured-output RTOS compatibility probe; full guide quality has not been evaluated.

The preview is configured for Sol/medium and renders enabled Sol/Astra choices. The production default was not switched. The implementation passes typecheck, 1,012 tests and build; these results do not establish that either modern model reliably produces accepted guides. The credit-restored follow-up below supersedes this temporary billing blocker; automatic correction counts were not reset.

### Credit-restored evaluation and diagnostic recovery

After credits were restored, the saved Sol review completed (4 calls, approximately $0.3497 recorded token cost) and confirmed the unresolved reverse-inference follow-up mismatch. One explicit correction under the earlier question-only repair passed model review (14 calls, approximately $0.5964), but inspection found the target still supplied the quantity the student needed to practise inferring. This result is **not counted as a teaching-quality pass**.

Diagnostic repairs now include the flagged questions' linked targets, within the existing six-question patch bound; larger dependencies use a complete chapter correction. Reviewer guidance checks each misconception against its own target, rather than accepting broad topical relevance or one useful link. A subsequent controlled correction fixed the original reverse-inference target, but the stricter reviewer rejected other mismatched links (14 calls, approximately $0.6049). The old guide remained unpublished with three prior automatic corrections and one explicit correction recorded. These experiments demonstrate repair and rejection behavior, not reliable automatic success.

A fresh Sol run exposed a separate orchestration error: a misconception with no other same-objective question threw before entering correction. Missing targets now invoke whole-chapter correction with the saved content and explicit findings, using the same three-attempt allowance. Regression tests cover recovery, duplicate MCP next calls, and exhausted-budget draft retention. The fresh run stopped after three calls (approximately $0.2764); its recovery encountered a network fetch failure, retained its checkpoint, and resumed without resetting or consuming another correction. The failed call's $1.62815 reservation is not reported as actual spend.

Validation after these fixes: `npm run verify` passed typecheck, 1,015 tests, and production build. Production's default model is unchanged.

The fresh-run recovery then made 36 calls (approximately $2.3303 recorded token cost), correcting factual and missing-teaching findings, but its first final pedagogical review exhausted 16,000 output tokens. Review capacity is now 32,000 tokens, including reasoning; the spending cap is unchanged. The resumed final review made five calls (approximately $0.3849) and rejected the guide at three automatic corrections: a transfer question copied the worked example added during repair, and several diagnostic links did not target their misconceptions. No revision was activated. The stricter review fingerprint is version 3 so cached earlier reviews cannot satisfy the new policy. This remains a failed automatic quality evaluation, despite successful bounded recovery and passing software validation. A larger model/output allowance alone has not established reliable unattended teaching quality.


## Finite diagnostic practice and correction context (v7)

Core difficult-objective questions still require diagnostic feedback. Dedicated `practiceStage=remediation` questions may end that path with `misconceptions=[]` and a complete reasoned answer. They must be linked from a diagnosed mistake, share the objective, and directly practise its reasoning. They cannot satisfy guided, independent or transfer coverage. This removes the requirement for every follow-up to have yet another follow-up, without weakening the assessment standard. Existing saved lessons and links remain readable.

Corrections receive the saved per-chapter finding history as regression context, in addition to the latest draft and current findings. Earlier resolved findings are explicitly distinguished from current errors; the model must preserve their fixes. Reviewer contexts remain independent. Mixed section/question/card findings can now use a single schema-constrained patch, preserving unselected content; broader scope changes still require a coherent chapter correction. Worked-example repairs must retain distinct independent/transfer scenarios.

### Managed Agents API evaluation

The [Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview) provides managed sessions, compaction and recovery. The existing application key successfully ran a two-turn, structured-output, no-tools/no-sandbox Sol session: the RTOS case returned 108 ms, then 38 ms after changing only task priority; both turns correctly rejected an ordinary flag write as notification. The disposable session was deleted. Reproduce with `OPENAI_API_KEY` set and `node scripts/verification/study-managed-agent-live.mjs`.

This verifies access and context continuation, not full-guide quality or production budget enforcement. Both completed events and retrieved turns returned `usage=null` in the probe. The documented session configuration and installed SDK expose structured output and reasoning settings but not the existing per-call `max_output_tokens` boundary. A production adapter must enforce the guide's allowance, reconcile usage, cancel remote work, persist session ownership and retain independent reviewer contexts. The managed API is therefore not silently substituted for the current capped provider calls. No context-length error has been established as the cause of the saved guide failures; those failures included output exhaustion, missing dependencies and pedagogical mismatches. The v7 fixes address these shared generation rules for hosted and MCP execution.


### Focused correction and context capacity

The default per-guide allowance is now $10 (saved preferences and environment overrides remain authoritative). Pedagogical checkpoints allow 64,000 output/reasoning tokens; factual checkpoints remain at 32,000. These are ceilings, not generation targets. The three automatic corrections per chapter remain shared across review phases.

Pedagogical checkpoints receive core section text, the selected objective, its questions and linked targets, prerequisites and scope constraints. They omit flashcards, optional detail, answers, internal drafting instructions and prior reviews. Short excerpt identifiers replace repeated mathematical quotations in the response grammar; acceptance resolves them to exact visible text and rejects mismatched sections. Full source constraints remain available when planning: filtering administrative evidence had incorrectly produced claims that supplied assessment rules were missing.

Source scope notes can now be corrected without changing objectives or regenerating the chapter. Mixed findings can also patch summary/walkthrough metadata alongside affected sections, questions or cards. Findings that name existing question keys in prose are localized; missing targets still require a complete correction capable of adding practice. The isolated evaluation records reservation-cap failures explicitly and reports prior checkpoint-run costs separately, instead of implying a resumed run was a fresh generation.
