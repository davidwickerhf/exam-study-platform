import { readCourseAnnouncements } from './tutor-course-updates.mjs'
import { randomUUID, createHash } from 'node:crypto'
import { readAcademicState } from './academics.mjs'
import { aggregateCalendar, feedEvents } from './calendar-feed.mjs'
import { loadEditorialState } from './editorial-store.mjs'
import { canvasPriorityProfiles } from './priority-evidence.mjs'
import { programmePriorityCourses } from './priority-courses.mjs'
import { currentUserId } from './request-context.mjs'
import { upsertAttendanceRecord } from './attendance.mjs'

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max)
const localTime = now => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now).replace(' ', 'T')
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(value).toISOString().slice(0, 10) === value ? value : null
export function attendanceSessionFinished(event, now = new Date()) {
  const end = event.end || event.start
  if (!end || Number.isNaN(new Date(end).getTime())) return false
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(end) ? new Date(end).getTime() <= now.getTime() : end <= localTime(now)
}

export function tutorAttendanceReports(events, { from, to, now = new Date() }) {
  const groups = new Map()
  for (const event of events.filter(item => item.attendanceEligible && attendanceSessionFinished(item, now))) {
    const policy = event.attendancePolicy
    // Do not combine lecture and lab thresholds, or conflicting/different rules.
    const key = JSON.stringify([event.courseCode, event.activity, event.attendanceRule, policy?.allowedMisses, policy?.minimumAttendancePercent])
    if (!groups.has(key)) groups.set(key, { id: `attendance-${createHash('sha256').update(`${key}:${from}:${to}`).digest('hex').slice(0, 16)}`, course: event.courseCode, activity: event.activity || 'Teaching sessions', from, to,
      attended: 0, missed: 0, excused: 0, unmarked: 0, rate: null,
      requirement: event.attendanceRule || 'No confirmed attendance requirement available for these sessions.',
      minimumPercent: policy?.minimumAttendancePercent ?? null, allowedMisses: policy?.allowedMisses ?? null,
      source: policy?.source || 'Requirement not confirmed', note: 'Personal attendance log for this date range, not an official university attendance record. Unmarked and excused sessions are excluded from the recorded rate.' })
    const group = groups.get(key)
    const status = ['attended', 'missed', 'excused'].includes(event.attendanceStatus) ? event.attendanceStatus : 'unmarked'
    group[status]++
  }
  return [...groups.values()].map(group => ({ ...group, rate: group.attended + group.missed ? Math.round(group.attended / (group.attended + group.missed) * 100) : null }))
}

export async function readTutorAttendance({ courseCode = '', from = '', to = '' } = {}) {
  const now = new Date()
  const today = localTime(now).slice(0, 10)
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 8 ? 1 : 0)
  const start = from ? date(from) : `${year}-08-01`
  const end = to ? date(to) : today
  if (!start || !end || start > end) throw new Error('Attendance needs a valid date range.')
  const [{ workspace }, editorial, scans] = await Promise.all([readAcademicState(), loadEditorialState(new URL('../data/study-state.template.json', import.meta.url)), canvasPriorityProfiles({ accountId: currentUserId() }).catch(() => [])])
  const feeds = await Promise.all((workspace.calendars || []).map(async link => {
    try { return { link, events: await feedEvents(link) } } catch { return { link, events: [], failed: true } }
  }))
  const calendar = aggregateCalendar({ workspace, editorialCourses: editorial.courses || [], ruleCourses: programmePriorityCourses(workspace, editorial.courses || [], scans), feeds })
  const code = clean(courseCode, 40).toUpperCase()
  const events = calendar.events.filter(event => event.attendanceEligible && (!code || event.courseCode === code) && event.start.slice(0, 10) >= start && event.start.slice(0, 10) <= end)
  const updates = await readCourseAnnouncements({ courseCode: code, rulesOnly: true, limit: 20 }).catch(error => ({ announcements: [], note: error.message }))
  const reports = tutorAttendanceReports(events, { from: start, to: end, now }).map(report => ({ ...report, updates: updates.announcements.filter(item => item.course === report.course), updateCoverage: updates.note }))
  const sessions = events.filter(event => attendanceSessionFinished(event, now)).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 100)
  return { workspace, events, reports, from: start, to: end, sessions, omittedSessions: Math.max(0, events.filter(event => attendanceSessionFinished(event, now)).length - sessions.length),
    note: !feeds.length ? 'No timetable is connected.' : feeds.some(feed => feed.failed) ? 'Some timetable feeds could not be read; attendance coverage is incomplete.' : 'Covers teaching sessions available in the connected timetable for this range. Missing feed history is not proof of attendance or absence.' }
}

const fingerprint = record => JSON.stringify(record || null)
export function stageTutorAttendance({ workspace, events }, { eventIds, status, note = '' }, now = new Date()) {
  if (!Array.isArray(eventIds) || !eventIds.length || eventIds.length > 20 || !['attended', 'missed', 'unknown'].includes(status)) throw new Error('Choose 1–20 sessions and attended, missed, or unknown. Tutor cannot grant an excused absence.')
  const selected = [...new Set(eventIds)].map(id => events.find(event => event.id === id))
  if (selected.some(event => !event || !event.attendanceEligible || event.category !== 'timetable' || !attendanceSessionFinished(event, now))) throw new Error('Choose completed teaching sessions returned by get_attendance. Future or unknown sessions cannot be marked.')
  const records = workspace.planning?.attendanceRecords || []
  const entries = selected.map(event => ({ event, before: fingerprint(records.find(record => record.eventId === event.id)) }))
  return { id: `proposal-${randomUUID()}`, type: 'attendance-update', title: `${status === 'unknown' ? 'Clear attendance for' : `Mark ${status}:`} ${entries.length} session${entries.length === 1 ? '' : 's'}`,
    summary: [...new Set(selected.map(event => event.courseCode))].join(', '),
    detail: selected.map(event => `${event.activity || event.title} · ${event.start.replace('T', ' ').slice(0, 16)} · ${event.attendanceStatus || 'unknown'} → ${status}`).join('\n') + '\nPersonal attendance log, based on your report.',
    payload: { workspaceId: workspace.id, entries, status, note: clean(note) }, reversible: true }
}

export function applyTutorAttendance(workspace, payload, now = new Date()) {
  if (workspace.id !== payload.workspaceId) throw new Error('The active programme changed. Ask Tutor to prepare this attendance update again.')
  if (!['attended', 'missed', 'unknown'].includes(payload.status) || !payload.entries?.length || payload.entries.length > 20) throw new Error('This attendance update is invalid.')
  const records = workspace.planning?.attendanceRecords || []
  for (const { event, before } of payload.entries) {
    if (!event.attendanceEligible || event.category !== 'timetable' || !attendanceSessionFinished(event, now)) throw new Error('Only completed teaching sessions can be marked.')
    if (fingerprint(records.find(record => record.eventId === event.id)) !== before) throw new Error('Attendance changed since this proposal. Ask Tutor to review the current record before approving.')
  }
  const next = structuredClone(workspace)
  next.planning ||= { objectives: {}, periodAssignments: [], academicPeriods: [], attendanceRecords: [] }
  for (const { event } of payload.entries) next.planning.attendanceRecords = upsertAttendanceRecord(next.planning.attendanceRecords, event, payload.status, `Self-reported via Tutor${payload.note ? `: ${payload.note}` : ''}`, now)
  return next
}
