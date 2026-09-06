import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
const execFileAsync = promisify(execFileCallback)
import { createCanvasSyncLogger } from './canvas-sync-log.mjs'
import { chatAvailable } from './model-loop.mjs'
import { withCanvasJobLease } from './canvas-job-lease.mjs'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { decorateCanvasCourses } from './canvas-hub.mjs'
import { CANVAS_IMPORT_LIMITS, importCanvasCourse, listCanvasCourses } from './canvas-course-import.mjs'
import { isSupportedCanvasCourse, observeCanvasCorpusCourses, retireUnsupportedCanvasCorpusCourses } from './course-corpus.mjs'
import { sql } from './db.mjs'
import { embedTexts, embeddingConfiguration } from './embeddings.mjs'
import { extractPdfText } from './editorial-admin.mjs'
import { extractOffice } from './editorial-workflow.mjs'
import { scanCanvasPriorityEvidence } from './priority-evidence.mjs'
import { promoteReviewedProgrammePolicyAsset } from './programme-policy-sources.mjs'

// The worker may choose a stricter deployment limit, but can never exceed the
// importer's own hard ceiling. The old 2 GB default violated that 1 GB ceiling
// and caused every course job to fail before it touched Canvas.
const configuredFileBytes = Number(process.env.CANVAS_CORPUS_MAX_FILE_BYTES || CANVAS_IMPORT_LIMITS.maxFileBytes)
const MAX_FILE_BYTES = Math.min(CANVAS_IMPORT_LIMITS.maxFileBytes, Number.isFinite(configuredFileBytes) ? configuredFileBytes : CANVAS_IMPORT_LIMITS.maxFileBytes)
const MAX_COURSE_BYTES = Number(process.env.CANVAS_CORPUS_MAX_COURSE_BYTES || 10 * 1024 * 1024 * 1024)
const REFRESH_DAYS = Math.max(1, Number(process.env.CANVAS_CORPUS_REFRESH_DAYS || 1))
const FAILURE_COOLDOWN_HOURS = Math.max(1, Number(process.env.CANVAS_CORPUS_FAILURE_COOLDOWN_HOURS || 6))
const BYTE_CHUNK = 512 * 1024
const LOCAL_ASSET_DIR = resolve(process.env.CANVAS_CORPUS_ASSET_DIR || 'data/corpus-assets')
let reconciledExistingAccess = false

