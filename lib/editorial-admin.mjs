import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { sql } from './db.mjs'
import { activeReleaseId, invalidateEditorialCache } from './editorial-store.mjs'
import { loadEditorialProgrammeFile, normalizeEditorialProgramme, setEditorialProgrammeCatalogue } from './editorial-programmes.mjs'

// Administrative writes against the active editorial release. Everything
// here is hosted-only: local development reads course material from files
// and has nothing to write to.

export class AdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function requireSql() {
  if (!sql) throw new AdminError('Editorial writes require the hosted database (DATABASE_URL). Edit the files under content/ and data/ locally instead.', 501)
}

const text = (value, max = 500) => (value === undefined || value === null) ? undefined : String(value).trim().slice(0, max)
const ident = (value, label) => {
  const id = text(value, 120)
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(id)) throw new AdminError(`${label} must be a short identifier (letters, digits, dot, dash, underscore, space).`)
  return id
}
const CHUNK_BYTES = 512 * 1024

const MEDIA_TYPES = { '.md': 'md', '.pdf': 'pdf', '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.svg': 'svg', '.webp': 'webp', '.txt': 'txt', '.c': 'c', '.h': 'h', '.py': 'py', '.s': 's', '.html': 'html', '.tex': 'tex', '.ipynb': 'ipynb', '.docx': 'docx', '.pptx': 'pptx' }
function kindFor(extension) {
  if (extension === '.md') return 'markdown'
  if (extension === '.pdf') return 'pdf'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) return 'image'
  if (['.ppt', '.pptx', '.doc', '.docx'].includes(extension)) return 'office'
  if (['.c', '.h', '.s', '.py', '.m', '.ipynb', '.html', '.txt', '.tex'].includes(extension)) return 'code'
  return 'attachment'
}

async function courseExists(releaseId, courseId) {
  const rows = await sql`SELECT 1 FROM editorial_courses WHERE release_id = ${releaseId} AND course_id = ${courseId}`
  if (!rows.length) throw new AdminError(`Unknown course: ${courseId}`, 404)
}

export async function adminStatus() {
  if (!sql) return { mode: 'local', writable: false }
  const releaseId = await activeReleaseId()
  const [row] = await sql`SELECT
      (SELECT count(*) FROM editorial_courses WHERE release_id = ${releaseId})::int AS courses,
      (SELECT count(*) FROM editorial_chapters WHERE release_id = ${releaseId})::int AS chapters,
      (SELECT count(*) FROM editorial_items WHERE release_id = ${releaseId})::int AS items,
      (SELECT count(*) FROM editorial_papers WHERE release_id = ${releaseId})::int AS papers,
      (SELECT count(*) FROM editorial_materials WHERE release_id = ${releaseId})::int AS materials,
      (SELECT count(*) FROM editorial_questions WHERE release_id = ${releaseId})::int AS questions,
      (SELECT count(*) FROM editorial_programmes)::int AS programmes,
      (SELECT activated_at FROM editorial_releases WHERE id = ${releaseId}) AS activated_at`
  return { mode: 'neon', writable: true, releaseId: Number(releaseId), activatedAt: row.activated_at, counts: { courses: row.courses, chapters: row.chapters, items: row.items, papers: row.papers, materials: row.materials, questions: row.questions, programmes: row.programmes } }
}

// ── Courses ──────────────────────────────────────────────────────────────

const COURSE_COLUMNS = ['code', 'name', 'shortName', 'exam', 'role', 'accent', 'knowledgeBase', 'visualStyle', 'examProfile', 'position', 'extra']

