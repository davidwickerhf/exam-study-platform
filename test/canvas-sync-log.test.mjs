import test from 'node:test'
import assert from 'node:assert/strict'
import { safeSyncEvent, canvasSyncLog, createCanvasSyncLogger } from '../lib/canvas-sync-log.mjs'

function database(jobs = [], events = []) {
  const calls = []
  const db = async (strings, ...values) => {
    const text = strings.join('?'); calls.push({ text, values })
    return text.includes('SELECT j.id,') ? jobs : text.includes('SELECT e.id::text') ? events : []
  }
  return { db, calls }
}
test('progress payloads bound counts and redact links, credentials and control characters', () => {
  const event = safeSyncEvent({ stage: 'download', message: 'Bearer secret\nhttps://canvas.test/file?token=private', item: 'access_token=abc syllabus.pdf', completed: Infinity, total: -1, unexpected: 'private' })
  assert.equal(event.message, '[redacted] [link]')
  assert.equal(event.item, '[redacted] syllabus.pdf')
  assert.equal(event.completed, null)
  assert.equal(event.total, null)
  assert.equal(event.unexpected, undefined)
  assert.throws(() => safeSyncEvent({ stage: 'unrecognised' }))
})
test('log writes require the same account and current running lease', async () => {
  const { db, calls } = database()
  const logger = createCanvasSyncLogger({ id: 'job', user_id: 'owner', lease_token: 'lease' }, { database: db })
  logger.record({ stage: 'indexing', message: 'Ready.', completed: 3, total: 3 })
  await logger.finish()
  assert.match(calls[0].text, /j.user_id=\? AND j.lease_token=\? AND j.status='running'/)
  assert.deepEqual(calls[0].values.slice(-3), ['job', 'owner', 'lease'])
})
test('log reads enforce account and edition access, filter stages and paginate without numeric precision loss', async () => {
  const events = Array.from({ length: 101 }, (_, i) => ({ id: String(9007199254742000n - BigInt(i)) }))
  const { db, calls } = database([{ id: 'job' }], events)
  const result = await canvasSyncLog({ accountId: 'owner', jobId: 'job', before: '9007199254743000', stage: 'rules', level: 'attention', database: db })
  assert.equal(result.events.length, 100)
  assert.equal(result.nextCursor, events[99].id)
  for (const call of calls) { assert.match(call.text, /j.user_id=\?/); assert.match(call.text, /canvas_corpus_access/); assert.ok(call.values.includes('owner')) }
  assert.ok(calls[1].values.includes('rules'))
  assert.ok(calls[1].values.includes('9007199254743000'))
  assert.match(calls[1].text, /e.level IN \('warning', 'error'\)/)
})
test('an inaccessible selected job reveals no events', async () => {
  const { db, calls } = database([])
  await assert.rejects(canvasSyncLog({ accountId: 'owner', jobId: 'foreign', database: db }), /not found/)
  assert.equal(calls.length, 1)
})
test('invalid requests fail before querying and local mode explains unavailable logging', async () => {
  const { db, calls } = database()
  for (const options of [{}, { accountId: 'owner', before: '1;DROP' }, { accountId: 'owner', before: '9999999999999999999' }, { accountId: 'owner', stage: 'secrets' }, { accountId: 'owner', level: 'all' }]) {
    await assert.rejects(canvasSyncLog({ ...options, database: db }))
  }
  assert.equal(calls.length, 0)
  assert.equal((await canvasSyncLog({ accountId: 'local', database: null })).available, false)
})


test('hundreds of progress events enqueue synchronously and flush in one ordered batch', async () => {
  const calls = []
  let release
  const database = (strings, ...values) => { calls.push({ text: strings.join('?'), values }); return new Promise(resolve => { release = resolve }) }
  const logger = createCanvasSyncLogger({ id: 'job', user_id: 'owner', lease_token: 'lease' }, { database, flushMs: 60000 })
  for (let i = 0; i < 500; i++) assert.equal(logger.record({ stage: 'indexing', message: `Passage ${i}`, completed: i }), undefined)
  assert.equal(calls.length, 0)
  const finishing = logger.finish()
  assert.equal(calls.length, 1)
  const batch = JSON.parse(calls[0].values[0])
  assert.equal(batch.length, 500)
  assert.equal(batch[499].sequence, 499)
  assert.ok(batch.every(event => !Number.isNaN(Date.parse(event.createdAt))))
  assert.match(calls[0].text, /ORDER BY e.sequence/)
  release([])
  await finishing
})
test('buffer overflow is bounded and represented by an explicit warning', async () => {
  const { db, calls } = database()
  const logger = createCanvasSyncLogger({ id: 'job' }, { database: db, maxBuffered: 2, flushMs: 60000 })
  for (let i = 0; i < 5; i++) logger.record({ stage: 'download', message: 'Downloaded.' })
  await logger.finish()
  const batch = JSON.parse(calls[0].values[0])
  assert.equal(batch.length, 3)
  assert.equal(batch[2].level, 'warning')
  assert.equal(batch[2].completed, 3)
})
test('closing a stopped worker discards buffered events and prevents late records', async () => {
  const { db, calls } = database()
  const logger = createCanvasSyncLogger({ id: 'job' }, { database: db, flushMs: 60000 })
  logger.record({ stage: 'download', message: 'Downloaded.' })
  logger.close()
  logger.record({ stage: 'indexing', message: 'Late event.' })
  await logger.finish()
  assert.equal(calls.length, 0)
})
test('finish drains an in-flight write and the final buffered batch', async () => {
  const calls = []
  let release, started
  const firstWrite = new Promise(resolve => { started = resolve })
  const database = (strings, ...values) => {
    calls.push(values)
    if (calls.length === 1) { started(); return new Promise(resolve => { release = resolve }) }
    return Promise.resolve([])
  }
  const logger = createCanvasSyncLogger({ id: 'job' }, { database, flushMs: 5 })
  logger.record({ stage: 'download', message: 'First.' })
  // Keep a referenced handle while the logger's production timer is unref'd.
  const keepAlive = setTimeout(() => {}, 1000)
  await firstWrite
  logger.record({ stage: 'indexing', message: 'Last.' })
  const finishing = logger.finish()
  release([])
  await finishing
  clearTimeout(keepAlive)
  assert.equal(calls.length, 2)
  assert.equal(JSON.parse(calls[1][0])[0].message, 'Last.')
})
