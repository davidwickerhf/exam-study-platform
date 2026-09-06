import { randomUUID } from 'node:crypto'
import { normalizedPeriod } from './workspace/course-ledger.mjs'
import { sql } from './db.mjs'
import { currentUserId } from './request-context.mjs'
import { listCanvasCorpusMaterials } from './course-corpus.mjs'
import {
  listDocuments,
  readDocument,
  compareAndSwapDocument
} from './user-store.mjs'
import {
  digest,
  sourceChunks,
  StudyVersionError
} from './study-version-content.mjs'

export function studyCourse(input) {
  const courseCode = String(input.courseCode || '')
    .trim()
    .toUpperCase()
  const academicYear = String(input.academicYear || '').trim()
  if (!/^[A-Z0-9][A-Z0-9 -]{1,79}$/.test(courseCode))
    throw new StudyVersionError('Choose a course with a valid course code.')
  if (!/^(?:20\d{2}-20\d{2}|undated)$/.test(academicYear))
    throw new StudyVersionError(
      'Choose one academic year before generating a study version.'
    )
  return {
    courseCode,
    courseName: String(input.courseName || courseCode)
      .trim()
      .slice(0, 180),
    academicYear,
    period: normalizedPeriod(input.period).slice(0, 80)
  }
}
export async function listStudySources(
  course,
  { editorialSources = async () => [] } = {}
) {
  const [materials, notes, editorial] = await Promise.all([
    listCanvasCorpusMaterials({
      accountId: currentUserId(),
      courseCode: course.courseCode
    }),
    listDocuments('study-notes'),
    editorialSources(course.courseCode)
  ])
  const sources = materials
    .filter((m) => m.current)
    .map((m) => ({
      key: `canvas-${digest([m.bindingId, m.sourcePath]).slice(0, 32)}`,
      title: m.filename || m.sourcePath,
      kind: 'canvas',
      academicYear: m.academicYear || 'undated',
      period: m.period || '',
      sha256: m.sha256,
      snapshotId: m.snapshotId,
      assetId: m.assetId,
      editionId: m.editionId,
      bindingId: m.bindingId,
      url: m.url,
      updatedAt: m.canvasUpdatedAt || m.lastSeenAt,
      sharingMode: m.sharingMode
    }))
  sources.push(
    ...notes
      .map((n) => n.value)
      .filter((n) => n.courseCode === course.courseCode && !n.deleted)
      .map((n) => ({
        key: n.id,
        title: n.title,
        kind: 'notes',
        academicYear: n.academicYear,
        period: n.period || '',
        sha256: digest(n.pages),
        updatedAt: n.updatedAt
      }))
  )
  sources.push(
    ...editorial.map((s) => ({
      ...s,
      kind: 'editorial',
      academicYear: s.academicYear || 'undated',
      sha256: s.sha256 || digest(s.pages)
    }))
  )
  return sources.map(({ pages, ...s }) => ({
    ...s,
    historical: s.academicYear !== course.academicYear,
    periodMismatch: Boolean(
      course.period && s.period && normalizedPeriod(s.period) !== normalizedPeriod(course.period)
    )
  }))
}
export async function addStudyNote(input, pages) {
  const course = studyCourse(input)
  const title = String(input.title || '')
    .trim()
    .slice(0, 180)
  if (!title) throw new StudyVersionError('Give your notes a title.')
  if (!Array.isArray(pages) || !pages.some((p) => String(p.text || '').trim()))
    throw new StudyVersionError(
      'These notes contain no readable text. Upload a text PDF, Word document, Markdown or text file, or paste your notes.'
    )
  if (pages.reduce((n, p) => n + String(p.text || '').length, 0) > 300000)
    throw new StudyVersionError(
      'Split these notes into files containing fewer than 300,000 characters.'
    )
  const id = `note-${randomUUID()}`,
    now = new Date().toISOString()
  await compareAndSwapDocument(
    'study-notes',
    id,
    { ...course, id, title, pages, revision: randomUUID(), updatedAt: now },
    null
  )
  return { id, title }
}
export async function readStudySourceSnapshot(course, keys, options = {}) {
  if (
    !Array.isArray(keys) ||
    !keys.length ||
    keys.length > 100 ||
    new Set(keys).size !== keys.length
  )
    throw new StudyVersionError('Select between 1 and 100 distinct sources.')
  const available = await listStudySources(course, options)
  const selected = keys.map((key) => available.find((s) => s.key === key))
  if (selected.some((s) => !s))
    throw new StudyVersionError(
      'A selected source changed or is no longer available. Reload your sources.',
      409
    )
  if (
    selected.some((s) => s.historical || s.periodMismatch) &&
    options.includeHistorical !== true
  )
    throw new StudyVersionError(
      'Confirm the use of material from another or unspecified edition.'
    )
  const sources = [],
    chunks = [],
    excluded = []
  let total = 0
  const editorial = selected.some((s) => s.kind === 'editorial')
    ? await options.editorialSources(course.courseCode)
    : []
  for (const source of selected) {
    let pages = []
    if (source.kind === 'notes')
      pages = (await readDocument('study-notes', source.key, null))?.pages || []
    else if (source.kind === 'editorial')
      pages = editorial.find((s) => s.key === source.key)?.pages || []
    else if (sql) {
      // The catalogue already checked owner/community permissions. Exact edition
      // prevents content-addressed assets from joining a different year's index.
      const rows =
        await sql`SELECT page_number,chunk_index,content FROM editorial_source_retrieval_chunks
        WHERE asset_id=${source.assetId} AND edition_id=${source.editionId} ORDER BY page_number NULLS FIRST,chunk_index LIMIT 2001`
      if (rows.length > 2000)
        throw new StudyVersionError(
          `“${source.title}” is too large for one study version. Select a smaller source set.`
        )
      pages = rows.map((r) => ({ page: r.page_number, text: r.content }))
    }
    const extracted = sourceChunks(source, pages)
    if (!extracted.length) {
      excluded.push({
        title: source.title,
        reason: 'No extracted text is available yet.'
      })
      continue
    }
    total += extracted.reduce((n, c) => n + c.text.length, 0)
    if (total > 600000)
      throw new StudyVersionError(
        'This selection exceeds 600,000 characters. Generate a focused version from fewer sources, then create another for the remaining topics.'
      )
    sources.push(source)
    chunks.push(...extracted)
  }
  if (!chunks.length)
    throw new StudyVersionError(
      'None of the selected sources has readable text yet. Wait for collection or add your notes.',
      409
    )
  return {
    sources,
    chunks,
    excluded,
    // Extraction upgrades can change evidence while the original bytes stay
    // identical. A refresh must see new notes, corrected text and coverage gaps.
    sourceHash: digest([sources.map((s) => [s.key, s.sha256]).sort(), chunks]),
    capturedAt: new Date().toISOString()
  }
}
export async function studySourcesStillAvailable(snapshot, course, options) {
  const available = await listStudySources(course, options)
  // A changed file is still permitted, but a withdrawn source is not. Versions
  // retain exact evidence privately; publishing rechecks matching digests.
  return snapshot.sources.every((s) => available.some((a) => a.key === s.key))
}
