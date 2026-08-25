import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteDocument, readDocument, writeDocument } from '../lib/user-store.mjs'

test('personal documents are isolated by authenticated user context', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const alice = `test-alice-${suffix}`
  const bob = `test-bob-${suffix}`

  await withRequestContext({ userId: alice }, () => writeDocument('test', 'progress', { score: 9 }))
  await withRequestContext({ userId: bob }, () => writeDocument('test', 'progress', { score: 2 }))

  assert.deepEqual(await withRequestContext({ userId: alice }, () => readDocument('test', 'progress', {})), { score: 9 })
  assert.deepEqual(await withRequestContext({ userId: bob }, () => readDocument('test', 'progress', {})), { score: 2 })

  await withRequestContext({ userId: alice }, () => deleteDocument('test', 'progress'))
  await withRequestContext({ userId: bob }, () => deleteDocument('test', 'progress'))
})
