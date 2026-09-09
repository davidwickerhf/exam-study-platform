import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarToolResult } from '../mcp/calendar-result.mjs'

test('one-day lookup includes timed lectures and preserves source failures without whole-term payloads', () => {
  const lecture = { id: 'lecture', start: '2026-09-10T13:30:00', title: 'Lecture', category: 'lecture', notes: 'Room A', courseCode: 'BCS3120' }
  const data = { events: [{ start: '2026-09-09' }, lecture, { start: '2026-09-10' }, { start: '2026-09-11T00:00:00' }], reconciliation: { events: Array(1000).fill(lecture) }, attendance: { courses: Array(1000).fill(lecture) }, feeds: [{ id: 'feed', label: 'Timetable' }], problems: [{ label: 'Canvas', error: 'Unavailable' }], canvas: { connected: true } }
  const result = calendarToolResult(data, { from: '2026-09-10', to: '2026-09-10' })
  assert.deepEqual(result.events, [lecture, { start: '2026-09-10' }])
  assert.equal(result.eventCount, 2)
  assert.deepEqual(result.problems, data.problems)
  assert.deepEqual(result.feeds, data.feeds)
  assert.equal(result.canvas.connected, true)
  assert.ok(JSON.stringify(result).length < 1000)
})
test('unbounded lookup keeps all events; inverted range fails explicitly', () => {
  const data = { events: [{ start: '2026-09-10' }, { start: '2026-09-11' }] }
  assert.deepEqual(calendarToolResult(data).events, data.events)
  assert.equal(calendarToolResult(data, { from: '2026-09-11' }).eventCount, 1)
  assert.throws(() => calendarToolResult(data, { from: '2026-09-11', to: '2026-09-10' }), /on or before/)
})
