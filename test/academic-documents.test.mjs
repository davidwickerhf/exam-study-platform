import test from 'node:test'
import assert from 'node:assert/strict'
import { applyChanges, buildChangeSet, calendarChangeSet, normalizeCalendarLink, parseIcs } from '../lib/academic-documents.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:exam-1
DTSTART:20261014T090000Z
DTEND:20261014T120000Z
SUMMARY:BCS1520 Statistics exam
LOCATION:Hall A
END:VEVENT
BEGIN:VEVENT
UID:reg-1
DTSTART;VALUE=DATE:20261001
DTEND;VALUE=DATE:20261008
SUMMARY:Resit registration window
DESCRIPTION:Register via the student portal\\, before noon.
END:VEVENT
END:VCALENDAR`

test('parseIcs reads timed and all-day events with types and notes', () => {
  const events = parseIcs(ICS)
  assert.equal(events.length, 2)
  assert.deepEqual(events[0], {
    id: 'ics-exam-1', uid: 'exam-1', recurrenceId: null, title: 'BCS1520 Statistics exam', date: '2026-10-14', endDate: null,
    startTime: '09:00', endTime: '12:00', location: 'Hall A', status: null, cancelled: false, sequence: null,
    lastModified: null, type: 'deadline', notes: '09:00–12:00 · Hall A'
  })
  assert.equal(events[1].date, '2026-10-01')
  assert.equal(events[1].endDate, '2026-10-07')
  assert.equal(events[1].type, 'registration')
  assert.match(events[1].notes, /Register via the student portal, before noon\./)
})

test('parseIcs preserves the fields required to detect timetable cancellations', () => {
  const [event] = parseIcs(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:class-7\nSEQUENCE:4\nLAST-MODIFIED:20260904T101500Z\nSTATUS:CANCELLED\nDTSTART:20260908T083000Z\nDTEND:20260908T103000Z\nSUMMARY:BCS2130 tutorial\nLOCATION:Room C0.016\nEND:VEVENT\nEND:VCALENDAR`)
  assert.equal(event.id, 'ics-class-7')
  assert.equal(event.status, 'CANCELLED')
  assert.equal(event.cancelled, true)
  assert.equal(event.sequence, 4)
  assert.equal(event.location, 'Room C0.016')
})

test('calendar links accept webcal and reject other schemes', () => {
  assert.equal(normalizeCalendarLink('webcal://example.edu/feed.ics').url, 'https://example.edu/feed.ics')
  assert.throws(() => normalizeCalendarLink('ftp://x'), /http\(s\)/)
})

test('change sets diff a draft against the plan and apply selectively', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { university: 'Maastricht University', programme: 'BSc Computer Science' },
    courses: [
      { id: 'c-stats', code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ id: 'a1', academicYear: '2026-2027', type: 'first', examDate: null, grade: null, status: 'upcoming' }] },
      { id: 'c-alg', code: 'BCS1540', name: 'Algorithmic Design', ects: 4, attempts: [] }
    ],
    events: [{ id: 'e1', title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' }]
  })
  const draft = {
    profile: { university: '', programme: '', academicYear: '2026-2027' },
    courses: [
      { code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ academicYear: '2026-2027', type: 'first', examDate: '2026-10-14', grade: null, status: 'upcoming' }] },
      { code: 'BCS1540', name: 'Algorithmic Design', ects: 4, attempts: [{ academicYear: '2025-2026', type: 'first', examDate: '2026-05-20', grade: 7.5, status: 'passed' }] },
      { code: 'BCS2999', name: 'Brand New Course', ects: 6, yearLevel: 'Year 2', period: 'Period 4', attempts: [] }
    ],
    events: [
      { title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' },
      { title: 'Graduation ceremony', date: '2027-07-01', endDate: null, type: 'ceremony', notes: '' }
    ],
    warnings: []
  }
  const set = buildChangeSet(workspace, draft, { kind: 'exam-schedule' })
  const kinds = set.changes.map((change) => change.kind).sort()
  assert.deepEqual(kinds, ['event', 'exam-date', 'new-course', 'profile', 'result'])
  const examDate = set.changes.find((change) => change.kind === 'exam-date')
  assert.equal(examDate.payload.attemptId, 'a1')
  assert.deepEqual(examDate.payload.updates, { examDate: '2026-10-14' })
  assert.equal(set.changes.find((change) => change.kind === 'new-course').selectedByDefault, false)
  assert.equal(set.reconciliation.status, 'attention')
  assert.deepEqual(set.reconciliation.unselected.map((item) => item.code), ['BCS2999'])

  const accepted = set.changes.filter((change) => change.kind !== 'new-course')
  const { workspace: next, applied } = applyChanges(workspace, accepted)
  assert.equal(applied.length, 4)
  assert.equal(next.courses.find((course) => course.id === 'c-stats').attempts[0].examDate, '2026-10-14')
  const alg = next.courses.find((course) => course.id === 'c-alg')
  assert.equal(alg.attempts.length, 1)
  assert.equal(alg.attempts[0].grade, 7.5)
  assert.equal(alg.attempts[0].status, 'passed')
  assert.equal(next.courses.length, 2)
  assert.equal(next.events.length, 2)
  assert.equal(next.profile.academicYear, '2026-2027')

  // Re-running the same draft proposes nothing that is already applied.
  const again = buildChangeSet(next, draft)
  assert.deepEqual(again.changes.map((change) => change.kind), ['new-course'])
})

