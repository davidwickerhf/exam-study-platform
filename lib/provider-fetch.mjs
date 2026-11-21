import { Agent, fetch } from 'undici'

// A long model call may send no headers until generation finishes. Undici's
// default five-minute parser timers must not undercut the caller's deadline.
// Use matching fetch/dispatcher implementations; never change global fetch.
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 })
// The deadline uses an explicit controller aborted by a timer that strongly
// references it, rather than AbortSignal.timeout(). A bare timeout signal (and
// the composite AbortSignal.any() built from it) is only weakly held, so a
// stalled request could outlive its own deadline while the socket stayed open
// with the parser timers above disabled. The timer is unref'd: it bounds a
// request without keeping a process alive.
export function providerFetch(url, options = {}, timeoutMs = 210000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A finite provider deadline is required.')
  const deadline = new AbortController()
  const timer = setTimeout(
    () => deadline.abort(new DOMException(`The AI service did not respond within ${timeoutMs}ms.`, 'TimeoutError')),
    timeoutMs
  )
  timer.unref?.()
  // Not cleared when the headers arrive: the same deadline must still cut off a
  // response body that stalls midway through streaming.
  const signal = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal
  return fetch(url, { ...options, dispatcher, signal })
}
