import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { decorateCanvasCourses } from './canvas-hub.mjs'
import { importCanvasCourse, listCanvasCourses } from './canvas-course-import.mjs'
import { observeCanvasCorpusCourses } from './course-corpus.mjs'
import { sql } from './db.mjs'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'
import { extractPdfText } from './editorial-admin.mjs'

const MAX_FILE_BYTES = Number(process.env.CANVAS_CORPUS_MAX_FILE_BYTES || 100 * 1024 * 1024)
const MAX_COURSE_BYTES = Number(process.env.CANVAS_CORPUS_MAX_COURSE_BYTES || 750 * 1024 * 1024)
const REFRESH_DAYS = Math.max(1, Number(process.env.CANVAS_CORPUS_REFRESH_DAYS || 1))
const BYTE_CHUNK = 512 * 1024

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
function sourceTypeForPath(sourcePath) {
  const path = String(sourcePath || '').toLowerCase()
  if (/syllabus|course[_ -]?manual|study[_ -]?guide/.test(path)) return 'syllabus'
  if (/requirement|assessment[_ -]?plan|grading|rubric|learning[_ -]?outcome/.test(path)) return 'requirements'
  if (/slide|lecture|presentation|\.pptx?$/.test(path)) return 'slides'
  if (/exam|quiz|assignment|question|mock|practice/.test(path)) return 'assessments'
  if (/activity|tutorial|lab|workshop/.test(path)) return 'activities'
  if (/reading|article|paper|literature/.test(path)) return 'readings'
  return 'materials'
}
const plainHtml = (value) => String(value || '')
  .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'")
  .replace(/\s+/g, ' ').trim()

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

async function filesUnder(root) {
  const files = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.wicker-canvas-import.json' || entry.name === 'README.md') continue
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push({ path, sourcePath: relative(root, path).split(sep).join('/') })
    }
  }
  await visit(root)
  return files
}

async function extracted(bytes, sourcePath) {
  const extension = extname(sourcePath).toLowerCase()
  if (extension === '.pdf') {
    const result = await extractPdfText(bytes)
    return { text: result.text, pages: result.pages, status: result.pages?.length ? 'complete' : result.available ? 'failed' : 'unsupported', error: result.pages?.length ? null : result.reason }
  }
  if (['.md', '.txt', '.csv', '.tex', '.py', '.r', '.m', '.html', '.htm'].includes(extension) && !bytes.includes(0)) {
    const raw = bytes.toString('utf8')
    return { text: ['.html', '.htm'].includes(extension) ? plainHtml(raw) : raw, pages: null, status: 'complete', error: null }
  }
  return { text: null, pages: null, status: 'unsupported', error: null }
}

async function indexAsset({ editionId, assetId, sourcePath, extraction }) {
  await sql`DELETE FROM editorial_source_retrieval_chunks WHERE edition_id=${editionId} AND asset_id=${assetId}`
  const units = Array.isArray(extraction.pages) && extraction.pages.length
    ? extraction.pages.map((page) => ({ page: Number(page.page), text: page.text }))
    : extraction.text ? [{ page: null, text: extraction.text }] : []
  const records = units.flatMap((unit) => chunkText(unit.text).map((content, chunkIndex) => ({ page: unit.page, chunkIndex, content })))
  const embedding = embeddingConfiguration()
  for (let offset = 0; offset < records.length; offset += 64) {
    const batch = records.slice(offset, offset + 64)
    let vectors = batch.map(() => null)
    if (embedding.configured) {
      try { vectors = await embedTexts(batch.map((record) => record.content)) } catch { /* FTS remains available; a later backfill can retry vectors. */ }
    }
    for (const [index, record] of batch.entries()) {
      const vector = vectors[index] ? `[${vectors[index].join(',')}]` : null
      await sql`INSERT INTO editorial_source_retrieval_chunks
        (edition_id, asset_id, page_number, chunk_index, content, metadata, embedding, embedding_model, embedded_at)
        VALUES (${editionId}, ${assetId}, ${record.page}, ${record.chunkIndex}, ${record.content}, ${JSON.stringify({ sourcePath })}::jsonb,
          ${vector}::vector, ${vector ? embedding.model : null}, ${vector ? new Date().toISOString() : null}::timestamptz)`
    }
  }
  return records.length
}

