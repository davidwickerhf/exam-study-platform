import { createClerkClient } from '@clerk/backend'
import { authenticateApiKey, isAdminUser, KEY_PREFIX } from './api-keys.mjs'
import { membershipsFor } from './organisations.mjs'
import { accessPolicy, emailAllowed, isAccessAdministratorEmail, verifiedPrimaryEmail } from './access-policy.mjs'

export { accessPolicy, emailAllowed, isAccessAdministratorEmail, verifiedPrimaryEmail } from './access-policy.mjs'

const secretKey = process.env.CLERK_SECRET_KEY || ''
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || ''
const configured = Boolean(secretKey && publishableKey)
const clerk = configured ? createClerkClient({ secretKey, publishableKey }) : null
const DEV_SESSION_COOKIE = 'wicker_dev_session'

export function resolveLocalAccounts(env = process.env) {
  const raw = String(env.WICKER_LOCAL_ACCOUNTS || '').trim()
  if (!raw) return []
  if (env.NODE_ENV === 'production' || env.VERCEL) throw new Error('WICKER_LOCAL_ACCOUNTS is development-only.')
  return raw.split(',').map((entry) => {
    const separator = entry.indexOf('=')
    const email = entry.slice(0, separator).trim().toLowerCase()
    const userId = entry.slice(separator + 1).trim()
    if (separator < 1 || !email.includes('@') || !/^[A-Za-z0-9_-]{3,120}$/.test(userId)) throw new Error('WICKER_LOCAL_ACCOUNTS entries must use email=user_id.')
    return { email, userId }
  })
}

const localAccounts = resolveLocalAccounts()

export function resolveDevelopmentDataUsers(env = process.env) {
  const raw = String(env.WICKER_DEV_DATA_USERS || '').trim()
  if (!raw) return []
  if (env.NODE_ENV === 'production' || env.VERCEL) throw new Error('WICKER_DEV_DATA_USERS is development-only.')
  return raw.split(',').map((entry) => {
    const separator = entry.indexOf('=')
    const email = entry.slice(0, separator).trim().toLowerCase()
    const userId = entry.slice(separator + 1).trim()
    if (separator < 1 || !email.includes('@') || !/^[A-Za-z0-9_-]{3,120}$/.test(userId)) throw new Error('WICKER_DEV_DATA_USERS entries must use email=user_id.')
    return { email, userId }
  })
}

const developmentDataUsers = resolveDevelopmentDataUsers()

function developmentDataUserForEmail(email) {
  return developmentDataUsers.find((entry) => entry.email === String(email || '').trim().toLowerCase()) || null
}

export function localAccountForEmail(email) {
  return localAccounts.find((account) => account.email === String(email || '').trim().toLowerCase()) || null
}

export function localSessionCookie(userId, { clear = false } = {}) {
  const value = clear ? '' : encodeURIComponent(userId)
  return `${DEV_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${clear ? '; Max-Age=0' : '; Max-Age=604800'}`
}

function localAccountFromRequest(req) {
  if (!localAccounts.length) return null
  const cookies = String(req.headers.cookie || '').split(';').map((part) => part.trim())
  const held = cookies.find((part) => part.startsWith(`${DEV_SESSION_COOKIE}=`))?.slice(DEV_SESSION_COOKIE.length + 1)
  const userId = held ? decodeURIComponent(held) : ''
  return localAccounts.find((account) => account.userId === userId) || null
}

// ── Local test user ─────────────────────────────────────────────────────────
// A development-only escape hatch: run the app against a real database without
// Clerk, with every request acting as one named user. It exists so the
// database-backed surfaces — the editorial pipeline, the admin area, personal
// records — can be exercised locally instead of only on a deployment.
//
// It is refused wherever a real deployment could pick it up, because it grants
// an unauthenticated caller a real user's data. See README "Local test user".
export function resolveLocalTestUser(env = process.env) {
  const id = String(env.WICKER_LOCAL_USER || '').trim()
  if (!id) return null
  if (env.NODE_ENV === 'production' || env.VERCEL) {
    throw new Error('WICKER_LOCAL_USER is development-only: it makes every request act as one user without signing in. Remove it from this environment.')
  }
  if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
    throw new Error('WICKER_LOCAL_USER cannot be combined with Clerk keys. Remove one so it is unambiguous who a request acts as.')
  }
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(id)) {
    throw new Error('WICKER_LOCAL_USER must be a plain identifier such as user_localtest.')
  }
  return id
}