export async function upsertCourse(courseIdRaw, body = {}) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const releaseId = await activeReleaseId()
  const [existing] = await sql`SELECT * FROM editorial_courses WHERE release_id = ${releaseId} AND course_id = ${courseId}`
  const next = {
    code: text(body.code, 40) ?? existing?.code,
    name: text(body.name, 200) ?? existing?.name,
    shortName: text(body.shortName, 60) ?? existing?.short_name ?? null,
    exam: text(body.exam, 200) ?? existing?.exam ?? null,
    role: text(body.role, 200) ?? existing?.role ?? null,
    accent: text(body.accent, 40) ?? existing?.accent ?? null,
    knowledgeBase: text(body.knowledgeBase, 200) ?? existing?.knowledge_base ?? `${text(body.code, 40) || courseId} Knowledge Base`,
    visualStyle: text(body.visualStyle, 200) ?? existing?.visual_style ?? null,
    examProfile: text(body.examProfile, 2000) ?? existing?.exam_profile ?? null,
    extra: body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra) ? { ...(existing?.extra || {}), ...body.extra } : (existing?.extra || {})
  }
  if (!next.code || !next.name) throw new AdminError('A course needs a code and a name.')
  let position = Number.isFinite(Number(body.position)) ? Math.trunc(Number(body.position)) : existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_courses WHERE release_id = ${releaseId}`
    position = Number(row.next)
  }
  await sql`INSERT INTO editorial_courses (release_id, course_id, code, name, short_name, position, exam, role, accent, knowledge_base, visual_style, exam_profile, extra)
    VALUES (${releaseId}, ${courseId}, ${next.code}, ${next.name}, ${next.shortName}, ${position}, ${next.exam}, ${next.role}, ${next.accent}, ${next.knowledgeBase}, ${next.visualStyle}, ${next.examProfile}, ${JSON.stringify(next.extra)}::jsonb)
    ON CONFLICT (release_id, course_id) DO UPDATE SET code = excluded.code, name = excluded.name, short_name = excluded.short_name, position = excluded.position, exam = excluded.exam, role = excluded.role,
      accent = excluded.accent, knowledge_base = excluded.knowledge_base, visual_style = excluded.visual_style, exam_profile = excluded.exam_profile, extra = excluded.extra`
  invalidateEditorialCache()
  return { id: courseId, ...next, position, created: !existing }
}

export async function deleteCourse(courseIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_courses WHERE release_id = ${releaseId} AND course_id = ${courseId} RETURNING course_id`
  if (!rows.length) throw new AdminError(`Unknown course: ${courseId}`, 404)
  invalidateEditorialCache()
  return { id: courseId, deleted: true }
}

// ── Chapters ─────────────────────────────────────────────────────────────

export async function upsertChapter(courseIdRaw, chapterIdRaw, body = {}) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  const [existing] = await sql`SELECT * FROM editorial_chapters WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
  const name = text(body.name, 200) ?? existing?.name
  const sourcePath = text(body.sourcePath ?? body.file, 500) ?? existing?.source_path
  if (!name || !sourcePath) throw new AdminError('A chapter needs a name and a sourcePath (the markdown file inside the course knowledge base).')
  let position = Number.isFinite(Number(body.position)) ? Math.trunc(Number(body.position)) : existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_chapters WHERE release_id = ${releaseId} AND course_id = ${courseId}`
    position = Number(row.next)
  }
  const extra = body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra) ? { ...(existing?.extra || {}), ...body.extra } : (existing?.extra || {})
  await sql`INSERT INTO editorial_chapters (release_id, course_id, chapter_id, name, source_path, position, extra)
    VALUES (${releaseId}, ${courseId}, ${chapterId}, ${name}, ${sourcePath}, ${position}, ${JSON.stringify(extra)}::jsonb)
    ON CONFLICT (release_id, course_id, chapter_id) DO UPDATE SET name = excluded.name, source_path = excluded.source_path, position = excluded.position, extra = excluded.extra`
  invalidateEditorialCache()
  return { courseId, id: chapterId, name, sourcePath, position, extra, created: !existing }
}

export async function deleteChapter(courseIdRaw, chapterIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_chapters WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId} RETURNING chapter_id`
  if (!rows.length) throw new AdminError(`Unknown chapter: ${courseId}/${chapterId}`, 404)
  await sql`DELETE FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
  invalidateEditorialCache()
  return { courseId, id: chapterId, deleted: true }
}

