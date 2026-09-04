import { fetchCalendar } from './academic-documents.mjs'
import { courseReferenceInText, reconcileAcademicSource } from './academic-reconciliation.mjs'

// One unified event list for the Calendar page: exam attempts, personal
// events, the institution calendar for the student's programme, the events of
// every saved timetable feed, and — when Canvas is connected — Canvas
// assignment deadlines and Canvas course events. Feeds are fetched server-side
// and cached briefly so opening the calendar is cheap.

export const CALENDAR_CATEGORIES = Object.freeze({
  exam: 'My exams',
  deadline: 'Deadlines',
  registration: 'Registration',
  ceremony: 'Ceremonies',
  'exam-week': 'Exam & resit weeks',
  period: 'Education periods',
  'study-week': 'Study & project weeks',
  holiday: 'Holidays',
  institution: 'Other institution dates',
  timetable: 'Timetable',
  'canvas-deadline': 'Canvas deadlines',
  'canvas-event': 'Canvas events',
  other: 'Other'
})

// A Canvas deadline that is already handed in is still worth seeing, but it
// should not read like outstanding work.
const CANVAS_STATUS_LABELS = {
  graded: 'Graded',
  submitted: 'Submitted',
  missing: 'Missing',
  overdue: 'Overdue',
  upcoming: 'Due',
  undated: 'No due date',
  offline: 'No Canvas hand-in',
  excused: 'Excused'
}

const KIND_CATEGORY = { 'exam-week': 'exam-week', 'resit-week': 'exam-week', period: 'period', 'study-week': 'study-week', 'project-week': 'study-week', holiday: 'holiday' }

export const FEED_REFRESH_MINUTES = 15
const FEED_TTL_MS = FEED_REFRESH_MINUTES * 60_000
const feedCache = new Map()

export async function feedEvents(link, { fetchImpl } = {}) {
  const cached = feedCache.get(link.url)
  if (cached && cached.at > Date.now() - FEED_TTL_MS) return cached.events
  const events = await fetchCalendar(link.url, fetchImpl ? { fetchImpl } : {})
  feedCache.set(link.url, { at: Date.now(), events })
  return events
}

export function clearFeedCache() { feedCache.clear() }

const CONTEXT_KINDS = new Set(['period', 'exam-week', 'resit-week', 'study-week', 'project-week'])
const TEACHING_APPOINTMENT = /\b(?:lecture|tutorial|practical|lab(?:oratory)?|workshop|seminar|class|colloquium|exercise(?: class)?|exam|test|assessment)\b/i
const NON_TEACHING_APPOINTMENT = /\b(?:project\s+opening|kick[ -]?off|registration|re[ -]?registration|enrol(?:ment)?|orientation|ceremony|deadline|closes?\s+(?:today|tomorrow)|opens?\s+(?:today|tomorrow))\b/i

// A timetable can include project launches, registration notices, and other
// code-labelled appointments. They belong in Calendar, but a single notice is
// not sufficient proof that a student is enrolled in that course this period.
export function isTeachingAppointment(event = {}) {
  const text = `${event.title || ''} ${event.notes || ''}`
  if (NON_TEACHING_APPOINTMENT.test(text)) return false
  // Some university feeds only print a course code and its name. Treat those
  // as provisional teaching evidence unless they match an explicit notice
  // above; this keeps an otherwise well-formed timetable from losing a course
  // merely because its activity label was omitted.
  return TEACHING_APPOINTMENT.test(text) || /\b[A-Za-z]{2,6}\s*-?\s*\d{3,6}[A-Za-z]?\b/.test(String(event.title || ''))
}

function timetableCourseName(event, reference) {
  if (reference?.course?.name) return reference.course.name
  const source = String(event?.title || '')
    .replace(/^[A-Za-z]{2,6}\s*[-/]?\s*\d{3,6}[A-Za-z]?(?:\/\d{4}-\d{3})?(?:\/)?\s*/i, '')
    .replace(/^(?:lecture|tutorial|practical|lab(?:oratory)?|workshop|seminar|class|colloquium|exercise(?: class)?|project|exam|test|assessment)\b(?:\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\/?\d*)?(?:\s*\([^)]*\))?\s*(?:[-–—:]\s*)?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return source || reference?.code || 'Timetable appointment'
}

