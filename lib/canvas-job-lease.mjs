/** Keep ownership live during slow imports and fence work after cancellation. */
export async function withCanvasJobLease(task, { renew, heartbeatMs = 30_000, timeoutMs = 30 * 60_000 } = {}) {
  let active = true
  let renewing = false
  let timeout
  const assertActive = () => { if (!active) throw new Error('Canvas job lease ended; collection can resume on a new worker.') }
  const heartbeat = setInterval(async () => {
    if (renewing || !active) return
    renewing = true
    try { if (!await renew()) active = false } catch { active = false } finally { renewing = false }
  }, heartbeatMs)
  heartbeat.unref?.()
  try {
    const result = await Promise.race([
      task(assertActive),
      new Promise((_, reject) => { timeout = setTimeout(() => { active = false; reject(new Error('Canvas collection exceeded its job time limit; retrying from stored material.')) }, timeoutMs) })
    ])
    assertActive()
    return result
  } finally {
    active = false
    clearInterval(heartbeat)
    clearTimeout(timeout)
  }
}
