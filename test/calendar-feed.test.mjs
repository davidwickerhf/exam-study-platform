import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCalendar, calendarPeriodCourseEvidence, isTeachingAppointment, resolveAcademicTimeContext, resolveCurrentCourses, resolveExamWindow } from '../lib/calendar-feed.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

test('calendar aggregates attempts, events, institution dates, and feeds without duplicates', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'c1', code: 'BCS1520', name: 'Statistics', attempts: [{ id: 'a1', type: 'first', examDate: '2026-10-14', grade: null, status: 'upcoming' }] }],
    events: [{ id: 'e1', title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' }]
  })
  const result = aggregateCalendar({
    workspace,
    editorialCourses: [{ id: 'stats', code: 'BCS1520', accent: '#123456' }],
    institutionCalendar: [
      { id: 'i1', title: 'Resit registration window', date: '2026-10-01', endDate: '2026-10-07', type: 'registration', notes: '' },
      { id: 'i2', title: 'Christmas break', date: '2026-12-21', endDate: '2027-01-03', type: 'other', notes: '' }
    ],
    feeds: [{ link: { id: 'f1', label: 'Timetable' }, events: [
      { id: 'x', title: 'BCS1520 Lecture', date: '2026-09-02', endDate: null, type: 'other', notes: '09:00–11:00 · Room 1' },
      { id: 'y', title: 'BCS2999 Elective', date: '2026-09-03', endDate: null, type: 'other', notes: '13:00–15:00 · Room 2' }
    ] }]
  })
  const categories = result.events.map((event) => event.category)
  assert.deepEqual(categories, ['timetable', 'timetable', 'registration', 'exam', 'institution'])
  const exam = result.events.find((event) => event.category === 'exam')
  assert.equal(exam.colour, '#123456')
  assert.equal(exam.editorialCourseId, 'stats')
  const lecture = result.events.find((event) => event.category === 'timetable')
  assert.equal(lecture.start, '2026-09-02T09:00:00')
  assert.equal(lecture.end, '2026-09-02T11:00:00')
  assert.equal(lecture.allDay, false)
  assert.equal(lecture.courseCode, 'BCS1520')
  assert.equal(lecture.courseId, 'c1')
  const registration = result.events.find((event) => event.category === 'registration')
  assert.equal(registration.end, '2026-10-08')
  assert.deepEqual(result.courses.map((course) => course.code), ['BCS1520', 'BCS2999'])
  assert.equal(result.reconciliation.status, 'attention')
  assert.deepEqual(result.reconciliation.unselected.map((course) => course.code), ['BCS2999'])
  assert.deepEqual(result.reconciliation.missing, [])
})

test('academic time context scopes timetable evidence to the active period', () => {
  const calendar = [
    { title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' },
    { title: 'Exam week · Period 1', date: '2026-10-12', endDate: '2026-10-16', kind: 'exam-week', period: 1, academicYear: '2026-2027' },
    { title: 'Study week · Period 1', date: '2026-10-19', endDate: '2026-10-23', kind: 'study-week', period: 1, academicYear: '2026-2027' },
    { title: 'Period 2', date: '2026-10-26', endDate: '2026-12-04', kind: 'period', period: 2, academicYear: '2026-2027' }
  ]
  const context = resolveAcademicTimeContext(calendar, { date: '2026-09-30' })
  assert.deepEqual({ period: context.period, phase: context.phase, start: context.start, end: context.end }, { period: 'Period 1', phase: 'teaching', start: '2026-08-31', end: '2026-10-23' })
  assert.deepEqual(resolveExamWindow(calendar, context, { date: '2026-09-30' }), { title: 'Exam week · Period 1', start: '2026-10-12', end: '2026-10-16', period: 'Period 1', academicYear: '2026-2027' })

  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [{ id: 'stats', code: 'BCS1520', name: 'Statistics', period: 'Period 1', attempts: [{ status: 'upcoming' }] }] })
  const evidence = calendarPeriodCourseEvidence(workspace, [{ link: { label: 'Timetable' }, events: [
    { title: 'BCS1520 Lecture', date: '2026-09-02', notes: '' },
    { title: 'BCS3130 Game Theory', date: '2026-09-03', notes: '' },
    { title: 'BCS9999 Period 2 course', date: '2026-11-03', notes: '' }
  ] }], context)
  assert.deepEqual(evidence.map((item) => [item.code, item.selected, item.active, item.eventCount]), [['BCS1520', true, true, 1], ['BCS3130', false, false, 1]])
})

