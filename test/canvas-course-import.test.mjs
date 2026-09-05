import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CanvasCourseImportError, filterCanvasCourses, importCanvasCourse, listCanvasCourseModules, listCanvasCourses, parseCanvasCourseUrl } from '../lib/canvas-course-import.mjs'

function json(value, headers = {}) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

test('Canvas importer downloads and categorises accessible course material without leaking a token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  const calls = []
  const progress = []
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
    if (url.pathname === '/api/v1/courses/25806/assignments') return json([{ id: 20 }])
    if (url.pathname === '/api/v1/courses/25806/quizzes') return json([])
    if (url.pathname === '/api/v1/courses/25806/discussion_topics') return json([])
    if (url.pathname === '/api/v1/courses/25806/pages') return json([
      { url: 'welcome', title: 'Welcome' },
      { url: 'reading-guide', title: 'Standalone reading guide' }
    ])
    if (url.pathname === '/api/v1/courses/25806/pages/welcome') return json({ title: 'Welcome', body: '<script>alert(1)</script><p>Read this first.</p>', published: true })
    if (url.pathname === '/api/v1/courses/25806/pages/reading-guide') return json({ title: 'Standalone reading guide', body: '<p>This page is published outside Modules.</p>', published: true })
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
      fetchImpl, onProgress: event => progress.push(event)
    })
    assert.equal(progress[0].stage, 'discovery')
    assert.equal(progress.filter(event => event.message === 'File downloaded.').length, 2)
    assert.ok(progress.some(event => event.message === 'Reading Canvas page.'))
    assert.doesNotMatch(JSON.stringify(progress), /local-token-only|https:/)
    assert.equal(result.course.code, 'CS101')
    assert.equal(result.modules, 1)
    assert.equal(result.downloadedFiles, 2)
    assert.equal(result.resources, 7)
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources.length, 7)
    assert.equal(manifest.skipped.length, 0)
    const written = await readdir(join(root, 'modules', '001 Week 1--module-5', '001 Orientation', 'slides'))
    assert.equal(written.length, 1)
    const welcome = manifest.resources.find((item) => item.kind === 'page')
    const welcomeHtml = await readFile(join(root, welcome.path), 'utf8')
    assert.match(welcomeHtml, /Read this first/)
    assert.doesNotMatch(welcomeHtml, /alert\(1\)/)
    const standalone = manifest.resources.find((item) => item.kind === 'page' && item.id === 'reading-guide')
    assert.match(await readFile(join(root, standalone.path), 'utf8'), /published outside Modules/)
    assert.ok(calls.filter((call) => call.url.startsWith('https://canvas.test/api/')).every((call) => call.authorization === 'Bearer local-token-only'))
    assert.ok(calls.filter((call) => call.url.startsWith('https://files.canvas.test/')).every((call) => call.authorization === null))
    assert.ok(calls.some((call) => {
      const url = new URL(call.url)
      return url.pathname === '/api/v1/courses/25806' && url.searchParams.getAll('include[]').includes('syllabus_body')
    }))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas importer captures the separate syllabus and accessible course-wide assessments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  try {
    const result = await importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/8/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
        if (url.pathname === '/api/v1/courses/8') return json({ id: 8, name: 'Assessment-led course', course_code: 'CS208', syllabus_body: '<p>Pass with <a href="/courses/8/files/80/download">the course manual</a>.</p>' })
        if (url.pathname === '/api/v1/courses/8/modules') return json([])
        if (url.pathname === '/api/v1/courses/8/files') return json([{ id: 80, display_name: 'Course manual.pdf', url: 'https://files.canvas.example.edu/80' }])
        if (url.pathname === '/api/v1/courses/8/files/80') return json({ id: 80, display_name: 'Course manual.pdf', url: 'https://files.canvas.example.edu/80' })
        if (url.pathname === '/api/v1/courses/8/assignments') return json([{ id: 81, name: 'Project', description: '<p>Submit before the deadline.</p>', due_at: '2026-10-01', points_possible: 30, submission_types: ['online_upload'], html_url: 'https://canvas.example.edu/courses/8/assignments/81' }])
        if (url.pathname === '/api/v1/courses/8/quizzes') return json([{ id: 82, title: 'Final quiz', description: '<p>Closed-book.</p>', points_possible: 70, html_url: 'https://canvas.example.edu/courses/8/quizzes/82' }])
        if (url.pathname === '/api/v1/courses/8/quizzes/82/questions') return json([{ id: 1, question_name: 'Question one', question_text: '<p>Explain the method.</p>', points_possible: 7 }])
        if (url.pathname === '/api/v1/courses/8/discussion_topics') return json([])
        if (url.origin === 'https://files.canvas.example.edu' && url.pathname === '/80') return new Response(Buffer.from('manual'), { status: 200, headers: { 'content-length': '6' } })
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.downloadedFiles, 1)
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.schemaVersion, 2)
    assert.equal(manifest.resources.filter((item) => item.kind === 'syllabus').length, 1)
    assert.equal(manifest.resources.filter((item) => item.kind === 'assignment').length, 1)
    assert.equal(manifest.resources.filter((item) => item.kind === 'quiz').length, 1)
    assert.equal(manifest.resources.filter((item) => item.kind === 'quiz-questions').length, 1)
    assert.equal(manifest.resources.filter((item) => item.kind === 'file').length, 1)
    const syllabusIndex = manifest.resources.find((item) => item.kind === 'link-index' && item.page.includes('Syllabus'))
    assert.ok(syllabusIndex.links.some((link) => link.kind === 'canvas-file' && link.fileId === '80'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Canvas course URLs require HTTPS and never carry credentials', () => {
  assert.throws(() => parseCanvasCourseUrl('http://canvas.example.edu/courses/1/modules'), CanvasCourseImportError)
  assert.throws(() => parseCanvasCourseUrl('https://name:password@canvas.example.edu/courses/1/modules'), CanvasCourseImportError)
  assert.deepEqual(parseCanvasCourseUrl('https://canvas.example.edu/courses/1/modules'), { origin: 'https://canvas.example.edu', courseId: '1', courseUrl: 'https://canvas.example.edu/courses/1/modules' })
})