test('a timetable cannot silently schedule a completed course or replace selected course facts', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'c-stats', code: 'BCS1520', name: 'Statistics', ects: 4, attempts: [{ id: 'a-passed', academicYear: '2025-2026', type: 'first', examDate: '2026-05-20', grade: 8, status: 'passed' }] }]
  })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [{ code: 'BCS1520', name: 'Statistics', ects: 6, attempts: [{ academicYear: '2026-2027', type: 'first', examDate: '2026-10-14', grade: null, status: 'upcoming' }] }],
    events: []
  }, { kind: 'timetable', sourceLabel: 'Autumn timetable' })

  const courseConflict = set.changes.find((change) => change.kind === 'course-conflict')
  const attemptConflict = set.changes.find((change) => change.kind === 'attempt-conflict')
  assert.match(courseConflict.detail, /4 ECTS.*6 ECTS/)
  assert.match(attemptConflict.label, /scheduled although already completed/)
  assert.equal(courseConflict.selectedByDefault, false)
  assert.equal(attemptConflict.selectedByDefault, false)

  const unchanged = applyChanges(workspace, set.changes.filter((change) => change.selectedByDefault !== false)).workspace
  assert.equal(unchanged.courses[0].ects, 4)
  assert.equal(unchanged.courses[0].attempts.length, 1)
  assert.equal(unchanged.courses[0].attempts[0].status, 'passed')
})

test('events for an unselected course require that course to be added', () => {
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [], events: [] })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [],
    events: [{ title: 'BCS2999 Lecture', date: '2026-09-02', endDate: null, type: 'other', notes: '09:00–11:00' }]
  }, { kind: 'timetable', sourceLabel: 'Timetable' })
  const addCourse = set.changes.find((change) => change.kind === 'new-course')
  const addEvent = set.changes.find((change) => change.kind === 'event')

  assert.equal(addEvent.requiresCourseChangeId, addCourse.id)
  assert.equal(addEvent.selectedByDefault, false)
  assert.equal(applyChanges(workspace, [addEvent]).applied.length, 0)

  const applied = applyChanges(workspace, [addEvent, addCourse])
  assert.deepEqual(applied.applied, [addCourse.id, addEvent.id])
  assert.equal(applied.workspace.courses[0].code, 'BCS2999')
  assert.equal(applied.workspace.events.length, 1)
})

test('equivalent academic-year punctuation does not create a conflict', () => {
  const workspace = normalizeAcademicWorkspace({ profile: { academicYear: '2026-2027' }, courses: [], events: [] })
  const set = buildChangeSet(workspace, { profile: { academicYear: '2026–2027' }, courses: [], events: [] }, { kind: 'transcript' })
  assert.equal(set.changes.some((change) => change.payload?.field === 'academicYear'), false)
})

test('equivalent programme wording does not create a false conflict', () => {
  const workspace = normalizeAcademicWorkspace({ profile: { programme: 'Bachelor of Science Computer Science' }, courses: [], events: [] })
  const set = buildChangeSet(workspace, { profile: { programme: 'Bachelor of Science in Computer Science' }, courses: [], events: [] }, { kind: 'transcript' })
  assert.equal(set.changes.some((change) => change.payload?.field === 'programme'), false)
})

