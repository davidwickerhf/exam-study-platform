import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
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
      (SELECT count(*) FROM editorial_flashcards WHERE release_id = ${releaseId})::int AS flashcards,
      (SELECT count(*) FROM editorial_programmes)::int AS programmes,
      (SELECT activated_at FROM editorial_releases WHERE id = ${releaseId}) AS activated_at`
  return { mode: 'neon', writable: true, releaseId: Number(releaseId), activatedAt: row.activated_at, counts: { courses: row.courses, chapters: row.chapters, items: row.items, papers: row.papers, materials: row.materials, questions: row.questions, flashcards: row.flashcards, programmes: row.programmes } }
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

// PDF text via Poppler (pdftotext), page by page. Missing binary → null so the
// caller can store the file and report that extraction is unavailable.
export async function extractPdfText(bytes) {
  const dir = await mkdtemp(join(tmpdir(), 'wicker-pdf-'))
  const path = join(dir, 'material.pdf')
  try {
    await writeFile(path, bytes)
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], { maxBuffer: 64 * 1024 * 1024 })
    const pages = stdout.split('\f').map((text, index) => ({ page: index + 1, text: text.trimEnd() })).filter((page) => page.text.trim())
    return { available: true, text: pages.map((page) => page.text).join('\n\n'), pages }
  } catch (error) {
    if (error.code === 'ENOENT') return { available: false, text: null, pages: null, reason: 'pdftotext is not installed on this server' }
    return { available: true, text: null, pages: null, reason: error.message }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function reindexMaterial(materialId, courseId, sourcePath, { text = null, pages = null } = {}) {
  await sql`DELETE FROM editorial_retrieval_chunks WHERE material_id = ${materialId}`
  let indexed = 0
  if (Array.isArray(pages) && pages.length) {
    for (const page of pages) {
      for (const [index, content] of chunkText(page.text).entries()) {
        await sql`INSERT INTO editorial_retrieval_chunks (material_id, course_id, source_path, page_number, chunk_index, content, metadata) VALUES (${materialId}, ${courseId}, ${sourcePath}, ${page.page}, ${index}, ${content}, '{}'::jsonb)`
        indexed++
      }
    }
  } else if (text) {
    for (const [index, content] of chunkText(text).entries()) {
      await sql`INSERT INTO editorial_retrieval_chunks (material_id, course_id, source_path, page_number, chunk_index, content, metadata) VALUES (${materialId}, ${courseId}, ${sourcePath}, null, ${index}, ${content}, '{}'::jsonb)`
      indexed++
    }
  }
  return indexed
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
  const extracted = kind === 'pdf' ? await extractPdfText(bytes) : null
  const [row] = await sql`INSERT INTO editorial_materials (release_id, course_id, source_path, kind, media_type, byte_size, sha256, text_content, extracted_text, extracted_pages, metadata)
    VALUES (${releaseId}, ${courseId}, ${sourcePath}, ${kind}, ${mediaType}, ${bytes.length}, ${sha256}, ${isText ? bytes.toString('utf8') : null}, ${extracted?.text ?? null}, ${extracted?.pages ? JSON.stringify(extracted.pages) : null}::jsonb, ${JSON.stringify({ source: 'admin-api', updatedAt: new Date().toISOString() })}::jsonb)
    ON CONFLICT (release_id, course_id, source_path) DO UPDATE SET kind = excluded.kind, media_type = excluded.media_type, byte_size = excluded.byte_size, sha256 = excluded.sha256,
      text_content = excluded.text_content, extracted_text = excluded.extracted_text, extracted_pages = excluded.extracted_pages, metadata = excluded.metadata
    RETURNING id`
  const materialId = row.id
  await sql`DELETE FROM editorial_material_chunks WHERE material_id = ${materialId}`
  for (let offset = 0, index = 0; offset < bytes.length; offset += CHUNK_BYTES, index++) {
    const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length))
    // Large uploads cross several HTTP requests; transient connect errors are retried.
    for (let attempt = 1; ; attempt++) {
      try {
        await sql`INSERT INTO editorial_material_chunks (material_id, chunk_index, data) VALUES (${materialId}, ${index}, ${chunk}) ON CONFLICT (material_id, chunk_index) DO UPDATE SET data = excluded.data`
        break
      } catch (error) {
        if (attempt >= 5) throw new AdminError(`Upload failed on chunk ${index + 1}: ${error.message}`, 502)
        await new Promise((resolveSleep) => setTimeout(resolveSleep, attempt * 1500))
      }
    }
  }
  // Keep the tutor's retrieval index in step: markdown/code by chunk, PDFs by page.
  const indexed = await reindexMaterial(materialId, courseId, sourcePath, isText ? { text: bytes.toString('utf8') } : { pages: extracted?.pages })
  invalidateEditorialCache()
  const note = kind === 'pdf'
    ? (extracted?.pages?.length ? `Extracted ${extracted.pages.length} pages of text.` : `No text extracted (${extracted?.reason || 'scanned PDF; run npm run content:extract for OCR'}).`)
    : undefined
  return { courseId, sourcePath, kind, mediaType, bytes: bytes.length, sha256, indexedChunks: indexed, extractedPages: extracted?.pages?.length ?? null, note }
}

// (Re)extract text from a stored PDF and rebuild its retrieval chunks.
export async function extractMaterial(courseIdRaw, sourcePathRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const sourcePath = safeSourcePath(sourcePathRaw)
  const releaseId = await activeReleaseId()
  const [material] = await sql`SELECT id, kind FROM editorial_materials WHERE release_id = ${releaseId} AND course_id = ${courseId} AND source_path = ${sourcePath}`
  if (!material) throw new AdminError(`Unknown material: ${courseId}/${sourcePath}`, 404)
  if (material.kind !== 'pdf') throw new AdminError('Only PDFs are extracted; text material is indexed directly.')
  const chunks = await sql`SELECT data FROM editorial_material_chunks WHERE material_id = ${material.id} ORDER BY chunk_index`
  const bytes = Buffer.concat(chunks.map((row) => Buffer.from(row.data)))
  const extracted = await extractPdfText(bytes)
  if (!extracted.pages?.length) throw new AdminError(`No text extracted (${extracted.reason || 'scanned PDF; OCR needs npm run content:extract'}).`, extracted.available ? 422 : 501)
  await sql`UPDATE editorial_materials SET extracted_text = ${extracted.text}, extracted_pages = ${JSON.stringify(extracted.pages)}::jsonb WHERE id = ${material.id}`
  const indexed = await reindexMaterial(material.id, courseId, sourcePath, { pages: extracted.pages })
  return { courseId, sourcePath, extractedPages: extracted.pages.length, indexedChunks: indexed }
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

// ── Editorial flashcards ─────────────────────────────────────────────────

function normalizeCard(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminError(`Card ${index + 1} must be an object.`)
  const front = text(value.front, 4000)
  const back = text(value.back, 8000)
  if (!front || !back) throw new AdminError(`Card ${value.id || index + 1} needs a front and a back.`)
  const id = text(value.id, 120) || `fc-${randomUUID()}`
  const { id: _id, front: _f, back: _b, source, courseId: _c, chapterId: _ch, sr: _sr, createdAt: _at, position: _p, ...extra } = value
  return { id, front, back, source: text(source, 40) || 'editorial', extra }
}

export async function listFlashcards(courseIdRaw, chapterIdRaw = null) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = chapterIdRaw == null ? null : ident(chapterIdRaw, 'Chapter id')
  const releaseId = await activeReleaseId()
  const rows = await sql`SELECT chapter_id, card_id, front, back, source, extra, position FROM editorial_flashcards
    WHERE release_id = ${releaseId} AND course_id = ${courseId} AND (${chapterId}::text IS NULL OR chapter_id = ${chapterId}) ORDER BY chapter_id, position`
  return rows.map((row) => ({ id: row.card_id, courseId, chapterId: row.chapter_id, front: row.front, back: row.back, source: row.source, ...(row.extra || {}) }))
}

export async function replaceFlashcards(courseIdRaw, chapterIdRaw, cards) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  if (!Array.isArray(cards)) throw new AdminError('Provide an array of cards.')
  const normalized = cards.map(normalizeCard)
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  await sql`DELETE FROM editorial_flashcards WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
  for (const [position, card] of normalized.entries()) {
    await sql`INSERT INTO editorial_flashcards (release_id, course_id, chapter_id, card_id, position, front, back, source, extra)
      VALUES (${releaseId}, ${courseId}, ${chapterId}, ${card.id}, ${position}, ${card.front}, ${card.back}, ${card.source}, ${JSON.stringify(card.extra)}::jsonb)
      ON CONFLICT (release_id, course_id, card_id) DO UPDATE SET chapter_id = excluded.chapter_id, position = excluded.position, front = excluded.front, back = excluded.back, source = excluded.source, extra = excluded.extra, updated_at = now()`
  }
  invalidateEditorialCache()
  return { courseId, chapterId, count: normalized.length }
}

