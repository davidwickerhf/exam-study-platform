import test from 'node:test'
import assert from 'node:assert/strict'
import { withCanvasJobLease } from '../lib/canvas-job-lease.mjs'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
test('slow jobs renew ownership and can complete', async () => {
  let renewals = 0
  assert.equal(await withCanvasJobLease(async active => { await delay(30); active(); return 'done' }, { renew: async () => { renewals++; return true }, heartbeatMs: 5, timeoutMs: 200 }), 'done')
  assert.ok(renewals > 0)
})
test('lost ownership fences late material and completion writes', async () => {
  let wrote = false
  await assert.rejects(withCanvasJobLease(async active => { await delay(25); active(); wrote = true }, { renew: async () => false, heartbeatMs: 5, timeoutMs: 200 }), /lease ended/)
  assert.equal(wrote, false)
})
test('hung jobs time out and late tasks cannot write', async () => {
  let wrote = false
  await assert.rejects(withCanvasJobLease(async active => { await delay(30); active(); wrote = true }, { renew: async () => true, heartbeatMs: 5, timeoutMs: 10 }), /time limit/)
  await delay(40)
  assert.equal(wrote, false)
})
test('PDF indexing has a complete expected chunk count for interrupted imports', async () => {
  const { retrievalRecords } = await import('../lib/canvas-corpus-worker.mjs')
  const records = retrievalRecords({ pages: [{ page: 1, text: 'A'.repeat(3200) }, { page: 2, text: 'B'.repeat(200) }] })
  assert.ok(records.length > 2)
  assert.equal(records.at(-1).page, 2)
  assert.equal(records.at(-1).content, 'B'.repeat(200))
})
