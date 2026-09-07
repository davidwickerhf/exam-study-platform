import { activeProgrammeId } from './programme-scope.mjs'
import { studyCourse, readStudySourceSnapshot, studySourcesStillAvailable, addStudyNote } from './study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from './study-version-store.mjs'
import { processStudyStep, controlStudyGeneration, refreshStudyVersion } from './study-version-pipeline.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'
import { studyGenerationContract, LocalStudyRequest, generationRequestHash } from './study-generation-contract.mjs'

const localBilling = { source: 'local', model: 'local-agent', provider: 'local' }
const assertLocal = version => {
  if (version.draft?.execution !== 'local') throw new StudyVersionError('This version is not assigned to local generation.', 409)
}
async function accessible(version, sourceOptions) {
  assertLocal(version)
  if (version.draft.snapshot && !(await studySourcesStillAvailable(version.draft.snapshot, version.course, sourceOptions))) throw new StudyVersionError('A selected source is no longer accessible. Refresh with available sources.', 403)
}
function status(version) {
  return { id: version.id, course: version.course, title: version.title, revisionId: version.activeRevisionId, execution: 'local',
    status: version.draft.status, stage: version.draft.stage, error: version.draft.error || null,
    readyChapters: version.draft.chapters?.filter(c => c.review === 'passed').length || version.history[0]?.chapters || 0,
    issues: version.draft.issues || [], url: `/app/study/${version.id}` }
}
export async function startLocalStudy(input, sourceOptions = {}) {
  const course = studyCourse(input)
  const snapshot = await readStudySourceSnapshot(course, input.sourceKeys, { ...sourceOptions, includeHistorical: input.includeHistorical === true })
  const version = await createStudyVersion(course, await activeProgrammeId(), snapshot, { title: input.title, billing: localBilling, execution: 'local' })
  return { version: status(version), contract: await studyGenerationContract() }
}
export async function nextLocalStudy(id, { retry = false } = {}, sourceOptions = {}) {
  let version = await ownStudyVersion(id)
  await accessible(version, sourceOptions)
  const contract = await studyGenerationContract()
  if (retry && ['failed', 'stopped'].includes(version.draft.status)) {
    await controlStudyGeneration(id, 'retry')
    version = await ownStudyVersion(id)
  }
  if (version.draft.status === 'waiting-local' && version.draft.localRequest?.contractId !== contract.id) {
    await mutateStudyVersion(id, next => {
      if (next.draft.status !== 'waiting-local') throw new StudyVersionError('This generation is already active.', 409)
      next.draft.status = 'local-ready'; delete next.draft.localRequest
    })
    version = await ownStudyVersion(id)
  }
  // Cached mapping/outline/reuse/finish stages may not need model work.
  for (let step = 0; step < 6 && ['local-ready', 'local-running'].includes(version.draft.status); step++) {
    const result = await processStudyStep(id, { execution: 'local', sourceOptions, generate: async (prompt, options) => { throw new LocalStudyRequest(prompt, options, contract, version.draft.id) } })
    version = await ownStudyVersion(id)
    if (result.busy || result.error || result.waitingLocal || result.complete) break
  }
  return { version: status(version), contract, request: version.draft.status === 'waiting-local' ? version.draft.localRequest : null }
}
export async function submitLocalStudy(id, input, sourceOptions = {}) {
  const version = await ownStudyVersion(id)
  await accessible(version, sourceOptions)
  const contract = await studyGenerationContract()
  if (input.contractId !== contract.id) throw new StudyVersionError('The generation pipeline changed. Fetch the next step again before submitting.', 409)
  const response = typeof input.response === 'string' ? input.response : JSON.stringify(input.response)
  if (!response || response.length > 600000) throw new StudyVersionError('Submit one complete JSON step, at most 600,000 characters.', 400)
  const responseHash = digest(response)
  const receipt = version.localReceipts?.find(row => row.requestId === input.requestId)
  if (receipt) {
    if (receipt.responseHash !== responseHash) throw new StudyVersionError('That request already received a different result. Fetch the next step.', 409)
    return { version: status(version), duplicate: true, receipt }
  }
  const request = version.draft.localRequest
  if (version.draft.status !== 'waiting-local' || !request || request.id !== input.requestId || request.contractId !== contract.id) throw new StudyVersionError('This local step is stale or already active. Fetch the next step.', 409)
  const result = await processStudyStep(id, { execution: 'local', sourceOptions,
    localSubmission: { requestId: request.id, responseHash, contractId: contract.id },
    generate: async (prompt, options) => {
      if (request.inputHash !== generationRequestHash(prompt, options)) throw new StudyVersionError('The inputs changed. Fetch the next step again.', 409)
      return response
    }
  })
  const saved = await ownStudyVersion(id)
  return { version: status(saved), accepted: !result.error && Boolean(saved.localReceipts?.some(receipt => receipt.requestId === request.id)), busy: Boolean(result.busy) }
}
export async function refreshLocalStudy(id, input, sourceOptions = {}) {
  const version = await ownStudyVersion(id)
  assertLocal(version)
  await refreshStudyVersion(id, input, { ...sourceOptions, includeHistorical: input.includeHistorical === true, billing: localBilling, execution: 'local' })
  return { version: status(await ownStudyVersion(id)), contract: await studyGenerationContract() }
}
export async function addLocalStudyNotes(input) {
  if (!Array.isArray(input.pages) || !input.pages.length || input.pages.length > 500 || input.pages.some(page => !page || typeof page.text !== 'string' || !(page.page == null || Number.isInteger(page.page) && page.page > 0))) throw new StudyVersionError('Provide readable text with original page numbers, up to 500 pages.')
  return addStudyNote({ ...input, title: `Local notes · ${String(input.title || 'Processed material').slice(0, 150)}` }, input.pages.map(page => ({ page: page.page ?? null, text: page.text })))
}
