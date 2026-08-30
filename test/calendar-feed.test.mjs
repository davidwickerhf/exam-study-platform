import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCalendar, calendarPeriodCourseEvidence, resolveAcademicTimeContext } from '../lib/calendar-feed.mjs'
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

  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [{ id: 'stats', code: 'BCS1520', name: 'Statistics', attempts: [] }] })
  const evidence = calendarPeriodCourseEvidence(workspace, [{ link: { label: 'Timetable' }, events: [
    { title: 'BCS1520 Lecture', date: '2026-09-02', notes: '' },
    { title: 'BCS3130 Game Theory', date: '2026-09-03', notes: '' },
    { title: 'BCS9999 Period 2 course', date: '2026-11-03', notes: '' }
  ] }], context)
  assert.deepEqual(evidence.map((item) => [item.code, item.selected, item.eventCount]), [['BCS1520', true, 1], ['BCS3130', false, 1]])
})

test('academic context looks ahead before teaching starts', () => {
  const context = resolveAcademicTimeContext([{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' }], { date: '2026-08-30' })
  assert.equal(context.phase, 'upcoming')
  assert.equal(context.daysUntil, 1)
  assert.equal(context.period, 'Period 1')
})
