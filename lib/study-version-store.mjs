import { DEFAULT_CORRECTION_LIMIT, correctionStatus } from './study-correction-policy.mjs'
import { recurringEnabled } from './study-recurring-policy.mjs'
import { queueWorkerAllowsUser, previewWorkerUsers } from './queue-runtime.mjs'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { sql } from './db.mjs'
import { currentUserId, withRequestContext } from './request-context.mjs'
import {
  readDocument,
  compareAndSwapDocument,
  listDocuments,
  DocumentConflictError
} from './user-store.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'

export const VERSION_NAMESPACE = 'study-versions'
export async function ownStudyVersion(id) {
  if (!/^sv-[a-f0-9-]{36}$/.test(String(id)))
    throw new StudyVersionError('Study version not found.', 404)
  const value = await readDocument(VERSION_NAMESPACE, id, null)
  if (!value) throw new StudyVersionError('Study version not found.', 404)
  return value
}
export async function mutateStudyVersion(id, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const old = await ownStudyVersion(id),
      next = structuredClone(old)
    await change(next)
    next.revision = randomUUID()
    next.updatedAt = new Date().toISOString()
    try {
      await compareAndSwapDocument(VERSION_NAMESPACE, id, next, old.revision)
      return next
    } catch (error) {
      if (!(error instanceof DocumentConflictError) || attempt === 4)
        throw error
    }
  }
}
// The default study list is the student's readable workspace: a published
// course bundle is represented by its guides, not by the orchestrating parent,
// and superseded guides of an earlier publication stay hidden. Callers that
// account for a version rather than read it (spend, quotas, maintenance,
// controls, deletion) must opt in explicitly instead of inheriting that view.
export async function listOwnStudyVersions(courseCode, { includeBundleParents = false, includeManaged = false } = {}) {
  return (await listDocuments(VERSION_NAMESPACE))
    .map((r) => r.value)
    .filter((v) => !v.practiceHost && v.courseBundleParent?.state!=='staged' && (includeBundleParents || !(v.courseBundle && v.bundleGuides?.length)) && (includeManaged || v.courseBundleParent?.active!==false) && (!courseCode || v.course.courseCode === courseCode))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export const STUDY_VERSION_LIMIT = 20
// A whole-course bundle counts as one version: the parent orchestrator holds
// the plan, the snapshot and the spend, and its managed children are derived
// documents. An independent fork carries its own revisions and counts normally.
export async function countedStudyVersions(courseCode) {
  return (await listOwnStudyVersions(courseCode, { includeBundleParents: true, includeManaged: true })).filter((v) => !v.courseBundleParent)
}
export async function createStudyVersion(
  course,
  programmeId,
  snapshot,
  { title = '', parent = null, billing = null, execution = 'hosted', automation = null, id: requestedId = null, localReviewTaskBudget = 128, courseBundle = false, courseBundleParent = null } = {}
) {
  // Managed children are materialized inside the parent's publication and are
  // never counted, so a checked course plan cannot fail halfway to the cap.
  if (!courseBundleParent && (await countedStudyVersions(course.courseCode)).length >= STUDY_VERSION_LIMIT)
    throw new StudyVersionError(
      `You already have ${STUDY_VERSION_LIMIT} versions of this course. Refresh an existing version.`
    )
  if(execution==='local' && (!Number.isInteger(localReviewTaskBudget)||localReviewTaskBudget<1||localReviewTaskBudget>10000))throw new StudyVersionError('Choose a review-task budget between 1 and 10,000.')
  const now = new Date().toISOString(),
    id = requestedId || `sv-${randomUUID()}`
  const version = {
    id,
    course,
    programmeId,
    title: String(title || 'My study version').slice(0, 180),
    parent,
    ...(courseBundle ? {courseBundle:true} : {}),
    ...(courseBundleParent ? {courseBundleParent} : {}),
    ...(execution==='local'?{localReviewTaskBudget}:{}),
    ...(automation ? {automation} : {}),
    revision: randomUUID(),
    createdAt: now,
    updatedAt: now,
    history: [],
    activeRevisionId: null,
    draft: { ...newStudyDraft(snapshot, billing), ...(automation ? {stage:'readiness',moduleCandidate:automation.candidate} : {}), execution, status: courseBundleParent ? 'managed' : execution === 'local' ? 'local-ready' : 'queued' },
    visibility: 'private',
    review: 'unreviewed'
  }
  await compareAndSwapDocument(VERSION_NAMESPACE, id, version, null)
  return version
}
export function newStudyDraft(snapshot, billing = null) {
  return {
    id: `rev-${randomUUID()}`,
    status: 'queued',
    stage: 'mapping',
    billing,
    snapshot,
    maps: [],
    topics: [],
    chapters: [],
    issues: [],
    correctionPolicy: {maxAttempts:DEFAULT_CORRECTION_LIMIT},
    automaticRepairs: {},
    correctionHistory: [],
    reused: 0,
    lease: null,
    runAfter: Date.now(),
    attempts: 0,
    createdAt: new Date().toISOString()
  }
}
export async function studyRevision(version, id = version.activeRevisionId) {
  if (!id || !version.history.some((r) => r.id === id)) return null
  return readDocument('study-revisions', `${version.id}-${id}`, null)
}
export async function saveStudyRevision(version, draft) {
  const value = {
    id: draft.id,
    versionId: version.id,
    course: version.course,
    snapshot: draft.snapshot,
    topics: draft.topics,
    ...(draft.guides ? {guides:draft.guides} : {}),
    chapters: draft.chapters,
    billing: draft.billing,
    generation: { corrections: correctionStatus(draft), execution: draft.execution || 'hosted', contractId: draft.localContractId || null, semanticReview: draft.execution === 'local' ? 'local-agent' : 'platform-model' },
    maps: draft.maps,
    ...(draft.moduleReadiness ? {moduleReadiness:draft.moduleReadiness} : {}),
    unmappedSourceIds: draft.unmappedSourceIds || [],
    gaps: draft.gaps || [],
    issues: draft.issues,
    changes: draft.changes || { added: [], changed: [], removed: [] },
    reused: draft.reused,
    createdAt: new Date().toISOString(),
    review: draft.chapters.every(c => c.review === 'passed') ? 'ai-checked' : 'student-edited',
    ...(draft.edit ? { edit: draft.edit } : {})
  }
  // A worker may crash after saving but before activation. Lease tokens and
  // attempt timestamps must not change the immutable content fingerprint.
  value.revision = digest({ ...value, createdAt: undefined })
  const key = `${version.id}-${draft.id}`
  try {
    await compareAndSwapDocument('study-revisions', key, value, null)
  } catch (e) {
    if (!(e instanceof DocumentConflictError)) throw e
    const existing = await readDocument('study-revisions', key, null)
    if (existing?.revision !== value.revision) throw e
    return existing
  }
  return value
}

// Internal discovery only. Never expose these rows or accept an owner from a
// student request. Local scanning supports the same multi-account test contract.
export async function discoverStudyDocuments(namespace) {
  if (![VERSION_NAMESPACE, 'study-publications', 'study-paper-jobs', 'study-module-settings'].includes(namespace))
    throw new Error('Invalid discovery namespace')
  if (sql)
    return sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents WHERE namespace=${namespace}`
  const root = fileURLToPath(new URL('../data/users/', import.meta.url)),
    result = []
  const users = await readdir(root, { withFileTypes: true }).catch(() => [])
  for (const user of users.filter((u) => u.isDirectory())) {
    const folder = join(root, user.name, namespace)
    for (const filename of (await readdir(folder).catch(() => [])).filter((n) =>
      n.endsWith('.json')
    )) {
      try {
        result.push({
          owner: user.name,
          key: filename.slice(0, -5),
          value: JSON.parse(await readFile(join(folder, filename), 'utf8'))
        })
      } catch {}
    }
  }
  return result
}
export async function pendingStudyVersions() {
  const rows = sql
    ? await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents jobs
    WHERE (NOT (value ? 'automation') OR NOT EXISTS(SELECT 1 FROM user_documents policy WHERE policy.user_id=jobs.user_id AND policy.namespace='study-recurring-pipelines' AND policy.document_key='settings' AND policy.value->'settings'->>'guides'='false')) AND namespace=${VERSION_NAMESPACE} AND value->'draft'->>'status' IN ('queued','running') AND coalesce(value->'draft'->>'execution','hosted')<>'local'
      AND (${process.env.VERCEL_ENV !== 'preview'} OR user_id=ANY(${previewWorkerUsers()}::text[]))
      AND (value->'draft'->>'runAfter')::numeric<=${Date.now()}
      AND coalesce((value->>'queueDeliveryUntil')::numeric,0)<=${Date.now()}
      AND coalesce((value->'draft'->'lease'->>'expiresAt')::numeric,0)<${Date.now()}
    ORDER BY updated_at LIMIT 30`
    : await discoverStudyDocuments(VERSION_NAMESPACE)
  return rows.filter(
    (r) =>
      queueWorkerAllowsUser(r.owner) && r.value.draft?.execution !== 'local' && ['queued', 'running'].includes(r.value.draft?.status) &&
      r.value.draft.runAfter <= Date.now() &&
      (r.value.queueDeliveryUntil || 0) <= Date.now() &&
      (!r.value.draft.lease || r.value.draft.lease.expiresAt < Date.now())
  )
}
// Claim delivery before publishing so concurrent dispatchers and unrelated
// completions cannot republish an entire waiting outbox. A failed send or lost
// notification becomes eligible again after five minutes.
export async function claimStudyDispatch() {
  const ids = []
  for (const row of (await pendingStudyVersions()).slice(0, 30)) {
    try {
      await asStudyOwner(row.owner, async () =>
        mutateStudyVersion(row.key, async (version) => {
          if(version.automation && !await recurringEnabled('guides')) throw new StudyVersionError('Automatic guide checks are paused.',409)
          const now = Date.now(),
            draft = version.draft
          if (
            !draft || draft.execution === 'local' ||
            !['queued', 'running'].includes(draft.status) ||
            draft.runAfter > now ||
            draft.lease?.expiresAt > now ||
            (version.queueDeliveryUntil || 0) > now
          )
            throw new StudyVersionError(
              'Study delivery was already claimed.',
              409
            )
          version.queueDeliveryUntil = now + 300000
        })
      )
      ids.push(row.key)
    } catch (error) {
      if (error.status !== 409 && error.status !== 404) throw error
    }
  }
  return ids
}

export async function resolveStudyJob(id) {
  const rows = sql
    ? await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents WHERE namespace=${VERSION_NAMESPACE} AND document_key=${id} LIMIT 1`
    : (await discoverStudyDocuments(VERSION_NAMESPACE)).filter(
        (r) => r.key === id
      )
  return rows[0] || null
}
export async function saveStudyProgress(versionId, input) {
  const version = await ownStudyVersion(versionId),
    revision = await studyRevision(version, input.revisionId)
  if (!revision) throw new StudyVersionError('Choose a saved revision.', 404)
  const topic = revision.topics.find((t) => t.id === input.topicId)
  if (!topic) throw new StudyVersionError('Chapter not found.', 404)
  const key = `${versionId}-${topic.id}`
  for (let retry = 0; retry < 5; retry++) {
    const old = await readDocument('study-version-progress', key, null)
    const next = {
      ...old,
      versionId,
      topicId: topic.id,
      revisionId: revision.id,
      revision: randomUUID(),
      updatedAt: new Date().toISOString()
    }
    if (typeof input.read === 'boolean') next.read = input.read
    if (typeof input.note === 'string') {
      if (input.note.length > 20000)
        throw new StudyVersionError(
          'Keep chapter notes under 20,000 characters.'
        )
      next.note = input.note
    }
    if (input.attempt) {
      const question = revision.chapters
        .find((c) => c.id === topic.id)
        ?.questions.find((q) => q.id === input.attempt.questionId)
      if (!question) throw new StudyVersionError('Question not found.', 404)
      const id = String(input.attempt.id || '')
      if (!/^[a-zA-Z0-9-]{1,100}$/.test(id))
        throw new StudyVersionError('Invalid attempt identifier.')
      next.attempts = [...(old?.attempts || [])]
      if (!next.attempts.some((a) => a.id === id))
        next.attempts.push({
          id,
          question,
          answer: String(input.attempt.answer || '').slice(0, 10000),
          revisionId: revision.id,
          createdAt: next.updatedAt
        })
      if (next.attempts.length > 200)
        throw new StudyVersionError(
          'This chapter has reached its saved attempt limit.'
        )
    }
    try {
      await compareAndSwapDocument(
        'study-version-progress',
        key,
        next,
        old?.revision ?? null
      )
      return next
    } catch (e) {
      if (!(e instanceof DocumentConflictError) || retry === 4) throw e
    }
  }
}
export async function readStudyProgress(versionId) {
  await ownStudyVersion(versionId)
  return (await listDocuments('study-version-progress'))
    .map((r) => r.value)
    .filter((r) => r.versionId === versionId)
}
export const asStudyOwner = (owner, fn) =>
  withRequestContext({ userId: owner, mode: 'study-worker' }, fn)

export async function createStudyExam(versionId, input) {
  const version = await ownStudyVersion(versionId),
    revision = await studyRevision(version, input.revisionId)
  if (!revision)
    throw new StudyVersionError('Choose a completed revision.', 409)
  const ids = Array.isArray(input.topicIds)
    ? input.topicIds
    : revision.topics.map((t) => t.id)
  const chapters = revision.chapters.filter((c) => ids.includes(c.id))
  if (!chapters.length || chapters.length !== new Set(ids).size)
    throw new StudyVersionError('Choose valid chapters for this practice exam.')
  const count = Math.max(1, Math.min(30, Number(input.count) || 10))
  const banks = chapters.map((c) => ({
    id: c.id,
    questions: [
      ...c.questions.filter((q) => q.kind === 'exam-style'),
      ...c.questions.filter((q) => q.kind === 'application'),
      ...c.questions.filter((q) => q.kind === 'recall')
    ]
  }))
  const questions = []
  // Round-robin coverage is explicit, not an invented official exam blueprint.
  for (let round = 0; questions.length < count; round++) {
    let added = false
    for (const bank of banks)
      if (bank.questions[round] && questions.length < count) {
        questions.push({ ...bank.questions[round], topicId: bank.id })
        added = true
      }
    if (!added) break
  }
  if (!questions.length)
    throw new StudyVersionError(
      'These chapters do not have practice questions yet.'
    )
  const id = `exam-${randomUUID()}`,
    exam = {
      id,
      versionId,
      revisionId: revision.id,
      revision: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      questions,
      answers: {},
      topicIds: chapters.map((c) => c.id),
      course: version.course
    }
  await compareAndSwapDocument('study-version-exams', id, exam, null)
  return exam
}
export async function listStudyExams(versionId) {
  await ownStudyVersion(versionId)
  return (await listDocuments('study-version-exams'))
    .map((r) => r.value)
    .filter((e) => e.versionId === versionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export async function saveStudyExam(versionId, input) {
  await ownStudyVersion(versionId)
  const old = await readDocument('study-version-exams', String(input.id), null)
  if (!old || old.versionId !== versionId)
    throw new StudyVersionError('Practice exam not found.', 404)
  if (old.status === 'complete')
    throw new StudyVersionError(
      'This completed attempt is saved. Start a new practice exam to try again.',
      409
    )
  if (input.expectedRevision !== old.revision)
    throw new StudyVersionError(
      'This exam changed in another window. Reload it before saving.',
      409
    )
  const answers = { ...old.answers }
  if (input.questionId) {
    if (!old.questions.some((q) => q.id === input.questionId))
      throw new StudyVersionError('Question not found.', 404)
    answers[input.questionId] = String(input.answer || '').slice(0, 15000)
  }
  const next = {
    ...old,
    answers,
    revision: randomUUID(),
    ...(input.complete === true
      ? { status: 'complete', completedAt: new Date().toISOString() }
      : {})
  }
  await compareAndSwapDocument(
    'study-version-exams',
    old.id,
    next,
    old.revision
  )
  return next
}
