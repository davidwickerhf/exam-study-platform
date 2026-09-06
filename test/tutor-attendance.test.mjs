import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceSessionFinished, tutorAttendanceReports, stageTutorAttendance, applyTutorAttendance } from '../lib/tutor-attendance.mjs'
import { parseTutorResponse } from '../lib/tutor-response.mjs'

const now = new Date('2026-09-06T10:00:00Z')
const event = (id, overrides = {}) => ({ id, category: 'timetable', attendanceEligible: true, courseCode: 'BCS2140', activity: 'Lab', title: 'OS Lab', start: '2026-09-02T09:00:00', end: '2026-09-02T11:00:00', attendanceStatus: 'unknown', attendanceRule: 'Lab attendance is required; up to 1 missed session allowed.', attendancePolicy: { allowedMisses: 1, minimumAttendancePercent: null, source: 'Verified course rule' }, ...overrides })
const workspace = () => ({ id: 'programme-a', planning: { attendanceRecords: [] } })

test('attendance widgets keep unknowns separate and do not combine lab/lecture thresholds', () => {
  const reports = tutorAttendanceReports([event('a', { attendanceStatus: 'attended' }), event('b', { attendanceStatus: 'missed' }), event('c'), event('d', { attendanceStatus: 'excused' }), event('lecture', { activity: 'Lecture', attendanceRule: null, attendancePolicy: null })], { from: '2026-08-01', to: '2026-09-06', now })
  assert.equal(reports.length, 2)
  assert.deepEqual([reports[0].attended, reports[0].missed, reports[0].unmarked, reports[0].excused], [1, 1, 1, 1])
  assert.equal(reports[0].rate, 50)
  assert.equal(reports[1].rate, null)
  assert.equal(reports[1].allowedMisses, null)
  assert.match(reports[1].requirement, /No confirmed/)
  const other = tutorAttendanceReports([event('x', { courseCode: 'BCS3210' })], { from: '2026-08-01', to: '2026-09-06', now })
  assert.notEqual(reports[0].id, other[0].id)
})

test('session completion uses university time for floating timetable dates and excludes future sessions', () => {
  assert.equal(attendanceSessionFinished(event('a', { end: '2026-09-06T11:30:00' }), now), true)
  assert.equal(attendanceSessionFinished(event('a', { end: '2026-09-06T12:30:00' }), now), false)
  assert.equal(attendanceSessionFinished(event('a', { end: '2026-09-06T10:30:00Z' }), now), false)
})

test('staging attendance does not write; approval updates only selected sessions with reported provenance', () => {
  const original = workspace()
  const staged = stageTutorAttendance({ workspace: original, events: [event('a'), event('b')] }, { eventIds: ['a'], status: 'attended' }, now)
  assert.equal(original.planning.attendanceRecords.length, 0)
  assert.match(staged.detail, /unknown → attended/)
  const updated = applyTutorAttendance(original, staged.payload, now)
  assert.equal(updated.planning.attendanceRecords.length, 1)
  assert.equal(updated.planning.attendanceRecords[0].eventId, 'a')
  assert.match(updated.planning.attendanceRecords[0].note, /Self-reported via Tutor/)
  assert.equal(original.planning.attendanceRecords.length, 0)
  assert.throws(() => applyTutorAttendance(updated, staged.payload, now), /Attendance changed/)
  assert.throws(() => applyTutorAttendance({ ...original, id: 'different-programme' }, staged.payload, now), /programme changed/)
  const clear = stageTutorAttendance({ workspace: updated, events: [event('a')] }, { eventIds: ['a'], status: 'unknown' }, now)
  assert.equal(applyTutorAttendance(updated, clear.payload, now).planning.attendanceRecords.length, 0)
})

test('Tutor cannot grant excuses, fabricate sessions, mark future attendance or mutate non-teaching events', () => {
  for (const [events, args] of [
    [[event('a')], { eventIds: ['a'], status: 'excused' }],
    [[event('a')], { eventIds: ['invented'], status: 'missed' }],
    [[event('a', { end: '2026-09-09T12:00:00' })], { eventIds: ['a'], status: 'attended' }],
    [[event('a', { category: 'exam' })], { eventIds: ['a'], status: 'attended' }]
  ]) assert.throws(() => stageTutorAttendance({ workspace: workspace(), events }, args, now))
})

test('attendance response resolves tool report IDs, ignoring model-authored counts and invented reports', () => {
  const reports = tutorAttendanceReports([event('a')], { from: '2026-08-01', to: '2026-09-06', now })
  const output = { summary: 'One lab is unmarked.', priorities: [], courses: [], drafts: [], detail: '', attendance: [reports[0].id, 'invented', { attended: 100 }] }
  const parsed = parseTutorResponse(JSON.stringify(output), [], reports)
  assert.equal(parsed.presentation.attendance.length, 1)
  assert.equal(parsed.presentation.attendance[0].unmarked, 1)
  assert.equal(parsed.presentation.attendance[0].attended, 0)
  assert.match(parsed.content, /1 unmarked/)
})
