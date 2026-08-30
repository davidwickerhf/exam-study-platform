import test from 'node:test'
import assert from 'node:assert/strict'
import { courseReferenceInText, reconcileAcademicSource } from '../lib/academic-reconciliation.mjs'
import { normalizeAcademicWorkspace } from '../lib/academics.mjs'

function workspace() {
  return normalizeAcademicWorkspace({
    profile: { currentYearKey: 'Year 1' },
    courses: [
      { id: 'c-stats', code: 'BCS1520', name: 'Statistics', yearLevel: 'Year 1', attempts: [{ id: 'a-stats', type: 'first', status: 'upcoming' }] },
      { id: 'c-alg', code: 'BCS1540', name: 'Algorithmic Design', yearLevel: 'Year 1', attempts: [{ id: 'a-alg', type: 'first', status: 'upcoming' }] }
    ]
  })
}

test('timetable reconciliation distinguishes selected, unselected, and missing courses', () => {
  const result = reconcileAcademicSource(workspace(), {
    courses: [],
    events: [
      { title: 'BCS1520 Statistics lecture', date: '2026-09-01', notes: 'Room 101' },
      { title: 'BCS2999 New elective', date: '2026-09-02', notes: 'Hall B' }
    ]
  }, { kind: 'timetable', sourceLabel: 'My timetable' })

  assert.equal(result.status, 'attention')
  assert.deepEqual(result.matched.map((item) => item.courseId), ['c-stats'])
  assert.deepEqual(result.unselected.map((item) => item.code), ['BCS2999'])
  assert.deepEqual(result.missing.map((item) => item.courseId), ['c-alg'])
  assert.deepEqual(result.coverage, { observed: 2, matched: 1, selectedInScope: 2, missing: 1 })
})

test('a transcript does not expect future selected courses to appear', () => {
  const plan = workspace()
  plan.courses[0].attempts[0] = { ...plan.courses[0].attempts[0], grade: 8, status: 'passed' }
  const result = reconcileAcademicSource(plan, {
    courses: [{ code: 'BCS1520', name: 'Statistics', attempts: [{ status: 'passed', grade: 8 }] }],
    events: []
  }, { kind: 'transcript', sourceLabel: 'Transcript' })

  assert.equal(result.status, 'aligned')
  assert.equal(result.missing.length, 0)
  assert.equal(result.coverage.selectedInScope, 1)
})

test('course matching accepts selected names and rejects room numbers', () => {
  const plan = workspace()
  assert.equal(courseReferenceInText('Algorithmic Design tutorial', plan.courses)?.course?.id, 'c-alg')
  assert.equal(courseReferenceInText('Room 101 · Group 12', plan.courses), null)
  assert.equal(courseReferenceInText('BCS-1520 lecture', plan.courses)?.course?.id, 'c-stats')
})
