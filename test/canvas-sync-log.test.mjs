import test from 'node:test'
import assert from 'node:assert/strict'
import { safeSyncEvent, canvasSyncLog, recordCanvasSyncEvent } from '../lib/canvas-sync-log.mjs'

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
  await recordCanvasSyncEvent({ id: 'job', user_id: 'owner', lease_token: 'lease' }, { stage: 'indexing', message: 'Ready.', completed: 3, total: 3 }, db)
  assert.match(calls[0].text, /user_id=\? AND lease_token=\? AND status='running'/)
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