export const MEDIA_TYPES = new Map([
  ['.pdf', 'application/pdf'], ['.doc', 'application/msword'], ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.ppt', 'application/vnd.ms-powerpoint'], ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.xls', 'application/vnd.ms-excel'], ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.mp4', 'video/mp4'], ['.m4v', 'video/x-m4v'], ['.webm', 'video/webm'], ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'], ['.m4a', 'audio/mp4'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg'],
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'], ['.md', 'text/markdown; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'], ['.csv', 'text/csv; charset=utf-8'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.svg', 'image/svg+xml']
])

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export function sourceTypeForPath(sourcePath) {
  const path = String(sourcePath || '').toLowerCase()
  if (/syllabus|course[_ -]?manual|study[_ -]?guide/.test(path)) return 'syllabus'
  if (/(^|\/)(course-pages|linked-pages|pages)(\/|$)|page-/.test(path)) return 'pages'
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
      // Search only this passage. Searching the entire prefix is quadratic
      // for numeric datasets and other documents without prose boundaries.
      const window = normalized.slice(start, end)
      const boundary = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '))
      if (boundary > Math.floor(target * 0.6)) end = start + boundary + 1
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

export async function extracted(bytes, sourcePath) {
  const extension = extname(sourcePath).toLowerCase()
  if (['.xlsx', '.ipynb', '.zip'].includes(extension) || (extension === '.csv' && bytes.length > 1024 * 1024)) {
    const directory = await mkdtemp(join(tmpdir(), 'canvas-structured-text-'))
    try {
      const path = join(directory, 'source')
      await writeFile(path, bytes)
      const { stdout } = await execFileAsync('python3', [new URL('../scripts/extract-course-text.py', import.meta.url).pathname, path, sourcePath], { timeout: 90_000, maxBuffer: 32 * 1024 * 1024 })
      return JSON.parse(stdout)
    } catch (error) { return { text: null, pages: null, status: 'failed', error: String(error.message).slice(0, 500) } }
    finally { await rm(directory, { recursive: true, force: true }) }
  }
  if (extension === '.pdf') {
    const result = await extractPdfText(bytes)
    return { text: result.text, pages: result.pages, status: result.pages?.length ? 'complete' : result.available ? 'failed' : 'unsupported', error: result.pages?.length ? null : result.reason }
  }
  if (['.docx', '.pptx'].includes(extension)) {
    try { const result = await extractOffice(bytes, extension); return { ...result, status: result.text ? 'complete' : 'failed', error: result.text ? null : 'No readable document text.' } }
    catch (error) { return { text: null, pages: null, status: 'failed', error: String(error.message).slice(0, 500) } }
  }
  if (['.md', '.txt', '.csv', '.tex', '.py', '.r', '.m', '.html', '.htm'].includes(extension) && !bytes.includes(0)) {
    const raw = bytes.toString('utf8')
    return { text: ['.html', '.htm'].includes(extension) ? plainHtml(raw) : raw, pages: null, status: 'complete', error: null }
  }
  return { text: null, pages: null, status: 'unsupported', error: null }
}

export function retrievalRecords(extraction) {
  const units = Array.isArray(extraction.pages) && extraction.pages.length
    ? extraction.pages.map((page) => ({ page: Number(page.page), text: page.text }))
    : extraction.text ? [{ page: null, text: extraction.text }] : []
  return units.flatMap((unit) => chunkText(unit.text).map((content, chunkIndex) => ({ page: unit.page, chunkIndex, content })))
}

async function indexAsset({ editionId, assetId, sourcePath, extraction, assertActive, job }) {
  const inserts = []
  const records = retrievalRecords(extraction)
  const embedding = embeddingConfiguration()
  for (let offset = 0; offset < records.length; offset += 64) {
    job.log({ stage: 'indexing', message: 'Preparing search index batch.', item: sourcePath, completed: offset, total: records.length })
    const batch = records.slice(offset, offset + 64)
    let vectors = batch.map(() => null)
    if (embedding.configured) {
      try { vectors = await embedTexts(batch.map((record) => record.content)) } catch { job.log({ stage: 'indexing', level: 'warning', message: 'Semantic indexing unavailable for this batch. Text search remains available.', item: sourcePath }) }
    }
    for (const [index, record] of batch.entries()) {
      assertActive()
      const vector = vectors[index] ? `[${vectors[index].join(',')}]` : null
      inserts.push(sql`INSERT INTO editorial_source_retrieval_chunks
        (edition_id, asset_id, page_number, chunk_index, content, metadata, embedding, embedding_model, embedded_at)
        SELECT ${editionId}, ${assetId}, ${record.page}, ${record.chunkIndex}, ${record.content}, ${JSON.stringify({ sourcePath })}::jsonb,
          ${vector}::vector, ${vector ? embedding.model : null}, ${vector ? new Date().toISOString() : null}::timestamptz
        WHERE EXISTS (SELECT 1 FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running')`)
    }
  }
  assertActive()
  // Prepare embeddings first, then replace the entire index atomically. Lock
  // ownership for the short swap so cancellation/recovery cannot interleave.
  await sql.transaction([
    sql`SELECT id FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running' FOR UPDATE`,
    sql`DELETE FROM editorial_source_retrieval_chunks WHERE edition_id=${editionId} AND asset_id=${assetId}
      AND EXISTS (SELECT 1 FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running')`,
    ...inserts
  ])
  return records.length
}

async function ingestFile({ binding, accountId, file, assertActive, job }) {
  const bytes = await readFile(file.path)
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) return { skipped: true, path: file.sourcePath, reason: !bytes.length ? 'empty' : 'file limit' }
  const hash = sha256(bytes)
  const extension = extname(file.sourcePath).toLowerCase()
  job.log({ stage: 'extraction', message: 'Reading document text.', item: file.sourcePath })
  const extraction = await extracted(bytes, file.sourcePath)
  job.log({ stage: 'extraction', level: extraction.status === 'complete' ? 'info' : 'warning', message: extraction.status === 'complete' ? 'Document text read.' : extraction.status === 'unsupported' ? 'Text extraction is not supported for this file format.' : 'No readable text extracted.', item: file.sourcePath })
  assertActive()
  const contentHash = extraction.text ? sha256(extraction.text) : null
  const assetId = `esa-${hash.slice(0, 32)}`
  const mediaType = MEDIA_TYPES.get(extension) || 'application/octet-stream'
  const localObjectKey = /^(video|audio)\//.test(mediaType) ? hash : null
  if (localObjectKey) {
    await mkdir(LOCAL_ASSET_DIR, { recursive: true })
    try { await writeFile(join(LOCAL_ASSET_DIR, localObjectKey), bytes, { flag: 'wx', mode: 0o600 }) } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  const expectedChunks = localObjectKey ? 0 : Math.ceil(bytes.length / BYTE_CHUNK)
  const assetMetadata = { source: 'canvas-auto-sync', origin: binding.origin, ...(localObjectKey ? { localObjectKey } : {}) }
  await sql`INSERT INTO editorial_source_assets
    (id, sha256, content_sha256, filename, media_type, byte_size, source_kind, expected_chunks, is_complete, extraction_status, extraction_error, extracted_text, extracted_pages, metadata, created_by, updated_at)
    VALUES (${assetId}, ${hash}, ${contentHash}, ${file.sourcePath.split('/').at(-1)}, ${mediaType}, ${bytes.length}, 'file', ${expectedChunks}, true,
      ${extraction.status}, ${extraction.error}, ${extraction.text}, ${extraction.pages ? JSON.stringify(extraction.pages) : null}::jsonb,
      ${JSON.stringify(assetMetadata)}::jsonb, ${accountId}, now())
    ON CONFLICT (sha256) DO UPDATE SET content_sha256=coalesce(editorial_source_assets.content_sha256, excluded.content_sha256),
      media_type=excluded.media_type, metadata=editorial_source_assets.metadata || excluded.metadata,
      extracted_text=coalesce(editorial_source_assets.extracted_text, excluded.extracted_text), extracted_pages=coalesce(editorial_source_assets.extracted_pages, excluded.extracted_pages),
      extraction_status=CASE WHEN editorial_source_assets.extraction_status='complete' THEN editorial_source_assets.extraction_status ELSE excluded.extraction_status END, updated_at=now()`
  const [stored] = await sql`SELECT id, extraction_status FROM editorial_source_assets WHERE sha256=${hash}`
  for (let offset = 0, chunkIndex = 0; !localObjectKey && offset < bytes.length; offset += BYTE_CHUNK, chunkIndex++) {
    assertActive()
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
  const expected = retrievalRecords(extraction).length
  job.log({ stage: 'indexing', message: 'Preparing searchable passages.', item: file.sourcePath, total: expected })
  const chunks = Number(indexed?.count) === expected ? expected : await indexAsset({ editionId: binding.edition_id, assetId: stored.id, sourcePath: file.sourcePath, extraction, assertActive, job })
  job.log({ stage: 'indexing', message: 'Search index ready.', item: file.sourcePath, completed: chunks, total: expected })
  const policy = await promoteReviewedProgrammePolicyAsset({ assetId: stored.id, sha256: hash, editionId: binding.edition_id })
  return { skipped: false, path: file.sourcePath, sha256: hash, chunks, policy: policy?.sourceId || null }
}

export async function runCatalog(job, assertActive) {
  job.log({ stage: 'discovery', message: 'Checking enrolled Canvas course editions.' })
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: job.origin })
  const catalog = await listCanvasCourses({ canvasUrl: job.origin, accessToken: token })
  const courses = decorateCanvasCourses(catalog.courses)
  assertActive()
  job.log({ stage: 'discovery', message: 'Course editions discovered. Scheduling material collection.', completed: courses.length })
  return observeCanvasCorpusCourses({ accountId: job.user_id, origin: job.origin, courses, force: job.payload?.force === true, syncId: job.payload?.syncId || job.id })
}