export async function upsertFlashcard(courseIdRaw, chapterIdRaw, value) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const chapterId = ident(chapterIdRaw, 'Chapter id')
  const card = normalizeCard(value, 0)
  const releaseId = await activeReleaseId()
  await courseExists(releaseId, courseId)
  const [existing] = await sql`SELECT position FROM editorial_flashcards WHERE release_id = ${releaseId} AND course_id = ${courseId} AND card_id = ${card.id}`
  let position = existing?.position
  if (position == null) {
    const [row] = await sql`SELECT coalesce(max(position), -1) + 1 AS next FROM editorial_flashcards WHERE release_id = ${releaseId} AND course_id = ${courseId} AND chapter_id = ${chapterId}`
    position = Number(row.next)
  }
  await sql`INSERT INTO editorial_flashcards (release_id, course_id, chapter_id, card_id, position, front, back, source, extra, updated_at)
    VALUES (${releaseId}, ${courseId}, ${chapterId}, ${card.id}, ${position}, ${card.front}, ${card.back}, ${card.source}, ${JSON.stringify(card.extra)}::jsonb, now())
    ON CONFLICT (release_id, course_id, card_id) DO UPDATE SET chapter_id = excluded.chapter_id, front = excluded.front, back = excluded.back, source = excluded.source, extra = excluded.extra, updated_at = now()`
  invalidateEditorialCache()
  return { courseId, chapterId, ...card, created: !existing }
}

