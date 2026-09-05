import { createHash, randomUUID } from 'node:crypto'
import { normalizeAcademicWorkspace } from './academics.mjs'
import { courseReferenceInText, normalizedCourseCode, reconcileAcademicSource } from './academic-reconciliation.mjs'
import { safeFetch } from './security.mjs'

// Supporting documents (transcripts, exam schedules, timetables, academic
// calendars) arrive at any time. The AI intake turns them into a draft; this
// module diffs that draft against the student's current plan into discrete,
// reviewable changes, and applies the ones the student accepts.

export const DOCUMENT_KINDS = Object.freeze({
  auto: 'Detect automatically',
  'academic-overview': 'Academic overview / study progress',
  transcript: 'Transcript or grade list',
  'exam-schedule': 'Exam schedule',
  timetable: 'Timetable or calendar',
  'academic-calendar': 'Academic calendar',
  curriculum: 'Curriculum or handbook'
})

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max)
const code = normalizedCourseCode
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
const comparableProgrammeValue = (value) => clean(value, 200)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/\bb\s*\.?\s*sc\.?\b/g, 'bachelor science')
  .replace(/\bm\s*\.?\s*sc\.?\b/g, 'master science')
  .replace(/\bbachelor['’]?s?\b/g, 'bachelor')
  .replace(/\bmaster['’]?s?\b/g, 'master')
  .replace(/[^a-z0-9]+/g, ' ')
  .split(' ')
  .filter((token) => token && !new Set(['in', 'of', 'the', 'programme', 'program', 'degree']).has(token))
  .join(' ')
const comparableProfileValue = (field, value) => {
  const normalized = clean(value, 200).normalize('NFKC').toLocaleLowerCase()
  if (field === 'academicYear') return normalized.replace(/[\s–—/]+/g, '-').replace(/-+/g, '-')
  if (field === 'programme') return comparableProgrammeValue(value)
  return normalized.replace(/\s+/g, ' ')
}

// ── ICS (iCalendar) ──────────────────────────────────────────────────────

function unfoldIcs(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

// A timetable feed publishes instants, not wall-clock strings: Maastricht sends
// DTSTART:20260901T063000Z for a lecture that starts at 08:30. Reading the
// digits and ignoring the Z shows every timed event in UTC — two hours early in
// summer, one in winter, and on the wrong day for anything late in the evening.
//
// The times are converted into the calendar's own zone rather than the reader's,
// because a lecture happens at 08:30 in the room whichever country the student
// is reading from.
function zonedParts(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant)
    const value = (type) => parts.find((part) => part.type === type)?.value
    if (!value('year')) return null
    return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` }
  } catch {
    return null // An unknown IANA zone: fall through to the literal reading.
  }
}

function icsDate(value, { params = {}, calendarTimeZone = null } = {}) {
  const raw = String(value || '').trim()
  const match = raw.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/)
  if (!match) return null
  const literal = { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : null, allDay: !match[4] }
  // No time, or already wall-clock in a named zone: nothing to convert.
  if (literal.allDay || !match[7]) return literal
  const zone = params.TZID || calendarTimeZone
  if (!zone) return literal
  const instant = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)))
  const zoned = zonedParts(instant, zone)
  return zoned ? { ...zoned, allDay: false } : literal
}

function icsUnescape(value) {
  return String(value || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

export function parseIcs(text, { max = 500 } = {}) {
  const events = []
  const unfolded = unfoldIcs(text)
  // Both places a feed declares its zone. VTIMEZONE blocks are skipped: their
  // own DTSTARTs describe daylight-saving rules, not events.
  const calendarTimeZone = (unfolded.match(/^X-WR-TIMEZONE:(.+)$/m)?.[1] || unfolded.match(/^TZID:(.+)$/m)?.[1] || '').trim() || null
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1)
  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0]
    const props = {}
    for (const line of body.split('\n')) {
      const index = line.indexOf(':')
      if (index < 0) continue
      const [key, ...rest] = line.slice(0, index).split(';')
      const name = key.toUpperCase()
      if (name in props) continue
      const params = {}
      for (const pair of rest) {
        const split = pair.indexOf('=')
        if (split > 0) params[pair.slice(0, split).toUpperCase()] = pair.slice(split + 1).replace(/^"|"$/g, '')
      }
      props[name] = { value: line.slice(index + 1), params }
    }
    const start = icsDate(props.DTSTART?.value, { params: props.DTSTART?.params, calendarTimeZone })
    if (!start) continue
    const end = icsDate(props.DTEND?.value, { params: props.DTEND?.params, calendarTimeZone })
    const summary = icsUnescape(props.SUMMARY?.value) || 'Untitled event'
    const location = icsUnescape(props.LOCATION?.value)
    const description = icsUnescape(props.DESCRIPTION?.value)
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
    const uid = clean(props.UID?.value, 120)
    const recurrenceId = clean(props['RECURRENCE-ID']?.value, 40)
    // Feeds without UIDs are malformed but common enough to support. A stable
    // content fingerprint is essential here: a random id makes every refresh
    // look like a new appointment and prevents reliable change detection.
    const fallbackId = createHash('sha256').update([summary, start.date, start.time, endDate, end?.time, location].join('|')).digest('hex').slice(0, 24)
    const status = clean(props.STATUS?.value, 30).toUpperCase() || null
    events.push({
      id: `ics-${uid ? `${uid}${recurrenceId ? `:${recurrenceId}` : ''}` : fallbackId}`,
      uid: uid || null,
      recurrenceId: recurrenceId || null,
      title: summary.slice(0, 200),
      date: start.date,
      endDate,
      startTime: start.time,
      endTime: end?.time || null,
      location: location || null,
      status,
      cancelled: status === 'CANCELLED' || /^\s*(?:cancelled|canceled|afgelast|geannuleerd)\b/i.test(summary),
      sequence: Number.isFinite(Number(props.SEQUENCE?.value)) ? Number(props.SEQUENCE.value) : null,
      lastModified: clean(props['LAST-MODIFIED']?.value, 40) || null,
      type,
      notes
    })
    if (events.length >= max) break
  }
  return events
}

export function normalizeCalendarLink(value) {
  const url = clean(value?.url ?? value, 1000).replace(/^webcal:\/\//i, 'https://')
  if (!/^https?:\/\//i.test(url)) throw new Error('Calendar links must be http(s) or webcal URLs.')
  return {
    id: clean(value?.id, 100) || `cal-${randomUUID()}`,
    label: clean(value?.label, 120) || 'Calendar',
    url,
    lastSyncedAt: value?.lastSyncedAt || null,
    eventCount: Number(value?.eventCount) || 0,
    rangeStart: isoDate(value?.rangeStart),
    rangeEnd: isoDate(value?.rangeEnd),
    matchedCourseCount: Math.max(0, Math.trunc(Number(value?.matchedCourseCount) || 0)),
    unselectedCourseCount: Math.max(0, Math.trunc(Number(value?.unselectedCourseCount) || 0))
  }
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

function attemptFingerprint(attempt) {
  return [clean(attempt?.academicYear, 30).replace(/[–—/]/g, '-'), attempt?.type || 'first', attempt?.examDate || '', attempt?.grade ?? '', attempt?.status || 'upcoming'].join('|')
}

const ATTEMPT_CONTEXT_FIELDS = ['courseCode', 'courseName', 'ects', 'creditsEarned', 'yearLevel', 'period', 'curriculumVersion']

function missingAttemptContext(existing, incoming) {
  const updates = {}
  for (const field of ATTEMPT_CONTEXT_FIELDS) {
    const missing = existing?.[field] === null || existing?.[field] === undefined || existing?.[field] === ''
    const present = incoming?.[field] !== null && incoming?.[field] !== undefined && incoming?.[field] !== ''
    if (missing && present) updates[field] = incoming[field]
  }
  return updates
}

function describeAttemptContext(attempt) {
  return [attempt.curriculumVersion || attempt.academicYear, attempt.yearLevel, attempt.period, attempt.ects != null ? `${attempt.ects} ECTS` : null, attempt.courseCode, attempt.courseName].filter(Boolean).join(' · ')
}

function attemptChangeKey(attempt) {
  return attemptFingerprint(attempt).replace(/[^a-z0-9|.-]+/gi, '-').replace(/\|/g, ':').slice(0, 180)
}

function sameAttempt(left, right) {
  return attemptFingerprint(left) === attemptFingerprint(right)
}

function sameSitting(left, right) {
  if (left?.examDate && right?.examDate) return left.examDate === right.examDate
  const sameYear = !left?.academicYear || !right?.academicYear || comparableProfileValue('academicYear', left.academicYear) === comparableProfileValue('academicYear', right.academicYear)
  if (!sameYear || (left?.type || 'first') !== (right?.type || 'first')) return false
  // A completed transcript result can safely resolve a previously scheduled
  // attempt. Two completed rows without dates remain separate: they may be a
  // retake whose attempt label was omitted, and history must not be overwritten.
  if (left?.status === 'upcoming' || right?.status === 'upcoming') return true
  // A dated transcript row and an undated academic-overview row describe the
  // same sitting when year, attempt type, result, and grade agree. Keep the
  // transcript date and use the overview only to enrich curriculum context.
  if (Boolean(left?.examDate) !== Boolean(right?.examDate)) {
    const compatibleStatus = !left?.status || !right?.status || left.status === right.status
    const compatibleGrade = left?.grade === null || left?.grade === undefined || right?.grade === null || right?.grade === undefined || Number(left.grade) === Number(right.grade)
    return compatibleStatus && compatibleGrade
  }
  return false
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
  const profileFields = kind === 'transcript' ? ['university', 'programme'] : ['university', 'programme', 'academicYear', 'currentYearKey']
  for (const field of profileFields) {
    const next = clean(profile[field], 200)
    const currentValue = clean(current.profile[field], 200)
    if (!next || comparableProfileValue(field, next) === comparableProfileValue(field, currentValue)) continue
    const fieldLabel = field === 'academicYear' ? 'academic year' : field === 'currentYearKey' ? 'current year' : field
    if (!currentValue) changes.push({ id: `profile:${field}`, kind: 'profile', label: `Set ${fieldLabel} to “${next}”`, detail: 'Currently blank', payload: { field, value: next }, source, sourceLabel })
    else addConflict({ id: `profile:${field}:conflict`, kind: 'profile-conflict', label: `Choose the ${fieldLabel}`, detail: `Selected plan: “${currentValue}” · ${sourceLabel}: “${next}”`, payload: { field, value: next }, issue: 'conflicting-profile-detail' })
  }

  for (const draftCourse of draft?.courses || []) {
    const draftCode = code(draftCourse.code)
    const nameMatch = byName.get(clean(draftCourse.name).toLowerCase()) || null
    const codeStrict = kind === 'transcript' || kind === 'academic-overview'
    const match = byCode.get(draftCode) || (!draftCode || !codeStrict || !nameMatch?.code ? nameMatch : null) || null
    const historicalEvidence = kind === 'transcript' || draftCourse.programmeRequirement === 'historical'
    const currentEnrollment = kind === 'academic-overview' && !historicalEvidence && (draftCourse.attempts || []).some((attempt) => attempt.status === 'upcoming')
    if (!match) {
      if (!clean(draftCourse.name) && !code(draftCourse.code)) continue
      const issue = unselectedByCode.get(code(draftCourse.code)) || unselectedByName.get(clean(draftCourse.name).toLowerCase())
      const id = `course:new:${code(draftCourse.code) || clean(draftCourse.name).toLowerCase()}`
      const safeRecord = historicalEvidence || currentEnrollment
      changes.push({
        id,
        kind: historicalEvidence ? 'history' : currentEnrollment ? 'enrollment' : 'new-course',
        label: `${historicalEvidence ? 'Add historical record' : currentEnrollment ? 'Add current enrolment' : 'Add to selected courses'}: ${code(draftCourse.code) || draftCourse.name}${code(draftCourse.code) && draftCourse.name && draftCourse.name !== code(draftCourse.code) ? ` — ${draftCourse.name}` : ''}`,
        detail: [historicalEvidence ? `Historical evidence from ${sourceLabel}; this does not add the course to the current curriculum.` : currentEnrollment ? `Listed under Current courses in ${sourceLabel}.` : `Not currently selected; found in ${sourceLabel}.`, draftCourse.ects ? `${draftCourse.ects} ECTS` : null, draftCourse.yearLevel, draftCourse.period, ...(draftCourse.attempts || []).map(describeAttempt)].filter(Boolean).join(' · '),
        payload: { course: { ...draftCourse, programmeRequirement: draftCourse.programmeRequirement || (historicalEvidence ? 'historical' : null), editorialCourseId: draftCourse.editorialCourseId || null } },
        source,
        sourceLabel,
        issue: historicalEvidence ? 'historical-record' : currentEnrollment ? 'current-enrollment' : 'unselected-course',
        requiresDecision: !safeRecord,
        selectedByDefault: safeRecord
      })
      if (issue) issue.changeId = id
      continue
    }
    const label = match.code || match.name
    if (currentEnrollment && match.programmeRequirement === 'historical') {
      changes.push({
        id: `course:${match.id}:activate`,
        kind: 'enrollment',
        label: `Mark ${label} as currently enrolled`,
        detail: `${sourceLabel} lists this course as current. Its earlier attempts and their original curriculum context remain unchanged.`,
        payload: { courseId: match.id, activate: true },
        source,
        sourceLabel,
        issue: 'current-enrollment',
        selectedByDefault: true
      })
    }
    if (draftCourse.code && !code(match.code)) {
      changes.push({ id: `course:${match.id}:code`, kind: 'course-detail', label: `${match.name}: set course code to ${code(draftCourse.code)}`, detail: `Matched the existing title; its course code is currently blank.`, payload: { courseId: match.id, field: 'code', value: code(draftCourse.code) }, source, sourceLabel })
    } else if (!historicalEvidence && draftCourse.code && code(draftCourse.code) !== code(match.code)) {
      addConflict({ id: `course:${match.id}:code:conflict`, kind: 'course-conflict', label: `${label}: choose the course code`, detail: `Selected plan: ${match.code || 'blank'} · ${sourceLabel}: ${code(draftCourse.code)}`, payload: { courseId: match.id, field: 'code', value: code(draftCourse.code) }, issue: 'conflicting-course-detail' })
    }
    for (const field of historicalEvidence ? [] : ['ects', 'yearLevel', 'period']) {
      const next = field === 'ects' ? Number(draftCourse.ects) : clean(draftCourse[field], 40)
      const has = field === 'ects' ? next > 0 : Boolean(next)
      const currentValue = match[field]
      const currentHas = field === 'ects' ? Number(currentValue) > 0 : Boolean(currentValue)
      const same = field === 'ects' ? Number(currentValue) === next : clean(currentValue, 40).toLowerCase() === String(next).toLowerCase()
      if (has && !currentHas) {
        changes.push({ id: `course:${match.id}:${field}`, kind: 'course-detail', label: `${label}: set ${field === 'ects' ? 'credits' : field === 'yearLevel' ? 'year level' : 'period'} to ${next}`, detail: 'Currently blank', payload: { courseId: match.id, field, value: next }, source, sourceLabel })
      } else if (has && currentHas && !same) {
        const fieldLabel = field === 'ects' ? 'credits' : field === 'yearLevel' ? 'year level' : 'period'
        if (currentEnrollment) {
          changes.push({
            id: `course:${match.id}:${field}:current`,
            kind: 'course-detail',
            label: `${label}: update current ${fieldLabel} to ${next}${field === 'ects' ? ' ECTS' : ''}`,
            detail: `${sourceLabel} is the student's current-enrolment record. Previous sittings retain their own year, period, credits, code, and title.`,
            payload: { courseId: match.id, field, value: next },
            source,
            sourceLabel,
            selectedByDefault: true
          })
        } else addConflict({ id: `course:${match.id}:${field}:conflict`, kind: 'course-conflict', label: `${label}: choose the ${fieldLabel}`, detail: `Selected plan: ${currentValue}${field === 'ects' ? ' ECTS' : ''} · ${sourceLabel}: ${next}${field === 'ects' ? ' ECTS' : ''}`, payload: { courseId: match.id, field, value: next }, issue: 'conflicting-course-detail' })
      }
    }
    const stagedAttempts = match.attempts.map((attempt) => ({ ...attempt, _persisted: true }))
    for (const attempt of draftCourse.attempts || []) {
      const hasFact = attempt.examDate || attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming') || kind === 'academic-overview' && attempt.status === 'upcoming'
      if (!hasFact) continue
      const exact = stagedAttempts.find((item) => sameAttempt(item, attempt))
      if (exact) {
        const creditUpdates = Object.fromEntries(['ects', 'creditsEarned'].filter((field) => exact[field] != null && attempt[field] != null && exact[field] !== attempt[field]).map((field) => [field, attempt[field]]))
        if (Object.keys(creditUpdates).length) addConflict({ id: `attempt:${match.id}:${exact.id}:credits`, kind: 'attempt-conflict', label: `${label}: earned or attempted credits disagree`, detail: `Selected plan: ${exact.creditsEarned ?? '?'} earned / ${exact.ects ?? '?'} attempted ECTS · ${sourceLabel}: ${attempt.creditsEarned ?? '?'} earned / ${attempt.ects ?? '?'} attempted ECTS`, payload: { courseId: match.id, attemptId: exact.id, updates: creditUpdates }, issue: 'conflicting-attempt-credits' })
        const context = missingAttemptContext(exact, attempt)
        if (Object.keys(context).length) {
          changes.push({ id: `attempt:${match.id}:${exact.id}:context`, kind: 'attempt-context', label: `${label}: preserve curriculum context`, detail: describeAttemptContext({ ...exact, ...context }), payload: { courseId: match.id, attemptId: exact.id, updates: context }, source, sourceLabel })
          Object.assign(exact, context)
        }
        continue
      }
      // Upcoming evidence must never overwrite a completed attempt. A source
      // scheduling an already-passed course is a decision, usually a resit or
      // an unintended timetable enrolment.
      const existing = attempt.status === 'upcoming'
        ? stagedAttempts.find((item) => item._persisted && item.status === 'upcoming' && sameSitting(item, attempt))
          || stagedAttempts.find((item) => item._persisted && item.status === 'upcoming')
        : stagedAttempts.find((item) => item._persisted && sameSitting(item, attempt))
      if (existing) {
        const updates = missingAttemptContext(existing, attempt)
        for (const field of ['ects', 'creditsEarned']) if (existing[field] != null && attempt[field] != null && existing[field] !== attempt[field]) updates[field] = attempt[field]
        if (attempt.examDate && attempt.examDate !== existing.examDate) updates.examDate = attempt.examDate
        if (attempt.grade !== null && attempt.grade !== undefined && attempt.grade !== existing.grade) updates.grade = attempt.grade
        if (attempt.status && attempt.status !== existing.status) updates.status = attempt.status
        if (attempt.academicYear && !existing.academicYear) updates.academicYear = attempt.academicYear
        if (!Object.keys(updates).length) continue
        const what = Object.entries(updates).map(([key, value]) => key === 'examDate' ? `exam date → ${value}` : key === 'grade' ? `grade → ${value}` : key === 'status' ? `status → ${value}` : ATTEMPT_CONTEXT_FIELDS.includes(key) ? `${key} → ${value}` : `${key} → ${value}`).join(', ')
        const conflicting = ['ects', 'creditsEarned'].some((field) => updates[field] !== undefined && existing[field] != null) || (updates.examDate !== undefined && existing.examDate)
          || (updates.grade !== undefined && existing.grade !== null && existing.grade !== undefined)
          || (updates.status !== undefined && existing.status !== 'upcoming')
        if (conflicting) addConflict({ id: `attempt:${match.id}:${existing.id}:conflict`, kind: 'attempt-conflict', label: `${label}: reconcile ${what}`, detail: `Selected plan: ${describeAttempt(existing)} · ${sourceLabel}: ${describeAttempt(attempt)}`, payload: { courseId: match.id, attemptId: existing.id, updates }, issue: 'conflicting-attempt' })
        else {
          const factual = ['examDate', 'grade', 'status', 'academicYear'].some((field) => updates[field] !== undefined)
          changes.push({ id: `attempt:${match.id}:${existing.id}`, kind: factual ? updates.grade !== undefined || updates.status ? 'result' : 'exam-date' : 'attempt-context', label: factual ? `${label}: ${what}` : `${label}: preserve curriculum context`, detail: factual ? `Currently ${describeAttempt(existing)}` : describeAttemptContext({ ...existing, ...updates }), payload: { courseId: match.id, attemptId: existing.id, updates }, source, sourceLabel })
        }
        Object.assign(existing, updates)
      } else {
        const completed = match.attempts.filter((item) => item.status === 'passed')
        const changeId = `attempt:${match.id}:new:${attemptChangeKey(attempt)}`
        if (attempt.status === 'upcoming' && completed.length && !currentEnrollment) addConflict({ id: `${changeId}:conflict`, kind: 'attempt-conflict', label: `${label}: scheduled although already completed`, detail: `Selected plan: ${completed.map(describeAttempt).join(', ')} · ${sourceLabel}: ${describeAttempt(attempt)}. Add a new attempt only if this is intentional.`, payload: { courseId: match.id, attempt }, issue: 'scheduled-completed-course' })
        else {
          changes.push({ id: changeId, kind: attempt.grade !== null && attempt.grade !== undefined || (attempt.status && attempt.status !== 'upcoming') ? 'result' : 'exam-date', label: `${label}: add ${describeAttempt(attempt)}`, detail: stagedAttempts.length ? `${stagedAttempts.length} earlier attempt${stagedAttempts.length === 1 ? '' : 's'} preserved` : 'No attempts recorded', payload: { courseId: match.id, attempt }, source, sourceLabel })
          stagedAttempts.push({ ...attempt, _persisted: false })
        }
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
      payload: { event, courseId: reference?.course?.id || null, courseCode: reference?.code || null, requiresCourseMatch: Boolean(unselected), academicCalendar: kind === 'academic-calendar' },
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
  const addsCourse = (change) => Boolean(['new-course', 'history', 'enrollment'].includes(change?.kind) && change?.payload?.course)
  const orderedChanges = [...(Array.isArray(changes) ? changes : [])].sort((left, right) => Number(addsCourse(right)) - Number(addsCourse(left)))
  for (const change of orderedChanges) {
    const payload = change?.payload || {}
    if ((change.kind === 'profile' || change.kind === 'profile-conflict') && payload.field in next.profile) {
      next.profile[payload.field] = clean(payload.value, 200)
      applied.push(change.id)
    } else if (['new-course', 'history', 'enrollment'].includes(change.kind) && payload.course) {
      const course = normalizeAcademicWorkspace({ profile: {}, courses: [payload.course] }).courses[0]
      if (!course) continue
      const exists = next.courses.some((item) => code(item.code) && code(item.code) === code(course.code))
        || !code(course.code) && next.courses.some((item) => !code(item.code) && clean(item.name).toLowerCase() === clean(course.name).toLowerCase())
      if (exists) continue
      course.id = `course-${randomUUID()}`
      course.attempts = course.attempts.map((attempt, index) => ({ ...attempt, id: `attempt-${randomUUID().slice(0, 8)}-${index + 1}` }))
      next.courses.push(course)
      applied.push(change.id)
    } else if (change.kind === 'enrollment' && payload.courseId && payload.activate) {
      const course = next.courses.find((item) => item.id === payload.courseId)
      if (!course) continue
      course.programmeRequirement = null
      applied.push(change.id)
    } else if ((change.kind === 'course-detail' || change.kind === 'course-conflict') && payload.courseId) {
      const course = next.courses.find((item) => item.id === payload.courseId)
      if (!course || !['code', 'name', 'ects', 'yearLevel', 'period', 'passMark'].includes(payload.field)) continue
      course[payload.field] = ['ects', 'passMark'].includes(payload.field) ? Math.max(0, Number(payload.value) || 0) : clean(payload.value, payload.field === 'name' ? 200 : 40)
      applied.push(change.id)
    } else if ((change.kind === 'result' || change.kind === 'exam-date' || change.kind === 'attempt-conflict' || change.kind === 'attempt-context') && payload.courseId) {
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
        if (updates.courseCode !== undefined) attempt.courseCode = clean(updates.courseCode, 40).toUpperCase()
        if (updates.courseName !== undefined) attempt.courseName = clean(updates.courseName, 200)
        if (updates.creditsEarned !== undefined) attempt.creditsEarned = updates.creditsEarned === null ? null : Math.max(0, Number(updates.creditsEarned) || 0)
        if (updates.ects !== undefined) attempt.ects = updates.ects === null ? null : Math.max(0, Number(updates.ects) || 0)
        if (updates.yearLevel !== undefined) attempt.yearLevel = clean(updates.yearLevel, 40)
        if (updates.period !== undefined) attempt.period = clean(updates.period, 40)
        if (updates.curriculumVersion !== undefined) attempt.curriculumVersion = clean(updates.curriculumVersion, 50)
      } else if (payload.attempt) {
        course.attempts.push({ ...payload.attempt, id: `attempt-${randomUUID().slice(0, 8)}` })
      } else continue
      applied.push(change.id)
    } else if (change.kind === 'event' && payload.event) {
      if (payload.requiresCourseMatch && payload.courseCode && !next.courses.some((course) => code(course.code) === code(payload.courseCode))) continue
      if (payload.academicCalendar) {
        const academicPeriod = { ...payload.event, id: payload.event.id || `academic-period-${randomUUID().slice(0, 8)}`, sourceLabel: change.sourceLabel || 'Academic calendar' }
        const key = eventKey(academicPeriod)
        next.planning = next.planning || { objectives: {}, periodAssignments: [], academicPeriods: [] }
        next.planning.academicPeriods = [...(next.planning.academicPeriods || []).filter((item) => eventKey(item) !== key), academicPeriod]
        applied.push(change.id)
        continue
      }
      const event = normalizeAcademicWorkspace({ profile: {}, events: [{ ...payload.event, id: `event-${randomUUID().slice(0, 8)}` }] }).events[0]
      if (!event || next.events.some((item) => eventKey(item) === eventKey(event))) continue
      next.events.push(event)
      applied.push(change.id)
    }
  }
  return { workspace: normalizeAcademicWorkspace(next), applied }
}

