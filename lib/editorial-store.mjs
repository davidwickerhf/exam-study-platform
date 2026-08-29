import { readFile } from 'node:fs/promises'
import { dirname, posix } from 'node:path'
import { neon } from '@neondatabase/serverless'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
let releaseIdCache = null
let editorialStateCache = null
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

async function withRetry(operation) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await operation() } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(attempt * 500)
    }
  }
  throw lastError
}

export function editorialMode() { return sql ? 'neon' : 'local' }

export function invalidateEditorialCache() {
  editorialStateCache = null
  questionCache.clear()
}

export async function activeReleaseId() {
  if (releaseIdCache) return releaseIdCache
  const rows = await withRetry(() => sql`SELECT id FROM editorial_releases WHERE active = TRUE LIMIT 1`)
  if (!rows.length) throw new Error('No active editorial release. Run npm run content:publish.')
  releaseIdCache = rows[0].id
  return releaseIdCache
}

export async function loadEditorialState(localTemplatePath) {
  if (!sql) return JSON.parse(await readFile(localTemplatePath, 'utf8'))
  if (editorialStateCache) return editorialStateCache
  const releaseId = await activeReleaseId()
  const [releaseRows, courseRows, chapterRows, itemRows, paperRows] = await withRetry(() => sql.transaction([
    sql`SELECT metadata, schema_version FROM editorial_releases WHERE id = ${releaseId}`,
    sql`SELECT * FROM editorial_courses WHERE release_id = ${releaseId} ORDER BY position`,
    sql`SELECT * FROM editorial_chapters WHERE release_id = ${releaseId} ORDER BY course_id, position`,
    sql`SELECT * FROM editorial_items WHERE release_id = ${releaseId} ORDER BY course_id, position`,
    sql`SELECT * FROM editorial_papers WHERE release_id = ${releaseId} ORDER BY course_id, paper_type, position`
  ]))
  const chapters = new Map()
  const items = new Map()
  const papers = new Map()
  for (const row of chapterRows) {
    const value = { id: row.chapter_id, name: row.name, file: row.source_path, ...row.extra }
    chapters.set(row.course_id, [...(chapters.get(row.course_id) || []), value])
  }
  for (const row of itemRows) items.set(row.course_id, [...(items.get(row.course_id) || []), row.definition])
  for (const row of paperRows) {
    const value = { id: row.paper_id, label: row.label, ...(row.question_path ? { pdf: row.question_path } : {}), ...(row.solutions_path ? { solutionsPdf: row.solutions_path } : {}), ...row.extra }
    const key = `${row.course_id}:${row.paper_type}`
    papers.set(key, [...(papers.get(key) || []), value])
  }
  editorialStateCache = {
    meta: { ...releaseRows[0].metadata, schemaVersion: releaseRows[0].schema_version },
    dailyBlocks: releaseRows[0].metadata.dailyBlocks || [],
    courses: courseRows.map((row) => ({
      id: row.course_id, code: row.code, name: row.name, shortName: row.short_name,
      exam: row.exam, role: row.role, accent: row.accent, knowledgeBase: row.knowledge_base,
      visualStyle: row.visual_style, examProfile: row.exam_profile, ...row.extra,
      chapters: chapters.get(row.course_id) || [], items: items.get(row.course_id) || [],
      mockExams: papers.get(`${row.course_id}:mock-exam`) || [],
      tutorials: papers.get(`${row.course_id}:tutorial`) || []
    }))
  }
  return editorialStateCache
}

// Published question banks (db/009). Cached per chapter until an admin write.
const questionCache = new Map()

export async function getPublishedQuestions(courseId, chapterId) {
  if (!sql) return null
  const key = `${courseId}/${chapterId}`
  if (questionCache.has(key)) return questionCache.get(key)
  const releaseId = await activeReleaseId()
  const rows = await withRetry(() => sql`SELECT definition FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId} ORDER BY position`)
  const questions = rows.map((row) => row.definition)
  questionCache.set(key, questions)
  return questions
}

