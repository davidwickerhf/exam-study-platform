import { studyLessonQuality } from './study-content-quality.mjs'
import { randomUUID } from 'node:crypto'
import {
  digest,
  evidenceBatches,
  inputHash,
  matchTopicIdentity,
  mapSchema,
  lessonSchema,
  reviewSchema,
  parseStudyJson,
  assertEvidence,
  mapPrompt,
  outlinePrompt,
  lessonPrompt,
  reviewPrompt,
  sourceChanges,
  StudyVersionError,
  STUDY_STANDARD
} from './study-version-content.mjs'
import {
  ownStudyVersion,
  mutateStudyVersion,
  studyRevision,
  saveStudyRevision,
  newStudyDraft
} from './study-version-store.mjs'
import {
  readStudySourceSnapshot,
  studySourcesStillAvailable
} from './study-version-sources.mjs'

export async function refreshStudyVersion(id, input, options) {
  const version = await ownStudyVersion(id)
  const snapshot = await readStudySourceSnapshot(
    version.course,
    input.sourceKeys,
    options
  )
  return mutateStudyVersion(id, async (next) => {
    if (['queued', 'running'].includes(next.draft?.status))
      throw new StudyVersionError(
        'This version is already generating. Stop it before changing sources.',
        409
      )
    const previous = await studyRevision(next)
    if (previous?.snapshot.sourceHash === snapshot.sourceHash)
      throw new StudyVersionError(
        'This revision already includes the selected sources. Nothing needs refreshing.',
        409
      )
    next.queueDeliveryUntil = 0
    next.draft = newStudyDraft(snapshot, options.billing)
    next.draft.changes = sourceChanges(
      previous?.snapshot.sources,
      snapshot.sources
    )
  })
}
export async function controlStudyGeneration(id, action, billing = null) {
  return mutateStudyVersion(id, (version) => {
    const draft = version.draft
    if (!draft || draft.status === 'complete')
      throw new StudyVersionError(
        'There is no unfinished generation to control.',
        409
      )
    version.queueDeliveryUntil = 0
    if (action === 'stop') {
      draft.status = 'stopped'
      draft.lease = null
    } else if (action === 'retry') {
      if (['queued', 'running'].includes(draft.status))
        throw new StudyVersionError('Generation is already active.', 409)
      if (billing) draft.billing = billing
      draft.status = 'queued'
      draft.lease = null
      draft.runAfter = Date.now()
      draft.error = null
      draft.attempts = 0
      // A failed evidence review regenerates only the affected chapter.
      const bad = draft.chapters.find((c) => c.review === 'failed')
      if (bad) {
        draft.chapters = draft.chapters.filter((c) => c.id !== bad.id)
        draft.stage = 'chapters'
      }
    } else throw new StudyVersionError('Unknown generation action.')
  })
}
function normalizeOutline(result, chunks, previous) {
  assertEvidence(result, chunks)
  const topics = matchTopicIdentity(result.topics, previous)
  const expanded = []
  for (const topic of topics) {
    const parts = evidenceBatches(
      chunks.filter((c) => topic.sourceIds.includes(c.id))
    )
    parts.forEach((part, index) =>
      expanded.push({
        ...topic,
        id: index ? `${topic.id.slice(0, 55)}-part-${index + 1}` : topic.id,
        title:
          parts.length > 1 ? `${topic.title} · Part ${index + 1}` : topic.title,
        sourceIds: part.map((c) => c.id)
      })
    )
  }
  if (expanded.length > 40)
    throw new StudyVersionError(
      'This selection needs more than 40 chapters. Generate a smaller source selection.',
      422
    )
  const used = new Set(expanded.flatMap((t) => t.sourceIds)),
    unmapped = chunks.filter((c) => !used.has(c.id))
  return {
    topics: expanded,
    gaps: [
      ...result.gaps,
      ...(unmapped.length
        ? [
            `${unmapped.length} evidence passages were not assigned to a chapter. Consult the originals for omitted material.`
          ]
        : [])
    ],
    unmappedSourceIds: unmapped.map((c) => c.id)
  }
}
function prepareLesson(raw, topic, evidence) {
  const parsed = assertEvidence(parseStudyJson(raw, lessonSchema), evidence)
  if (parsed.sections.reduce((n, s) => n + s.text.length, 0) < 1800)
    throw new StudyVersionError(
      'The generated chapter was too thin to teach this topic. Retry this step.',
      502
    )
  const quality = studyLessonQuality(parsed, evidence)
  if (quality.length)
    throw new StudyVersionError(
      `Content quality check: ${quality.join(' ')}`,
      502
    )
  const fingerprint = digest(parsed).slice(0, 12)
  return {
    ...parsed,
    id: topic.id,
    inputHash: inputHash(topic, evidence),
    review: 'pending',
    standard: STUDY_STANDARD,
    questions: parsed.questions.map((q, i) => ({
      ...q,
      id: `${topic.id}-${fingerprint}-q${i + 1}`
    })),
    flashcards: parsed.flashcards.map((q, i) => ({
      ...q,
      id: `${topic.id}-${fingerprint}-f${i + 1}`
    }))
  }
}
export async function processStudyStep(
  id,
  {
    generate,
    sourceOptions = {},
    checkAccess = studySourcesStillAvailable,
    now = Date.now()
  } = {}
) {
  if (typeof generate !== 'function')
    throw new StudyVersionError('Study generation is not configured.', 503)
  const version = await ownStudyVersion(id),
    draft = version.draft
  if (
    !draft ||
    !['queued', 'running'].includes(draft.status) ||
    draft.runAfter > now
  )
    return { again: false }
  if (draft.lease?.expiresAt > now) return { again: false, busy: true }
  const token = randomUUID()
  try {
    await mutateStudyVersion(id, (next) => {
      if (
        next.draft?.id !== draft.id ||
        !['queued', 'running'].includes(next.draft.status) ||
        next.draft.lease?.expiresAt > now
      )
        throw new StudyVersionError('Another worker owns this generation.', 409)
      next.queueDeliveryUntil = 0
      next.draft.lease = { token, expiresAt: now + 300000 }
      next.draft.status = 'running'
      next.draft.attempts++
      if (next.draft.attempts > 4) {
        next.draft.status = 'failed'
        next.draft.error =
          'This step was interrupted repeatedly. Retry to resume saved work.'
        next.draft.lease = null
      }
    })
  } catch (e) {
    if (e.status === 409) return { again: false, busy: true }
    throw e
  }
  const held = await ownStudyVersion(id)
  if (held.draft.status === 'failed') return { again: false }
  const work = structuredClone(held.draft),
    snapshot = work.snapshot
  const commit = async (change) =>
    mutateStudyVersion(id, (next) => {
      if (
        next.draft?.id !== work.id ||
        next.draft.lease?.token !== token ||
        next.draft.lease.expiresAt <= Date.now() ||
        next.draft.status !== 'running'
      )
        throw new StudyVersionError(
          'Generation stopped or its worker lease expired.',
          409
        )
      change(next)
    })
  try {
    if (!(await checkAccess(snapshot, version.course, sourceOptions)))
      throw new StudyVersionError(
        'A source is no longer accessible. Choose available sources and refresh this version.',
        403
      )
    const previous = await studyRevision(version)
    const options = {
      usageFeature: 'study',
      maxOutputTokens: 10000,
      billing: work.billing,
      jobKey: work.id,
      usageMetadata: { versionId: id, stage: work.stage },
      stage: 'draft'
    }
    if (work.stage === 'mapping') {
      const batches = evidenceBatches(snapshot.chunks)
      const index = work.maps.length,
        batch = batches[index]
      if (batch) {
        const batchHash = digest(batch)
        const cached = previous?.maps?.find((m) => m.batchHash === batchHash)
        const result =
          cached ||
          assertEvidence(
            parseStudyJson(
              await generate(
                mapPrompt(version.course, snapshot.sources, batch),
                options
              ),
              mapSchema
            ),
            batch
          )
        work.maps.push({ ...result, batchHash })
      }
      if (work.maps.length === batches.length) work.stage = 'outline'
    } else if (work.stage === 'outline') {
      const result =
        work.maps.length === 1
          ? work.maps[0]
          : parseStudyJson(
              await generate(
                outlinePrompt(
                  version.course,
                  work.maps,
                  previous?.topics || []
                ),
                options
              ),
              mapSchema
            )
      Object.assign(
        work,
        normalizeOutline(result, snapshot.chunks, previous?.topics || [])
      )
      for (const topic of work.topics) {
        const old = previous?.chapters.find(
          (c) =>
            c.id === topic.id &&
            c.inputHash ===
              inputHash(
                topic,
                snapshot.chunks.filter((e) => topic.sourceIds.includes(e.id))
              ) &&
            c.review === 'passed'
        )
        if (old) {
          work.chapters.push(old)
          work.reused++
        }
      }
      work.stage = 'chapters'
    } else if (work.stage === 'chapters') {
      const topic = work.topics.find(
        (t) => !work.chapters.some((c) => c.id === t.id)
      )
      if (topic) {
        const evidence = snapshot.chunks.filter((c) =>
          topic.sourceIds.includes(c.id)
        )
        work.chapters.push(
          prepareLesson(
            await generate(
              lessonPrompt(version.course, snapshot.sources, evidence, topic),
              {
                ...options,
                usageMetadata: { ...options.usageMetadata, chapterId: topic.id }
              }
            ),
            topic,
            evidence
          )
        )
        work.stage = 'review'
      } else work.stage = 'finish'
    } else if (work.stage === 'review') {
      const chapter = work.chapters.find((c) => c.review === 'pending')
      if (chapter) {
        const topic = work.topics.find((t) => t.id === chapter.id),
          evidence = snapshot.chunks.filter((c) =>
            topic.sourceIds.includes(c.id)
          )
        const result = parseStudyJson(
          await generate(
            reviewPrompt(version.course, snapshot.sources, evidence, chapter),
            { ...options, stage: 'quality', maxOutputTokens: 4000 }
          ),
          reviewSchema
        )
        work.issues = work.issues
          .filter((i) => i.topicId !== chapter.id)
          .concat(result.issues.map((i) => ({ ...i, topicId: chapter.id })))
        chapter.review = result.issues.some((i) => i.severity === 'error')
          ? 'failed'
          : 'passed'
        if (chapter.review === 'failed') {
          work.status = 'failed'
          work.error =
            'The evidence check found a problem. Retry to regenerate the flagged chapter; finished chapters are preserved.'
        }
      }
      work.stage = 'chapters'
    } else if (work.stage === 'finish') {
      if (
        !work.chapters.length ||
        work.chapters.some((c) => c.review !== 'passed')
      )
        throw new StudyVersionError(
          'Every chapter must pass its evidence check before this revision is activated.',
          409
        )
      // Recheck after generation and before activation, including unchanged reuse.
      if (!(await checkAccess(snapshot, version.course, sourceOptions)))
        throw new StudyVersionError(
          'Source access changed during generation.',
          403
        )
      const revision = await saveStudyRevision(version, work)
      await commit((next) => {
        next.activeRevisionId = revision.id
        if (!next.history.some((r) => r.id === revision.id))
          next.history.unshift({
            id: revision.id,
            createdAt: revision.createdAt,
            chapters: revision.chapters.length,
            sourceHash: snapshot.sourceHash,
            changes: work.changes,
            reused: work.reused
          })
        next.draft = {
          id: work.id,
          billing: work.billing,
          status: 'complete',
          stage: 'finish',
          createdAt: work.createdAt,
          finishedAt: revision.createdAt
        }
      })
      return { again: false, complete: true }
    }
    work.lease = null
    work.attempts = 0
    work.runAfter = Date.now()
    work.error = work.status === 'failed' ? work.error : null
    await commit((next) => {
      next.draft = work
    })
    return { again: work.status !== 'failed' }
  } catch (error) {
    if (error.status === 409 && /stopped|lease/.test(error.message))
      return { again: false }
    await commit((next) => {
      const retry = error.status === 429 && error.retryAfter <= 120
      next.draft.status = retry ? 'queued' : 'failed'
      next.draft.lease = null
      next.draft.runAfter = Date.now() + (error.retryAfter || 30) * 1000
      next.draft.error =
        error.status === 429
          ? error.message
          : error instanceof StudyVersionError
            ? error.message
            : 'Generation could not finish this step. Retry to resume saved work.'
    }).catch((e) => {
      if (e.status !== 409) throw e
    })
    return { again: error.status === 429 && error.retryAfter <= 120, delay: error.retryAfter || 30, error: true }
  }
}
