import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAcademicDocumentKind, fallbackAcademicIntake, mergeAcademicIntakeDrafts, normalizeAcademicIntakeDraft } from '../lib/academic-intake.mjs'

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

test('transcript intake groups a course but preserves every distinct sitting and curriculum warning', () => {
  const draft = normalizeAcademicIntakeDraft({
    profile: { academicYear: '2025–2026' },
    courses: [
      { code: 'BCS1520', name: 'Statistics', ects: 5, yearLevel: 'Year 1', attempts: [{ academicYear: '2024–2025', type: 'first', grade: 4.5, status: 'failed' }] },
      { code: 'BCS1520', name: 'Statistics and Data', ects: 6, yearLevel: 'Year 2', attempts: [{ academicYear: '2025–2026', type: 'resit', grade: 6.8, status: 'passed' }] }
    ]
  }, [], { kind: 'transcript' })

  assert.equal(draft.courses.length, 1)
  assert.equal(draft.courses[0].programmeRequirement, 'historical')
  assert.deepEqual(draft.courses[0].attempts.map((attempt) => [attempt.academicYear, attempt.type, attempt.grade, attempt.status]), [
    ['2024–2025', 'first', 4.5, 'failed'],
    ['2025–2026', 'resit', 6.8, 'passed']
  ])
  assert.ok(draft.warnings.some((warning) => /different course titles/.test(warning)))
  assert.ok(draft.warnings.some((warning) => /different credit values/.test(warning)))
})

test('Maastricht academic overview separates current enrolment from historical attempts', () => {
  const draft = fallbackAcademicIntake(`
Maastricht University
Academic overview
Bachelor of Science in Computer Science
Current courses
Course code Description Result Credits
2026-2027-500- Algorithmic Design - 0,0/4,0
BCS1540
Failed courses
2025-2026-500- Algorithmic Design NG 0,0/4,0
BCS1540
2024-2025-500- Algorithmic Design 2,0 0,0/4,0
BCS1540
Completed courses
2025-2026-500- Statistics 7,0 4,0/4,0
BCS1520
  `, [], { kind: 'auto' })

  assert.equal(detectAcademicDocumentKind('Academic overview\nCurrent courses\nFailed courses\nCompleted courses'), 'academic-overview')
  assert.equal(draft.profile.university, 'Maastricht University')
  assert.equal(draft.profile.programme, 'Bachelor of Science in Computer Science')
  const algorithmic = draft.courses.find((course) => course.code === 'BCS1540')
  assert.equal(algorithmic.programmeRequirement, null)
  assert.equal(algorithmic.period, 'Period 5')
  assert.deepEqual(algorithmic.attempts.map((attempt) => [attempt.academicYear, attempt.type, attempt.grade, attempt.status]), [
    ['2024–2025', 'first', 2, 'failed'],
    ['2025–2026', 'carry-over', null, 'failed'],
    ['2026–2027', 'carry-over', null, 'upcoming']
  ])
  assert.equal(draft.courses.find((course) => course.code === 'BCS1520').programmeRequirement, 'historical')
})

test('official transcript rows cross-reference overview codes without duplicating the same sitting', () => {
  const draft = fallbackAcademicIntake(`
Transcript / Resultatenoverzicht
Bachelor of Science in Computer Science
BSc CS year 1 core courses
Statistics 3,0 05.06.2024 4,00 0,00 1
Statistics NG 23.05.2025 4,00 0,00 1
Statistics 7,0 18.06.2026 4,00 4,00 1
END OF TRANSCRIPT
Academic overview
Completed courses
2025-2026-500- Statistics 7,0 4,0/4,0
BCS1520
  `, [], { kind: 'auto' })

  const statistics = draft.courses.find((course) => course.code === 'BCS1520')
  assert.equal(statistics.programmeRequirement, 'historical')
  assert.deepEqual(statistics.attempts.map((attempt) => [attempt.examDate, attempt.academicYear, attempt.grade, attempt.status]), [
    ['2024-06-05', '2023–2024', 3, 'failed'],
    ['2025-05-23', '2024–2025', null, 'failed'],
    ['2026-06-18', '2025–2026', 7, 'passed']
  ])
})

test('a title-only old transcript does not borrow a code from the current catalogue', () => {
  const draft = fallbackAcademicIntake(`
Transcript / Resultatenoverzicht
BSc CS year 1 core courses
Statistics 7,0 18.06.2026 4,00 4,00 1
END OF TRANSCRIPT
  `, [{ id: 'current-stats', code: 'BCS1520', name: 'Statistics' }], { kind: 'transcript' })

  assert.equal(draft.courses[0].code, '')
  assert.equal(draft.courses[0].programmeRequirement, 'historical')
})

test('a title-only transcript connects through one stable code across official curriculum editions', () => {
  const text = `Transcript / Resultatenoverzicht
BSc CS year 2 core courses
Operating Systems 7,0 18.06.2025 4,00 4,00 1
END OF TRANSCRIPT`
  const identityCourses = [
    { id: 'old-os', code: 'BCS2140', name: 'Operating Systems', yearLevel: 'Year 2', period: 'Period 4' },
    { id: 'new-os', code: 'BCS2140', name: 'Operating Systems', yearLevel: 'Year 3', period: 'Period 1' }
  ]
  const draft = fallbackAcademicIntake(text, [], { kind: 'transcript', identityCourses })

  assert.equal(draft.courses[0].code, 'BCS2140')
  assert.equal(draft.courses[0].attempts[0].courseCode, 'BCS2140')
  assert.match(draft.warnings.join(' '), /stable codes/i)
})

test('a title-only transcript uses the selected curriculum code when an official course was recoded', () => {
  const text = `Transcript / Resultatenoverzicht
BSc CS year 2 core courses
Operating Systems 7,0 18.06.2025 4,00 4,00 1
END OF TRANSCRIPT`
  const identityCourses = [
    { id: 'old-os', code: 'BCS3420', name: 'Operating Systems', curriculumVersion: '2025-2026', selectedCurriculum: false },
    { id: 'new-os', code: 'BCS2140', name: 'Operating Systems', curriculumVersion: '2026-2027', selectedCurriculum: true }
  ]
  const draft = fallbackAcademicIntake(text, [], { kind: 'transcript', identityCourses })

  assert.equal(draft.courses[0].code, 'BCS2140')
  assert.equal(draft.courses[0].attempts[0].courseCode, 'BCS2140')
})

test('deterministic transcript rows supplement an incomplete AI extraction', () => {
  const merged = mergeAcademicIntakeDrafts({
    profile: {},
    courses: [{ code: 'BCS1110', name: 'Introduction to Computer Science', ects: 4, attempts: [{ academicYear: '2024-2025', status: 'passed', grade: 7 }] }],
    events: [],
    warnings: []
  }, {
    profile: {},
    courses: [
      { code: 'BCS1110', name: 'Introduction to Computer Science', ects: 4, attempts: [{ academicYear: '2024-2025', status: 'passed', grade: 7 }] },
      { code: 'BCS1120', name: 'Procedural Programming', ects: 4, attempts: [{ academicYear: '2024-2025', status: 'passed', grade: 8 }] }
    ],
    events: [],
    warnings: []
  })

  assert.deepEqual(merged.courses.map((course) => course.code), ['BCS1110', 'BCS1120'])
  assert.equal(merged.courses[0].attempts.length, 2)
})
