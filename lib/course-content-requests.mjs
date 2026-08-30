import { createHash, randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import { localRows, saveLocalRows, sql, userId } from './db.mjs'

export const COURSE_REQUEST_CATEGORIES = Object.freeze([
  ['slides', 'Lecture slides'],
  ['syllabus', 'Syllabus or course manual'],
  ['exams', 'Past or mock exams'],
  ['practice', 'Practice or tutorial sheets'],
  ['reading', 'Readings and reference links'],
  ['other', 'Other course material']
])

export const COURSE_INGESTION_STAGES = Object.freeze([
  { id: 'collection', label: 'Collect & verify', detail: 'Confirm the course edition, source rights, syllabus, learning outcomes, and assessment format.' },
  { id: 'extraction', label: 'Extract & normalise', detail: 'Read PDFs, slides, office files, images, and URLs with OCR where needed; preserve page-level provenance.' },
  { id: 'mapping', label: 'Map the course', detail: 'Build a topic, outcome, prerequisite, assessment, and curriculum-version map before authoring.' },
  { id: 'retrieval', label: 'Build retrieval index', detail: 'Chunk every usable source into a course-scoped citation index with document and page metadata.' },
  { id: 'authoring', label: 'Create study pages', detail: 'Draft useful explanations, worked examples, diagrams, summaries, and cross-links grounded in the sources.' },
  { id: 'exercises', label: 'Create practice', detail: 'Produce progressive exercises, answer guidance, flashcards, practice sheets, and representative mock exams.' },
  { id: 'quality', label: 'Quality review', detail: 'Check accuracy, citation coverage, assessment alignment, accessibility, difficulty balance, and redistribution rights.' },
  { id: 'publication', label: 'Publish & maintain', detail: 'Activate a versioned editorial release, verify retrieval, and keep the course aligned when source material changes.' }
])

export const COURSE_REQUEST_STATUSES = Object.freeze(['submitted', 'in-progress', 'review', 'published', 'declined'])
export const CONTRIBUTION_LICENSES = Object.freeze([
  ['own-notes', 'My own notes or work'],
  ['authorised-course-material', 'Course material I may share for this purpose'],
  ['public-source', 'Publicly available source']
])

const MAX_FILES = 8
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 30 * 1024 * 1024
const CHUNK_BYTES = 512 * 1024
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg', '.webp'])
const CLOSED_STATUSES = new Set(['published', 'declined'])

function text(value, max) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, max)
}

function unique(values) {
  return [...new Set(values)]
}

function normalizeUrls(values) {
  const out = []
  for (const value of Array.isArray(values) ? values : []) {
    const raw = text(value, 2000)
    if (!raw) continue
    let url
    try { url = new URL(raw) } catch { throw new Error(`Invalid material URL: ${raw.slice(0, 80)}`) }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Material URLs must use http or https.')
    out.push(url.toString())
  }
  return unique(out).slice(0, 20)
}

function normalizeCategories(values) {
  const allowed = new Set(COURSE_REQUEST_CATEGORIES.map(([id]) => id))
  return unique((Array.isArray(values) ? values : []).map((value) => text(value, 40)).filter((value) => allowed.has(value)))
}

function normalizeContribution(payload) {
  const consent = payload?.contributionConsent === true
  const license = consent ? text(payload?.contributionLicense, 80) : ''
  const allowed = new Set(CONTRIBUTION_LICENSES.map(([id]) => id))
  if (consent && !allowed.has(license)) throw new Error('Choose why these materials may be considered for shared course content.')
  return { consent, license }
}

function normalizeFileMetadata(file) {
  const filename = text(file?.name, 240).replaceAll('/', '-').replaceAll('\\', '-')
  const extension = extname(filename).toLowerCase()
  if (!filename || !ALLOWED_EXTENSIONS.has(extension)) throw new Error(`Unsupported material file: ${filename || 'unnamed file'}`)
  const byteSize = Number(file?.size)
  if (!Number.isInteger(byteSize) || byteSize <= 0) throw new Error(`${filename} is empty.`)
  if (byteSize > MAX_FILE_BYTES) throw new Error(`${filename} is larger than 10 MB.`)
  return { filename, mediaType: text(file?.type, 160) || 'application/octet-stream', byteSize }
}

