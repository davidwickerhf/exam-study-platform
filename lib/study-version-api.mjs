import { editStudyText, improveStudyChapter, studyProposal, decideStudyProposal, restoreStudyRevision } from './study-version-editing.mjs'
import { queueWorkerAllowsUser } from './queue-runtime.mjs'
import {
  resolveStudyBilling,
  studyBudgetSummary,
  estimateStudyProduction
} from './study-ai-budget.mjs'
import {
  personalAiSettings,
  updatePersonalAiSettings,
  removePersonalAiKey
} from './study-ai-settings.mjs'
import { currentUserId, currentAuth } from './request-context.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import {
  studyCourse,
  listStudySources,
  addStudyNote,
  readStudySourceSnapshot
} from './study-version-sources.mjs'
import {
  createStudyExam,
  listStudyExams,
  saveStudyExam,
  createStudyVersion,
  ownStudyVersion,
  listOwnStudyVersions,
  studyRevision,
  readStudyProgress,
  saveStudyProgress
} from './study-version-store.mjs'
import {
  refreshStudyVersion,
  controlStudyGeneration
} from './study-version-pipeline.mjs'
import {
  publishStudyVersion,
  listSharedStudyVersions,
  readStudyPublication,
  withdrawStudyPublication,
  submitStudyVersion
} from './study-version-sharing.mjs'
import {
  StudyVersionError,
  evidenceBatches,
  sourceChanges
} from './study-version-content.mjs'
import { extractPdfText } from './editorial-admin.mjs'
import { createQualityEvaluation, readQualityEvaluation, stepQualityEvaluation, recheckQualityEvaluation } from './study-quality-evaluation.mjs'

