import test from 'node:test'
import assert from 'node:assert/strict'
import { findEditorialProgramme } from '../lib/editorial-programmes.mjs'
import { programmesMatch, reconcileProgrammeCourses, validateSetupSources } from '../lib/setup-validation.mjs'

test('programme comparison ignores degree wording', () => {
  assert.equal(programmesMatch('Bachelor of Science Computer Science', 'BSc Computer Science'), true)
  assert.equal(programmesMatch('Bachelor of Science Computer Science', 'Master of Arts European Studies'), false)
})

test('setup validation reports an explicit transcript mismatch', () => {
  const issues = validateSetupSources({ programmeName: 'BSc Computer Science', recordProgramme: 'MSc Data Science' })
  assert.equal(issues[0].id, 'programme-record-mismatch')
  assert.equal(issues[0].severity, 'error')
})

test('historical courses do not create a current-course warning', () => {
  const issues = validateSetupSources({
    selectedCourses: [{ code: 'BCS1000' }],
    recordCourses: [{ code: 'OLD1000', section: 'historical', status: 'passed' }]
  })
  assert.deepEqual(issues, [])
})

test('current electives and carry-overs are checked against the whole curriculum, not one year workspace', () => {
  const current = {
    id: '2026-2027',
    courses: [
      { code: 'BCS2510', name: 'IT Management & Privacy', yearLevel: 'Year 3', period: 'Period 4' },
      { code: 'BCS2140', name: 'Operating Systems', yearLevel: 'Year 2', period: 'Period 1' },
      { code: 'BCS3120', name: 'Ubiquitous Computing & Internet of Things', yearLevel: 'Year 3', period: 'Period 1', requirement: 'elective' }
    ]
  }
  const recordCourses = [
    { code: 'BCS2140', name: 'Operating Systems', section: 'current', status: 'upcoming' },
    { code: 'BCS3120', name: 'Ubiquitous Computing & Internet of Things', section: 'current', status: 'upcoming' }
  ]
  const issues = validateSetupSources({
    selectedVersion: current,
    programmeVersions: [current],
    // This is the deliberately small Year 3 required workspace which caused
    // the production false positive.
    selectedCourses: [current.courses[0]],
    recordCourses,
    studyYear: 'Year 3'
  })
  const reconciliation = reconcileProgrammeCourses({ selectedVersion: current, programmeVersions: [current], recordCourses, studyYear: 'Year 3' })
  assert.deepEqual(issues, [])
  assert.equal(reconciliation.recognizedCount, 2)
  assert.equal(reconciliation.otherYearCount, 1)
})

test('course history recognises a code change and preserves every known placement', () => {
  const current = { id: '2026-2027', courses: [{ code: 'BCS2140', name: 'Operating Systems', yearLevel: 'Year 2', period: 'Period 1' }] }
  const previous = { id: '2025-2026', courses: [
    { code: 'BCS2140', name: 'Operating Systems', yearLevel: 'Year 2', period: 'Period 1' },
    { code: 'BCS3420', name: 'Operating Systems', yearLevel: 'Year 3', period: 'Period 4' }
  ] }
  const result = reconcileProgrammeCourses({
    selectedVersion: current,
    programmeVersions: [current, previous],
    recordCourses: [{ code: 'BCS3420', name: 'Operating Systems', academicYear: '2025-2026', period: 'Period 4', section: 'completed', status: 'passed' }],
    studyYear: 'Year 3'
  })
  assert.equal(result.records[0].status, 'code-changed')
  assert.equal(result.changes[0].kind, 'code-and-placement')
  assert.deepEqual(new Set(result.changes[0].placements.map((item) => item.code)), new Set(['BCS2140', 'BCS3420']))
})

test('the academic record can reveal a moved course missing from an intermediate catalogue edition', () => {
  const current = { id: '2026-2027', courses: [{ code: 'BCS2510', name: 'IT Management & Privacy', yearLevel: 'Year 3', period: 'Period 4' }] }
  const result = reconcileProgrammeCourses({
    selectedVersion: current,
    programmeVersions: [current],
    recordCourses: [{ code: 'BCS2510', name: 'IT Management & Privacy', academicYear: '2024-2025', period: 'Period 5', section: 'completed', status: 'passed' }]
  })
  assert.equal(result.records[0].recognized, true)
  assert.equal(result.changes[0].kind, 'placement')
  assert.deepEqual(new Set(result.changes[0].placements.map((item) => item.period)), new Set(['Period 4', 'Period 5']))
})

test('the Computer Science record shown in setup reconciles against the full programme', () => {
  const found = findEditorialProgramme('maastricht-university-bsc-computer-science', '2026-2027')
  assert.ok(found)
  const recordCourses = [
    ['BCS3300', 'Project 3-1'],
    ['BCS2120', 'Introduction to Artificial Intelligence'],
    ['BCS2130', 'Intelligent User Interfaces'],
    ['BCS2140', 'Operating Systems'],
    ['BCS3120', 'Ubiquitous Computing & Internet of Things'],
    ['BCS3130', 'Game Theory'],
    ['BCS3210', 'Block Chains'],
    ['BCS2110', 'Computer Networks'],
    ['BCS3220', 'Startup Engineering: Building Scalable Tech Ventures'],
    ['BCS3230', 'Cryptography'],
    ['BCS3440', 'Introduction to Bio-Informatics'],
    ['BCS2410', 'Embedded Programming'],
    ['BCS1540', 'Algorithmic Design'],
    ['BCS2220', 'Principles of Programming Languages'],
    ['BCS2540', 'Numerical Methods']
  ].map(([courseCode, name]) => ({ code: courseCode, name, section: 'current', status: 'upcoming' }))

  const result = reconcileProgrammeCourses({
    selectedVersion: found.version,
    programmeVersions: found.programme.versions,
    recordCourses,
    studyYear: 'Year 3'
  })

  assert.equal(result.currentCount, 15)
  assert.equal(result.recognizedCount, 15)
  assert.equal(result.outsideCount, 0)
  assert.deepEqual(validateSetupSources({
    programmeName: found.programme.name,
    selectedVersion: found.version,
    programmeVersions: found.programme.versions,
    recordCourses,
    studyYear: 'Year 3'
  }), [])
})
