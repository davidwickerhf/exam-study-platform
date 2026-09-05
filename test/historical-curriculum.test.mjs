import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEditorialProgrammeCatalogue } from '../lib/editorial-programmes.mjs'
import { curriculumCourseIdentity, reconcileAcademicCourseIdentities } from '../lib/course-identities.mjs'

const PROGRAMME = 'maastricht-university-bsc-computer-science'

test('the 2023 Computer Science cohort follows the editions it actually encountered', () => {
  const programme = loadEditorialProgrammeCatalogue().programmes.find((entry) => entry.id === PROGRAMME)
  const version = programme.versions.find((entry) => entry.id === '2023-2024')
  assert.ok(version)

  const byCode = new Map(version.courses.map((course) => [course.code, course]))
  assert.deepEqual(
    ['BCS1430', 'BCS2510', 'BCS3420'].map((code) => {
      const course = byCode.get(code)
      return [course.code, course.name, course.yearLevel, course.period]
    }),
    [
      ['BCS1430', 'Object-Oriented Modelling', 'Year 1', 'Period 4'],
      ['BCS2510', 'IT Management and Privacy', 'Year 2', 'Period 5'],
      ['BCS3420', 'Operating Systems', 'Year 3', 'Period 4']
    ]
  )
  assert.equal(byCode.has('BCS1450'), false, 'Computer Architecture replaced Object-Oriented Modelling only in a later cohort')
  assert.equal(byCode.has('BCS2140'), false, 'the later Year-2 Operating Systems code must not rewrite this cohort')
  assert.equal(version.courses.filter((course) => course.yearLevel === 'Year 1' && course.requirement === 'required').reduce((sum, course) => sum + course.ects, 0), 60)

  const secondSemester = version.choiceGroups.find((group) => group.id === 'year-2-semester-2-module')
  assert.equal(secondSemester.minSelections, 1)
  assert.equal(secondSemester.maxSelections, 1)
  assert.deepEqual(secondSemester.courseIds, ['bcs2730', 'bcs2740', 'bcs2750'])
})

test('a current later Operating Systems registration fulfils the cohort requirement without losing its live placement', () => {
  const programme = loadEditorialProgrammeCatalogue().programmes.find((entry) => entry.id === PROGRAMME)
  const selectedVersion = programme.versions.find((entry) => entry.id === '2023-2024')
  const identity = curriculumCourseIdentity({ selectedVersion, programmeVersions: programme.versions })
  const reconciled = reconcileAcademicCourseIdentities([{
    id: 'record-bcs2140',
    code: 'BCS2140',
    name: 'Operating Systems',
    ects: 4,
    yearLevel: 'Year 2',
    period: 'Period 1',
    attempts: [{ academicYear: '2026-2027', status: 'upcoming', courseCode: 'BCS2140', courseName: 'Operating Systems', yearLevel: 'Year 2', period: 'Period 1' }]
  }], identity)

  assert.equal(reconciled.length, 1)
  assert.deepEqual(
    { code: reconciled[0].code, yearLevel: reconciled[0].yearLevel, period: reconciled[0].period },
    { code: 'BCS2140', yearLevel: 'Year 2', period: 'Period 1' }
  )
  assert.deepEqual(
    { code: reconciled[0].catalogueCode, yearLevel: reconciled[0].catalogueYearLevel, period: reconciled[0].cataloguePeriod },
    { code: 'BCS3420', yearLevel: 'Year 3', period: 'Period 4' }
  )
  assert.deepEqual(
    { code: reconciled[0].attempts[0].courseCode, yearLevel: reconciled[0].attempts[0].yearLevel, period: reconciled[0].attempts[0].period },
    { code: 'BCS2140', yearLevel: 'Year 2', period: 'Period 1' }
  )
})
