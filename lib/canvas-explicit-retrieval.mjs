import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCanvasApi, CANVAS_IMPORT_LIMITS, CanvasCourseImportError } from './canvas-course-import.mjs'
import { canvasAccessTokenForUser } from './canvas-connections.mjs'
import { ingestFile } from './canvas-corpus-worker.mjs'
import { sql } from './db.mjs'
import { assertPublicUrl } from './security.mjs'

const digest = (value) => createHash('sha256').update(value).digest('hex')
const cleanName = (value) => String(value || 'Canvas file').replace(/[\\/\0]/g, '-').slice(0, 180)

export function parseCourseMaterialLink(value, origin, courseId) {
  let url
  try { url = new URL(value) } catch { throw new CanvasCourseImportError('Provide a complete Canvas course link.') }
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
    throw new CanvasCourseImportError('Use a link on the connected Canvas host.')
  const root = `/courses/${courseId}`
  const path = url.pathname
  let match = path.match(new RegExp(`^${root}/files/(\\d+)(?:/download)?/?$`)) || path.match(/^\/files\/(\d+)(?:\/download)?\/?$/)
  if (match) return { kind: 'file', id: match[1], source: `${origin}${root}/files/${match[1]}` }
  match = path.match(new RegExp(`^${root}/pages/([^/]+)/?$`))
  if (match) return { kind: 'page', id: decodeURIComponent(match[1]), source: `${origin}${path}` }
  match = path.match(new RegExp(`^${root}/modules/(\\d+)/items/(\\d+)/?$`))
  if (match) return { kind: 'module-item', moduleId: match[1], id: match[2], source: `${origin}${path}` }
  match = path.match(new RegExp(`^${root}/modules/items/(\\d+)/?$`))
  if (match) return { kind: 'module-item', id: match[1], source: `${origin}${path}` }
  if (path.startsWith(`${root}/`) && /\/(?:external_tools|media_objects|media|studio)(?:\/|$)/i.test(path))
    return { kind: 'media', source: `${origin}${path}`, title: 'Canvas course media' }
  throw new CanvasCourseImportError('Use a Canvas course file, page, or module item link from this course. External media links are not fetched.')
}

