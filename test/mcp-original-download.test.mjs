import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadCourseOriginal } from '../mcp/original-download.mjs'

const bytes = Buffer.from([0, 255, 13, 10, ...Buffer.from('complete original, including binary bytes')])
const material = { assetId: 'esa-file', filename: 'Course paper.pdf', courseCode: 'BCS1000', academicYear: '2026-2027', byteSize: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mediaType: 'application/pdf' }
async function fixture(t, { body = bytes, entry = material, status = 200 } = {}) {
  const outputFolder = await mkdtemp(join(tmpdir(), 'mcp-original-test-'))
  t.after(() => rm(outputFolder, { recursive: true, force: true }))
  const requests = []
  return {
    outputFolder, requests,
    call: (overrides = {}) => downloadCourseOriginal({ assetId: material.assetId, courseCode: material.courseCode, academicYear: material.academicYear, outputFolder, ...overrides }, {
      api: async (path, options) => { requests.push({ path, options }); return { materials: entry ? [entry] : [] } },
      apiResponse: async (path, options) => { requests.push({ path, options }); return new Response(body, { status }) }
    })
  }
}
test('original download preserves complete binary bytes, verifies identity, and never overwrites another download', async t => {
  const f = await fixture(t)
  const first = await f.call(), second = await f.call()
  assert.deepEqual(await readFile(first.path), bytes)
  assert.equal(first.sha256, material.sha256)
  assert.equal(first.complete, true)
  assert.notEqual(first.path, second.path)
  assert.equal((await stat(first.path)).mode & 0o777, 0o600)
  assert.deepEqual(f.requests[0].options.query, { courseCode: 'BCS1000', academicYear: '2026-2027' })
  assert.equal(f.requests[1].path, '/api/corpus/assets/esa-file')
  assert.equal(f.requests[1].options.redirect, 'error')
})
test('original download rejects unavailable assets before fetching any bytes', async t => {
  const f = await fixture(t, { entry: null })
  await assert.rejects(f.call(), /not available/)
  assert.equal(f.requests.length, 1)
  assert.deepEqual(await readdir(f.outputFolder), [])
})
test('truncated, oversized, corrupted and partial HTTP responses never leave a successful or partial file', async t => {
  for (const options of [{ body: bytes.subarray(0, 5) }, { body: Buffer.concat([bytes, bytes]) }, { body: Buffer.alloc(bytes.length) }, { status: 206 }]) {
    const f = await fixture(t, options)
    await assert.rejects(f.call())
    assert.deepEqual(await readdir(f.outputFolder), [])
  }
})
test('untrusted original filenames cannot escape the private download directory', async t => {
  const f = await fixture(t, { entry: { ...material, filename: '../../outside.pdf' } })
  const result = await f.call()
  assert.ok(result.path.startsWith(join(f.outputFolder, 'wicker-original-')))
  assert.ok(result.path.endsWith('/outside.pdf'))
  assert.deepEqual(await readFile(result.path), bytes)
})
