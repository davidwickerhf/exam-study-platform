import { timingSafeEqual } from 'node:crypto'
import { dispatchCanvasSteps, sendCanvasProbe, callCanvasService } from '@/lib/canvas-queue-client'
import { verifyCanvasTask } from '@/lib/canvas-queue-protocol.mjs'
export const maxDuration = 60
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  const actual = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return new Response('Unauthorized', { status: 401 })
  const result = await dispatchCanvasSteps()
  await callCanvasService({ action: "feedback-maintenance" }).catch(() => {})
  return Response.json(result)
}
export async function POST(request: Request) {
  const body = await request.text()
  const probe = JSON.parse(body).probe === true
  const signature = request.headers.get('x-canvas-task')
  if (!verifyCanvasTask(body, signature) && !(probe && verifyCanvasTask(body, signature, { key: process.env.CRON_SECRET }))) return new Response('Unauthorized', { status: 401 })
  if (probe) return Response.json(await sendCanvasProbe())
  return Response.json(await dispatchCanvasSteps())
}
