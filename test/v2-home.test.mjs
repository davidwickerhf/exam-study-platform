// Home's rules, tested where they run.
//
// The implementation is plain ESM with a .d.ts beside it rather than a .ts
// file, so this test imports the same module the page does. The alternative —
// a TypeScript copy transpiled in the test — was not available: this project's
// compiler is the native 7.x build, which has no transpileModule, and a
// hand-maintained second copy is exactly how two versions of a rule drift.
//
// The week calculation is the one that already shipped wrong, reading
// "week 2 of 8" on the Monday a period began.

import test from 'node:test'
import assert from 'node:assert/strict'
import { awayLabel, dayEntries, deadlineTitle, homePriorities, leadEntry, periodWeek, roomOf } from '../lib/workspace/home.mjs'

// Maastricht Period 1, 2026–2027: Monday 31 August through Friday 23 October.
const START = '2026-08-31'
const END = '2026-10-23'

test('the first day of a period is week 1', () => {
  assert.deepEqual(periodWeek(START, END, START), { week: 1, weeks: 8 })
})

test('the rest of the opening week is still week 1, and the next Monday is week 2', () => {
  assert.equal(periodWeek(START, END, '2026-09-02').week, 1)
  assert.equal(periodWeek(START, END, '2026-09-06').week, 1)
  assert.equal(periodWeek(START, END, '2026-09-07').week, 2)
})

test('the period counts eight weeks inclusive, and nothing exceeds it', () => {
  assert.equal(periodWeek(START, END, END).week, 8)
  assert.equal(periodWeek(START, END, '2026-11-30').week, 8)
})

test('missing dates produce no claim at all', () => {
  assert.deepEqual(periodWeek(null, END, START), { week: null, weeks: null })
  assert.deepEqual(periodWeek(START, null, START), { week: null, weeks: null })
})

test('a deadline does not print its course code twice', () => {
  assert.equal(deadlineTitle({ title: 'BCS3120 · Quiz 1', courseCode: 'BCS3120' }), 'Quiz 1')
  assert.equal(deadlineTitle({ title: 'Quiz 1', courseCode: 'BCS3120' }), 'Quiz 1')
  assert.equal(deadlineTitle({ title: 'BCS3120', courseCode: 'BCS3120' }), 'BCS3120')
})

test('only the room is taken out of a timetable note', () => {
  const event = { notes: '08:30 - 10:30 · DUB30 0.050 · Type: Lecture · Staff: someone · Last synchronised 1h ago' }
  assert.equal(roomOf(event), 'DUB30 0.050')
  assert.equal(roomOf({ notes: null }), null)
})

test('the lead is whatever is running, and the rest of the day excludes it', () => {
  const iso = '2026-09-02'
  const at = (hour) => `${iso}T${String(hour).padStart(2, '0')}:00:00`
  const events = [
    { id: 'a', category: 'timetable', start: at(11), end: at(13), title: 'A', courseCode: null, courseName: 'A', notes: null, externalHref: null, href: null, allDay: false },
    { id: 'b', category: 'timetable', start: at(13), end: at(15), title: 'B', courseCode: null, courseName: 'B', notes: null, externalHref: null, href: null, allDay: false },
    { id: 'c', category: 'timetable', start: at(16), end: at(18), title: 'C', courseCode: null, courseName: 'C', notes: null, externalHref: null, href: null, allDay: false }
  ]
  const entries = dayEntries(events, iso)
  const now = new Date(at(14)).getTime()
  const lead = leadEntry(entries, now)
  assert.equal(lead.event.id, 'b', 'the class in progress leads')
  // The bug this pins: computing the rest separately dropped C, because the
  // lead was assumed to be the first future entry.
  const rest = entries.filter((entry) => entry.startsAt > now && entry.event !== lead.event)
  assert.deepEqual(rest.map((entry) => entry.event.id), ['c'])
})

test('the lead falls through to the next entry when nothing is running', () => {
  const iso = '2026-09-02'
  const at = (hour) => `${iso}T${String(hour).padStart(2, '0')}:00:00`
  const events = [{ id: 'a', category: 'timetable', start: at(16), end: at(18), title: 'A', courseCode: null, courseName: 'A', notes: null, externalHref: null, href: null, allDay: false }]
  const entries = dayEntries(events, iso)
  assert.equal(leadEntry(entries, new Date(at(9)).getTime()).event.id, 'a')
  assert.equal(leadEntry(entries, new Date(at(20)).getTime()), null)
})

test('time remaining reads in the unit that suits it', () => {
  assert.equal(awayLabel(0), 'now')
  assert.equal(awayLabel(25), 'in 25 min')
  assert.equal(awayLabel(90), 'in 1h 30m')
  assert.equal(awayLabel(120), 'in 2h')
  assert.equal(awayLabel(2880), 'in 2 days')
})

