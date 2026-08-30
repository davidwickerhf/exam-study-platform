import { fetchCalendar } from './academic-documents.mjs'
import { courseReferenceInText, reconcileAcademicSource } from './academic-reconciliation.mjs'

// One unified event list for the Calendar page: exam attempts, personal
// events, the institution calendar for the student's programme, and the
// events of every saved timetable feed. Feeds are fetched server-side and
// cached briefly so opening the calendar is cheap.

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
  other: 'Other'
})

const KIND_CATEGORY = { 'exam-week': 'exam-week', 'resit-week': 'exam-week', period: 'period', 'study-week': 'study-week', 'project-week': 'study-week', holiday: 'holiday' }

const FEED_TTL_MS = 15 * 60_000
const feedCache = new Map()

export async function feedEvents(link, { fetchImpl } = {}) {
  const cached = feedCache.get(link.url)
  if (cached && cached.at > Date.now() - FEED_TTL_MS) return cached.events
  const events = await fetchCalendar(link.url, fetchImpl ? { fetchImpl } : {})
  feedCache.set(link.url, { at: Date.now(), events })
  return events
}

export function clearFeedCache() { feedCache.clear() }

function nextDay(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

export function aggregateCalendar({ workspace, editorialCourses = [], institutionCalendar = [], feeds = [] }) {
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
      const timed = /^\d{2}:\d{2}/.test(event.notes || '')
      const time = timed ? event.notes.match(/^(\d{2}:\d{2})(?:–(\d{2}:\d{2}))?/) : null
      const reference = courseReferenceInText(`${event.title || ''} ${event.notes || ''}`, selectedCourses)
      const editorial = reference?.code ? editorialByCode.get(reference.code) : null
      events.push({
        id: `feed:${feed.link.id}:${event.id}`,
        title: event.title,
        start: time ? `${event.date}T${time[1]}:00` : event.date,
        end: time?.[2] ? `${event.date}T${time[2]}:00` : event.endDate ? nextDay(event.endDate) : null,
        allDay: !time,
        category: 'timetable',
        subtype: event.type,
        courseId: reference?.course?.id || null,
        courseCode: reference?.code || null,
        editorialCourseId: editorial?.id || reference?.course?.editorialCourseId || null,
        colour: editorial?.accent || null,
        source: `feed:${feed.link.id}`,
        feedLabel: feed.link.label,
        notes: event.notes || '',
        href: null
      })
    }
  }

  events.sort((a, b) => String(a.start).localeCompare(String(b.start)))
  const courses = [...new Map(events.filter((event) => event.courseCode).map((event) => [event.courseCode, { code: event.courseCode, editorialCourseId: event.editorialCourseId || null }])).values()]
  const reconciliation = reconcileAcademicSource(workspace, {
    courses: [],
    events: feeds.flatMap((feed) => (feed.events || []).map((event) => ({ ...event, notes: [event.notes, `Source: ${feed.link.label}`].filter(Boolean).join(' · ') })))
  }, { kind: 'timetable', sourceLabel: feeds.length === 1 ? feeds[0].link.label : 'Saved timetable feeds' })
  return { events, categories: CALENDAR_CATEGORIES, courses, reconciliation }
}
