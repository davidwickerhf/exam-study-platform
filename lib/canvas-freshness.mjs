import { createHash } from 'node:crypto'
import { createCanvasApi } from './canvas-course-import.mjs'

export const FRESHNESS_NAMESPACE = 'canvas-freshness'
export const FRESHNESS_KINDS = ['syllabus', 'files', 'assignments', 'announcements', 'discussions', 'pages', 'quizzes', 'modules', 'attachments']
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]))
const fields = {
  syllabus: ['name', 'course_code', 'syllabus_body', 'start_at', 'end_at'],
  files: ['display_name', 'filename', 'size', 'updated_at', 'modified_at', 'locked_for_user', 'hidden_for_user', 'unlock_at', 'lock_at'],
  assignments: ['name', 'description', 'updated_at', 'due_at', 'unlock_at', 'lock_at', 'points_possible', 'submission_types', 'published'],
  announcements: ['title', 'message', 'posted_at', 'delayed_post_at', 'last_edited_at', 'published'],
  discussions: ['title', 'message', 'last_edited_at', 'published'],
  pages: ['title', 'updated_at', 'published'],
  quizzes: ['title', 'description', 'updated_at', 'due_at', 'points_possible', 'question_count', 'time_limit', 'published'],
  modules: ['name', 'position', 'unlock_at', 'published', 'prerequisite_module_ids', 'itemsFingerprint'],
}

