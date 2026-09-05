import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { findEditorialProgramme, loadEditorialProgrammeCatalogue, mergeEditorialProgrammeSeed, normalizeEditorialProgrammeCatalogue } from '../lib/editorial-programmes.mjs'
import { buildVersion, parseCurriculumExtract } from '../scripts/import-curriculum.mjs'

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

test('a hosted programme keeps administrator edits while repository releases add new curriculum versions', () => {
  const seeded = loadEditorialProgrammeCatalogue().programmes.find((programme) => programme.id === 'maastricht-university-bsc-computer-science')
  const stored = structuredClone(seeded)
  stored.name = 'Computer Science — hosted wording'
  stored.calendar = [{ id: 'hosted-date', title: 'Hosted calendar date', date: '2026-09-01', type: 'other', kind: 'other' }]
  stored.versions = stored.versions.filter((version) => version.id === '2025-2026')
  stored.versions[0].label = 'Administrator-edited 2025–2026 curriculum'
  stored.institution.domains = ['student.maastrichtuniversity.nl']

  const merged = mergeEditorialProgrammeSeed(stored, seeded)

  assert.equal(merged.name, 'Computer Science — hosted wording')
  assert.deepEqual(merged.versions.map((version) => version.id), ['2026-2027', '2025-2026', '2023-2024'])
  assert.equal(merged.versions[1].label, 'Administrator-edited 2025–2026 curriculum')
  assert.deepEqual(merged.calendar.map((event) => event.id), ['hosted-date'])
  assert.deepEqual(merged.institution.domains.sort(), ['maastrichtuniversity.nl', 'student.maastrichtuniversity.nl'])
})

test('every maintained DACS curriculum reconciles to a full degree', async () => {
  const { loadEditorialProgrammeCatalogue } = await import('../lib/editorial-programmes.mjs')
  const catalogue = loadEditorialProgrammeCatalogue()
  // All four programmes the Department of Advanced Computing Sciences runs.
  assert.deepEqual(catalogue.programmes.map((programme) => `${programme.degree} ${programme.name}`).sort(), [
    'Bachelor of Science Computer Science',
    'Bachelor of Science Data Science and Artificial Intelligence',
    'Master of Science Artificial Intelligence',
    'Master of Science Data Science for Decision Making'
  ])

  for (const programme of catalogue.programmes) {
    const version = programme.versions.find((entry) => entry.id === '2026-2027')
    assert.ok(version, `${programme.name} has a 2026-2027 curriculum`)
    assert.equal(programme.totalEcts, programme.durationYears * 60, `${programme.name} is ${programme.durationYears} full years`)

    // A year is 60 ECTS. A bachelor's first year is entirely core; every other
    // year mixes core with electives, so core must fit inside a year without
    // filling it. An extraction that silently dropped a course shows up here.
    const requiredEcts = (year) => version.courses
      .filter((course) => course.yearLevel === year && course.requirement !== 'elective')
      .reduce((total, course) => total + course.ects, 0)
    if (programme.degree.startsWith('Bachelor')) {
      assert.equal(requiredEcts('Year 1'), 60, `${programme.name} year 1 is a full year of core courses`)
    }
    for (let year = 1; year <= programme.durationYears; year++) {
      const core = requiredEcts(`Year ${year}`)
      assert.ok(core > 0 && core <= 60, `${programme.name} year ${year} core load is ${core} ECTS, which is not inside a year`)
    }
    // Every degree ends in a thesis worth half a year or more.
    const thesis = version.courses.find((course) => /thesis/i.test(course.name))
    assert.ok(thesis && thesis.ects >= 18, `${programme.name} has a thesis`)

    // Every course carries the identity the rest of the system joins on.
    for (const course of version.courses) {
      assert.match(course.code, /^[A-Z]{2,4}\d{3,5}[A-Z]?$/, `${course.code} looks like a course code`)
      assert.ok(course.ects > 0, `${course.code} has credits`)
      assert.match(course.yearLevel, /^Year [1-3]$/, `${course.code} is placed in a year`)
      assert.match(course.period, /^(Period [1-6]|Semester [12]|Year)$/, `${course.code} has a teaching period, got "${course.period}"`)
    }

    // The period is what lines a catalogue course up with a Canvas term and an
    // Academic Work row, so every programme must have a readable Period 1.
    assert.ok(version.courses.filter((course) => course.period === 'Period 1').length >= 4, `${programme.name} has a Period 1`)

    // A scrape that addressed the wrong programme code returned nothing at all
    // rather than failing, so wholesale absence is the failure mode to test
    // for. A handful of courses genuinely publish no description, which is why
    // this is a proportion and not every course.
    const described = version.courses.filter((course) => course.description && course.description.length > 40)
    assert.ok(described.length / version.courses.length > 0.85, `${programme.name}: only ${described.length} of ${version.courses.length} courses have a description`)
    assert.ok(version.courses.filter((course) => course.coordinator).length / version.courses.length > 0.85, `${programme.name} names coordinators`)

    // No field may hold the name of the section after it. An empty section in
    // the source made the reader capture the next heading as the value.
    const LABEL = /^(Prerequisites|Recommended reading|Additional reading|Credits|Coordinator|Teaching methods|Assessment methods|Close)\b/i
    for (const course of version.courses) {
      for (const field of ['description', 'coordinator', 'prerequisites', 'reading', 'teachingMethods', 'assessmentMethods']) {
        const value = course[field]
        if (typeof value === 'string' && value.length < 60) {
          assert.ok(!LABEL.test(value.trim()), `${course.code}.${field} is a section heading, not a value: ${JSON.stringify(value)}`)
        }
      }
    }
  }
})

test('every current catalogue course is an exact row from the complete official extraction', async () => {
  const catalogue = loadEditorialProgrammeCatalogue()
  const extracts = [
    ['maastricht-university-bsc-computer-science', 'data/curricula/bcs.json'],
    ['maastricht-university-bsc-data-science-and-artificial-intelligence', 'data/curricula/dsai.json'],
    ['maastricht-university-msc-artificial-intelligence', 'data/curricula/msc-ai.txt'],
    ['maastricht-university-msc-data-science-for-decision-making', 'data/curricula/msc-dsdm.txt']
  ]
  const identity = (course) => ({
    code: course.code,
    name: course.name,
    ects: course.ects,
    yearLevel: course.yearLevel,
    period: course.period,
    requirement: course.requirement
  })

  for (const [programmeId, path] of extracts) {
    const extract = parseCurriculumExtract(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'))
    const imported = buildVersion({ id: '2026-2027', courses: extract.courses })
    const programme = catalogue.programmes.find((entry) => entry.id === programmeId)
    const current = programme?.versions.find((entry) => entry.id === '2026-2027')
    assert.ok(current, `${programmeId} has a current curriculum`)
    assert.deepEqual(
      current.courses.map(identity),
      imported.courses.map(identity),
      `${programmeId} must not omit, invent, rename, or reposition an extracted course`
    )
  }
})