// ── Study items (topics / skills tracked for mastery) ────────────────────

export async function upsertItem(courseIdRaw, itemIdRaw, definition = {}) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const itemId = ident(itemIdRaw, 'Item id')
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new AdminError('Item definition must be an object.')
  const title = text(definition.title, 200)
  if (!title) throw new AdminError('An item needs a title.')
  const [existing] = await sql`SELECT position, definition FROM editorial_items WHERE release_id = ${releaseId} AND course_id = ${courseId} AND item_id = ${itemId}`
  let position = Number.isFinite(Number(definition.position)) ? Math.trunc(Number(definition.position)) : existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_items WHERE release_id = ${releaseId} AND course_id = ${courseId}`
    position = Number(row.next)
  }
  const { position: _position, ...rest } = definition
  const merged = { ...(existing?.definition || {}), ...rest, id: itemId, title }
  await sql`INSERT INTO editorial_items (release_id, course_id, item_id, position, definition) VALUES (${releaseId}, ${courseId}, ${itemId}, ${position}, ${JSON.stringify(merged)}::jsonb)
    ON CONFLICT (release_id, course_id, item_id) DO UPDATE SET position = excluded.position, definition = excluded.definition`
  invalidateEditorialCache()
  return { courseId, position, ...merged, created: !existing }
}

export async function deleteItem(courseIdRaw, itemIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const itemId = ident(itemIdRaw, 'Item id')
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_items WHERE release_id = ${releaseId} AND course_id = ${courseId} AND item_id = ${itemId} RETURNING item_id`
  if (!rows.length) throw new AdminError(`Unknown item: ${courseId}/${itemId}`, 404)
  invalidateEditorialCache()
  return { courseId, id: itemId, deleted: true }
}

// ── Papers (mock exams and tutorials) ────────────────────────────────────

export async function upsertPaper(courseIdRaw, paperTypeRaw, paperIdRaw, body = {}) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const paperId = ident(paperIdRaw, 'Paper id')
  const paperType = paperTypeRaw === 'tutorial' ? 'tutorial' : paperTypeRaw === 'mock-exam' ? 'mock-exam' : null
  if (!paperType) throw new AdminError('Paper type must be mock-exam or tutorial.')
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  const [existing] = await sql`SELECT * FROM editorial_papers WHERE release_id = ${releaseId} AND course_id = ${courseId} AND paper_type = ${paperType} AND paper_id = ${paperId}`
  const label = text(body.label, 200) ?? existing?.label
  if (!label) throw new AdminError('A paper needs a label.')
  const questionPath = text(body.questionPath ?? body.pdf, 500) ?? existing?.question_path ?? null
  const solutionsPath = text(body.solutionsPath ?? body.solutionsPdf, 500) ?? existing?.solutions_path ?? null
  let position = Number.isFinite(Number(body.position)) ? Math.trunc(Number(body.position)) : existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_papers WHERE release_id = ${releaseId} AND course_id = ${courseId} AND paper_type = ${paperType}`
    position = Number(row.next)
  }
  const extra = body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra) ? { ...(existing?.extra || {}), ...body.extra } : (existing?.extra || {})
  await sql`INSERT INTO editorial_papers (release_id, course_id, paper_id, paper_type, position, label, question_path, solutions_path, extra)
    VALUES (${releaseId}, ${courseId}, ${paperId}, ${paperType}, ${position}, ${label}, ${questionPath}, ${solutionsPath}, ${JSON.stringify(extra)}::jsonb)
    ON CONFLICT (release_id, course_id, paper_type, paper_id) DO UPDATE SET position = excluded.position, label = excluded.label, question_path = excluded.question_path, solutions_path = excluded.solutions_path, extra = excluded.extra`
  invalidateEditorialCache()
  return { courseId, type: paperType, id: paperId, label, questionPath, solutionsPath, position, extra, created: !existing }
}

export async function deletePaper(courseIdRaw, paperTypeRaw, paperIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const paperId = ident(paperIdRaw, 'Paper id')
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_papers WHERE release_id = ${releaseId} AND course_id = ${courseId} AND paper_type = ${paperTypeRaw} AND paper_id = ${paperId} RETURNING paper_id`
  if (!rows.length) throw new AdminError(`Unknown paper: ${courseId}/${paperTypeRaw}/${paperId}`, 404)
  invalidateEditorialCache()
  return { courseId, type: paperTypeRaw, id: paperId, deleted: true }
}