test('Canvas course discovery includes prior terms and searches title initials', async () => {
  const result = await listCanvasCourses({
    canvasUrl: 'https://canvas.example.edu',
    accessToken: 'local-token-only',
    fetchImpl: async (input) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
      if (url.pathname === '/api/v1/users/self/courses') return json([
        { id: 10, name: 'Intelligent User Interfaces (2024-2025-100-BCS2130)', course_code: 'BCS2130', workflow_state: 'completed', term: { id: 2, name: '2024_100 Period 1' }, enrollments: [{ type: 'StudentEnrollment', enrollment_state: 'completed' }] },
        { id: 11, name: 'Algorithmic Design (2025-2026-500-BCS1540)', course_code: 'BCS1540', workflow_state: 'available', term: { id: 3, name: '2025_500 Period 5' } }
      ])
      throw new Error(`Unexpected Canvas request: ${url}`)
    }
  })
  assert.equal(result.courses.length, 2)
  assert.equal(filterCanvasCourses(result.courses, 'IUI')[0].id, '10')
  assert.equal(filterCanvasCourses(result.courses, 'Algorithmic Design')[0].id, '11')
  assert.equal(result.courses[0].courseUrl, 'https://canvas.example.edu/courses/10/modules')
})

test('Canvas module discovery returns compact module choices for the local archive UI', async () => {
  const result = await listCanvasCourseModules({
    courseUrl: 'https://canvas.example.edu/courses/10/modules',
    accessToken: 'local-token-only',
    fetchImpl: async (input) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
      if (url.pathname === '/api/v1/courses/10') return json({ id: 10, name: 'Algorithms', course_code: 'CS101', workflow_state: 'available', syllabus_body: '<p>Course syllabus_CS101.pdf</p>' })
      if (url.pathname === '/api/v1/courses/10/modules') return json([{ id: 9, name: 'Week 1', position: 1, items: [
        { id: 20, title: 'Slides', type: 'File', content_id: 30 },
        { id: 21, title: 'CS101 course manual 2026.pdf', type: 'File', content_id: 31 },
        { id: 22, title: 'Syllabus discussion', type: 'Discussion', content_id: 32 }
      ] }])
      throw new Error(`Unexpected Canvas request: ${url}`)
    }
  })
  assert.equal(result.course.courseCode, 'CS101')
  assert.deepEqual(result.modules, [{ id: '9', name: 'Week 1', position: 1, items: [
    { id: '20', title: 'Slides', type: 'File', indent: 0, contentId: '30', pageSlug: null, url: null },
    { id: '21', title: 'CS101 course manual 2026.pdf', type: 'File', indent: 0, contentId: '31', pageSlug: null, url: null },
    { id: '22', title: 'Syllabus discussion', type: 'Discussion', indent: 0, contentId: '32', pageSlug: null, url: null }
  ] }])
})

