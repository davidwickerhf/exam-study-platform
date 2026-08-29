import test from 'node:test'
import assert from 'node:assert/strict'
import { exportPersonalData, deletePersonalData } from '../lib/account-data.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { readDocument, writeDocument } from '../lib/user-store.mjs'

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
    assert.equal(exported.schemaVersion, 3)
    assert.equal(exported.account.id, deletedUser)
    assert.equal(exported.account.email, 'student@example.test')
    assert.ok(Array.isArray(exported.activity))
    assert.deepEqual(exported.academics, [])

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
