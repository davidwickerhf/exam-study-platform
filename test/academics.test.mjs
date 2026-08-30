import test from 'node:test'
import assert from 'node:assert/strict'
import { academicSummary, createAcademicProgramme, emptyAcademicWorkspace, importAcademicProgramme, normalizeAcademicWorkspace, readAcademicState, readAcademicWorkspace, saveAcademicWorkspace, saveActiveAcademicWorkspace, selectAcademicProgramme } from '../lib/academics.mjs'
import { deletePersonalData } from '../lib/account-data.mjs'
import { withRequestContext } from '../lib/request-context.mjs'

test('academic records preserve user-owned dates and generalized curriculum fields', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { university: 'Example University', programme: 'Flexible degree', academicYear: '2030/31', currentYearKey: 'cohort-b' },
    courses: [{
      id: 'x', code: 'cs-101', name: 'Changing Curriculum', ects: 7.5, yearLevel: 'Foundation', period: 'Winter intensive', passMark: 60,
      attempts: [{ id: 'x-retake', academicYear: '2030/31', type: 'resit', examDate: '2031-02-14', grade: null, status: 'upcoming' }]
    }]
  })
  assert.equal(workspace.courses[0].code, 'CS-101')
  assert.equal(workspace.courses[0].yearLevel, 'Foundation')
  assert.equal(workspace.courses[0].period, 'Winter intensive')
  assert.equal(workspace.courses[0].attempts[0].examDate, '2031-02-14')
})

test('academic records preserve editorial programme provenance and unresolved choices', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: { university: 'Maastricht University', programme: 'Computer Science' },
    programmeTemplate: {
      programmeId: 'maastricht-university-bsc-computer-science',
      versionId: '2025-2026',
      currentStudyYear: 'Year 2',
      pathwayId: null,
      selectedChoices: { 'year-2-semester-1-module': ['bcs2720'], 'year-2-semester-2-module': [] }
    },
    courses: [{
      id: 'bcs1540-plan', code: 'BCS1540', name: 'Algorithmic Design', ects: 4,
      templateCourseId: 'bcs1540', programmeRequirement: 'required', attempts: []
    }]
  })
  assert.equal(workspace.programmeTemplate.programmeId, 'maastricht-university-bsc-computer-science')
  assert.deepEqual(workspace.programmeTemplate.selectedChoices['year-2-semester-2-module'], [])
  assert.equal(workspace.courses[0].templateCourseId, 'bcs1540')
  assert.equal(workspace.courses[0].programmeRequirement, 'required')
})

test('academic records preserve manual period assignments and uploaded calendar context', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [{ id: 'c1', code: 'CS101', name: 'Systems', attempts: [] }],
    planning: {
      objectives: {},
      periodAssignments: [{ academicYear: '2026-2027', period: 'Period 1', courseIds: ['c1', 'c1'], source: 'manual' }],
      academicPeriods: [{ title: 'Period 1', date: '2026-08-31', endDate: '2026-10-09', kind: 'period', period: 1, academicYear: '2026-2027' }]
    }
  })
  assert.deepEqual(workspace.planning.periodAssignments[0].courseIds, ['c1'])
  assert.equal(workspace.planning.academicPeriods[0].kind, 'period')
  assert.equal(workspace.planning.academicPeriods[0].period, 1)
})

test('academic summary derives credits, weighted GPA, and upcoming exams', () => {
  const workspace = normalizeAcademicWorkspace({
    profile: {},
    courses: [
      { id: 'a', name: 'A', ects: 5, attempts: [{ status: 'passed', grade: 8, examDate: '2026-01-01' }] },
      { id: 'b', name: 'B', ects: 10, attempts: [{ status: 'passed', grade: 6, examDate: '2026-02-01' }] },
      { id: 'c', name: 'C', ects: 4, attempts: [{ status: 'upcoming', examDate: '2027-03-02', type: 'resit' }] }
    ]
  })
  assert.deepEqual(academicSummary(workspace), {
    earnedEcts: 15,
    gpa: 6.67,
    passedCourses: 2,
    totalCourses: 3,
    upcoming: [{ courseId: 'c', code: '', name: 'C', ects: 4, id: 'attempt-1', academicYear: '', type: 'resit', examDate: '2027-03-02', grade: null, status: 'upcoming' }]
  })
})

test('academic workspaces are isolated by authenticated user', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const alice = `academics-alice-${suffix}`
  const bob = `academics-bob-${suffix}`
  try {
    await withRequestContext({ userId: alice }, () => saveAcademicWorkspace({ profile: { programme: 'Alice degree' }, courses: [] }))
    const a = await withRequestContext({ userId: alice }, () => readAcademicWorkspace())
    const b = await withRequestContext({ userId: bob }, () => readAcademicWorkspace())
    assert.equal(a.workspace.profile.programme, 'Alice degree')
    assert.deepEqual(b.workspace, emptyAcademicWorkspace())
  } finally {
    await withRequestContext({ userId: alice }, () => deletePersonalData())
    await withRequestContext({ userId: bob }, () => deletePersonalData())
  }
})

test('multiple programmes keep separate curricula and reject stale writes', async () => {
  const userId = `academics-programmes-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      const created = await createAcademicProgramme({ programme: 'Programme B', academicYear: '2031-2032' })
      assert.equal(created.workspace.profile.programme, 'Programme B')
      const saved = await saveActiveAcademicWorkspace({ ...created.workspace, courses: [{ name: 'Cohort-only course', ects: 6, attempts: [] }] }, 0)
      assert.equal(saved.workspace.revision, 1)
      await assert.rejects(() => saveActiveAcademicWorkspace(saved.workspace, 0), /another tab/)
      await selectAcademicProgramme('default')
      const original = await readAcademicState()
      assert.equal(original.workspace.id, 'default')
      assert.equal(original.workspace.courses.length, 0)
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})

test('normalization rejects impossible dates and bounds grading scales', () => {
  const workspace = normalizeAcademicWorkspace({ profile: {}, courses: [{ name: 'Validation', passMark: 150, attempts: [{ examDate: '2027-02-31', grade: -4, status: 'failed' }] }] })
  assert.equal(workspace.courses[0].passMark, 100)
  assert.equal(workspace.courses[0].attempts[0].examDate, null)
  assert.equal(workspace.courses[0].attempts[0].grade, 0)
})

test('legacy AppStore import creates a separate programme and reports matched, unmatched, and rejected records', async () => {
  const userId = `academics-import-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      const result = await importAcademicProgramme({ version: 1, storageKey: 'academics-ws-default', generatedAt: '2030-01-01T00:00:00Z', data: { profile: { programme: 'Imported' }, courses: [{ code: 'cs101', name: 'Matched', ects: 5, attempts: [] }, { code: 'X9', name: 'Planning only', ects: 5, attempts: [] }, { code: 'BAD', name: '', attempts: [] }] } }, [{ id: 'editorial-cs', code: 'CS101' }])
      assert.notEqual(result.workspace.id, 'default')
      assert.deepEqual(result.importReport.matched, ['CS101'])
      assert.deepEqual(result.importReport.unmatched, ['X9'])
      assert.equal(result.importReport.rejected.length, 1)
      assert.equal(result.importReport.rejected[0].label, 'BAD')
      assert.equal(result.workspace.courses[0].editorialCourseId, 'editorial-cs')
      assert.equal(result.index.programmes.length, 2)
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})
