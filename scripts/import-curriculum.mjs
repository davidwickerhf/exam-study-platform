#!/usr/bin/env node
// Turns a curriculum extracted from the university's course repository into a
// programme version in data/editorial-programmes.json.
//
// The repository is a Mendix application: it renders the curriculum through
// POST /xas/, a session-bound internal endpoint carrying per-session object
// GUIDs, per-attribute hashes, and an operationId tied to the deployed app
// version. A server cannot replay that, and anything that tried would break
// silently on the university's next release — during a student's onboarding.
//
// So a curriculum is editorial data: extracted once per programme per academic
// year with a browser, reviewed, committed, and then served to every student
// instantly. This script is the "committed" half.
//
// The repository addresses a programme two different ways and they are not
// interchangeable. The university website links /p/program/EN/50017317, but a
// course inside it lives at /p/module/EN/9501/<code> — a short
// programme-of-study code, not that id. Computer Science hides this, because
// its website id *is* its short code (9503). Using the long id for the others
// returns nothing at all, silently:
//
//     Computer Science 9503 → 9503     Data Science and AI  50017317 → 9501
//     MSc AI          50017318 → 9603  MSc DSDM             50017319 → 9602
//
// The short code is found by opening the programme, clicking any course, and
// reading the URL.
//
//   node scripts/import-curriculum.mjs <extract.json> [--write]
//
// The extract is { programmeId, name, courses: [[code, name, ects, periods[], year?, kind?], …] }
// where `periods` are the repository's own 1–6 markers.

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGUE = resolve(root, 'data/editorial-programmes.json')

// The repository marks the periods a course runs in. One marker is a period; a
// contiguous run of three is a semester; all six is a year-long course.
export function describePeriod(periods = []) {
  const sorted = [...new Set(periods.map(Number).filter(Boolean))].sort((left, right) => left - right)
  if (!sorted.length) return ''
  if (sorted.length === 1) return `Period ${sorted[0]}`
  if (sorted.join() === '1,2,3') return 'Semester 1'
  if (sorted.join() === '4,5,6') return 'Semester 2'
  if (sorted.join() === '1,2,3,4,5,6') return 'Year'
  return sorted.map((period) => `Period ${period}`).join(' & ')
}

// A group heading names the year and whether the block is core or elective.
export function describeGroup(group = '', fallbackYear = null, fallbackKind = null) {
  const year = Number(String(group).match(/year\s*([1-6])/i)?.[1]) || fallbackYear || null
  const elective = /elective|honours|study abroad/i.test(group) || fallbackKind === 'elective'
  return { yearLevel: year ? `Year ${year}` : '', requirement: elective ? 'elective' : 'required' }
}

export function buildVersion({ id, label, status = 'reference', courses, sources = [] }) {
  const mapped = courses.map((entry) => {
    const [code, name, ects, periods, yearOrGroup, kind] = entry
    const group = typeof yearOrGroup === 'string' ? yearOrGroup : ''
    const { yearLevel, requirement } = describeGroup(group, typeof yearOrGroup === 'number' ? yearOrGroup : null, kind)
    return {
      id: String(code).toLowerCase(),
      code: String(code).toUpperCase(),
      name: String(name).trim(),
      ects: Number(ects) || 0,
      yearLevel,
      period: describePeriod(periods),
      requirement
    }
  })
  const seen = new Set()
  const unique = mapped.filter((course) => !seen.has(course.id) && seen.add(course.id))
  return { id, label, status, sources, courses: unique }
}

export function summarise(version) {
  const byYear = {}
  for (const course of version.courses) {
    const key = course.yearLevel || 'Unassigned'
    byYear[key] = byYear[key] || { required: 0, elective: 0, ects: 0 }
    byYear[key][course.requirement === 'elective' ? 'elective' : 'required'] += 1
    if (course.requirement !== 'elective') byYear[key].ects += course.ects
  }
  return byYear
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, ...flags] = process.argv.slice(2)
  if (!file) { console.error('Usage: node scripts/import-curriculum.mjs <extract.json> [--write]'); process.exit(1) }
  const raw = await readFile(resolve(file), 'utf8')
  // Two input shapes: JSON, or the pipe-delimited rows the browser extractor
  // prints — code|name|ects|periods|group, one per line, after a header of
  // `key: value` lines.
  const extract = raw.trimStart().startsWith('{') ? JSON.parse(raw) : (() => {
    const meta = {}
    const courses = []
    for (const line of raw.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
      if (line.startsWith('#')) continue
      if (!line.includes('|')) {
        const [key, ...rest] = line.split(':')
        meta[key.trim()] = rest.join(':').trim()
        continue
      }
      const [code, name, ects, periods, group] = line.split('|')
      courses.push([code.trim(), name.trim(), Number(ects), periods.split('+').map(Number).filter(Boolean), group.trim()])
    }
    return { ...meta, sources: meta.repository ? [{ label: 'Official course repository', url: meta.repository }] : [], courses }
  })()
  const version = buildVersion({
    id: extract.versionId || '2026-2027',
    label: extract.versionLabel || '2026–2027 reference curriculum',
    courses: extract.courses,
    sources: extract.sources || []
  })
  console.log(`${extract.name}: ${version.courses.length} courses`)
  for (const [year, counts] of Object.entries(summarise(version)).sort()) {
    console.log(`  ${year.padEnd(12)} ${String(counts.required).padStart(2)} required (${counts.ects} ECTS) · ${counts.elective} elective`)
  }

  if (!flags.includes('--write')) { console.log('\nDry run. Pass --write to update the catalogue.'); process.exit(0) }

  const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'))
  const programme = catalogue.programmes.find((entry) => entry.id === extract.catalogueId)
  if (!programme) { console.error(`No programme "${extract.catalogueId}" in the catalogue. Add it first.`); process.exit(1) }
  // Newest first, and a re-import replaces rather than duplicates.
  programme.versions = [version, ...programme.versions.filter((entry) => entry.id !== version.id)]
  await writeFile(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`)
  console.log(`\nWrote ${version.id} into ${extract.catalogueId}.`)
}
