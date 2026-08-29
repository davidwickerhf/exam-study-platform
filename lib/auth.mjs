import { createClerkClient } from '@clerk/backend'
import { authenticateApiKey, isAdminUser, KEY_PREFIX } from './api-keys.mjs'

const secretKey = process.env.CLERK_SECRET_KEY || ''
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || ''
const configured = Boolean(secretKey && publishableKey)
const clerk = configured ? createClerkClient({ secretKey, publishableKey }) : null

function requestUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  return `${proto}://${host}${req.url || '/'}`
}

function webRequest(req) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry))
    else if (value != null) headers.set(key, value)
  }
  return new Request(requestUrl(req), { method: req.method, headers })
}

export function authConfig() {
  return { enabled: configured, publishableKey: configured ? publishableKey : null, mode: configured ? 'clerk' : 'local' }
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

export async function authenticate(req) {
  // Personal API keys work in every mode and act as the key's owner.
  const bearer = bearerToken(req)
  if (bearer && bearer.startsWith(KEY_PREFIX)) {
    const key = await authenticateApiKey(bearer)
    if (!key) return { userId: null, mode: 'api-key', authenticated: false, reason: 'invalid_api_key' }
    return { userId: key.userId, keyId: key.keyId, scopes: key.scopes, mode: 'api-key', authenticated: true, admin: isAdminUser(key.userId) && key.scopes.includes('admin') }
  }
  if (!configured) return { userId: 'local-dev', mode: 'local', authenticated: true, admin: isAdminUser('local-dev') }
  const state = await clerk.authenticateRequest(webRequest(req), { acceptsToken: 'session_token' })
  if (!state.isAuthenticated) return { userId: null, mode: 'clerk', authenticated: false, reason: state.reason }
  const auth = state.toAuth()
  return { userId: auth.userId, sessionId: auth.sessionId, mode: 'clerk', authenticated: true, admin: isAdminUser(auth.userId) }
}

// Scope checks for API-key requests. Sessions (Clerk or local) are unrestricted
// except for the admin flag, which depends on ADMIN_USER_IDS.
export function authorise(auth, { method, pathname }) {
  if (pathname.startsWith('/api/admin/')) return auth.admin ? null : 'Administrator access required.'
  if (auth.mode !== 'api-key') return null
  if (pathname.startsWith('/api/account/api-keys')) return 'API keys cannot manage other keys. Use the Account page.'
  if (pathname === '/api/account' || pathname === '/api/account/data') return 'Account deletion and resets require a signed-in session.'
  if (method !== 'GET' && method !== 'HEAD' && !auth.scopes.includes('write')) return 'This key is read-only.'
  return null
}

export async function getAuthUser(userId) {
  if (!configured) return { id: userId, email: null, createdAt: null }
  const user = await clerk.users.getUser(userId)
  const primaryEmail = user.emailAddresses?.find((entry) => entry.id === user.primaryEmailAddressId)
    || user.emailAddresses?.[0]
  return {
    id: user.id,
    email: primaryEmail?.emailAddress || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null
  }
}

export async function deleteAuthUser(userId) {
  if (!configured) return { deleted: false, mode: 'local' }
  await clerk.users.deleteUser(userId)
  return { deleted: true, mode: 'clerk' }
}

export function isPublicApi(pathname) {
  // Editorial PDFs contain no personal data. Keeping this read-only route
  // public also prevents long-lived native PDF viewers from failing when a
  // short Clerk session token expires inside their iframe.
  return pathname === '/api/health' || pathname === '/api/auth/config' || pathname.startsWith('/api/pdf/')
}
