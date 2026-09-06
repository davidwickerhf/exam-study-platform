import test from 'node:test'
import assert from 'node:assert/strict'
import { runWorker } from '../lib/worker-runtime.mjs'
import { withCanvasJobLease } from '../lib/canvas-job-lease.mjs'

test('worker drains sequentially and stops without starting another job', async () => {
  const controller = new AbortController(); let jobs = 0, active = 0
  await runWorker({ signal: controller.signal, processJob: async () => {
    assert.equal(++active, 1)
    await Promise.resolve()
    if (++jobs === 3) controller.abort()
    active--
    return { id: jobs }
  } })
  assert.equal(jobs, 3)
})
test('shutdown interrupts an idle wait immediately', async () => {
  const controller = new AbortController()
  await runWorker({ signal: controller.signal, intervalMs: 60_000, processJob: async () => null,
    onState: state => { if (state === 'idle') controller.abort() } })
})
test('deployment shutdown fences a late task before it writes', async () => {
  const controller = new AbortController(); let release, wrote = false
  const task = withCanvasJobLease(async assertActive => {
    await new Promise(resolve => { release = resolve })
    assertActive(); wrote = true
  }, { signal: controller.signal, renew: async () => true })
  controller.abort()
  await assert.rejects(task, /lease ended/)
  release()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(wrote, false)
})
test('poll failures recover and do not stop the worker', async () => {
  const controller = new AbortController(); let errors = 0, calls = 0
  await runWorker({ signal: controller.signal, intervalMs: 1,
    processJob: async () => { if (++calls === 1) throw new Error('DB unavailable'); controller.abort() },
    onError: () => errors++ })
  assert.equal(errors, 1); assert.equal(calls, 2)
})
