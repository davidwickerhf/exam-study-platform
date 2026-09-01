import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CANVAS_ASSIGNMENT_STATUSES,
  announcementRecord,
  assignmentRecord,
  assignmentStatus,
  calendarEventRecord,
  canvasCourseStatus,
  clearCanvasHubCache,
  decorateCanvasCourses,
  fetchCanvasHub,
  gradeRecord,
  selectHubCourses
} from '../lib/canvas-hub.mjs'

const ORIGIN = 'https://canvas.example.edu'
const NOW = new Date('2026-09-01T12:00:00Z')

function json(value, headers = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

const COURSES = [
  {
    id: 1,
    name: 'Intelligent User Interfaces',
    course_code: 'BCS2130',
    workflow_state: 'available',
    term: { id: 9, name: '2026-2027 Period 1', start_at: '2026-08-31T00:00:00Z', end_at: '2026-10-30T00:00:00Z' },
    enrollments: [{ type: 'StudentEnrollment', enrollment_state: 'active' }]
  },
  {
    id: 2,
    name: 'Data Structures',
    course_code: 'BCS1110',
    workflow_state: 'available',
    term: { id: 4, name: '2025-2026 Period 4', start_at: '2026-01-05T00:00:00Z', end_at: '2026-03-20T00:00:00Z' },
    enrollments: [{ type: 'StudentEnrollment', enrollment_state: 'completed' }]
  }
]

function canvasStub(overrides = {}) {
  const calls = []
  const routes = {
    '/api/v1/users/self/courses': () => json(COURSES),
    '/api/v1/users/self/favorites/courses': () => json([]),
    '/api/v1/announcements': () => json([
      { id: 41, context_code: 'course_1', title: 'Week 1 briefing', message: '<p>Read <a href="https://x.test/a">the brief</a>.</p><script>alert(1)</script>', posted_at: '2026-09-01T08:00:00Z', html_url: `${ORIGIN}/courses/1/discussion_topics/41`, author: { display_name: 'Dr Ada' }, read_state: 'unread' },
      { id: 42, context_code: 'course_1', title: 'Room change', message: '<p>We move to C1.</p>', posted_at: '2026-08-30T08:00:00Z', html_url: `${ORIGIN}/courses/1/discussion_topics/42`, read_state: 'read' }
    ]),
    '/api/v1/courses/1/assignments': () => json([
      { id: 71, name: 'Prototype hand-in', due_at: '2026-09-10T15:00:00Z', points_possible: 20, submission_types: ['online_upload'], html_url: `${ORIGIN}/courses/1/assignments/71`, submission: null },
      { id: 72, name: 'Reading log', due_at: '2026-08-25T15:00:00Z', points_possible: 5, submission_types: ['online_text_entry'], html_url: `${ORIGIN}/courses/1/assignments/72`, submission: { submitted_at: '2026-08-24T10:00:00Z', workflow_state: 'graded', score: 4 } }
    ]),
    '/api/v1/calendar_events': () => json([
      { id: 88, context_code: 'course_1', title: 'Guest lecture', start_at: '2026-09-04T13:00:00Z', end_at: '2026-09-04T15:00:00Z', html_url: `${ORIGIN}/calendar?event_id=88`, location_name: 'C1.05' }
    ]),
    '/api/v1/users/self/enrollments': () => json([
      { course_id: 1, type: 'StudentEnrollment', enrollment_state: 'active', grades: { current_score: 78.5, current_grade: 'B' } }
    ])
  }
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    calls.push(url.pathname + url.search)
    const handler = overrides[url.pathname] || routes[url.pathname]
    if (!handler) return new Response('not found', { status: 404 })
    return handler(url)
  }
  return { fetchImpl, calls }
}

