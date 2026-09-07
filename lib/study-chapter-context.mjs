import { ownStudyVersion, studyRevision } from './study-version-store.mjs'
import { studySourcesStillAvailable } from './study-version-sources.mjs'
import { StudyVersionError } from './study-version-content.mjs'

export async function readOwnedStudyChapter(
  versionId,
  revisionId,
  topicId,
  options = {},
) {
  const version = await ownStudyVersion(versionId)
  const revision = await studyRevision(
    version,
    revisionId || version.activeRevisionId,
  )
  if (!revision)
    throw new StudyVersionError(
      'This saved study revision is not available.',
      404,
    )
  const chapter = revision.chapters.find((c) => c.id === topicId)
  if (!chapter)
    throw new StudyVersionError(
      'This chapter is not in the selected revision.',
      404,
    )
  if (
    !(await (options.checkAccess || studySourcesStillAvailable)(
      revision.snapshot,
      revision.course,
      options.sourceOptions || {},
    ))
  )
    throw new StudyVersionError(
      'A source for this chapter is no longer accessible. Review its sources first.',
      403,
    )
  const topic = revision.topics.find((t) => t.id === chapter.id)
  return {
    version,
    revision,
    chapter,
    evidence: revision.snapshot.chunks.filter((c) =>
      (topic?.sourceIds || []).includes(c.id),
    ),
  }
}

export async function studyTutorContext(context, options = {}) {
  if (!context.studyVersionId) return null
  const { version, revision, chapter, evidence } = await readOwnedStudyChapter(
    context.studyVersionId,
    context.studyRevisionId,
    context.chapterId,
    options,
  )
  const question = context.studyQuestionId
    ? chapter.questions.find((q) => q.id === context.studyQuestionId)
    : null
  if (context.studyQuestionId && !question)
    throw new StudyVersionError(
      'The selected question is not in this chapter revision.',
      404,
    )
  const sources = evidence
    .slice(0, 12)
    .map((c) => ({
      id: c.id,
      page: c.page,
      text: c.text.slice(0, 1400),
      title:
        revision.snapshot.sources.find((s) => s.key === c.sourceKey)?.title ||
        'Selected course source',
    }))
  return {
    course: revision.course,
    versionId: version.id,
    revisionId: revision.id,
    chapterId: chapter.id,
    chapterName: chapter.title,
    review: chapter.review,
    lesson: chapter.sections
      .map((s) => ({
        title: s.title,
        text: s.text.slice(0, 1800),
        callouts: s.callouts?.slice(0, 3),
        takeaway: s.takeaway,
      }))
      .slice(0, 7),
    question,
    sources,
    coverage: { included: sources.length, available: evidence.length },
    url: `/app/study/${version.id}`,
  }
}
