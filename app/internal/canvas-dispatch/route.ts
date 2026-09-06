import { timingSafeEqual } from 'node:crypto'
import { dispatchCanvasSteps, sendCanvasProbe } from '@/lib/canvas-queue-client'
import { verifyCanvasTask } from '@/lib/canvas-queue-protocol.mjs'
export const maxDuration = 60
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  const actual = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return new Response('Unauthorized', { status: 401 })
  return Response.json(await dispatchCanvasSteps())
}
export async function POST(request: Request) {
  const body = await request.text()
  if (!verifyCanvasTask(body, request.headers.get('x-canvas-task'))) return new Response('Unauthorized', { status: 401 })
  if (JSON.parse(body).probe === true) return Response.json(await sendCanvasProbe())
  return Response.json(await dispatchCanvasSteps())
}