export async function countPublishedQuestions() {
  if (!sql) return null
  const releaseId = await activeReleaseId()
  const [row] = await withRetry(() => sql`SELECT count(*)::int AS count FROM editorial_questions WHERE release_id = ${releaseId}`)
  return Number(row.count)
}

export async function getMaterial(courseId, sourcePath, { data = false } = {}) {
  if (!sql) return null
  const releaseId = await activeReleaseId()
  const rows = await withRetry(() => sql`SELECT id, source_path, kind, media_type, byte_size, sha256, text_content, extracted_text, extracted_pages, metadata
    FROM editorial_materials WHERE release_id = ${releaseId} AND course_id = ${courseId} AND source_path = ${sourcePath} LIMIT 1`)
  if (!rows.length) return null
  const material = rows[0]
  if (typeof material.extracted_pages === 'string') {
    try { material.extracted_pages = JSON.parse(material.extracted_pages) } catch {}
  }
  if (data) {
    const chunks = await withRetry(() => sql`SELECT data FROM editorial_material_chunks WHERE material_id = ${material.id} ORDER BY chunk_index`)
    material.data = Buffer.concat(chunks.map((row) => Buffer.from(row.data)))
  }
  return material
}

export async function getMaterialText(courseId, sourcePath) {
  const material = await getMaterial(courseId, sourcePath)
  return material?.text_content ?? material?.extracted_text ?? null
}

export async function listMaterials(courseId = null) {
  if (!sql) return null
  const releaseId = await activeReleaseId()
  return withRetry(() => courseId
    ? sql`SELECT course_id, source_path AS path, kind, media_type AS "mediaType", byte_size AS bytes, sha256, metadata FROM editorial_materials WHERE release_id = ${releaseId} AND course_id = ${courseId} ORDER BY source_path`
    : sql`SELECT course_id, source_path AS path, kind, media_type AS "mediaType", byte_size AS bytes, sha256, metadata FROM editorial_materials WHERE release_id = ${releaseId} ORDER BY course_id, source_path`)
}

export async function resolveChapterFromDatabase(course, chapter, relPath = '') {
  if (!sql) return null
  const chapterSource = chapter.file.replaceAll('\\', '/')
  const chapterDir = posix.dirname(chapterSource)
  const requested = relPath ? posix.normalize(posix.join(chapterSource, relPath)) : chapterSource
  let material = await getMaterial(course.id, requested)
  if (!material && !relPath) material = await getMaterial(course.id, chapterSource)
  if (material) {
    const examples = !relPath ? await getMaterialText(course.id, posix.join(dirname(chapterSource), 'examples.md')) : null
    return { kind: 'file', title: chapter.name, chapter, course: { id: course.id, code: course.code, name: course.name, shortName: course.shortName, accent: course.accent }, relPath, path: `${course.knowledgeBase}/${material.source_path}`, content: material.text_content ?? material.extracted_text ?? '', examples }
  }
  const releaseId = await activeReleaseId()
  const prefix = `${requested.replace(/\/$/, '')}/%`
  const rows = await withRetry(() => sql`SELECT source_path FROM editorial_materials WHERE release_id = ${releaseId} AND course_id = ${course.id} AND source_path LIKE ${prefix} ORDER BY source_path`)
  if (!rows.length) return null
  const files = new Set(); const subdirs = new Set()
  for (const row of rows) {
    const remainder = row.source_path.slice(requested.length + 1)
    const [first, ...rest] = remainder.split('/')
    if (rest.length) subdirs.add(first); else if (first.endsWith('.md')) files.add(first)
  }
  if (files.size === 1 && subdirs.size === 0) return resolveChapterFromDatabase(course, chapter, posix.join(relPath, [...files][0]))
  return { kind: 'directory', title: chapter.name, chapter, course: { id: course.id, code: course.code, name: course.name, shortName: course.shortName, accent: course.accent }, relPath, path: `${course.knowledgeBase}/${requested}`, files: [...files].sort(), subdirs: [...subdirs].sort() }
}