async function runCourse(job, assertActive) {
  const [binding] = await sql`SELECT * FROM canvas_course_bindings WHERE id=${job.binding_id}`
  if (!binding) throw new Error('Canvas corpus binding no longer exists.')
  if (!isSupportedCanvasCourse({ courseCode: binding.course_code, name: binding.course_name })) {
    await retireUnsupportedCanvasCorpusCourses({
      accountId: job.user_id,
      origin: job.origin,
      courses: [{ id: binding.canvas_course_id, courseCode: binding.course_code, name: binding.course_name }]
    })
    return { ignored: true, reason: 'not-supported-academic-course' }
  }
  const scanPriorities = async () => {
    job.log({ stage: 'rules', message: 'Reading syllabus and introductory material for course requirements.' })
    try {
      const priorities = await scanCanvasPriorityEvidence({ bindingId: binding.id, accountId: job.user_id, force: job.payload?.force === true || job.payload?.stage === 'priorities', assertActive, onProgress: event => job.log(event) })
      job.log({ stage: 'rules', level: priorities.status === 'needs-review' ? 'warning' : 'info', message: priorities.status === 'needs-review' ? 'Course-rule extraction needs review. Material remains searchable.' : 'Course-rule scan finished.', completed: priorities.candidates })
      return { status: priorities.status, candidates: priorities.candidates, conflicts: priorities.conflicts?.length || 0 }
    } catch (error) {
      assertActive()
      job.log({ stage: 'rules', level: 'warning', message: 'Course-rule extraction failed. Retry the scan from Canvas sync.' })
      return { status: 'needs-review', candidates: 0, conflicts: 0, error: String(error?.message || error).slice(0, 500) }
    }
  }
  // Deployments may find a pending retry created by the old worker after the
  // archive succeeded but priority extraction returned invalid JSON. Resume
  // only that derived stage; never download and index the course twice.
  if ((job.payload?.stage === 'priorities' || /^Priority scan returned no JSON object\.?$/i.test(String(job.previous_error || ''))) && binding.last_synced_at) {
    return {
      course: { id: binding.canvas_course_id, name: binding.course_name, code: binding.course_code },
      files: 0,
      indexed: 0,
      skipped: 0,
      reusedImport: true,
      priorities: await scanPriorities()
    }
  }
  const { token } = await canvasAccessTokenForUser({ accountId: job.user_id, canvasUrl: job.origin })
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-corpus-'))
  try {
    const imported = await importCanvasCourse({ courseUrl: `${job.origin}/courses/${binding.canvas_course_id}/modules`, accessToken: token, outputFolder: root, maxFileBytes: MAX_FILE_BYTES, onProgress: async event => { assertActive(); job.log(event) } })
    const files = await filesUnder(root)
    job.log({ stage: 'download', level: imported.skipped.length ? 'warning' : 'info', message: imported.skipped.length ? `Collection finished with ${imported.skipped.length} skipped resources.` : 'Collection finished.', completed: imported.downloadedFiles })
    job.log({ stage: 'extraction', message: 'Processing collected files.', completed: 0, total: files.length })
    let total = 0
    const results = []
    for (const file of files) {
      assertActive()
      const bytes = await readFile(file.path)
      total += bytes.length
      if (total > MAX_COURSE_BYTES) { results.push({ skipped: true, path: file.sourcePath, reason: 'course byte limit' }); job.log({ stage: 'extraction', level: 'warning', message: 'File skipped: course storage limit reached.', item: file.sourcePath }); continue }
      results.push(await ingestFile({ binding, accountId: job.user_id, file, assertActive, job }))
      job.log({ stage: 'indexing', message: 'Collected files processed.', completed: results.length, total: files.length })
    }
    assertActive()
    const present = results.filter((result) => !result.skipped).map((result) => result.path)
    await sql`UPDATE canvas_source_snapshots SET retired_at=now() WHERE binding_id=${binding.id} AND contributor_user_id=${job.user_id} AND retired_at IS NULL AND NOT (resource_key = ANY(${present}::text[])) AND EXISTS (SELECT 1 FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running')`
    const manifestHash = sha256(results.filter((result) => !result.skipped).map((result) => `${result.path}:${result.sha256}`).sort().join('\n'))
    await sql`UPDATE canvas_course_bindings SET manifest_hash=${manifestHash}, last_synced_at=now(), next_sync_at=now() + make_interval(days => ${REFRESH_DAYS}), updated_at=now() WHERE id=${binding.id} AND EXISTS (SELECT 1 FROM canvas_sync_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='running')`
    assertActive()
    const priorities = await scanPriorities()
    return { course: imported.course, files: results.length, indexed: results.filter((result) => !result.skipped).length, skipped: results.filter((result) => result.skipped).length, manifestHash, priorities }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export async function scheduleDueRefreshes() {
  // Older workers treated every active Canvas enrollment as a course, so a
  // deployment may inherit access rows for faculty and communication spaces.
  // Reconcile those once at worker startup rather than waiting for tomorrow's
  // catalogue refresh or asking the student to press Refresh.
  if (!reconciledExistingAccess) {
    // A preview with a different encryption key may have consumed shared
    // production jobs. Retry only after this worker can decrypt that account.
    const connectionFailures = await sql`SELECT DISTINCT user_id, origin FROM canvas_sync_jobs
      WHERE status IN ('failed','pending') AND error='The stored Canvas connection could not be read. Reconnect Canvas to replace it.'`
    for (const failed of connectionFailures) {
      try {
        await canvasAccessTokenForUser({ accountId: failed.user_id, canvasUrl: failed.origin })
        await sql`UPDATE canvas_sync_jobs SET status='pending', attempts=least(attempts, 2), priority=greatest(priority, 110),
          error=null, run_after=now(), finished_at=null, lease_token=null, heartbeat_at=null
          WHERE user_id=${failed.user_id} AND origin=${failed.origin} AND status IN ('failed','pending')
            AND error='The stored Canvas connection could not be read. Reconnect Canvas to replace it.'`
      } catch { /* Keep the visible connection error until credentials work. */ }
    }
    const rows = await sql`SELECT access.user_id, binding.origin, binding.canvas_course_id, binding.course_code, binding.course_name
      FROM canvas_corpus_access access JOIN canvas_course_bindings binding ON binding.id=access.binding_id`
    const ignoredByAccount = new Map()
    for (const row of rows) {
      const course = { id: row.canvas_course_id, courseCode: row.course_code, name: row.course_name }
      if (isSupportedCanvasCourse(course)) continue
      const key = `${row.user_id}\u0000${row.origin}`
      const held = ignoredByAccount.get(key) || { accountId: row.user_id, origin: row.origin, courses: [] }
      held.courses.push(course)
      ignoredByAccount.set(key, held)
    }
    for (const ignored of ignoredByAccount.values()) await retireUnsupportedCanvasCorpusCourses(ignored)
    reconciledExistingAccess = true
  }
  // Revisit derived rules independently of a full download after extractor
  // upgrades or transient failures. The evidence cache bounds repeated work.
  await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, binding_id, job_type, priority, payload)
    SELECT concat('csj-', gen_random_uuid()), access.user_id, binding.origin, binding.id, 'course', 60, '{"stage":"priorities"}'::jsonb
    FROM canvas_corpus_access access
    JOIN canvas_course_bindings binding ON binding.id=access.binding_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=access.user_id AND permission.origin=binding.origin AND permission.collection_enabled=true
    LEFT JOIN LATERAL (SELECT status, course_profile, conflicts, scanned_at FROM canvas_priority_scans
      WHERE binding_id=binding.id AND user_id=access.user_id ORDER BY scanned_at DESC LIMIT 1) scan ON true
    WHERE access.sync_paused=false AND binding.last_synced_at IS NOT NULL
      AND (scan.scanned_at IS NULL OR coalesce(scan.course_profile->>'priorityExtractionVersion', '') <> '2'
        OR (scan.status='needs-review' AND scan.scanned_at < now() - interval '6 hours')
        OR (${chatAvailable()} AND scan.conflicts @> '[{"title":"Priority evidence needs review"}]'::jsonb))
      AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs recent WHERE recent.user_id=access.user_id AND recent.binding_id=binding.id AND recent.created_at > now() - interval '1 hour' AND recent.payload->>'stage'='priorities'
        AND NOT (${chatAvailable()} AND scan.conflicts @> '[{"title":"Priority evidence needs review"}]'::jsonb))
    ON CONFLICT DO NOTHING`
  // Permissions are the durable opt-in. Refresh the Canvas catalogue daily so
  // new courses are discovered, then refresh every observed course when its
  // own next_sync_at expires. Partial unique indexes make this safe on every
  // worker tick and across several worker processes.
  await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, job_type, priority, payload)
    SELECT concat('csj-', gen_random_uuid()), p.user_id, p.origin, 'catalog', 45, '{}'::jsonb
    FROM canvas_corpus_permissions p
    WHERE p.collection_enabled=true
      AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs active WHERE active.user_id=p.user_id AND active.origin=p.origin AND active.job_type='catalog' AND active.status IN ('pending','running'))
      AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs recent WHERE recent.user_id=p.user_id AND recent.origin=p.origin AND recent.job_type='catalog' AND recent.created_at > now() - interval '1 day')
    ON CONFLICT DO NOTHING`
  await sql`INSERT INTO canvas_sync_jobs (id, user_id, origin, binding_id, job_type, priority, payload)
    SELECT concat('csj-', gen_random_uuid()), access.user_id, binding.origin, binding.id, 'course', 55, '{"scheduled":true}'::jsonb
    FROM canvas_corpus_access access
    JOIN canvas_course_bindings binding ON binding.id=access.binding_id
    JOIN canvas_corpus_permissions permission ON permission.user_id=access.user_id AND permission.origin=binding.origin AND permission.collection_enabled=true
    WHERE access.sync_paused=false AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs active WHERE active.user_id=access.user_id AND active.binding_id=binding.id AND active.status IN ('pending','running'))
      AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs recent WHERE recent.user_id=access.user_id AND recent.binding_id=binding.id AND recent.job_type='course' AND recent.status='completed' AND recent.finished_at > now() - make_interval(days => ${REFRESH_DAYS}))
      AND NOT EXISTS (SELECT 1 FROM canvas_sync_jobs failed WHERE failed.user_id=access.user_id AND failed.binding_id=binding.id AND failed.job_type='course' AND failed.status='failed' AND failed.finished_at > now() - make_interval(hours => ${FAILURE_COOLDOWN_HOURS}))
    ON CONFLICT DO NOTHING`
}