function timetableActivity(event) {
  const source = String(event?.title || '')
  const match = source.match(/\b(lecture|tutorial|practical|lab(?:oratory)?|workshop|seminar|class|colloquium|exercise(?: class)?|project(?: opening)?|exam|test|assessment)\b/i)
  return match ? match[1].replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Timetable'
}

function todayIso(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
}

function contextPhase(kind, upcoming = false) {
  if (upcoming) return 'upcoming'
  if (kind === 'period') return 'teaching'
  if (kind === 'exam-week' || kind === 'resit-week') return 'exams'
  if (kind === 'study-week' || kind === 'project-week') return 'study'
  return 'between-periods'
}

export function resolveAcademicTimeContext(calendar = [], { date = new Date() } = {}) {
  const today = todayIso(date)
  const dated = (calendar || []).filter((event) => event?.date).map((event) => ({ ...event, endDate: event.endDate || event.date })).sort((left, right) => left.date.localeCompare(right.date))
  const contextual = dated.filter((event) => CONTEXT_KINDS.has(event.kind) && event.period != null)
  if (!contextual.length) return null
  const active = contextual
    .filter((event) => event.date <= today && event.endDate >= today)
    .sort((left, right) => Number(right.kind === 'period') - Number(left.kind === 'period'))[0] || null
  const next = contextual.find((event) => event.kind === 'period' && event.date > today) || null
  const previous = [...contextual].reverse().find((event) => event.kind === 'period' && event.endDate < today) || null
  const anchor = active || next || previous
  if (!anchor) return null
  const academicYear = anchor.academicYear || ''
  const periodNumber = Number(anchor.period)
  const related = contextual.filter((event) => Number(event.period) === periodNumber && (!academicYear || !event.academicYear || event.academicYear === academicYear))
  const start = related.map((event) => event.date).sort()[0] || anchor.date
  const end = related.map((event) => event.endDate || event.date).sort().at(-1) || anchor.endDate
  const upcoming = !active && Boolean(next) && anchor === next
  const daysUntil = upcoming ? Math.max(0, Math.ceil((new Date(`${anchor.date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86_400_000)) : 0
  return {
    date: today,
    academicYear,
    period: `Period ${periodNumber}`,
    periodNumber,
    phase: contextPhase(anchor.kind, upcoming),
    label: upcoming ? `Period ${periodNumber}` : anchor.title || `Period ${periodNumber}`,
    start,
    end,
    activeStart: anchor.date,
    activeEnd: anchor.endDate,
    daysUntil,
    source: anchor.sourceLabel || 'Academic calendar'
  }
}

export function calendarPeriodCourseEvidence(workspace, feeds = [], context = null) {
  if (!context?.start || !context?.end) return []
  const selectedCourses = workspace?.courses || []
  const byCode = new Map()
  for (const feed of feeds) {
    for (const event of feed.events || []) {
      if (!event.date || event.date < context.start || event.date > context.end) continue
      if (!isTeachingAppointment(event)) continue
      const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, selectedCourses)
      if (!reference?.code) continue
      const current = byCode.get(reference.code) || {
        code: reference.code,
        name: timetableCourseName(event, reference),
        courseId: reference.course?.id || null,
        selected: Boolean(reference.course),
        active: Boolean(reference.course && reference.course.programmeRequirement !== 'historical'
          && (reference.course.attempts || []).some((attempt) => attempt.status === 'upcoming')
          && (!reference.course.period || reference.course.period === context.period)),
        eventCount: 0,
        teaching: true,
        activity: timetableActivity(event),
        firstDate: event.date,
        lastDate: event.date,
        sources: []
      }
      current.eventCount += 1
      if (event.date < current.firstDate) current.firstDate = event.date
      if (event.date > current.lastDate) current.lastDate = event.date
      if (feed.link?.label && !current.sources.includes(feed.link.label)) current.sources.push(feed.link.label)
      byCode.set(reference.code, current)
    }
  }
  return [...byCode.values()].sort((left, right) => Number(right.selected) - Number(left.selected) || left.code.localeCompare(right.code))
}

/**
 * One authoritative answer to “what am I taking now?”. It deliberately
 * intersects the active academic period with the student's current programme
 * year, then adds unresolved carry-overs and actual timetable evidence. A
 * historical course merely sharing the number “Period 1” is not current, and
 * a passed course never returns unless it has a later upcoming sitting.
 */
export function resolveCurrentCourses(workspace, context = null, timetableEvidence = []) {
  const period = String(context?.period || '').replace(/^Period\s*/i, '').trim()
  const academicYear = String(context?.academicYear || '').replace(/[–—/]/g, '-')
  const studyYear = String(workspace?.programmeTemplate?.currentStudyYear || workspace?.profile?.currentYearKey || '').replace(/^Year\s*/i, '').trim()
  const teaching = new Map((timetableEvidence || []).filter((item) => item.teaching || item.active).map((item) => [String(item.code || '').toUpperCase(), item]))
  const rows = []
  const seen = new Set()
  for (const course of workspace?.courses || []) {
    const code = String(course.code || '').toUpperCase()
    if (!code || course.hiddenFromStats) continue
    const attempts = course.attempts || []
    const latestUpcoming = attempts.find((attempt) => attempt.status === 'upcoming')
    const passed = attempts.some((attempt) => attempt.status === 'passed') && !latestUpcoming
    if (passed) continue
    const samePeriod = period && String(course.period || latestUpcoming?.period || '').replace(/^Period\s*/i, '').trim() === period
    const sameStudyYear = studyYear && String(course.yearLevel || latestUpcoming?.yearLevel || '').replace(/^Year\s*/i, '').trim() === studyYear
    const failed = attempts.some((attempt) => ['failed', 'no-show'].includes(attempt.status))
    const currentAttempt = Boolean(latestUpcoming && (!academicYear || !latestUpcoming.academicYear || String(latestUpcoming.academicYear).replace(/[–—/]/g, '-') === academicYear))
    const timetable = teaching.get(code)
    if (!timetable && !(samePeriod && (sameStudyYear || failed || currentAttempt))) continue
    seen.add(code)
    rows.push({ code, courseId: course.id || null, name: course.name || timetable?.name || code, reasons: [samePeriod && sameStudyYear ? 'current-curriculum' : null, samePeriod && failed ? 'unresolved-attempt' : null, currentAttempt ? 'current-registration' : null, timetable ? 'timetable' : null].filter(Boolean) })
  }
  for (const [code, item] of teaching) {
    if (!code || seen.has(code)) continue
    rows.push({ code, courseId: item.courseId || null, name: item.name || code, reasons: ['timetable'], outsidePlan: true })
  }
  return rows.sort((left, right) => left.code.localeCompare(right.code))
}

export function resolveExamWindow(calendar = [], context = null, { date = new Date() } = {}) {
  if (!context?.periodNumber) return null
  const today = todayIso(date)
  const academicYear = String(context.academicYear || '').replace(/[–—/]/g, '-')
  const candidates = (calendar || []).filter((event) => event?.kind === 'exam-week'
    && Number(event.period) === Number(context.periodNumber)
    && (!academicYear || !event.academicYear || String(event.academicYear).replace(/[–—/]/g, '-') === academicYear)
    && (event.endDate || event.date) >= today)
    .sort((left, right) => left.date.localeCompare(right.date))
  const event = candidates[0] || null
  return event ? { title: event.title || `Exam week · ${context.period}`, start: event.date, end: event.endDate || event.date, period: context.period, academicYear: context.academicYear || event.academicYear || '' } : null
}

function nextDay(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

export function aggregateCalendar({ workspace, editorialCourses = [], institutionCalendar = [], feeds = [], canvas = null, date = new Date() }) {
  const events = []
  const selectedCourses = workspace.courses || []
  const editorialByCode = new Map(editorialCourses.map((course) => [String(course.code || '').toUpperCase(), course]))
  const courseColour = (course) => editorialByCode.get(String(course.code || '').toUpperCase())?.accent || null

  for (const course of workspace.courses || []) {
    const editorial = editorialByCode.get(String(course.code || '').toUpperCase())
    for (const attempt of course.attempts || []) {
      if (!attempt.examDate) continue
      events.push({
        id: `attempt:${course.id}:${attempt.id}`,
        title: `${course.code ? `${course.code} · ` : ''}${course.name}${attempt.type && attempt.type !== 'first' ? ` (${attempt.type})` : ''}`,
        start: attempt.examDate,
        end: null,
        allDay: true,
        category: 'exam',
        status: attempt.status,
        courseId: course.id,
        courseCode: course.code || null,
        editorialCourseId: editorial?.id || course.editorialCourseId || null,
        colour: courseColour(course),
        source: 'plan',
        notes: [attempt.status, attempt.grade != null ? `grade ${attempt.grade}` : null, attempt.academicYear].filter(Boolean).join(' · '),
        href: `#/planning/courses/${encodeURIComponent(course.id)}`
      })
    }
  }

  for (const event of workspace.events || []) {
    if (!event.date) continue
    const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, selectedCourses)
    const editorial = reference?.code ? editorialByCode.get(reference.code) : null
    events.push({
      id: `event:${event.id}`,
      title: event.title,
      start: event.date,
      end: event.endDate ? nextDay(event.endDate) : null,
      allDay: true,
      category: ['registration', 'deadline', 'ceremony'].includes(event.type) ? event.type : 'other',
      courseId: reference?.course?.id || null,
      courseCode: reference?.code || null,
      editorialCourseId: editorial?.id || reference?.course?.editorialCourseId || null,
      colour: editorial?.accent || null,
      source: 'plan',
      notes: event.notes || '',
      href: '#/planning/calendar'
    })
  }

  const ownKeys = new Set(events.map((event) => `${event.title.toLowerCase()}|${event.start}`))
  for (const event of institutionCalendar) {
    if (!event.date || ownKeys.has(`${String(event.title).toLowerCase()}|${event.date}`)) continue
    events.push({
      id: `institution:${event.id}`,
      title: event.title,
      start: event.date,
      end: event.endDate ? nextDay(event.endDate) : null,
      allDay: true,
      category: KIND_CATEGORY[event.kind] || 'institution',
      kind: event.kind || 'other',
      period: event.period ?? null,
      semester: event.semester ?? null,
      resit: Boolean(event.resit),
      cohorts: event.cohorts || [],
      background: event.kind === 'period' || event.kind === 'holiday',
      subtype: event.type,
      courseId: null,
      courseCode: null,
      colour: null,
      source: 'institution',
      notes: [event.type, event.academicYear, event.notes].filter(Boolean).join(' · '),
      href: null
    })
  }

  for (const feed of feeds) {
    for (const event of feed.events || []) {
      // A cancelled VEVENT remains in many institutional feeds so clients can
      // learn about the cancellation. It should produce a notice, not remain
      // visible as an appointment the student might still attend.
      if (event.cancelled) continue
      const timed = /^\d{2}:\d{2}/.test(event.notes || '')
      const time = timed ? event.notes.match(/^(\d{2}:\d{2})(?:–(\d{2}:\d{2}))?/) : null
      const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, selectedCourses)
      const editorial = reference?.code ? editorialByCode.get(reference.code) : null
      const courseName = reference?.code ? timetableCourseName(event, reference) : null
      const activity = timetableActivity(event)
      events.push({
        id: `feed:${feed.link.id}:${event.id}`,
        // Preserve the raw institution identifier separately. The learner sees
        // a readable course name while administrators can still inspect the
        // untouched feed source when needed.
        title: reference?.code ? `${reference.code} · ${courseName}` : event.title,
        sourceTitle: event.title,
        start: time ? `${event.date}T${time[1]}:00` : event.date,
        end: time?.[2] ? `${event.date}T${time[2]}:00` : event.endDate ? nextDay(event.endDate) : null,
        allDay: !time,
        category: 'timetable',
        subtype: event.type,
        courseId: reference?.course?.id || null,
        courseCode: reference?.code || null,
        courseName,
        activity,
        editorialCourseId: editorial?.id || reference?.course?.editorialCourseId || null,
        colour: editorial?.accent || null,
        source: `feed:${feed.link.id}`,
        feedLabel: feed.link.label,
        notes: event.notes || '',
        href: null
      })
    }
  }

  // Canvas is an external system: its items are shown, never written back into
  // the personal record, and always keep a link out to Canvas itself.
  const canvasCourseFor = (item) => {
    const reference = courseReferenceInText(`${item.courseCode || ''} ${item.courseName || ''}`, selectedCourses)
    const editorial = reference?.code ? editorialByCode.get(reference.code) : null
    return {
      courseId: reference?.course?.id || null,
      courseCode: reference?.code || item.courseCode || null,
      courseName: item.courseName || null,
      editorialCourseId: editorial?.id || reference?.course?.editorialCourseId || null,
      colour: editorial?.accent || null
    }
  }

  for (const assignment of canvas?.assignments || []) {
    if (!assignment.dueAt) continue
    const match = canvasCourseFor(assignment)
    events.push({
      id: `canvas-assignment:${assignment.id}`,
      title: `${match.courseCode ? `${match.courseCode} · ` : ''}${assignment.title}`,
      start: assignment.dueAt,
      end: null,
      allDay: false,
      category: 'canvas-deadline',
      canvasStatus: assignment.status || null,
      canvasStatusLabel: CANVAS_STATUS_LABELS[assignment.status] || null,
      canvasDone: ['graded', 'submitted', 'excused'].includes(assignment.status),
      ...match,
      source: 'canvas',
      notes: [CANVAS_STATUS_LABELS[assignment.status] || null, assignment.pointsPossible != null ? `${assignment.pointsPossible} points` : null, assignment.courseName].filter(Boolean).join(' · '),
      externalHref: assignment.url || null,
      href: null
    })
  }

  for (const event of canvas?.events || []) {
    if (!event.startAt) continue
    const match = canvasCourseFor(event)
    events.push({
      id: `canvas-event:${event.id}`,
      title: `${match.courseCode ? `${match.courseCode} · ` : ''}${event.title}`,
      start: event.startAt,
      end: event.endAt || null,
      allDay: Boolean(event.allDay),
      category: 'canvas-event',
      ...match,
      source: 'canvas',
      notes: [event.location, event.description].filter(Boolean).join(' · '),
      externalHref: event.url || null,
      href: null
    })
  }

  events.sort((a, b) => String(a.start).localeCompare(String(b.start)))
  const courses = [...new Map(events.filter((event) => event.courseCode).map((event) => [event.courseCode, { code: event.courseCode, editorialCourseId: event.editorialCourseId || null }])).values()]
  const reconciliation = reconcileAcademicSource(workspace, {
    courses: [],
    events: feeds.flatMap((feed) => (feed.events || []).map((event) => ({ ...event, notes: [event.notes, `Source: ${feed.link.label}`].filter(Boolean).join(' · ') })))
  }, { kind: 'calendar-feed', sourceLabel: feeds.length === 1 ? feeds[0].link.label : 'Saved timetable feeds' })
  const academicContext = resolveAcademicTimeContext(institutionCalendar, { date })
  const periodCourses = calendarPeriodCourseEvidence(workspace, feeds, academicContext)
  const currentCourses = resolveCurrentCourses(workspace, academicContext, periodCourses)
  const examWindow = resolveExamWindow(institutionCalendar, academicContext, { date })
  return { events, categories: CALENDAR_CATEGORIES, courses, reconciliation, academicContext, periodCourses, currentCourses, examWindow }
}
