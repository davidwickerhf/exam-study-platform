// Server-only, account-scoped Canvas credentials. The plaintext Personal
// Access Token exists only while encrypting/decrypting a request; it is never
// returned by this module or included in account exports.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { sql, userId, localDelete, localRows, saveLocalRows } from './db.mjs'
import { parseCanvasOrigin } from './canvas-course-import.mjs'
import { assertPublicUrl } from './security.mjs'

const TABLE = 'canvas_connections'
const VERSION = 'v1'

export class CanvasConnectionError extends Error {}

function encryptionKey() {
  const configured = String(process.env.CANVAS_CONNECTION_ENCRYPTION_KEY || '').trim()
  let key
  try { key = Buffer.from(configured, 'base64') } catch { key = Buffer.alloc(0) }
  if (key.length !== 32) {
    throw new CanvasConnectionError('Secure Canvas connection storage is not configured. Set CANVAS_CONNECTION_ENCRYPTION_KEY to a 32-byte base64 secret before connecting Canvas.')
  }
  return key
}

// Whether this deployment can store a Canvas connection at all. Without the
// key, connecting Canvas fails closed — and until now there was no way to see
// that from outside, which made a misconfigured deployment look like a user
// error. Returns a boolean, never key material.
export function canvasStorageConfigured() {
  try { encryptionKey(); return true } catch { return false }
}

function tokenValue(value) {
  const token = String(value || '').trim()
  if (token.length < 20 || token.length > 4_096 || /\s/.test(token)) throw new CanvasConnectionError('Enter a valid Canvas Personal Access Token. Passwords, MFA codes, cookies, and session exports are not accepted.')
  return token
}

function encrypt(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

function decrypt(value) {
  const [version, ivEncoded, tagEncoded, dataEncoded, ...extra] = String(value || '').split('.')
  if (version !== VERSION || !ivEncoded || !tagEncoded || !dataEncoded || extra.length) throw new CanvasConnectionError('The stored Canvas connection could not be read. Reconnect Canvas to replace it.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
    return tokenValue(Buffer.concat([decipher.update(Buffer.from(dataEncoded, 'base64url')), decipher.final()]).toString('utf8'))
  } catch (error) {
    if (error instanceof CanvasConnectionError) throw error
    throw new CanvasConnectionError('The stored Canvas connection could not be read. Reconnect Canvas to replace it.')
  }
}

function publicConnection(row) {
  return {
    origin: row.origin,
    configured: true,
    createdAt: new Date(row.created_at ?? row.createdAt).toISOString(),
    updatedAt: new Date(row.updated_at ?? row.updatedAt).toISOString(),
    lastUsedAt: row.last_used_at ?? row.lastUsedAt ? new Date(row.last_used_at ?? row.lastUsedAt).toISOString() : null
  }
}

function originFrom(value) {
  return parseCanvasOrigin(value).origin
}

export async function normaliseCanvasConnectionOrigin(value) {
  const origin = originFrom(value)
  const checked = await assertPublicUrl(origin)
  return checked.origin
}

async function rowFor(origin, accountId = userId()) {
  if (sql) {
    const rows = await sql`SELECT origin, encrypted_token, created_at, updated_at, last_used_at FROM canvas_connections WHERE user_id = ${accountId} AND origin = ${origin} LIMIT 1`
    return rows[0] || null
  }
  return (await localRows(TABLE)).find((row) => row.userId === accountId && row.origin === origin) || null
}

export async function listCanvasConnections() {
  if (sql) {
    const rows = await sql`SELECT origin, created_at, updated_at, last_used_at FROM canvas_connections WHERE user_id = ${userId()} ORDER BY updated_at DESC`
    return rows.map((row) => publicConnection(row))
  }
  return (await localRows(TABLE)).filter((row) => row.userId === userId()).sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))).map(publicConnection)
}

export async function saveCanvasConnection({ canvasUrl, accessToken } = {}) {
  const origin = await normaliseCanvasConnectionOrigin(canvasUrl)
  const encryptedToken = encrypt(tokenValue(accessToken))
  const now = new Date().toISOString()
  if (sql) {
    const rows = await sql`INSERT INTO canvas_connections (user_id, origin, encrypted_token, created_at, updated_at)
      VALUES (${userId()}, ${origin}, ${encryptedToken}, now(), now())
      ON CONFLICT (user_id, origin) DO UPDATE SET encrypted_token = excluded.encrypted_token, updated_at = now()
      RETURNING origin, created_at, updated_at, last_used_at`
    return publicConnection(rows[0])
  }
  const rows = await localRows(TABLE)
  const index = rows.findIndex((row) => row.userId === userId() && row.origin === origin)
  const next = { userId: userId(), origin, encryptedToken, createdAt: index >= 0 ? rows[index].createdAt : now, updatedAt: now, lastUsedAt: index >= 0 ? rows[index].lastUsedAt || null : null }
  if (index >= 0) rows[index] = next
  else rows.push(next)
  await saveLocalRows(TABLE, rows)
  return publicConnection(next)
}

export async function removeCanvasConnection({ canvasUrl } = {}) {
  const origin = originFrom(canvasUrl)
  if (sql) {
    const rows = await sql`DELETE FROM canvas_connections WHERE user_id = ${userId()} AND origin = ${origin} RETURNING origin`
    return rows.length > 0
  }
  return localDelete(TABLE, (row) => row.userId === userId() && row.origin === origin)
}

export async function canvasAccessToken({ canvasUrl } = {}) {
  const origin = originFrom(canvasUrl)
  const row = await rowFor(origin)
  if (!row) throw new CanvasConnectionError(`No Canvas connection is saved for ${origin}. Connect Canvas in Settings first.`)
  const token = decrypt(row.encrypted_token ?? row.encryptedToken)
  if (sql) await sql`UPDATE canvas_connections SET last_used_at = now() WHERE user_id = ${userId()} AND origin = ${origin}`
  else {
    const rows = await localRows(TABLE)
    const local = rows.find((item) => item.userId === userId() && item.origin === origin)
    if (local) { local.lastUsedAt = new Date().toISOString(); await saveLocalRows(TABLE, rows) }
  }
  return { origin, token }
}

// Background corpus jobs run outside the request's async context. They still
// need to use the account that authorised the scrape, without ever persisting
// or returning plaintext credentials in a job payload.
export async function canvasAccessTokenForUser({ accountId, canvasUrl } = {}) {
  const origin = originFrom(canvasUrl)
  const account = String(accountId || '').trim()
  if (!account) throw new CanvasConnectionError('A Canvas corpus job is missing its account owner.')
  const row = await rowFor(origin, account)
  if (!row) throw new CanvasConnectionError(`No Canvas connection is saved for ${origin}. Reconnect Canvas in Settings first.`)
  return { origin, token: decrypt(row.encrypted_token ?? row.encryptedToken) }
}

export async function deleteCanvasConnections() {
  if (sql) {
    const rows = await sql`DELETE FROM canvas_connections WHERE user_id = ${userId()} RETURNING origin`
    return rows.length
  }
  return localDelete(TABLE, (row) => row.userId === userId())
}
