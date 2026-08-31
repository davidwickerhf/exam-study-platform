import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { sql, userId, localRows, saveLocalRows, iso } from './db.mjs'
import { currentAuth } from './request-context.mjs'

// Bearer keys (`wsk_…`) let agents and administrators use the same HTTP API as
// the web client. A key acts as the user who created it, restricted to its
// scopes:
//   read  — every GET endpoint
//   write — study mutations (answers, reviews, flashcards, plan, …)
//   admin — editorial content and programme catalogue (administrators only)

export const API_SCOPES = Object.freeze(['read', 'write', 'admin'])
export const KEY_PREFIX = 'wsk_'

function hashKey(secret) {
  return createHash('sha256').update(secret).digest('hex')
}

export function isAdminUser(id) {
  const configured = (process.env.ADMIN_USER_IDS || '').split(',').map((value) => value.trim()).filter(Boolean)
  if (configured.length) return configured.includes(id)
  // With no explicit list, only the file-backed local workspace is an admin.
  // A local test user runs against a real database, so it must be named in
  // ADMIN_USER_IDS like any other administrator.
  return id === 'local-dev' && !process.env.DATABASE_URL
}

function normalizeScopes(scopes, { admin }) {
  const requested = [...new Set((Array.isArray(scopes) ? scopes : ['read']).map((scope) => String(scope).trim().toLowerCase()))]
  const invalid = requested.filter((scope) => !API_SCOPES.includes(scope))
  if (invalid.length) throw new Error(`Unknown scope: ${invalid.join(', ')}`)
  if (requested.includes('admin') && !admin) throw new Error('Only administrators can create admin keys.')
  if (!requested.includes('read')) requested.unshift('read')
  return requested
}

function publicKey(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    createdAt: iso(row.created_at ?? row.createdAt),
    lastUsedAt: iso(row.last_used_at ?? row.lastUsedAt),
    expiresAt: iso(row.expires_at ?? row.expiresAt),
    revokedAt: iso(row.revoked_at ?? row.revokedAt)
  }
}

export async function listApiKeys() {
  if (sql) {
    const rows = await sql`SELECT id, name, prefix, scopes, created_at, last_used_at, expires_at, revoked_at FROM api_keys WHERE user_id = ${userId()} ORDER BY created_at DESC`
    return rows.map(publicKey)
  }
  return (await localRows('api_keys')).map(publicKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const KEY_LIFETIMES = Object.freeze({ '30d': 30, '90d': 90, '1y': 365 })

export async function createApiKey({ name, scopes, lifetime = '1y' } = {}) {
  const label = String(name || '').trim().slice(0, 80)
  if (!label) throw new Error('Give the key a name.')
  const days = KEY_LIFETIMES[lifetime]
  if (!days) throw new Error('Choose a key lifetime of 30 days, 90 days, or 1 year.')
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  const owner = userId()
  const granted = normalizeScopes(scopes, { admin: isAdminUser(owner) || Boolean(currentAuth().admin) })
  const existing = await listApiKeys()
  if (existing.filter((key) => !key.revokedAt).length >= 20) throw new Error('You already have 20 active keys. Revoke one first.')
  const secret = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`
  const row = { id: randomUUID(), name: label, prefix: secret.slice(0, KEY_PREFIX.length + 6), keyHash: hashKey(secret), scopes: granted, createdAt: new Date().toISOString(), lastUsedAt: null, expiresAt, revokedAt: null }
  if (sql) {
    await sql`INSERT INTO api_keys (id, user_id, name, prefix, key_hash, scopes, created_at, expires_at) VALUES (${row.id}, ${owner}, ${row.name}, ${row.prefix}, ${row.keyHash}, ${row.scopes}, now(), ${expiresAt}::timestamptz)`
  } else {
    const rows = await localRows('api_keys')
    rows.push({ ...row, userId: owner })
    await saveLocalRows('api_keys', rows)
  }
  return { ...publicKey(row), secret }
}

export async function revokeApiKey(id) {
  if (sql) {
    const rows = await sql`UPDATE api_keys SET revoked_at = now() WHERE user_id = ${userId()} AND id = ${id} AND revoked_at IS NULL RETURNING id`
    return rows.length > 0
  }
  const rows = await localRows('api_keys')
  const found = rows.find((row) => row.id === id && !row.revokedAt)
  if (!found) return false
  found.revokedAt = new Date().toISOString()
  await saveLocalRows('api_keys', rows)
  return true
}

// Resolves a bearer secret to its owner. Returns null for unknown or revoked
// keys. Runs outside any user context, so it queries by hash directly.
export async function authenticateApiKey(secret) {
  if (typeof secret !== 'string' || !secret.startsWith(KEY_PREFIX)) return null
  const keyHash = hashKey(secret)
  if (sql) {
    const rows = await sql`UPDATE api_keys SET last_used_at = now() WHERE key_hash = ${keyHash} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) RETURNING id, user_id, scopes`
    if (!rows.length) return null
    return { keyId: rows[0].id, userId: rows[0].user_id, scopes: rows[0].scopes }
  }
  const { readdir } = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const { withRequestContext } = await import('./request-context.mjs')
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)), 'data/users')
  if (!existsSync(root)) return null
  for (const dir of await readdir(root)) {
    const match = await withRequestContext({ userId: dir }, async () => (await localRows('api_keys')).find((row) => row.keyHash === keyHash && !row.revokedAt && (!row.expiresAt || row.expiresAt > new Date().toISOString())))
    if (match) return { keyId: match.id, userId: match.userId || dir, scopes: match.scopes }
  }
  return null
}
