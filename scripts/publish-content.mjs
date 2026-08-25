#!/usr/bin/env node
import '../lib/env.mjs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { neon } from '@neondatabase/serverless'

const execFileAsync = promisify(execFile)
const root = resolve(new URL('..', import.meta.url).pathname)
const contentRoot = resolve(root, 'content')
const definitionPath = resolve(root, 'data/study-state.template.json')
const chunkBytes = Number(process.env.CONTENT_CHUNK_BYTES || 512 * 1024)
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = neon(process.env.DATABASE_URL)
const definitionBytes = await readFile(definitionPath)
const definition = JSON.parse(definitionBytes)

async function walk(dir) {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

function kindFor(extension) {
  if (extension === '.md') return 'markdown'
  if (extension === '.pdf') return 'pdf'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) return 'image'
  if (['.ppt', '.pptx', '.doc', '.docx'].includes(extension)) return 'office'
  if (['.c', '.h', '.s', '.py', '.m', '.ipynb', '.html', '.txt', '.tex'].includes(extension)) return 'code'
  return 'attachment'
}

function mediaType(extension) {
  return ({
    '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.json': 'application/json; charset=utf-8'
  })[extension] || 'application/octet-stream'
}

async function extractPdf(path) {
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], { maxBuffer: 64 * 1024 * 1024 })
    const pages = stdout.split('\f').map((text, index) => ({ page: index + 1, text: text.trimEnd() })).filter((page) => page.text.trim())
    return { text: pages.map((page) => page.text).join('\n\n'), pages }
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('pdftotext is required to publish PDF searchable text (install Poppler)')
    console.warn(`Could not extract ${relative(root, path)}: ${error.message}`)
    return { text: null, pages: null }
  }
}

