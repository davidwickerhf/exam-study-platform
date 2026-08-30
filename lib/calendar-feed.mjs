import { fetchCalendar } from './academic-documents.mjs'

// One unified event list for the Calendar page: exam attempts, personal
// events, the institution calendar for the student's programme, and the
// events of every saved timetable feed. Feeds are fetched server-side and
// cached briefly so opening the calendar is cheap.

export const CALENDAR_CATEGORIES = Object.freeze({
  exam: 'Exams',
  deadline: 'Deadlines',
  registration: 'Registration',
  ceremony: 'Ceremonies',
  institution: 'Institution calendar',
  timetable: 'Timetable',
  other: 'Other'
})

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
    events.push({
      id: `event:${event.id}`,
      title: event.title,
      start: event.date,
      end: event.endDate ? nextDay(event.endDate) : null,
      allDay: true,
      category: ['registration', 'deadline', 'ceremony'].includes(event.type) ? event.type : 'other',
      courseId: null,
      courseCode: null,
      colour: null,
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
      category: 'institution',
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
      const codeMatch = String(event.title).match(/\b([A-Z]{2,6}\d{3,5}[A-Z]?)\b/)
      const editorial = codeMatch ? editorialByCode.get(codeMatch[1].toUpperCase()) : null
      events.push({
        id: `feed:${feed.link.id}:${event.id}`,
        title: event.title,
        start: time ? `${event.date}T${time[1]}:00` : event.date,
        end: time?.[2] ? `${event.date}T${time[2]}:00` : event.endDate ? nextDay(event.endDate) : null,
        allDay: !time,
        category: 'timetable',
        subtype: event.type,
        courseId: null,
        courseCode: codeMatch?.[1] || null,
        editorialCourseId: editorial?.id || null,
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
  return { events, categories: CALENDAR_CATEGORIES, courses }
}
