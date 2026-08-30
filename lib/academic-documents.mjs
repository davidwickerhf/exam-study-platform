import { randomUUID } from 'node:crypto'
import { normalizeAcademicWorkspace } from './academics.mjs'
import { courseReferenceInText, normalizedCourseCode, reconcileAcademicSource } from './academic-reconciliation.mjs'
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
const code = normalizedCourseCode
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
const comparableProfileValue = (field, value) => {
  const normalized = clean(value, 200).normalize('NFKC').toLocaleLowerCase()
  return field === 'academicYear' ? normalized.replace(/[\s–—/]+/g, '-').replace(/-+/g, '-') : normalized.replace(/\s+/g, ' ')
}

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
export function buildChangeSet(workspace, draft, { source = 'document', sourceLabel = 'Uploaded source', kind = 'auto' } = {}) {
  const changes = []
  const current = normalizeAcademicWorkspace(workspace)
  const byCode = new Map(current.courses.map((course) => [code(course.code), course]))
  const byName = new Map(current.courses.map((course) => [clean(course.name).toLowerCase(), course]))
  const reconciliation = reconcileAcademicSource(current, draft, { kind, sourceLabel })
  const unselectedByCode = new Map(reconciliation.unselected.filter((item) => item.code).map((item) => [code(item.code), item]))
  const unselectedByName = new Map(reconciliation.unselected.map((item) => [clean(item.name).toLowerCase(), item]))

  const addConflict = ({ id, kind: conflictKind, label, detail, payload, issue }) => {
    changes.push({ id, kind: conflictKind, label, detail, payload, source, sourceLabel, requiresDecision: true, selectedByDefault: false, issue })
  }

  const profile = draft?.profile || {}
  for (const field of ['university', 'programme', 'academicYear', 'currentYearKey']) {
    const next = clean(profile[field], 200)
    const currentValue = clean(current.profile[field], 200)
    if (!next || comparableProfileValue(field, next) === comparableProfileValue(field, currentValue)) continue
    const fieldLabel = field === 'academicYear' ? 'academic year' : field === 'currentYearKey' ? 'current year' : field
    if (!currentValue) changes.push({ id: `profile:${field}`, kind: 'profile', label: `Set ${fieldLabel} to “${next}”`, detail: 'Currently blank', payload: { field, value: next }, source, sourceLabel })
    else addConflict({ id: `profile:${field}:conflict`, kind: 'profile-conflict', label: `Choose the ${fieldLabel}`, detail: `Selected plan: “${currentValue}” · ${sourceLabel}: “${next}”`, payload: { field, value: next }, issue: 'conflicting-profile-detail' })
  }

  for (const draftCourse of draft?.courses || []) {
    const match = byCode.get(code(draftCourse.code)) || byName.get(clean(draftCourse.name).toLowerCase()) || null
    if (!match) {
      if (!clean(draftCourse.name) && !code(draftCourse.code)) continue
      const issue = unselectedByCode.get(code(draftCourse.code)) || unselectedByName.get(clean(draftCourse.name).toLowerCase())
      const id = `course:new:${code(draftCourse.code) || clean(draftCourse.name).toLowerCase()}`
      changes.push({
        id,
        kind: 'new-course',
        label: `${kind === 'transcript' ? 'Add to academic record' : 'Add to selected courses'}: ${code(draftCourse.code) || draftCourse.name}${code(draftCourse.code) && draftCourse.name && draftCourse.name !== code(draftCourse.code) ? ` — ${draftCourse.name}` : ''}`,
        detail: [`Not currently selected; found in ${sourceLabel}.`, draftCourse.ects ? `${draftCourse.ects} ECTS` : null, draftCourse.yearLevel, draftCourse.period, ...(draftCourse.attempts || []).map(describeAttempt)].filter(Boolean).join(' · '),
        payload: { course: { ...draftCourse, programmeRequirement: draftCourse.programmeRequirement || (kind === 'transcript' ? 'historical' : null), editorialCourseId: draftCourse.editorialCourseId || null } },
        source,
        sourceLabel,
        issue: 'unselected-course',
        requiresDecision: true,
        selectedByDefault: false
      })
      if (issue) issue.changeId = id
      continue
    }
    const label = match.code || match.name
    if (draftCourse.code && code(draftCourse.code) !== code(match.code)) {
      addConflict({ id: `course:${match.id}:code:conflict`, kind: 'course-conflict', label: `${label}: choose the course code`, detail: `Selected plan: ${match.code || 'blank'} · ${sourceLabel}: ${code(draftCourse.code)}`, payload: { courseId: match.id, field: 'code', value: code(draftCourse.code) }, issue: 'conflicting-course-detail' })
    }
    for (const field of ['ects', 'yearLevel', 'period']) {
      const next = field === 'ects' ? Number(draftCourse.ects) : clean(draftCourse[field], 40)
      const has = field === 'ects' ? next > 0 : Boolean(next)
      const currentValue = match[field]
      const currentHas = field === 'ects' ? Number(currentValue) > 0 : Boolean(currentValue)
      const same = field === 'ects' ? Number(currentValue) === next : clean(currentValue, 40).toLowerCase() === String(next).toLowerCase()
      if (has && !currentHas) {
        changes.push({ id: `course:${match.id}:${field}`, kind: 'course-detail', label: `${label}: set ${field === 'ects' ? 'credits' : field === 'yearLevel' ? 'year level' : 'period'} to ${next}`, detail: 'Currently blank', payload: { courseId: match.id, field, value: next }, source, sourceLabel })
      } else if (has && currentHas && !same) {
        const fieldLabel = field === 'ects' ? 'credits' : field === 'yearLevel' ? 'year level' : 'period'
        addConflict({ id: `course:${match.id}:${field}:conflict`, kind: 'course-conflict', label: `${label}: choose the ${fieldLabel}`, detail: `Selected plan: ${currentValue}${field === 'ects' ? ' ECTS' : ''} · ${sourceLabel}: ${next}${field === 'ects' ? ' ECTS' : ''}`, payload: { courseId: match.id, field, value: next }, issue: 'conflicting-course-detail' })
      }
    }
    for (const attempt of draftCourse.attempts || []) {
      const hasFact = attempt.examDate || attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming')
      if (!hasFact) continue
      // Upcoming evidence must never overwrite a completed attempt. A source
      // scheduling an already-passed course is a decision, usually a resit or
      // an unintended timetable enrolment.
      const existing = attempt.status === 'upcoming'
        ? match.attempts.find((item) => item.status === 'upcoming' && item.type === attempt.type && (!attempt.academicYear || !item.academicYear || item.academicYear === attempt.academicYear))
          || match.attempts.find((item) => item.status === 'upcoming')
        : match.attempts.find((item) => item.type === attempt.type && (!attempt.academicYear || !item.academicYear || item.academicYear === attempt.academicYear))
      if (existing) {
        const updates = {}
        if (attempt.examDate && attempt.examDate !== existing.examDate) updates.examDate = attempt.examDate
        if (attempt.grade !== null && attempt.grade !== undefined && attempt.grade !== existing.grade) updates.grade = attempt.grade
        if (attempt.status && attempt.status !== existing.status) updates.status = attempt.status
        if (attempt.academicYear && !existing.academicYear) updates.academicYear = attempt.academicYear
        if (!Object.keys(updates).length) continue
        const what = Object.entries(updates).map(([key, value]) => key === 'examDate' ? `exam date → ${value}` : key === 'grade' ? `grade → ${value}` : key === 'status' ? `status → ${value}` : `${key} → ${value}`).join(', ')
        const conflicting = (updates.examDate !== undefined && existing.examDate)
          || (updates.grade !== undefined && existing.grade !== null && existing.grade !== undefined)
          || (updates.status !== undefined && existing.status !== 'upcoming')
        if (conflicting) addConflict({ id: `attempt:${match.id}:${existing.id}:conflict`, kind: 'attempt-conflict', label: `${label}: reconcile ${what}`, detail: `Selected plan: ${describeAttempt(existing)} · ${sourceLabel}: ${describeAttempt(attempt)}`, payload: { courseId: match.id, attemptId: existing.id, updates }, issue: 'conflicting-attempt' })
        else changes.push({ id: `attempt:${match.id}:${existing.id}`, kind: updates.grade !== undefined || updates.status ? 'result' : 'exam-date', label: `${label}: ${what}`, detail: `Currently ${describeAttempt(existing)}`, payload: { courseId: match.id, attemptId: existing.id, updates }, source, sourceLabel })
      } else {
        const completed = match.attempts.filter((item) => ['passed', 'failed', 'no-show'].includes(item.status))
        if (attempt.status === 'upcoming' && completed.length) addConflict({ id: `attempt:${match.id}:new:${attempt.type}:${attempt.academicYear || ''}:conflict`, kind: 'attempt-conflict', label: `${label}: scheduled although already completed`, detail: `Selected plan: ${completed.map(describeAttempt).join(', ')} · ${sourceLabel}: ${describeAttempt(attempt)}. Add a new attempt only if this is intentional.`, payload: { courseId: match.id, attempt }, issue: 'scheduled-completed-course' })
        else changes.push({ id: `attempt:${match.id}:new:${attempt.type}:${attempt.academicYear || ''}`, kind: attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming') ? 'result' : 'exam-date', label: `${label}: add ${describeAttempt(attempt)}`, detail: match.attempts.length ? `${match.attempts.length} attempt${match.attempts.length === 1 ? '' : 's'} recorded` : 'No attempts recorded', payload: { courseId: match.id, attempt }, source, sourceLabel })
      }
    }
  }

  // Calendar-only evidence can identify an unselected course even when no
  // course row was extracted. Offer an explicit plan change before its events.
  for (const issue of reconciliation.unselected.filter((item) => !item.changeId)) {
    const id = `course:new:${issue.code || issue.key.replace(/^name:/, '')}`
    changes.push({
      id,
      kind: 'new-course',
      label: `${kind === 'transcript' ? 'Add to academic record' : 'Add to selected courses'}: ${issue.code || issue.name}`,
      detail: `Not currently selected; found in ${sourceLabel}${issue.evidence.length ? ` · ${issue.evidence.slice(0, 2).join(' · ')}` : ''}.`,
      payload: { course: { code: issue.code || '', name: issue.name || issue.code, ects: 0, yearLevel: '', period: '', passMark: 5.5, notes: `Detected in ${sourceLabel}.`, programmeRequirement: kind === 'transcript' ? 'historical' : null, attempts: [] } },
      source,
      sourceLabel,
      issue: 'unselected-course',
      requiresDecision: true,
      selectedByDefault: false
    })
    issue.changeId = id
  }

  const existingEvents = new Set(current.events.map(eventKey))
  const seen = new Set()
  for (const event of draft?.events || []) {
    if (!event.date || !clean(event.title)) continue
    const key = eventKey(event)
    if (existingEvents.has(key) || seen.has(key)) continue
    seen.add(key)
    const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, current.courses)
    const unselected = reference?.code ? unselectedByCode.get(code(reference.code)) : null
    const courseDetail = reference?.course ? `Matches selected course ${reference.course.code || reference.course.name}` : unselected ? `${unselected.code || unselected.name} is not selected` : null
    changes.push({
      id: `event:${key}`,
      kind: 'event',
      label: `${event.title} — ${event.date}${event.endDate ? ` to ${event.endDate}` : ''}`,
      detail: [courseDetail, event.type, event.notes].filter(Boolean).join(' · ') || 'Event',
      payload: { event, courseId: reference?.course?.id || null, courseCode: reference?.code || null, requiresCourseMatch: Boolean(unselected) },
      source,
      sourceLabel,
      issue: unselected ? 'event-for-unselected-course' : null,
      requiresCourseChangeId: unselected?.changeId || null,
      selectedByDefault: !unselected
    })
  }

  reconciliation.conflicts = changes.filter((change) => change.requiresDecision && change.issue !== 'unselected-course').map((change) => ({ id: change.id, label: change.label, issue: change.issue }))
  if (reconciliation.conflicts.length) reconciliation.status = 'attention'
  const counts = {}
  for (const change of changes) counts[change.kind] = (counts[change.kind] || 0) + 1
  return { kind, sourceLabel, changes, counts, warnings: draft?.warnings || [], reconciliation }
}

export function applyChanges(workspace, changes) {
  const next = normalizeAcademicWorkspace(structuredClone(workspace))
  const applied = []
  // Course additions precede dependent timetable events even when an API
  // client submits the reviewed changes in a different order.
  const orderedChanges = [...(Array.isArray(changes) ? changes : [])].sort((left, right) => Number(right?.kind === 'new-course') - Number(left?.kind === 'new-course'))
  for (const change of orderedChanges) {
    const payload = change?.payload || {}
    if ((change.kind === 'profile' || change.kind === 'profile-conflict') && payload.field in next.profile) {
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
    } else if ((change.kind === 'course-detail' || change.kind === 'course-conflict') && payload.courseId) {
      const course = next.courses.find((item) => item.id === payload.courseId)
      if (!course || !['code', 'name', 'ects', 'yearLevel', 'period', 'passMark'].includes(payload.field)) continue
      course[payload.field] = ['ects', 'passMark'].includes(payload.field) ? Math.max(0, Number(payload.value) || 0) : clean(payload.value, payload.field === 'name' ? 200 : 40)
      applied.push(change.id)
    } else if ((change.kind === 'result' || change.kind === 'exam-date' || change.kind === 'attempt-conflict') && payload.courseId) {
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
      if (payload.requiresCourseMatch && payload.courseCode && !next.courses.some((course) => code(course.code) === code(payload.courseCode))) continue
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
  return buildChangeSet(workspace, { profile: {}, courses: [], events }, { source: `calendar:${link.id}`, sourceLabel: link.label || 'Calendar', kind: 'timetable' })
}
