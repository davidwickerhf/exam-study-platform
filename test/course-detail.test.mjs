import test from 'node:test'
import assert from 'node:assert/strict'
import { courseDetail, courseAttemptHistory, courseDetailTab } from '../lib/workspace/course-detail.mjs'

const academic = [{ id: 'record-ai', code: 'BCS2120', name: 'Introduction to AI', ects: 4, attempts: [
  { id: 'first', academicYear: '2024-2025', status: 'failed', type: 'first', grade: 4.5, ects: 4 },
  { id: 'second', academicYear: '2025-2026', status: 'failed', type: 'carry-over', grade: 5, ects: 4 },
  { id: 'third', academicYear: '2026-2027', status: 'upcoming', type: 'carry-over', grade: null, ects: 4 },
] }]

test('course details expose all repeated sittings without published chapters or rewriting history', () => {
  const before = structuredClone(academic)
  const byCode = courseDetail('BCS2120', { academic })
  const byId = courseDetail('record-ai', { academic })
  assert.deepEqual(byCode, byId)
  const history = courseAttemptHistory(byCode.academic)
  assert.deepEqual(history.map(a => a.id), ['third', 'second', 'first'])
  assert.deepEqual(history.map(a => a.grade), [null, 5, 4.5])
  assert.deepEqual(academic, before)
  assert.equal(courseDetail('missing', { academic }), null)
})

test('editorial course page joins recoded historical attempts through curriculum identity', () => {
  const catalogue = { programmes: [{ id: 'cs', versions: [
    { id: 'new', courses: [{ id: 'os-new', code: 'BCS2140', name: 'Operating Systems' }] },
    { id: 'old', courses: [{ id: 'os-old', code: 'BCS3420', name: 'Operating Systems' }] },
  ] }] }
  const sources = { catalogue, programmeTemplate: { programmeId: 'cs', versionId: 'new' }, editorial: [{ id: 'operating-systems', code: 'BCS2140', name: 'Operating Systems' }], academic: [{ id: 'old-record', code: 'BCS3420', name: 'Operating Systems', attempts: [{ academicYear: '2024-2025', courseCode: 'BCS3420', status: 'failed', grade: 4 }] }] }
  const detail = courseDetail('operating-systems', sources)
  assert.equal(detail.academic.attempts[0].courseCode, 'BCS3420')
  assert.equal(detail.academic.attempts[0].grade, 4)
  assert.equal(courseDetail('old-record', sources).key, detail.key)
})

test('missing grades and dates are not invented; separate sittings in the same year survive', () => {
  const history = courseAttemptHistory({ attempts: [{ id: 'a', academicYear: '2025-2026', type: 'first', examDate: '2026-01-10', status: 'failed', grade: 0 }, { id: 'b', academicYear: '2025-2026', type: 'resit', examDate: '2026-03-10', status: 'no-show' }] })
  assert.equal(history.length, 2)
  assert.equal(history[0].id, 'b')
  assert.equal(history[0].grade, undefined)
  assert.equal(history[1].grade, 0)
})

test('existing attendance and material deep links select the matching course tab', () => {
  assert.equal(courseDetailTab('', '#attendance'), 'attendance')
  assert.equal(courseDetailTab('', '#course-material'), 'materials')
  assert.equal(courseDetailTab('?tab=history'), 'history')
  assert.equal(courseDetailTab('?tab=unknown'), 'study')
})

test('courses known only through a timetable or Canvas still have a detail page', () => {
  const sources = { currentCourses: [{ code: 'EXTRA101', name: 'Timetabled seminar' }], corpus: [{ courseCode: 'ARCH101', courseName: 'Archived class' }] }
  assert.equal(courseDetail('EXTRA101', sources).name, 'Timetabled seminar')
  assert.equal(courseDetail('ARCH101', sources).corpus.courseCode, 'ARCH101')
  assert.deepEqual(courseAttemptHistory(courseDetail('EXTRA101', sources).academic), [])
})