test('a Canvas syllabus field that only names a file is reported as a pointer, not as the rules', async () => {
  const course = (syllabus) => async (input) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1 })
    if (url.pathname === '/api/v1/courses/10') return json({ id: 10, name: 'Algorithms', course_code: 'CS101', workflow_state: 'available', syllabus_body: syllabus })
    if (url.pathname === '/api/v1/courses/10/modules') return json([{ id: 9, name: 'Week 1', position: 1, items: [
      { id: 21, title: 'CS101 course manual 2026.pdf', type: 'File', content_id: 31 },
      { id: 22, title: 'Syllabus discussion', type: 'Discussion', content_id: 32 },
      { id: 23, title: 'Lecture 1', type: 'File', content_id: 33 }
    ] }])
    throw new Error(`Unexpected Canvas request: ${url}`)
  }
  const opts = { courseUrl: 'https://canvas.example.edu/courses/10/modules', accessToken: 'local-token-only' }

  // A bare filename typed into the Syllabus page is text, not a link, so there
  // is nothing to fetch from it — the readable copy is the module item.
  const pointer = await listCanvasCourseModules({ ...opts, fetchImpl: course('<p>Course syllabus_CS101.pdf</p>') })
  assert.equal(pointer.syllabus.substantive, false)
  assert.match(pointer.syllabus.note, /requirements document is a module item/)
  // The module item that carries the rules is named, and unreadable item types
  // are not: a discussion called "Syllabus" is not the course manual.
  assert.deepEqual(pointer.requirementItems.map((item) => [item.title, item.source]), [['CS101 course manual 2026.pdf', 'module']])

  // The document is usually linked from the Syllabus page rather than typed
  // into it, which is the case on every real course checked.
  const linked = await listCanvasCourseModules({ ...opts, fetchImpl: course('<p><a href="https://cdn.example/um.css">style</a><a href="/courses/10/files/6604139">Course syllabus_CS101.pdf</a></p>') })
  assert.equal(linked.syllabus.substantive, false)
  assert.match(linked.syllabus.note, /links to the document/)
  assert.deepEqual(linked.requirementItems.map((item) => [item.title, item.type, item.contentId, item.source]),
    [['Course syllabus_CS101.pdf', 'File', '6604139', 'syllabus-page'], ['CS101 course manual 2026.pdf', 'File', '31', 'module']],
    'the Syllabus-page document comes first, and a stylesheet is not a document')

  // Maastricht pre-fills every course with a link to a how-to guide. A course
  // still carrying it has published nothing.
  const template = await listCanvasCourseModules({ ...opts, fetchImpl: course('<p><a href="https://scribehow.com/viewer/How_to_Embed_Your_Course_Syllabus_in_Canvas__wY-vqD">Embed the course syllabus</a></p>') })
  assert.equal(template.syllabus.placeholder, true)
  assert.equal(template.syllabus.substantive, false)
  assert.match(template.syllabus.note, /empty syllabus template/)
  assert.deepEqual(template.requirementItems.map((item) => item.title), ['CS101 course manual 2026.pdf'], 'the placeholder link is never offered as the syllabus')

  const empty = await listCanvasCourseModules({ ...opts, fetchImpl: course('') })
  assert.equal(empty.syllabus.text, null)
  assert.match(empty.syllabus.note, /no Canvas syllabus text; the requirements document is a module item/)
  assert.deepEqual(empty.requirementItems.map((item) => item.source), ['module'])

  const real = await listCanvasCourseModules({ ...opts, fetchImpl: course(`<p>${'Assessment: 60% exam, 40% coursework. '.repeat(12)}</p><script>alert(1)</script>`) })
  assert.equal(real.syllabus.substantive, true)
  assert.equal(real.syllabus.note, null)
  assert.ok(!/script/i.test(real.syllabus.html), 'the syllabus is institution HTML and must be sanitised')
  assert.match(real.syllabus.text, /60% exam/)
})

