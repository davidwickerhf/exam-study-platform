import {
  listDocuments,
  readDocument,
  compareAndSwapDocument,
  DocumentConflictError,
} from './user-store.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { studyRevision } from './study-version-store.mjs'
import { listStudySources } from './study-version-sources.mjs'
import { digest } from './study-version-content.mjs'

// A paper belongs to a course even when no teaching guide has been generated.
// Owner-scoped storage and a deterministic key make concurrent preparation safe.
export async function coursePracticeHost(course, programmeId) {
  const hash = digest([programmeId, course]).slice(0, 32)
  const id = `sv-${hash.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')}`
  const revisionId = `rev-${hash}`
  const now = new Date().toISOString()
  const revision = {
    id: revisionId,
    versionId: id,
    course,
    snapshot: { sources: [], chunks: [] },
    chapters: [],
    topics: [],
    createdAt: now,
  }
  const host = {
    id,
    course,
    programmeId,
    practiceHost: true,
    title: 'Course papers',
    revision: hash,
    activeRevisionId: revisionId,
    history: [{ id: revisionId, chapters: 0 }],
    createdAt: now,
    updatedAt: now,
    draft: null,
  }
  for (const [namespace, key, value] of [
    ['study-revisions', `${id}-${revisionId}`, revision],
    ['study-versions', id, host],
  ]) {
    try {
      await compareAndSwapDocument(namespace, key, value, null)
    } catch (e) {
      if (!(e instanceof DocumentConflictError)) throw e
    }
  }
  return readDocument('study-versions', id, null)
}

export function practiceQuestionFromStudy(q, context) {
  return {
    id: `${context.versionId}:${context.setId || context.revisionId}:${context.topicId}:${q.id}`,
    question: [q.sharedContext, q.question].filter(Boolean).join('\n\n'),
    expected: q.answer || null,
    type: q.type || 'written',
    options: q.options || [],
    difficulty:
      { foundation: 'easy', standard: 'medium', challenge: 'hard' }[
        q.difficulty
      ] || null,
    courseId: context.course.courseCode,
    courseCode: context.course.courseCode,
    courseName: context.course.courseName,
    chapterId: context.topicId,
    chapterName: context.chapterTitle,
    source: `${context.review === 'student-edited' ? 'Personal edit' : 'Generated'} · ${context.course.academicYear} · ${context.title}`,
    study: {
      versionId: context.versionId,
      revisionId: context.revisionId,
      topicId: context.topicId,
      setId: context.setId || null,
      questionId: q.id,
    },
    hint: q.hint || '',
  }
}

export async function courseExerciseBank(
  courseCode = '',
  { sourceOptions = {} } = {},
) {
  const programmeId = await activeProgrammeId()
  const versions = (await listDocuments('study-versions'))
    .map((r) => r.value)
    .filter(
      (v) =>
        !v.practiceHost &&
        v.programmeId === programmeId &&
        (!courseCode || v.course.courseCode === courseCode),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const generated = (await listDocuments('study-practice'))
    .map((r) => r.value)
    .filter(
      (r) =>
        r.kind === 'set' && r.mode === 'generate' && r.status === 'complete',
    )
  const questions = [],
    seen = new Set(),
    catalogues = new Map()
  const allowed = async (snapshot, course) => {
    if (!catalogues.has(course.courseCode))
      catalogues.set(
        course.courseCode,
        await listStudySources(course, sourceOptions),
      )
    return snapshot.sources.every((s) =>
      catalogues.get(course.courseCode).some((a) => a.key === s.key),
    )
  }
  const append = (rows, context) => {
    for (const q of rows) {
      const key = digest([
        context.course.courseCode,
        q.question,
        q.sharedContext || '',
        q.options || [],
        q.answer,
        q.type || 'written',
        q.correctOptions || [],
        q.marks ?? null,
      ])
      if (seen.has(key)) continue
      seen.add(key)
      questions.push(practiceQuestionFromStudy(q, context))
    }
  }
  for (const v of versions) {
    const r = await studyRevision(v)
    if (r && (await allowed(r.snapshot, r.course)))
      for (const c of r.chapters.filter((c) => ['passed', 'student-edited'].includes(c.review)))
        append(c.questions, {
          course: r.course,
          title: v.title,
          versionId: v.id,
          revisionId: r.id,
          topicId: c.id,
          chapterTitle: c.title,
          review: c.review,
        })
    for (const set of generated.filter((s) => s.versionId === v.id))
      if (await allowed(set.snapshot, set.course))
        append(set.result.questions, { ...set, title: v.title, setId: set.id })
  }
  return { questions, courses: [], source: 'personal', generated: true }
}
