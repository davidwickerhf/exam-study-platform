import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceOverview, attendancePolicyForEvent, upsertAttendanceRecord } from '../lib/attendance.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

const courses = [{
  id: 'stats', code: 'BCS1520', name: 'Statistics',
  courseProfile: { assessment: { status: 'confirmed', attendanceEvidence: [{ text: 'Tutorial attendance is mandatory. Up to 2 absences are allowed.', activity: 'tutorial', allowedMisses: 2, evidence: [{ chunkId: 7 }] }] } }
}]

const event = (patch = {}) => ({ id: 'feed:main:t1', title: 'BCS1520 · Statistics', start: '2026-09-01T09:00:00Z', end: '2026-09-01T11:00:00Z', category: 'timetable', courseId: 'stats', courseCode: 'BCS1520', courseName: 'Statistics', activity: 'Tutorial', attendanceEligible: true, ...patch })

test('attendance policy binds only a verified rule for the same teaching kind', () => {
  assert.equal(attendancePolicyForEvent(event(), courses[0]).allowedMisses, 2)
  assert.equal(attendancePolicyForEvent(event({ activity: 'Lecture' }), courses[0]), null)
  assert.equal(attendancePolicyForEvent(event(), { ...courses[0], courseProfile: { assessment: { status: 'needs-review', attendanceRules: ['Tutorials are mandatory.'] } } }), null)
})

test('attendance records are replaced per occurrence and unknown clears the mark', () => {
  const missed = upsertAttendanceRecord([], event(), 'missed', 'Work shift', '2026-09-02T10:00:00Z')
  assert.equal(missed.length, 1)
  assert.equal(missed[0].status, 'missed')
  const attended = upsertAttendanceRecord(missed, event(), 'attended', '', '2026-09-02T11:00:00Z')
  assert.equal(attended.length, 1)
  assert.equal(attended[0].status, 'attended')
  assert.deepEqual(upsertAttendanceRecord(attended, event(), 'unknown'), [])
})

test('attendance overview keeps unknown neutral and reports the verified allowance', () => {
  const events = [event(), event({ id: 'feed:main:t2', start: '2026-09-03T09:00:00Z', end: '2026-09-03T11:00:00Z' }), event({ id: 'feed:main:l1', activity: 'Lecture', start: '2026-09-02T13:00:00Z', end: '2026-09-02T15:00:00Z' })]
  const records = upsertAttendanceRecord(upsertAttendanceRecord([], events[0], 'missed'), events[2], 'attended')
  const result = attendanceOverview(events, records, courses, { now: new Date('2026-09-04T00:00:00Z').getTime() })
  assert.equal(result.summary.rate, 50)
  assert.equal(result.summary.unmarked, 1)
  assert.equal(result.courses[0].requiredMissed, 1)
  assert.equal(result.courses[0].allowedMissesRemaining, 1)
  assert.equal(result.events[2].attendanceRequired, false)
})

test('academic workspace normalization persists only valid attendance records', () => {
  const record = upsertAttendanceRecord([], event(), 'attended')[0]
  const workspace = normalizeAcademicWorkspace({ profile: {}, planning: { attendanceRecords: [record, { status: 'missed' }] } })
  assert.equal(workspace.planning.attendanceRecords.length, 1)
  assert.equal(workspace.planning.attendanceRecords[0].eventId, event().id)
})