test('a calendar subscription returns a compact cross-reference instead of event changes', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [
      { id: 'c-stats', code: 'BCS1520', name: 'Statistics', attempts: [] },
      { id: 'c-alg', code: 'BCS1540', name: 'Algorithmic Design', attempts: [] }
    ]
  })
  const events = [
    { id: 'one', title: 'BCS1520/2026-100/Lecture', date: '2026-09-01', type: 'other', notes: '09:00–11:00' },
    { id: 'two', title: 'BCS3130/2026-100/Lecture', date: '2026-09-02', type: 'other', notes: '11:00–13:00' },
    { id: 'three', title: 'DACS: Course registration closes 17 July 2025', date: '2026-07-06', type: 'registration', notes: 'This appointment opens on 2026-06-01' }
  ]
  const result = calendarChangeSet(workspace, events, { id: 'cal-1', label: 'University timetable' })

  assert.equal(result.kind, 'calendar-feed')
  assert.deepEqual(result.changes, [])
  assert.deepEqual(result.reconciliation.unselected.map((item) => item.code), ['BCS3130'])
  assert.deepEqual(result.reconciliation.missing, [])
  assert.equal(result.feedSummary.eventCount, 3)
  assert.equal(result.feedSummary.matchedEvents, 1)
  assert.equal(result.feedSummary.unselectedEvents, 1)
  assert.equal(result.feedSummary.generalEvents, 1)
  assert.equal(result.feedSummary.rangeStart, '2026-07-06')
  assert.equal(result.feedSummary.rangeEnd, '2026-09-02')
})

test('a transcript preserves repeated attempts without rewriting the current curriculum', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { academicYear: '2026-2027' },
    courses: [{ id: 'current-stats', code: 'BCS1520', name: 'Current Statistics', ects: 6, yearLevel: 'Year 2', period: 'Period 1', attempts: [] }]
  })
  const set = buildChangeSet(workspace, {
    profile: { academicYear: '2024-2025' },
    courses: [{
      code: 'BCS1520', name: 'Old Statistics', ects: 5, yearLevel: 'Year 1', period: 'Period 4',
      attempts: [
        { academicYear: '2023-2024', type: 'first', examDate: '2024-01-20', grade: 4.2, status: 'failed' },
        { academicYear: '2023-2024', type: 'resit', examDate: '2024-06-18', grade: 5.1, status: 'failed' },
        { academicYear: '2024-2025', type: 'carry-over', examDate: '2025-01-21', grade: 6.4, status: 'passed' }
      ]
    }]
  }, { kind: 'transcript', sourceLabel: 'Official transcript' })

  assert.equal(set.changes.some((change) => change.kind === 'profile' || change.kind === 'profile-conflict' || change.kind === 'course-detail' || change.kind === 'course-conflict'), false)
  const results = set.changes.filter((change) => change.kind === 'result')
  assert.equal(results.length, 3)
  assert.equal(new Set(results.map((change) => change.id)).size, 3)
  const applied = applyChanges(workspace, results).workspace
  assert.equal(applied.profile.academicYear, '2026-2027')
  assert.equal(applied.courses[0].name, 'Current Statistics')
  assert.equal(applied.courses[0].ects, 6)
  assert.deepEqual(applied.courses[0].attempts.map((attempt) => attempt.grade), [4.2, 5.1, 6.4])
})

test('an academic overview keeps a failed course active as a later carry-over', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { academicYear: '2026–2027' },
    courses: [{ id: 'interfaces', code: 'BCS2130', name: 'Intelligent User Interfaces', ects: 4, period: 'Period 1', attempts: [{ id: 'failed-2025', academicYear: '2025–2026', type: 'first', grade: 5, status: 'failed' }] }]
  })
  const set = buildChangeSet(workspace, {
    profile: { academicYear: '2026–2027' },
    courses: [{ code: 'BCS2130', name: 'Intelligent User Interfaces', ects: 4, period: 'Period 1', attempts: [
      { academicYear: '2025–2026', type: 'first', grade: 5, status: 'failed' },
      { academicYear: '2026–2027', type: 'carry-over', examDate: null, grade: null, status: 'upcoming' }
    ] }]
  }, { kind: 'academic-overview', sourceLabel: 'Academic overview' })

  assert.equal(set.changes.some((change) => change.kind === 'attempt-conflict'), false)
  const carryOver = set.changes.find((change) => change.kind === 'exam-date')
  assert.equal(carryOver.payload.attempt.type, 'carry-over')
  assert.equal(carryOver.payload.attempt.status, 'upcoming')
})