const manifests = []
for (const course of definition.courses) {
  const courseRoot = resolve(contentRoot, course.knowledgeBase)
  if (!existsSync(courseRoot)) throw new Error(`Missing knowledge base: ${course.knowledgeBase}`)
  for (const path of await walk(courseRoot)) {
    const bytes = await readFile(path)
    manifests.push({ course, courseRoot, path, sourcePath: relative(courseRoot, path).replaceAll('\\', '/'), bytes, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
}
manifests.sort((a, b) => a.course.id.localeCompare(b.course.id) || a.sourcePath.localeCompare(b.sourcePath))
const releaseHash = createHash('sha256').update(definitionBytes).update(manifests.map((m) => `${m.course.id}\0${m.sourcePath}\0${m.sha256}`).join('\n')).digest('hex')

const migrationSource = await readFile(resolve(root, 'db/002_editorial_content.sql'), 'utf8')
for (const statement of migrationSource.split(';').map((part) => part.trim()).filter(Boolean)) await sql.query(statement)
let releases = await sql`SELECT id FROM editorial_releases WHERE source_hash = ${releaseHash}`
if (!releases.length) releases = await sql`INSERT INTO editorial_releases (source_hash, schema_version, metadata) VALUES (${releaseHash}, ${definition.meta.schemaVersion || 1}, ${JSON.stringify({ ...definition.meta, dailyBlocks: definition.dailyBlocks || [] })}::jsonb) RETURNING id`
const releaseId = releases[0].id
const existingMaterialRows = await sql`SELECT m.id, m.course_id, m.source_path, m.sha256, m.byte_size,
  coalesce(sum(octet_length(c.data)), 0)::bigint AS stored_bytes
  FROM editorial_materials m LEFT JOIN editorial_material_chunks c ON c.material_id=m.id
  WHERE m.release_id=${releaseId}
  GROUP BY m.id, m.course_id, m.source_path, m.sha256, m.byte_size`
const existingMaterials = new Map(existingMaterialRows.map((row) => [`${row.course_id}\0${row.source_path}`, row]))

for (const [position, course] of definition.courses.entries()) {
  const known = new Set(['id','code','name','shortName','exam','role','accent','knowledgeBase','visualStyle','examProfile','chapters','items','mockExams','tutorials'])
  const extra = Object.fromEntries(Object.entries(course).filter(([key]) => !known.has(key)))
  await sql`INSERT INTO editorial_courses (release_id, course_id, code, name, short_name, position, exam, role, accent, knowledge_base, visual_style, exam_profile, extra)
    VALUES (${releaseId}, ${course.id}, ${course.code}, ${course.name}, ${course.shortName || null}, ${position}, ${course.exam || null}, ${course.role || null}, ${course.accent || null}, ${course.knowledgeBase}, ${course.visualStyle || null}, ${course.examProfile || null}, ${JSON.stringify(extra)}::jsonb)
    ON CONFLICT (release_id, course_id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name, short_name=EXCLUDED.short_name, position=EXCLUDED.position, exam=EXCLUDED.exam, role=EXCLUDED.role, accent=EXCLUDED.accent, knowledge_base=EXCLUDED.knowledge_base, visual_style=EXCLUDED.visual_style, exam_profile=EXCLUDED.exam_profile, extra=EXCLUDED.extra`
  for (const [chapterPosition, chapter] of (course.chapters || []).entries()) {
    const { id, name, file, ...extraChapter } = chapter
    await sql`INSERT INTO editorial_chapters (release_id, course_id, chapter_id, name, source_path, position, extra) VALUES (${releaseId}, ${course.id}, ${id}, ${name}, ${file.replaceAll('\\','/')}, ${chapterPosition}, ${JSON.stringify(extraChapter)}::jsonb) ON CONFLICT (release_id, course_id, chapter_id) DO UPDATE SET name=EXCLUDED.name, source_path=EXCLUDED.source_path, position=EXCLUDED.position, extra=EXCLUDED.extra`
  }
  for (const [itemPosition, item] of (course.items || []).entries()) await sql`INSERT INTO editorial_items (release_id, course_id, item_id, position, definition) VALUES (${releaseId}, ${course.id}, ${item.id}, ${itemPosition}, ${JSON.stringify(item)}::jsonb) ON CONFLICT (release_id, course_id, item_id) DO UPDATE SET position=EXCLUDED.position, definition=EXCLUDED.definition`
  for (const [paperType, collection] of [['mock-exam', course.mockExams || []], ['tutorial', course.tutorials || []]]) {
    for (const [paperPosition, paper] of collection.entries()) {
      const { id, label, pdf, solutionsPdf, ...extraPaper } = paper
      await sql`INSERT INTO editorial_papers (release_id, course_id, paper_id, paper_type, position, label, question_path, solutions_path, extra) VALUES (${releaseId}, ${course.id}, ${id}, ${paperType}, ${paperPosition}, ${label}, ${pdf || null}, ${solutionsPdf || null}, ${JSON.stringify(extraPaper)}::jsonb) ON CONFLICT (release_id, course_id, paper_type, paper_id) DO UPDATE SET position=EXCLUDED.position, label=EXCLUDED.label, question_path=EXCLUDED.question_path, solutions_path=EXCLUDED.solutions_path, extra=EXCLUDED.extra`
    }
  }
}

let completed = 0
for (const manifest of manifests) {
  const extension = extname(manifest.path).toLowerCase()
  const kind = kindFor(extension)
  const isText = ['markdown', 'code'].includes(kind) && !manifest.bytes.includes(0)
  const existing = existingMaterials.get(`${manifest.course.id}\0${manifest.sourcePath}`)
  let materialId
  let startOffset = null
  if (existing && existing.sha256 === manifest.sha256 && Number(existing.byte_size) === manifest.bytes.length && Number(existing.stored_bytes) === manifest.bytes.length) {
    materialId = existing.id
  } else if (existing && existing.sha256 === manifest.sha256 && Number(existing.byte_size) === manifest.bytes.length && Number(existing.stored_bytes) < manifest.bytes.length && Number(existing.stored_bytes) % chunkBytes === 0) {
    materialId = existing.id
    startOffset = Number(existing.stored_bytes)
  } else {
    const extracted = kind === 'pdf' ? await extractPdf(manifest.path) : { text: null, pages: null }
    const rows = await sql`INSERT INTO editorial_materials (release_id, course_id, source_path, kind, media_type, byte_size, sha256, text_content, extracted_text, extracted_pages)
      VALUES (${releaseId}, ${manifest.course.id}, ${manifest.sourcePath}, ${kind}, ${mediaType(extension)}, ${manifest.bytes.length}, ${manifest.sha256}, ${isText ? manifest.bytes.toString('utf8') : null}, ${extracted.text}, ${extracted.pages ? JSON.stringify(extracted.pages) : null}::jsonb)
      ON CONFLICT (release_id, course_id, source_path) DO UPDATE SET kind=EXCLUDED.kind, media_type=EXCLUDED.media_type, byte_size=EXCLUDED.byte_size, sha256=EXCLUDED.sha256, text_content=EXCLUDED.text_content, extracted_text=EXCLUDED.extracted_text, extracted_pages=EXCLUDED.extracted_pages RETURNING id`
    materialId = rows[0].id
    await sql`DELETE FROM editorial_material_chunks WHERE material_id=${materialId}`
    startOffset = 0
  }
  if (startOffset !== null) {
    for (let offset = startOffset, index = startOffset / chunkBytes; offset < manifest.bytes.length; offset += chunkBytes, index++) {
      const chunk = manifest.bytes.subarray(offset, Math.min(offset + chunkBytes, manifest.bytes.length))
      let inserted = false
      for (let attempt = 1; attempt <= 5 && !inserted; attempt++) {
        try {
          await sql`INSERT INTO editorial_material_chunks (material_id, chunk_index, data) VALUES (${materialId}, ${index}, ${chunk}) ON CONFLICT (material_id, chunk_index) DO NOTHING`
          inserted = true
        } catch (error) {
          if (attempt === 5) throw error
          await sleep(attempt * 2000)
        }
      }
      await sleep(40)
    }
  }
  completed++
  if (completed % 10 === 0 || completed === manifests.length) console.log(`Published ${completed}/${manifests.length} files`)
}

await sql.transaction([
  sql`UPDATE editorial_releases SET active=FALSE WHERE active=TRUE AND id<>${releaseId}`,
  sql`UPDATE editorial_releases SET active=TRUE, activated_at=now() WHERE id=${releaseId}`
])
console.log(`Activated editorial release ${releaseId} (${releaseHash.slice(0, 12)}), ${manifests.length} files.`)