// List metadata only: no file bytes, page bodies, question banks, embeddings or
// AI. Use the SAME URLs as the importer so old successful checkpoints can be
// replayed as the baseline without making a single network request.
export async function collectCanvasMetadata({ origin, courseId, token, fetchImpl = fetch, replay = false, maxRequests = 48, maxBytes = 8 * 1024 * 1024 } = {}) {
  let requests = 0, bytes = 0
  const deadline = Date.now() + 75_000
  const api = createCanvasApi({ origin, accessToken: token, fetchImpl: async (url, options) => {
    if (requests >= maxRequests || Date.now() > deadline) throw new Error('Metadata check budget reached')
    requests++
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(Math.max(1, Math.min(12_000, deadline - Date.now()))) })
    if (!response.ok) return response
    if (Number(response.headers.get('content-length')) > maxBytes - bytes) throw new Error('Metadata check budget reached')
    const reader = response.body?.getReader(), chunks = []
    if (reader) try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.length
        if (bytes > maxBytes) throw new Error('Metadata check budget reached')
        chunks.push(Buffer.from(value))
      }
    } finally { await reader.cancel().catch(() => {}) }
    return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers })
  } })
  const base = `/api/v1/courses/${encodeURIComponent(courseId)}`
  const snapshot = { version: 1, categories: {}, checkedAt: new Date().toISOString() }
  const fileIds = new Set(), files = new Set()
  const findFiles = row => {
    for (const attachment of [row.attachment, ...(row.attachments || [])].filter(Boolean)) if (/^\d+$/.test(String(attachment.id))) fileIds.add(String(attachment.id))
    for (const match of String(row.description || row.message || row.syllabus_body || '').matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
      try {
        const url = new URL(match[1].replaceAll('&amp;', '&'), origin)
        if (url.origin !== origin) continue
        const id = url.pathname.match(new RegExp(`^/(?:api/v1/)?(?:courses/${courseId}/)?files/(\\d+)(?:/|$)`))?.[1]
        if (id) fileIds.add(id)
      } catch { /* An external/unparseable link is not a Canvas file. */ }
    }
  }
  const record = (row, kind) => ({ id: String(row.id ?? row.page_id ?? row.url ?? courseId), title: String(row.title || row.display_name || row.name || row.filename || 'Course syllabus').slice(0, 200), fingerprint: hash({ ...pick(row, fields[kind] || fields.files), attachments: [row.attachment, ...(row.attachments || [])].filter(Boolean).map(file => pick(file, ['id','display_name','filename','size','updated_at'])).sort((a,b) => String(a.id).localeCompare(String(b.id))) }) })
  async function category(kind, read) {
    try {
      const rows = await read()
      snapshot.categories[kind] = { complete: true, items: rows.map(row => record(row, kind)) }
      if (['syllabus', 'assignments', 'announcements', 'discussions'].includes(kind)) rows.forEach(findFiles)
    } catch {
      snapshot.categories[kind] = { complete: false, items: [] }
    }
  }
  await category('syllabus', async () => [await api.getJson(`${base}?include[]=syllabus_body`)])
  await category('files', async () => {
    const rows = await api.getPaged(`${base}/files?per_page=100`)
    rows.forEach(row => files.add(String(row.id)))
    return rows
  })
  for (const [kind, path] of [['assignments', 'assignments'], ['announcements', 'discussion_topics?only_announcements=true&'], ['discussions', 'discussion_topics'], ['pages', 'pages'], ['quizzes', 'quizzes']]) {
    await category(kind, () => api.getPaged(`${base}/${path}${path.endsWith('&') ? '' : '?'}per_page=100`))
  }
  await category('modules', async () => {
    const modules = await api.getPaged(`${base}/modules?include[]=items&per_page=100`)
    for (const module of modules) {
      // Import checkpoints have authoritative paginated item lists. Live
      // checks use inline items when complete to save one request per module.
      if (replay || !Array.isArray(module.items) || module.items.length < Number(module.items_count)) module.items = await api.getPaged(`${base}/modules/${module.id}/items?per_page=100`)
      for (const item of module.items) if (item.type === 'File' && item.content_id) fileIds.add(String(item.content_id))
      module.itemsFingerprint = hash(module.items.map(item => pick(item, ['id', 'title', 'type', 'content_id', 'page_url', 'position', 'indent', 'external_url', 'published'])).sort((a,b) => String(a.id).localeCompare(String(b.id))))
    }
    return modules
  })
  // Files hidden from the course Files listing may still be linked from an
  // assignment or module. Check their metadata, never their download URL.
  await category('attachments', async () => {
    const rows = []
    for (const id of [...fileIds].filter(id => !files.has(id)).sort()) rows.push(await api.getJson(`${base}/files/${id}`))
    return rows
  })
  if (['syllabus', 'assignments', 'announcements', 'discussions', 'modules'].some(kind => !snapshot.categories[kind].complete)) snapshot.categories.attachments.complete = false
  return { ...snapshot, requests, bytes }
}

export function replayCanvasMetadata(checkpoints) {
  const map = new Map(checkpoints.map(row => [row.key, row.value]))
  return async url => {
    const saved = map.get(String(url))
    return saved ? new Response(saved.body, { status: saved.status, headers: saved.headers }) : new Response('', { status: 404 })
  }
}

export function compareCanvasMetadata(baseline, current, previous = null) {
  const changes = [], unchecked = []
  for (const kind of FRESHNESS_KINDS) {
    const before = baseline?.categories?.[kind], after = current.categories[kind]
    if (!before?.complete || !after?.complete) {
      unchecked.push(kind)
      // An unavailable check cannot dismiss a previously observed change.
      changes.push(...(previous?.changes || []).filter(change => change.kind === kind))
      continue
    }
    const old = new Map(before.items.map(item => [item.id, item]))
    for (const item of after.items) {
      const prior = old.get(item.id)
      if (!prior || prior.fingerprint !== item.fingerprint) changes.push({ kind, id: item.id, title: item.title, change: prior ? 'changed' : 'new' })
      old.delete(item.id)
    }
    for (const item of old.values()) changes.push({ kind, id: item.id, title: item.title, change: 'unavailable' })
  }
  return { changes, unchecked, status: changes.length ? 'updates' : unchecked.length ? 'partial' : 'current', checkedAt: current.checkedAt }
}