async function ingestFile({ binding, accountId, file }) {
  const bytes = await readFile(file.path)
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return { skipped: true, path: file.sourcePath, reason: !bytes.length ? 'empty' : 'file limit' }
  const hash = sha256(bytes)
  const extension = extname(file.sourcePath).toLowerCase()
  const extraction = await extracted(bytes, file.sourcePath)
  const contentHash = extraction.text ? sha256(extraction.text) : null
  const assetId = `esa-${hash.slice(0, 32)}`
  const mediaType = extension === '.pdf' ? 'application/pdf' : ['.html', '.htm'].includes(extension) ? 'text/html' : 'application/octet-stream'
  await sql`INSERT INTO editorial_source_assets
    (id, sha256, content_sha256, filename, media_type, byte_size, source_kind, expected_chunks, is_complete, extraction_status, extraction_error, extracted_text, extracted_pages, metadata, created_by, updated_at)
    VALUES (${assetId}, ${hash}, ${contentHash}, ${file.sourcePath.split('/').at(-1)}, ${mediaType}, ${bytes.length}, 'file', ${Math.ceil(bytes.length / BYTE_CHUNK)}, true,
      ${extraction.status}, ${extraction.error}, ${extraction.text}, ${extraction.pages ? JSON.stringify(extraction.pages) : null}::jsonb,
      ${JSON.stringify({ source: 'canvas-auto-sync', origin: binding.origin })}::jsonb, ${accountId}, now())
    ON CONFLICT (sha256) DO UPDATE SET content_sha256=coalesce(editorial_source_assets.content_sha256, excluded.content_sha256), extraction_status=CASE WHEN editorial_source_assets.extraction_status='complete' THEN editorial_source_assets.extraction_status ELSE excluded.extraction_status END, updated_at=now()`
  const [stored] = await sql`SELECT id, extraction_status FROM editorial_source_assets WHERE sha256=${hash}`
  for (let offset = 0, chunkIndex = 0; offset < bytes.length; offset += BYTE_CHUNK, chunkIndex++) {
    await sql`INSERT INTO editorial_source_asset_chunks (asset_id, chunk_index, data)
      VALUES (${stored.id}, ${chunkIndex}, ${bytes.subarray(offset, Math.min(offset + BYTE_CHUNK, bytes.length))}) ON CONFLICT DO NOTHING`
  }
  const [permission] = await sql`SELECT sharing_mode FROM canvas_corpus_permissions WHERE user_id=${accountId} AND origin=${binding.origin} AND collection_enabled=true`
  if (!permission) throw new Error('Canvas material collection permission is no longer active.')
  const contributionId = `ec-${sha256(`${binding.edition_id}:${stored.id}:${accountId}:${file.sourcePath}`).slice(0, 32)}`
  await sql`INSERT INTO editorial_contributions
    (id, edition_id, asset_id, contributor_user_id, source_path, consent_status, rights_basis)
    VALUES (${contributionId}, ${binding.edition_id}, ${stored.id}, ${accountId}, ${file.sourcePath}, ${permission.sharing_mode === 'community' ? 'candidate' : 'private'},
      ${permission.sharing_mode === 'community' ? 'Student explicitly allowed community sharing; administrator rights review is still required.' : 'Private Canvas corpus; usable only by the contributing account.'})
    ON CONFLICT DO NOTHING`
  await sql`UPDATE canvas_source_snapshots SET retired_at=now()
    WHERE binding_id=${binding.id} AND contributor_user_id=${accountId} AND resource_key=${file.sourcePath} AND sha256<>${hash} AND retired_at IS NULL`
  const snapshotId = `css-${sha256(`${binding.id}:${file.sourcePath}:${hash}:${accountId}`).slice(0, 32)}`
  await sql`INSERT INTO canvas_source_snapshots
    (id, binding_id, asset_id, contribution_id, contributor_user_id, sharing_mode, resource_key, source_path, resource_type, sha256, last_seen_at, metadata)
    VALUES (${snapshotId}, ${binding.id}, ${stored.id}, ${contributionId}, ${accountId}, ${permission.sharing_mode}, ${file.sourcePath}, ${file.sourcePath}, ${sourceTypeForPath(file.sourcePath)}, ${hash}, now(), ${JSON.stringify({ academicYear: binding.academic_year, courseCode: binding.course_code, extension: extension.slice(1) || null })}::jsonb)
    ON CONFLICT (binding_id, resource_key, sha256, contributor_user_id) DO UPDATE SET last_seen_at=now(), retired_at=null,
      sharing_mode=excluded.sharing_mode, contribution_id=excluded.contribution_id`
  const [indexed] = await sql`SELECT count(*)::int AS count FROM editorial_source_retrieval_chunks WHERE edition_id=${binding.edition_id} AND asset_id=${stored.id}`
  const chunks = Number(indexed?.count) || await indexAsset({ editionId: binding.edition_id, assetId: stored.id, sourcePath: file.sourcePath, extraction })
  return { skipped: false, path: file.sourcePath, sha256: hash, chunks }
}

