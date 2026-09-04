import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearCourseRepositoryCache, discoverCourses, parseCourseRepositorySitemap } from '../lib/course-repository.mjs'

test('the public Course Repository sitemap is reduced to safe discovery records', () => {
  const records = parseCourseRepositorySitemap(`<?xml version="1.0"?><urlset>
    <url><loc>https://courserepository.maastrichtuniversity.nl/p/module/EN/ABC123?name=Human%20Computer%20Interaction</loc><lastmod>2026-08-31</lastmod></url>
    <url><loc>https://unrelated.example/module/unsafe</loc></url>
  </urlset>`, 'modules')
  assert.equal(records.length, 1)
  assert.deepEqual(records[0], {
    id: 'module-ABC123', kind: 'module', code: 'ABC123', title: 'Human Computer Interaction', language: 'EN',
    aliases: [],
    url: 'https://courserepository.maastrichtuniversity.nl/p/module/EN/ABC123?name=Human%20Computer%20Interaction',
    officialUrl: null, lastModified: '2026-08-31', resolved: true, source: 'course-repository'
  })
})

test('programme ids are only published with a verified human name', () => {
  const records = parseCourseRepositorySitemap(`<?xml version="1.0"?><urlset>
    <url><loc>https://courserepository.maastrichtuniversity.nl/p/program/EN/5502</loc></url>
    <url><loc>https://courserepository.maastrichtuniversity.nl/p/program/EN/UNKNOWN</loc></url>
  </urlset>`, 'programmes')
  assert.equal(records[0].title, 'Bachelor Fiscaal Recht')
  assert.equal(records[0].resolved, true)
  assert.equal(records[1].title, null)
  assert.equal(records[1].resolved, false)
})

test('the verified index resolves names and legacy codes without the upstream sitemap', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wicker-courses-'))
  const path = join(dir, 'cache.json')
  const now = new Date('2026-09-04T12:00:00.000Z')
  await writeFile(path, JSON.stringify({ schemaVersion: 2, kinds: {
    programmes: { fetchedAt: null, attemptedAt: now.toISOString(), entries: [], error: 'offline' }
  } }))
  clearCourseRepositoryCache()
  try {
    const named = await discoverCourses({ query: 'Responsible Data Science', kind: 'programmes', path, now })
    assert.equal(named.entries[0].code, '9604')
    const legacy = await discoverCourses({ query: '52451738', kind: 'programmes', path, now })
    assert.equal(legacy.entries[0].title, 'Bachelor of Science in Computer Science')
    const duplicateNames = await discoverCourses({ query: 'Bachelor International Business', kind: 'programmes', path, now })
    assert.equal(duplicateNames.total, 1)
  } finally {
    clearCourseRepositoryCache()
    await rm(dir, { recursive: true, force: true })
  }
})
