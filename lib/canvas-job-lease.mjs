/** Keep ownership live during slow imports and fence work after cancellation. */
export async function withCanvasJobLease(task, { renew, heartbeatMs = 30_000, timeoutMs = 30 * 60_000, signal } = {}) {
  signal?.throwIfAborted()
  let active = true
  let renewing = false
  let timeout
  let rejectLease
  const ended = new Promise((_, reject) => { rejectLease = reject })
  const endLease = () => { active = false; rejectLease(new Error('Canvas job lease ended; collection can resume on a new worker.')) }
  signal?.addEventListener('abort', endLease, { once: true })
  const assertActive = () => { if (!active) throw new Error('Canvas job lease ended; collection can resume on a new worker.') }
  const heartbeat = setInterval(async () => {
    if (renewing || !active) return
    renewing = true
    try { if (!await renew()) endLease() } catch { endLease() } finally { renewing = false }
  }, heartbeatMs)
  heartbeat.unref?.()
  try {
    const result = await Promise.race([
      task(assertActive),
      ended,
      new Promise((_, reject) => { timeout = setTimeout(() => { active = false; reject(new Error('Canvas collection exceeded its job time limit; retrying from stored material.')) }, timeoutMs) })
    ])
    assertActive()
    return result
  } finally {
    active = false
    clearInterval(heartbeat)
    clearTimeout(timeout)
    signal?.removeEventListener('abort', endLease)
  }
}
