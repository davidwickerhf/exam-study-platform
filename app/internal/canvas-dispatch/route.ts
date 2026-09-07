import { timingSafeEqual } from 'node:crypto'
import { dispatchCanvasSteps, sendCanvasProbe, callCanvasService, sendCanvasStep } from '@/lib/canvas-queue-client'
import { queueWorkersEnabled } from '@/lib/queue-runtime.mjs'
import { verifyCanvasTask } from '@/lib/canvas-queue-protocol.mjs'
export const maxDuration = 60
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  const actual = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return new Response('Unauthorized', { status: 401 })
  const [canvas, feedback] = await Promise.allSettled([dispatchCanvasSteps(), callCanvasService({ action: 'feedback-maintenance' })])
  const feedbackStatus = feedback.status === 'fulfilled' ? 'processed' : 'deferred'
  if(canvas.status === 'rejected') return Response.json({ error: 'Canvas dispatch failed.', feedback: feedbackStatus }, {status:503})
  return Response.json({...canvas.value,feedback:feedbackStatus})
}
export async function POST(request: Request) {
  const body = await request.text()
  const payload = JSON.parse(body)
  const probe = payload.probe === true
  const signature = request.headers.get('x-canvas-task')
  if (!verifyCanvasTask(body, signature) && !(probe && verifyCanvasTask(body, signature, { key: process.env.CRON_SECRET }))) return new Response('Unauthorized', { status: 401 })
  if (probe) return Response.json(await sendCanvasProbe())
  if (payload.action === 'continue') {
    if (!queueWorkersEnabled()) return Response.json({ disabled: true }, { status: 503 })
    if (typeof payload.jobId !== 'string' || !/^(?:csj-[a-zA-Z0-9-]+|(?:sv|pap)-[a-f0-9-]{36})$/.test(payload.jobId)
      || !Number.isInteger(payload.delaySeconds) || payload.delaySeconds < 0 || payload.delaySeconds > 300)
      return Response.json({ error: 'Invalid continuation.' }, { status: 400 })
    await sendCanvasStep(payload.jobId, payload.delaySeconds)
    return Response.json({ sent: 1 })
  }
  return Response.json(await dispatchCanvasSteps())
}
