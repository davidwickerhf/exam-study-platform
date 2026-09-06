import test from 'node:test'
import assert from 'node:assert/strict'
import { cachedCanvasResponse, canvasCachePartition } from '../lib/canvas-shared-cache.mjs'

function memoryStore() {
  const rows = new Map(), generations = new Map()
  return {
    generation: async user => generations.get(user) || 'initial',
    read: async (user, key, generation) => { const row = rows.get(`${user}:${key}`); return row?.generation === generation ? row : null },
    write: async (user, key, generation, value) => { if (generation === (generations.get(user) || 'initial')) rows.set(`${user}:${key}`, value) },
    invalidate: async user => generations.set(user, String(Number(generations.get(user) || 0) + 1)),
  }
}
const options = { origin: 'https://canvas.example.edu', token: 'private-token', parts: ['assignments'], now: new Date('2026-09-06') }
test('independent instances reuse persisted responses; users, tokens and requested parts stay separate', async () => {
  const store = memoryStore(); let reads = 0
  const produce = async () => ({ count: ++reads, problems: [] })
  const config = { store, userId: 'one' }
  assert.equal((await cachedCanvasResponse(options, produce, config)).count, 1)
  assert.equal((await cachedCanvasResponse(options, produce, config)).count, 1)
  assert.equal((await cachedCanvasResponse(options, produce, { ...config, userId: 'two' })).count, 2)
  assert.equal((await cachedCanvasResponse({ ...options, token: 'replacement' }, produce, config)).count, 3)
  assert.equal((await cachedCanvasResponse({ ...options, parts: ['announcements'] }, produce, config)).count, 4)
})
test('expired, forced and incomplete answers are fetched again', async () => {
  const store = memoryStore(); let reads = 0, time = 1000
  const config = { store, userId: 'one', now: () => time, ttlMs: 100 }
  const produce = async () => ({ count: ++reads, problems: [] })
  await cachedCanvasResponse(options, produce, config)
  time += 101
  assert.equal((await cachedCanvasResponse(options, produce, config)).count, 2)
  assert.equal((await cachedCanvasResponse({ ...options, force: true }, produce, config)).count, 3)
  await store.invalidate('one')
  await cachedCanvasResponse(options, async () => ({ problems: ['offline'] }), config)
  assert.equal((await cachedCanvasResponse(options, produce, config)).count, 4)
})
test('revocation during a fetch cannot repopulate the shared cache or reuse its memory partition', async () => {
  const store = memoryStore(), config = { store, userId: 'one' }
  let oldPartition
  await cachedCanvasResponse(options, async () => {
    oldPartition = canvasCachePartition()
    await store.invalidate('one')
    return { stale: true, problems: [] }
  }, config)
  const result = await cachedCanvasResponse(options, async () => {
    assert.notEqual(canvasCachePartition(), oldPartition)
    return { stale: false, problems: [] }
  }, config)
  assert.equal(result.stale, false)
})
test('cache outages fall back to live data', async () => {
  const store = { generation: async () => { throw new Error('offline') } }
  assert.deepEqual(await cachedCanvasResponse(options, async () => ({ live: true }), { store }), { live: true })
})