// A linked calendar is a live source, not a document import. Its appointments
// remain in the feed and are rendered directly by the Calendar page. The
// preview therefore summarises coverage and course mismatches without creating
// hundreds of durable event changes in the academic workspace.
export function calendarChangeSet(workspace, events, link) {
  const sourceLabel = link.label || 'Calendar'
  const reconciliation = reconcileAcademicSource(workspace, { profile: {}, courses: [], events }, { kind: 'calendar-feed', sourceLabel })
  const dates = events.map((event) => event.date).filter(Boolean).sort()
  let matchedEvents = 0
  let unselectedEvents = 0
  let generalEvents = 0
  for (const event of events) {
    const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, workspace?.courses || [])
    if (reference?.course) matchedEvents += 1
    else if (reference?.code) unselectedEvents += 1
    else generalEvents += 1
  }
  return {
    kind: 'calendar-feed',
    sourceLabel,
    changes: [],
    counts: {},
    warnings: [],
    reconciliation,
    feedSummary: {
      eventCount: events.length,
      rangeStart: dates[0] || null,
      rangeEnd: dates.at(-1) || null,
      matchedEvents,
      unselectedEvents,
      generalEvents,
      matchedCourseCount: reconciliation.matched.length,
      unselectedCourseCount: reconciliation.unselected.length,
      refreshIntervalMinutes: 15
    }
  }
}
