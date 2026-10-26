import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { hostedQueue, queueDispatcherOrigin } from '../lib/queue-runtime.mjs'
import { QUEUES, CANVAS_DISPATCH_QUEUE } from '../lib/job-queue.mjs'
import { CANVAS_QUEUE_TOPIC, STUDY_QUEUE_TOPIC } from '../lib/canvas-queue-protocol.mjs'
import { processCanvasQueueMessage } from '../lib/canvas-queue-consumer.mjs'

test('self-hosted pg-boss mode delegates background work like Vercel did', () => {
  assert.equal(hostedQueue({}), false)
  assert.equal(hostedQueue({ VERCEL: '1' }), true)
  assert.equal(hostedQueue({ WICKER_QUEUE_BACKEND: 'pg-boss' }), true)
})

test('the API wakes the internal web dispatcher when one is configured', () => {
  assert.equal(queueDispatcherOrigin({ WICKER_QUEUE_DISPATCHER_URL: 'http://web:3000/' }), 'http://web:3000')
  assert.equal(queueDispatcherOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'study.wicker.life' }), 'https://study.wicker.life')
})

test('queue policies keep the former Vercel trigger limits', () => {
  assert.equal(QUEUES[CANVAS_QUEUE_TOPIC].concurrency, 2)
  assert.equal(QUEUES[STUDY_QUEUE_TOPIC].concurrency, 1)
  assert.equal(QUEUES[CANVAS_QUEUE_TOPIC].options.expireInSeconds, 300)
  assert.equal(QUEUES[STUDY_QUEUE_TOPIC].options.expireInSeconds, 900)
  for (const topic of [CANVAS_QUEUE_TOPIC, STUDY_QUEUE_TOPIC]) {
    assert.equal(QUEUES[topic].options.retryDelay, 15)
    assert.equal(QUEUES[topic].options.retryDelayMax, 300)
  }
  assert.equal(QUEUES[CANVAS_DISPATCH_QUEUE].options.retryLimit, 0)
})

test('malformed queue messages are dropped instead of retried forever', async () => {
  const original = console.error
  console.error = () => {}
  try { assert.deepEqual(await processCanvasQueueMessage({ version: 1, jobId: '../etc' }), { invalid: true }) }
  finally { console.error = original }
})

test('no Vercel Queue or Neon driver imports remain', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['@vercel/queue', '@neondatabase/serverless']) {
    assert.equal(pkg.dependencies[name], undefined)
    assert.equal(pkg.devDependencies?.[name], undefined)
  }
  const runtime = JSON.parse(await readFile(new URL('../deploy/runtime/package.json', import.meta.url), 'utf8'))
  assert.equal(runtime.dependencies['@neondatabase/serverless'], undefined)
  assert.ok(runtime.dependencies.pg)
})
