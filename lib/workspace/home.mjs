import { attendanceActivity, attendancePolicyForEvent } from '../attendance.mjs'
import { supportedCourseAssessment } from '../course-rule-evidence.mjs'
/**
 * What Home needs to know.
 *
 * Pure date rules shared by the React home surface and its node tests.
 */

const DAY = 86_400_000
const day = (value) => new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime()

export function localIsoDate(at = new Date()) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

export function daysUntil(iso) {
  if (!iso) return null
  return Math.round((day(iso) - day(localIsoDate())) / DAY)
}

/**
 * Which week of the teaching period today falls in, and how many the period
 * has. The first day of a period is week 1: an earlier version floored the
 * elapsed-week count at one and then added one, so a period read "week 2 of 8"
 * on the morning it began.
 */
export function periodWeek(start, end, today) {
  if (!start || !end || !today) return { week: null, weeks: null }
  const total = Math.floor((day(end) - day(start)) / DAY)
  if (!Number.isFinite(total) || total < 0) return { week: null, weeks: null }
  // The period's last day belongs to its last week, so the span is inclusive.
  const weeks = Math.max(1, Math.ceil((total + 1) / 7))
  const elapsed = Math.floor((day(today) - day(start)) / DAY)
  if (!Number.isFinite(elapsed)) return { week: null, weeks }
  return { week: Math.min(weeks, Math.max(1, Math.floor(elapsed / 7) + 1)), weeks }
}

/**
 * A timetable note reads "08:30–10:30 · DUB30 0.050 · Type: Lecture …", where
 * the tail is staff names and a sync stamp. Only the room belongs in an agenda.
 */
export function roomOf(event) {
  const segments = String(event.notes ?? '').split('·').map((part) => part.trim()).filter(Boolean)
  const room = segments.find((segment, index) =>
    index > 0 && !/^\d{2}:\d{2}/.test(segment) && !/^(type|location\(s\)|staff|this appointment|last synchronised)/i.test(segment))
  return room && room.length <= 60 ? room : null
}

/** Canvas titles a deadline "BCS3120 · Quiz 1"; every row already has a course. */
export function deadlineTitle(event) {
  if (!event.courseCode) return event.title
  const escaped = event.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return event.title.replace(new RegExp(`^\\s*${escaped}\\s*[·:\\-–]\\s*`, 'i'), '') || event.title
}

export function dayEntries(events, today = localIsoDate()) {
  const on = (event) => event.start.slice(0, 10) === today
  const at = (value) => new Date(value.length > 10 ? value : `${value}T09:00:00`).getTime()
  return [
    ...events.filter((event) => event.category === 'timetable' && on(event)).map((event) => ({ event, kind: 'teaching' })),
    ...events.filter((event) => event.category === 'canvas-deadline' && on(event)).map((event) => ({ event, kind: 'due' }))
  ]
    .map((entry) => ({ ...entry, startsAt: at(entry.event.start), endsAt: entry.event.end ? at(entry.event.end) : null }))
    .filter((entry) => Number.isFinite(entry.startsAt))
    .sort((left, right) => left.startsAt - right.startsAt)
}

/**
 * The entry the hero shows: whatever is running, otherwise the next one due.
 * The rest of the day is everything after it, so both must agree on which
 * entry that is — computing them separately dropped the last class of the day
 * whenever the hero was something already in progress.
 */
export function leadEntry(entries, now = Date.now()) {
  return entries.find((entry) => entry.startsAt <= now && entry.endsAt !== null && entry.endsAt > now)
    ?? entries.find((entry) => entry.startsAt > now)
    ?? null
}

export function upcomingDeadlines(events, limit = 5, today = localIsoDate()) {
  return events
    .filter((event) => event.category === 'canvas-deadline' && !event.canvasDone)
    .filter((event) => event.start.slice(0, 10) > today)
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, limit)
}

const COMPLETE_ASSIGNMENT = new Set(['submitted', 'graded', 'excused'])
const PROJECT_SIGNAL = /\b(group|team|project|presentation)\b/i