test('an older transcript code with the same course name stays a historical course', () => {
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [{ id: 'current', code: 'NEW200', name: 'Systems', attempts: [] }] })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [{ code: 'OLD100', name: 'Systems', attempts: [{ academicYear: '2022-2023', type: 'first', grade: 7, status: 'passed' }] }]
  }, { kind: 'transcript', sourceLabel: 'Old transcript' })

  assert.equal(set.changes.some((change) => change.kind === 'course-conflict'), false)
  const historical = set.changes.find((change) => change.kind === 'history')
  assert.equal(historical.payload.course.code, 'OLD100')
  assert.equal(historical.payload.course.programmeRequirement, 'historical')
  assert.equal(historical.selectedByDefault, true)
  assert.equal(historical.requiresDecision, false)
  assert.deepEqual(set.reconciliation.unselected, [])
  assert.deepEqual(set.reconciliation.historical.map((item) => item.code), ['OLD100'])
})

test('an academic overview enriches a dated transcript sitting instead of duplicating it', () => {
  const initial = normalizeAcademicWorkspace({ profile: { programme: 'BSc Computer Science' }, courses: [], events: [] })
  const transcript = buildChangeSet(initial, {
    profile: { programme: 'Bachelor of Science in Computer Science' },
    courses: [{ code: '', name: 'Operating Systems', ects: 4, yearLevel: 'Year 2', period: 'Period 4', programmeRequirement: 'historical', attempts: [{ academicYear: '2025–2026', type: 'first', examDate: '2026-03-18', grade: 4, status: 'failed', courseName: 'Operating Systems', ects: 4, yearLevel: 'Year 2', period: 'Period 4', curriculumVersion: '2025–2026' }] }]
  }, { kind: 'transcript', sourceLabel: 'Transcript' })
  assert.equal(transcript.changes.some((change) => change.requiresDecision), false)
  const withTranscript = applyChanges(initial, transcript.changes).workspace

  const overview = buildChangeSet(withTranscript, {
    profile: { programme: 'Bachelor of Science Computer Science' },
    courses: [{ code: 'BCS2140', name: 'Operating Systems', ects: 4, yearLevel: 'Year 3', period: 'Period 1', attempts: [
      { academicYear: '2025–2026', type: 'first', examDate: null, grade: 4, status: 'failed', courseCode: 'BCS2140', courseName: 'Operating Systems', ects: 4, yearLevel: 'Year 2', period: 'Period 4', curriculumVersion: '2025–2026' },
      { academicYear: '2026–2027', type: 'carry-over', examDate: null, grade: null, status: 'upcoming', courseCode: 'BCS2140', courseName: 'Operating Systems', ects: 4, yearLevel: 'Year 3', period: 'Period 1', curriculumVersion: '2026–2027' }
    ] }]
  }, { kind: 'academic-overview', sourceLabel: 'Academic Work' })

  assert.equal(overview.changes.some((change) => change.requiresDecision), false)
  assert.equal(overview.changes.some((change) => change.kind === 'result'), false)
  const applied = applyChanges(withTranscript, overview.changes).workspace
  const course = applied.courses[0]
  assert.equal(course.code, 'BCS2140')
  assert.equal(course.programmeRequirement, null)
  assert.equal(course.period, 'Period 1')
  assert.equal(course.attempts.length, 2)
  assert.equal(course.attempts[0].examDate, '2026-03-18')
  assert.equal(course.attempts[0].period, 'Period 4')
  assert.equal(course.attempts[1].period, 'Period 1')
})