export async function processNextCanvasCorpusJob({ signal } = {}) {
  if (!sql || process.env.VERCEL_ENV === 'preview' || signal?.aborted) return null
  await sql`UPDATE canvas_sync_jobs SET status=CASE WHEN attempts < 3 THEN 'pending' ELSE 'failed' END,
    error='Worker stopped responding; its expired lease was recovered.', lease_token=null,
    run_after=now(), finished_at=CASE WHEN attempts < 3 THEN null ELSE now() END
    WHERE status='running' AND coalesce(heartbeat_at, started_at) < now() - interval '10 minutes'`
  await scheduleDueRefreshes()
  await sql`UPDATE canvas_sync_jobs job SET status='cancelled', error='Stopped by the student.', finished_at=now()
    FROM canvas_corpus_access access WHERE access.user_id=job.user_id AND access.binding_id=job.binding_id AND access.sync_paused=true AND job.status='pending'`
  const token = randomUUID()
  const rows = await sql`WITH next_job AS (
      SELECT id, error AS previous_error FROM canvas_sync_jobs
      WHERE status='pending' AND run_after<=now()
      ORDER BY priority DESC, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE canvas_sync_jobs job SET status='running', started_at=now(), heartbeat_at=now(), lease_token=${token}, finished_at=null, error=null, attempts=job.attempts+1
    FROM next_job WHERE job.id=next_job.id
    RETURNING job.*, next_job.previous_error`
  const job = rows[0]
  if (!job) return null
  const logger = createCanvasSyncLogger(job)
  job.log = logger.record
  try {
    const result = await withCanvasJobLease(async assertActive => {
      try { return await (job.job_type === 'catalog' ? runCatalog(job, assertActive) : runCourse(job, assertActive)) }
      finally { await logger.finish() }
    }, {
      signal,
      renew: async () => {
        const held = await sql`UPDATE canvas_sync_jobs SET heartbeat_at=now() WHERE id=${job.id} AND lease_token=${token} AND status='running' RETURNING id`
        return held.length > 0
      }
    })
    await sql`UPDATE canvas_sync_jobs SET status='completed', result=${JSON.stringify(result)}::jsonb, error=null, finished_at=now(), lease_token=null
      WHERE id=${job.id} AND lease_token=${token} AND status='running'`
    return { id: job.id, status: 'completed', result }
  } catch (error) {
    logger.close()
    const interrupted = Boolean(signal?.aborted)
    const retry = interrupted || Number(job.attempts) < 3
    await sql`UPDATE canvas_sync_jobs SET status=${retry ? 'pending' : 'failed'}, error=${String(error?.message || error).slice(0, 2000)},
      attempts=attempts - ${interrupted ? 1 : 0},
      run_after=now() + make_interval(mins => ${retry && !interrupted ? Number(job.attempts) * 5 : 0}), finished_at=${retry ? null : new Date().toISOString()}::timestamptz, lease_token=null
      WHERE id=${job.id} AND lease_token=${token} AND status='running'`
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
