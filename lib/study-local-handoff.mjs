// A client-facing orchestration contract, not a second set of teaching prompts.
export const LOCAL_GUIDE_HANDOFF = Object.freeze({
  entry: ['wicker_status', 'wicker_guidance', 'study_generation_contract'],
  economics: 'Before requesting a whole-course run, inspect each outline’s planning report and study_generation_usage across its guide bundle. Resolve potential duplicate concept responsibilities and task-budget shortfalls before continuing. A task projection is not a dollar quote; do not raise a spending allowance to force completion. Exact source maps may be reused privately across compatible guides; changed evidence, scope and rules invalidate reuse.',
  execution: 'Use the connected agent’s own model/subscription. MCP transports evidence and structured results; Wicker does not execute or pay for the local model.',
  prepare: [
    {tool:'study_generation_queue', instruction:'Resume the requested existing version when present; do not create a duplicate run after an interrupted start.'},
    {tool:'canvas_corpus_status', instruction:'Discover the exact course code and academic-year edition. Stored Canvas materials are separate from published courses.'},
    {tool:'study_generation_sources', instruction:'List authorised source keys for that edition; select only the student-requested scope. Current-year announcements and explicit exam exclusions govern older-year supplements.'},
    {tool:'canvas_course_materials', instruction:'Inspect original-material coverage. Indexed text may omit diagrams, tables, speaker notes or textbook pages.'},
    {tool:'prepare_original_download', instruction:'When needed, download complete originals with native file tools, verify size/hash, and inspect them locally. Do not expose temporary download credentials. No npm importer is required.'},
    {tool:'study_generation_add_notes', instruction:'Save authorised supplemental extraction with original filenames/page numbers and explicit interpretation labels; add its returned id to sourceKeys before starting. A textbook citation alone is not readable textbook content.'},
    {tool:'study_generation_start', instruction:'Start the authorised private run with exact sourceKeys, courseCode and academicYear, or use an existing versionId. Retain versionId for every continuation.'}
  ],
  loop: 'Follow nextAction. For generate, compute exactly request.responseSchema from request.prompt using request.task’s context rules; submit the complete JSON object with versionId, requestId and contractId. Upload each checkpoint, not one final Markdown document. Fetch next again after submission.',
  quality: 'The deployed prompts require objective/evidence planning, visible mechanisms and worked reasoning, guided and independent practice, diagnostic follow-ups, genuine transfer, source fidelity and exam-scope coverage. Use the supplied schema; counts or labels alone do not establish quality.',
  review: 'Use a fresh isolated reviewer context containing only the exact request prompt and schema. Independent solving must not receive the authored lesson, answers or hints. Other reviews receive only the artifact supplied in their prompt. If the client cannot isolate review contexts, pause and hand off the pending request; never claim independent review or fabricate acceptance.',
  recovery: 'On an uncertain submission, resend the identical payload with the same requestId; the receipt is idempotent. On a stale contract/request, fetch next and use the new request. Follow wait delays. Failed review automatically schedules bounded corrections of saved work. At blocked/stopped, report findings; do not loop retry:true or reset counters to force acceptance.',
  completion: 'Complete means version.status=complete and revisionId is present. Return version.url, coverage/source gaps and any remaining warnings. A submitted or accepted checkpoint alone is not a completed guide. Existing readable revisions remain until replacement acceptance.',
  maintenance: 'Only if requested, configure local module maintenance with study_module_guides_configure. Canvas changes can enqueue revisions; study_generation_queue is the handoff when an agent reconnects. Nothing runs on the subscription while its agent is disconnected; never switch silently to hosted AI.',
  provenance: 'Platform schema, citation, deterministic quality, correction limits and activation checks are shared with hosted generation. Semantic factual/pedagogical judgments come from the client reviewer, not an independent hosted reviewer. No editorial sharing or student mastery is implied.'
})

export function localStudyTask(options) {
  const phase=options.usageMetadata?.phase || options.stage || 'generation'
  const independent=phase==='factual-solve'
  const review=phase.startsWith('factual-') || phase==='pedagogical-review'
  return {
    phase, chapterId:options.usageMetadata?.chapterId || null,
    role:independent?'independent-solver':review?'reviewer':'generator',
    contextMode:review?'fresh-isolated':'request-scoped',
    instructions:independent
      ? 'Solve only the supplied questions and evidence in a fresh context. Do not include the authored lesson, answer key, hints, prior attempts or conversation history.'
      : review
        ? 'Review in a fresh context containing only this request prompt and schema. Inspect every requested item, report actual defects and never invent a passing verdict.'
        : 'Use this request prompt and schema as the complete work packet. Preserve supplied source IDs, objective IDs and saved content when correcting. Do not load unrelated course/chat history.',
    output:'Return one complete JSON value matching responseSchema, without a Markdown wrapper. The controlling agent submits it unchanged using this request’s IDs.'
  }
}

export function localStudyNextAction(version, request=null, now=Date.now()) {
  const draft=version.draft, args={versionId:version.id}
  if(draft.status==='complete' && !version.activeRevisionId)return {kind:'blocked',reason:'The completed run has no saved revision. Inspect the version before continuing.',automaticRetry:false}
  if(draft.status==='complete')return {kind:'complete',revisionId:version.activeRevisionId,url:`/app/study/${version.id}`}
  if(['failed','stopped'].includes(draft.status))return {kind:draft.status==='failed'?'blocked':'stopped',reason:draft.error || 'Generation stopped.',automaticRetry:false}
  if(request)return {kind:'generate',tool:'study_generation_submit',args:{...args,requestId:request.id,contractId:request.contractId},responseField:'response'}
  const waitUntil=Math.max(draft.runAfter || 0,draft.lease?.expiresAt || 0)
  if(waitUntil>now)return {kind:'wait',retryAfterMs:Math.min(60000,Math.max(1000,waitUntil-now)),tool:'study_generation_next',args}
  return {kind:'next',tool:'study_generation_next',args}
}
