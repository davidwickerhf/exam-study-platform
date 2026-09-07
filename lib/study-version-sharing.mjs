import { randomUUID } from 'node:crypto'
import { currentAuth, currentUserId } from './request-context.mjs'
import { sql } from './db.mjs'
import {
  readDocument,
  compareAndSwapDocument,
  listDocuments
} from './user-store.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { readAcademicState } from './academics.mjs'
import { listCanvasCorpusMaterials } from './course-corpus.mjs'
import { listStudySources } from './study-version-sources.mjs'
import {
  ownStudyVersion,
  studyRevision,
  discoverStudyDocuments,
  asStudyOwner
} from './study-version-store.mjs'
import { StudyVersionError, digest } from './study-version-content.mjs'
import { createCourseContentRequest } from './course-content-requests.mjs'

async function acceptedCommunitySource(source) {
  if (!sql) return false
  const rows =
    await sql`SELECT 1 FROM canvas_source_snapshots s JOIN editorial_contributions c ON c.id=s.contribution_id
    WHERE s.id=${source.snapshotId} AND s.sha256=${source.sha256} AND s.retired_at IS NULL AND s.sharing_mode='community' AND c.consent_status='accepted' LIMIT 1`
  return rows.length > 0
}
export async function sharingEligibility(
  snapshot,
  course,
  { audience = 'course', notesConsent = false, sourceOptions = {} } = {}
) {
  const live = await listStudySources(course, sourceOptions)
  const blocked = []
  for (const source of snapshot.sources) {
    if (!live.some((s) => s.key === source.key && s.sha256 === source.sha256)) {
      blocked.push(`${source.title}: source changed or access was withdrawn`)
      continue
    }
    if (source.kind === 'notes' && !notesConsent)
      blocked.push(
        `${source.title}: confirm permission to share your notes and cited excerpts`
      )
    if (
      source.kind === 'canvas' &&
      (audience === 'public' || !(await acceptedCommunitySource(source)))
    )
      blocked.push(
        `${source.title}: available for private study; course sharing requires an accepted community source`
      )
  }
  return { allowed: !blocked.length, blocked }
}
export function selectStudyPublication(revision, topicIds) {
  if (
    !Array.isArray(topicIds) ||
    !topicIds.length ||
    new Set(topicIds).size !== topicIds.length
  )
    throw new StudyVersionError('Choose the chapters to publish.')
  const chapters = topicIds.map((id) =>
    revision.chapters.find((c) => c.id === id && c.review === 'passed')
  )
  if (chapters.some((c) => !c))
    throw new StudyVersionError(
      'Only completed, checked chapters can be published.'
    )
  const used = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value.sourceIds))
      value.sourceIds.forEach((id) => used.add(id))
    Object.values(value).forEach((v) => {
      if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') visit(v)
    })
  }
  chapters.forEach(visit)
  const chunks = revision.snapshot.chunks.filter((c) => used.has(c.id)),
    keys = new Set(chunks.map((c) => c.sourceKey))
  return {
    ...revision,
    chapters,
    topics: revision.topics.filter((t) => topicIds.includes(t.id)),
    issues: revision.issues.filter((i) => topicIds.includes(i.topicId)),
    maps: undefined,
    billing: undefined,
    edit: undefined, // Private feedback/history is not part of a shared lesson.
    unmappedSourceIds: undefined,
    snapshot: {
      ...revision.snapshot,
      sources: revision.snapshot.sources.filter((s) => keys.has(s.key)),
      chunks,
      excluded: []
    },
    gaps: ['This shared selection may cover only part of the course.'],
    changes: undefined
  }
}
export async function publishStudyVersion(
  id,
  input,
  { sourceOptions = {} } = {}
) {
  if (currentAuth().mode === 'api-key')
    throw new StudyVersionError('Publish from your signed-in browser.', 403)
  const version = await ownStudyVersion(id),
    revision = await studyRevision(version, input.revisionId)
  if (!revision)
    throw new StudyVersionError('Choose a completed revision.', 409)
  if (!['course', 'public'].includes(input.audience))
    throw new StudyVersionError('Choose who can access this publication.')
  if (input.confirmSharing !== true)
    throw new StudyVersionError(
      'Confirm permission to publish the selected chapters and cited source excerpts.'
    )
  const selected = selectStudyPublication(revision, input.topicIds)
  const eligibility = await sharingEligibility(
    selected.snapshot,
    version.course,
    {
      audience: input.audience,
      notesConsent: input.notesConsent === true,
      sourceOptions
    }
  )
  if (!eligibility.allowed)
    throw new StudyVersionError(eligibility.blocked.join('\n'), 403)
  const publicationId = `pub-${randomUUID()}`
  const publication = {
    id: publicationId,
    versionId: id,
    revisionId: revision.id,
    revision: randomUUID(),
    audience: input.audience,
    status: 'published',
    title: String(input.title || version.title).slice(0, 180),
    attribution: String(input.attribution || 'Student contributor')
      .trim()
      .slice(0, 100),
    course: version.course,
    programmeId: version.programmeId,
    notesConsent: input.notesConsent === true,
    createdAt: new Date().toISOString(),
    content: selected,
    review: 'unreviewed'
  }
  await compareAndSwapDocument(
    'study-publications',
    publicationId,
    publication,
    null
  )
  return publication
}
async function publicationRecord(id) {
  if (!/^pub-[a-f0-9-]{36}$/.test(String(id))) return null
  if (sql) {
    const rows =
      await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents WHERE namespace='study-publications' AND document_key=${id} LIMIT 1`
    return rows[0] || null
  }
  return (
    (await discoverStudyDocuments('study-publications')).find(
      (r) => r.key === id
    ) || null
  )
}
async function readerHasCourse(publication) {
  const materials = await listCanvasCorpusMaterials({
    accountId: currentUserId(),
    courseCode: publication.course.courseCode
  })
  if (
    materials.some(
      (m) =>
        m.current &&
        publication.content.snapshot.sources.some(
          (s) => s.bindingId === m.bindingId
        )
    )
  )
    return true
  const state = await readAcademicState()
  return (
    publication.programmeId === (await activeProgrammeId()) &&
    (state.workspace?.courses || []).some(
      (c) =>
        String(c.code || '').toUpperCase() === publication.course.courseCode
    )
  )
}
export async function readStudyPublication(
  id,
  { publicOnly = false, sourceOptions = {} } = {}
) {
  const record = await publicationRecord(id),
    publication = record?.value
  if (
    !publication ||
    publication.status !== 'published' ||
    (publicOnly && publication.audience !== 'public')
  )
    throw new StudyVersionError('Shared study version not found.', 404)
  const owner = record.owner === currentUserId()
  if (
    publication.audience === 'course' &&
    !owner &&
    !(await readerHasCourse(publication))
  )
    throw new StudyVersionError(
      'This version is shared with course members.',
      403
    )
  const eligibility = await asStudyOwner(record.owner, () =>
    sharingEligibility(publication.content.snapshot, publication.course, {
      audience: publication.audience,
      notesConsent: publication.notesConsent,
      sourceOptions
    })
  )
  if (!eligibility.allowed)
    throw new StudyVersionError(
      'This publication is unavailable because a source changed or sharing permission was withdrawn.',
      410
    )
  // Publication intentionally includes cited excerpts, never unrelated originals,
  // personal annotations, progress, exam attempts, or the contributor's account ID.
  const result = structuredClone(publication)
  delete result.programmeId
  delete result.notesConsent
  if (publicOnly)
    result.content.snapshot.sources = result.content.snapshot.sources.map(
      ({ snapshotId, assetId, bindingId, editionId, url, ...s }) => s
    )
  return { ...result, owned: owner }
}
export async function listSharedStudyVersions(courseCode, options = {}) {
  const records = sql
    ? await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents
    WHERE namespace='study-publications' AND value->>'status'='published' AND value->'course'->>'courseCode'=${courseCode} ORDER BY updated_at DESC LIMIT 40`
    : (await discoverStudyDocuments('study-publications'))
        .filter(
          (r) =>
            r.value.course.courseCode === courseCode &&
            r.value.status === 'published'
        )
        .slice(0, 40)
  const result = []
  for (const r of records) {
    try {
      const p = await readStudyPublication(r.key, options)
      result.push({
        id: p.id,
        title: p.title,
        course: p.course,
        attribution: p.attribution,
        createdAt: p.createdAt,
        audience: p.audience,
        chapters: p.content.chapters.length,
        owned: p.owned
      })
    } catch (e) {
      if (![403, 404, 410].includes(e.status)) throw e
    }
  }
  return result
}
export async function withdrawStudyPublication(id) {
  const publication = await readDocument('study-publications', id, null)
  if (!publication) throw new StudyVersionError('Publication not found.', 404)
  await compareAndSwapDocument(
    'study-publications',
    id,
    { ...publication, status: 'withdrawn', revision: randomUUID() },
    publication.revision
  )
  return { withdrawn: true }
}
export async function submitStudyVersion(
  id,
  input,
  { sourceOptions = {} } = {}
) {
  if (input.confirmSharing !== true)
    throw new StudyVersionError(
      'Confirm that the selected content and cited evidence may be reviewed for editorial use.'
    )
  const version = await ownStudyVersion(id),
    revision = await studyRevision(version, input.revisionId)
  if (!revision)
    throw new StudyVersionError('Choose a completed revision.', 409)
  const selected = selectStudyPublication(revision, input.topicIds)
  const live = await listStudySources(version.course, sourceOptions)
  if (
    !selected.snapshot.sources.every((s) =>
      live.some((a) => a.key === s.key && a.sha256 === s.sha256)
    )
  )
    throw new StudyVersionError(
      'Refresh changed or unavailable sources before submitting.',
      409
    )
  const evidence = selected.snapshot.sources
    .map(
      (s) =>
        `# ${s.title}\nType: ${s.kind}; edition: ${s.academicYear}; period: ${s.period || 'unspecified'}; digest: ${s.sha256}\n\n${selected.snapshot.chunks
          .filter((c) => c.sourceKey === s.key)
          .map(
            (c) =>
              `## Evidence ${c.id}${c.page ? ` · page ${c.page}` : ''}\n${c.text}`
          )
          .join('\n\n')}`
    )
    .join('\n\n')
  const groundedText = (item) =>
    `${item.text}\nEvidence: ${item.sourceIds.join(', ')}`
  const generated = selected.chapters
    .map((c) =>
      [
        `# ${c.title}\nAI-generated; not editorially reviewed.`,
        ...c.sections.map((s) => `## ${s.title}\n${groundedText(s)}`),
        `## Summary\n${c.summary.map(groundedText).join('\n\n')}`,
        `## Generated practice with worked solutions\n${c.questions.map((q) => `### ${q.question}\nType: ${q.kind}\n${q.answer}\nEvidence: ${q.sourceIds.join(', ')}`).join('\n\n')}`,
        `## Flashcards\n${c.flashcards.map((f) => `### ${f.front}\n${f.back}\nEvidence: ${f.sourceIds.join(', ')}`).join('\n\n')}`,
        ...(c.walkthrough
          ? [
              `## ${c.walkthrough.title}\n${c.walkthrough.steps.map(groundedText).join('\n\n')}`
            ]
          : []),
        `## Caveats\n${c.caveats.join('\n')}`
      ].join('\n\n')
    )
    .join('\n\n')
  const result = await createCourseContentRequest(
    {
      ...version.course,
      programmeId: version.programmeId,
      academicCourseId: `study-${digest([version.course.courseCode, version.course.academicYear, version.course.period]).slice(0, 32)}`,
      categories: ['other', 'practice'],
      notes: `Student study version ${version.id}, revision ${revision.id}. ${String(input.message || '').slice(0, 2000)}\nContributor permits review of the attached selected derivative and cited evidence. Source originals remain in their existing access scope.`,
      contributionConsent: true,
      contributionLicense: selected.snapshot.sources.every(
        (s) => s.kind === 'notes'
      )
        ? 'own-notes'
        : 'authorised-course-material',
      files: [
        {
          name: 'source-evidence.md',
          type: 'text/markdown',
          base64: Buffer.from(evidence).toString('base64')
        },
        {
          name: 'study-version.md',
          type: 'text/markdown',
          base64: Buffer.from(generated).toString('base64')
        }
      ]
    },
    { requesterEmail: currentAuth().email }
  )
  return result
}
