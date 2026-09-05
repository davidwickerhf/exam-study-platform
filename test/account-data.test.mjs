import test from 'node:test'
import assert from 'node:assert/strict'
import { exportPersonalData, deletePersonalData, deleteUploadedData } from '../lib/account-data.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { listDocuments, readDocument, writeDocument } from '../lib/user-store.mjs'
import { editorialAssetDeletionDisposition, editorialContributionDeletionDisposition } from '../lib/editorial-workflow.mjs'

test('account erasure retains accepted public contributions but removes every private state', () => {
  assert.equal(editorialContributionDeletionDisposition('accepted'), 'retain-public')
  for (const status of ['private', 'candidate', 'rejected', 'withdrawn']) {
    assert.equal(editorialContributionDeletionDisposition(status), 'remove-private')
  }
})

test('account erasure detaches a reviewed policy asset instead of deleting shared regulation knowledge', () => {
  assert.equal(editorialAssetDeletionDisposition({ remainingContributions: 0, policySources: 1 }), 'retain-shared')
  assert.equal(editorialAssetDeletionDisposition({ remainingContributions: 1, policySources: 0 }), 'retain-shared')
  assert.equal(editorialAssetDeletionDisposition({ remainingContributions: 0, policySources: 0 }), 'delete-orphan')
})

test('account export and deletion stay scoped to the authenticated user', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const deletedUser = `test-delete-${suffix}`
  const retainedUser = `test-retain-${suffix}`

  try {
    await withRequestContext({ userId: deletedUser }, () => writeDocument('study', 'progress', { mastery: 3 }))
    await withRequestContext({ userId: retainedUser }, () => writeDocument('study', 'progress', { mastery: 4 }))

    const exported = await withRequestContext({ userId: deletedUser }, () => exportPersonalData({
      id: deletedUser,
      email: 'student@example.test'
    }))
    assert.equal(exported.schemaVersion, 7)
    assert.equal(exported.account.id, deletedUser)
    assert.equal(exported.account.email, 'student@example.test')
    assert.ok(Array.isArray(exported.activity))
    assert.deepEqual(exported.academics, [])
    assert.deepEqual(exported.courseContentRequests, [])
    assert.deepEqual(exported.editorialContributions, [])

    await withRequestContext({ userId: deletedUser }, () => deletePersonalData())

    assert.deepEqual(
      await withRequestContext({ userId: deletedUser }, () => readDocument('study', 'progress', {})),
      {}
    )
    assert.deepEqual(
      await withRequestContext({ userId: retainedUser }, () => readDocument('study', 'progress', {})),
      { mastery: 4 }
    )
  } finally {
    await withRequestContext({ userId: deletedUser }, () => deletePersonalData())
    await withRequestContext({ userId: retainedUser }, () => deletePersonalData())
  }
})

test('uploaded-data deletion removes every programme upload but preserves the study workspace', async () => {
  const userId = `test-upload-delete-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      await writeDocument('tutor-attachments', 'programme:first:source-a', { id: 'source-a', name: 'notes.pdf', size: 40 })
      await writeDocument('tutor-attachments', 'programme:second:source-b', { id: 'source-b', name: 'whiteboard.jpg', size: 80 })
      await writeDocument('academic-document-register', 'programme:first:transcript', { versions: [{ id: 'v1' }] })
      await writeDocument('academic-document-register', 'programme:second:calendar', { versions: [{ id: 'v2' }] })
      await writeDocument('tutor', 'programme:first:c-kept', { id: 'kept', messages: [] })
      await writeDocument('study', 'kept', { mastery: 4 })
      await writeDocument('tables', 'academic_snapshots', {
        rows: [
          { id: 'snapshot-a', userId, programmeId: 'first', createdAt: new Date().toISOString() },
          { id: 'snapshot-b', userId, programmeId: 'second', createdAt: new Date().toISOString() }
        ]
      })

      const removed = await deleteUploadedData()
      assert.equal(removed.documents, 4)
      assert.equal(removed.academicSnapshots, 2)
      assert.deepEqual(await listDocuments('tutor-attachments'), [])
      assert.deepEqual(await listDocuments('academic-document-register'), [])
      assert.deepEqual(await readDocument('study', 'kept', {}), { mastery: 4 })
      assert.deepEqual(await readDocument('tutor', 'programme:first:c-kept', null), { id: 'kept', messages: [] })
      assert.deepEqual(await readDocument('tables', 'academic_snapshots', { rows: [] }), { rows: [] })
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})