async function runCatalog(job) {
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: job.origin })
  const catalog = await listCanvasCourses({ canvasUrl: job.origin, accessToken: token })
  const courses = decorateCanvasCourses(catalog.courses)
  return observeCanvasCorpusCourses({ accountId: job.user_id, origin: job.origin, courses })
}

async function runCourse(job) {
  const [binding] = await sql`SELECT * FROM canvas_course_bindings WHERE id=${job.binding_id}`
  if (!binding) throw new Error('Canvas corpus binding no longer exists.')
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: job.origin })
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-corpus-'))
  try {
    const imported = await importCanvasCourse({ courseUrl: `${job.origin}/courses/${binding.canvas_course_id}/modules`, accessToken: token, outputFolder: root, maxFileBytes: MAX_FILE_BYTES })
    const files = await filesUnder(root)
    let total = 0
    const results = []
    for (const file of files) {
      const bytes = await readFile(file.path)
      total += bytes.length
      if (total > MAX_COURSE_BYTES) { results.push({ skipped: true, path: file.sourcePath, reason: 'course byte limit' }); continue }
      results.push(await ingestFile({ binding, accountId: job.user_id, file }))
    }
    const present = results.filter((result) => !result.skipped).map((result) => result.path)
    await sql`UPDATE canvas_source_snapshots SET retired_at=now() WHERE binding_id=${binding.id} AND contributor_user_id=${job.user_id} AND retired_at IS NULL AND NOT (resource_key = ANY(${present}::text[]))`
    const manifestHash = sha256(results.filter((result) => !result.skipped).map((result) => `${result.path}:${result.sha256}`).sort().join('\n'))
    await sql`UPDATE canvas_course_bindings SET manifest_hash=${manifestHash}, last_synced_at=now(), next_sync_at=now() + make_interval(days => ${REFRESH_DAYS}), updated_at=now() WHERE id=${binding.id}`
    return { course: imported.course, files: results.length, indexed: results.filter((result) => !result.skipped).length, skipped: results.filter((result) => result.skipped).length, manifestHash }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export async function processNextCanvasCorpusJob() {
  if (!sql) return null
  const rows = await sql`UPDATE canvas_sync_jobs SET status='running', started_at=now(), attempts=attempts+1
    WHERE id=(SELECT id FROM canvas_sync_jobs WHERE status='pending' AND run_after<=now() ORDER BY priority DESC, created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING *`
  const job = rows[0]
  if (!job) return null
  try {
    const result = job.job_type === 'catalog' ? await runCatalog(job) : await runCourse(job)
    await sql`UPDATE canvas_sync_jobs SET status='completed', result=${JSON.stringify(result)}::jsonb, error=null, finished_at=now() WHERE id=${job.id}`
    return { id: job.id, status: 'completed', result }
  } catch (error) {
    const retry = Number(job.attempts) < 3
    await sql`UPDATE canvas_sync_jobs SET status=${retry ? 'pending' : 'failed'}, error=${String(error?.message || error).slice(0, 2000)}, run_after=now() + make_interval(mins => ${retry ? Number(job.attempts) * 5 : 0}), finished_at=${retry ? null : new Date().toISOString()}::timestamptz WHERE id=${job.id}`
    return { id: job.id, status: retry ? 'pending' : 'failed', error: String(error?.message || error) }
  }
}

let timer = null
let running = false
export function startCanvasCorpusWorker({ intervalMs = 15_000 } = {}) {
  if (!sql || timer) return false
  const tick = async () => {
    if (running) return
    running = true
    try {
      while (await processNextCanvasCorpusJob()) { /* drain the bounded persistent queue */ }
    } catch (error) {
      console.error('Canvas corpus worker tick failed:', error)
    } finally { running = false }
  }
  timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  void tick()
  return true
}
