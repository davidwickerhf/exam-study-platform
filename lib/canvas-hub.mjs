// One read-only view of what is happening inside the learner's Canvas courses:
// announcements, assignments with their submission state, Canvas calendar
// events, and the grade Canvas currently shows. Everything is fetched with the
// account's encrypted Personal Access Token, cached per user for a few minutes,
// and returned without any credential — no token, and no Canvas file URL that
// carries an inline verifier.
//
// A single failing course must never blank the board, so per-request failures
// are collected into `problems` and the rest of the answer is still returned.

import { createCanvasApi, sanitizeCanvasHtml } from './canvas-course-import.mjs'
import { currentUserId } from './request-context.mjs'

export const CANVAS_HUB_REFRESH_MINUTES = 10
const HUB_TTL_MS = CANVAS_HUB_REFRESH_MINUTES * 60_000
// Canvas rejects more than ten context codes on one multi-context request.
const CONTEXT_BATCH = 10
// Canvas throttles a token with a leaky bucket; a handful of parallel requests
// is comfortably within budget while still keeping the board responsive.
const REQUEST_CONCURRENCY = 6
const MAX_HUB_COURSES = 40
const MAX_CACHE_ENTRIES = 400

export const CANVAS_HUB_PARTS = Object.freeze(['announcements', 'assignments', 'events', 'grades'])
export const CANVAS_HUB_SCOPES = Object.freeze(['current', 'all'])
export const CANVAS_ANNOUNCEMENT_MAX_DAYS = 365

export const CANVAS_ASSIGNMENT_STATUSES = Object.freeze({
  graded: 'Graded',
  submitted: 'Submitted',
  missing: 'Missing',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  undated: 'No due date',
  offline: 'No Canvas hand-in',
  excused: 'Excused'
})

function text(value, max = 300) {
  return String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function chunk(values, size) {
  const groups = []
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size))
  return groups
}