// ── Materials (files inside a course knowledge base) ─────────────────────

function chunkText(value, target = 1600, overlap = 220) {
  const normalized = String(value || '').replace(/[\uD800-\uDFFF]/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) return []
  const chunks = []
  let start = 0
  while (start < normalized.length) {
    let end = Math.min(start + target, normalized.length)
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n\n', end), normalized.lastIndexOf('. ', end))
      if (boundary > start + Math.floor(target * 0.6)) end = boundary + 1
    }
    chunks.push(normalized.slice(start, end).trim())
    if (end >= normalized.length) break
    start = Math.max(start + 1, end - overlap)
  }
  return chunks.filter(Boolean)
}

function safeSourcePath(value) {
  const path = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '').trim()
  if (!path || path.length > 500 || path.split('/').some((segment) => segment === '..' || segment === '')) throw new AdminError('sourcePath must be a relative file path inside the course knowledge base.')
  return path
}

export async function putMaterial(courseIdRaw, sourcePathRaw, body = {}) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const sourcePath = safeSourcePath(sourcePathRaw)
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  let bytes
  if (typeof body.content === 'string') bytes = Buffer.from(body.content, 'utf8')
  else if (typeof body.base64 === 'string') bytes = Buffer.from(body.base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
  else throw new AdminError('Provide `content` (text) or `base64` (binary).')
  if (!bytes.length) throw new AdminError('The material is empty.')
  if (bytes.length > 40 * 1024 * 1024) throw new AdminError('Materials are limited to 40 MB.')
  const extension = extname(sourcePath).toLowerCase()
  const kind = kindFor(extension)
  const mediaType = text(body.mediaType, 40) || MEDIA_TYPES[extension] || extension.replace('.', '') || 'bin'
  const isText = ['markdown', 'code'].includes(kind) && !bytes.includes(0)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const [row] = await sql`INSERT INTO editorial_materials (release_id, course_id, source_path, kind, media_type, byte_size, sha256, text_content, extracted_text, extracted_pages, metadata)
    VALUES (${releaseId}, ${courseId}, ${sourcePath}, ${kind}, ${mediaType}, ${bytes.length}, ${sha256}, ${isText ? bytes.toString('utf8') : null}, null, null, ${JSON.stringify({ source: 'admin-api', updatedAt: new Date().toISOString() })}::jsonb)
    ON CONFLICT (release_id, course_id, source_path) DO UPDATE SET kind = excluded.kind, media_type = excluded.media_type, byte_size = excluded.byte_size, sha256 = excluded.sha256,
      text_content = excluded.text_content, extracted_text = excluded.extracted_text, extracted_pages = excluded.extracted_pages, metadata = excluded.metadata
    RETURNING id`
  const materialId = row.id
  await sql`DELETE FROM editorial_material_chunks WHERE material_id = ${materialId}`
  for (let offset = 0, index = 0; offset < bytes.length; offset += CHUNK_BYTES, index++) {
    await sql`INSERT INTO editorial_material_chunks (material_id, chunk_index, data) VALUES (${materialId}, ${index}, ${bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length))})`
  }
  // Keep the tutor's retrieval index in step for text material.
  await sql`DELETE FROM editorial_retrieval_chunks WHERE material_id = ${materialId}`
  let indexed = 0
  if (isText) {
    for (const [index, content] of chunkText(bytes.toString('utf8')).entries()) {
      await sql`INSERT INTO editorial_retrieval_chunks (material_id, course_id, source_path, page_number, chunk_index, content, metadata) VALUES (${materialId}, ${courseId}, ${sourcePath}, null, ${index}, ${content}, '{}'::jsonb)`
      indexed++
    }
  }
  invalidateEditorialCache()
  return { courseId, sourcePath, kind, mediaType, bytes: bytes.length, sha256, indexedChunks: indexed, note: kind === 'pdf' ? 'PDF text is not extracted by the API; run npm run content:extract for tutor retrieval.' : undefined }
}

