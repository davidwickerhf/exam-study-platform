import { localUsageSchema, localUsageSummary, localUsageStatus } from './study-local-usage.mjs'
import { localStudyNextAction } from './study-local-handoff.mjs'
import { correctionStatus } from './study-correction-policy.mjs'
import { automaticGuideAllowed } from './study-recurring-policy.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { studyCourse, readStudySourceSnapshot, studySourcesStillAvailable, addStudyNote } from './study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from './study-version-store.mjs'
import { processStudyStep, controlStudyGeneration, refreshStudyVersion, outstandingLocalRequests } from './study-version-pipeline.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'
import { studyGenerationContract, LocalStudyRequest, generationRequestHash } from './study-generation-contract.mjs'

const localBilling = { source: 'local', model: 'local-agent', provider: 'local' }
const assertLocal = version => {
  if (version.draft?.execution !== 'local') throw new StudyVersionError('This version is not assigned to local generation.', 409)
}
async function accessible(version, sourceOptions) {
  assertLocal(version)
  if(!await automaticGuideAllowed(version.automation,'local'))throw new StudyVersionError('Automatic guide generation is paused in Settings.',409)
  if (version.draft.snapshot && !(await studySourcesStillAvailable(version.draft.snapshot, version.course, sourceOptions))) throw new StudyVersionError('A selected source is no longer accessible. Refresh with available sources.', 403)
}
function status(version) {
  return { id: version.id, course: version.course, title: version.title, revisionId: version.activeRevisionId, execution: 'local',
    status: version.draft.status, stage: version.draft.stage, error: version.draft.error || null,
    readyChapters: version.draft.chapters?.filter(c => c.review === 'passed').length ?? version.history[0]?.chapters ?? 0,
    courseBundle:version.courseBundle || false, guides:version.bundleGuides || version.draft.guides || [], planning: version.draft.planning || null, corrections: correctionStatus(version.draft), usage: localUsageStatus(version),
    issues: version.draft.issues || [], url: `/app/study/${version.id}` }
}
export async function startLocalStudy(input, sourceOptions = {}) {
  const course = studyCourse(input)
  const snapshot = await readStudySourceSnapshot(course, input.sourceKeys, { ...sourceOptions, includeHistorical: input.includeHistorical === true, courseBundle:input.courseBundle===true })
  const version = await createStudyVersion(course, await activeProgrammeId(), snapshot, { title: input.title, courseBundle:input.courseBundle===true, billing: localBilling, execution: 'local', localReviewTaskBudget:input.reviewTaskBudget ?? 128 })
  return { version: status(version), nextAction: localStudyNextAction(version), contract: await studyGenerationContract() }
}
export async function nextLocalStudy(id, { retry = false } = {}, sourceOptions = {}) {
  let version = await ownStudyVersion(id)
  await accessible(version, sourceOptions)
  const contract = await studyGenerationContract()
  if (retry && ['failed', 'stopped'].includes(version.draft.status)) {
    await controlStudyGeneration(id, 'retry')
    version = await ownStudyVersion(id)
  }
  if (version.draft.status === 'waiting-local' && (!outstandingLocalRequests(version.draft).length || outstandingLocalRequests(version.draft).some(request => request.contractId !== contract.id))) {
    await mutateStudyVersion(id, next => {
      if (next.draft.status !== 'waiting-local') throw new StudyVersionError('This generation is already active.', 409)
      // A changed contract reissues every outstanding request. Accepted maps
      // and every other checkpoint stay saved; only the packets are refreshed.
      next.draft.status = 'local-ready'; delete next.draft.localRequest; delete next.draft.localRequests
    })
    version = await ownStudyVersion(id)
  }
  // Cached mapping/outline/reuse/finish stages may not need model work.
  for (let step = 0; step < 6 && ['local-ready', 'local-running'].includes(version.draft.status); step++) {
    const result = await processStudyStep(id, { execution: 'local', sourceOptions, generate: async (prompt, options) => {
      const request = new LocalStudyRequest(prompt, options, contract, version.draft.id)
      if (['reviewer', 'independent-solver'].includes(request.localStudyRequest.task?.role) && localUsageSummary(version).remainingReviewTasks === 0) {
        const error = new StudyVersionError('Review-task budget exhausted. Explicitly raise the budget to issue another reviewer request.', 409)
        error.localReviewBudget = true
        throw error
      }
      throw request } })
    version = await ownStudyVersion(id)
    if (result.budgetBlocked) return {version:status(version),contract,request:null,nextAction:{kind:'blocked',reason:'Review-task budget exhausted. Saved work and correction counters are unchanged; raise the budget to issue another reviewer request.'}}
    if (result.busy || result.error || result.waitingLocal || result.complete) break
  }
  // Source mapping may hand out several independent batches at once. Clients
  // that only read `request`/`nextAction` still see the first one and make
  // progress one packet at a time; `requests` carries the whole pending set.
  const requests=version.draft.status === 'waiting-local' ? outstandingLocalRequests(version.draft) : []
  const request=requests[0] || null
  // Bootstrap instructions are fetched once; do not repeat them in every model packet.
  const requestContract=Object.fromEntries(['id','protocol','schemaVersion','workflow','reviewRulesId','standard','execution'].map(key=>[key,contract[key]]))
  return { version: status(version), contract: requestContract, request, requests, nextAction: localStudyNextAction(version,request) }
}
export async function submitLocalStudy(id, input, sourceOptions = {}) {
  const version = await ownStudyVersion(id)
  await accessible(version, sourceOptions)
  const contract = await studyGenerationContract()
  const response = typeof input.response === 'string' ? input.response : JSON.stringify(input.response)
  if (!response || response.length > 600000) throw new StudyVersionError('Submit one complete JSON step, at most 600,000 characters.', 400)
  const responseHash = digest(response)
  const receipt = version.localReceipts?.find(row => row.requestId === input.requestId)
  if (receipt) {
    if (receipt.responseHash !== responseHash || receipt.contractId !== input.contractId) throw new StudyVersionError('That request already received a different result. Fetch the next step.', 409)
    return { version: status(version), duplicate: true, receipt, nextAction: localStudyNextAction(version) }
  }
  if (input.contractId !== contract.id) throw new StudyVersionError('The generation pipeline changed. Fetch the next step again before submitting.', 409)
  const request = outstandingLocalRequests(version.draft).find(pending => pending.id === input.requestId)
  if (version.draft.status !== 'waiting-local' || !request || request.contractId !== contract.id) throw new StudyVersionError('This local step is stale or already active. Fetch the next step.', 409)
  const accepted = held => Boolean(held.localReceipts?.some(receipt => receipt.requestId === request.id))
  const localSubmission = { requestId: request.id, responseHash, contractId: contract.id, task:request.task, usage: input.usage ? localUsageSchema.parse(input.usage) : null, requestCreatedAt:request.createdAt }
  // Outstanding requests are accepted in any order, but their commits are
  // serialized by the same mutation lease. A peer holding the lease makes this
  // submission wait and retry rather than rejecting it or its sibling.
  let held = version, result = { busy: true }
  for (let attempt = 0; attempt < 12; attempt++) {
    const peers = outstandingLocalRequests(held.draft).filter(pending => pending.id !== request.id)
    result = await processStudyStep(id, { execution: 'local', sourceOptions, localSubmission,
      generate: async (prompt, options) => {
        const hash = generationRequestHash(prompt, options)
        if (request.inputHash === hash) return response
        // Another still-pending packet of the same step: reissue it unchanged
        // so the client's existing request ID stays valid.
        const peer = peers.find(pending => pending.inputHash === hash)
        if (peer) throw Object.assign(new Error('Waiting for local generation'), { localStudyRequest: peer })
        // Accepting a map frees a slot, so the bounded mapping pool may reach a
        // batch no client has seen yet. That is a new packet, not a changed
        // step: every other stage still issues exactly one call, where a
        // mismatch can only mean the inputs moved under the submission.
        if (options.usageMetadata?.phase === 'source-mapping') throw new LocalStudyRequest(prompt, options, contract, held.draft.id)
        throw new StudyVersionError('The inputs changed. Fetch the next step again.', 409)
      }
    })
    held = await ownStudyVersion(id)
    if (!result.busy || accepted(held)) break
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)))
    held = await ownStudyVersion(id)
    if (accepted(held) || !outstandingLocalRequests(held.draft).some(pending => pending.id === request.id)) break
  }
  const saved = await ownStudyVersion(id)
  return { version: status(saved), accepted: accepted(saved), busy: Boolean(result.busy) && !accepted(saved), nextAction: localStudyNextAction(saved) }
}
export async function refreshLocalStudy(id, input, sourceOptions = {}) {
  const version = await ownStudyVersion(id)
  assertLocal(version)
  await refreshStudyVersion(id, input, { ...sourceOptions, includeHistorical: input.includeHistorical === true, billing: localBilling, execution: 'local' })
  const saved=await ownStudyVersion(id)
  return { version: status(saved), nextAction: localStudyNextAction(saved), contract: await studyGenerationContract() }
}
export async function addLocalStudyNotes(input) {
  if (!Array.isArray(input.pages) || !input.pages.length || input.pages.length > 500 || input.pages.some(page => !page || typeof page.text !== 'string' || !(page.page == null || Number.isInteger(page.page) && page.page > 0))) throw new StudyVersionError('Provide readable text with original page numbers, up to 500 pages.')
  return addStudyNote({ ...input, title: `Local notes · ${String(input.title || 'Processed material').slice(0, 150)}` }, input.pages.map(page => ({ page: page.page ?? null, text: page.text })))
}
