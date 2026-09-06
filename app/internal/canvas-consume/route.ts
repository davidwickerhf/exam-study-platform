import { handleCallback } from '@vercel/queue'
import { callCanvasService, dispatchCanvasSteps, sendCanvasStep } from '@/lib/canvas-queue-client'
export const maxDuration = 300
export const runtime = 'nodejs'
export const POST = handleCallback(async (message: { version: number; jobId: string; probe?: string }) => {
  if (message.version !== 1 || typeof message.jobId !== 'string' || !/^csj-[a-zA-Z0-9-]+$/.test(message.jobId)) throw new Error('Invalid Canvas task.')
  if (message.jobId === 'csj-probe' && message.probe) { console.info('Canvas queue probe delivered', message.probe); return }
  if (process.env.VERCEL_ENV === 'preview') return
  const result = await callCanvasService({ action: 'step', jobId: message.jobId })
  if (result.again) await sendCanvasStep(message.jobId, result.delay || 0)
  else await dispatchCanvasSteps()
}, { visibilityTimeoutSeconds: 300, retry: (_error, metadata) => ({ afterSeconds: Math.min(300, 15 * metadata.deliveryCount) }) })
