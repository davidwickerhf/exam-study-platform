import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

export const CANVAS_IMPORT_LIMITS = Object.freeze({
  maxResources: 250,
  maxFileBytes: 100 * 1024 * 1024,
  timeoutMs: 30_000
})

export class CanvasCourseImportError extends Error {}

function text(value, max = 500) {
  return String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function prefix(value) {
  return String(Math.max(0, number(value))).padStart(3, '0')
}

function safeSegment(value, fallback = 'untitled') {
  const cleaned = text(value, 120).normalize('NFKD').replace(/[\\/:*?"<>|]/g, '-').replace(/[^\p{L}\p{N}._ -]/gu, '').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim()
  return cleaned || fallback
}

function filename(value, fallback = 'material') {
  const raw = basename(text(value, 180)).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim()
  return raw || fallback
}

function fileCategory(value) {
  const name = text(value, 240).toLowerCase()
  if (/(syllabus|course manual|course outline|study guide|course information)/.test(name)) return 'course-information'
  if (/(slide|lecture|deck|presentation)/.test(name)) return 'slides'
  if (/(exam|mock|past.?paper|resit|quiz)/.test(name)) return 'assessments'
  if (/(assignment|project|tutorial|practice|exercise|worksheet)/.test(name)) return 'activities'
  if (/(read|article|paper|book|chapter)/.test(name)) return 'readings'
  return 'materials'
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function sanitizeCanvasHtml(value) {
  return String(value || '')
    .replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi, '')
}

function htmlRecord({ title, url, body, details = [] }) {
  const rows = details.filter(([label, value]) => text(value)).map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>
<article><header><p>Imported privately from Canvas. Review rights before publication.</p><h1>${escapeHtml(title)}</h1>${url ? `<p>Canvas source: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}${rows ? `<dl>${rows}</dl>` : ''}</header>
${sanitizeCanvasHtml(body) || '<p>No Canvas description was provided for this item.</p>'}
</article></body></html>
`
}

function markdownLinkRecord({ title, url, details = [] }) {
  const facts = details.filter(([label, value]) => text(value)).map(([label, value]) => `- **${label}:** ${value}`).join('\n')
  return `# ${title}\n\nCanvas reference: ${url}\n\n${facts ? `${facts}\n` : ''}\nThis is an external link reference. It was not fetched by Wicker Study.\n`
}

function pagePath(base, position, title, id, extension = '.html') {
  return join(base, `${prefix(position)} ${safeSegment(title)}--${safeSegment(id, 'item')}${extension}`)
}

function nextPageUrl(link, origin) {
  if (!link) return null
  const match = String(link).match(/<([^>]+)>\s*;\s*rel="?next"?/i)
  if (!match) return null
  const url = new URL(match[1], origin)
  if (url.origin !== origin) throw new CanvasCourseImportError('Canvas pagination pointed to another origin.')
  return url
}

export function parseCanvasCourseUrl(value) {
  let url
  try { url = new URL(String(value)) } catch { throw new CanvasCourseImportError('Provide a valid Canvas course URL.') }
  if (url.protocol !== 'https:') throw new CanvasCourseImportError('Canvas course URLs must use HTTPS.')
  if (url.username || url.password) throw new CanvasCourseImportError('Do not put credentials in a Canvas course URL.')
  const match = url.pathname.match(/^\/courses\/(\d+)(?:\/|$)/)
  if (!match) throw new CanvasCourseImportError('Use a Canvas course URL such as https://canvas.example.edu/courses/123/modules.')
  return { origin: url.origin, courseId: match[1], courseUrl: url.toString() }
}

async function boundedBytes(response, maxBytes) {
  const declared = number(response.headers?.get?.('content-length'), 0)
  if (declared > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
    return bytes
  }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock?.()
  }
  return Buffer.concat(chunks, total)
}

function canvasApi({ origin, accessToken, fetchImpl }) {
  async function request(value, { accept = 'application/json' } = {}) {
    const url = new URL(value, origin)
    if (url.origin !== origin) throw new CanvasCourseImportError('Canvas API requests must stay on the supplied Canvas origin.')
    let response
    try {
      response = await fetchImpl(url, { headers: { accept, authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(CANVAS_IMPORT_LIMITS.timeoutMs) })
    } catch (error) {
      throw new CanvasCourseImportError(`Canvas could not be reached: ${error.message}`)
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new CanvasCourseImportError('Canvas rejected the local access token. Sign in to Canvas again and create or refresh a Personal Access Token; do not provide your password or OTP to Wicker Study.')
      throw new CanvasCourseImportError(`Canvas API request failed (${response.status}).`)
    }
    return response
  }

  return {
    async getJson(path) {
      const response = await request(path)
      try { return await response.json() } catch { throw new CanvasCourseImportError('Canvas returned an unreadable API response.') }
    },
    async getPaged(path) {
      const values = []
      let next = new URL(path, origin)
      for (let page = 0; next; page++) {
        if (page > 50) throw new CanvasCourseImportError('Canvas returned too many pagination pages.')
        const response = await request(next)
        let body
        try { body = await response.json() } catch { throw new CanvasCourseImportError('Canvas returned an unreadable paginated response.') }
        if (!Array.isArray(body)) throw new CanvasCourseImportError('Canvas returned an unexpected list response.')
        values.push(...body)
        next = nextPageUrl(response.headers?.get?.('link'), origin)
      }
      return values
    },
    async download(url, maxBytes) {
      let downloadUrl
      try { downloadUrl = new URL(url) } catch { throw new CanvasCourseImportError('Canvas returned an invalid file download URL.') }
      if (downloadUrl.protocol !== 'https:') throw new CanvasCourseImportError('Canvas returned a non-HTTPS file download URL.')
      const tryDownload = async (authorization = false) => {
        try {
          return await fetchImpl(downloadUrl, { headers: { accept: 'application/octet-stream, */*;q=0.8', ...(authorization ? { authorization: `Bearer ${accessToken}` } : {}) }, signal: AbortSignal.timeout(CANVAS_IMPORT_LIMITS.timeoutMs) })
        } catch (error) {
          throw new CanvasCourseImportError(`Canvas file could not be downloaded: ${error.message}`)
        }
      }
      let response = await tryDownload(false)
      if (response.status === 401 && downloadUrl.origin === origin) response = await tryDownload(true)
      if (!response.ok) throw new CanvasCourseImportError(`Canvas file download failed (${response.status}).`)
      return boundedBytes(response, maxBytes)
    }
  }
}

export async function importCanvasCourse({ courseUrl, accessToken, outputFolder, maxResources = CANVAS_IMPORT_LIMITS.maxResources, maxFileBytes = CANVAS_IMPORT_LIMITS.maxFileBytes, fetchImpl = fetch } = {}) {
  const canvas = parseCanvasCourseUrl(courseUrl)
  if (!text(accessToken, 20)) throw new CanvasCourseImportError('Set a Canvas Personal Access Token in a local environment variable. Do not pass a password or OTP to this importer.')
  if (!outputFolder || !String(outputFolder).trim()) throw new CanvasCourseImportError('outputFolder is required and should be a dedicated local course folder.')
  if (!Number.isInteger(maxResources) || maxResources < 1 || maxResources > CANVAS_IMPORT_LIMITS.maxResources) throw new CanvasCourseImportError(`maxResources must be between 1 and ${CANVAS_IMPORT_LIMITS.maxResources}.`)
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > CANVAS_IMPORT_LIMITS.maxFileBytes) throw new CanvasCourseImportError(`maxFileBytes must be between 1 byte and ${Math.round(CANVAS_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`)

  const root = resolve(String(outputFolder))
  await mkdir(root, { recursive: true })
  const api = canvasApi({ origin: canvas.origin, accessToken: String(accessToken), fetchImpl })
  const [course, modules, courseFiles] = await Promise.all([
    api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}`),
    api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/modules?include[]=items&per_page=100`),
    api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/files?per_page=100`)
  ])

  const courseName = text(course.name, 300) || `Canvas course ${canvas.courseId}`
  const downloadedFileIds = new Map()
  const records = []
  const skipped = []
  let resourceCount = 0
  const claimResource = (label) => {
    if (resourceCount >= maxResources) { skipped.push({ label, reason: `import limit (${maxResources})` }); return false }
    resourceCount++
    return true
  }
  const write = async (path, contents) => {
    await mkdir(resolve(path, '..'), { recursive: true })
    await writeFile(path, contents)
  }
  const courseFileById = new Map(courseFiles.map((file) => [String(file.id), file]))

  async function importFile(fileId, base, position, source = {}) {
    const id = String(fileId || '')
    if (!id) { skipped.push({ label: source.title || 'Canvas file', reason: 'no file identifier' }); return null }
    const existing = downloadedFileIds.get(id)
    if (existing) {
      const referencePath = pagePath(join(base, 'references'), position, source.title || existing.name, `file-${id}`, '.md')
      const link = relative(dirname(referencePath), join(root, existing.relativePath)).split('\\').join('/').replaceAll(' ', '%20')
      await write(referencePath, `# ${source.title || existing.name}\n\nThis Canvas file is already downloaded at [${existing.name}](${link}).\n`)
      records.push({ kind: 'file-reference', id, source, path: referencePath.slice(root.length + 1), target: existing.relativePath })
      return { ...existing, reused: true }
    }
    if (!claimResource(source.title || `Canvas file ${id}`)) return null
    try {
      const detail = courseFileById.get(id) || await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/files/${encodeURIComponent(id)}`)
      const itemName = filename(detail.display_name || detail.filename || source.title || `file-${id}`)
      const extension = extname(itemName) || '.bin'
      const outputPath = pagePath(join(base, fileCategory(itemName)), position, itemName.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), ''), `file-${id}`, extension)
      const bytes = await api.download(detail.url, maxFileBytes)
      await write(outputPath, bytes)
      const value = { id, name: itemName, relativePath: outputPath.slice(root.length + 1), bytes: bytes.length }
      downloadedFileIds.set(id, value)
      records.push({ kind: 'file', id, source, path: value.relativePath, bytes: bytes.length, mediaType: detail.content_type || null, canvasUrl: detail.url || null })
      return value
    } catch (error) {
      skipped.push({ label: source.title || `Canvas file ${id}`, reason: error.message })
      return null
    }
  }

  async function importTextItem(item, moduleBase, module) {
    const kind = String(item.type || '').toLowerCase()
    const itemId = String(item.id || item.content_id || `${module?.id || 'course'}-${item.position || 0}`)
    const source = { moduleId: module?.id || null, moduleName: module?.name || null, itemId, itemType: item.type || 'Unknown', title: text(item.title, 300) }
    if (kind === 'file') return importFile(item.content_id || item.content_details?.content_id, moduleBase, item.position, source)
    if (!claimResource(source.title || item.type || 'Canvas item')) return null
    try {
      if (kind === 'page') {
        const slug = item.page_url || item.url?.split('/').pop()
        if (!slug) throw new CanvasCourseImportError('Canvas page has no page URL.')
        const page = await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/pages/${encodeURIComponent(slug)}`)
        const outputPath = pagePath(join(moduleBase, 'pages'), item.position, page.title || item.title, `page-${itemId}`)
        await write(outputPath, htmlRecord({ title: page.title || item.title, url: `${canvas.origin}/courses/${canvas.courseId}/pages/${encodeURIComponent(slug)}`, body: page.body, details: [['Module', module?.name], ['Published', page.published ? 'Yes' : 'No']] }))
        records.push({ kind: 'page', id: itemId, source, path: outputPath.slice(root.length + 1) })
        return outputPath
      }
      if (kind === 'assignment') {
        const assignment = await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/assignments/${encodeURIComponent(item.content_id)}`)
        const outputPath = pagePath(join(moduleBase, 'assignments'), item.position, assignment.name || item.title, `assignment-${itemId}`)
        await write(outputPath, htmlRecord({ title: assignment.name || item.title, url: assignment.html_url, body: assignment.description, details: [['Due', assignment.due_at], ['Points possible', assignment.points_possible], ['Submission types', (assignment.submission_types || []).join(', ')]] }))
        records.push({ kind: 'assignment', id: itemId, source, path: outputPath.slice(root.length + 1) })
        return outputPath
      }
      if (kind === 'discussion') {
        const discussion = await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/discussion_topics/${encodeURIComponent(item.content_id)}`)
        const outputPath = pagePath(join(moduleBase, 'discussions'), item.position, discussion.title || item.title, `discussion-${itemId}`)
        await write(outputPath, htmlRecord({ title: discussion.title || item.title, url: discussion.html_url, body: discussion.message, details: [['Posted', discussion.posted_at], ['Discussion type', discussion.discussion_type]] }))
        records.push({ kind: 'discussion', id: itemId, source, path: outputPath.slice(root.length + 1) })
        return outputPath
      }
      if (kind === 'quiz') {
        const quiz = await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/quizzes/${encodeURIComponent(item.content_id)}`)
        const outputPath = pagePath(join(moduleBase, 'assessments'), item.position, quiz.title || item.title, `quiz-${itemId}`)
        await write(outputPath, htmlRecord({ title: quiz.title || item.title, url: quiz.html_url, body: quiz.description, details: [['Due', quiz.due_at], ['Points possible', quiz.points_possible], ['Time limit', quiz.time_limit ? `${quiz.time_limit} minutes` : null]] }))
        records.push({ kind: 'quiz', id: itemId, source, path: outputPath.slice(root.length + 1) })
        return outputPath
      }
      if (kind === 'externalurl' || kind === 'externaltool') {
        const url = item.external_url || item.html_url || item.url
        if (!url) throw new CanvasCourseImportError('Canvas external item has no URL.')
        const outputPath = pagePath(join(moduleBase, 'external-links'), item.position, item.title || 'External link', `link-${itemId}`, '.md')
        await write(outputPath, markdownLinkRecord({ title: item.title || 'Canvas external link', url, details: [['Module', module?.name], ['Item type', item.type]] }))
        records.push({ kind: 'external-link', id: itemId, source, path: outputPath.slice(root.length + 1), url })
        return outputPath
      }
      if (kind === 'subheader') return null
      const outputPath = pagePath(join(moduleBase, 'other'), item.position, item.title || item.type || 'Canvas item', `item-${itemId}`, '.md')
      await write(outputPath, `# ${item.title || item.type || 'Canvas item'}\n\nCanvas item type: ${item.type || 'Unknown'}\n${item.html_url ? `\nCanvas URL: ${item.html_url}\n` : ''}`)
      records.push({ kind: 'other', id: itemId, source, path: outputPath.slice(root.length + 1) })
      return outputPath
    } catch (error) {
      skipped.push({ label: source.title || item.type || 'Canvas item', reason: error.message })
      return null
    }
  }

  for (const module of modules.sort((left, right) => number(left.position) - number(right.position))) {
    const moduleBase = join(root, 'modules', `${prefix(module.position)} ${safeSegment(module.name)}--module-${safeSegment(module.id)}`)
    const hierarchy = []
    for (const item of (Array.isArray(module.items) ? module.items : []).sort((left, right) => number(left.position) - number(right.position))) {
      const indent = Math.min(12, Math.max(0, number(item.indent)))
      hierarchy.length = indent
      if (String(item.type || '').toLowerCase() === 'subheader') hierarchy[indent] = `${prefix(item.position)} ${safeSegment(item.title, 'section')}`
      await importTextItem(item, hierarchy.length ? join(moduleBase, ...hierarchy) : moduleBase, module)
    }
  }

  for (const [index, file] of courseFiles.entries()) {
    if (downloadedFileIds.has(String(file.id))) continue
    await importFile(file.id, join(root, 'unassigned-files'), index + 1, { moduleId: null, moduleName: null, itemId: String(file.id), itemType: 'File', title: file.display_name || file.filename })
  }

  const summary = {
    schemaVersion: 1,
    importedAt: new Date().toISOString(),
    source: { origin: canvas.origin, courseId: canvas.courseId, courseUrl: canvas.courseUrl },
    course: { id: String(course.id || canvas.courseId), name: courseName, code: text(course.course_code, 160), workflowState: text(course.workflow_state, 80) },
    modules: modules.map((module) => ({ id: String(module.id), name: text(module.name, 300), position: number(module.position), items: Array.isArray(module.items) ? module.items.length : 0 })),
    resources: records,
    skipped,
    limits: { maxResources, maxFileBytes }
  }
  await writeFile(join(root, '.wicker-canvas-import.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(join(root, 'README.md'), `# ${courseName}\n\nImported privately from Canvas on ${summary.importedAt.slice(0, 10)}.\n\n- Canvas course: ${canvas.courseUrl}\n- Modules found: ${modules.length}\n- Resources written: ${records.length}\n- Resources skipped: ${skipped.length}\n\nThis folder is a source snapshot. Keep it local until the administrator confirms they are authorised to submit the materials for editorial review. The hidden \`.wicker-canvas-import.json\` file records exactly what was found. Re-run the importer into this same folder to refresh changed or newly published Canvas material.\n`, 'utf8')

  return {
    root,
    course: summary.course,
    modules: modules.length,
    resources: records.length,
    downloadedFiles: [...downloadedFileIds.values()].length,
    skipped,
    manifestPath: join(root, '.wicker-canvas-import.json'),
    next: 'Review the local README and hidden import manifest. When authorised, use admin_sync_course_folder to create a candidate editorial source set; review candidates before accepting, extracting, or publishing.'
  }
}