test('Canvas importer follows linked Canvas pages and files while compiling every page URL', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-canvas-import-'))
  const calls = []
  try {
    const result = await importCanvasCourse({
      courseUrl: 'https://canvas.example.edu/courses/1/modules',
      accessToken: 'local-token-only',
      outputFolder: root,
      moduleIds: ['10'],
      fetchImpl: async (input) => {
        const url = new URL(String(input))
        calls.push(url.pathname)
        if (url.pathname === '/api/v1/users/self/profile') return json({ id: 1, name: 'Canvas learner' })
        if (url.pathname === '/api/v1/courses/1') return json({ id: 1, name: 'Algorithms', course_code: 'CS101' })
        if (url.pathname === '/api/v1/courses/1/modules') return json([
          { id: 10, name: 'Week 1', position: 1, items: [{ id: 11, type: 'Page', title: 'Past papers', position: 1, page_url: 'past-papers' }] },
          { id: 20, name: 'Do not select', position: 2, items: [{ id: 21, type: 'Page', title: 'Do not read', position: 1, page_url: 'not-selected' }] }
        ])
        if (url.pathname === '/api/v1/courses/1/files') return new Response('', { status: 403 })
        if (url.pathname === '/api/v1/courses/1/assignments') return json([])
        if (url.pathname === '/api/v1/courses/1/quizzes') return json([])
        if (url.pathname === '/api/v1/courses/1/discussion_topics') return json([])
        if (url.pathname === '/api/v1/courses/1/pages/past-papers') return json({ title: 'Past papers', published: true, body: '<p><a href="/courses/1/files/50/download?wrap=1">Exam pack</a> <a href="/courses/1/pages/more-papers">More papers</a> <a href="https://library.example.edu/archive">Library archive</a></p>' })
        if (url.pathname === '/api/v1/courses/1/pages/more-papers') return json({ title: 'More papers', published: true, body: '<a href="/courses/1/files/51/download">Old exam</a>' })
        if (url.pathname === '/api/v1/courses/1/files/50') return json({ id: 50, display_name: 'Exam pack.pdf', url: 'https://files.canvas.example.edu/50' })
        if (url.pathname === '/api/v1/courses/1/files/51') return json({ id: 51, display_name: 'Old exam.pdf', url: 'https://files.canvas.example.edu/51' })
        if (url.origin === 'https://files.canvas.example.edu') return new Response(Buffer.from('file'), { status: 200, headers: { 'content-length': '4' } })
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.modules, 1)
    assert.equal(result.downloadedFiles, 2)
    assert.ok(!calls.includes('/api/v1/courses/1/pages/not-selected'))
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.deepEqual(manifest.selection, { moduleIds: ['10'] })
    assert.equal(manifest.resources.filter((item) => item.kind === 'page').length, 2)
    assert.equal(manifest.resources.filter((item) => item.kind === 'file').length, 2)
    const index = manifest.resources.find((item) => item.kind === 'link-index' && item.id === 'links-page-past-papers')
    assert.ok(index.links.some((link) => link.url === 'https://library.example.edu/archive'))
    assert.ok(index.links.some((link) => link.kind === 'canvas-file' && link.fileId === '50'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
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
        if (url.pathname === '/api/v1/courses/1/files') throw new Error('GET /api/integrations/canvas/proxy → 400: Canvas denied access to /api/v1/courses/1/files. Check that this account can open the course.')
        if (url.pathname === '/api/v1/courses/1/assignments') return json([])
        if (url.pathname === '/api/v1/courses/1/quizzes') return json([])
        if (url.pathname === '/api/v1/courses/1/discussion_topics') return json([])
        if (url.pathname === '/api/v1/courses/1/pages/welcome') return json({ title: 'Welcome', body: '<p>Accessible through Modules.</p>', published: true })
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.resources, 2)
    assert.ok(result.skipped.some((item) => item.label === 'Course-wide Files listing' && /Canvas denied access/.test(item.reason)))
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources.filter((item) => item.kind === 'page').length, 1)
    assert.equal(manifest.resources.filter((item) => item.kind === 'course-overview').length, 1)
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
        if (url.pathname === '/api/v1/courses/1/assignments') return json([])
        if (url.pathname === '/api/v1/courses/1/quizzes') return json([])
        if (url.pathname === '/api/v1/courses/1/discussion_topics') return json([])
        throw new Error(`Unexpected Canvas request: ${url}`)
      }
    })
    assert.equal(result.resources, 2)
    const manifest = JSON.parse(await readFile(join(root, '.wicker-canvas-import.json'), 'utf8'))
    assert.equal(manifest.resources.filter((item) => item.kind === 'external-link').length, 1)
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