async function mapWithConcurrency(values, worker, limit = REQUEST_CONCURRENCY) {
  const results = new Array(values.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await worker(values[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

function problemMessage(error) {
  return text(error instanceof Error ? error.message : String(error || 'Canvas request failed.'), 400)
}

// ── Per-user response cache ───────────────────────────────────────────────
// The cache is process-global, so the signed-in user is part of every key.
// Two accounts on the same server must never share a Canvas answer.

const hubCache = new Map()

function cacheKey(parts) {
  return [currentUserId(), ...parts].join('|')
}

function prune() {
  if (hubCache.size <= MAX_CACHE_ENTRIES) return
  for (const key of [...hubCache.keys()].slice(0, hubCache.size - MAX_CACHE_ENTRIES)) hubCache.delete(key)
}

async function cached(key, produce, { force = false } = {}) {
  const entry = hubCache.get(key)
  if (!force && entry && entry.at > Date.now() - HUB_TTL_MS) return entry.value
  const value = await produce()
  hubCache.set(key, { at: Date.now(), value })
  prune()
  return value
}

// Reconnecting Canvas replaces the token, so the answers cached under it must
// go. Only the caller's own entries are dropped; `all` is for tests.
export function clearCanvasHubCache({ all = false } = {}) {
  if (all) { hubCache.clear(); return }
  const prefix = `${currentUserId()}|`
  for (const key of hubCache.keys()) if (key.startsWith(prefix)) hubCache.delete(key)
}

// ── Course shape ──────────────────────────────────────────────────────────

// The teaching term, not the course's own dates, says whether a course is
// running. Canvas keeps a finished course readable for years — Maastricht sets
// `end_at` two academic years out — so `end_at` answers "can I still open the
// material", never "am I taking this now". `term.start_at`/`term.end_at` are
// the actual teaching window.
// Where Canvas gives the course a term, the term's dates are the window. Only
// where it does not are the course's own dates the best signal left, and a
// course with neither is a standing space — the faculty and programme
// announcement courses, which never conclude.
function teachingWindow(course) {
  if (course.term?.startAt || course.term?.endAt) return { start: course.term.startAt || null, end: course.term.endAt || null }
  return { start: course.startAt || null, end: course.endAt || null }
}
function courseStartsAt(course) { return teachingWindow(course).start }

export function canvasCourseStatus(course = {}, { now = new Date(), favourites = null } = {}) {
  const at = now instanceof Date ? now : new Date(now)
  const enrolments = Array.isArray(course.enrolments) ? course.enrolments : []
  const enrolment = enrolments.find((entry) => /student/i.test(entry?.type || '')) || enrolments[0] || null
  const { start, end } = teachingWindow(course)
  const notStarted = Boolean(start && new Date(start) > at)
  const ended = Boolean(end && new Date(end) < at)
  const favourite = favourites instanceof Set ? favourites.has(String(course.id)) : false
  const live = course.workflowState === 'available' && (!enrolment || enrolment.state === 'active')
  return {
    role: text(enrolment?.type, 100) || null,
    enrolmentState: text(enrolment?.state, 80) || null,
    favourite,
    standing: !start && !end,
    // A starred course stays current after its term closes: keeping it on the
    // Canvas dashboard is the student's own statement that it still matters.
    current: Boolean(live && !notStarted && (!ended || favourite)),
    upcoming: Boolean(live && notStarted),
    concluded: Boolean(ended || enrolment?.state === 'completed' || course.workflowState === 'completed')
  }
}

export function decorateCanvasCourses(courses = [], { now = new Date(), favourites = null } = {}) {
  return courses
    .map((course) => ({ ...course, ...canvasCourseStatus(course, { now, favourites }) }))
    .sort((left, right) => {
      if (left.current !== right.current) return Number(right.current) - Number(left.current)
      const leftDate = courseStartsAt(left) || ''
      const rightDate = courseStartsAt(right) || ''
      return String(rightDate).localeCompare(String(leftDate)) || left.name.localeCompare(right.name)
    })
}

export function selectHubCourses(courses, { scope = 'current', courseIds = [] } = {}) {
  const wanted = new Set((courseIds || []).map((id) => String(id)))
  // An empty selection is reported as an empty selection. Quietly widening to
  // every course would make "current" mean something different between periods.
  const chosen = wanted.size
    ? courses.filter((course) => wanted.has(String(course.id)))
    : scope === 'all' ? courses : courses.filter((course) => course.current || course.upcoming)
  return { courses: chosen.slice(0, MAX_HUB_COURSES), truncated: chosen.length > MAX_HUB_COURSES, considered: chosen.length }
}

// ── Records ───────────────────────────────────────────────────────────────

function sameOriginUrl(value, origin) {
  if (!value) return null
  let url
  try { url = new URL(String(value), origin) } catch { return null }
  // Canvas file URLs carry an inline `verifier` credential. Only plain course
  // and item permalinks on the connected host are handed back to the browser.
  if (url.origin !== origin || url.protocol !== 'https:' || url.searchParams.has('verifier')) return null
  return url.toString()
}

function plainText(html, max = 320) {
  return text(String(html || '')
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'"), max)
}

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Maastricht appends the Canvas section identifier to every course name
// ("Block Chains (2026-2027-100-BCS3210)"). The raw name is kept; the reading
// name drops the trailing parenthetical that merely repeats the course code.
export function canvasCourseDisplayName(name, code) {
  const full = text(name, 300)
  if (!code) return full
  const stripped = full.replace(new RegExp(`\\s*\\([^()]*${escapeRegExp(code)}[^()]*\\)\\s*$`, 'i'), '').trim()
  return stripped || full
}

function courseFacts(courseId, courseById) {
  const course = courseById.get(String(courseId)) || null
  return {
    courseId: String(courseId || ''),
    courseName: course?.displayName || course?.name || null,
    courseCode: course?.courseCode || null,
    courseCurrent: course ? Boolean(course.current) : null
  }
}

export function canvasAnnouncementText(item) { return plainText(item.html || item.excerpt || '', 100000) }

export function announcementRecord(row = {}, { courseById = new Map(), origin = '' } = {}) {
  const contextCode = String(row.context_code || '')
  const courseId = contextCode.startsWith('course_') ? contextCode.slice('course_'.length) : String(row.course_id || '')
  const html = sanitizeCanvasHtml(row.message || '')
  return {
    id: `${courseId}:${row.id}`,
    canvasId: String(row.id || ''),
    ...courseFacts(courseId, courseById),
    title: text(row.title, 300) || 'Untitled announcement',
    author: text(row.author?.display_name || row.user_name, 160) || null,
    postedAt: isoDate(row.posted_at || row.created_at || row.delayed_post_at),
    html,
    excerpt: plainText(html, 320),
    url: sameOriginUrl(row.html_url, origin),
    read: row.read_state ? row.read_state === 'read' : null,
    // Attachment bytes are not proxied: a discussion attachment is not always
    // present in the course Files index, so a fabricated download link would
    // often 404. The names are listed and the reader opens Canvas for the file.
    attachments: (Array.isArray(row.attachments) ? row.attachments : []).map((file) => ({ id: String(file?.id || ''), name: text(file?.display_name || file?.filename, 200) || 'Attachment' })).filter((file) => file.name)
  }
}

// Canvas receives nothing for these — a lecture checkpoint, a project defence,
// an in-class quiz — so they must not be reported as missing work even though
// they carry points and a date. `on_paper` is handled separately: it keeps its
// due date, but Canvas cannot know whether the paper was handed over.
const NOTHING_TO_SUBMIT = new Set(['none', 'not_graded'])

export function assignmentStatus(row = {}, { now = new Date() } = {}) {
  const at = now instanceof Date ? now : new Date(now)
  const submission = row.submission || null
  const types = Array.isArray(row.submission_types) ? row.submission_types : []
  if (submission?.excused) return 'excused'
  if (submission?.workflow_state === 'graded' && submission.score != null) return 'graded'
  if (submission?.submitted_at) return 'submitted'
  if (types.length && types.every((type) => NOTHING_TO_SUBMIT.has(type))) return 'offline'
  const handedInOffline = types.length > 0 && types.every((type) => type === 'on_paper')
  if (submission?.missing && !handedInOffline) return 'missing'
  if (!row.due_at) return 'undated'
  return new Date(row.due_at) < at ? 'overdue' : 'upcoming'
}

export function assignmentRecord(row = {}, { courseId, courseById = new Map(), origin = '', now = new Date() } = {}) {
  const submission = row.submission || null
  const status = assignmentStatus(row, { now })
  return {
    id: `${courseId}:${row.id}`,
    canvasId: String(row.id || ''),
    ...courseFacts(courseId, courseById),
    title: text(row.name, 300) || 'Untitled assignment',
    dueAt: isoDate(row.due_at),
    unlockAt: isoDate(row.unlock_at),
    lockAt: isoDate(row.lock_at),
    pointsPossible: number(row.points_possible),
    submissionTypes: (Array.isArray(row.submission_types) ? row.submission_types : []).map((type) => text(type, 60)).filter(Boolean),
    status,
    submittedAt: isoDate(submission?.submitted_at),
    score: number(submission?.score),
    grade: text(submission?.grade, 40) || null,
    late: Boolean(submission?.late),
    url: sameOriginUrl(row.html_url, origin),
    description: plainText(row.description, 400)
  }
}

export function calendarEventRecord(row = {}, { courseById = new Map(), origin = '' } = {}) {
  const contextCode = String(row.context_code || '')
  const courseId = contextCode.startsWith('course_') ? contextCode.slice('course_'.length) : ''
  return {
    id: `${courseId || 'canvas'}:${row.id}`,
    canvasId: String(row.id || ''),
    ...courseFacts(courseId, courseById),
    title: text(row.title, 300) || 'Canvas event',
    startAt: isoDate(row.start_at),
    endAt: isoDate(row.end_at),
    allDay: Boolean(row.all_day),
    location: text(row.location_name, 200) || null,
    url: sameOriginUrl(row.html_url, origin),
    description: plainText(row.description, 400)
  }
}

export function gradeRecord(row = {}) {
  const grades = row.grades || {}
  return {
    courseId: String(row.course_id || ''),
    role: text(row.type, 100) || null,
    state: text(row.enrollment_state, 80) || null,
    currentScore: number(grades.current_score),
    currentGrade: text(grades.current_grade, 40) || null,
    finalScore: number(grades.final_score),
    finalGrade: text(grades.final_grade, 40) || null
  }
}

// ── Fetchers ──────────────────────────────────────────────────────────────

function windowFor({ days, now }) {
  const at = now instanceof Date ? now : new Date(now)
  const span = Math.min(Math.max(Number(days) || 60, 1), CANVAS_ANNOUNCEMENT_MAX_DAYS)
  const start = new Date(at.getTime() - span * 86_400_000)
  // A small forward window keeps a scheduled announcement or an event later
  // today inside the answer.
  const end = new Date(at.getTime() + 120 * 86_400_000)
  return { start: start.toISOString(), end: end.toISOString(), days: span }
}

async function fetchAnnouncements(api, courses, { origin, courseById, start, end, force, problems }) {
  const batches = chunk(courses.map((course) => String(course.id)), CONTEXT_BATCH)
  const pages = await mapWithConcurrency(batches, async (ids) => {
    const params = new URLSearchParams()
    for (const id of ids) params.append('context_codes[]', `course_${id}`)
    params.set('start_date', start)
    params.set('end_date', end)
    params.set('active_only', 'true')
    params.set('per_page', '50')
    const path = `/api/v1/announcements?${params}`
    try { return await cached(cacheKey(['announcements', origin, path]), () => api.getPaged(path), { force }) }
    catch (error) { problems.push({ part: 'announcements', courseIds: ids, error: problemMessage(error) }); return [] }
  })
  const seen = new Set()
  return pages.flat()
    .map((row) => announcementRecord(row, { courseById, origin }))
    .filter((record) => record.canvasId && !seen.has(record.id) && seen.add(record.id))
    .sort((left, right) => String(right.postedAt || '').localeCompare(String(left.postedAt || '')))
}

async function fetchAssignments(api, courses, { origin, courseById, now, force, problems }) {
  const perCourse = await mapWithConcurrency(courses, async (course) => {
    const id = String(course.id)
    const path = `/api/v1/courses/${encodeURIComponent(id)}/assignments?include[]=submission&order_by=due_at&per_page=100`
    try {
      const rows = await cached(cacheKey(['assignments', origin, path]), () => api.getPaged(path), { force })
      return rows.map((row) => assignmentRecord(row, { courseId: id, courseById, origin, now }))
    } catch (error) {
      problems.push({ part: 'assignments', courseIds: [id], error: problemMessage(error) })
      return []
    }
  })
  return perCourse.flat().sort((left, right) => {
    if (Boolean(left.dueAt) !== Boolean(right.dueAt)) return left.dueAt ? -1 : 1
    return String(left.dueAt || '').localeCompare(String(right.dueAt || '')) || left.title.localeCompare(right.title)
  })
}

async function fetchCalendarEvents(api, courses, { origin, courseById, start, end, force, problems }) {
  const batches = chunk(courses.map((course) => String(course.id)), CONTEXT_BATCH)
  const pages = await mapWithConcurrency(batches, async (ids) => {
    const params = new URLSearchParams()
    for (const id of ids) params.append('context_codes[]', `course_${id}`)
    params.set('type', 'event')
    params.set('start_date', start)
    params.set('end_date', end)
    params.set('per_page', '100')
    const path = `/api/v1/calendar_events?${params}`
    try { return await cached(cacheKey(['events', origin, path]), () => api.getPaged(path), { force }) }
    catch (error) { problems.push({ part: 'events', courseIds: ids, error: problemMessage(error) }); return [] }
  })
  const seen = new Set()
  return pages.flat()
    .map((row) => calendarEventRecord(row, { courseById, origin }))
    .filter((record) => record.startAt && !seen.has(record.id) && seen.add(record.id))
    .sort((left, right) => String(left.startAt).localeCompare(String(right.startAt)))
}

async function fetchGrades(api, { origin, force, problems }) {
  const path = '/api/v1/users/self/enrollments?state[]=active&state[]=completed&per_page=100'
  try {
    const rows = await cached(cacheKey(['grades', origin, path]), () => api.getPaged(path), { force })
    return rows.map(gradeRecord).filter((record) => record.courseId)
  } catch (error) {
    problems.push({ part: 'grades', courseIds: [], error: problemMessage(error) })
    return []
  }
}

export async function fetchCanvasCourseCatalogue({ origin, token, fetchImpl = fetch, force = false, now = new Date() } = {}) {
  const api = createCanvasApi({ origin, accessToken: token, fetchImpl })
  const [courses, favourites] = await Promise.all([
    cached(cacheKey(['courses', origin]), () => api.getPaged('/api/v1/users/self/courses?enrollment_state=all&include[]=term&include[]=enrollments&per_page=100'), { force }),
    // What Canvas itself puts on the dashboard. A starred course counts as
    // current even once its term has closed: that is the student's own answer.
    cached(cacheKey(['favourites', origin]), async () => {
      try { return (await api.getPaged('/api/v1/users/self/favorites/courses?per_page=100')).map((course) => String(course.id)) }
      catch { return [] }
    }, { force })
  ])
  return decorateCanvasCourses(courses.map((course) => ({
    id: String(course.id || ''),
    name: text(course.name, 300) || `Canvas course ${course.id}`,
    displayName: canvasCourseDisplayName(course.name, course.course_code) || `Canvas course ${course.id}`,
    courseCode: text(course.course_code, 160) || null,
    workflowState: text(course.workflow_state, 80) || null,
    startAt: course.start_at || null,
    endAt: course.end_at || null,
    term: course.term ? { id: String(course.term.id || ''), name: text(course.term.name, 300) || null, startAt: course.term.start_at || null, endAt: course.term.end_at || null } : null,
    enrolments: Array.isArray(course.enrollments) ? course.enrollments.map((enrolment) => ({ type: text(enrolment.type, 100) || null, role: text(enrolment.role, 160) || null, state: text(enrolment.enrollment_state, 80) || null })) : [],
    courseUrl: `${origin}/courses/${encodeURIComponent(course.id)}`
  })).filter((course) => course.id), { now, favourites: new Set(favourites) })
}

// The board in one call. `parts` keeps the calendar route from paying for
// announcements it will not show, while still sharing the per-course cache.
export async function fetchCanvasHub({
  origin,
  token,
  scope = 'current',
  courseIds = [],
  days = 60,
  parts = CANVAS_HUB_PARTS,
  now = new Date(),
  force = false,
  fetchImpl = fetch
} = {}) {
  const at = now instanceof Date ? now : new Date(now)
  const wanted = new Set((Array.isArray(parts) ? parts : [parts]).filter((part) => CANVAS_HUB_PARTS.includes(part)))
  const problems = []
  const api = createCanvasApi({ origin, accessToken: token, fetchImpl })
  const catalogue = await fetchCanvasCourseCatalogue({ origin, token, fetchImpl, force, now: at })
  const selection = selectHubCourses(catalogue, { scope: CANVAS_HUB_SCOPES.includes(scope) ? scope : 'current', courseIds })
  const courseById = new Map(catalogue.map((course) => [String(course.id), course]))
  const window = windowFor({ days, now: at })
  const context = { origin, courseById, now: at, force, problems, start: window.start, end: window.end }

  const [announcements, assignments, events, grades] = await Promise.all([
    wanted.has('announcements') && selection.courses.length ? fetchAnnouncements(api, selection.courses, context) : [],
    wanted.has('assignments') && selection.courses.length ? fetchAssignments(api, selection.courses, context) : [],
    wanted.has('events') && selection.courses.length ? fetchCalendarEvents(api, selection.courses, context) : [],
    wanted.has('grades') ? fetchGrades(api, context) : []
  ])

  return {
    origin,
    fetchedAt: new Date().toISOString(),
    refreshMinutes: CANVAS_HUB_REFRESH_MINUTES,
    scope,
    window: { start: window.start, end: window.end, days: window.days },
    courses: catalogue,
    selectedCourseIds: selection.courses.map((course) => String(course.id)),
    truncated: selection.truncated,
    announcements,
    assignments,
    events,
    grades,
    statuses: CANVAS_ASSIGNMENT_STATUSES,
    problems
  }
}
