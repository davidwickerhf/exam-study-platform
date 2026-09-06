import { createHash, randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from './db.mjs'
import { currentUserId } from './request-context.mjs'

const namespace = 'canvas-response-cache-v1'
const context = new AsyncLocalStorage()
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const canvasCachePartition = () => context.getStore() || 'local'

// Existing private document storage supplies account erasure and isolation.
// Only the sanitised Hub response is persisted, never raw Canvas API pages.
const databaseStore = {
  async generation(userId) {
    const rows = await sql`SELECT value FROM user_documents WHERE user_id=${userId} AND namespace=${namespace} AND document_key='generation'`
    return rows[0]?.value?.generation || 'initial'
  },
  async read(userId, key, generation) {
    const rows = await sql`SELECT value FROM user_documents WHERE user_id=${userId} AND namespace=${namespace} AND document_key=${key}`
    return rows[0]?.value?.generation === generation ? rows[0].value : null
  },
  async write(userId, key, generation, value) {
    await sql`INSERT INTO user_documents (user_id, namespace, document_key, value, updated_at)
      SELECT ${userId}, ${namespace}, ${key}, ${JSON.stringify(value)}::jsonb, now()
      WHERE coalesce((SELECT value->>'generation' FROM user_documents WHERE user_id=${userId} AND namespace=${namespace} AND document_key='generation'), 'initial')=${generation}
      ON CONFLICT (user_id, namespace, document_key) DO UPDATE SET value=excluded.value, updated_at=now()`
  },
  async invalidate(userId) {
    const generation = randomUUID()
    await sql.transaction([
      sql`INSERT INTO user_documents (user_id, namespace, document_key, value, updated_at)
        VALUES (${userId}, ${namespace}, 'generation', ${JSON.stringify({ generation })}::jsonb, now())
        ON CONFLICT (user_id, namespace, document_key) DO UPDATE SET value=excluded.value, updated_at=now()`,
      sql`DELETE FROM user_documents WHERE user_id=${userId} AND namespace=${namespace} AND document_key<>'generation'`
    ])
  },
  async prune(userId) {
    await sql`DELETE FROM user_documents WHERE user_id=${userId} AND namespace=${namespace} AND document_key<>'generation' AND updated_at<now()-interval '1 day'`
  }
}

export async function invalidateCanvasSharedCache() {
  if (sql) await databaseStore.invalidate(currentUserId())
}

export async function cachedCanvasResponse(options, produce, { store = sql ? databaseStore : null, userId = currentUserId(), now = Date.now, ttlMs = 600_000 } = {}) {
  const { token, origin, scope = 'current', courseIds = [], days = 60, parts = [], force = false } = options
  const day = new Date(options.now || now()).toISOString().slice(0, 10)
  const partition = hash([userId, origin, token])
  const key = hash([partition, scope, [...courseIds].sort(), days, [...parts].sort(), day])
  if (!store) return context.run(partition, produce)
  let generation
  try {
    if (force) await store.invalidate(userId)
    generation = await store.generation(userId)
    const previous = force ? null : await store.read(userId, key, generation)
    if (previous?.expiresAt > now()) return previous.result
  } catch {
    // A cache outage must not take away live Canvas access. A unique partition
    // prevents a failed forced refresh from falling back to old memory data.
    return context.run(`${partition}:${randomUUID()}`, produce)
  }
  const result = await context.run(`${partition}:${generation}`, produce)
  // Partial failures should be retried; don't freeze them for ten minutes.
  if (!result.problems?.length) {
    try {
      await store.write(userId, key, generation, { generation, expiresAt: now() + ttlMs, result })
      await store.prune?.(userId)
    } catch { /* successful live data remains usable if the cache is unavailable */ }
  }
  return result
}