export async function deleteFlashcard(courseIdRaw, cardIdRaw) {
  requireSql()
  const courseId = ident(courseIdRaw, 'Course id')
  const cardId = text(cardIdRaw, 120)
  const releaseId = await activeReleaseId()
  const rows = await sql`DELETE FROM editorial_flashcards WHERE release_id = ${releaseId} AND course_id = ${courseId} AND card_id = ${cardId} RETURNING card_id`
  if (!rows.length) throw new AdminError(`Unknown flashcard: ${courseId}/${cardId}`, 404)
  invalidateEditorialCache()
  return { courseId, id: cardId, deleted: true }
}

export async function seedFlashcardsFromTemplate(templatePath) {
  if (!sql) return { seeded: 0 }
  const releaseId = await activeReleaseId()
  const [row] = await sql`SELECT count(*)::int AS count FROM editorial_flashcards WHERE release_id = ${releaseId}`
  if (Number(row.count) > 0) return { seeded: 0, existing: Number(row.count) }
  if (!existsSync(templatePath)) return { seeded: 0 }
  let template
  try { template = JSON.parse(await readFile(templatePath, 'utf8')) } catch { return { seeded: 0 } }
  const courses = new Set((await sql`SELECT course_id FROM editorial_courses WHERE release_id = ${releaseId}`).map((r) => r.course_id))
  const positions = new Map()
  let seeded = 0
  for (const card of Array.isArray(template?.cards) ? template.cards : []) {
    if (!card?.id || !courses.has(card.courseId) || !card.chapterId || !card.front || !card.back) continue
    const key = `${card.courseId}/${card.chapterId}`
    const position = positions.get(key) || 0
    positions.set(key, position + 1)
    const { id, courseId, chapterId, front, back, source, sr, createdAt, ...extra } = card
    await sql`INSERT INTO editorial_flashcards (release_id, course_id, chapter_id, card_id, position, front, back, source, extra, created_at)
      VALUES (${releaseId}, ${courseId}, ${chapterId}, ${String(id)}, ${position}, ${front}, ${back}, ${source || 'editorial'}, ${JSON.stringify(extra)}::jsonb, ${createdAt || new Date().toISOString()}::timestamptz) ON CONFLICT DO NOTHING`
    seeded++
  }
  invalidateEditorialCache()
  return { seeded }
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

// Institution-wide academic calendar for a known programme.
export async function setProgrammeCalendar(programmeIdRaw, events, { replace = true } = {}) {
  requireSql()
  const programmeId = ident(programmeIdRaw, 'Programme id')
  const [row] = await sql`SELECT definition FROM editorial_programmes WHERE id = ${programmeId}`
  if (!row) throw new AdminError(`Unknown programme: ${programmeId}`, 404)
  const incoming = (Array.isArray(events) ? events : []).map((event, index) => ({ ...event, id: text(event?.id, 120) || `cal-${randomUUID().slice(0, 8)}-${index + 1}` }))
  const existing = replace ? [] : (row.definition.calendar || [])
  const merged = [...existing]
  const keys = new Set(existing.map((event) => `${String(event.title).toLowerCase()}|${event.date}`))
  for (const event of incoming) {
    const key = `${String(event.title || '').toLowerCase()}|${event.date}`
    if (keys.has(key)) continue
    keys.add(key)
    merged.push(event)
  }
  let normalized
  try { normalized = normalizeEditorialProgramme({ ...row.definition, id: programmeId, calendar: merged }) }
  catch (error) { throw new AdminError(error.message) }
  await sql`UPDATE editorial_programmes SET definition = ${JSON.stringify(normalized)}::jsonb, updated_at = now() WHERE id = ${programmeId}`
  await refreshProgrammeCatalogue()
  return { id: programmeId, calendar: normalized.calendar, count: normalized.calendar.length, replaced: replace }
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
