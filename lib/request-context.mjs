import { AsyncLocalStorage } from 'node:async_hooks'

const requestContext = new AsyncLocalStorage()

export function withRequestContext(context, callback) {
  return requestContext.run(context, callback)
}

export function setRequestContext(context) {
  requestContext.enterWith(context)
}

export function currentUserId() {
  return requestContext.getStore()?.userId || 'local-dev'
}

export function currentAuth() {
  return requestContext.getStore() || { userId: 'local-dev', mode: 'local' }
}

// ── Per-request memoisation ───────────────────────────────────────────────
//
// A handful of reads answer the same question several times inside one
// request: the academic workspace is loaded by /api/state's programme scoping,
// by /api/academics, and again by the calendar feed, each time paying five
// database round trips for a record that cannot change mid-request.
//
// The cache is keyed on the request's own auth object — `authenticate()`
// returns a fresh object per request and `withRequestContext` takes a fresh
// one per call — so entries cannot outlive the request or leak between users.
// Outside a request context nothing is cached at all.
const caches = new WeakMap()

function cacheForRequest() {
  const store = requestContext.getStore()
  if (!store || typeof store !== 'object') return null
  let cache = caches.get(store)
  if (!cache) { cache = new Map(); caches.set(store, cache) }
  return cache
}

/**
 * Run `produce` once per request per key. The promise itself is cached, so
 * concurrent callers share one in-flight read; a rejection is dropped rather
 * than remembered, so a transient failure does not poison the rest of the
 * request.
 */
export function requestMemo(key, produce) {
  const cache = cacheForRequest()
  if (!cache) return produce()
  if (cache.has(key)) return cache.get(key)
  const pending = Promise.resolve().then(produce)
  cache.set(key, pending)
  pending.catch(() => { if (cache.get(key) === pending) cache.delete(key) })
  return pending
}

/** Writes call this so a later read in the same request sees their effect. */
export function forgetRequestMemo(key) {
  const cache = cacheForRequest()
  if (!cache) return
  if (key === undefined) cache.clear()
  else cache.delete(key)
}
