// In-memory sliding-window rate limiter. The hosted app runs as a single
// long-lived container, so process memory is an adequate store; buckets are
// pruned so a scan cannot grow it without bound.

const buckets = new Map()
const MAX_BUCKETS = 50_000
let lastPrune = Date.now()

function prune(now) {
  if (now - lastPrune < 30_000 && buckets.size < MAX_BUCKETS) return
  lastPrune = now
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key)
  }
  if (buckets.size >= MAX_BUCKETS) {
    for (const key of [...buckets.keys()].slice(0, buckets.size - MAX_BUCKETS / 2)) buckets.delete(key)
  }
}

// Returns { allowed, remaining, retryAfter } and counts the hit unless dryRun.
export function consume(key, { limit, windowMs, now = Date.now(), dryRun = false } = {}) {
  prune(now)
  let bucket = buckets.get(key)
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + windowMs }
    buckets.set(key, bucket)
  }
  if (bucket.count >= limit) return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)), limit }
  if (!dryRun) bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, retryAfter: 0, limit }
}

export function resetRateLimits() { buckets.clear() }

// Policy: which limit applies to a request. Keys combine the scope with the
// caller identity (user id or API key id) or the client IP for anonymous
// traffic. Values are deliberately generous for humans and tight for abuse.
export const RATE_POLICIES = Object.freeze({
  ip: { limit: 600, windowMs: 60_000 },                 // any request, per IP
  authFailure: { limit: 20, windowMs: 10 * 60_000 },     // 401/403 per IP
  anonymousApi: { limit: 60, windowMs: 60_000 },         // public API routes per IP
  user: { limit: 300, windowMs: 60_000 },                // authenticated requests per identity
  write: { limit: 120, windowMs: 60_000 },               // mutations per identity
  ai: { limit: 20, windowMs: 60_000 },                   // AI-backed routes per identity (allowances apply on top)
  admin: { limit: 60, windowMs: 60_000 },                // editorial writes per identity
  keyCreate: { limit: 10, windowMs: 60 * 60_000 },       // API key minting per identity
  agentExchange: { limit: 10, windowMs: 10 * 60_000 },   // unauthenticated agent code exchange per IP
  accountDanger: { limit: 5, windowMs: 60 * 60_000 },    // reset/delete attempts per identity
  upload: { limit: 30, windowMs: 60 * 60_000 },          // material/document uploads per identity
  editorialUpload: { limit: 4000, windowMs: 60 * 60_000 } // resumable 512 KiB course-source chunks
})

export function classifyRequest(method, pathname) {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (pathname === '/api/account/api-keys' && method === 'POST') return 'keyCreate'
  if ((pathname === '/api/account' && method === 'DELETE') || (pathname === '/api/account/data' && method === 'DELETE')) return 'accountDanger'
  if (/^\/api\/admin\/editorial-editions\/[^/]+\/sources\/[^/]+\/chunks$/.test(pathname) && method === 'POST') return 'editorialUpload'
  if (pathname.startsWith('/api/admin/') && mutating) return pathname.includes('/materials') ? 'upload' : 'admin'
  if (pathname === '/api/academics/documents/analyze' || pathname === '/api/academics/intake/analyze' || pathname === '/api/tutor/attachments') return 'upload'
  if (['/api/chat', '/api/grade', '/api/tutor', '/api/tutor/actions'].includes(pathname) || /\/extend$/.test(pathname) || /\/flashcards\/[^/]+\/[^/]+\/[^/]+\/grade$/.test(pathname)) return 'ai'
  return mutating ? 'write' : 'user'
}
