import { Agent, fetch } from 'undici'

// A long model call may send no headers until generation finishes. Undici's
// default five-minute parser timers must not undercut the caller's deadline.
// Use matching fetch/dispatcher implementations; never change global fetch.
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 })
export function providerFetch(url, options = {}, timeoutMs = 210000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A finite provider deadline is required.')
  const deadline = AbortSignal.timeout(timeoutMs)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  return fetch(url, { ...options, dispatcher, signal })
}
