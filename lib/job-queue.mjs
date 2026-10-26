import { PgBoss } from 'pg-boss'
import { CANVAS_QUEUE_TOPIC, STUDY_QUEUE_TOPIC } from './canvas-queue-protocol.mjs'

// pg-boss on the application's own PostgreSQL replaces Vercel Queues.
// Topics, concurrency, visibility and retry match the former vercel.json
// triggers and handleCallback options:
//   canvas-sync-v1       maxConcurrency 2, visibility 300 s
//   study-generation-v1  maxConcurrency 1, visibility 900 s
//   retry                afterSeconds = min(300, 15 * deliveryCount)
// pg-boss backs off exponentially from 15 s, capped at 300 s. The SQL outbox
// sweep republishes any job whose message is lost or exhausted, as before.
const RETRY = { retryLimit: 20, retryDelay: 15, retryBackoff: true, retryDelayMax: 300 }
// Completed notifications carry no state worth keeping; the SQL tables do.
const CLEANUP = { deleteAfterSeconds: 86_400, retentionSeconds: 604_800 }

export const CANVAS_DISPATCH_QUEUE = 'canvas-dispatch-v1'
export const QUEUES = {
  [CANVAS_QUEUE_TOPIC]: { options: { ...RETRY, ...CLEANUP, expireInSeconds: 300 }, concurrency: 2 },
  [STUDY_QUEUE_TOPIC]: { options: { ...RETRY, ...CLEANUP, expireInSeconds: 900 }, concurrency: 1 },
  // The former every-minute Vercel Cron, now a pg-boss schedule. A missed tick
  // is not retried: the next minute performs the same idempotent sweep.
  [CANVAS_DISPATCH_QUEUE]: { options: { retryLimit: 0, expireInSeconds: 120, deleteAfterSeconds: 3_600, retentionSeconds: 300 }, concurrency: 1 },
}

export function createBoss({ role = 'producer', env = process.env } = {}) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for the job queue.')
  let connectionString = env.DATABASE_URL
  let ssl
  try {
    const url = new URL(connectionString)
    const mode = url.searchParams.get('sslmode')
    if ((mode && !['disable', 'allow', 'prefer'].includes(mode)) || /\.neon\.tech$/i.test(url.hostname)) ssl = { rejectUnauthorized: true }
    url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding')
    connectionString = url.toString()
  } catch { /* pg reports an invalid URL on connect */ }
  const worker = role === 'worker'
  const boss = new PgBoss({
    connectionString, ...(ssl ? { ssl } : {}),
    schema: env.PGBOSS_SCHEMA || 'pgboss',
    application_name: `wicker-${role}`,
    max: worker ? Number(env.PGBOSS_POOL_MAX || 6) : 2,
    // Only the worker maintains queues and runs schedules; web and API
    // processes merely insert jobs.
    supervise: worker,
    schedule: worker,
  })
  boss.on('error', error => console.error(`pg-boss (${role}) error:`, error?.message || error))
  return boss
}

export async function ensureQueues(boss) {
  for (const [name, { options }] of Object.entries(QUEUES)) {
    await boss.createQueue(name, options)
    // createQueue is a no-op for an existing queue; keep its policy current.
    await boss.updateQueue(name, options)
  }
}

// One lazily started producer per process (and per Next dev reload).
const PRODUCER = Symbol.for('wicker.pgBossProducer')
export function producer() {
  const cache = globalThis
  if (!cache[PRODUCER]) {
    cache[PRODUCER] = (async () => {
      const boss = createBoss({ role: 'producer' })
      await boss.start()
      for (const [name, { options }] of Object.entries(QUEUES)) await boss.createQueue(name, options)
      return boss
    })().catch(error => { cache[PRODUCER] = null; throw error })
  }
  return cache[PRODUCER]
}

export async function sendJob(topic, data, { delaySeconds = 0, retentionSeconds } = {}) {
  const boss = await producer()
  return boss.send(topic, data, {
    ...(delaySeconds > 0 ? { startAfter: delaySeconds } : {}),
    ...(retentionSeconds ? { retentionSeconds } : {}),
  })
}
