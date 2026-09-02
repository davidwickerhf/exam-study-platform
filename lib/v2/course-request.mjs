export const MAX_REQUEST_FILES = 8
export const MAX_REQUEST_FILE_BYTES = 10 * 1024 * 1024
export const MAX_REQUEST_TOTAL_BYTES = 30 * 1024 * 1024
export const REQUEST_CHUNK_BYTES = 512 * 1024
export const REQUEST_STATUS_LABEL = { submitted: 'Submitted', 'in-progress': 'In production', review: 'Quality review', published: 'Published', declined: 'Closed' }
const EXTENSIONS = new Set(['pdf', 'ppt', 'pptx', 'doc', 'docx', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'webp'])

export function validateRequestFiles(existing = [], incoming = []) {
  const merged = [...existing]
  for (const file of incoming) {
    if (merged.length >= MAX_REQUEST_FILES) throw new Error(`Attach at most ${MAX_REQUEST_FILES} files per submission.`)
    const extension = String(file.name || '').split('.').pop()?.toLowerCase()
    if (!extension || !EXTENSIONS.has(extension)) throw new Error(`Unsupported material file: ${file.name || 'unnamed file'}`)
    if (!Number.isFinite(file.size) || file.size <= 0) throw new Error(`${file.name || 'That file'} is empty.`)
    if (file.size > MAX_REQUEST_FILE_BYTES) throw new Error(`${file.name} is larger than 10 MB.`)
    if (!merged.some((candidate) => candidate.name === file.name && candidate.size === file.size)) merged.push(file)
  }
  if (merged.reduce((sum, file) => sum + file.size, 0) > MAX_REQUEST_TOTAL_BYTES) throw new Error('Attachments are limited to 30 MB per submission.')
  return merged
}

export function requestPayload({ course, academicYear = '', period = '', categories = [], urls = '', notes = '', consent = false, license = '', files = [] }) {
  const links = String(urls).split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  for (const value of links) {
    let url
    try { url = new URL(value) } catch { throw new Error(`Invalid material URL: ${value.slice(0, 80)}`) }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Material URLs must use http or https.')
  }
  if (!course?.id) throw new Error('This course is no longer in your academic record.')
  if (consent && !license) throw new Error('Choose why these materials may be considered for shared course content.')
  return { academicCourseId: course.id, academicYear, period: period || course.period || '', categories: [...new Set(categories)], urls: [...new Set(links)], notes: String(notes).trim(), contributionConsent: consent, contributionLicense: consent ? license : '', expectsFiles: files.length > 0 }
}

export function currentRequest(requests = []) {
  return requests.find((request) => !['published', 'declined'].includes(request.status)) || requests[0] || null
}

export function stageState(stages = [], request) {
  const active = Math.max(0, stages.findIndex((stage) => stage.id === request?.pipelineStage))
  return stages.map((stage, index) => ({ ...stage, state: request?.status === 'published' || index < active ? 'complete' : index === active ? 'current' : 'waiting' }))
}