function obligationWords(value) {
  return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !['the', 'and', 'for', 'course', 'assignment', 'assessment', 'final', 'midterm', 'submission'].includes(word)))
}

function assessmentKind(value) {
  const text = String(value || '').toLowerCase()
  if (/\bpresentation\b/.test(text)) return 'presentation'
  if (/\b(project|group work)\b/.test(text)) return 'project'
  if (/\bquiz\b/.test(text)) return 'quiz'
  if (/\bexam(?:ination)?\b/.test(text)) return 'exam'
  if (/\bparticipation\b/.test(text)) return 'participation'
  if (/\bassignment\b/.test(text)) return 'assignment'
  return null
}

function matchingAssessmentComponent(assignment, course) {
  const assessment = supportedCourseAssessment(course)
  if (assessment?.status !== 'confirmed') return null
  const title = deadlineTitle(assignment)
  const words = obligationWords(title)
  const titleKind = assessmentKind(title)
  if (!words.size) return null
  return (assessment.components ?? []).map((component, index) => ({ component, index })).find(({ component }) => {
    const candidate = obligationWords([component.name, component.type].filter(Boolean).join(' '))
    const componentKind = component.type === 'other' ? assessmentKind(component.name) : component.type
    if (titleKind && componentKind && titleKind !== componentKind) return false
    const overlap = [...words].filter((word) => candidate.has(word)).length
    return overlap >= Math.max(1, Math.ceil(Math.min(words.size, candidate.size) / 2))
  }) ?? null
}

function hasPassed(value, now) {
  if (!value) return false
  // A date-only obligation lasts through that local calendar day. Parsing it
  // as midnight made an exam disappear during the morning it was held.
  if (value.length <= 10) return value.slice(0, 10) < localIsoDate(new Date(now))
  return new Date(value).getTime() < now
}

/**
 * Evidence-backed pressure for the Home priority rail.
 *
 * This intentionally refuses a generic "AI priority" score. An item appears
 * only when a maintained course rule, timetable appointment, Canvas state, or
 * assessment component says something concrete. That keeps an empty rail
 * honest and makes every priority traceable to the screen that owns it.
 */
