import { randomUUID } from 'node:crypto'
import { normalizeAcademicWorkspace } from './academics.mjs'
import { safeFetch } from './security.mjs'

// Supporting documents (transcripts, exam schedules, timetables, academic
// calendars) arrive at any time. The AI intake turns them into a draft; this
// module diffs that draft against the student's current plan into discrete,
// reviewable changes, and applies the ones the student accepts.

export const DOCUMENT_KINDS = Object.freeze({
  auto: 'Detect automatically',
  transcript: 'Transcript or grade list',
  'exam-schedule': 'Exam schedule',
  timetable: 'Timetable or calendar',
  'academic-calendar': 'Academic calendar',
  curriculum: 'Curriculum or handbook'
})

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max)
const code = (value) => clean(value, 40).toUpperCase().replace(/\s+/g, '')
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null

// ── ICS (iCalendar) ──────────────────────────────────────────────────────

function unfoldIcs(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function icsDate(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/)
  if (!match) return null
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : null, allDay: !match[4] }
}

function icsUnescape(value) {
  return String(value || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

export function parseIcs(text, { max = 500 } = {}) {
  const events = []
  const blocks = unfoldIcs(text).split('BEGIN:VEVENT').slice(1)
  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0]
    const props = {}
    for (const line of body.split('\n')) {
      const index = line.indexOf(':')
      if (index < 0) continue
      const key = line.slice(0, index).split(';')[0].toUpperCase()
      if (!(key in props)) props[key] = line.slice(index + 1)
    }
    const start = icsDate(props.DTSTART)
    if (!start) continue
    const end = icsDate(props.DTEND)
    const summary = icsUnescape(props.SUMMARY) || 'Untitled event'
    const location = icsUnescape(props.LOCATION)
    const description = icsUnescape(props.DESCRIPTION)
    // DTEND on all-day events is exclusive; a one-day event ends the same day.
    let endDate = end?.date || null
    if (endDate && start.allDay) {
      const previous = new Date(`${endDate}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1)
      endDate = previous.toISOString().slice(0, 10)
    }
    if (endDate === start.date) endDate = null
    const lower = summary.toLowerCase()
    const type = /exam|test|assessment/.test(lower) ? 'deadline' : /registration|enrol/.test(lower) ? 'registration' : /graduation|ceremony/.test(lower) ? 'ceremony' : 'other'
    const notes = [start.time ? `${start.time}${end?.time ? `–${end.time}` : ''}` : '', location, description].filter(Boolean).join(' · ').slice(0, 2000)
    events.push({ id: `ics-${clean(props.UID, 120) || randomUUID()}`, title: summary.slice(0, 200), date: start.date, endDate, type, notes })
    if (events.length >= max) break
  }
  return events
}

export function normalizeCalendarLink(value) {
  const url = clean(value?.url ?? value, 1000).replace(/^webcal:\/\//i, 'https://')
  if (!/^https?:\/\//i.test(url)) throw new Error('Calendar links must be http(s) or webcal URLs.')
  return { id: clean(value?.id, 100) || `cal-${randomUUID()}`, label: clean(value?.label, 120) || 'Calendar', url, lastSyncedAt: value?.lastSyncedAt || null, eventCount: Number(value?.eventCount) || 0 }
}

export async function fetchCalendar(url, { fetchImpl = fetch } = {}) {
  // Server-side fetch of a user-supplied URL: public hosts only, redirects
  // re-validated, 4 MB cap, 15 s timeout.
  const { response, text } = await safeFetch(url, { fetchImpl, headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' }, maxBytes: 4 * 1024 * 1024, timeoutMs: 15_000 })
  if (!response.ok) throw new Error(`The calendar link answered ${response.status}.`)
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('The link did not return an iCalendar (.ics) feed.')
  return parseIcs(text)
}

// ── Change sets ──────────────────────────────────────────────────────────

const eventKey = (event) => `${clean(event.title, 200).toLowerCase()}|${event.date || ''}`

function describeAttempt(attempt) {
  const parts = []
  if (attempt.status) parts.push(attempt.status)
  if (attempt.grade !== null && attempt.grade !== undefined) parts.push(`grade ${attempt.grade}`)
  if (attempt.examDate) parts.push(`exam ${attempt.examDate}`)
  if (attempt.type && attempt.type !== 'first') parts.push(attempt.type)
  return parts.join(' · ') || 'attempt'
}

// Diff a normalised intake draft against the workspace. Each change is
// self-contained so the student can accept a subset.
export function buildChangeSet(workspace, draft, { source = 'document', kind = 'auto' } = {}) {
  const changes = []
  const current = normalizeAcademicWorkspace(workspace)
  const byCode = new Map(current.courses.map((course) => [code(course.code), course]))
  const byName = new Map(current.courses.map((course) => [clean(course.name).toLowerCase(), course]))

  const profile = draft?.profile || {}
  for (const field of ['university', 'programme', 'academicYear', 'currentYearKey']) {
    const next = clean(profile[field], 200)
    if (next && next !== current.profile[field] && (!current.profile[field] || field === 'academicYear' || field === 'currentYearKey')) {
      changes.push({ id: `profile:${field}`, kind: 'profile', label: `Set ${field === 'academicYear' ? 'academic year' : field === 'currentYearKey' ? 'current year' : field} to “${next}”`, detail: current.profile[field] ? `Currently “${current.profile[field]}”` : 'Currently blank', payload: { field, value: next }, source })
    }
  }

  for (const draftCourse of draft?.courses || []) {
    const match = byCode.get(code(draftCourse.code)) || byName.get(clean(draftCourse.name).toLowerCase()) || null
    if (!match) {
      if (!clean(draftCourse.name) && !code(draftCourse.code)) continue
      changes.push({
        id: `course:new:${code(draftCourse.code) || clean(draftCourse.name).toLowerCase()}`,
        kind: 'new-course',
        label: `Add ${code(draftCourse.code) || draftCourse.name}${code(draftCourse.code) ? ` — ${draftCourse.name}` : ''}`,
        detail: [draftCourse.ects ? `${draftCourse.ects} ECTS` : null, draftCourse.yearLevel, draftCourse.period, ...(draftCourse.attempts || []).map(describeAttempt)].filter(Boolean).join(' · ') || 'No details yet',
        payload: { course: { ...draftCourse, editorialCourseId: draftCourse.editorialCourseId || null } },
        source
      })
      continue
    }
    const label = match.code || match.name
    for (const field of ['ects', 'yearLevel', 'period']) {
      const next = field === 'ects' ? Number(draftCourse.ects) : clean(draftCourse[field], 40)
      const has = field === 'ects' ? next > 0 : Boolean(next)
      const currentValue = match[field]
      const currentHas = field === 'ects' ? Number(currentValue) > 0 : Boolean(currentValue)
      if (has && !currentHas) {
        changes.push({ id: `course:${match.id}:${field}`, kind: 'course-detail', label: `${label}: set ${field === 'ects' ? 'credits' : field === 'yearLevel' ? 'year level' : 'period'} to ${next}`, detail: 'Currently blank', payload: { courseId: match.id, field, value: next }, source })
      }
    }
    for (const attempt of draftCourse.attempts || []) {
      const hasFact = attempt.examDate || attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming')
      if (!hasFact) continue
      // Same academic year + type → update that attempt; otherwise a new attempt.
      const existing = match.attempts.find((item) => item.type === attempt.type && (!attempt.academicYear || !item.academicYear || item.academicYear === attempt.academicYear))
        || (attempt.status === 'upcoming' ? match.attempts.find((item) => item.status === 'upcoming') : null)
      if (existing) {
        const updates = {}
        if (attempt.examDate && attempt.examDate !== existing.examDate) updates.examDate = attempt.examDate
        if (attempt.grade !== null && attempt.grade !== undefined && attempt.grade !== existing.grade) updates.grade = attempt.grade
        if (attempt.status && attempt.status !== existing.status && (attempt.status !== 'upcoming' || !existing.status)) updates.status = attempt.status
        if (attempt.academicYear && !existing.academicYear) updates.academicYear = attempt.academicYear
        if (!Object.keys(updates).length) continue
        const what = Object.entries(updates).map(([key, value]) => key === 'examDate' ? `exam date → ${value}` : key === 'grade' ? `grade → ${value}` : key === 'status' ? `status → ${value}` : `${key} → ${value}`).join(', ')
        changes.push({ id: `attempt:${match.id}:${existing.id}`, kind: updates.grade !== undefined || updates.status ? 'result' : 'exam-date', label: `${label}: ${what}`, detail: `Currently ${describeAttempt(existing)}`, payload: { courseId: match.id, attemptId: existing.id, updates }, source })
      } else {
        changes.push({ id: `attempt:${match.id}:new:${attempt.type}:${attempt.academicYear || ''}`, kind: attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming') ? 'result' : 'exam-date', label: `${label}: add ${describeAttempt(attempt)}`, detail: match.attempts.length ? `${match.attempts.length} attempt${match.attempts.length === 1 ? '' : 's'} recorded` : 'No attempts recorded', payload: { courseId: match.id, attempt }, source })
      }
    }
  }

  const existingEvents = new Set(current.events.map(eventKey))
  const seen = new Set()
  for (const event of draft?.events || []) {
    if (!event.date || !clean(event.title)) continue
    const key = eventKey(event)
    if (existingEvents.has(key) || seen.has(key)) continue
    seen.add(key)
    changes.push({ id: `event:${key}`, kind: 'event', label: `${event.title} — ${event.date}${event.endDate ? ` to ${event.endDate}` : ''}`, detail: [event.type, event.notes].filter(Boolean).join(' · ') || 'Event', payload: { event }, source })
  }

  const counts = {}
  for (const change of changes) counts[change.kind] = (counts[change.kind] || 0) + 1
  return { kind, changes, counts, warnings: draft?.warnings || [] }
}

export function applyChanges(workspace, changes) {
  const next = normalizeAcademicWorkspace(structuredClone(workspace))
  const applied = []
  for (const change of Array.isArray(changes) ? changes : []) {
    const payload = change?.payload || {}
    if (change.kind === 'profile' && payload.field in next.profile) {
      next.profile[payload.field] = clean(payload.value, 200)
      applied.push(change.id)
    } else if (change.kind === 'new-course' && payload.course) {
      const course = normalizeAcademicWorkspace({ profile: {}, courses: [payload.course] }).courses[0]
      if (!course) continue
      const exists = next.courses.some((item) => code(item.code) && code(item.code) === code(course.code))
      if (exists) continue
      course.id = `course-${randomUUID()}`
      course.attempts = course.attempts.map((attempt, index) => ({ ...attempt, id: `attempt-${randomUUID().slice(0, 8)}-${index + 1}` }))
      next.courses.push(course)
      applied.push(change.id)
    } else if (change.kind === 'course-detail' && payload.courseId) {
      const course = next.courses.find((item) => item.id === payload.courseId)
      if (!course || !['ects', 'yearLevel', 'period'].includes(payload.field)) continue
      course[payload.field] = payload.field === 'ects' ? Math.max(0, Number(payload.value) || 0) : clean(payload.value, 40)
      applied.push(change.id)
    } else if ((change.kind === 'result' || change.kind === 'exam-date') && payload.courseId) {
      const course = next.courses.find((item) => item.id === payload.courseId)
      if (!course) continue
      if (payload.attemptId) {
        const attempt = course.attempts.find((item) => item.id === payload.attemptId)
        if (!attempt) continue
        const updates = payload.updates || {}
        if (updates.examDate !== undefined) attempt.examDate = isoDate(updates.examDate)
        if (updates.grade !== undefined) attempt.grade = updates.grade === null ? null : Math.min(100, Math.max(0, Number(updates.grade)))
        if (updates.status && ['upcoming', 'passed', 'failed', 'no-show'].includes(updates.status)) attempt.status = updates.status
        if (updates.academicYear) attempt.academicYear = clean(updates.academicYear, 30)
      } else if (payload.attempt) {
        course.attempts.push({ ...payload.attempt, id: `attempt-${randomUUID().slice(0, 8)}` })
      } else continue
      applied.push(change.id)
    } else if (change.kind === 'event' && payload.event) {
      const event = normalizeAcademicWorkspace({ profile: {}, events: [{ ...payload.event, id: `event-${randomUUID().slice(0, 8)}` }] }).events[0]
      if (!event || next.events.some((item) => eventKey(item) === eventKey(event))) continue
      next.events.push(event)
      applied.push(change.id)
    }
  }
  return { workspace: normalizeAcademicWorkspace(next), applied }
}

// Events from a calendar link become a change set too, so the student reviews
// them like any other document. Re-syncing only proposes events not yet present.
export function calendarChangeSet(workspace, events, link) {
  return buildChangeSet(workspace, { profile: {}, courses: [], events }, { source: `calendar:${link.id}`, kind: 'timetable' })
}