function normalizeFiles(values) {
  const incoming = Array.isArray(values) ? values.slice(0, MAX_FILES) : []
  if ((Array.isArray(values) ? values.length : 0) > MAX_FILES) throw new Error(`Attach at most ${MAX_FILES} files per submission.`)
  let total = 0
  const files = incoming.map((file) => {
    const filename = text(file?.name, 240).replaceAll('/', '-').replaceAll('\\', '-')
    const raw = String(file?.base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')
    if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error(`${filename} could not be read.`)
    const data = Buffer.from(raw, 'base64')
    const metadata = normalizeFileMetadata({ ...file, name: filename, size: data.length })
    total += data.length
    return { id: randomUUID(), ...metadata, data, sha256: createHash('sha256').update(data).digest('hex') }
  })
  if (total > MAX_TOTAL_BYTES) throw new Error('Attachments are limited to 30 MB per submission.')
  return files
}

function rowToRequest(row, files = []) {
  return {
    id: row.id,
    userId: row.user_id,
    requesterEmail: row.requester_email || null,
    programmeId: row.programme_id || null,
    academicCourseId: row.academic_course_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    academicYear: row.academic_year,
    period: row.period,
    categories: row.categories || [],
    notes: row.notes || '',
    urls: row.urls || [],
    status: row.status,
    pipelineStage: row.pipeline_stage,
    adminNote: row.admin_note || '',
    contributionConsent: Boolean(row.contribution_consent),
    contributionLicense: row.contribution_license || '',
    contributionConsentAt: row.contribution_consent_at instanceof Date ? row.contribution_consent_at.toISOString() : row.contribution_consent_at || null,
    editionId: row.edition_id || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    files
  }
}

function rowToStudentRequest(row, files = []) {
  const { userId: _userId, requesterEmail: _requesterEmail, adminNote: _adminNote, ...request } = rowToRequest(row, files)
  return request
}

function fileMeta(row) {
  return {
    id: row.id,
    name: row.filename,
    type: row.media_type,
    size: Number(row.byte_size),
    sha256: row.sha256,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  }
}

async function sqlFilesFor(requestIds) {
  if (!requestIds.length) return new Map()
  const rows = await sql`SELECT request_id, id, filename, media_type, byte_size, sha256, created_at
    FROM course_content_request_files WHERE request_id = ANY(${requestIds}) AND is_complete=true ORDER BY created_at, filename`
  const grouped = new Map(requestIds.map((id) => [id, []]))
  for (const row of rows) grouped.get(row.request_id)?.push(fileMeta(row))
  return grouped
}

async function localRequestRows() {
  return localRows('course_content_requests')
}

async function localFileRows() {
  return localRows('course_content_request_files')
}

export async function listOwnCourseContentRequests({ courseId = null } = {}) {
  const owner = userId()
  if (sql) {
    const rows = courseId
      ? await sql`SELECT * FROM course_content_requests WHERE user_id=${owner} AND academic_course_id=${courseId} ORDER BY updated_at DESC`
      : await sql`SELECT * FROM course_content_requests WHERE user_id=${owner} ORDER BY updated_at DESC`
    const files = await sqlFilesFor(rows.map((row) => row.id))
    return rows.map((row) => rowToStudentRequest(row, files.get(row.id) || []))
  }
  const rows = (await localRequestRows()).filter((row) => row.user_id === owner && (!courseId || row.academic_course_id === courseId)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const files = await localFileRows()
  return rows.map((row) => rowToStudentRequest(row, files.filter((file) => file.request_id === row.id && file.is_complete !== false).map(fileMeta)))
}

export async function createCourseContentRequest(payload, { requesterEmail = null } = {}) {
  const owner = userId()
  const academicCourseId = text(payload?.academicCourseId, 160)
  const courseName = text(payload?.courseName, 300)
  if (!academicCourseId || !courseName) throw new Error('Choose a course before sending the request.')
  const categories = normalizeCategories(payload?.categories)
  const urls = normalizeUrls(payload?.urls)
  const notes = text(payload?.notes, 5000)
  const contribution = normalizeContribution(payload)
  const files = normalizeFiles(payload?.files)
  if (!categories.length && !urls.length && !notes && !files.length && !payload?.expectsFiles) throw new Error('Add a note, link, material type, or file so the course team has useful context.')
  const now = new Date().toISOString()
  const base = {
    requester_email: text(requesterEmail, 320) || null,
    programme_id: text(payload?.programmeId, 160) || null,
    academic_course_id: academicCourseId,
    course_code: text(payload?.courseCode, 80).toUpperCase(),
    course_name: courseName,
    academic_year: text(payload?.academicYear, 80),
    period: text(payload?.period, 120)
  }

  if (sql) {
    const [existing] = await sql`SELECT * FROM course_content_requests WHERE user_id=${owner} AND academic_course_id=${academicCourseId} AND status NOT IN ('published', 'declined') ORDER BY created_at DESC LIMIT 1`
    let requestId = existing?.id
    if (existing) {
      const mergedCategories = unique([...(existing.categories || []), ...categories])
      const mergedUrls = unique([...(existing.urls || []), ...urls])
      const mergedNotes = notes && !String(existing.notes || '').includes(notes) ? [existing.notes, notes].filter(Boolean).join('\n\nAdditional submission:\n') : existing.notes
      await sql`UPDATE course_content_requests SET requester_email=${base.requester_email}, programme_id=${base.programme_id}, course_code=${base.course_code}, course_name=${base.course_name}, academic_year=${base.academic_year}, period=${base.period}, categories=${JSON.stringify(mergedCategories)}::jsonb, urls=${JSON.stringify(mergedUrls)}::jsonb, notes=${mergedNotes}, contribution_consent=contribution_consent OR ${contribution.consent}, contribution_license=CASE WHEN ${contribution.consent} THEN ${contribution.license} ELSE contribution_license END, contribution_consent_at=CASE WHEN ${contribution.consent} THEN coalesce(contribution_consent_at, now()) ELSE contribution_consent_at END, updated_at=now() WHERE id=${requestId}`
    } else {
      requestId = randomUUID()
      await sql`INSERT INTO course_content_requests (id, user_id, requester_email, programme_id, academic_course_id, course_code, course_name, academic_year, period, categories, notes, urls, contribution_consent, contribution_license, contribution_consent_at)
        VALUES (${requestId}, ${owner}, ${base.requester_email}, ${base.programme_id}, ${base.academic_course_id}, ${base.course_code}, ${base.course_name}, ${base.academic_year}, ${base.period}, ${JSON.stringify(categories)}::jsonb, ${notes}, ${JSON.stringify(urls)}::jsonb, ${contribution.consent}, ${contribution.license}, ${contribution.consent ? new Date() : null})`
    }
    try {
      for (const file of files) {
        const inserted = await sql`INSERT INTO course_content_request_files (request_id, id, filename, media_type, byte_size, sha256, expected_chunks, is_complete)
          VALUES (${requestId}, ${file.id}, ${file.filename}, ${file.mediaType}, ${file.byteSize}, ${file.sha256}, 1, true) ON CONFLICT (request_id, sha256) DO NOTHING RETURNING id`
        if (!inserted.length) continue
        for (let offset = 0, index = 0; offset < file.data.length; offset += CHUNK_BYTES, index++) {
          const chunk = file.data.subarray(offset, Math.min(offset + CHUNK_BYTES, file.data.length))
          await sql`INSERT INTO course_content_request_file_chunks (request_id, file_id, chunk_index, data) VALUES (${requestId}, ${file.id}, ${index}, ${chunk})`
        }
      }
    } catch (error) {
      if (!existing) await sql`DELETE FROM course_content_requests WHERE id=${requestId}`
      throw error
    }
    return { created: !existing, request: (await listOwnCourseContentRequests({ courseId: academicCourseId })).find((request) => request.id === requestId) }
  }

  const requests = await localRequestRows()
  const storedFiles = await localFileRows()
  let row = requests.find((candidate) => candidate.user_id === owner && candidate.academic_course_id === academicCourseId && !CLOSED_STATUSES.has(candidate.status))
  const created = !row
  if (!row) {
    row = { id: randomUUID(), user_id: owner, ...base, categories, notes, urls, status: 'submitted', pipeline_stage: 'collection', admin_note: '', contribution_consent: contribution.consent, contribution_license: contribution.license, contribution_consent_at: contribution.consent ? now : null, edition_id: null, created_at: now, updated_at: now }
    requests.push(row)
  } else {
    Object.assign(row, base, {
      categories: unique([...(row.categories || []), ...categories]),
      urls: unique([...(row.urls || []), ...urls]),
      notes: notes && !String(row.notes || '').includes(notes) ? [row.notes, notes].filter(Boolean).join('\n\nAdditional submission:\n') : row.notes,
      contribution_consent: Boolean(row.contribution_consent || contribution.consent),
      contribution_license: contribution.consent ? contribution.license : row.contribution_license,
      contribution_consent_at: contribution.consent ? row.contribution_consent_at || now : row.contribution_consent_at,
      updated_at: now
    })
  }
  for (const file of files) {
    if (storedFiles.some((candidate) => candidate.request_id === row.id && candidate.sha256 === file.sha256)) continue
    storedFiles.push({ request_id: row.id, id: file.id, filename: file.filename, media_type: file.mediaType, byte_size: file.byteSize, sha256: file.sha256, expected_chunks: 1, is_complete: true, created_at: now, base64: file.data.toString('base64') })
  }
  await Promise.all([saveLocalRows('course_content_requests', requests), saveLocalRows('course_content_request_files', storedFiles)])
  return { created, request: (await listOwnCourseContentRequests({ courseId: academicCourseId })).find((request) => request.id === row.id) }
}

export async function listAdminCourseContentRequests() {
  if (sql) {
    const rows = await sql`SELECT * FROM course_content_requests ORDER BY CASE status WHEN 'submitted' THEN 0 WHEN 'in-progress' THEN 1 WHEN 'review' THEN 2 ELSE 3 END, updated_at DESC`
    const files = await sqlFilesFor(rows.map((row) => row.id))
    return rows.map((row) => rowToRequest(row, files.get(row.id) || []))
  }
  const rows = await localRequestRows()
  const files = await localFileRows()
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((row) => rowToRequest(row, files.filter((file) => file.request_id === row.id && file.is_complete !== false).map(fileMeta)))
}

export async function uploadCourseContentRequestFileChunk(requestIdRaw, payload = {}) {
  const owner = userId()
  const requestId = text(requestIdRaw, 160)
  const fileId = text(payload.fileId, 160)
  const sha256 = text(payload.sha256, 64).toLowerCase()
  const totalChunks = Number(payload.totalChunks)
  const chunkIndex = Number(payload.chunkIndex)
  const metadata = normalizeFileMetadata(payload)
  if (!requestId || !fileId) throw new Error('The upload is missing its request or file identifier.')
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${metadata.filename} is missing a valid checksum.`)
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > Math.ceil(MAX_FILE_BYTES / CHUNK_BYTES)) throw new Error('Invalid upload chunk count.')
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) throw new Error('Invalid upload chunk index.')
  const raw = String(payload.base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')
  if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error(`${metadata.filename} chunk could not be read.`)
  const data = Buffer.from(raw, 'base64')
  if (!data.length || data.length > CHUNK_BYTES) throw new Error(`${metadata.filename} chunk is invalid.`)
  const now = new Date().toISOString()

  if (sql) {
    const [request] = await sql`SELECT id FROM course_content_requests WHERE id=${requestId} AND user_id=${owner} AND status NOT IN ('published', 'declined')`
    if (!request) throw new Error('This course-content request is no longer available for uploads.')
    let [file] = await sql`SELECT * FROM course_content_request_files WHERE request_id=${requestId} AND id=${fileId}`
    if (!file) {
      const [limits] = await sql`SELECT count(*)::int AS count, coalesce(sum(byte_size), 0)::bigint AS bytes FROM course_content_request_files WHERE request_id=${requestId}`
      if (Number(limits.count) >= MAX_FILES) throw new Error(`Attach at most ${MAX_FILES} files per request.`)
      if (Number(limits.bytes) + metadata.byteSize > MAX_TOTAL_BYTES) throw new Error('Attachments are limited to 30 MB per request.')
      const inserted = await sql`INSERT INTO course_content_request_files (request_id, id, filename, media_type, byte_size, sha256, expected_chunks, is_complete)
        VALUES (${requestId}, ${fileId}, ${metadata.filename}, ${metadata.mediaType}, ${metadata.byteSize}, ${sha256}, ${totalChunks}, false)
        ON CONFLICT (request_id, sha256) DO NOTHING RETURNING *`
      file = inserted[0]
      if (!file) {
        const [duplicate] = await sql`SELECT * FROM course_content_request_files WHERE request_id=${requestId} AND sha256=${sha256}`
        if (duplicate?.is_complete) return { complete: true, file: fileMeta(duplicate) }
        throw new Error(`${metadata.filename} is already being uploaded.`)
      }
    }
    if (file.filename !== metadata.filename || Number(file.byte_size) !== metadata.byteSize || file.sha256 !== sha256 || Number(file.expected_chunks) !== totalChunks) throw new Error('Upload metadata changed between chunks.')
    if (file.is_complete) return { complete: true, file: fileMeta(file) }
    await sql`INSERT INTO course_content_request_file_chunks (request_id, file_id, chunk_index, data)
      VALUES (${requestId}, ${fileId}, ${chunkIndex}, ${data}) ON CONFLICT (request_id, file_id, chunk_index) DO UPDATE SET data=EXCLUDED.data`
    const [progress] = await sql`SELECT count(*)::int AS count, coalesce(sum(octet_length(data)), 0)::bigint AS bytes FROM course_content_request_file_chunks WHERE request_id=${requestId} AND file_id=${fileId}`
    if (Number(progress.count) < totalChunks) return { complete: false, uploadedChunks: Number(progress.count), totalChunks }
    const chunks = await sql`SELECT data FROM course_content_request_file_chunks WHERE request_id=${requestId} AND file_id=${fileId} ORDER BY chunk_index`
    const complete = Buffer.concat(chunks.map((row) => Buffer.from(row.data)))
    if (complete.length !== metadata.byteSize || createHash('sha256').update(complete).digest('hex') !== sha256) {
      await sql`DELETE FROM course_content_request_files WHERE request_id=${requestId} AND id=${fileId}`
      throw new Error(`${metadata.filename} failed its upload integrity check. Please try it again.`)
    }
    const [saved] = await sql`UPDATE course_content_request_files SET is_complete=true WHERE request_id=${requestId} AND id=${fileId} RETURNING *`
    await sql`UPDATE course_content_requests SET updated_at=now() WHERE id=${requestId}`
    return { complete: true, file: fileMeta(saved) }
  }

  const requests = await localRequestRows()
  const request = requests.find((row) => row.id === requestId && row.user_id === owner && !CLOSED_STATUSES.has(row.status))
  if (!request) throw new Error('This course-content request is no longer available for uploads.')
  const files = await localFileRows()
  let file = files.find((row) => row.request_id === requestId && row.id === fileId)
  if (!file) {
    const requestFiles = files.filter((row) => row.request_id === requestId)
    const duplicate = requestFiles.find((row) => row.sha256 === sha256)
    if (duplicate && duplicate.is_complete !== false) return { complete: true, file: fileMeta(duplicate) }
    if (duplicate) throw new Error(`${metadata.filename} is already being uploaded.`)
    if (requestFiles.length >= MAX_FILES) throw new Error(`Attach at most ${MAX_FILES} files per request.`)
    if (requestFiles.reduce((sum, row) => sum + Number(row.byte_size || 0), 0) + metadata.byteSize > MAX_TOTAL_BYTES) throw new Error('Attachments are limited to 30 MB per request.')
    file = { request_id: requestId, id: fileId, filename: metadata.filename, media_type: metadata.mediaType, byte_size: metadata.byteSize, sha256, expected_chunks: totalChunks, is_complete: false, created_at: now, chunks: [] }
    files.push(file)
  }
  if (file.filename !== metadata.filename || Number(file.byte_size) !== metadata.byteSize || file.sha256 !== sha256 || Number(file.expected_chunks) !== totalChunks) throw new Error('Upload metadata changed between chunks.')
  if (file.is_complete) return { complete: true, file: fileMeta(file) }
  file.chunks = (file.chunks || []).filter((chunk) => chunk.index !== chunkIndex)
  file.chunks.push({ index: chunkIndex, base64: data.toString('base64') })
  if (file.chunks.length === totalChunks) {
    const complete = Buffer.concat(file.chunks.sort((left, right) => left.index - right.index).map((chunk) => Buffer.from(chunk.base64, 'base64')))
    if (complete.length !== metadata.byteSize || createHash('sha256').update(complete).digest('hex') !== sha256) {
      files.splice(files.indexOf(file), 1)
      await saveLocalRows('course_content_request_files', files)
      throw new Error(`${metadata.filename} failed its upload integrity check. Please try it again.`)
    }
    file.base64 = complete.toString('base64')
    file.chunks = []
    file.is_complete = true
    request.updated_at = now
    await saveLocalRows('course_content_requests', requests)
  }
  await saveLocalRows('course_content_request_files', files)
  return file.is_complete ? { complete: true, file: fileMeta(file) } : { complete: false, uploadedChunks: file.chunks.length, totalChunks }
}

export async function updateCourseContentRequest(requestIdRaw, patch = {}) {
  const requestId = text(requestIdRaw, 160)
  const status = text(patch?.status, 40)
  const pipelineStage = text(patch?.pipelineStage, 40)
  if (status && !COURSE_REQUEST_STATUSES.includes(status)) throw new Error('Unknown request status.')
  if (pipelineStage && !COURSE_INGESTION_STAGES.some((stage) => stage.id === pipelineStage)) throw new Error('Unknown ingestion stage.')
  const adminNote = patch?.adminNote === undefined ? undefined : text(patch.adminNote, 5000)
  if (sql) {
    const [row] = await sql`UPDATE course_content_requests SET status=coalesce(${status || null}, status), pipeline_stage=coalesce(${pipelineStage || null}, pipeline_stage), admin_note=coalesce(${adminNote ?? null}, admin_note), updated_at=now() WHERE id=${requestId} RETURNING *`
    if (!row) throw new Error('Unknown course-content request.')
    const files = await sqlFilesFor([requestId])
    return rowToRequest(row, files.get(requestId) || [])
  }
  const rows = await localRequestRows()
  const row = rows.find((candidate) => candidate.id === requestId)
  if (!row) throw new Error('Unknown course-content request.')
  if (status) row.status = status
  if (pipelineStage) row.pipeline_stage = pipelineStage
  if (adminNote !== undefined) row.admin_note = adminNote
  row.updated_at = new Date().toISOString()
  await saveLocalRows('course_content_requests', rows)
  return (await listAdminCourseContentRequests()).find((request) => request.id === requestId)
}

export async function getCourseContentRequestFile(requestIdRaw, fileIdRaw) {
  const requestId = text(requestIdRaw, 160)
  const fileId = text(fileIdRaw, 160)
  if (sql) {
    const [meta] = await sql`SELECT filename, media_type, byte_size FROM course_content_request_files WHERE request_id=${requestId} AND id=${fileId} AND is_complete=true`
    if (!meta) return null
    const chunks = await sql`SELECT data FROM course_content_request_file_chunks WHERE request_id=${requestId} AND file_id=${fileId} ORDER BY chunk_index`
    return { name: meta.filename, type: meta.media_type, size: Number(meta.byte_size), data: Buffer.concat(chunks.map((row) => Buffer.from(row.data))) }
  }
  const file = (await localFileRows()).find((candidate) => candidate.request_id === requestId && candidate.id === fileId && candidate.is_complete !== false)
  return file ? { name: file.filename, type: file.media_type, size: Number(file.byte_size), data: Buffer.from(file.base64, 'base64') } : null
}

export async function exportOwnCourseContentRequests() {
  const requests = await listOwnCourseContentRequests()
  if (!sql) {
    const files = await localFileRows()
    return requests.map((request) => ({ ...request, files: request.files.map((file) => ({ ...file, base64: files.find((candidate) => candidate.request_id === request.id && candidate.id === file.id)?.base64 || '' })) }))
  }
  for (const request of requests) {
    for (const file of request.files) {
      const stored = await getCourseContentRequestFile(request.id, file.id)
      file.base64 = stored?.data.toString('base64') || ''
    }
  }
  return requests
}

export async function summariseOwnCourseContentRequests() {
  const owner = userId()
  if (sql) {
    const [row] = await sql`SELECT count(DISTINCT r.id)::int AS count, coalesce(sum(f.byte_size), 0)::bigint AS bytes, max(r.updated_at) AS updated_at FROM course_content_requests r LEFT JOIN course_content_request_files f ON f.request_id=r.id AND f.is_complete=true WHERE r.user_id=${owner}`
    return { count: Number(row.count), bytes: Number(row.bytes), updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null }
  }
  const requests = (await localRequestRows()).filter((row) => row.user_id === owner)
  const ids = new Set(requests.map((row) => row.id))
  const files = (await localFileRows()).filter((row) => ids.has(row.request_id) && row.is_complete !== false)
  return { count: requests.length, bytes: files.reduce((sum, file) => sum + Number(file.byte_size || 0), 0), updatedAt: requests.map((row) => row.updated_at).sort().at(-1) || null }
}

export async function deleteOwnCourseContentRequests() {
  const owner = userId()
  if (sql) {
    const rows = await sql`DELETE FROM course_content_requests WHERE user_id=${owner} RETURNING id`
    return rows.length
  }
  const requests = await localRequestRows()
  const removedIds = new Set(requests.filter((row) => row.user_id === owner).map((row) => row.id))
  const files = await localFileRows()
  await Promise.all([
    saveLocalRows('course_content_requests', requests.filter((row) => row.user_id !== owner)),
    saveLocalRows('course_content_request_files', files.filter((row) => !removedIds.has(row.request_id)))
  ])
  return removedIds.size
}
