// The academic record is read once per request.
//
// Loading it costs an index query plus five child-table queries, and a single
// page load asked for it three or four times: programme scoping on /api/state,
// /api/academics itself, and the calendar feed. It cannot change mid-request
// unless this process changes it, so it is memoised against the request's own
// auth object.
//
// The risk a cache adds is staleness, so both halves are pinned here: two reads
// in one request agree, a read after a write in the same request sees the
// write, and two different requests never share a reading.

import test from 'node:test'
import assert from 'node:assert/strict'
import { requestMemo, forgetRequestMemo, withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { emptyAcademicWorkspace, readAcademicState, saveActiveAcademicWorkspace } from '../lib/academics.mjs'

const asNewStudent = (body) => withRequestContext(
  { userId: `memo-${Date.now()}-${Math.random().toString(16).slice(2)}` },
  async () => { try { return await body() } finally { await deleteAllDocuments() } }
)

test('concurrent readers in one request share a single load', async () => {
  let loads = 0
  await withRequestContext({ userId: 'memo-counter' }, async () => {
    const produce = async () => { loads += 1; return { value: loads } }
    const [first, second] = await Promise.all([requestMemo('k', produce), requestMemo('k', produce)])
    assert.equal(loads, 1, 'the second caller joined the in-flight read')
    assert.equal(first, second, 'and got the same reading')
    assert.equal(await requestMemo('k', produce), first)
    forgetRequestMemo('k')
    await requestMemo('k', produce)
    assert.equal(loads, 2, 'forgetting the key forces the next read')
  })
})

test('a failed read is not remembered', async () => {
  await withRequestContext({ userId: 'memo-failure' }, async () => {
    await assert.rejects(() => requestMemo('k', async () => { throw new Error('cold') }))
    assert.deepEqual(await requestMemo('k', async () => ({ ok: true })), { ok: true })
  })
})

test('outside a request nothing is cached', async () => {
  let loads = 0
  const produce = async () => { loads += 1; return loads }
  await requestMemo('k', produce)
  await requestMemo('k', produce)
  assert.equal(loads, 2)
})

test('a write is visible to the next read in the same request', async () => {
  await asNewStudent(async () => {
    const before = await readAcademicState()
    assert.equal(before.workspace.profile.programme, '')
    // The same request reads it again: still the same answer, not a re-read of
    // a record nobody changed.
    assert.equal((await readAcademicState()).workspace.revision, before.workspace.revision)

    await saveActiveAcademicWorkspace({ ...emptyAcademicWorkspace(), profile: { programme: 'BSc Computer Science' } }, before.workspace.revision)

    const after = await readAcademicState()
    assert.equal(after.workspace.profile.programme, 'BSc Computer Science')
    assert.equal(after.workspace.revision, before.workspace.revision + 1)
  })
})

test('what a caller edits does not become what the next caller reads', async () => {
  await asNewStudent(async () => {
    const first = await readAcademicState()
    first.workspace.calendars.push({ id: 'scribble', label: 'Local edit', url: 'https://example.test/x.ics' })
    assert.deepEqual((await readAcademicState()).workspace.calendars, [])
  })
})

test('two requests never share one reading', async () => {
  const alice = `memo-alice-${Date.now()}`
  const bob = `memo-bob-${Date.now()}`
  try {
    await withRequestContext({ userId: alice }, async () => {
      const state = await readAcademicState()
      await saveActiveAcademicWorkspace({ ...emptyAcademicWorkspace(), profile: { programme: 'Alice only' } }, state.workspace.revision)
    })
    assert.equal(
      (await withRequestContext({ userId: bob }, () => readAcademicState())).workspace.profile.programme,
      ''
    )
    // And a second request as Alice re-reads rather than reusing the first.
    assert.equal(
      (await withRequestContext({ userId: alice }, () => readAcademicState())).workspace.profile.programme,
      'Alice only'
    )
  } finally {
    await withRequestContext({ userId: alice }, () => deleteAllDocuments())
    await withRequestContext({ userId: bob }, () => deleteAllDocuments())
  }
})
