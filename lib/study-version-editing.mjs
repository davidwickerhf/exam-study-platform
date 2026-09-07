import { randomUUID } from 'node:crypto'
import { readDocument } from './user-store.mjs'
import { chapterEditFields } from './study-chapter-edits.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'
import { ownStudyVersion, mutateStudyVersion, studyRevision, saveStudyRevision, newStudyDraft } from './study-version-store.mjs'
import { studySourcesStillAvailable } from './study-version-sources.mjs'

function editable(version, baseRevisionId) {
  if (version.activeRevisionId !== baseRevisionId || !baseRevisionId)
    throw new StudyVersionError('This chapter changed since you opened it. Open the latest revision before editing.', 409)
  if (['queued', 'running'].includes(version.draft?.status))
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
