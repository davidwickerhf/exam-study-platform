import assert from 'node:assert/strict'
import test from 'node:test'
import {
  academicYearFromCanvasCourse,
  canonicalCanvasCourse,
  periodFromCanvasCourse,
  retrievalEditionOrder,
  selectCanvasCorpusCourses,
  supportedCanvasCourseCode
} from '../lib/course-corpus.mjs'

test('Canvas course shells become stable courses with explicit yearly editions', () => {
  const first = canonicalCanvasCourse({
    origin: 'https://canvas.example.edu',
    course: { id: '10', courseCode: 'BCS1540', name: 'Algorithms (2024-2025-100-BCS1540)', term: { name: '2024-2025 period 1' } }
  })
  const later = canonicalCanvasCourse({
    origin: 'https://canvas.example.edu',
    course: { id: '99', courseCode: 'BCS1540', name: 'Algorithms (2026-2027-100-BCS1540)', term: { name: '2026-2027 period 1' } }
  })
  assert.equal(first.canonicalCourseId, later.canonicalCourseId)
  assert.notEqual(first.editionId, later.editionId)
  assert.equal(first.academicYear, '2024-2025')
  assert.equal(later.period, '1')
})

test('academic year and period fall back to teaching dates and coded Maastricht periods', () => {
  assert.equal(academicYearFromCanvasCourse({ term: { startAt: '2026-09-01T00:00:00Z' } }), '2026-2027')
  assert.equal(periodFromCanvasCourse({ name: '2025-2026-400-BCS3000' }), '4')
})

test('sync includes active courses and historical shells of those same courses only', () => {
  const courses = [
    { id: 'new', courseCode: 'BCS1540', current: true },
    { id: 'old', courseCode: 'BCS1540', concluded: true },
    { id: 'unrelated', courseCode: 'BCS1000', concluded: true }
  ]
  assert.deepEqual(selectCanvasCorpusCourses(courses).map((course) => course.id), ['new', 'old'])
})

test('sync excludes active Canvas community and faculty shells', () => {
  const courses = [
    { id: 'course', courseCode: '2026-100-BCS2120', name: 'Introduction to Artificial Intelligence', current: true },
    { id: 'incognito', courseCode: 'MSV INCOGNITO', name: 'MSV Incognito', current: true },
    { id: 'communication', courseCode: '9503', name: 'Communication B Computer Science', current: true },
    { id: 'faculty', courseCode: 'FSE', name: 'Communication FSE (all students)', current: true },
    { id: 'department', courseCode: 'DACS', name: 'DACS', current: true }
  ]
  assert.equal(supportedCanvasCourseCode(courses[0]), 'BCS2120')
  assert.deepEqual(selectCanvasCorpusCourses(courses).map((course) => course.id), ['course'])
})

test('an explicit edition is ranked first while historical fallback stays labelled', () => {
  const editions = [{ academicYear: '2024-2025' }, { academicYear: '2026-2027' }, { academicYear: '2025-2026' }]
  assert.deepEqual(retrievalEditionOrder(editions, { academicYear: '2025-2026' }).map((edition) => edition.academicYear), ['2025-2026', '2026-2027', '2024-2025'])
  assert.deepEqual(retrievalEditionOrder(editions, { academicYear: '2025-2026', includeHistorical: false }).map((edition) => edition.academicYear), ['2025-2026'])
})