test('the active-period answer is the intersection of current attempts and timetable evidence', () => {
  const calendar = [
    { title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' },
    { title: 'Exam week · Period 1', date: '2026-10-12', endDate: '2026-10-16', kind: 'exam-week', period: 1, academicYear: '2026-2027' }
  ]
  const codes = ['BCS2120', 'BCS2130', 'BCS2140', 'BCS3120', 'BCS3130', 'BCS3210']
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [
    ...codes.map((code) => ({ code, name: code, period: 'Period 1', attempts: [{ status: 'upcoming', academicYear: '2026-2027' }] })),
    { code: 'BCS3300', name: 'Project 3-1', period: 'Period 1', attempts: [{ status: 'upcoming', academicYear: '2026-2027' }] },
    { code: 'BCS2510', name: 'Historical course', period: 'Period 5', programmeRequirement: 'historical', attempts: [{ status: 'passed', academicYear: '2024-2025' }] }
  ] })
  const feeds = [{ link: { id: 'feed', label: 'Timetable' }, events: codes.map((code, index) => ({ id: String(index), title: `${code} Lecture`, date: `2026-09-0${index + 1}`, notes: '' })) }]
  const result = aggregateCalendar({ workspace, institutionCalendar: calendar, feeds, date: '2026-09-01' })

  assert.deepEqual(result.periodCourses.filter((item) => item.active).map((item) => item.code), codes)
  assert.equal(result.periodCourses.filter((item) => item.active).length, 6)
  assert.deepEqual(result.examWindow, { title: 'Exam week · Period 1', start: '2026-10-12', end: '2026-10-16', period: 'Period 1', academicYear: '2026-2027' })
})

test('current courses combine the active study year, unresolved retakes, and timetable evidence', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { currentYearKey: 'Year 3' },
    programmeTemplate: { programmeId: 'cs', versionId: '2026', currentStudyYear: 'Year 3', selectedChoices: {} },
    courses: [
      { id: 'old-pass', code: 'BCS1110', name: 'Passed in year one', yearLevel: 'Year 1', period: 'Period 1', attempts: [{ status: 'passed', academicYear: '2024-2025' }] },
      { id: 'current', code: 'BCS3110', name: 'Current year course', yearLevel: 'Year 3', period: 'Period 1', attempts: [] },
      { id: 'retake', code: 'BCS2130', name: 'Retake', yearLevel: 'Year 2', period: 'Period 1', attempts: [{ status: 'failed', academicYear: '2025-2026' }] },
      { id: 'later', code: 'BCS3140', name: 'Later this year', yearLevel: 'Year 3', period: 'Period 2', attempts: [] }
    ]
  })
  const context = { period: 'Period 1', academicYear: '2026-2027' }
  const result = resolveCurrentCourses(workspace, context, [{ code: 'BCS3210', name: 'Block Chains', teaching: true }])
  assert.deepEqual(result.map((course) => course.code), ['BCS2130', 'BCS3110', 'BCS3210'])
  assert.deepEqual(result.find((course) => course.code === 'BCS2130').reasons, ['unresolved-attempt'])
  assert.equal(result.find((course) => course.code === 'BCS3210').outsidePlan, true)
})

test('teaching appointments remain current-course evidence before they are copied into the academic record', () => {
  const calendar = [{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' }]
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [
    { code: 'BCS2120', name: 'Introduction to Artificial Intelligence', period: 'Period 1', attempts: [{ status: 'upcoming' }] },
    { code: 'BCS2130', name: 'Intelligent User Interfaces', period: 'Period 1', attempts: [{ status: 'upcoming' }] },
    { code: 'BCS2140', name: 'Operating Systems', period: 'Period 1', attempts: [{ status: 'upcoming' }] }
  ] })
  const feed = { link: { id: 'feed', label: 'Timetable' }, events: [
    { title: 'BCS2120/2026-100/Lecture Tue/01 - Introduction to Artificial Intelligence', date: '2026-09-01', notes: '09:00–11:00 · PHS1' },
    { title: 'BCS2130/2026-100/Lecture Thu/01 - Intelligent User Interfaces', date: '2026-09-03', notes: '09:00–11:00 · PHS1' },
    { title: 'BCS2140/2026-100/Lecture Mon/01 - Operating Systems', date: '2026-09-07', notes: '09:00–11:00 · PHS1' },
    { title: 'BCS3120/2026-100/Lecture Tue/01 - Ubiquitous Computing & Internet of Things', date: '2026-09-01', notes: '11:30–13:30 · PHS1' },
    { title: 'BCS3130/2026-100/Lecture Mon/01 - Game Theory', date: '2026-09-07', notes: '11:30–13:30 · PHS1' },
    { title: 'BCS3210/2026-100/Lecture Wed/01 - Block Chains', date: '2026-09-02', notes: '11:30–13:30 · PHS1' },
    { title: 'BCS3300/2026-002/Project Opening (P1)/01 - Project 3-1', date: '2026-08-31', notes: '07:00–08:30 · DACS Online · Type: Project' }
  ] }
  const result = aggregateCalendar({ workspace, institutionCalendar: calendar, feeds: [feed], date: '2026-09-01' })
  assert.deepEqual(result.periodCourses.map((item) => item.code), ['BCS2120', 'BCS2130', 'BCS2140', 'BCS3120', 'BCS3130', 'BCS3210'])
  assert.equal(result.periodCourses.filter((item) => item.selected).length, 3)
  assert.equal(result.periodCourses.filter((item) => item.teaching).length, 6)
})

