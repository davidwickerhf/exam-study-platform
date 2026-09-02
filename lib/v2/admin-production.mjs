const DRAFT_TYPES = new Set(['study-pages', 'exercises', 'flashcards', 'quality'])

export function editionRecords(edition, workspace) {
  const id = edition?.id
  return {
    sources: (workspace?.sources ?? []).filter((item) => item.contribution?.editionId === id),
    topics: (workspace?.topics ?? []).filter((item) => item.editionId === id),
    artifacts: (workspace?.artifacts ?? []).filter((item) => item.editionId === id),
    releases: (workspace?.releases ?? []).filter((item) => item.editionId === id),
    jobs: (workspace?.jobs ?? []).filter((item) => item.editionId === id)
  }
}

export function productionFacts(edition, workspace) {
  const records = editionRecords(edition, workspace)
  const accepted = records.sources.filter((source) => source.contribution?.consentStatus === 'accepted')
  const candidates = records.sources.filter((source) => source.contribution?.consentStatus === 'candidate')
  const approved = records.artifacts.filter((artifact) => artifact.status === 'approved')
  const pending = (types) => records.jobs.filter((job) => job.status === 'pending' && (!types || (Array.isArray(types) ? types : [types]).includes(job.type))).length
  const failed = records.jobs.filter((job) => job.status === 'failed')
  return { ...records, accepted, candidates, approved, failed, pending }
}

/** The one active production stage. Its order is the publication safety gate. */
export function productionStage(edition, workspace) {
  const facts = productionFacts(edition, workspace)
  if (!facts.sources.length) return 'sources'
  if (facts.candidates.length || !facts.accepted.length) return 'rights'
  if (facts.accepted.some((source) => !source.extractedAt)) return 'extract'
  if (!facts.topics.length) return 'map'
  if (!facts.artifacts.length || facts.pending([...DRAFT_TYPES])) return 'drafts'
  if (facts.approved.length !== facts.artifacts.length) return 'review'
  if (edition?.status !== 'active') return 'publish'
  return 'live'
}

export function pipelineSteps(edition, workspace) {
  const facts = productionFacts(edition, workspace)
  return [
    { id: 'sources', label: 'Sources', value: facts.sources.length ? `${facts.sources.length} added` : 'None yet', done: facts.sources.length > 0 },
    { id: 'rights', label: 'Rights', value: facts.candidates.length ? `${facts.candidates.length} to decide` : facts.accepted.length ? `${facts.accepted.length} accepted` : '—', done: facts.sources.length > 0 && !facts.candidates.length && facts.accepted.length > 0 },
    { id: 'extract', label: 'Extract', value: facts.accepted.length ? `${facts.accepted.filter((source) => source.extractedAt).length}/${facts.accepted.length} indexed` : '—', done: facts.accepted.length > 0 && facts.accepted.every((source) => source.extractedAt) },
    { id: 'map', label: 'Course map', value: facts.topics.length ? `${facts.topics.length} chapters` : '—', done: facts.topics.length > 0 },
    { id: 'drafts', label: 'Drafts', value: facts.artifacts.length ? `${facts.approved.length}/${facts.artifacts.length} approved` : '—', done: facts.artifacts.length > 0 && facts.approved.length === facts.artifacts.length && !facts.pending([...DRAFT_TYPES]) },
    { id: 'publish', label: 'Published', value: facts.releases.length ? `v${facts.releases[0].version}` : '—', done: edition?.status === 'active' }
  ]
}

export function contributionReviewPayload(status) {
  if (!['accepted', 'rejected'].includes(status)) throw new Error('Choose whether to accept or reject this source.')
  return {
    status,
    reviewNote: status === 'accepted' ? 'Rights basis reviewed in the editorial workspace.' : 'Not approved for shared editorial use.'
  }
}

export function artifactReviewPayload(status) {
  if (!['approved', 'review', 'rejected'].includes(status)) throw new Error('Choose a valid artifact review status.')
  return { status, reviewNote: status === 'approved' ? 'Approved in the editorial workspace.' : status === 'review' ? 'Returned for editorial revision.' : 'Rejected in the editorial workspace.' }
}

export function artifactEditPayload({ title, definition }) {
  const cleanTitle = String(title || '').trim().slice(0, 240)
  if (!cleanTitle) throw new Error('The artifact needs a title.')
  let parsed
  try { parsed = typeof definition === 'string' ? JSON.parse(definition) : definition }
  catch { throw new Error('Artifact JSON is not valid JSON.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Artifact JSON must be an object.')
  return { title: cleanTitle, definition: parsed, status: 'review', reviewNote: 'Edited in the editorial workspace; approval is required again.' }
}

export function canPublish(edition, workspace, confirmation) {
  const target = String(edition?.courseCode || edition?.canonicalCourseId || '').trim()
  return Boolean(target && productionStage(edition, workspace) === 'publish' && String(confirmation || '').trim().toUpperCase() === target.toUpperCase())
}