test('home priorities surface only evidenced attendance, assignments, and project milestones', () => {
  const now = new Date('2026-09-03T08:00:00Z').getTime()
  const priorities = homePriorities({
    now,
    events: [
      { id: 'lecture', category: 'timetable', start: '2026-09-03T10:00:00Z', title: 'Lecture', courseCode: 'BCS1540', courseName: 'Algorithmic Design', notes: '10:00–12:00 · C0.001' },
      { id: 'tutorial', category: 'timetable', start: '2026-09-03T12:00:00Z', title: 'Tutorial', courseCode: 'BCS1540', courseName: 'Algorithmic Design', notes: '12:00–14:00 · C0.002' },
      { id: 'optional', category: 'timetable', start: '2026-09-03T13:00:00Z', title: 'Tutorial', courseCode: 'BCS1520', courseName: 'Statistics', notes: null }
    ],
    assignments: [
      { id: 'late', title: 'BCS1520 · Problem set', courseCode: 'BCS1520', courseName: 'Statistics', dueAt: '2026-09-02T23:59:00Z', status: 'overdue', url: null },
      { id: 'done', title: 'Quiz', courseCode: 'BCS1520', dueAt: '2026-09-04T23:59:00Z', status: 'submitted', url: null }
    ],
    courses: [
      { id: 'alg', code: 'BCS1540', courseProfile: { assessment: { status: 'confirmed', attendanceRules: ['Attendance at every lecture is mandatory.'], components: [{ name: 'Group project', type: 'Project', weightPercent: 30, deadline: '2026-09-20' }] } } }
    ]
  })

  assert.deepEqual(priorities.map((item) => [item.kind, item.title, item.status]), [
    ['assignment', 'Problem set', 'Overdue'],
    ['attendance', 'Algorithmic Design', 'Required'],
    ['project', 'Group project', 'Milestone']
  ])
  assert.equal(priorities.filter((item) => item.kind === 'attendance').length, 1, 'a lecture-only rule must not flag the tutorial')
})

test('unverified course rules do not become student obligations', () => {
  const priorities = homePriorities({
    now: new Date('2026-09-03T08:00:00Z').getTime(),
    events: [{ id: 'lab', category: 'timetable', start: '2026-09-03T10:00:00Z', title: 'Lab', courseCode: 'BCS1540', courseName: 'Algorithmic Design', notes: null }],
    courses: [{ id: 'alg', code: 'BCS1540', courseProfile: { assessment: { status: 'needs-review', attendanceRules: ['Labs are mandatory.'], components: [{ name: 'Group project', type: 'project', deadline: '2026-09-20' }] } } }]
  })
  assert.deepEqual(priorities, [])
})

test('optional and unscoped attendance wording never becomes a required appointment', () => {
  const now = new Date('2026-09-03T08:00:00Z').getTime()
  const events = [
    { id: 'optional-lab', category: 'timetable', start: '2026-09-03T10:00:00Z', title: 'Optional lab', courseCode: 'BCS1540', courseName: 'Algorithmic Design', notes: 'Attendance recommended' },
    { id: 'tutorial', category: 'timetable', start: '2026-09-03T12:00:00Z', title: 'Tutorial', courseCode: 'BCS1540', courseName: 'Algorithmic Design', notes: null }
  ]
  const courses = [{ id: 'alg', code: 'BCS1540', courseProfile: { assessment: { status: 'confirmed', attendanceRules: ['Attendance is mandatory.'] } } }]
  assert.deepEqual(homePriorities({ now, events, courses }), [])
})

test('ambiguous project date text is evidence, not an invented dated priority', () => {
  const priorities = homePriorities({
    now: new Date('2026-09-03T08:00:00Z').getTime(),
    courses: [{ id: 'alg', code: 'BCS1540', courseProfile: { assessment: { status: 'confirmed', components: [{ name: 'Group project', type: 'project', deadlineText: 'Date to be announced' }] } } }]
  })
  assert.deepEqual(priorities, [])
})

test('date-only exams and project deadlines remain priorities for their whole day', () => {
  const priorities = homePriorities({
    now: new Date('2026-09-17T18:00:00Z').getTime(),
    events: [{ id: 'exam-1', category: 'exam', start: '2026-09-17', title: 'BCS1540 · Algorithmic Design', courseCode: 'BCS1540', courseName: 'Algorithmic Design', href: null }],
    courses: [{ id: 'alg', code: 'BCS1540', courseProfile: { assessment: { status: 'confirmed', components: [{ name: 'Group project', type: 'project', deadline: '2026-09-17' }] } } }]
  })
  assert.deepEqual(priorities.map((item) => item.kind), ['exam', 'project'])
})

test('a dated course exam is a priority with academic-plan provenance', () => {
  const [priority] = homePriorities({
    now: new Date('2026-09-03T08:00:00Z').getTime(),
    events: [{ id: 'exam-1', category: 'exam', start: '2026-09-17', title: 'BCS1540 · Algorithmic Design', courseCode: 'BCS1540', courseName: 'Algorithmic Design', href: '#/planning/courses/alg' }]
  })
  assert.deepEqual([priority.kind, priority.title, priority.source, priority.href], ['exam', 'Algorithmic Design', 'Academic plan', '/app/calendar'])
})

test('home priorities stay empty when no source records an obligation', () => {
  assert.deepEqual(homePriorities({
    now: new Date('2026-09-03T08:00:00Z').getTime(),
    events: [{ id: 'optional', category: 'timetable', start: '2026-09-03T13:00:00Z', title: 'Tutorial', courseCode: 'BCS1520', courseName: 'Statistics', notes: null }],
    assignments: [],
    courses: []
  }), [])
})
