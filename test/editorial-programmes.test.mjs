import test from 'node:test'
import assert from 'node:assert/strict'
import { findEditorialProgramme, loadEditorialProgrammeCatalogue, normalizeEditorialProgrammeCatalogue } from '../lib/editorial-programmes.mjs'

test('Maastricht Computer Science reference programme encodes a complete 180 ECTS structure', () => {
  const found = findEditorialProgramme('maastricht-university-bsc-computer-science', '2025-2026')
  assert.ok(found)
  const { programme, version } = found
  assert.equal(programme.totalEcts, 180)
  assert.equal(version.courses.filter((course) => course.requirement === 'required').reduce((sum, course) => sum + course.ects, 0), 130)
  assert.deepEqual(version.choiceGroups.slice(0, 2).map((group) => [group.minSelections, group.maxSelections, group.courseIds.length]), [[1, 1, 2], [1, 1, 2]])
  const courseBased = version.pathways.find((pathway) => pathway.id === 'course-based')
  const electives = version.choiceGroups.find((group) => group.id === 'year-3-electives')
  assert.deepEqual([electives.minSelections, electives.maxSelections], [6, 6])
  const selectableEcts = version.choiceGroups.slice(0, 2).reduce((sum, group) => sum + version.courses.find((course) => course.id === group.courseIds[0]).ects, 0)
  const pathwayEcts = courseBased.includedCourseIds.reduce((sum, id) => sum + version.courses.find((course) => course.id === id).ects, 0)
  const electiveEcts = electives.minSelections * version.courses.find((course) => course.id === electives.courseIds[0]).ects
  assert.equal(130 + selectableEcts + pathwayEcts + electiveEcts, 180)
})

test('known programme connects to the five maintained Maastricht course codes', () => {
  const maintained = new Set(['BCS1540', 'BCS1520', 'BCS2410', 'BCS2420', 'BCS2540'])
  const { version } = findEditorialProgramme('maastricht-university-bsc-computer-science', '2025-2026')
  assert.deepEqual(version.courses.filter((course) => maintained.has(course.code)).map((course) => course.code).sort(), [...maintained].sort())
})

test('editorial programme catalogue rejects duplicate identifiers', () => {
  const catalogue = loadEditorialProgrammeCatalogue()
  catalogue.programmes.push(structuredClone(catalogue.programmes[0]))
  assert.throws(() => normalizeEditorialProgrammeCatalogue(catalogue), /Duplicate programme id/)
})

test('the maintained DACS curricula reconcile to a full bachelor', async () => {
  const { loadEditorialProgrammeCatalogue } = await import('../lib/editorial-programmes.mjs')
  const catalogue = loadEditorialProgrammeCatalogue()
  const dacs = catalogue.programmes.filter((programme) => /computer science|data science and artificial intelligence/i.test(programme.name))
  assert.equal(dacs.length, 2, 'both DACS bachelors are maintained')

  for (const programme of dacs) {
    const version = programme.versions.find((entry) => entry.id === '2026-2027')
    assert.ok(version, `${programme.name} has a 2026-2027 curriculum`)
    assert.equal(programme.totalEcts, 180)

    // A Maastricht bachelor year is exactly 60 ECTS of required teaching in
    // year one; later years make the balance up with electives. Extraction that
    // silently dropped a course would show here first.
    const requiredEcts = (year) => version.courses
      .filter((course) => course.yearLevel === year && course.requirement !== 'elective')
      .reduce((total, course) => total + course.ects, 0)
    assert.equal(requiredEcts('Year 1'), 60, `${programme.name} year 1 is a full year of core courses`)
    assert.ok(requiredEcts('Year 2') > 0 && requiredEcts('Year 2') <= 60, `${programme.name} year 2 core load is within a year`)
    assert.ok(requiredEcts('Year 3') > 0 && requiredEcts('Year 3') <= 60, `${programme.name} year 3 core load is within a year`)

    // Every course carries the identity the rest of the system joins on.
    for (const course of version.courses) {
      assert.match(course.code, /^[A-Z]{2,4}\d{3,5}[A-Z]?$/, `${course.code} looks like a course code`)
      assert.ok(course.ects > 0, `${course.code} has credits`)
      assert.match(course.yearLevel, /^Year [1-3]$/, `${course.code} is placed in a year`)
      assert.match(course.period, /^(Period [1-6]|Semester [12]|Year)$/, `${course.code} has a teaching period, got "${course.period}"`)
    }

    // The period is what lines a catalogue course up with a Canvas term and an
    // Academic Work row, so every programme must have a readable Period 1.
    assert.ok(version.courses.filter((course) => course.period === 'Period 1').length >= 8, `${programme.name} has a Period 1`)
  }
})
