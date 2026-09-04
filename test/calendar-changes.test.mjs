import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarFeedChanges } from '../lib/calendar-changes.mjs'

const event = (updates = {}) => ({
  id: 'ics-class-1', title: 'BCS2130 · Tutorial', date: '2026-09-08', endDate: null,
  startTime: '08:30', endTime: '10:30', location: 'Room A', status: null, ...updates
})

test('calendar feed changes report cancellations, moves, and room changes', () => {
  const cancelled = calendarFeedChanges([event()], [event({ status: 'CANCELLED' })], { detectedAt: '2026-09-04T10:00:00.000Z' })
  assert.equal(cancelled[0].kind, 'cancelled')

  const moved = calendarFeedChanges([event()], [event({ startTime: '10:30', endTime: '12:30' })], { detectedAt: '2026-09-04T10:00:00.000Z' })
  assert.equal(moved[0].kind, 'rescheduled')
  assert.match(moved[0].detail, /08:30.*10:30/)

  const room = calendarFeedChanges([event()], [event({ location: 'Room B' })], { detectedAt: '2026-09-04T10:00:00.000Z' })
  assert.equal(room[0].kind, 'room-changed')
  assert.equal(room[0].detail, 'Room A → Room B')
})

test('calendar feed changes do not infer cancellation from a missing bounded-feed event', () => {
  assert.deepEqual(calendarFeedChanges([event()], [], { detectedAt: '2026-09-04T10:00:00.000Z' }), [])
})

