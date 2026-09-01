#!/usr/bin/env node
// Folds the course detail scraped from the university's course repository into
// an existing catalogue version: description, coordinator, prerequisites,
// reading, teaching and assessment methods, and the exact teaching window.
//
// Separate from import-curriculum.mjs because the two answer different
// questions. That one asks which courses a programme has; this one asks what
// each course actually is. A programme can have the first without the second.
//
//   node scripts/enrich-curriculum.mjs <catalogueId> <detail.json> [--write]

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGUE = resolve(root, 'data/editorial-programmes.json')

function clean(value, max = 6000) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  // The repository prefixes some descriptions with a redundant label.
  return text.replace(/^Description:\s*/i, '').slice(0, max) || null
}

export function mergeDetail(course, detail) {
  if (!detail) return course
  return {
    ...course,
    description: clean(detail.description),
    coordinator: clean(detail.coordinator, 200),
    department: clean(detail.department, 200),
    prerequisites: clean(detail.prerequisites, 2000),
    reading: clean(detail.reading, 4000),
    teachingMethods: clean(detail.teaching, 300),
    assessmentMethods: clean(detail.assessment, 300),
    startsOn: clean(detail.from, 40),
    endsOn: clean(detail.to, 40)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [catalogueId, detailFile, ...flags] = process.argv.slice(2)
  if (!catalogueId || !detailFile) { console.error('Usage: node scripts/enrich-curriculum.mjs <catalogueId> <detail.json> [--write]'); process.exit(1) }
  const detail = JSON.parse(await readFile(resolve(detailFile), 'utf8'))
  const byCode = new Map(detail.courses.map((entry) => [String(entry.code).toUpperCase(), entry]))
  const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'))
  const programme = catalogue.programmes.find((entry) => entry.id === catalogueId)
  if (!programme) { console.error(`No programme "${catalogueId}".`); process.exit(1) }
  const version = programme.versions[0]

  let enriched = 0
  const missing = []
  version.courses = version.courses.map((course) => {
    const found = byCode.get(course.code.toUpperCase())
    if (!found) { missing.push(course.code); return course }
    enriched++
    return mergeDetail(course, found)
  })

  console.log(`${programme.name} · ${version.id}: ${enriched} of ${version.courses.length} courses enriched`)
  console.log(`  coordinators ${version.courses.filter((c) => c.coordinator).length} · descriptions ${version.courses.filter((c) => c.description).length} · assessment ${version.courses.filter((c) => c.assessmentMethods).length}`)
  if (missing.length) console.log(`  no detail for: ${missing.join(', ')}`)
  if (!flags.includes('--write')) { console.log('\nDry run. Pass --write to update the catalogue.'); process.exit(0) }
  await writeFile(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`)
  console.log('\nWritten.')
}