test('a course counts as current only while the enrolment and the term are live', () => {
  const [live, past] = decorateCanvasCourses([
    { ...COURSES[0], id: '1', name: COURSES[0].name, workflowState: 'available', term: { startAt: '2026-08-31T00:00:00Z', endAt: '2026-10-30T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'active' }] },
    { ...COURSES[1], id: '2', name: COURSES[1].name, workflowState: 'available', term: { startAt: '2026-01-05T00:00:00Z', endAt: '2026-03-20T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'completed' }] }
  ], { now: NOW })
  assert.equal(live.current, true)
  assert.equal(live.concluded, false)
  assert.equal(past.current, false)
  assert.equal(past.concluded, true)

  const notStarted = canvasCourseStatus({ workflowState: 'available', startAt: '2026-11-01T00:00:00Z', enrolments: [{ type: 'StudentEnrollment', state: 'active' }] }, { now: NOW })
  assert.deepEqual({ current: notStarted.current, upcoming: notStarted.upcoming }, { current: false, upcoming: true })
})

test('the teaching term outranks the course access window, which Canvas keeps open for years', () => {
  // Real Maastricht shape: a course taught in Period 1 of 2024 whose own end_at
  // sits two academic years out. Reading end_at would call it current forever.
  const byId = new Map(decorateCanvasCourses([
    { id: '1', name: 'Block Chains', courseCode: 'BCS3210', workflowState: 'available', startAt: '2026-08-17T00:00:00Z', endAt: '2028-11-01T00:00:00Z', term: { name: '2026_100 Period 1', startAt: '2026-09-01T00:00:00Z', endAt: '2026-10-24T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'active' }] },
    { id: '2', name: 'Computer Networks', courseCode: 'BCS2110', workflowState: 'available', startAt: '2024-08-17T00:00:00Z', endAt: '2026-11-01T01:00:00Z', term: { name: '2024_100 Period 1', startAt: '2024-09-02T00:00:00Z', endAt: '2024-10-26T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'active' }] },
    { id: '3', name: 'M2-2: Cybersecurity', courseCode: 'BCS2740', workflowState: 'available', endAt: '2027-11-01T00:00:00Z', term: { name: '2025_003 Semester 2', startAt: '2026-02-02T00:00:00Z', endAt: '2026-06-06T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'active' }] },
    { id: '4', name: 'Communication FSE', courseCode: 'FSE', workflowState: 'available', startAt: null, endAt: null, term: { name: 'Default term', startAt: null, endAt: null }, enrolments: [{ type: 'StudentEnrollment', state: 'active' }] }
  ], { now: NOW, favourites: new Set(['3']) }).map((course) => [course.id, course]))
  const [taught, finished, starred, standing] = ['1', '2', '3', '4'].map((id) => byId.get(id))

  assert.equal(taught.current, true, 'its term is running')
  assert.equal(finished.current, false, 'the term closed in 2024 even though the course stays readable until 2026')
  assert.equal(finished.concluded, true)
  assert.equal(starred.current, true, 'starred in Canvas, so the student still counts it')
  assert.equal(starred.favourite, true)
  assert.equal(standing.current, true, 'a faculty announcement space has no term and never ends')
  assert.equal(standing.standing, true)
})

test('an empty current selection stays empty rather than silently widening to every course', () => {
  const courses = decorateCanvasCourses([
    { id: '2', name: 'Data Structures', workflowState: 'available', term: { endAt: '2026-03-20T00:00:00Z' }, enrolments: [{ type: 'StudentEnrollment', state: 'completed' }] }
  ], { now: NOW })
  assert.deepEqual(selectHubCourses(courses, { scope: 'current' }).courses, [])
  assert.equal(selectHubCourses(courses, { scope: 'all' }).courses.length, 1)
  assert.equal(selectHubCourses(courses, { scope: 'current', courseIds: ['2'] }).courses.length, 1)
})

test('assignment status distinguishes handed in, missing, and nothing to hand in', () => {
  const statuses = (row) => assignmentStatus(row, { now: NOW })
  assert.equal(statuses({ due_at: '2026-09-10T00:00:00Z', submission_types: ['online_upload'] }), 'upcoming')
  assert.equal(statuses({ due_at: '2026-08-10T00:00:00Z', submission_types: ['online_upload'] }), 'overdue')
  assert.equal(statuses({ due_at: '2026-08-10T00:00:00Z', submission_types: ['online_upload'], submission: { missing: true } }), 'missing')
  assert.equal(statuses({ due_at: '2026-08-10T00:00:00Z', submission_types: ['online_upload'], submission: { submitted_at: '2026-08-09T00:00:00Z' } }), 'submitted')
  assert.equal(statuses({ submission_types: ['online_upload'], submission: { workflow_state: 'graded', score: 8 } }), 'graded')
  assert.equal(statuses({ submission_types: ['online_upload'], submission: { excused: true } }), 'excused')
  assert.equal(statuses({ submission_types: ['online_upload'] }), 'undated')
  // Canvas has nothing to receive for these, so they must never read as missing.
  assert.equal(statuses({ due_at: '2026-08-10T00:00:00Z', submission_types: ['not_graded'], submission: { missing: true } }), 'offline')
  assert.equal(statuses({ due_at: '2026-08-10T00:00:00Z', submission_types: ['on_paper'], submission: { missing: true } }), 'overdue')
  assert.deepEqual(Object.keys(CANVAS_ASSIGNMENT_STATUSES).sort(), ['excused', 'graded', 'missing', 'offline', 'overdue', 'submitted', 'undated', 'upcoming'])
})

test('records strip scripts and refuse Canvas URLs that carry a verifier credential', () => {
  const courseById = new Map([['1', { id: '1', name: 'Intelligent User Interfaces', courseCode: 'BCS2130', current: true }]])
  const announcement = announcementRecord({
    id: 41,
    context_code: 'course_1',
    title: 'Week 1 briefing',
    message: '<p>Hello</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>',
    posted_at: '2026-09-01T08:00:00Z',
    html_url: `${ORIGIN}/courses/1/discussion_topics/41`,
    read_state: 'unread',
    attachments: [{ id: 5, display_name: 'brief.pdf' }]
  }, { courseById, origin: ORIGIN })
  assert.equal(announcement.courseCode, 'BCS2130')
  assert.equal(announcement.read, false)
  assert.equal(announcement.excerpt, 'Hello')
  assert.ok(!/script|iframe/i.test(announcement.html))
  assert.deepEqual(announcement.attachments, [{ id: '5', name: 'brief.pdf' }])

  const withVerifier = announcementRecord({ id: 9, context_code: 'course_1', html_url: `${ORIGIN}/files/9/download?verifier=secret` }, { courseById, origin: ORIGIN })
  assert.equal(withVerifier.url, null)
  const offOrigin = announcementRecord({ id: 9, context_code: 'course_1', html_url: 'https://elsewhere.test/x' }, { courseById, origin: ORIGIN })
  assert.equal(offOrigin.url, null)

  const assignment = assignmentRecord({ id: 71, name: 'Prototype', due_at: '2026-09-10T15:00:00Z', points_possible: 20, submission_types: ['online_upload'], html_url: `${ORIGIN}/courses/1/assignments/71` }, { courseId: '1', courseById, origin: ORIGIN, now: NOW })
  assert.equal(assignment.status, 'upcoming')
  assert.equal(assignment.pointsPossible, 20)
  assert.equal(assignment.url, `${ORIGIN}/courses/1/assignments/71`)

  const event = calendarEventRecord({ id: 88, context_code: 'course_1', title: 'Guest lecture', start_at: '2026-09-04T13:00:00Z', location_name: 'C1.05' }, { courseById, origin: ORIGIN })
  assert.equal(event.courseCode, 'BCS2130')
  assert.equal(event.location, 'C1.05')

  assert.deepEqual(gradeRecord({ course_id: 1, type: 'StudentEnrollment', enrollment_state: 'active', grades: { current_score: 78.5, current_grade: 'B' } }), {
    courseId: '1', role: 'StudentEnrollment', state: 'active', currentScore: 78.5, currentGrade: 'B', finalScore: null, finalGrade: null
  })
})

test('the hub batches context codes, scopes to current courses, and caches per user', async () => {
  clearCanvasHubCache({ all: true })
  const { fetchImpl, calls } = canvasStub()
  const hub = await fetchCanvasHub({ origin: ORIGIN, token: 'canvas-token', fetchImpl, now: NOW })

  assert.equal(hub.selectedCourseIds.length, 1, 'only the live enrolment is in scope')
  assert.deepEqual(hub.selectedCourseIds, ['1'])
  assert.equal(hub.announcements.length, 2)
  assert.equal(hub.announcements[0].title, 'Week 1 briefing', 'newest first')
  assert.equal(hub.assignments.length, 2)
  assert.equal(hub.assignments.find((item) => item.canvasId === '71').status, 'upcoming')
  assert.equal(hub.assignments.find((item) => item.canvasId === '72').status, 'graded')
  assert.equal(hub.events.length, 1)
  assert.equal(hub.grades[0].currentScore, 78.5)
  assert.deepEqual(hub.problems, [])
  // Announcements and calendar events are asked for in one multi-context call.
  assert.equal(calls.filter((call) => call.startsWith('/api/v1/announcements')).length, 1)
  assert.ok(calls.some((call) => call.includes('context_codes%5B%5D=course_1')))
  assert.ok(!calls.some((call) => call.includes('course_2')), 'a concluded course is not polled')
  // The token is never part of a URL.
  assert.ok(!calls.some((call) => call.includes('canvas-token')))

  const before = calls.length
  await fetchCanvasHub({ origin: ORIGIN, token: 'canvas-token', fetchImpl, now: NOW })
  assert.equal(calls.length, before, 'a warm cache makes no further Canvas requests')

  await fetchCanvasHub({ origin: ORIGIN, token: 'canvas-token', fetchImpl, now: NOW, force: true })
  assert.ok(calls.length > before, 'an explicit refresh bypasses the cache')
  clearCanvasHubCache({ all: true })
})

test('one failing Canvas resource is reported without blanking the rest of the board', async () => {
  clearCanvasHubCache({ all: true })
  const { fetchImpl } = canvasStub({
    '/api/v1/courses/1/assignments': () => new Response('nope', { status: 403 })
  })
  const hub = await fetchCanvasHub({ origin: ORIGIN, token: 'canvas-token', fetchImpl, now: NOW })
  assert.equal(hub.assignments.length, 0)
  assert.equal(hub.announcements.length, 2, 'announcements still arrive')
  assert.equal(hub.problems.length, 1)
  assert.equal(hub.problems[0].part, 'assignments')
  assert.match(hub.problems[0].error, /403|denied/i)
  clearCanvasHubCache({ all: true })
})

test('parts limits which Canvas resources are requested at all', async () => {
  clearCanvasHubCache({ all: true })
  const { fetchImpl, calls } = canvasStub()
  const hub = await fetchCanvasHub({ origin: ORIGIN, token: 'canvas-token', fetchImpl, now: NOW, parts: ['assignments', 'events'] })
  assert.equal(hub.announcements.length, 0)
  assert.equal(hub.grades.length, 0)
  assert.equal(hub.assignments.length, 2)
  assert.ok(!calls.some((call) => call.startsWith('/api/v1/announcements')))
  assert.ok(!calls.some((call) => call.startsWith('/api/v1/users/self/enrollments')))
  clearCanvasHubCache({ all: true })
})
