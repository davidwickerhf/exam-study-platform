// Letting an agent obtain an API key without the key ever appearing in a chat
// transcript. The shape is the OAuth authorization-code exchange, minus the
// parts a single first-party client does not need:
//
//   1. The agent's MCP server opens a loopback listener, invents a verifier,
//      and sends the user to /connect with sha256(verifier) and a state value.
//   2. The signed-in browser approves. The server records the approval against
//      a hashed, ten-minute, single-use code and hands the code back through
//      the loopback redirect.
//   3. The MCP exchanges code + verifier for a freshly minted key.
//
// No secret is ever stored: the key is created at exchange time and returned
// once. A code seen in browser history is useless without the verifier, which
// never leaves the agent's machine, and is useless twice regardless.

import { createHash, randomBytes } from 'node:crypto'
import { sql, userId, localRows, saveLocalRows } from './db.mjs'
import { withRequestContext } from './request-context.mjs'
import { API_SCOPES, createApiKey, isAdminUser } from './api-keys.mjs'

const TABLE = 'agent_authorizations'
// Without a database these rows live in the per-user document store, but the
// exchange arrives with no credential and so cannot know whose row to read.
// Pin them to one shared namespace instead; the approving user is a column.
const SHARED_SCOPE = { userId: '_agent-authorizations', mode: 'agent-authorization' }
const shared = (callback) => sql ? callback() : withRequestContext(SHARED_SCOPE, callback)
export const AUTHORIZATION_TTL_MS = 10 * 60_000
const MAX_PENDING_PER_USER = 5

export class AgentAuthorizationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function label(value) {
  const cleaned = String(value || '').replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return cleaned || 'Agent (MCP)'
}

// The challenge must look like a base64url sha256 digest and nothing else, so a
// caller cannot smuggle a literal secret into the row.
function challengeValue(value) {
  const challenge = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new AgentAuthorizationError('The authorization challenge must be a base64url SHA-256 digest.')
  return challenge
}

function scopeList(scopes) {
  const requested = [...new Set((Array.isArray(scopes) ? scopes : ['read']).map((scope) => String(scope).trim().toLowerCase()).filter(Boolean))]
  const invalid = requested.filter((scope) => !API_SCOPES.includes(scope))
  if (invalid.length) throw new AgentAuthorizationError(`Unknown scope: ${invalid.join(', ')}`)
  if (!requested.includes('read')) requested.unshift('read')
  return requested
}

// Only loopback. A redirect target anywhere else would turn this endpoint into
// a way to have a signed-in browser hand an API key to a third party.
export function assertLoopbackRedirect(value) {
  let url
  try { url = new URL(String(value)) } catch { throw new AgentAuthorizationError('The redirect target must be a loopback URL such as http://127.0.0.1:8765/callback.') }
  if (url.protocol !== 'http:') throw new AgentAuthorizationError('The redirect target must use http on loopback.')
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) throw new AgentAuthorizationError('The redirect target must be 127.0.0.1 or localhost. Wicker Study will not send an API key anywhere else.')
  if (url.username || url.password || url.hash) throw new AgentAuthorizationError('The redirect target must be a plain loopback URL.')
  return url.toString()
}

async function pending(owner) {
  const now = new Date().toISOString()
  if (sql) return (await sql`SELECT code_hash FROM agent_authorizations WHERE user_id = ${owner} AND used_at IS NULL AND expires_at > now()`).length
  return (await shared(() => localRows(TABLE))).filter((row) => row.userId === owner && !row.usedAt && row.expiresAt > now).length
}

