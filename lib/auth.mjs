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

// Access policy. Clerk's own allowlist is a paid feature, so eligibility is
// enforced here: when ALLOWED_EMAIL_DOMAINS is set, only sessions whose
// primary email is on one of those domains (or listed verbatim in
// ALLOWED_EMAILS) may use the app. Sign-up itself stays open in Clerk; the
// account simply cannot enter the workspace and is told why.
function csv(value) {
  return (value || '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean)
}

export function accessPolicy(env = process.env) {
  return { domains: csv(env.ALLOWED_EMAIL_DOMAINS), emails: csv(env.ALLOWED_EMAILS) }
}

export function emailAllowed(email, policy = accessPolicy()) {
  if (!policy.domains.length && !policy.emails.length) return true
  const address = String(email || '').trim().toLowerCase()
  const at = address.lastIndexOf('@')
  if (at < 1) return false
  if (policy.emails.includes(address)) return true
  const domain = address.slice(at + 1)
  return policy.domains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))
}

// Primary emails are cached briefly so the eligibility check does not call
// Clerk on every request.
const EMAIL_TTL_MS = 10 * 60 * 1000
const emailCache = new Map()

async function primaryEmail(userId) {
  const cached = emailCache.get(userId)
  if (cached && cached.at > Date.now() - EMAIL_TTL_MS) return cached.email
  const user = await getAuthUser(userId)
  emailCache.set(userId, { email: user.email, at: Date.now() })
  return user.email
}

export function forgetAuthUser(userId) {
  emailCache.delete(userId)
}

async function eligible(userId) {
  const policy = accessPolicy()
  if (!policy.domains.length && !policy.emails.length) return true
  if (!configured) return true
  return emailAllowed(await primaryEmail(userId), policy)
}

export function authConfig() {
  return { enabled: configured, publishableKey: configured ? publishableKey : null, mode: configured ? 'clerk' : 'local', allowedDomains: accessPolicy().domains }
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
    if (!(await eligible(key.userId))) return { userId: null, mode: 'api-key', authenticated: false, reason: 'email_not_allowed' }
    return { userId: key.userId, keyId: key.keyId, scopes: key.scopes, mode: 'api-key', authenticated: true, admin: isAdminUser(key.userId) && key.scopes.includes('admin') }
  }
  if (!configured) return { userId: 'local-dev', mode: 'local', authenticated: true, admin: isAdminUser('local-dev') }
  const state = await clerk.authenticateRequest(webRequest(req), { acceptsToken: 'session_token' })
  if (!state.isAuthenticated) return { userId: null, mode: 'clerk', authenticated: false, reason: state.reason }
  const auth = state.toAuth()
  if (!(await eligible(auth.userId))) return { userId: null, mode: 'clerk', authenticated: false, reason: 'email_not_allowed', deniedUserId: auth.userId }
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
  forgetAuthUser(userId)
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
