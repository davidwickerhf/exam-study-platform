import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCalendar } from '../lib/calendar-feed.mjs'
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
    feeds: [{ link: { id: 'f1', label: 'Timetable' }, events: [{ id: 'x', title: 'BCS1520 Lecture', date: '2026-09-02', endDate: null, type: 'other', notes: '09:00–11:00 · Room 1' }] }]
  })
  const categories = result.events.map((event) => event.category)
  assert.deepEqual(categories, ['timetable', 'registration', 'exam', 'institution'])
  const exam = result.events.find((event) => event.category === 'exam')
  assert.equal(exam.colour, '#123456')
  assert.equal(exam.editorialCourseId, 'stats')
  const lecture = result.events.find((event) => event.category === 'timetable')
  assert.equal(lecture.start, '2026-09-02T09:00:00')
  assert.equal(lecture.end, '2026-09-02T11:00:00')
  assert.equal(lecture.allDay, false)
  assert.equal(lecture.courseCode, 'BCS1520')
  const registration = result.events.find((event) => event.category === 'registration')
  assert.equal(registration.end, '2026-10-08')
  assert.deepEqual(result.courses.map((course) => course.code), ['BCS1520'])
})
