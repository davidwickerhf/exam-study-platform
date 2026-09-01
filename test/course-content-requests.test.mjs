import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createCourseContentRequest, deleteOwnCourseContentRequests, getCourseContentRequestFile, listAdminCourseContentRequests, listOwnCourseContentRequests, updateCourseContentRequest, uploadCourseContentRequestFileChunk } from '../lib/course-content-requests.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'

test('course-content requests preserve private sources and advance through the ingestion workflow', async () => {
  const userId = `content-request-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const context = { userId, email: 'student@example.test' }
  try {
    await withRequestContext(context, async () => {
      const created = await createCourseContentRequest({
        programmeId: 'programme-1', academicCourseId: 'course-1', courseCode: 'CS101', courseName: 'Systems', academicYear: '2030-2031', period: 'Period 1',
        categories: ['slides', 'practice'], notes: 'Please cover the current assessment.', urls: ['https://example.test/syllabus'],
        files: [{ name: 'slides.pdf', type: 'application/pdf', base64: Buffer.from('example source').toString('base64') }]
      }, { requesterEmail: context.email })
      assert.equal(created.created, true)
      assert.equal(created.request.status, 'submitted')
      assert.equal(created.request.pipelineStage, 'collection')
      assert.equal(created.request.files.length, 1)
      assert.equal(created.request.contributionConsent, false)

      const augmented = await createCourseContentRequest({ academicCourseId: 'course-1', courseCode: 'CS101', courseName: 'Systems', categories: ['exams'], notes: 'I found a mock exam.', contributionConsent: true, contributionLicense: 'own-notes' })
      assert.equal(augmented.created, false)
      assert.deepEqual(augmented.request.categories, ['slides', 'practice', 'exams'])
      assert.match(augmented.request.notes, /Additional submission/)
      assert.equal(augmented.request.contributionConsent, true)
      assert.equal(augmented.request.contributionLicense, 'own-notes')

      const own = await listOwnCourseContentRequests({ courseId: 'course-1' })
      assert.equal(own.length, 1)
      const stored = await getCourseContentRequestFile(own[0].id, own[0].files[0].id)
      assert.equal(stored.data.toString(), 'example source')

      const chunked = Buffer.alloc(600 * 1024, 7)
      const sha256 = createHash('sha256').update(chunked).digest('hex')
      const chunks = [chunked.subarray(0, 512 * 1024), chunked.subarray(512 * 1024)]
      const firstChunk = await uploadCourseContentRequestFileChunk(own[0].id, { fileId: sha256, name: 'tutorials.pdf', type: 'application/pdf', size: chunked.length, sha256, chunkIndex: 0, totalChunks: 2, base64: chunks[0].toString('base64') })
      assert.equal(firstChunk.complete, false)
      const lastChunk = await uploadCourseContentRequestFileChunk(own[0].id, { fileId: sha256, name: 'tutorials.pdf', type: 'application/pdf', size: chunked.length, sha256, chunkIndex: 1, totalChunks: 2, base64: chunks[1].toString('base64') })
      assert.equal(lastChunk.complete, true)
      assert.equal((await getCourseContentRequestFile(own[0].id, sha256)).data.length, chunked.length)

      const reviewed = await updateCourseContentRequest(own[0].id, { status: 'in-progress', pipelineStage: 'retrieval', adminNote: 'Sources extracted.' })
      assert.equal(reviewed.pipelineStage, 'retrieval')
      assert.equal((await listAdminCourseContentRequests())[0].adminNote, 'Sources extracted.')
      assert.equal(Object.hasOwn((await listOwnCourseContentRequests({ courseId: 'course-1' }))[0], 'adminNote'), false)
    })
  } finally {
    await withRequestContext(context, () => deleteOwnCourseContentRequests())
    await withRequestContext(context, () => deleteAllDocuments())
  }
})

test('course-content requests reject unsafe or oversized source types', async () => {
  const context = { userId: `content-request-invalid-${Date.now()}` }
  try {
    await withRequestContext(context, () => assert.rejects(
      createCourseContentRequest({ academicCourseId: 'course-1', courseName: 'Systems', files: [{ name: 'script.html', type: 'text/html', base64: Buffer.from('<script>').toString('base64') }] }),
      /Unsupported material file/
    ))
  } finally {
    await withRequestContext(context, () => deleteOwnCourseContentRequests())
    await withRequestContext(context, () => deleteAllDocuments())
  }
})
