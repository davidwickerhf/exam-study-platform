import test from 'node:test'
import assert from 'node:assert/strict'
import { repairTranscriptDuplicates, courseEarnedCredits } from '../lib/academic-record-repair.mjs'
import { academicSummary, normalizeAcademicWorkspace } from '../lib/academics.mjs'
import { fallbackAcademicIntake } from '../lib/academic-intake.mjs'

const attempt = (ects, date = null) => ({ academicYear: '2024-2025', grade: 8, status: 'passed', ects, examDate: date })
test('old header-contaminated transcript duplicates reconnect to results: 106 becomes 92', () => {
  const workspace = normalizeAcademicWorkspace({ courses: [
    { id: 'other', name: 'Other earned credits', ects: 78, attempts: [attempt(78)] },
    { id: 'pp', code: 'BCS1120', name: 'Procedural Programming', ects: 4, attempts: [attempt(4)] },
    { id: 'ai', code: 'BCS2720', name: 'M2-1: Artificial Intelligence and Machine Learning', ects: 10, attempts: [attempt(10)] },
    { id: 'bad-pp', name: 'ECTS ECTS BSc CS year 1 core courses Procedural Programming', ects: 4, attempts: [attempt(4, '2024-10-26')] },
    { id: 'bad-ai', name: 'ECTS ECTS BSc CS year 2 Electives M2-1: AI and Machine Learning', ects: 10, attempts: [attempt(10, '2024-12-10')] },
    { id: 'hpc', name: 'High Performance Computing', ects: 10, attempts: [{ status: 'failed', grade: 4 }] }
  ] })
  const repaired = repairTranscriptDuplicates(workspace)
  assert.equal(academicSummary(workspace).earnedEcts, 92)
  assert.equal(academicSummary(workspace).passedCourses, 3)
  assert.equal(repaired.courses.find(c => c.id === 'ai').attempts[0].examDate, '2024-12-10')
  assert.equal(repaired.courses.find(c => c.id === 'hpc').attempts[0].status, 'failed')
  assert.equal(workspace.courses.length, 6)
  assert.deepEqual(repairTranscriptDuplicates(repaired), repaired)
})
test('repair refuses a matching title with a different result', () => {
  const courses = [
    { id: 'real', code: 'CS100', name: 'Programming', attempts: [attempt(4)] },
    { id: 'orphan', name: 'ECTS ECTS BSc CS year 1 core courses Programming', attempts: [{ ...attempt(4), grade: 9 }] }
  ]
  assert.equal(repairTranscriptDuplicates({ courses }).courses.length, 2)
})
test('passing sitting credit value is counted once even after catalogue credit changes', () => {
  assert.equal(courseEarnedCredits({ ects: 10, attempts: [attempt(4, '2024-01-01'), attempt(10, '2025-01-01')] }), 4)
})
test('transcript page headings cannot become course-name prefixes', () => {
  const draft = fallbackAcademicIntake('Transcript / Resultatenoverzicht\nECTS ECTS\nBSc CS year 1 core courses\nProcedural Programming 9 26.10.2023 4 4\nECTS ECTS\nBSc CS year 2 Electives\nM2-1: AI and Machine Learning 8 10.12.2024 10 10\nEND OF TRANSCRIPT', [], { kind: 'transcript' })
  assert.deepEqual(draft.courses.map(c => c.name), ['Procedural Programming', 'M2-1: AI and Machine Learning'])
})