export function canvasPageMediaLinks(html, origin, courseId) {
  const fileIds = [...new Set([...String(html || '').matchAll(/(?:\/courses\/\d+)?\/files\/(\d+)/g)].map((match) => match[1]))]
  const studio = [...String(html || '').matchAll(/(?:https?:)?\/\/[^\s"'<>]*(?:studio|arc-media)[^\s"'<>]*/gi)]
    .map((match) => match[0].replaceAll('&amp;', '&'))
    .filter((value) => { try { return new URL(value, origin).protocol === 'https:' } catch { return false } })
  return { fileIds, studioLinks: [...new Set(studio)].slice(0, 10) }
}

function descriptor(file, origin, courseId) {
  const size = Number(file.size)
  if (!file.id || !file.url || !Number.isSafeInteger(size) || size < 1)
    throw new CanvasCourseImportError('Canvas did not provide a downloadable file with a known size.')
  const mediaType = String(file['content-type'] || file.content_type || 'application/octet-stream')
  const title = cleanName(file.display_name || file.filename)
  const version = digest(`${file.id}:${size}:${file.updated_at || ''}:${file.uuid || ''}`)
  return { status: 'ready', fileId: String(file.id), title, type: mediaType, size, source: `${origin}/courses/${courseId}/files/${file.id}`, version }
}

function sourceFilename(file) {
  const suffix = {'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov','video/x-m4v':'.m4v','audio/mpeg':'.mp3','audio/mp4':'.m4a'}[file.type]
  return suffix && !/\.[a-z0-9]{2,5}$/i.test(file.title) ? `${file.title}${suffix}` : file.title
}

export async function inspectCanvasMaterial({ origin, courseId, link, accessToken, fetchImpl = fetch }) {
  const target = parseCourseMaterialLink(link, origin, courseId)
  if (target.kind === 'media') return { status: 'external', title: target.title, type: /studio|external_tools/i.test(target.source) ? 'Canvas Studio or external tool' : 'Canvas embedded media', size: null, source: target.source, actionUrl: target.source, reason: 'This course media link is outside Canvas Files. Open it in Canvas; the Canvas Files API cannot provide its original bytes.' }
  const api = createCanvasApi({ origin, accessToken, fetchImpl })
  let ids = []
  let studioLinks = []
  if (target.kind === 'file') ids = [target.id]
  if (target.kind === 'page') {
    const page = await api.getJson(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(target.id)}`)
    const found = canvasPageMediaLinks(page.body, origin, courseId)
    ids = found.fileIds
    studioLinks = found.studioLinks
  }
  if (target.kind === 'module-item') {
    const sequence = target.moduleId
      ? await api.getJson(`/api/v1/courses/${courseId}/modules/${target.moduleId}/items/${target.id}`)
      : (await api.getJson(`/api/v1/courses/${courseId}/module_item_sequence?asset_type=ModuleItem&asset_id=${target.id}`)).items?.find((entry) => String(entry.id) === target.id)
    if (sequence?.type === 'File' && sequence.content_id) ids = [String(sequence.content_id)]
    else if (sequence?.type === 'Page' && sequence.page_url) {
      const page = await api.getJson(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(sequence.page_url)}`)
      const found = canvasPageMediaLinks(page.body, origin, courseId)
      ids = found.fileIds
      studioLinks = found.studioLinks
    } else if (sequence?.type === 'ExternalUrl' || sequence?.type === 'ExternalTool') {
      return { status: 'external', title: sequence.title || 'Canvas module media', type: sequence.type, size: null, source: target.source, actionUrl: sequence.html_url || target.source, reason: 'This module item uses external or Studio media. Open it in Canvas; the Canvas Files API cannot provide its original bytes.' }
    }
  }
  if (ids.length > 30) throw new CanvasCourseImportError('This page links to more than 30 Canvas files. Provide the exact file link instead.')
  const files = []
  for (const id of ids) {
    try {
      // The course-scoped endpoint rejects files outside this course.
      const file = await api.getJson(`/api/v1/courses/${courseId}/files/${id}`)
      files.push(descriptor(file, origin, courseId))
    } catch (error) {
      if (target.kind === 'file') throw error
    }
  }
  if (files.length) return { status: 'ready', source: target.source, files, ...(studioLinks.length ? { otherMedia: 'This page also embeds Canvas Studio media. Open the page in Canvas for that media.' } : {}) }
  return { status: 'external', title: target.kind === 'page' ? 'Canvas page media' : 'Canvas module media', type: studioLinks.length ? 'Canvas Studio' : 'Unresolved media', size: null, source: target.source, actionUrl: target.source, reason: studioLinks.length ? 'This page embeds Canvas Studio media. The Canvas Files API cannot provide its original bytes; open the page in Canvas.' : 'No downloadable Canvas course file was found at this link. Open it in Canvas to inspect its media.' }
}

async function accessibleBinding(accountId, origin, courseId) {
  if (!sql) throw new CanvasCourseImportError('Private Canvas material storage is unavailable.')
  const [binding] = await sql`SELECT b.* FROM canvas_course_bindings b
    JOIN canvas_corpus_access access ON access.binding_id=b.id AND access.user_id=${accountId}
    JOIN canvas_corpus_permissions permission ON permission.user_id=${accountId} AND permission.origin=b.origin AND permission.collection_enabled=true
    WHERE b.origin=${origin} AND b.canvas_course_id=${courseId} LIMIT 1`
  if (!binding) throw new CanvasCourseImportError('This connected course is not in your material inventory. Sync the accessible course first.')
  return binding
}

export async function explicitCanvasMaterial({ accountId, origin, courseId, link, fileId, version, transfer = false, fetchImpl = fetch }) {
  if (!/^\d+$/.test(String(courseId))) throw new CanvasCourseImportError('Choose an exact Canvas course ID.')
  const binding = await accessibleBinding(accountId, origin, String(courseId))
  const { token } = await canvasAccessTokenForUser({ accountId, canvasUrl: origin })
  const result = await inspectCanvasMaterial({ origin, courseId: String(courseId), link, accessToken: token, fetchImpl })
  if (!transfer || result.status !== 'ready') return result
  const selected = result.files.find((file) => file.fileId === String(fileId) && file.version === version)
  if (!selected) throw new CanvasCourseImportError('The Canvas file changed or was not in the inspected link. Inspect it again before retrieval.')
  if (selected.size > CANVAS_IMPORT_LIMITS.maxFileBytes) throw new CanvasCourseImportError('This file exceeds the 1 GiB original-material limit. Open it in Canvas instead.')
  const api = createCanvasApi({ origin, accessToken: token, fetchImpl })
  const detail = await api.getJson(`/api/v1/courses/${courseId}/files/${selected.fileId}`)
  if (descriptor(detail, origin, courseId).version !== version) throw new CanvasCourseImportError('The Canvas file changed. Inspect it again before retrieval.')
  await assertPublicUrl(detail.url)
  const folder = await mkdtemp(join(tmpdir(), 'canvas-explicit-'))
  try {
    const path = join(folder, selected.fileId)
    const bytes = await api.downloadToFile(detail.url, path, CANVAS_IMPORT_LIMITS.maxFileBytes)
    if (bytes !== selected.size) throw new CanvasCourseImportError('The downloaded size differs from Canvas metadata. Nothing was saved.')
    const sourcePath = `explicit/${selected.fileId}/${sourceFilename(selected)}`
    const stored = await ingestFile({ binding, accountId, file: { path, sourcePath }, assertActive: () => {}, job: { log: () => {} }, privateOnly: true })
    if (stored.skipped) throw new CanvasCourseImportError(`The original could not be saved: ${stored.reason}.`)
    const [asset] = await sql`SELECT id, byte_size, sha256 FROM editorial_source_assets WHERE sha256=${stored.sha256}`
    return { ...selected, status: 'saved', assetId: asset.id, sha256: asset.sha256, size: Number(asset.byte_size), materialsUrl: `/api/corpus/materials?courseCode=${encodeURIComponent(binding.course_code)}&academicYear=${encodeURIComponent(binding.academic_year)}`, downloadTicketUrl: `/api/corpus/assets/${encodeURIComponent(asset.id)}/download-ticket` }
  } finally { await rm(folder, { recursive: true, force: true }) }
}
