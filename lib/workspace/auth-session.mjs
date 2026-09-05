// Browser-side navigation and token transport; authentication remains on the server.
export function safeAuthDestination(value, origin) {
  try {
    const url = new URL(value || '/app', origin)
    if (url.origin !== origin || !/^\/app(?:\/|$)/.test(url.pathname) && url.pathname !== '/connect') return '/app'
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return '/app' }
}

function boundedToken(load, timeoutMs) {
  let timer
  return Promise.race([
    Promise.resolve().then(load),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sign-in is taking longer than expected. Try again.')), timeoutMs) })
  ]).finally(() => clearTimeout(timer))
}

export function createAuthenticatedFetch({ fetchImpl, getToken, origin, onUnauthorized = () => {}, tokenTimeoutMs = 10000, isActive = () => true }) {
  // Clerk already owns a token cache tied to its expiry. Only share in-flight
  // lookups here; keeping an extra 30-second copy can outlive that expiry.
  const pending = new Map()
  const token = fresh => {
    if (!pending.has(fresh)) {
      pending.set(fresh, boundedToken(() => getToken(fresh ? { skipCache: true } : undefined), tokenTimeoutMs)
        .finally(() => pending.delete(fresh)))
    }
    return pending.get(fresh)
  }
  return async (input, init = {}) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, origin)
    if (target.origin !== origin || !target.pathname.startsWith('/api/')) return fetchImpl(input, init)
    const send = async fresh => {
      if (!isActive()) throw new DOMException('Session changed.', 'AbortError')
      const value = await token(fresh)
      if (!isActive()) throw new DOMException('Session changed.', 'AbortError')
      const signal = init.signal || (input instanceof Request ? input.signal : null)
      if (signal?.aborted) throw signal.reason || new DOMException('Request cancelled.', 'AbortError')
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
      if (value) headers.set('authorization', `Bearer ${value}`)
      return fetchImpl(input instanceof Request ? input.clone() : input, { ...init, headers })
    }
    let response = await send(false)
    if (response.status !== 401) return response
    const failure = await response.clone().json().catch(() => null)
    // This envelope is emitted before handlers run. Do not replay arbitrary
    // provider errors or streamed bodies, and never sign out on a single 401.
    if (failure?.error !== 'Sign in required' || !failure.reason) return response
    if (!(init.body instanceof ReadableStream)) response = await send(true)
    if (response.status === 401) onUnauthorized(await response.clone().json().catch(() => failure))
    return response
  }
}
