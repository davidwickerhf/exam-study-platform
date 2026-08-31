import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CanvasCourseImportError, importCanvasCourse, parseCanvasCourseUrl } from '../lib/canvas-course-import.mjs'

function json(value, headers = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

test('Canvas importer downloads and categorises accessible course material without leaking a token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  const calls = []
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input))
    calls.push({ url: url.toString(), authorization: init.headers?.authorization || null })
    if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
    if (url.pathname === '/api/v1/courses/25806') return json({ id: 25806, name: 'Algorithms', course_code: 'CS101' })
    if (url.pathname === '/api/v1/courses/25806/modules') return json([{ id: 5, name: 'Week 1', position: 1, items: [
      { id: 49, type: 'SubHeader', title: 'Orientation', position: 1, indent: 0 },
      { id: 50, type: 'File', title: 'Lecture 1 slides', position: 2, indent: 1, content_id: 10 },
      { id: 51, type: 'Page', title: 'Welcome', position: 3, indent: 1, page_url: 'welcome' },
      { id: 52, type: 'Assignment', title: 'Problem set 1', position: 4, indent: 1, content_id: 20 },
      { id: 53, type: 'ExternalUrl', title: 'Reading list', position: 5, indent: 1, external_url: 'https://library.example.edu/reading-list' }
    ] }])
    if (url.pathname === '/api/v1/courses/25806/files') return json([
      { id: 10, display_name: 'Lecture 1 slides.pdf', url: 'https://files.canvas.test/10' },
      { id: 11, display_name: 'Syllabus.pdf', url: 'https://files.canvas.test/11' }
    ])
    if (url.pathname === '/api/v1/courses/25806/pages/welcome') return json({ title: 'Welcome', body: '<script>alert(1)</script><p>Read this first.</p>', published: true })
    if (url.pathname === '/api/v1/courses/25806/assignments/20') return json({ name: 'Problem set 1', description: '<p>Work individually.</p>', due_at: '2026-09-10', points_possible: 10, submission_types: ['online_upload'], html_url: 'https://canvas.test/courses/25806/assignments/20' })
    if (url.pathname === '/api/v1/courses/25806/files/10') return json({ id: 10, display_name: 'Lecture 1 slides.pdf', url: 'https://files.canvas.test/10' })
    if (url.pathname === '/api/v1/courses/25806/files/11') return json({ id: 11, display_name: 'Syllabus.pdf', url: 'https://files.canvas.test/11' })
    if (url.origin === 'https://files.canvas.test' && url.pathname === '/10') return new Response(Buffer.from('%PDF-lecture'), { status: 200, headers: { 'content-length': '12' } })
    if (url.origin === 'https://files.canvas.test' && url.pathname === '/11') return new Response(Buffer.from('%PDF-syllabus'), { status: 200, headers: { 'content-length': '12' } })
    throw new Error(`Unexpected Canvas request: ${url}`)
  }
  try {
    const result = await importCanvasCourse({
      courseUrl: 'https://canvas.test/courses/25806/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl
    })
    assert.equal(result.course.code, 'CS101')
    assert.equal(result.modules, 1)
    assert.equal(result.downloadedFiles, 2)
    assert.equal(result.resources, 5)
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources.length, 5)
    assert.equal(manifest.skipped.length, 0)
    const written = await readdir(join(root, 'modules', '001 Week 1--module-5', '001 Orientation', 'slides'))
    assert.equal(written.length, 1)
    const welcome = manifest.resources.find((item) => item.kind === 'page')
    const welcomeHtml = await readFile(join(root, welcome.path), 'utf8')
    assert.match(welcomeHtml, /Read this first/)
    assert.doesNotMatch(welcomeHtml, /alert\(1\)/)
    assert.ok(calls.filter((call) => call.url.startsWith('https://canvas.test/api/')).every((call) => call.authorization === 'Bearer local-token-only'))
    assert.ok(calls.filter((call) => call.url.startsWith('https://files.canvas.test/')).every((call) => call.authorization === null))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas course URLs require HTTPS and never carry credentials', () => {
  assert.throws(() => parseCanvasCourseUrl('http://canvas.example.edu/courses/1/modules'), CanvasCourseImportError)
  assert.throws(() => parseCanvasCourseUrl('https://name:password@canvas.example.edu/courses/1/modules'), CanvasCourseImportError)
  assert.deepEqual(parseCanvasCourseUrl('https://canvas.example.edu/courses/1/modules'), { origin: 'https://canvas.example.edu', courseId: '1', courseUrl: 'https://canvas.example.edu/courses/1/modules' })
})

test('Canvas importer distinguishes PAT verification from course access denial', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  try {
    await assert.rejects(() => importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/1/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
        return new Response('', { status: 403 })
      }
    }), (error) => error instanceof CanvasCourseImportError && /HTTP 403.*\/api\/v1\/courses\/1/.test(error.message) && /does not by itself mean the PAT is incorrect/.test(error.message))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas importer keeps accessible module material when the optional Files index is denied', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  try {
    const result = await importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/1/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
        if (url.pathname === '/api/v1/courses/1') return json({ id: 1, name: 'Accessible course', course_code: 'CS101' })
        if (url.pathname === '/api/v1/courses/1/modules') return json([{ id: 10, name: 'Week 1', position: 1, items: [{ id: 11, type: 'Page', title: 'Welcome', position: 1, page_url: 'welcome' }] }])
        if (url.pathname === '/api/v1/courses/1/files') return new Response('', { status: 403 })
        if (url.pathname === '/api/v1/courses/1/pages/welcome') return json({ title: 'Welcome', body: '<p>Accessible through Modules.</p>', published: true })
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.resources, 1)
    assert.ok(result.skipped.some((item) => item.label === 'Course-wide Files listing' && /HTTP 403/.test(item.reason)))
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources[0].kind, 'page')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas importer tolerates an indented item without a preceding module heading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  try {
    const result = await importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/1/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
        if (url.pathname === '/api/v1/courses/1') return json({ id: 1, name: 'Accessible course', course_code: 'CS101' })
        if (url.pathname === '/api/v1/courses/1/modules') return json([{ id: 10, name: 'Week 1', position: 1, items: [{ id: 11, type: 'ExternalUrl', title: 'Course reference', position: 1, indent: 2, external_url: 'https://example.edu/reference' }] }])
        if (url.pathname === '/api/v1/courses/1/files') return json([])
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.resources, 1)
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources[0].kind, 'external-link')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas importer refuses to overwrite a folder that was not created by it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  try {
    await writeFile(join(root, 'my-notes.md'), '# Keep this')
    await assert.rejects(() => importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/1/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl: async () => { throw new Error('The network must not be called') }
    }), (error) => error instanceof CanvasCourseImportError && /new empty output folder/.test(error.message))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