export function homePriorities({ events = [], assignments = [], courses = [], now = Date.now(), limit = 4 } = {}) {
  const courseByCode = new Map(courses.map((course) => [String(course.code || '').toLowerCase(), course]))
  const priorities = []
  const canvasBackedComponents = new Set()

  const attendanceGroups = new Map()
  const seenEvents = new Set()
  for (const event of events) {
    if (event.category !== 'timetable' || hasPassed(event.start, now) || seenEvents.has(event.id)) continue
    seenEvents.add(event.id)
    const course = courseByCode.get(String(event.courseCode || '').toLowerCase())
    const policy = attendancePolicyForEvent(event, course)
    if (!policy?.required) continue
    const courseKey = String(event.courseCode || event.courseId || event.courseName || event.id).trim().toLowerCase()
    const key = JSON.stringify([courseKey, policy.text, policy.source === 'Timetable' ? attendanceActivity(event.activity || event.title) : null])
    const current = attendanceGroups.get(key)
    const item = {
      id: `attendance:${event.id}`,
      kind: 'attendance',
      title: event.courseName ?? course?.name ?? event.title,
      detail: policy.text,
      courseCode: event.courseCode ?? null,
      dueAt: event.start,
      href: event.href?.startsWith('/app/') ? event.href : '/app/calendar',
      status: 'Required',
      source: policy.source,
      occurrences: (current?.occurrences || 0) + 1,
      rank: 1
    }
    attendanceGroups.set(key, current && String(current.dueAt) <= String(event.start)
      ? { ...current, occurrences: item.occurrences } : item)
  }
  priorities.push(...attendanceGroups.values())

  for (const assignment of assignments) {
    if (COMPLETE_ASSIGNMENT.has(assignment.status) || assignment.status === 'offline') continue
    const course = courseByCode.get(String(assignment.courseCode || '').toLowerCase())
    const matched = matchingAssessmentComponent(assignment, course)
    const canvasDate = String(assignment.dueAt || '').slice(0, 10)
    const ruleDate = String(matched?.component?.deadline || '').slice(0, 10)
    const datesConflict = Boolean(canvasDate && ruleDate && canvasDate !== ruleDate)
    if (matched && course) canvasBackedComponents.add(`${course.id}:${matched.index}`)
    priorities.push({
      id: `assignment:${assignment.id}`,
      kind: 'assignment',
      title: deadlineTitle(assignment),
      detail: [assignment.courseName ? String(assignment.courseName) : 'Canvas assignment', matched ? datesConflict ? 'date conflicts with the verified course rule' : 'also found in the verified course rule' : null].filter(Boolean).join(' · '),
      courseCode: assignment.courseCode ?? null,
      dueAt: assignment.dueAt ?? null,
      href: `/app/updates?tab=assignments&assignment=${encodeURIComponent(assignment.id)}`,
      status: assignment.status === 'missing' ? 'Missing' : assignment.status === 'overdue' ? 'Overdue' : 'To do',
      source: matched ? datesConflict ? 'Canvas · rule conflict' : 'Canvas + verified course rule' : 'Canvas',
      attention: datesConflict ? 'deadline-conflict' : null,
      rank: ['missing', 'overdue'].includes(assignment.status) ? 0 : 2
    })
  }

  for (const event of events) {
    if (event.category !== 'exam' || hasPassed(event.start, now)) continue
    priorities.push({
      id: `exam:${event.id}`,
      kind: 'exam',
      title: deadlineTitle(event),
      detail: 'Dated exam in your academic plan.',
      courseCode: event.courseCode ?? null,
      dueAt: event.start,
      href: event.href?.startsWith('/app/') ? event.href : '/app/calendar',
      status: 'Exam',
      source: 'Academic plan',
      rank: 2
    })
  }

  for (const course of courses) {
    const assessment = supportedCourseAssessment(course)
    if (assessment?.status !== 'confirmed') continue
    for (const [index, component] of (assessment.components ?? []).entries()) {
      if (canvasBackedComponents.has(`${course.id}:${index}`)) continue
      const text = [component.name, component.type, component.notes].filter(Boolean).join(' ')
      // Ambiguous source wording such as "date to be announced" is evidence,
      // but not a date and therefore not an actionable priority.
      if (!PROJECT_SIGNAL.test(text) || !component.deadline) continue
      const dueAt = component.deadline
      if (hasPassed(dueAt, now)) continue
      priorities.push({
        id: `project:${course.id}:${index}`,
        kind: 'project',
        title: component.name,
        detail: [component.type, component.weightPercent == null ? null : `${component.weightPercent}% of course`].filter(Boolean).join(' · ') || 'Recorded assessment milestone',
        courseCode: course.code ?? null,
        dueAt,
        dueText: null,
        href: `/app/courses/${encodeURIComponent(course.id)}`,
        status: 'Milestone',
        source: 'Verified course rule',
        rank: 3
      })
    }
  }

  return priorities
    // Missing/overdue submissions remain first. Other obligations compete by
    // date, so next month's attendance cannot hide tomorrow's exam or deadline.
    .sort((left, right) => Number(right.rank === 0) - Number(left.rank === 0) || String(left.dueAt ?? '9999').localeCompare(String(right.dueAt ?? '9999')) || left.rank - right.rank || left.id.localeCompare(right.id))
    .slice(0, limit)
}

export function clockOf(value) {
  return value.length > 10 ? value.slice(11, 16) : null
}

export function awayLabel(minutes) {
  if (minutes === null) return ''
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  if (minutes < 600) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return `in ${hours}h${rest ? ` ${rest}m` : ''}`
  }
  return `in ${Math.round(minutes / 1440)} days`
}
