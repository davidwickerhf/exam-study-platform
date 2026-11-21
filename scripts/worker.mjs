#!/usr/bin/env node
// pg-boss worker: replaces the Vercel Queue consumers and the every-minute
// Vercel Cron. Run exactly one replica (concurrency limits are per process):
//   npm run worker
// Needs DATABASE_URL, WICKER_API_SERVICE_URL (e.g. http://api:8080) and
// CANVAS_CONNECTION_ENCRYPTION_KEY (signs requests to the API service).
import '../lib/env.mjs'
import { createServer } from 'node:http'
import { CANVAS_QUEUE_TOPIC, STUDY_QUEUE_TOPIC } from '../lib/canvas-queue-protocol.mjs'
import { createBoss, ensureQueues, QUEUES, CANVAS_DISPATCH_QUEUE } from '../lib/job-queue.mjs'
import { processCanvasQueueMessage } from '../lib/canvas-queue-consumer.mjs'
import { runDispatchSweep } from '../lib/canvas-queue-client.mjs'

if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('The pg-boss worker runs on a long-lived host, not on Vercel.')
for (const name of ['DATABASE_URL', 'WICKER_API_SERVICE_URL', 'CANVAS_CONNECTION_ENCRYPTION_KEY'])
  if (!process.env[name]) throw new Error(`${name} is required for the worker.`)

const boss = createBoss({ role: 'worker' })
await boss.start({ attempts: 10 })
await ensureQueues(boss)

const step = async ([job]) => processCanvasQueueMessage(job.data)
await boss.work(CANVAS_QUEUE_TOPIC, { batchSize: 1, localConcurrency: QUEUES[CANVAS_QUEUE_TOPIC].concurrency, pollingIntervalSeconds: 2 }, step)
await boss.work(STUDY_QUEUE_TOPIC, { batchSize: 1, localConcurrency: QUEUES[STUDY_QUEUE_TOPIC].concurrency, pollingIntervalSeconds: 2 }, step)

// Former Vercel Cron `* * * * *` -> GET /internal/canvas-dispatch.
const sweepSchedule = process.env.WICKER_DISPATCH_CRON || '* * * * *'
if (sweepSchedule === 'off') await boss.unschedule(CANVAS_DISPATCH_QUEUE).catch(() => {})
else await boss.schedule(CANVAS_DISPATCH_QUEUE, sweepSchedule)
await boss.work(CANVAS_DISPATCH_QUEUE, { batchSize: 1, localConcurrency: 1 }, async () => {
  const result = await runDispatchSweep()
  if (!result.ok) console.warn('Canvas dispatch sweep failed; retrying next minute', result)
  return result
})

// Liveness for the container healthcheck.
let healthy = true
const health = createServer((req, res) => {
  res.writeHead(healthy && req.url === '/healthz' ? 200 : req.url === '/healthz' ? 503 : 404, { 'Content-Type': 'text/plain' })
  res.end(healthy ? 'ok' : 'stopping')
})
const healthPort = Number(process.env.WORKER_HEALTH_PORT || 8081)
if (healthPort > 0) health.listen(healthPort, '0.0.0.0')
console.log(`pg-boss worker running: ${CANVAS_QUEUE_TOPIC} x${QUEUES[CANVAS_QUEUE_TOPIC].concurrency}, ${STUDY_QUEUE_TOPIC} x${QUEUES[STUDY_QUEUE_TOPIC].concurrency}, dispatch "${sweepSchedule}"`)

let stopping = false
async function shutdown(signal) {
  if (stopping) return
  stopping = true; healthy = false
  console.log(`${signal} received; finishing active jobs…`)
  // Study steps may run up to 11 minutes; unfinished ones expire and retry.
  await boss.stop({ graceful: true, timeout: Number(process.env.WORKER_STOP_TIMEOUT_MS || 60_000) }).catch(error => console.error(error))
  health.close()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