test('a coded project-opening notice stays in Calendar but is not enrolment evidence', () => {
  const projectOpening = { title: 'BCS3300/2026-002/Project Opening (P1)/01 - Project 3-1', date: '2026-08-31', notes: '07:00–08:30 · DACS Online · Type: Project' }
  assert.equal(isTeachingAppointment(projectOpening), false)

  const calendar = [{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' }]
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [
    { id: 'project', code: 'BCS3300', name: 'Project 3-1', period: 'Period 1', attempts: [{ status: 'upcoming' }] },
    { id: 'iui', code: 'BCS2130', name: 'Intelligent User Interfaces', period: 'Period 1', attempts: [{ status: 'upcoming' }] }
  ] })
  const result = aggregateCalendar({ workspace, institutionCalendar: calendar, feeds: [{ link: { id: 'feed', label: 'Timetable' }, events: [projectOpening, { title: 'BCS2130/2026-100/Lecture Thu/01 - Intelligent User Interfaces', date: '2026-09-03', notes: '09:00–11:00 · PHS1 C0.016' }] }], date: '2026-09-01' })
  assert.deepEqual(result.periodCourses.map((item) => item.code), ['BCS2130'])
  const project = result.events.find((event) => event.sourceTitle === projectOpening.title)
  assert.equal(project.title, 'BCS3300 · Project 3-1')
  assert.equal(project.activity, 'Project Opening')
})

test('academic context looks ahead before teaching starts', () => {
  const context = resolveAcademicTimeContext([{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' }], { date: '2026-08-30' })
  assert.equal(context.phase, 'upcoming')
  assert.equal(context.daysUntil, 1)
  assert.equal(context.period, 'Period 1')
})

test('Canvas deadlines and Canvas events join the calendar and keep a link out to Canvas', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'c1', code: 'BCS2130', name: 'Intelligent User Interfaces', attempts: [] }]
  })
  const result = aggregateCalendar({
    workspace,
    editorialCourses: [{ id: 'iui', code: 'BCS2130', accent: '#123456' }],
    canvas: {
      assignments: [
        { id: '1:71', courseCode: 'BCS2130', courseName: 'Intelligent User Interfaces', title: 'Prototype hand-in', dueAt: '2026-09-10T15:00:00.000Z', pointsPossible: 20, status: 'upcoming', url: 'https://canvas.example.edu/courses/1/assignments/71' },
        { id: '1:72', courseCode: 'BCS2130', courseName: 'Intelligent User Interfaces', title: 'Reading log', dueAt: null, status: 'graded', url: null }
      ],
      events: [
        { id: '1:88', courseCode: 'BCS2130', courseName: 'Intelligent User Interfaces', title: 'Guest lecture', startAt: '2026-09-04T13:00:00.000Z', endAt: '2026-09-04T15:00:00.000Z', allDay: false, location: 'C1.05', url: 'https://canvas.example.edu/calendar?event_id=88' }
      ]
    }
  })
  const deadline = result.events.find((event) => event.category === 'canvas-deadline')
  assert.equal(deadline.title, 'BCS2130 · Prototype hand-in')
  assert.equal(deadline.editorialCourseId, 'iui')
  assert.equal(deadline.colour, '#123456')
  assert.equal(deadline.courseId, 'c1')
  assert.equal(deadline.canvasDone, false)
  assert.equal(deadline.externalHref, 'https://canvas.example.edu/courses/1/assignments/71')
  assert.equal(deadline.href, null, 'a Canvas item is never presented as an internal plan record')
  // An assignment with no due date has no place on a calendar.
  assert.equal(result.events.filter((event) => event.category === 'canvas-deadline').length, 1)
  const event = result.events.find((item) => item.category === 'canvas-event')
  assert.equal(event.start, '2026-09-04T13:00:00.000Z')
  assert.equal(event.end, '2026-09-04T15:00:00.000Z')
  assert.equal(event.notes, 'C1.05')
  assert.equal(result.categories['canvas-deadline'], 'Canvas deadlines')
})
