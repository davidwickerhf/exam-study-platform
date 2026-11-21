// Browser-side navigation and session-loss detection; authentication remains on the server.
export function safeAuthDestination(value, origin) {
  try {
    const url = new URL(value || '/app', origin)
    if (url.origin !== origin || !/^\/app(?:\/|$)/.test(url.pathname) && !/^\/share\/courses\/[A-Za-z0-9-]{2,30}\/(?:exam-papers|materials)$/.test(url.pathname) && url.pathname !== '/connect' && url.pathname !== '/connect/remote') return '/app'
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/app' }
}

// The session is a first-party cookie, so requests need no token. This wrapper
// only notices a session the server no longer accepts (expired, revoked, the
// account deleted) and refuses to send work after the signed-in account changed.
export function createAuthenticatedFetch({ fetchImpl, origin, onUnauthorized = () => {}, isActive = () => true }) {
  return async (input, init = {}) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, origin)
    if (target.origin !== origin || !target.pathname.startsWith('/api/')) return fetchImpl(input, init)
    if (!isActive()) throw new DOMException('Session changed.', 'AbortError')
    const signal = init.signal || (input instanceof Request ? input.signal : null)
    if (signal?.aborted) throw signal.reason || new DOMException('Request cancelled.', 'AbortError')
    const response = await fetchImpl(input, init)
    if (response.status !== 401) return response
    const failure = await response.clone().json().catch(() => null)
    // This envelope is emitted before handlers run. Arbitrary provider 401s
    // (a revoked Canvas token, say) are not a lost session.
    if (failure?.error === 'Sign in required' && failure.reason) onUnauthorized(failure)
    return response
  }
}