test('historical placement never conflicts with a rearranged current curriculum', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'it-management', code: 'BCS2510', name: 'IT Management & Privacy', ects: 4, yearLevel: 'Year 3', period: 'Period 2', attempts: [{ id: 'passed', academicYear: '2024–2025', type: 'first', examDate: '2025-06-16', grade: 9, status: 'passed' }] }]
  })
  const set = buildChangeSet(workspace, {
    profile: {},
    courses: [{ code: 'BCS2510', name: 'IT Management & Privacy', ects: 4, yearLevel: 'Year 2', period: 'Period 5', programmeRequirement: 'historical', attempts: [{ academicYear: '2024–2025', type: 'first', examDate: null, grade: 9, status: 'passed', courseCode: 'BCS2510', courseName: 'IT Management & Privacy', ects: 4, yearLevel: 'Year 2', period: 'Period 5', curriculumVersion: '2024–2025' }] }]
  }, { kind: 'academic-overview', sourceLabel: 'Academic Work' })

  assert.equal(set.changes.some((change) => change.kind === 'course-conflict' || change.kind === 'attempt-conflict'), false)
  const applied = applyChanges(workspace, set.changes).workspace.courses[0]
  assert.equal(applied.yearLevel, 'Year 3')
  assert.equal(applied.period, 'Period 2')
  assert.equal(applied.attempts[0].yearLevel, 'Year 2')
  assert.equal(applied.attempts[0].period, 'Period 5')
})

test('an uploaded academic calendar keeps structured period context out of personal events', () => {
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [], events: [] })
  const set = buildChangeSet(workspace, {
    profile: {}, courses: [],
    events: [{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', type: 'other', kind: 'period', period: 1, semester: null, resit: false, cohorts: [], academicYear: '2026-2027', notes: '' }]
  }, { kind: 'academic-calendar', sourceLabel: 'Faculty calendar' })
  const event = set.changes.find((change) => change.kind === 'event')
  const applied = applyChanges(workspace, [event]).workspace

  assert.equal(applied.events.length, 0)
  assert.equal(applied.planning.academicPeriods.length, 1)
  assert.deepEqual({ kind: applied.planning.academicPeriods[0].kind, period: applied.planning.academicPeriods[0].period, academicYear: applied.planning.academicPeriods[0].academicYear }, { kind: 'period', period: 1, academicYear: '2026-2027' })
})

test('timed ICS events are converted out of UTC into the calendar’s own timezone', () => {
  // The shape Maastricht's timetable actually publishes: UTC instants with the
  // zone declared once at the top. 06:30Z is an 08:30 lecture in Maastricht.
  const feed = [
    'BEGIN:VCALENDAR',
    'X-WR-TIMEZONE:Europe/Brussels',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Brussels',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:summer',
    'SUMMARY:BCS2120/2026-100/Lecture Tue/01 - Introduction to Artificial Intelligence',
    'DTSTART:20260901T063000Z',
    'DTEND:20260901T083000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:winter',
    'SUMMARY:Winter lecture',
    'DTSTART:20261201T083000Z',
    'DTEND:20261201T103000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:late',
    'SUMMARY:Late evening seminar',
    'DTSTART:20260901T230000Z',
    'DTEND:20260901T233000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:allday',
    'SUMMARY:Holiday',
    'DTSTART;VALUE=DATE:20261225',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:floating',
    'SUMMARY:Already local',
    'DTSTART;TZID=Europe/Brussels:20260901T093000',
    'DTEND;TZID=Europe/Brussels:20260901T113000',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')

  const events = parseIcs(feed)
  const byId = new Map(events.map((event) => [event.id.replace('ics-', ''), event]))

  assert.match(byId.get('summer').notes, /^08:30–10:30/, 'CEST is UTC+2')
  assert.match(byId.get('winter').notes, /^09:30–11:30/, 'CET is UTC+1, so the same offset must not be assumed year-round')
  // 23:00Z on 1 September is 01:00 on 2 September in Maastricht: the date moves.
  assert.equal(byId.get('late').date, '2026-09-02')
  assert.match(byId.get('late').notes, /^01:00/)
  // A date-only value has no instant to convert.
  assert.equal(byId.get('allday').date, '2026-12-25')
  assert.equal(byId.get('allday').notes, '')
  // A value already expressed in a named zone is wall-clock and stays put.
  assert.match(byId.get('floating').notes, /^09:30–11:30/)
})

test('an ICS feed with no declared timezone is read literally rather than guessed at', () => {
  const feed = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Seminar\r\nDTSTART:20260901T063000Z\r\nEND:VEVENT\r\nEND:VCALENDAR'
  assert.match(parseIcs(feed)[0].notes, /^06:30/)
})
