import { neon } from '@neondatabase/serverless'
import { currentUserId } from './request-context.mjs'
import { deleteDocument, readDocument, writeDocument } from './user-store.mjs'

// One database handle for every personal-data repository. On Neon each
// entity is a real table (db/001–007). Without a DATABASE_URL — local
// development and the test suite — the same rows live as JSON arrays under
// the `tables` namespace of the per-user document store, so repositories
// keep one row shape and switch only the backend.

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export function userId() {
  return currentUserId()
}

export async function localRows(table) {
  const value = await readDocument('tables', table, { rows: [] })
  return Array.isArray(value.rows) ? value.rows : []
}

export async function saveLocalRows(table, rows) {
  if (!rows.length) { await deleteDocument('tables', table); return }
  await writeDocument('tables', table, { rows, updatedAt: new Date().toISOString() })
}

export async function localUpsert(table, keyOf, incoming) {
  const rows = await localRows(table)
  const byKey = new Map(rows.map((row) => [keyOf(row), row]))
  for (const row of incoming) byKey.set(keyOf(row), row)
  await saveLocalRows(table, [...byKey.values()])
}

export async function localDelete(table, predicate) {
  const rows = await localRows(table)
  const kept = rows.filter((row) => !predicate(row))
  if (kept.length !== rows.length) await saveLocalRows(table, kept)
  return rows.length - kept.length
}

export function iso(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function num(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function jsonb(value) {
  return JSON.stringify(value ?? null)
}

// Snapshot helpers: several server routines read a whole collection, mutate
// it in place, and write it back. Diffing against the snapshot lets those
// call sites stay as they are while only touched rows reach the database.
const snapshots = new WeakMap()

export function remember(container, rows, keyOf) {
  snapshots.set(container, new Map(rows.map((row) => [keyOf(row), JSON.stringify(row)])))
  return container
}

export function diffAgainstSnapshot(container, rows, keyOf) {
  const previous = snapshots.get(container) || new Map()
  const seen = new Set()
  const changed = []
  for (const row of rows) {
    const key = keyOf(row)
    seen.add(key)
    if (previous.get(key) !== JSON.stringify(row)) changed.push(row)
  }
  const removed = [...previous.keys()].filter((key) => !seen.has(key))
  return { changed, removed }
}
