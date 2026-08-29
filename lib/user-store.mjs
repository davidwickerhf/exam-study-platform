import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const localRoot = resolve(root, 'data/users')
const databaseUrl = process.env.DATABASE_URL || ''
const sql = databaseUrl ? neon(databaseUrl) : null

export function storageMode() { return sql ? 'neon' : 'local' }
function safeSegment(value) { return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_') }
function localPath(namespace, key, userId = currentUserId()) {
  return resolve(localRoot, safeSegment(userId), safeSegment(namespace), `${safeSegment(key)}.json`)
}

export async function readDocument(namespace, key, fallback) {
  const userId = currentUserId()
  if (sql) {
    const rows = await sql`SELECT value FROM user_documents WHERE user_id = ${userId} AND namespace = ${namespace} AND document_key = ${key}`
    return rows[0]?.value ?? structuredClone(fallback)
  }
  const path = localPath(namespace, key, userId)
  if (!existsSync(path)) return structuredClone(fallback)
  try { return JSON.parse(await readFile(path, 'utf8')) } catch { return structuredClone(fallback) }
}

export async function writeDocument(namespace, key, value) {
  const userId = currentUserId()
  if (sql) {
    await sql`INSERT INTO user_documents (user_id, namespace, document_key, value, updated_at)
      VALUES (${userId}, ${namespace}, ${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (user_id, namespace, document_key)
      DO UPDATE SET value = excluded.value, updated_at = now()`
    return value
  }
  const path = localPath(namespace, key, userId)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return value
}

export async function deleteDocument(namespace, key) {
  const userId = currentUserId()
  if (sql) {
    const rows = await sql`DELETE FROM user_documents WHERE user_id = ${userId} AND namespace = ${namespace} AND document_key = ${key} RETURNING document_key`
    return rows.length > 0
  }
  const path = localPath(namespace, key, userId)
  if (!existsSync(path)) return false
  await unlink(path)
  return true
}

export async function listDocuments(namespace) {
  const userId = currentUserId()
  if (sql) {
    const rows = await sql`SELECT document_key, value, updated_at FROM user_documents WHERE user_id = ${userId} AND namespace = ${namespace} ORDER BY document_key`
    return rows.map((row) => ({ key: row.document_key, value: row.value, updatedAt: row.updated_at }))
  }
  const dir = resolve(localRoot, safeSegment(userId), safeSegment(namespace))
  if (!existsSync(dir)) return []
  const documents = []
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json'))) {
    try { documents.push({ key: file.slice(0, -5), value: JSON.parse(await readFile(resolve(dir, file), 'utf8')) }) } catch {}
  }
  return documents
}

export async function summariseNamespaces() {
  const userId = currentUserId()
  if (sql) {
    const rows = await sql`SELECT namespace, count(*)::int AS count, max(updated_at) AS updated_at, sum(pg_column_size(value))::bigint AS bytes
      FROM user_documents WHERE user_id = ${userId} GROUP BY namespace ORDER BY namespace`
    return rows.map((row) => ({ namespace: row.namespace, count: Number(row.count), bytes: Number(row.bytes || 0), updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null }))
  }
  const base = resolve(localRoot, safeSegment(userId))
  if (!existsSync(base)) return []
  const { stat } = await import('node:fs/promises')
  const out = []
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = resolve(base, entry.name)
    let count = 0, bytes = 0, updatedAt = null
    for (const file of (await readdir(dir)).filter((name) => name.endsWith('.json'))) {
      const info = await stat(resolve(dir, file))
      count += 1
      bytes += info.size
      if (!updatedAt || info.mtime > updatedAt) updatedAt = info.mtime
    }
    out.push({ namespace: entry.name, count, bytes, updatedAt: updatedAt ? updatedAt.toISOString() : null })
  }
  return out.sort((a, b) => a.namespace.localeCompare(b.namespace))
}

export async function deleteNamespaces(namespaces) {
  const userId = currentUserId()
  const list = [...new Set(namespaces.map(String))]
  if (!list.length) return 0
  if (sql) {
    const rows = await sql`DELETE FROM user_documents WHERE user_id = ${userId} AND namespace = ANY(${list}) RETURNING document_key`
    return rows.length
  }
  const { rm } = await import('node:fs/promises')
  let removed = 0
  for (const namespace of list) {
    const dir = resolve(localRoot, safeSegment(userId), safeSegment(namespace))
    if (!existsSync(dir)) continue
    removed += (await readdir(dir)).filter((name) => name.endsWith('.json')).length
    await rm(dir, { recursive: true, force: true })
  }
  return removed
}

export async function healthcheck() {
  if (!sql) return { ok: true, mode: 'local' }
  await sql`SELECT 1 AS ok`
  return { ok: true, mode: 'neon' }
}
