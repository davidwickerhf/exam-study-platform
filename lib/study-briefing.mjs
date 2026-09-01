// One answer to "what should I be doing this week".
//
// A tutor asking that question otherwise has to orchestrate five calls and
// reconcile them: the timetable knows where to be, Canvas knows what is due,
// the plan knows when the exams are, the study queues know what is overdue for
// review, and the academic record knows what is at stake. This assembles them
// once, ranked, with the reasons attached — so the tutor spends its turn
// explaining rather than gathering.
//
// It states what it could not see. A briefing that silently omits Canvas
// because Canvas is not connected reads exactly like a week with nothing due.

import { aggregateCalendar, feedEvents, resolveAcademicTimeContext, resolveExamWindow } from './calendar-feed.mjs'
import { readAcademicState } from './academics.mjs'
import { listCanvasConnections, canvasAccessToken } from './canvas-connections.mjs'
import { fetchCanvasHub } from './canvas-hub.mjs'
import { latestAcademicSnapshot } from './academic-snapshots.mjs'
import { loadEditorialProgrammeCatalogue } from './editorial-programmes.mjs'

const DAY_MS = 86_400_000
// The student's day is the university's day. Deriving "today" from a UTC
// timestamp makes the briefing a day behind between midnight and 02:00 local,
// which is exactly when someone checks what is due tomorrow.
export const INSTITUTION_TIME_ZONE = process.env.WICKER_TIME_ZONE || 'Europe/Amsterdam'

export function localDay(value = new Date(), timeZone = INSTITUTION_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function isoDay(value) {
  return String(value ?? '').slice(0, 10)
}

function daysBetween(from, to) {
  return Math.round((new Date(`${isoDay(to)}T00:00:00Z`) - new Date(`${isoDay(from)}T00:00:00Z`)) / DAY_MS)
}

// Ranking is explicit rather than a score nobody can audit: a missed hand-in
// outranks an exam next month, which outranks a lecture tomorrow.
const URGENCY = { missing: 0, overdue: 1, exam: 2, due: 3, teaching: 4, review: 5 }

export function rankPriorities(items) {
  return [...items].sort((left, right) =>
    (URGENCY[left.kind] ?? 9) - (URGENCY[right.kind] ?? 9)
    || String(left.when || '').localeCompare(String(right.when || ''))
  )
}

export async function studyBriefing({ days = 7, now = new Date() } = {}) {
  const today = localDay(now)
  const horizon = localDay(new Date(now.getTime() + days * DAY_MS))
  const missing = []
  const problems = []

  const { workspace } = await readAcademicState()
  const catalogue = loadEditorialProgrammeCatalogue()
  const programme = workspace?.programmeTemplate?.programmeId
    ? catalogue.programmes.find((entry) => entry.id === workspace.programmeTemplate.programmeId)
    : null
  if (!workspace?.courses?.length) missing.push('programme')

  const feeds = []
  for (const link of workspace?.calendars || []) {
    try { feeds.push({ link, events: await feedEvents(link) }) }
    catch (error) { problems.push({ source: link.label || 'Timetable', error: error.message }) }
  }
  if (!feeds.length) missing.push('timetable')

  const canvas = { assignments: [], events: [], announcements: [] }
  const connections = await listCanvasConnections().catch(() => [])
  if (!connections.length) missing.push('canvas')
  for (const connection of connections) {
    try {
      const { token } = await canvasAccessToken({ canvasUrl: connection.origin })
      const hub = await fetchCanvasHub({ origin: connection.origin, token, scope: 'current', days: 21 })
      canvas.assignments.push(...hub.assignments)
      canvas.events.push(...hub.events)
      canvas.announcements.push(...hub.announcements)
      for (const problem of hub.problems) problems.push({ source: 'Canvas', error: problem.error })
    } catch (error) {
      problems.push({ source: 'Canvas', error: error instanceof Error ? error.message : 'Canvas could not be reached.' })
    }
  }

  const snapshot = await latestAcademicSnapshot().catch(() => null)
  if (!snapshot) missing.push('record')

  const institution = programme?.calendar || []
  if (!institution.length) missing.push('calendar')
  const calendar = aggregateCalendar({ workspace: workspace || { courses: [] }, editorialCourses: [], institutionCalendar: institution, feeds, canvas, date: now })
  const context = resolveAcademicTimeContext(institution, { date: now })
  const examWindow = resolveExamWindow(institution, context, { date: now })

  const priorities = []

  for (const assignment of canvas.assignments) {
    if (assignment.status === 'missing') {
      priorities.push({ kind: 'missing', title: assignment.title, course: assignment.courseCode, when: isoDay(assignment.dueAt), url: assignment.url, why: 'Canvas has this marked missing.' })
    } else if (assignment.status === 'overdue') {
      priorities.push({ kind: 'overdue', title: assignment.title, course: assignment.courseCode, when: isoDay(assignment.dueAt), url: assignment.url, why: `Due ${Math.abs(daysBetween(assignment.dueAt, today))} day(s) ago and not handed in.` })
    } else if (assignment.dueAt && isoDay(assignment.dueAt) >= today && isoDay(assignment.dueAt) <= horizon && !['submitted', 'graded', 'excused'].includes(assignment.status)) {
      const inDays = daysBetween(today, assignment.dueAt)
      priorities.push({ kind: 'due', title: assignment.title, course: assignment.courseCode, when: isoDay(assignment.dueAt), url: assignment.url, points: assignment.pointsPossible, why: inDays === 0 ? 'Due today.' : `Due in ${inDays} day(s).` })
    }
  }

  for (const event of calendar.events) {
    if (event.category !== 'exam') continue
    const day = isoDay(event.start)
    if (day < today) continue
    priorities.push({ kind: 'exam', title: event.title, course: event.courseCode, when: day, why: `Exam in ${daysBetween(today, day)} day(s).` })
  }

  const teaching = calendar.events
    .filter((event) => event.category === 'timetable' && isoDay(event.start) >= today && isoDay(event.start) <= horizon)
    .map((event) => ({
      when: isoDay(event.start),
      time: String(event.start).length > 10 ? String(event.start).slice(11, 16) : null,
      course: event.courseCode,
      title: event.courseName || event.title,
      activity: event.activity || null,
      room: (String(event.notes || '').split('·')[1] || '').trim() || null
    }))
    .sort((left, right) => `${left.when}${left.time || ''}`.localeCompare(`${right.when}${right.time || ''}`))

  return {
    generatedAt: new Date().toISOString(),
    today,
    horizon,
    period: context ? { label: context.period, academicYear: context.academicYear, phase: context.phase, start: context.start, end: context.end } : null,
    examWindow,
    programme: workspace?.profile?.programme || null,
    priorities: rankPriorities(priorities).slice(0, 20),
    teaching,
    announcements: canvas.announcements.slice(0, 8).map((item) => ({ course: item.courseCode, title: item.title, postedAt: item.postedAt, excerpt: item.excerpt, url: item.url })),
    record: snapshot?.summary || null,
    counts: {
      missing: priorities.filter((item) => item.kind === 'missing').length,
      overdue: priorities.filter((item) => item.kind === 'overdue').length,
      dueThisWeek: priorities.filter((item) => item.kind === 'due').length,
      teachingThisWeek: teaching.length,
      examsAhead: priorities.filter((item) => item.kind === 'exam').length
    },
    // Named so a tutor can say "I cannot see your timetable" instead of
    // "you have no lectures this week".
    notConnected: missing,
    problems
  }
}
