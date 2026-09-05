#!/usr/bin/env node
// Build the first Computer Science cohort from the three official curricula
// that cohort actually encountered. Computer Science launched in 2023, so the
// university published Year 1 in 2023-2024, Year 2 in 2024-2025, and Year 3 in
// 2025-2026. Treating any one of those offering years as a complete curriculum
// moves courses to places the student never took them.
//
// This script is deliberately deterministic: the reviewed course identities
// and placements live below, while existing enriched details are reused only
// for the edition in which they were published.
//
//   node scripts/build-historical-cs-cohort.mjs [--write]


import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cataloguePath = resolve(root, 'data/editorial-programmes.json')
const programmeId = 'maastricht-university-bsc-computer-science'

const sources = [
  {
    label: 'Official Computer Science courses, 2023–2024',
    url: 'https://www.maastrichtuniversity.nl/file/fse-cs-curriculum-2023-2024pdf'
  },
  {
    label: 'DACS Study Guide, 2024–2025',
    url: 'https://www.maastrichtuniversity.nl/sites/default/files/2025-05/FSE-%20DACS-%20Study%20Guide.pdf'
  },
  {
    label: 'Official Computer Science courses, 2025–2026',
    url: 'https://www.maastrichtuniversity.nl/file/cs-2025en-9503pdf'
  }
]

const YEAR_1 = [
  ['BCS1110', 'Introduction to Computer Science', 4, 'Period 1', 'required'],
  ['BCS1120', 'Procedural Programming', 4, 'Period 1', 'required'],
  ['BCS1130', 'Discrete Mathematics', 4, 'Period 1', 'required'],
  ['BCS1300', 'Project 1-1', 6, 'Semester 1', 'required'],
  ['BCS1220', 'Objects in Programming', 4, 'Period 2', 'required'],
  ['BCS1440', 'Calculus', 4, 'Period 2', 'required'],
  ['BCS1530', 'Logic', 4, 'Period 2', 'required'],
  ['BCS1410', 'Linear Algebra', 4, 'Period 4', 'required'],
  ['BCS1420', 'Data Structures and Algorithms', 4, 'Period 4', 'required'],
  ['BCS1430', 'Object-Oriented Modelling', 4, 'Period 4', 'required'],
  ['BCS1600', 'Project 1-2', 6, 'Semester 2', 'required'],
  ['BCS1510', 'Databases', 4, 'Period 5', 'required'],
  ['BCS1520', 'Statistics', 4, 'Period 5', 'required'],
  ['BCS1540', 'Algorithmic Design', 4, 'Period 5', 'required']
]

const YEAR_2 = [
  ['BCS2110', 'Computer Networks', 4, 'Period 1', 'required'],
  ['BCS2120', 'Introduction to Artificial Intelligence', 4, 'Period 1', 'required'],
  ['BCS2130', 'Intelligent User Interfaces', 4, 'Period 1', 'required'],
  ['BCS2710', 'M2-1: Intelligent Interaction', 10, 'Semester 1', 'choice'],
  ['BCS2720', 'M2-1: Artificial Intelligence and Machine Learning', 10, 'Semester 1', 'choice'],
  ['BCS2210', 'Software Engineering and Architectures', 4, 'Period 2', 'required'],
  ['BCS2220', 'Principles of Programming Languages', 4, 'Period 2', 'required'],
  ['BCS2410', 'Embedded Programming', 4, 'Period 4', 'required'],
  ['BCS2420', 'Computer Security', 4, 'Period 4', 'required'],
  ['BCS2430', 'Parallel Programming', 4, 'Period 4', 'required'],
  ['BCS2730', 'M2-2: High Performance Computing', 10, 'Semester 2', 'choice'],
  ['BCS2740', 'M2-2: Cybersecurity & IoT – Information Security', 10, 'Semester 2', 'choice'],
  ['BCS2750', 'M2-2: Cybersecurity & IoT – Ubiquitous Computing & IoT', 10, 'Semester 2', 'choice'],
  ['BCS2510', 'IT Management and Privacy', 4, 'Period 5', 'required'],
  ['BCS2540', 'Numerical Methods', 4, 'Period 5', 'required']
]

const optionalDetailFields = [
  'description',
  'coordinator',
  'department',
  'prerequisites',
  'reading',
  'teachingMethods',
  'assessmentMethods',
  'startsOn',
  'endsOn'
]

function minimalCourse([code, name, ects, period, requirement], yearLevel) {
  return { id: code.toLowerCase(), code, name, ects, yearLevel, period, requirement }
}

function withoutOfferingDetails(course) {
  const clean = { ...course }
  for (const field of optionalDetailFields) delete clean[field]
  return clean
}

export function buildHistoricalComputerScienceCohort(programme) {
  const yearThreeSource = programme.versions.find((version) => version.id === '2025-2026')
  if (!yearThreeSource) throw new Error('The reviewed 2025–2026 Computer Science edition is required.')

  const yearOne = YEAR_1.map((row) => minimalCourse(row, 'Year 1'))
  const yearTwo = YEAR_2.map((row) => minimalCourse(row, 'Year 2'))
  const yearThree = yearThreeSource.courses
    .filter((course) => course.yearLevel === 'Year 3')
    .map((course) => ({ ...course }))

  const version = {
    id: '2023-2024',
    label: '2023–2024 entry cohort curriculum',
    status: 'reference',
    lastVerified: '2026-09-05',
    grading: { passMark: 5.5 },
    sources,
    courses: [...yearOne, ...yearTwo, ...yearThree],
    choiceGroups: [
      {
        id: 'year-2-semester-1-module',
        label: 'Year 2 · Semester 1 module',
        description: 'Choose one 10 ECTS module.',
        minSelections: 1,
        maxSelections: 1,
        courseIds: ['bcs2710', 'bcs2720']
      },
      {
        id: 'year-2-semester-2-module',
        label: 'Year 2 · Semester 2 module',
        description: 'Choose one 10 ECTS module.',
        minSelections: 1,
        maxSelections: 1,
        courseIds: ['bcs2730', 'bcs2740', 'bcs2750']
      },
      ...(yearThreeSource.choiceGroups || []).filter((group) => group.id === 'year-3-electives')
    ],
    pathways: structuredClone(yearThreeSource.pathways || []),
    requirements: structuredClone(yearThreeSource.requirements || [])
  }

  // The two early editions are intentionally minimal. Reusing a current
  // coordinator or date would make a historically correct placement carry a
  // fact from the wrong year. Year 3 is already sourced from its own edition.
  version.courses = version.courses.map((course) => course.yearLevel === 'Year 3' ? course : withoutOfferingDetails(course))
  return version
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8'))
  const programme = catalogue.programmes.find((entry) => entry.id === programmeId)
  if (!programme) throw new Error(`No programme ${programmeId}.`)
  const version = buildHistoricalComputerScienceCohort(programme)
  console.log(`${version.label}: ${version.courses.length} courses`)
  for (const year of ['Year 1', 'Year 2', 'Year 3']) {
    const courses = version.courses.filter((course) => course.yearLevel === year)
    console.log(`  ${year}: ${courses.length} courses · ${courses.filter((course) => course.requirement === 'required').reduce((sum, course) => sum + course.ects, 0)} required ECTS`)
  }
  if (!process.argv.includes('--write')) {
    console.log('\nDry run. Pass --write to update the catalogue.')
    process.exit(0)
  }
  programme.versions = [...programme.versions.filter((entry) => entry.id !== version.id), version]
  await writeFile(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`)
  console.log('\nCatalogue updated.')
}
