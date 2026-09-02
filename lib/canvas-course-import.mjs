import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

export const CANVAS_IMPORT_LIMITS = Object.freeze({
  // A single Canvas page can legitimately reference a large historical past-paper
  // archive. Keep a high, explicit guardrail rather than silently omitting the
  // useful part of a course snapshot.
  maxResources: 2_000,
  maxFileBytes: 1024 * 1024 * 1024,
  timeoutMs: 30_000,
  downloadTimeoutMs: 10 * 60_000
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

// The document that carries assessment rules, attendance requirements, and
// deadlines. Two places hold it, and the course usually uses only one: the
// Canvas Syllabus page — which typically contains a link to a PDF rather than
// the rules themselves — or a module item.
export const COURSE_REQUIREMENTS_PATTERN = /(syllabus|course\s*manual|coursemanual|course\s*outline|course\s*information|study\s*guide|handbook|assessment)/i

// Maastricht ships every course a Syllabus page pre-filled with a link to a
// how-to guide. A course still carrying it has published nothing, and treating
// that link as the syllabus would be worse than reporting none.
const SYLLABUS_PLACEHOLDER = /scribehow\.com|embed\s+(?:your\s+)?(?:the\s+)?course\s+syllabus/i

// Pull the documents a Canvas Syllabus page links to. Stylesheets and the
// institution's placeholder are not documents.
export function syllabusDocuments(html, { origin = '', courseId = '' } = {}) {
  const documents = []
  for (const match of String(html || '').matchAll(/<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    const label = text(match[2].replace(/<[^>]*>/g, ' '), 200)
    if (/\.css(\?|$)/i.test(href) || SYLLABUS_PLACEHOLDER.test(href) || SYLLABUS_PLACEHOLDER.test(label)) continue
    const fileId = (href.match(/\/files\/(\d+)/) || [])[1] || null
    const pageSlug = (href.match(new RegExp(`/courses/${courseId}/pages/([^/?#]+)`)) || [])[1] || null
    documents.push({
      title: label || 'Course syllabus',
      type: fileId ? 'File' : pageSlug ? 'Page' : 'ExternalUrl',
      contentId: fileId,
      pageSlug: pageSlug ? decodeSegment(pageSlug) : null,
      // A Canvas file link is fetchable through the account connection; an
      // external one is recorded but never followed.
      url: fileId && origin ? `${origin}/courses/${courseId}/files/${fileId}` : href,
      source: 'syllabus-page'
    })
  }
  return documents
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

export function sanitizeCanvasHtml(value) {
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

function markdownLinkIndex({ title, pageUrl, links }) {
  const entries = links.map((link) => `- [${link.url}](${link.url})${link.kind === 'canvas-page' ? ' — Canvas page' : link.kind === 'canvas-file' ? ' — Canvas file' : ''}`).join('\n')
  return `# Links from ${title}\n\nCanvas page: ${pageUrl}\n\n${entries || 'No links were found in this page.'}\n\nExternal references are recorded for review, not fetched. Canvas pages and files in this course are followed recursively when they can be accessed with the local Canvas account.\n`
}

function decodeSegment(value) {
  try { return decodeURIComponent(value) } catch { return value }
}

function uniqueLinks(value, baseUrl, origin, courseId) {
  const raw = String(value || '')
  const candidates = [
    ...raw.matchAll(/\b(?:href|src|data-api-endpoint)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi),
    ...raw.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)
  ].map((match) => match[1] || match[2] || match[3] || match[0]).filter(Boolean)
  const links = []
  const seen = new Set()
  for (const candidate of candidates) {
    let url
    try { url = new URL(candidate, baseUrl) } catch { continue }
    if (!['http:', 'https:'].includes(url.protocol)) continue
    url.hash = ''
    const key = url.toString()
    if (seen.has(key)) continue
    seen.add(key)
    const pageMatch = url.origin === origin && url.pathname.match(new RegExp(`^/courses/${courseId}/pages/([^/]+)$`))
    const fileMatch = url.origin === origin && url.pathname.match(new RegExp(`^/(?:courses/${courseId}/)?files/(\\d+)(?:/|$)`))
    links.push({
      url: key,
      kind: pageMatch ? 'canvas-page' : fileMatch ? 'canvas-file' : 'external',
      ...(pageMatch ? { pageSlug: decodeSegment(pageMatch[1]) } : {}),
      ...(fileMatch ? { fileId: fileMatch[1] } : {})
    })
  }
  return links
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

export function parseCanvasOrigin(value) {
  let url
  try { url = new URL(String(value)) } catch { throw new CanvasCourseImportError('Provide a valid Canvas URL.') }
  if (url.protocol !== 'https:') throw new CanvasCourseImportError('Canvas URLs must use HTTPS.')
  if (url.username || url.password) throw new CanvasCourseImportError('Do not put credentials in a Canvas URL.')
  return { origin: url.origin }
}

function initials(value) {
  return String(value || '').match(/[\p{L}\p{N}]+/gu)?.map((word) => word[0]).join('').toLowerCase() || ''
}

function courseSearchText(course) {
  return [course.name, course.courseCode, course.term?.name, initials(course.name), initials(course.term?.name)].filter(Boolean).join(' ').toLocaleLowerCase()
}

export function filterCanvasCourses(courses, query) {
  const needle = text(query, 240).toLocaleLowerCase()
  if (!needle) return [...courses]
  return courses.filter((course) => courseSearchText(course).includes(needle))
}

export function canvasCourseFolderName(course) {
  const period = course.term?.name || course.startAt?.slice(0, 10) || 'undated'
  const identity = course.courseCode || course.name || 'course'
  return `${safeSegment(period, 'undated')}--${safeSegment(identity, 'course')}--canvas-${safeSegment(course.id, 'course')}`
}

async function downloadResponseToFile(response, destinationPath, maxBytes) {
  const declared = number(response.headers?.get?.('content-length'), 0)
  if (declared > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
  const temporaryPath = `${destinationPath}.partial-${process.pid}-${Date.now()}`
  let total = 0
  await mkdir(dirname(destinationPath), { recursive: true })
  try {
    if (!response.body?.getReader) {
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
      await writeFile(temporaryPath, bytes)
      total = bytes.length
    } else {
      const writer = await open(temporaryPath, 'w')
      const reader = response.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          total += value.byteLength
          if (total > maxBytes) throw new CanvasCourseImportError(`Canvas file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB import limit.`)
          await writer.write(Buffer.from(value))
        }
      } finally {
        reader.releaseLock?.()
        await writer.close()
      }
    }
    await rename(temporaryPath, destinationPath)
    return total
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

export function createCanvasApi({ origin, accessToken, fetchImpl = fetch }) {
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
      if (response.status === 401) throw new CanvasCourseImportError(`Canvas returned HTTP 401 for ${url.pathname}. The importer sent the PAT correctly, but this Canvas host did not accept it. It may be expired, revoked, from another Canvas host, or Personal Access Token API access may be disabled by the institution.`)
      if (response.status === 403) throw new CanvasCourseImportError(`Canvas returned HTTP 403 for ${url.pathname}. The account or institution denied this API request. This does not by itself mean the PAT is incorrect; verify that the same Canvas account can open this course and that API access is permitted.`)
      if (response.status === 404) throw new CanvasCourseImportError(`Canvas returned HTTP 404 for ${url.pathname}. Confirm that the Modules URL belongs to a course available to the signed-in account.`)
      throw new CanvasCourseImportError(`Canvas API request failed (HTTP ${response.status}) at ${url.pathname}.`)
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
    async downloadToFile(url, destinationPath, maxBytes) {
      let downloadUrl
      try { downloadUrl = new URL(url) } catch { throw new CanvasCourseImportError('Canvas returned an invalid file download URL.') }
      if (downloadUrl.protocol !== 'https:') throw new CanvasCourseImportError('Canvas returned a non-HTTPS file download URL.')
      const tryDownload = async (authorization = false) => {
        try {
          return await fetchImpl(downloadUrl, { headers: { accept: 'application/octet-stream, */*;q=0.8', ...(authorization ? { authorization: `Bearer ${accessToken}` } : {}) }, signal: AbortSignal.timeout(CANVAS_IMPORT_LIMITS.downloadTimeoutMs) })
        } catch (error) {
          throw new CanvasCourseImportError(`Canvas file could not be downloaded: ${error.message}`)
        }
      }
      let response = await tryDownload(false)
      if (response.status === 401 && downloadUrl.origin === origin) response = await tryDownload(true)
      if (!response.ok) throw new CanvasCourseImportError(`Canvas file download failed (${response.status}).`)
      return downloadResponseToFile(response, destinationPath, maxBytes)
    }
  }
}

export async function listCanvasCourses({ canvasUrl, accessToken, fetchImpl = fetch } = {}) {
  const canvas = parseCanvasOrigin(canvasUrl)
  if (!text(accessToken, 20)) throw new CanvasCourseImportError('A Canvas Personal Access Token is required. Use the local macOS Keychain; never pass a password or OTP.')
  const api = createCanvasApi({ origin: canvas.origin, accessToken: String(accessToken), fetchImpl })
  const account = await api.getJson('/api/v1/users/self/profile')
  const courses = await api.getPaged('/api/v1/users/self/courses?enrollment_state=all&include[]=term&include[]=enrollments&per_page=100')
  return {
    origin: canvas.origin,
    account: { id: String(account.id || ''), name: text(account.name, 300) || null },
    courses: courses.map((course) => ({
      id: String(course.id || ''),
      name: text(course.name, 300) || `Canvas course ${course.id}`,
      courseCode: text(course.course_code, 160) || null,
      workflowState: text(course.workflow_state, 80) || null,
      startAt: course.start_at || null,
      endAt: course.end_at || null,
      term: course.term ? { id: String(course.term.id || ''), name: text(course.term.name, 300) || null, startAt: course.term.start_at || null, endAt: course.term.end_at || null } : null,
      enrolments: Array.isArray(course.enrollments) ? course.enrollments.map((enrolment) => ({ type: text(enrolment.type, 100) || null, role: text(enrolment.role, 160) || null, state: text(enrolment.enrollment_state, 80) || null })) : [],
      courseUrl: `${canvas.origin}/courses/${encodeURIComponent(course.id)}/modules`
    })).filter((course) => course.id)
  }
}

export async function listCanvasCourseModules({ courseUrl, accessToken, fetchImpl = fetch } = {}) {
  const canvas = parseCanvasCourseUrl(courseUrl)
  if (!text(accessToken, 20)) throw new CanvasCourseImportError('A Canvas Personal Access Token is required. Use the local macOS Keychain; never pass a password or OTP.')
  const api = createCanvasApi({ origin: canvas.origin, accessToken: String(accessToken), fetchImpl })
  await api.getJson('/api/v1/users/self/profile')
  const [course, modules] = await Promise.all([
    // Canvas exposes a course's rich-text syllabus separately from its Files
    // index. Ask for it explicitly: many institutions place the assessment
    // scheme here rather than in a module or PDF.
    api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}?include[]=syllabus_body`),
    api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/modules?include[]=items&per_page=100`)
  ])
  const mapped = modules.sort((left, right) => number(left.position) - number(right.position)).map((module) => ({
    id: String(module.id || ''),
    name: text(module.name, 300) || 'Untitled module',
    position: number(module.position),
    items: Array.isArray(module.items) ? module.items.map((item) => ({
      id: String(item.id || ''),
      title: text(item.title, 300) || item.type || 'Untitled item',
      type: text(item.type, 80) || 'Unknown',
      indent: number(item.indent),
      contentId: item.content_id ? String(item.content_id) : null,
      pageSlug: item.page_url ? text(item.page_url, 200) : null,
      url: item.html_url ? text(item.html_url, 500) : null
    })) : []
  })).filter((module) => module.id)

  // The syllabus field was fetched above; hand it back rather than dropping it,
  // and say plainly when it is only a pointer. A field this short is a filename
  // or an unfilled placeholder, not the rules — the real document is the module
  // item flagged below, and it still has to be read.
  const rawSyllabus = String(course.syllabus_body || '')
  const syllabusHtml = sanitizeCanvasHtml(rawSyllabus)
  const syllabusText = text(String(syllabusHtml).replace(/<[^>]*>/g, ' '), 20_000)
  const placeholder = SYLLABUS_PLACEHOLDER.test(rawSyllabus)
  // Both places, in the order a reader should try them: the Syllabus page is
  // where a course is supposed to put this, and a module item is where it ends
  // up when the page was left as the institution's template.
  const seenDocuments = new Set()
  const requirementItems = [
    ...syllabusDocuments(rawSyllabus, { origin: canvas.origin, courseId: canvas.courseId }),
    ...mapped.flatMap((module) => module.items
      .filter((item) => COURSE_REQUIREMENTS_PATTERN.test(item.title) && ['File', 'Page', 'Attachment'].includes(item.type))
      .map((item) => ({ ...item, module: module.name, source: 'module' })))
  ].filter((item) => {
    // A course often carries the same document twice — linked from the Syllabus
    // page and uploaded again as a module item, sometimes under different file
    // ids. One entry is what a reader needs, and the Syllabus-page one comes
    // first, so match on the filename as well as the id.
    const name = String(item.title || '').trim().toLowerCase()
    const keys = [item.contentId ? `file:${item.contentId}` : item.pageSlug ? `page:${item.pageSlug}` : `url:${item.url}`, name ? `name:${name}` : null].filter(Boolean)
    if (keys.some((key) => seenDocuments.has(key))) return false
    for (const key of keys) seenDocuments.add(key)
    return true
  })

  return {
    origin: canvas.origin,
    course: { id: String(course.id || canvas.courseId), name: text(course.name, 300) || `Canvas course ${canvas.courseId}`, courseCode: text(course.course_code, 160) || null, workflowState: text(course.workflow_state, 80) || null, courseUrl: canvas.courseUrl },
    syllabus: {
      html: syllabusHtml || null,
      text: syllabusText || null,
      // 200 characters of rich text is not a syllabus. Say so rather than
      // letting a reader treat a filename as the course requirements.
      substantive: syllabusText.length >= 200 && !placeholder,
      placeholder,
      note: syllabusText.length >= 200 && !placeholder ? null
        : placeholder ? 'This course still has the institution’s empty syllabus template. Nothing has been published on the Syllabus page.'
          : requirementItems.some((item) => item.source === 'syllabus-page') ? 'The Canvas Syllabus page links to the document rather than containing it. Read the item in requirementItems.'
            : requirementItems.length ? 'This course has no Canvas syllabus text; the requirements document is a module item. Read the item in requirementItems.'
              : 'This course has published no syllabus text and links to no document.'
    },
    requirementItems,
    modules: mapped
  }
}

export async function importCanvasCourse({ courseUrl, accessToken, outputFolder, moduleIds, maxResources = CANVAS_IMPORT_LIMITS.maxResources, maxFileBytes = CANVAS_IMPORT_LIMITS.maxFileBytes, fetchImpl = fetch } = {}) {
  const canvas = parseCanvasCourseUrl(courseUrl)
  if (!text(accessToken, 20)) throw new CanvasCourseImportError('A Canvas Personal Access Token is required. Use the local hidden prompt or a local environment variable; never pass a password or OTP to this importer.')
  if (!outputFolder || !String(outputFolder).trim()) throw new CanvasCourseImportError('outputFolder is required and should be a dedicated local course folder.')
  if (moduleIds !== undefined && (!Array.isArray(moduleIds) || !moduleIds.length || moduleIds.length > 500 || moduleIds.some((id) => !text(id, 200)))) throw new CanvasCourseImportError('moduleIds must be a non-empty array of up to 500 Canvas module identifiers.')
  if (!Number.isInteger(maxResources) || maxResources < 1 || maxResources > CANVAS_IMPORT_LIMITS.maxResources) throw new CanvasCourseImportError(`maxResources must be between 1 and ${CANVAS_IMPORT_LIMITS.maxResources}.`)
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > CANVAS_IMPORT_LIMITS.maxFileBytes) throw new CanvasCourseImportError(`maxFileBytes must be between 1 byte and ${Math.round(CANVAS_IMPORT_LIMITS.maxFileBytes / 1024 / 1024)} MB.`)

  const root = resolve(String(outputFolder))
  await mkdir(root, { recursive: true })
  const manifestPath = join(root, '.wicker-canvas-import.json')
  const entries = await readdir(root)
  let previousManifest = null
  try {
    previousManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw new CanvasCourseImportError('The existing Canvas import manifest could not be read. Choose a new folder or repair that manifest before importing again.')
  }
  const nonImportEntries = entries.filter((entry) => !['.DS_Store', '.wicker-canvas-import.json'].includes(entry))
  if (nonImportEntries.length && !previousManifest) throw new CanvasCourseImportError('Choose a new empty output folder, or a folder created by an earlier Wicker Study Canvas import. This prevents overwriting unrelated files.')
  const api = createCanvasApi({ origin: canvas.origin, accessToken: String(accessToken), fetchImpl })
  // Verify authentication independently before checking course-specific access. This
  // turns an opaque token error into a useful, non-sensitive diagnosis.
  await api.getJson('/api/v1/users/self/profile')
  const [course, modules] = await Promise.all([
    // Canvas does not include the rich-text Syllabus page in a plain course
    // response. Request it explicitly so an import matches what students see
    // under the course's dedicated Syllabus navigation item.
    api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}?include[]=syllabus_body`),
    api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/modules?include[]=items&per_page=100`)
  ])

  const requestedModuleIds = moduleIds === undefined ? null : new Set(moduleIds.map((id) => String(id)))
  const selectedModules = requestedModuleIds ? modules.filter((module) => requestedModuleIds.has(String(module.id))) : modules
  if (requestedModuleIds) {
    const missingModuleIds = [...requestedModuleIds].filter((id) => !selectedModules.some((module) => String(module.id) === id))
    if (missingModuleIds.length) throw new CanvasCourseImportError('One or more selected Canvas modules were not found in this course.')
  }

  const courseName = text(course.name, 300) || `Canvas course ${canvas.courseId}`
  const downloadedFileIds = new Map()
  const records = []
  const skipped = []
  // Canvas installations can allow access to a course's Modules API while denying
  // the course-wide Files index. The latter is a useful supplement, never a reason
  // to discard accessible module material.
  let courseFiles = []
  try {
    courseFiles = await api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/files?per_page=100`)
  } catch (error) {
    if (error instanceof CanvasCourseImportError && (
      /HTTP (403|404) for \/api\/v1\/courses\/.+\/files/.test(error.message) ||
      /Canvas denied access to \/api\/v1\/courses\/.+\/files/.test(error.message)
    )) {
      skipped.push({ label: 'Course-wide Files listing', reason: error.message })
    } else {
      throw error
    }
  }
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
  const importedPageSlugs = new Set()
  const importedAssignmentIds = new Set()
  const importedQuizIds = new Set()
  const importedDiscussionIds = new Set()
  let linkedPagePosition = 0
  let linkedFilePosition = 0
  let linkedIndexPosition = 0

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
      const bytes = await api.downloadToFile(detail.url, outputPath, maxFileBytes)
      const value = { id, name: itemName, relativePath: outputPath.slice(root.length + 1), bytes }
      downloadedFileIds.set(id, value)
      records.push({ kind: 'file', id, source, path: value.relativePath, bytes, mediaType: detail.content_type || null, canvasUrl: detail.url || null })
      return value
    } catch (error) {
      skipped.push({ label: source.title || `Canvas file ${id}`, reason: error.message })
      return null
    }
  }

  async function importPage({ slug, base, position, title, source = {} }) {
    const pageSlug = text(slug, 300)
    if (!pageSlug) { skipped.push({ label: title || 'Canvas page', reason: 'no page URL' }); return null }
    if (importedPageSlugs.has(pageSlug)) return null
    if (!claimResource(title || 'Canvas page')) return null
    // Register before following page links so a circular page graph cannot loop
    // forever (a common pattern in Canvas navigation pages).
    importedPageSlugs.add(pageSlug)
    try {
      const page = await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/pages/${encodeURIComponent(pageSlug)}`)
      const pageTitle = page.title || title || 'Canvas page'
      const pageUrl = `${canvas.origin}/courses/${canvas.courseId}/pages/${encodeURIComponent(pageSlug)}`
      const outputPath = pagePath(base, position, pageTitle, `page-${pageSlug}`)
      await write(outputPath, htmlRecord({ title: pageTitle, url: pageUrl, body: page.body, details: [['Module', source.moduleName], ['Published', page.published ? 'Yes' : 'No']] }))
      const links = uniqueLinks(page.body, pageUrl, canvas.origin, canvas.courseId)
      const relativePath = outputPath.slice(root.length + 1)
      records.push({ kind: 'page', id: pageSlug, source, path: relativePath, canvasUrl: pageUrl, links })

      await indexAndFollowLinks({ title: pageTitle, pageUrl, body: page.body, outputPath, source, id: `page-${pageSlug}`, links })
      return outputPath
    } catch (error) {
      skipped.push({ label: title || 'Canvas page', reason: error.message })
      return null
    }
  }

  // Canvas descriptions frequently contain the actual handout trail: old
  // exams on a page linked from an assignment, the syllabus attached from a
  // quiz, or a later page with a revised rubric. Keep a small, reviewable URL
  // index beside every rich-text record, follow only same-course pages/files,
  // and never crawl a third-party site.
  async function indexAndFollowLinks({ title, pageUrl, body, outputPath, source, id, links = null }) {
    const resolvedLinks = links || uniqueLinks(body, pageUrl, canvas.origin, canvas.courseId)
    if (!resolvedLinks.length) return
    linkedIndexPosition++
    const linksPath = pagePath(join(dirname(outputPath), 'link-index'), linkedIndexPosition, `${title} links`, `links-${id}`, '.md')
    await write(linksPath, markdownLinkIndex({ title, pageUrl, links: resolvedLinks }))
    records.push({ kind: 'link-index', id: `links-${id}`, source, path: linksPath.slice(root.length + 1), page: outputPath.slice(root.length + 1), links: resolvedLinks })
    for (const link of resolvedLinks) {
      if (link.kind === 'canvas-file') {
        linkedFilePosition++
        await importFile(link.fileId, join(root, 'linked-files'), linkedFilePosition, {
          ...source,
          itemId: `${source.itemId || id}-file-${link.fileId}`,
          itemType: 'Canvas link',
          title: `${title} linked file`
        })
      }
      if (link.kind === 'canvas-page') {
        linkedPagePosition++
        await importPage({
          slug: link.pageSlug,
          base: join(root, 'linked-pages'),
          position: linkedPagePosition,
          title: `${title} linked page`,
          source: { ...source, itemId: `${source.itemId || id}-page-${link.pageSlug}`, itemType: 'Canvas link', title, linkedFromPage: id }
        })
      }
    }
  }

  async function importAssignment({ assignmentId, base, position, source, initial = null }) {
    const id = String(assignmentId || '')
    if (!id) { skipped.push({ label: source.title || 'Canvas assignment', reason: 'no assignment identifier' }); return null }
    if (importedAssignmentIds.has(id)) return null
    importedAssignmentIds.add(id)
    if (!claimResource(source.title || `Canvas assignment ${id}`)) return null
    try {
      const assignment = initial && Object.hasOwn(initial, 'description') ? initial : await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/assignments/${encodeURIComponent(id)}`)
      const title = assignment.name || source.title || 'Canvas assignment'
      const outputPath = pagePath(join(base, 'assignments'), position, title, `assignment-${id}`)
      await write(outputPath, htmlRecord({ title, url: assignment.html_url, body: assignment.description, details: [['Due', assignment.due_at], ['Unlocks', assignment.unlock_at], ['Available until', assignment.lock_at], ['Points possible', assignment.points_possible], ['Submission types', (assignment.submission_types || []).join(', ')], ['Grading type', assignment.grading_type]] }))
      const links = uniqueLinks(assignment.description, assignment.html_url || `${canvas.origin}/courses/${canvas.courseId}/assignments/${id}`, canvas.origin, canvas.courseId)
      records.push({ kind: 'assignment', id, source, path: outputPath.slice(root.length + 1), canvasUrl: assignment.html_url || null, links })
      await indexAndFollowLinks({ title, pageUrl: assignment.html_url || `${canvas.origin}/courses/${canvas.courseId}/assignments/${id}`, body: assignment.description, outputPath, source, id: `assignment-${id}`, links })
      return outputPath
    } catch (error) {
      skipped.push({ label: source.title || `Canvas assignment ${id}`, reason: error.message })
      return null
    }
  }

  async function importDiscussion({ discussionId, base, position, source, initial = null }) {
    const id = String(discussionId || '')
    if (!id) { skipped.push({ label: source.title || 'Canvas discussion', reason: 'no discussion identifier' }); return null }
    if (importedDiscussionIds.has(id)) return null
    importedDiscussionIds.add(id)
    if (!claimResource(source.title || `Canvas discussion ${id}`)) return null
    try {
      const discussion = initial && Object.hasOwn(initial, 'message') ? initial : await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/discussion_topics/${encodeURIComponent(id)}`)
      const title = discussion.title || source.title || 'Canvas discussion'
      const outputPath = pagePath(join(base, 'discussions'), position, title, `discussion-${id}`)
      await write(outputPath, htmlRecord({ title, url: discussion.html_url, body: discussion.message, details: [['Posted', discussion.posted_at], ['Discussion type', discussion.discussion_type], ['Due', discussion.delayed_post_at]] }))
      const links = uniqueLinks(discussion.message, discussion.html_url || `${canvas.origin}/courses/${canvas.courseId}/discussion_topics/${id}`, canvas.origin, canvas.courseId)
      records.push({ kind: 'discussion', id, source, path: outputPath.slice(root.length + 1), canvasUrl: discussion.html_url || null, links })
      await indexAndFollowLinks({ title, pageUrl: discussion.html_url || `${canvas.origin}/courses/${canvas.courseId}/discussion_topics/${id}`, body: discussion.message, outputPath, source, id: `discussion-${id}`, links })
      return outputPath
    } catch (error) {
      skipped.push({ label: source.title || `Canvas discussion ${id}`, reason: error.message })
      return null
    }
  }

  async function importQuiz({ quizId, base, position, source, initial = null }) {
    const id = String(quizId || '')
    if (!id) { skipped.push({ label: source.title || 'Canvas quiz', reason: 'no quiz identifier' }); return null }
    if (importedQuizIds.has(id)) return null
    importedQuizIds.add(id)
    if (!claimResource(source.title || `Canvas quiz ${id}`)) return null
    try {
      const quiz = initial && Object.hasOwn(initial, 'description') ? initial : await api.getJson(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/quizzes/${encodeURIComponent(id)}`)
      const title = quiz.title || source.title || 'Canvas quiz'
      const outputPath = pagePath(join(base, 'assessments'), position, title, `quiz-${id}`)
      await write(outputPath, htmlRecord({ title, url: quiz.html_url, body: quiz.description, details: [['Due', quiz.due_at], ['Unlocks', quiz.unlock_at], ['Available until', quiz.lock_at], ['Points possible', quiz.points_possible], ['Time limit', quiz.time_limit ? `${quiz.time_limit} minutes` : null], ['Allowed attempts', quiz.allowed_attempts]] }))
      const links = uniqueLinks(quiz.description, quiz.html_url || `${canvas.origin}/courses/${canvas.courseId}/quizzes/${id}`, canvas.origin, canvas.courseId)
      records.push({ kind: 'quiz', id, source, path: outputPath.slice(root.length + 1), canvasUrl: quiz.html_url || null, links })
      await indexAndFollowLinks({ title, pageUrl: quiz.html_url || `${canvas.origin}/courses/${canvas.courseId}/quizzes/${id}`, body: quiz.description, outputPath, source, id: `quiz-${id}`, links })

      // Question access differs by Canvas role and by whether a course uses
      // New Quizzes. Capture the question bank when this account may read it;
      // otherwise the quiz overview remains useful and the skip is explicit.
      try {
        const questions = await api.getPaged(`/api/v1/courses/${encodeURIComponent(canvas.courseId)}/quizzes/${encodeURIComponent(id)}/questions?per_page=100`)
        if (questions.length && claimResource(`${title} question bank`)) {
          const questionBody = questions.map((question, index) => `<section><h2>${escapeHtml(question.question_name || question.question_type || `Question ${index + 1}`)}</h2><dl><dt>Points possible</dt><dd>${escapeHtml(question.points_possible ?? '')}</dd></dl>${sanitizeCanvasHtml(question.question_text || question.question || '') || '<p>No question text was returned.</p>'}</section>`).join('\n')
          const questionsPath = pagePath(join(dirname(outputPath), 'questions'), position, `${title} questions`, `quiz-${id}-questions`)
          await write(questionsPath, htmlRecord({ title: `${title} — accessible questions`, url: quiz.html_url, body: questionBody, details: [['Questions returned', questions.length]] }))
          records.push({ kind: 'quiz-questions', id: `quiz-${id}-questions`, source, path: questionsPath.slice(root.length + 1), quizId: id, count: questions.length })
        }
      } catch (error) {
        skipped.push({ label: `${title} question bank`, reason: error.message })
      }
      return outputPath
    } catch (error) {
      skipped.push({ label: source.title || `Canvas quiz ${id}`, reason: error.message })
      return null
    }
  }

  async function importTextItem(item, moduleBase, module) {
    const kind = String(item.type || '').toLowerCase()
    const itemId = String(item.id || item.content_id || `${module?.id || 'course'}-${item.position || 0}`)
    const source = { moduleId: module?.id || null, moduleName: module?.name || null, itemId, itemType: item.type || 'Unknown', title: text(item.title, 300) }
    if (kind === 'file') return importFile(item.content_id || item.content_details?.content_id, moduleBase, item.position, source)
    if (kind === 'subheader') return null
    try {
      if (kind === 'page') {
        const slug = item.page_url || item.url?.split('/').pop()
        return importPage({ slug, base: join(moduleBase, 'pages'), position: item.position, title: item.title, source })
      }
      if (kind === 'assignment') {
        return importAssignment({ assignmentId: item.content_id, base: moduleBase, position: item.position, source })
      }
      if (kind === 'discussion') {
        return importDiscussion({ discussionId: item.content_id, base: moduleBase, position: item.position, source })
      }
      if (kind === 'quiz') {
        return importQuiz({ quizId: item.content_id, base: moduleBase, position: item.position, source })
      }
      if (!claimResource(source.title || item.type || 'Canvas item')) return null
      if (kind === 'externalurl' || kind === 'externaltool') {
        const url = item.external_url || item.html_url || item.url
        if (!url) throw new CanvasCourseImportError('Canvas external item has no URL.')
        const outputPath = pagePath(join(moduleBase, 'external-links'), item.position, item.title || 'External link', `link-${itemId}`, '.md')
        await write(outputPath, markdownLinkRecord({ title: item.title || 'Canvas external link', url, details: [['Module', module?.name], ['Item type', item.type]] }))
        records.push({ kind: 'external-link', id: itemId, source, path: outputPath.slice(root.length + 1), url })
        return outputPath
      }
      const outputPath = pagePath(join(moduleBase, 'other'), item.position, item.title || item.type || 'Canvas item', `item-${itemId}`, '.md')
      await write(outputPath, `# ${item.title || item.type || 'Canvas item'}\n\nCanvas item type: ${item.type || 'Unknown'}\n${item.html_url ? `\nCanvas URL: ${item.html_url}\n` : ''}`)
      records.push({ kind: 'other', id: itemId, source, path: outputPath.slice(root.length + 1) })
      return outputPath
    } catch (error) {
      skipped.push({ label: source.title || item.type || 'Canvas item', reason: error.message })
      return null
    }
  }

  for (const module of selectedModules.sort((left, right) => number(left.position) - number(right.position))) {
    const moduleBase = join(root, 'modules', `${prefix(module.position)} ${safeSegment(module.name)}--module-${safeSegment(module.id)}`)
    const hierarchy = []
    for (const item of (Array.isArray(module.items) ? module.items : []).sort((left, right) => number(left.position) - number(right.position))) {
      const indent = Math.min(12, Math.max(0, number(item.indent)))
      hierarchy.length = indent
      if (String(item.type || '').toLowerCase() === 'subheader') hierarchy[indent] = `${prefix(item.position)} ${safeSegment(item.title, 'section')}`
      // Canvas is allowed to indent an item without supplying a preceding
      // SubHeader. Omit those missing ancestors instead of passing `undefined`
      // into path.join and aborting an otherwise valid course import.
      const ancestors = hierarchy.filter(Boolean)
      await importTextItem(item, ancestors.length ? join(moduleBase, ...ancestors) : moduleBase, module)
    }
  }

  // A syllabus commonly sits outside Modules, and Canvas can leave due work
  // ungrouped. Preserve that course-level context even when the learner chose
  // only a handful of modules; it is what lets a later local agent distinguish
  // an old assessment scheme from the current one.
  const courseContextBase = join(root, 'course-information')
  if (claimResource('Course overview and syllabus')) {
    const syllabusUrl = course.syllabus_url || `${canvas.origin}/courses/${canvas.courseId}/assignments/syllabus`
    const overviewPath = pagePath(courseContextBase, 1, course.syllabus_body ? 'Syllabus and course overview' : 'Course overview', `course-${canvas.courseId}`)
    const overviewBody = course.syllabus_body || '<p>Canvas did not return a rich-text syllabus. Check the separately downloaded course files and the Canvas syllabus link.</p>'
    await write(overviewPath, htmlRecord({ title: course.syllabus_body ? `${courseName} — syllabus` : `${courseName} — overview`, url: syllabusUrl, body: overviewBody, details: [['Course code', course.course_code], ['Workflow state', course.workflow_state], ['Starts', course.start_at], ['Ends', course.end_at], ['Public syllabus URL', course.public_syllabus ? syllabusUrl : null]] }))
    const links = uniqueLinks(course.syllabus_body, syllabusUrl, canvas.origin, canvas.courseId)
    records.push({ kind: course.syllabus_body ? 'syllabus' : 'course-overview', id: `course-${canvas.courseId}`, source: { moduleId: null, moduleName: null, itemId: `course-${canvas.courseId}`, itemType: 'Course', title: courseName }, path: overviewPath.slice(root.length + 1), canvasUrl: syllabusUrl, links })
    await indexAndFollowLinks({ title: `${courseName} syllabus`, pageUrl: syllabusUrl, body: course.syllabus_body, outputPath: overviewPath, source: { moduleId: null, moduleName: null, itemId: `course-${canvas.courseId}`, itemType: 'Course', title: courseName }, id: `course-${canvas.courseId}`, links })
  }

  async function optionalCourseCollection(label, path) {
    try {
      return await api.getPaged(path)
    } catch (error) {
      // These endpoints are often deliberately restricted for students, while
      // module items remain readable. The private snapshot should still finish
      // and make the missing collection visible in its manifest.
      skipped.push({ label, reason: error instanceof Error ? error.message : String(error) })
      return []
    }
  }

  const [courseAssignments, courseQuizzes, courseDiscussions, coursePages] = await Promise.all([
    optionalCourseCollection('Course-wide assignments listing', `/api/v1/courses/${encodeURIComponent(canvas.courseId)}/assignments?per_page=100`),
    optionalCourseCollection('Course-wide quizzes listing', `/api/v1/courses/${encodeURIComponent(canvas.courseId)}/quizzes?per_page=100`),
    optionalCourseCollection('Course-wide discussions listing', `/api/v1/courses/${encodeURIComponent(canvas.courseId)}/discussion_topics?per_page=100`),
    requestedModuleIds ? Promise.resolve([]) : optionalCourseCollection('Course-wide Pages listing', `/api/v1/courses/${encodeURIComponent(canvas.courseId)}/pages?per_page=100`)
  ])
  for (const [index, assignment] of courseAssignments.entries()) {
    const id = String(assignment.id || '')
    if (!id || importedAssignmentIds.has(id)) continue
    await importAssignment({ assignmentId: id, base: join(root, 'course-assessments'), position: index + 1, source: { moduleId: null, moduleName: null, itemId: id, itemType: 'Course assignment', title: text(assignment.name, 300) }, initial: assignment })
  }
  for (const [index, quiz] of courseQuizzes.entries()) {
    const id = String(quiz.id || '')
    if (!id || importedQuizIds.has(id)) continue
    await importQuiz({ quizId: id, base: join(root, 'course-assessments'), position: index + 1, source: { moduleId: null, moduleName: null, itemId: id, itemType: 'Course quiz', title: text(quiz.title, 300) }, initial: quiz })
  }
  for (const [index, discussion] of courseDiscussions.entries()) {
    const id = String(discussion.id || '')
    if (!id || importedDiscussionIds.has(id)) continue
    await importDiscussion({ discussionId: id, base: join(root, 'course-communications'), position: index + 1, source: { moduleId: null, moduleName: null, itemId: id, itemType: 'Course discussion', title: text(discussion.title, 300) }, initial: discussion })
  }

  // Lecturers often publish wiki pages through the Pages navigation without
  // adding them to a module. Enumerate that collection during a full archive;
  // importPage deduplicates anything already reached through modules or links.
  for (const [index, page] of coursePages.entries()) {
    const pageSlug = text(page.url || page.page_url, 300)
    if (!pageSlug || importedPageSlugs.has(pageSlug)) continue
    await importPage({
      slug: pageSlug,
      base: join(root, 'course-pages'),
      position: index + 1,
      title: page.title || pageSlug,
      source: { moduleId: null, moduleName: null, itemId: pageSlug, itemType: 'Course page', title: text(page.title, 300) }
    })
  }

  for (const [index, file] of courseFiles.entries()) {
    if (downloadedFileIds.has(String(file.id))) continue
    await importFile(file.id, join(root, 'unassigned-files'), index + 1, { moduleId: null, moduleName: null, itemId: String(file.id), itemType: 'File', title: file.display_name || file.filename })
  }

  const priorPaths = new Set(Array.isArray(previousManifest?.resources) ? previousManifest.resources.map((resource) => String(resource.path || '')).filter(Boolean) : [])
  const currentPaths = new Set(records.map((resource) => String(resource.path || '')).filter(Boolean))
  const staleLocalResources = requestedModuleIds ? [] : [...priorPaths].filter((path) => !currentPaths.has(path)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const summary = {
    schemaVersion: 2,
    importedAt: new Date().toISOString(),
    source: { origin: canvas.origin, courseId: canvas.courseId, courseUrl: canvas.courseUrl },
    course: { id: String(course.id || canvas.courseId), name: courseName, code: text(course.course_code, 160), workflowState: text(course.workflow_state, 80) },
    modules: selectedModules.map((module) => ({ id: String(module.id), name: text(module.name, 300), position: number(module.position), items: Array.isArray(module.items) ? module.items.length : 0 })),
    selection: requestedModuleIds ? { moduleIds: [...requestedModuleIds] } : { moduleIds: null },
    resources: records,
    skipped,
    staleLocalResources,
    limits: { maxResources, maxFileBytes }
  }
  await writeFile(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(join(root, 'README.md'), `# ${courseName}\n\nImported privately from Canvas on ${summary.importedAt.slice(0, 10)}.\n\n- Canvas course: ${canvas.courseUrl}\n- Modules included: ${selectedModules.length}${requestedModuleIds ? ' (chosen subset)' : ''}\n- Resources written: ${records.length}\n- Resources skipped: ${skipped.length}\n- Previous imported paths no longer found: ${staleLocalResources.length}\n\nThe snapshot includes the Canvas rich-text syllabus when the account can read it, plus separately uploaded course files (including syllabus/course-manual files), module material, standalone course Pages, accessible course-wide assignments, quizzes, discussions, and question banks where Canvas permits question access. Canvas pages are followed recursively when they link to another page in this same course. File links in rich-text records are downloaded when accessible; every HTTP(S) reference is compiled into a nearby \`link-index\` file and the hidden manifest. External sites are recorded, never crawled.\n\nThis folder is a source snapshot. Keep it local until the administrator confirms they are authorised to submit the materials for editorial review. The hidden \`.wicker-canvas-import.json\` file records exactly what was found. Re-run the importer into this same folder to refresh changed or newly published Canvas material. Paths no longer returned by Canvas are listed in that manifest for review; they are never deleted automatically.\n`, 'utf8')

  return {
    root,
    course: summary.course,
    modules: selectedModules.length,
    resources: records.length,
    downloadedFiles: [...downloadedFileIds.values()].length,
    skipped,
    manifestPath,
    staleLocalResources,
    next: `Review the local README and hidden import manifest${staleLocalResources.length ? `, including ${staleLocalResources.length} prior path${staleLocalResources.length === 1 ? '' : 's'} no longer returned by Canvas` : ''}. When authorised, use admin_sync_course_folder to create a candidate editorial source set; review candidates before accepting, extracting, or publishing.`
  }
}
