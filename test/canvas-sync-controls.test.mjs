import test from 'node:test'
import assert from 'node:assert/strict'
import { controlCanvasSyncJob } from '../lib/course-corpus.mjs'
import { withCanvasJobLease } from '../lib/canvas-job-lease.mjs'

function database({ owned = true, enabled = true, inserted = true } = {}) {
  const transactions = []
  const queries = []
  const db = (strings, ...values) => {
    const text = strings.join('?')
    const query = { text, values, then(resolve) {
      if (text.startsWith('SELECT j.*')) resolve(owned ? [{ id: 'old', user_id: 'owner', binding_id: 'edition-2025', origin: 'https://canvas.example.org', payload: { stage: 'priorities' } }] : [])
      else if (text.startsWith('SELECT collection_enabled')) resolve([{ collection_enabled: enabled }])
      else throw new Error('A mutation escaped the transaction')
    } }
    queries.push(query)
    return query
  }
  db.transaction = async (items) => { transactions.push(items); return items.map((query) => query.text.includes('INSERT INTO') ? inserted ? [{ id: 'new' }] : [] : query.text.includes('UPDATE canvas_sync_jobs') ? [{ id: 'old' }] : []) }
  return { db, transactions, queries }
}

test('a per-edition retry revokes the old lease, unpauses and creates a separate audited attempt atomically', async () => {
  const { db, transactions } = database()
  const result = await controlCanvasSyncJob({ database: db, accountId: 'owner', jobId: 'old', action: 'retry' })
  assert.equal(result.queued, true)
  assert.equal(result.jobId, 'new')
  assert.equal(transactions.length, 1)
  const [pause, stop, retry] = transactions[0]
  assert.deepEqual(pause.values, [false, 'owner', 'edition-2025'])
  assert.match(stop.text, /lease_token=null/)
  assert.deepEqual(stop.values, ['old', 'owner'])
  assert.ok(retry.values.some((value) => typeof value === 'string' && value.includes('"retryOf":"old"') && value.includes('"stage":"priorities"')))
  assert.match(retry.text, /p.collection_enabled=true/)
  assert.match(retry.text, /ON CONFLICT DO NOTHING/)
})

test('stop pauses only the selected accessible edition and does not queue another job', async () => {
  const { db, transactions } = database()
  const result = await controlCanvasSyncJob({ database: db, accountId: 'owner', jobId: 'old', action: 'stop' })
  assert.equal(result.stopped, true)
  assert.equal(result.queued, false)
  assert.equal(transactions[0].length, 2)
  assert.deepEqual(transactions[0][0].values, [true, 'owner', 'edition-2025'])
})

test('foreign jobs and revoked collection consent cannot trigger mutations', async () => {
  for (const options of [{ owned: false }, { enabled: false }]) {
    const { db, transactions } = database(options)
    await assert.rejects(() => controlCanvasSyncJob({ database: db, accountId: 'owner', jobId: 'other', action: 'retry' }), /not found|Enable material/)
    assert.equal(transactions.length, 0)
  }
})

test('a competing existing job makes retry an idempotent no-op', async () => {
  const { db } = database({ inserted: false })
  assert.equal((await controlCanvasSyncJob({ database: db, accountId: 'owner', jobId: 'old', action: 'retry' })).queued, false)
})

test('stopping a hung task releases its worker slot at the next heartbeat', async () => {
  const started = Date.now()
  await assert.rejects(withCanvasJobLease(() => new Promise(() => {}), { renew: async () => false, heartbeatMs: 5, timeoutMs: 500 }), /lease ended/)
  assert.ok(Date.now() - started < 400)
})
