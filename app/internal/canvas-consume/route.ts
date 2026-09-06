import { queueWorkersEnabled } from '@/lib/queue-runtime.mjs'
import { handleCallback } from '@vercel/queue'
import { callCanvasService, wakeCurrentCanvasDispatcher, sendCanvasStep } from '@/lib/canvas-queue-client'
export const maxDuration = 300
export const runtime = 'nodejs'
export const POST = handleCallback(async (message: { version: number; jobId: string; probe?: string }) => {
  if (message.version !== 1 || typeof message.jobId !== 'string' || !/^(?:csj-[a-zA-Z0-9-]+|sv-[a-f0-9-]{36})$/.test(message.jobId)) throw new Error('Invalid Canvas task.')
  if (message.jobId === 'csj-probe' && message.probe) {
    await callCanvasService({ action: 'probe' })
    console.info('Canvas queue probe delivered through API', message.probe)
    return
  }
  if (!queueWorkersEnabled()) return
  const result = await callCanvasService({ action: message.jobId.startsWith('sv-') ? 'study-step' : 'step', jobId: message.jobId })
  // Preview has no cron sweep. Persist the next delivery, including backoff,
  // before acknowledging this message. SQL leases make duplicates harmless.
  if (process.env.VERCEL_ENV === 'preview' && result.again) {
    await sendCanvasStep(message.jobId, result.delay || 0)
    return
  }
  await wakeCurrentCanvasDispatcher()
}, { visibilityTimeoutSeconds: 300, retry: (_error, metadata) => ({ afterSeconds: Math.min(300, 15 * metadata.deliveryCount) }) })