export async function deleteMaterial(courseIdRaw, sourcePathRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const sourcePath = safeSourcePath(sourcePathRaw)
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_materials WHERE release_id = ${releaseId} AND course_id = ${courseId} AND source_path = ${sourcePath} RETURNING id`
  if (!rows.length) throw new AdminError(`Unknown material: ${courseId}/${sourcePath}`, 404)
  invalidateEditorialCache()
  return { courseId, sourcePath, deleted: true }
}

// ── Published questions ──────────────────────────────────────────────────

const QUESTION_TYPES = new Set(['written', 'calc', 'tf', 'mc', 'pseudocode', 'code', 'best-option'])

function normalizeQuestion(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminError(`Question ${index + 1} must be an object.`)
  const id = text(value.id, 120)
  const question = text(value.question, 20000)
  if (!id) throw new AdminError(`Question ${index + 1} needs an id.`)
  if (!question) throw new AdminError(`Question ${id} needs a question text.`)
  const type = text(value.type, 30) || 'written'
  if (!QUESTION_TYPES.has(type)) throw new AdminError(`Question ${id}: unknown type "${type}". Use one of ${[...QUESTION_TYPES].join(', ')}.`)
  return { ...value, id, type, question }
}

export async function listQuestions(courseIdRaw, chapterIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const releaseId = await activeReleaseId()
  const rows = await sql`SELECT definition, position, updated_at FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId} ORDER BY position`
  return rows.map((row) => row.definition)
}

export async function replaceQuestions(courseIdRaw, chapterIdRaw, questions) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  if (!Array.isArray(questions)) throw new AdminError('Provide an array of questions.')
  const normalized = questions.map(normalizeQuestion)
  const ids = new Set()
  for (const q of normalized) { if (ids.has(q.id)) throw new AdminError(`Duplicate question id: ${q.id}`); ids.add(q.id) }
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  await sql`DELETE FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
  for (const [position, q] of normalized.entries()) {
    await sql`INSERT INTO editorial_questions (release_id, course_id, chapter_id, question_id, position, definition) VALUES (${releaseId}, ${courseId}, ${chapterId}, ${q.id}, ${position}, ${JSON.stringify(q)}::jsonb)`
  }
  invalidateEditorialCache()
  return { courseId, chapterId, count: normalized.length }
}

export async function upsertQuestion(courseIdRaw, chapterIdRaw, value) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const q = normalizeQuestion(value, 0)
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  const [existing] = await sql`SELECT position FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId} AND question_id = ${q.id}`
  let position = existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
    position = Number(row.next)
  }
  await sql`INSERT INTO editorial_questions (release_id, course_id, chapter_id, question_id, position, definition, updated_at) VALUES (${releaseId}, ${courseId}, ${chapterId}, ${q.id}, ${position}, ${JSON.stringify(q)}::jsonb, now())
    ON CONFLICT (release_id, course_id, chapter_id, question_id) DO UPDATE SET definition = excluded.definition, updated_at = now()`
  invalidateEditorialCache()
  return { courseId, chapterId, ...q, created: !existing }
}

