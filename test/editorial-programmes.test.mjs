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
