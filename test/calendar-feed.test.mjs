import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCalendar, calendarPeriodCourseEvidence, isTeachingAppointment, resolveAcademicTimeContext, resolveExamWindow } from '../lib/calendar-feed.mjs'
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