export async function deleteQuestion(courseIdRaw, chapterIdRaw, questionIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const questionId = text(questionIdRaw, 120)
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_questions WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId} AND question_id = ${questionId} RETURNING question_id`
  if (!rows.length) throw new AdminError(`Unknown question: ${courseId}/${chapterId}/${questionId}`, 404)
  invalidateEditorialCache()
  return { courseId, chapterId, id: questionId, deleted: true }
}

// One-time seed from the repository's published caches so the first hosted
// deployment after db/009 keeps every existing question bank.
export async function seedQuestionsFromCache(cacheDir) {
  if (!sql) return { seeded: 0 }
  const releaseId = await activeReleaseId()
  const [row] = await sql`SELECT count(*)::int AS count FROM editorial_questions WHERE release_id = ${releaseId}`
  if (Number(row.count) > 0) return { seeded: 0, existing: Number(row.count) }
  const dir = resolve(cacheDir, 'questions')
  if (!existsSync(dir)) return { seeded: 0 }
  const courses = new Set((await sql`SELECT course_id FROM editorial_courses WHERE release_id = ${releaseId}`).map((r) => r.course_id))
  let seeded = 0
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json'))) {
    const [courseId, ...rest] = file.slice(0, -5).split('-')
    const chapterId = rest.join('-')
    if (!courses.has(courseId) || !chapterId) continue
    let payload
    try { payload = JSON.parse(await readFile(resolve(dir, file), 'utf8')) } catch { continue }
    const questions = Array.isArray(payload?.questions) ? payload.questions.filter((q) => q?.id && q?.question) : []
    for (const [position, q] of questions.entries()) {
      await sql`INSERT INTO editorial_questions (release_id, course_id, chapter_id, question_id, position, definition) VALUES (${releaseId}, ${courseId}, ${chapterId}, ${String(q.id)}, ${position}, ${JSON.stringify(q)}::jsonb) ON CONFLICT DO NOTHING`
      seeded++
    }
  }
  invalidateEditorialCache()
  return { seeded }
}

// ── Programme catalogue (known bachelors) ────────────────────────────────

export async function listProgrammes() {
  requireSql()
  const rows = await sql`SELECT id, definition, updated_at FROM editorial_programmes ORDER BY id`
  return rows.map((row) => ({ ...row.definition, updatedAt: row.updated_at }))
}

async function refreshProgrammeCatalogue() {
  const rows = await sql`SELECT definition FROM editorial_programmes ORDER BY id`
  setEditorialProgrammeCatalogue(rows.map((row) => row.definition))
}

export async function upsertProgramme(programmeIdRaw, definition) {
  requireSql()
  const programmeId = ident(programmeIdRaw, 'Programme id')
  let normalized
  try { normalized = normalizeEditorialProgramme({ ...definition, id: programmeId }) }
  catch (error) { throw new AdminError(error.message) }
  const [existing] = await sql`SELECT id FROM editorial_programmes WHERE id = ${programmeId}`
  await sql`INSERT INTO editorial_programmes (id, definition, updated_at) VALUES (${programmeId}, ${JSON.stringify(normalized)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET definition = excluded.definition, updated_at = now()`
  await refreshProgrammeCatalogue()
  return { ...normalized, created: !existing }
}

export async function deleteProgramme(programmeIdRaw) {
  requireSql()
  const programmeId = ident(programmeIdRaw, 'Programme id')
  const rows = await sql`DELETE FROM editorial_programmes WHERE id = ${programmeId} RETURNING id`
  if (!rows.length) throw new AdminError(`Unknown programme: ${programmeId}`, 404)
  await refreshProgrammeCatalogue()
  return { id: programmeId, deleted: true }
}

// Seeds the catalogue table from the repository file once, then serves the
// in-memory catalogue from the database on every start.
export async function primeProgrammeCatalogue() {
  if (!sql) return { mode: 'file' }
  const [row] = await sql`SELECT count(*)::int AS count FROM editorial_programmes`
  if (Number(row.count) === 0) {
    for (const programme of loadEditorialProgrammeFile()) {
      await sql`INSERT INTO editorial_programmes (id, definition) VALUES (${programme.id}, ${JSON.stringify(programme)}::jsonb) ON CONFLICT DO NOTHING`
    }
  }
  await refreshProgrammeCatalogue()
  return { mode: 'neon' }
}
