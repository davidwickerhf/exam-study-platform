import { setTimeout as delay } from 'node:timers/promises'

// One queue consumer per worker, with an interruptible idle wait. A deployment
// abort fences its current lease before another process resumes the same job.
export async function runWorker({ processJob, signal, intervalMs = 5000, onState = () => {}, onError = console.error }) {
  while (!signal.aborted) {
    try {
      onState('working')
      const result = await processJob({ signal })
      onState('idle')
      if (result) continue
    } catch (error) {
      if (signal.aborted) break
      onState('unavailable')
      onError(error)
    }
    try { await delay(intervalMs, undefined, { signal }) }
    catch (error) { if (!signal.aborted) throw error }
  }
  onState('stopped')
}
