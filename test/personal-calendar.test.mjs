import test from 'node:test'
import assert from 'node:assert/strict'
import { createPersonalCalendarEvent, normalizePersonalCalendarEvent, removePersonalCalendarEvent, savePersonalCalendarEvent } from '../lib/personal-calendar.mjs'

test('personal calendar events retain time, course, and destination calendar', () => {
  const event = createPersonalCalendarEvent({ title: 'Review probability', start: '2026-09-04T12:00:00Z', end: '2026-09-04T13:00:00Z', courseId: 'stats', courseCode: 'bcs1520', courseName: 'Statistics', calendarId: 'wicker', type: 'study' }, '2026-09-01T10:00:00Z')
  assert.match(event.id, /^personal-/)
  assert.equal(event.start, '2026-09-04T12:00:00.000Z')
  assert.equal(event.courseCode, 'BCS1520')
  assert.equal(event.calendarId, 'wicker')
})

test('invalid personal events are refused instead of becoming plausible all-day entries', () => {
  assert.equal(normalizePersonalCalendarEvent({ title: 'No date', start: '' }), null)
  assert.throws(() => createPersonalCalendarEvent({ title: '', start: '2026-09-04', allDay: true }), /title and a valid start date/)
})

test('personal events can be edited and removed without replacing their identity', () => {
  const initial = createPersonalCalendarEvent({ title: 'Draft', start: '2026-09-04', allDay: true }, '2026-09-01T10:00:00Z')
  const saved = savePersonalCalendarEvent([initial], { id: initial.id, title: 'Final' }, '2026-09-02T10:00:00Z')
  assert.equal(saved[0].id, initial.id)
  assert.equal(saved[0].title, 'Final')
  assert.equal(saved[0].createdAt, initial.createdAt)
  assert.equal(saved[0].updatedAt, '2026-09-02T10:00:00.000Z')
  assert.deepEqual(removePersonalCalendarEvent(saved, initial.id), [])
})