// Called by a signed-in browser. Returns the code once; it is stored hashed.
export async function approveAgentAuthorization({ name, scopes, challenge } = {}) {
  const owner = userId()
  const granted = scopeList(scopes)
  if (granted.includes('admin') && !isAdminUser(owner)) throw new AgentAuthorizationError('Only administrators can authorise an admin key.', 403)
  const verified = challengeValue(challenge)
  if (await pending(owner) >= MAX_PENDING_PER_USER) throw new AgentAuthorizationError('Too many authorizations are already waiting. Finish or abandon one, then try again.', 429)
  const code = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + AUTHORIZATION_TTL_MS).toISOString()
  const row = { codeHash: sha256(code), userId: owner, name: label(name), scopes: granted, challenge: verified, createdAt: new Date().toISOString(), expiresAt, usedAt: null }
  if (sql) {
    await sql`INSERT INTO agent_authorizations (code_hash, user_id, name, scopes, challenge, expires_at)
      VALUES (${row.codeHash}, ${row.userId}, ${row.name}, ${row.scopes}, ${row.challenge}, ${expiresAt}::timestamptz)`
  } else {
    await shared(async () => {
      const rows = (await localRows(TABLE)).filter((entry) => entry.expiresAt > row.createdAt)
      rows.push(row)
      await saveLocalRows(TABLE, rows)
    })
  }
  return { code, name: row.name, scopes: granted, expiresAt }
}

// Called by the agent with no credential at all, so every failure mode here has
// to be indistinguishable: an unknown code, an expired code, a spent code, and
// a wrong verifier all answer the same way.
export async function exchangeAgentAuthorization({ code, verifier } = {}) {
  const rejected = new AgentAuthorizationError('This authorization code is not valid. It may have expired, already been used, or been issued for a different agent. Start the authorization again.', 400)
  const supplied = String(code || '').trim()
  const proof = String(verifier || '').trim()
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(supplied) || !/^[A-Za-z0-9_-]{16,200}$/.test(proof)) throw rejected
  const codeHash = sha256(supplied)
  const challenge = createHash('sha256').update(proof).digest('base64url')

  let claim = null
  if (sql) {
    // Consume and read in one statement so two racing exchanges cannot both win.
    const rows = await sql`UPDATE agent_authorizations SET used_at = now()
      WHERE code_hash = ${codeHash} AND used_at IS NULL AND expires_at > now() AND challenge = ${challenge}
      RETURNING user_id, name, scopes`
    claim = rows[0] ? { userId: rows[0].user_id, name: rows[0].name, scopes: rows[0].scopes } : null
  } else {
    claim = await shared(async () => {
      const rows = await localRows(TABLE)
      const now = new Date().toISOString()
      const index = rows.findIndex((row) => row.codeHash === codeHash && !row.usedAt && row.expiresAt > now && row.challenge === challenge)
      if (index < 0) return null
      rows[index].usedAt = now
      const found = { userId: rows[index].userId, name: rows[index].name, scopes: rows[index].scopes }
      await saveLocalRows(TABLE, rows)
      return found
    })
  }
  if (!claim) throw rejected

  // The key is minted now, as the approving user, and returned exactly once.
  const key = await withRequestContext({ userId: claim.userId, mode: 'agent-authorization', admin: isAdminUser(claim.userId) },
    () => createApiKey({ name: claim.name, scopes: claim.scopes, lifetime: '1y' }))
  return { apiKey: key.secret, name: key.name, scopes: key.scopes, expiresAt: key.expiresAt, userId: claim.userId }
}

// Pending authorization grants are personal access records too. Local grants
// live in a shared technical namespace because the unauthenticated exchange
// cannot know which user directory to inspect; account deletion must therefore
// remove them explicitly instead of relying on that user's document cleanup.
export async function deleteOwnAgentAuthorizations() {
  const owner = userId()
  if (sql) {
    const rows = await sql`DELETE FROM agent_authorizations WHERE user_id = ${owner} RETURNING code_hash`
    return rows.length
  }
  return shared(async () => {
    const rows = await localRows(TABLE)
    const kept = rows.filter((row) => row.userId !== owner)
    await saveLocalRows(TABLE, kept)
    return rows.length - kept.length
  })
}
