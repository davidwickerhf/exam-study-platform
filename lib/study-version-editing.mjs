import { randomUUID } from 'node:crypto'
import { readDocument } from './user-store.mjs'
import { chapterEditFields } from './study-chapter-edits.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'
import { ownStudyVersion, createStudyVersion, mutateStudyVersion, studyRevision, saveStudyRevision, newStudyDraft } from './study-version-store.mjs'
import { studySourcesStillAvailable } from './study-version-sources.mjs'

// MANAGED-CHILD POLICY. A guide carrying courseBundleParent is a read-only
// derivative: the parent course run owns the plan, the evidence snapshot and
// every published revision, and its next publication rewrites this guide's
// active pointer. A manual edit, improvement, proposal decision or restore here
// would therefore be silently discarded, so all four are refused with the same
// 409 shape the pipeline already uses for refresh and control. The two
// supported routes are named in the message: update through the parent, or
// fork an independent private copy that the parent never touches again.
export function assertUnmanagedStudyVersion(version) {
  if (version.courseBundleParent)
    throw new StudyVersionError(`This guide is managed by course run ${version.courseBundleParent.versionId}. Update it through that course run, or fork an independent copy to edit it yourself.`, 409)
}
function editable(version, baseRevisionId) {
  assertUnmanagedStudyVersion(version)
  if (version.activeRevisionId !== baseRevisionId || !baseRevisionId)
    throw new StudyVersionError('This chapter changed since you opened it. Open the latest revision before editing.', 409)
  if (['queued', 'running', 'local-ready', 'local-running', 'waiting-local'].includes(version.draft?.status))
    throw new StudyVersionError('Wait for generation to finish or pause it before editing.', 409)
  if (version.proposal)
    throw new StudyVersionError('Apply or discard the proposed changes before making another edit.', 409)
}
async function access(revision, options) {
  if (!(await (options.checkAccess || studySourcesStillAvailable)(revision.snapshot, revision.course, options.sourceOptions || {})))
    throw new StudyVersionError('A source is no longer available. Review source access before editing.', 403)
}
function activate(next, revision) {
  next.draft = { id: revision.id, status: 'complete', stage: 'finish', billing: revision.billing, finishedAt: revision.createdAt }
  next.activeRevisionId = revision.id
  next.history.unshift({ id: revision.id, createdAt: revision.createdAt, chapters: revision.chapters.length,
    sourceHash: revision.snapshot.sourceHash, changes: revision.changes, reused: revision.reused,
    edit: revision.edit })
}
export async function editStudyText(id, input, options = {}) {
  const version = await ownStudyVersion(id)
  editable(version, input.baseRevisionId)
  const base = await studyRevision(version)
  await access(base, options)
  const chapters = structuredClone(base.chapters), chapter = chapters.find(c => c.id === input.topicId)
  const field = chapter && chapterEditFields(chapter).find(f => f.key === input.field)
  if (!field || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 6000)
    throw new StudyVersionError('Choose a text block and enter between 1 and 6,000 characters.')
  if (field.text === input.text.trim()) throw new StudyVersionError('There are no changes to save.', 409)
  const path = field.key.split('.'), leaf = path.pop()
  let target = chapter
  for (const part of path) target = target[part]
  target[leaf] = input.text.trim()
  if (path[0] === 'questions' || path[0] === 'flashcards') target.id = `${path[0] === 'questions' ? 'q' : 'fc'}-${digest(target).slice(0, 20)}`
  chapter.review = 'student-edited'
  chapter.editedAt = new Date().toISOString()
  const revision = await saveStudyRevision(version, { ...base, id: `rev-${randomUUID()}`, chapters,
    reused: chapters.length - 1, edit: { kind: 'manual', topicId: chapter.id, label: field.label, baseRevisionId: base.id } })
  return mutateStudyVersion(id, next => { editable(next, input.baseRevisionId); activate(next, revision) })
}
export async function improveStudyChapter(id, input, options = {}) {
  const version = await ownStudyVersion(id)
  editable(version, input.baseRevisionId)
  const base = await studyRevision(version)
  await access(base, options)
  const chapter = base.chapters.find(c => c.id === input.topicId)
  if (!chapter || typeof input.feedback !== 'string' || input.feedback.trim().length < 5 || input.feedback.length > 2000)
    throw new StudyVersionError('Choose a chapter and describe the change in 5–2,000 characters.')
  return mutateStudyVersion(id, next => {
    editable(next, input.baseRevisionId)
    const draft = newStudyDraft(base.snapshot, options.billing)
    Object.assign(draft, { stage: 'chapters', topics: base.topics, maps: base.maps || [],
      chapters: base.chapters.filter(c => c.id !== chapter.id), reused: base.chapters.length - 1,
      gaps: base.gaps, unmappedSourceIds: base.unmappedSourceIds,
      edit: { kind: 'ai', topicId: chapter.id, baseRevisionId: base.id, feedback: input.feedback.trim(), label: `Improve ${chapter.title}` } })
    next.queueDeliveryUntil = 0
    next.draft = draft
  })
}
export async function studyProposal(version) {
  return version.proposal ? readDocument('study-revisions', `${version.id}-${version.proposal.revisionId}`, null) : null
}
export async function decideStudyProposal(id, input, options = {}) {
  const version = await ownStudyVersion(id), proposal = await studyProposal(version)
  assertUnmanagedStudyVersion(version)
  if (!proposal || proposal.id !== input.revisionId) throw new StudyVersionError('This proposal is no longer available.', 409)
  if (!['apply', 'discard'].includes(input.decision)) throw new StudyVersionError('Choose apply or discard.')
  if (input.decision === 'apply') await access(proposal, options)
  return mutateStudyVersion(id, next => {
    if (next.proposal?.revisionId !== proposal.id || next.activeRevisionId !== proposal.edit.baseRevisionId)
      throw new StudyVersionError('The current revision changed. Review the latest chapter.', 409)
    if (input.decision === 'apply') activate(next, proposal)
    next.proposal = null
  })
}
// The supported escape hatch from a managed guide. It copies one completed
// revision into a new private version with recorded lineage and no
// courseBundleParent, so it is an ordinary editable guide that counts against
// the course limit. It reuses the stored revision verbatim: no model call, no
// hosted queue entry and no billing. Creation is local-execution so an unlucky
// dispatcher scan between create and activation can never start hosted work.
export async function forkStudyVersion(id, input = {}, options = {}) {
  const version = await ownStudyVersion(id)
  const base = await studyRevision(version, input.revisionId || version.activeRevisionId || undefined)
  if (!base) throw new StudyVersionError('Only a completed revision can be copied. Wait for this guide to finish.', 409)
  await access(base, options)
  const execution = base.generation?.execution || 'hosted'
  // Independence includes the evidence: materialize a managed guide's scoped
  // view of the course snapshot instead of copying its reference to the course
  // run's revision, which the parent alone owns and republishes.
  const snapshot = { ...base.snapshot }
  delete snapshot.ref
  delete snapshot.sourceIds
  const fork = await createStudyVersion(version.course, version.programmeId, snapshot, {
    title: String(input.title || `${version.title} (my copy)`).slice(0, 180),
    parent: { versionId: version.id, revisionId: base.id, courseBundleVersionId: version.courseBundleParent?.versionId || null, guideId: version.courseBundleParent?.guideId || null },
    billing: base.billing, execution: 'local'
  })
  const corrections = base.generation?.corrections || {}
  const revision = await saveStudyRevision(fork, { ...base, snapshot, id: `rev-${randomUUID()}`, guides: undefined, execution,
    correctionPolicy: { maxAttempts: corrections.maxAttempts }, automaticRepairs: corrections.attempts, manualRepairs: corrections.manualAttempts, correctionHistory: corrections.history,
    localContractId: base.generation?.contractId || null, reused: base.chapters.length,
    edit: { kind: 'fork', baseRevisionId: base.id, sourceVersionId: version.id, label: 'Independent copy' } })
  return mutateStudyVersion(fork.id, next => {
    activate(next, revision)
    next.draft.execution = execution
    if (execution !== 'local') delete next.localReviewTaskBudget
  })
}
export async function restoreStudyRevision(id, input, options = {}) {
  const version = await ownStudyVersion(id)
  editable(version, input.baseRevisionId)
  const old = await studyRevision(version, input.revisionId)
  if (!old || old.id === version.activeRevisionId) throw new StudyVersionError('Choose an earlier saved revision.')
  await access(old, options)
  const revision = await saveStudyRevision(version, { ...old, id: `rev-${randomUUID()}`, reused: old.chapters.length,
    edit: { kind: 'restore', baseRevisionId: version.activeRevisionId, restoredRevisionId: old.id, label: 'Restored earlier revision' } })
  return mutateStudyVersion(id, next => { editable(next, input.baseRevisionId); activate(next, revision) })
}