const localTestUser = resolveLocalTestUser()

export function localTestUserId() {
  return localTestUser
}

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

// This is Wicker Study's global role, held in Clerk private metadata. It is
// writable only through Clerk's Backend API/Dashboard, never from a browser.
// Programme roles intentionally remain in Postgres because Clerk
// Organizations' member cap is unsuitable for student cohorts.
export function isClerkAdministrator(privateMetadata) {
  return privateMetadata?.wickerStudyRole === 'admin'
}

function isAdministrator(userId, clerkAdmin, email) {
  return isAdminUser(userId) || clerkAdmin || isAccessAdministratorEmail(email)
}

// Identity (primary email + programme memberships) is cached briefly so the
// eligibility and scoping checks do not call Clerk on every request.
const IDENTITY_TTL_MS = 10 * 60 * 1000
const identityCache = new Map()

export async function identityFor(userId, { fresh = false } = {}) {
  if (!configured) return { email: null, memberships: null, trusted: true }
  const cached = identityCache.get(userId)
  if (!fresh && cached && cached.at > Date.now() - IDENTITY_TTL_MS) return cached.identity
  const [user, memberships] = await Promise.all([getAuthUser(userId), membershipsFor(userId)])
  const admin = isAdministrator(userId, user.admin, user.email)
  const identity = { email: user.email, memberships, admin, trusted: admin }
  identityCache.set(userId, { identity, at: Date.now() })
  return identity
}

export function forgetAuthUser(userId) {
  identityCache.delete(userId)
}

export function clerkClient() {
  return clerk
}

export function isMissingClerkSession(error) {
  if (Number(error?.status) !== 404) return false
  const errors = Array.isArray(error?.errors) ? error.errors : []
  const codes = errors.map((entry) => String(entry?.code || '').toLowerCase())
  const messages = [
    error?.message,
    error?.longMessage,
    ...errors.flatMap((entry) => [entry?.message, entry?.longMessage])
  ].filter(Boolean).join(' ').toLowerCase()
  return codes.includes('resource_not_found') && /\b(session|user)\b/.test(messages)
}

async function eligible(userId) {
  const policy = accessPolicy()
  if (!policy.domains.length && !policy.emails.length) return true
  if (!configured) return true
  return emailAllowed((await identityFor(userId)).email, policy)
}

function orgAdminOf(auth, programmeId) {
  return Boolean(auth.memberships?.some((membership) => membership.programmeId === programmeId && membership.role === 'admin'))
}

export function authConfig() {
  return { enabled: configured, publishableKey: configured ? publishableKey : null, mode: configured ? 'clerk' : localAccounts.length ? 'local-login' : localTestUser ? 'local-test-user' : 'local', localAccounts: localAccounts.map(({ email }) => ({ email })), allowedDomains: accessPolicy().domains }
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
    const identity = await identityFor(key.userId)
    // Keys only carry programme-admin rights when minted with the admin scope.
    const memberships = key.scopes.includes('admin') ? identity.memberships : identity.memberships?.map((membership) => ({ ...membership, role: 'member' })) ?? null
    return { userId: key.userId, keyId: key.keyId, scopes: key.scopes, mode: 'api-key', authenticated: true, admin: identity.admin && key.scopes.includes('admin'), email: identity.email, memberships, trusted: identity.trusted }
  }
  const localAccount = localAccountFromRequest(req)
  if (localAccount) {
    return { userId: localAccount.userId, mode: 'local-login', authenticated: true, admin: isAdministrator(localAccount.userId, false, localAccount.email), email: localAccount.email, memberships: await membershipsFor(localAccount.userId), trusted: true }
  }
  if (localAccounts.length) return { userId: null, mode: 'local-login', authenticated: false, reason: 'unauthenticated' }
  if (localTestUser) {
    // Memberships come from the database so programme scoping behaves as it
    // does when signed in; `null` would read as "every programme".
    return {
      userId: localTestUser,
      mode: 'local-test-user',
      authenticated: true,
      admin: isAdministrator(localTestUser, false, process.env.WICKER_LOCAL_USER_EMAIL),
      email: process.env.WICKER_LOCAL_USER_EMAIL || null,
      memberships: await membershipsFor(localTestUser),
      trusted: true
    }
  }
  if (!configured) return { userId: 'local-dev', mode: 'local', authenticated: true, admin: isAdminUser('local-dev'), email: null, memberships: null, trusted: true }
  try {
    const state = await clerk.authenticateRequest(webRequest(req), { acceptsToken: 'session_token' })
    if (!state.isAuthenticated) return { userId: null, mode: 'clerk', authenticated: false, reason: state.reason }
    const auth = state.toAuth()
    if (!(await eligible(auth.userId))) return { userId: null, mode: 'clerk', authenticated: false, reason: 'email_not_allowed', deniedUserId: auth.userId }
    const identity = await identityFor(auth.userId)
    const dataUser = developmentDataUserForEmail(identity.email)
    const userId = dataUser?.userId || auth.userId
    const memberships = dataUser ? await membershipsFor(userId) : identity.memberships
    return { userId, clerkUserId: auth.userId, sessionId: auth.sessionId, mode: 'clerk', authenticated: true, admin: isAdministrator(userId, identity.admin, identity.email), email: identity.email, memberships, trusted: identity.trusted }
  } catch (error) {
    // Clerk can retain a browser cookie for a session (or user) that was just
    // deleted through the Backend API. Treat it as signed out so the client
    // can clear its local Clerk state instead of surfacing a raw 404.
    if (isMissingClerkSession(error)) return { userId: null, mode: 'clerk', authenticated: false, reason: 'stale_session' }
    throw error
  }
}