export function studyVersionSummary(v) {
  return {
    id: v.id,
    title: v.title,
    course: v.course,
    parent: v.parent,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    activeRevisionId: v.activeRevisionId,
    history: v.history,
    visibility: 'private',
    review: 'unreviewed',
    billing: v.draft?.billing || null,
    draft: v.draft
      ? {
          id: v.draft.id,
          status: v.draft.status,
          stage: v.draft.stage,
          error: v.draft.error,
          canRecheck: v.draft.chapters?.some(c => c.review === 'failed') || false,
          runAfter: v.draft.runAfter,
          mapped: v.draft.maps?.length || 0,
          batches: v.draft.snapshot
            ? evidenceBatches(v.draft.snapshot.chunks).length
            : 0,
          chapters:
            v.draft.chapters?.filter((c) => c.review === 'passed').length || 0,
          total: v.draft.topics?.length || 0,
          issues: v.draft.issues || [],
          excluded: v.draft.snapshot?.excluded || []
        }
      : null
  }
}
export async function studyVersionApi({
  pathname,
  method,
  query,
  body = {},
  sourceOptions = {},
  configured = true,
  platform = {},
  wake = async () => {},
  generateEvaluation
}) {
  const ok = (data, status = 200) => ({ data, status })
  if (pathname === '/api/study-versions/evaluations' && method === 'POST')
    return ok(await createQualityEvaluation(body, { platform, sourceOptions }), 201)
  const evaluation = pathname.match(/^\/api\/study-versions\/evaluations\/(sqe-[a-f0-9-]{36})(\/step|\/recheck)?$/)
  if (evaluation) {
    if (method === 'GET' && !evaluation[2]) return ok(await readQualityEvaluation(evaluation[1], { sourceOptions }))
    if (method === 'POST' && evaluation[2] === '/recheck') return ok(await recheckQualityEvaluation(evaluation[1], body.revision, { sourceOptions }), 201)
    if (method === 'POST' && evaluation[2] === '/step') return ok(await stepQualityEvaluation(evaluation[1], body.revision, { generate: generateEvaluation, sourceOptions }))
    throw new StudyVersionError('Method not allowed.', 405)
  }
  if (pathname === '/api/account/ai') {
    if (currentAuth().mode === 'api-key')
      throw new StudyVersionError(
        'Manage AI billing in your signed-in browser.',
        403
      )
    if (method === 'GET') return ok(await studyBudgetSummary(platform))
    if (method === 'POST') return ok(await updatePersonalAiSettings(body))
    if (method === 'DELETE') return ok(await removePersonalAiKey())
    throw new StudyVersionError('Method not allowed.', 405)
  }
  if (pathname.startsWith('/api/public/study-versions/')) {
    if (method !== 'GET')
      throw new StudyVersionError('Method not allowed.', 405)
    return ok(
      await readStudyPublication(pathname.split('/').at(-1), {
        publicOnly: true,
        sourceOptions
      })
    )
  }
  if (
    !pathname.startsWith('/api/study-versions') &&
    pathname !== '/api/study-notes'
  )
    return null
  if (
    !queueWorkerAllowsUser(currentUserId()) &&
    method === 'POST' &&
    (pathname === '/api/study-versions' || /\/(refresh|retry|improve)$/.test(pathname))
  )
    throw new StudyVersionError(
      'Generation workers are not configured for this account in this preview.',
      503
    )
  if (method !== 'GET' && currentAuth().mode === 'api-key')
    throw new StudyVersionError(
      'Create, refresh and share study versions from your signed-in browser.',
      403
    )
  if (pathname === '/api/study-notes' && method === 'POST') {
    let pages = [{ page: null, text: String(body.text || '') }]
    if (body.file) {
      const name = String(body.file.name || ''),
        bytes = Buffer.from(String(body.file.base64 || ''), 'base64')
      if (bytes.length > 8 * 1024 * 1024)
        throw new StudyVersionError('Notes uploads are limited to 8 MB.')
      if (/\.pdf$/i.test(name))
        pages = (await extractPdfText(bytes)).pages || []
      else if (/\.docx$/i.test(name)) {
        const mammoth = await import('mammoth')
        pages = [
          {
            page: null,
            text: (await mammoth.extractRawText({ buffer: bytes })).value
          }
        ]
      } else if (/\.(?:txt|md)$/i.test(name))
        pages = [{ page: null, text: bytes.toString('utf8') }]
      else
        throw new StudyVersionError(
          'Upload PDF, DOCX, Markdown or plain text notes.'
        )
    }
    return ok(
      await addStudyNote(
        { ...body, title: body.title || body.file?.name },
        pages
      ),
      201
    )
  }
  if (pathname === '/api/study-versions/sources' && method === 'GET') {
    const course = studyCourse(query)
    return ok({
      sources: await listStudySources(course, sourceOptions),
      configured
    })
  }
  if (pathname === '/api/study-versions/shared' && method === 'GET')
    return ok({
      publications: await listSharedStudyVersions(
        String(query.courseCode || '').toUpperCase(),
        { sourceOptions }
      )
    })
  const shared = /^\/api\/study-versions\/shared\/(pub-[a-f0-9-]+)$/.exec(
    pathname
  )
  if (shared) {
    if (method === 'GET')
      return ok(await readStudyPublication(shared[1], { sourceOptions }))
    if (method === 'DELETE')
      return ok(await withdrawStudyPublication(shared[1]))
  }
  if (pathname === '/api/study-versions/estimate' && method === 'POST') {
    const course = studyCourse(body),
      billing = await resolveStudyBilling(body, platform)
    const snapshot = await readStudySourceSnapshot(course, body.sourceKeys, {
      ...sourceOptions,
      includeHistorical: body.includeHistorical === true
    })
    return ok(estimateStudyProduction(snapshot, billing))
  }
  if (pathname === '/api/study-versions') {
    if (method === 'GET')
      return ok({
        versions: (
          await listOwnStudyVersions(
            String(query.courseCode || '').toUpperCase()
          )
        ).map(studyVersionSummary),
        configured
      })
    if (method === 'POST') {
      const billing = await resolveStudyBilling(body, platform)
      const course = studyCourse(body)
      const snapshot = await readStudySourceSnapshot(course, body.sourceKeys, {
        ...sourceOptions,
        includeHistorical: body.includeHistorical === true
      })
      const version = await createStudyVersion(
        course,
        await activeProgrammeId(),
        snapshot,
        { title: body.title, billing }
      )
      await wake(version.id)
      return ok({ version: studyVersionSummary(version) }, 202)
    }
  }
  const match =
    /^\/api\/study-versions\/(sv-[a-f0-9-]+)(?:\/(refresh|stop|retry|progress|publish|submit|exams|edit|improve|proposal|restore))?$/.exec(
      pathname
    )
  if (match) {
    const [, id, action] = match,
      version = await ownStudyVersion(id)
    if (method === 'GET' && !action) {
      const revision = await studyRevision(version, query.revision || undefined)
      if (query.revision && !revision)
        throw new StudyVersionError('Revision not found.', 404)
      const progress = await readStudyProgress(id)
      const sources = await listStudySources(version.course, sourceOptions)
      const selected =
        revision?.snapshot.sources || version.draft?.snapshot?.sources || []
      const changes = sourceChanges(
        selected,
        sources.filter((s) => selected.some((p) => p.key === s.key))
      )
      const newSources = sources.filter(
        (s) =>
          !selected.some((p) => p.key === s.key) &&
          s.academicYear === version.course.academicYear &&
          (!version.course.period ||
            !s.period ||
            s.period === version.course.period)
      )
      return ok({
        version: studyVersionSummary(version),
        revision,
        proposal: await studyProposal(version),
        progress,
        sourceKeys: selected.map((s) => s.key),
        freshness: { ...changes, newSources: newSources.map((s) => s.title) },
        partial:
          !revision && version.draft?.snapshot
            ? {
                id: version.draft.id,
                versionId: id,
                course: version.course,
                chapters: (version.draft.chapters || []).filter(
                  (c) => c.review === 'passed'
                ),
                topics: version.draft.topics || [],
                snapshot: version.draft.snapshot,
                gaps: version.draft.gaps || [],
                issues: version.draft.issues || [],
                review: 'unreviewed'
              }
            : null
      })
    }
    if (method === 'POST' && ['refresh', 'retry', 'stop'].includes(action)) {
      const billing =
        action === 'stop' ? null : await resolveStudyBilling(body, platform)
      const result =
        action === 'refresh'
          ? await refreshStudyVersion(id, body, {
              ...sourceOptions,
              includeHistorical: body.includeHistorical === true,
              billing
            })
          : await controlStudyGeneration(id, action, billing, { recheck: body.recheck === true })
      if (action !== 'stop') await wake(id)
      return ok({ version: studyVersionSummary(result) }, 202)
    }
    if (method === 'POST' && ['edit', 'improve', 'proposal', 'restore'].includes(action)) {
      const options = { sourceOptions }
      if (action === 'improve') options.billing = await resolveStudyBilling(body, platform)
      const handler = { edit: editStudyText, improve: improveStudyChapter, proposal: decideStudyProposal, restore: restoreStudyRevision }[action]
      const result = await handler(id, body, options)
      if (action === 'improve') await wake(id)
      return ok({ version: studyVersionSummary(result) }, action === 'improve' ? 202 : 200)
    }
    if (method === 'GET' && action === 'exams')
      return ok({ exams: await listStudyExams(id) })
    if (method === 'POST' && action === 'exams')
      return ok(
        body.id
          ? await saveStudyExam(id, body)
          : await createStudyExam(id, body)
      )
    if (method === 'POST' && action === 'progress')
      return ok(await saveStudyProgress(id, body))
    if (method === 'POST' && action === 'publish')
      return ok(await publishStudyVersion(id, body, { sourceOptions }), 201)
    if (method === 'POST' && action === 'submit')
      return ok(await submitStudyVersion(id, body, { sourceOptions }), 201)
  }
  throw new StudyVersionError('Study endpoint not found.', 404)
}
