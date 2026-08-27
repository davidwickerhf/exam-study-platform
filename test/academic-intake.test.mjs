import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackAcademicIntake, normalizeAcademicIntakeDraft } from '../lib/academic-intake.mjs'

test('academic intake normalizes, deduplicates, and connects courses by code', () => {
  const draft = normalizeAcademicIntakeDraft({
    profile: { university: 'Example University', programme: 'BSc Computing', academicYear: '2026–2027' },
    courses: [
      { code: 'bcs 1540', name: 'Algorithmic Design', ects: 5, attempts: [] },
      { code: 'BCS1540', name: 'Algorithmic Design', ects: 0, period: 'Semester 2', attempts: [{ status: 'passed', grade: 72 }] },
      { code: 'OTHER1', name: 'Planning only', ects: 10, attempts: [] }
    ],
    warnings: ['Check the grading scale.']
  }, [{ id: 'algorithmic-design', code: 'BCS1540', name: 'Algorithmic Design' }])

  assert.equal(draft.courses.length, 2)
  assert.equal(draft.courses[0].editorialCourseId, 'algorithmic-design')
  assert.equal(draft.courses[0].period, 'Semester 2')
  assert.equal(draft.courses[0].attempts[0].grade, 72)
  assert.deepEqual(draft.connections, {
    total: 2,
    matched: 1,
    unmatched: 1,
    matchedLabels: ['BCS1540'],
    unmatchedLabels: ['OTHER1']
  })
})

test('academic intake fallback extracts common curriculum text without inventing absent facts', () => {
  const draft = fallbackAcademicIntake(`
University: Example University
Programme: BSc Computing
Academic year: 2026-2027
BCS1540 Algorithmic Design 5 ECTS
BCS1520 Statistics 10 ECTS passed 74%
  `, [{ id: 'algorithmic-design', code: 'BCS1540' }])

  assert.equal(draft.profile.programme, 'BSc Computing')
  assert.equal(draft.profile.academicYear, '2026–2027')
  assert.equal(draft.courses.length, 2)
  assert.equal(draft.courses[1].attempts[0].status, 'passed')
  assert.equal(draft.courses[1].attempts[0].grade, 74)
  assert.equal(draft.connections.matched, 1)
})