// Scope checks for API-key requests. Sessions (Clerk or local) are unrestricted
// except for the admin flag, which depends on ADMIN_USER_IDS or the Clerk
// private-metadata role `wickerStudyRole: 'admin'`.
// Programme administrators (Clerk organisation admins) may maintain their own
// programme — its definition and institution calendar — but nothing else.
function programmeAdminRoute(method, pathname) {
  const match = pathname.match(/^\/api\/admin\/programmes(?:\/([^/]+)(\/calendar)?)?$/)
  if (!match) return null
  const programmeId = match[1] ? decodeURIComponent(match[1]) : null
  if (!programmeId) return method === 'GET' ? { programmeId: null } : null
  if (method === 'PUT') return { programmeId }
  return null
}

export function authorise(auth, { method, pathname }) {
  if (pathname.startsWith('/api/admin/feedback')) {
    if (auth.mode === 'api-key' && !auth.scopes.includes('admin')) return 'Administrator-scoped access required.'
    return null // Feedback routes check the dedicated role on every operation.
  }
  if (pathname.startsWith('/api/admin/')) {
    if (auth.admin) return null
    const route = programmeAdminRoute(method, pathname)
    const programmeAdmin = auth.memberships?.some((membership) => membership.role === 'admin')
    if (route && programmeAdmin && (route.programmeId === null || orgAdminOf(auth, route.programmeId))) return null
    return 'Administrator access required.'
  }
  if (auth.mode !== 'api-key') return null
  if (pathname.startsWith('/api/account/api-keys')) return 'API keys cannot manage other keys. Use the Account page.'
  // Reading which integrations exist returns no credential — only the origin
  // and when it was last used — and an agent needs it to tell the student
  // whether Canvas is connected. Storing or removing one stays browser-only.
  if (pathname.startsWith('/api/account/integrations/') && method !== 'GET') return 'Integration credentials can only be managed in a signed-in browser session.'
  if (pathname === '/api/account' || pathname === '/api/account/data') return 'Account deletion and resets require a signed-in session.'
  if (method !== 'GET' && method !== 'HEAD' && !auth.scopes.includes('write')) return 'This key is read-only.'
  return null
}

export async function getAuthUser(userId) {
  if (!configured) return { id: userId, email: null, createdAt: null }
  const user = await clerk.users.getUser(userId)
  const email = verifiedPrimaryEmail(user)
  return {
    id: user.id,
    email,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    admin: isAdministrator(user.id, isClerkAdministrator(user.privateMetadata), email)
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
  // The agent authorization exchange is necessarily unauthenticated: it is how
  // an agent with no key obtains one. It is protected by a single-use, hashed,
  // ten-minute code bound to a verifier the agent never transmits until now.
  return pathname === '/api/health' || pathname === '/api/auth/config' || pathname === '/api/public/course-repository' || /^\/api\/public\/study-versions\/pub-[a-f0-9-]+$/.test(pathname) || pathname === '/api/agent/authorize/exchange' || pathname.startsWith('/api/pdf/')
}
