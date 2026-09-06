/** In-memory workspace reads. Never persisted; session changes discard every value. */
export function createResourceCache({ fetchImpl = (...args) => fetch(...args), now = Date.now, maxAge = 30_000 } = {}) {
  const empty = Object.freeze({ data: undefined, error: null, fetchedAt: 0, pending: null, version: 0 })
  const entries = new Map(), listeners = new Map()
  let scope = null
  const emit = key => { for (const notify of listeners.get(key) || []) notify() }
  const read = key => entries.get(key) || empty
  function subscribe(key, notify) {
    const group = listeners.get(key) || new Set()
    listeners.set(key, group); group.add(notify)
    return () => { group.delete(notify); if (!group.size) listeners.delete(key) }
  }
  function invalidate(key, { discard = false } = {}) {
    const keys = key == null ? new Set([...entries.keys(), ...listeners.keys()]) : [key]
    for (const name of keys) {
      const current = read(name)
      // Replacing the entry fences an older request, including after sign-out.
      entries.set(name, { ...empty, data: discard ? undefined : current.data, version: current.version + 1 })
      emit(name)
    }
  }
  function setScope(next) { if (next !== scope) { scope = next; invalidate(null, { discard: true }) } }
  function load(key, { force = false } = {}) {
    const current = read(key)
    if (current.pending) return current.pending
    if (!force && current.data !== undefined && current.fetchedAt > now() - maxAge) return Promise.resolve(current.data)
    const entry = { ...current, error: null, pending: null }
    const pending = Promise.resolve().then(() => fetchImpl(key, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) }))
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || `${key} returned ${response.status}`)
        return body
      })
      .then(data => {
        if (entries.get(key) === entry) { entries.set(key, { ...entry, data, error: null, fetchedAt: now(), pending: null }); emit(key) }
        return data
      }, cause => {
        if (entries.get(key) === entry) { entries.set(key, { ...entry, error: cause instanceof Error ? cause : new Error(String(cause)), pending: null }); emit(key) }
        return undefined
      })
    entry.pending = pending
    entries.set(key, entry); emit(key)
    return pending
  }
  return { empty, read, subscribe, load, invalidate, setScope }
}

export function workspaceWriteAffectsReads(path, method) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) || !path.startsWith('/api/')) return false
  // These bookkeeping writes do not change dashboard/course/settings facts.
  if (path === '/api/browser-state' || path.startsWith('/api/auth/')) return false
  if (path.startsWith('/api/tutor/') && path !== '/api/tutor/actions' && !/\/diagnostics\//.test(path)) return false
  return true
}
