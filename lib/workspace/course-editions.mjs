import { curriculumCourseIdentity } from '../course-identities.mjs'
import { courseMaterialCodes } from './course-detail.mjs'

export const editionYear = value => {
  const normalized = String(value || '').trim().replace(/\s*[-–—/]\s*/g, '-')
  const short = normalized.match(/^(\d{4})-(\d{2})$/)
  if (!short) return normalized
  const start = Number(short[1])
  const end = Math.floor(start / 100) * 100 + Number(short[2])
  return `${start}-${end < start ? end + 100 : end}`
}
const code = value => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase()
const active = job => ['pending', 'running'].includes(job?.status)
export const canvasShellKey = shell => `${shell.origin}:${shell.id}`

export function courseEditionCodes(entry, { catalogue, programmeTemplate } = {}) {
  const aliases = new Set(courseMaterialCodes(entry))
  const programme = catalogue?.programmes?.find(p => p.id === programmeTemplate?.programmeId)
  const version = programme?.versions?.find(v => v.id === programmeTemplate?.versionId) || programme?.versions?.[0]
  if (version) {
    const identity = curriculumCourseIdentity({ selectedVersion: version, programmeVersions: programme.versions })
    const target = code(identity.canonicalCourse(entry)?.code || entry?.code)
    for (const course of programme.versions.flatMap(v => v.courses || [])) {
      if (code(identity.canonicalCourse(course)?.code || course.code) === target) aliases.add(course.code)
    }
  }
  return [...aliases].map(code).filter(Boolean).sort()
}

export function canvasEditionYear(course) {
  for (const value of [course.term?.name, course.name, course.courseCode]) {
    const match = editionYear(value).match(/\b(20\d{2})\s*-\s*(20\d{2})\b/)
    if (match) return `${match[1]}-${match[2]}`
  }
  const at = new Date(course.term?.startAt || course.startAt || '')
  if (!Number.isFinite(at.getTime())) return ''
  const year = at.getUTCFullYear() - (at.getUTCMonth() < 7 ? 1 : 0)
  return `${year}-${year + 1}`
}

/** Match exact known codes, never a substring such as BCS2120 in BCS21200. */
export function courseCanvasShells(courses = [], codes = []) {
  const aliases = new Set(codes.map(code))
  const seen = new Set()
  return courses.flatMap(course => {
    const candidates = [course.courseCode, course.name, course.displayName].flatMap(value => String(value || '').toUpperCase().match(/\b[A-Z]{2,4}[\s-]*\d{3,5}[A-Z]?\b/g) || [])
    const matched = candidates.map(code).find(value => aliases.has(value))
    const key = canvasShellKey(course)
    if (!matched || !course.id || !course.origin || seen.has(key)) return []
    seen.add(key)
    return [{ ...course, courseCode: matched, academicYear: canvasEditionYear(course) }]
  })
}

/** One selectable academic year, retaining all Canvas shells and their latest jobs. */
export function courseEditions({ entry, codes = [], shells = [], jobs = [], queued = [] } = {}) {
  const rows = new Map()
  const row = value => {
    const year = editionYear(value) || 'undated'
    if (!rows.has(year)) rows.set(year, { year, sources: 0, attempts: 0, shells: [], stored: [], jobs: [], missing: [], busy: false, failed: false })
    return rows.get(year)
  }
  for (const attempt of entry?.academic?.attempts || []) row(attempt.academicYear).attempts++
  const stored = entry?.corpus ? (entry.corpus.editions?.length ? entry.corpus.editions : [entry.corpus]) : []
  for (const edition of stored) { row(edition.academicYear).stored.push(edition); row(edition.academicYear).sources += Number(edition.sources) || 0 }
  const latest = new Map()
  for (const job of [...jobs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))) {
    if (!job.bindingId || latest.has(job.bindingId) || !codes.includes(code(job.courseCode))) continue
    latest.set(job.bindingId, job)
    row(job.academicYear).jobs.push(job)
  }
  for (const shell of shells) {
    const current = row(shell.academicYear)
    current.shells.push(shell)
    const binding = current.stored.find(e => e.origin === shell.origin && String(e.canvasCourseId) === String(shell.id))
    const job = binding ? latest.get(binding.id) : null
    const pending = queued.includes(canvasShellKey(shell)) || active(job)
    current.busy ||= pending
    if (!pending && (!binding?.lastSyncedAt || ['failed', 'cancelled'].includes(job?.status))) current.missing.push(shell)
  }
  for (const value of rows.values()) {
    value.busy ||= value.jobs.some(active)
    value.failed = value.jobs.some(j => ['failed', 'cancelled'].includes(j.status))
    value.collected = value.stored.length > 0 && value.stored.every(e => e.lastSyncedAt) && !value.missing.length
  }
  return [...rows.values()].sort((a, b) => a.year === 'undated' ? 1 : b.year === 'undated' ? -1 : b.year.localeCompare(a.year))
}

export function academicCourseInEdition(course, year) {
  if (!course || year === 'all') return course
  return { ...course, attempts: (course.attempts || []).filter(a => (editionYear(a.academicYear) || 'undated') === year) }
}
