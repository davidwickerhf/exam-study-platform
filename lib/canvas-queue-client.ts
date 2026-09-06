import { send } from '@vercel/queue'
import { CANVAS_QUEUE_TOPIC, signCanvasTask } from './canvas-queue-protocol.mjs'

type StepResult = { again?: boolean; delay?: number; ids?: string[]; disabled?: boolean }
export async function callCanvasService(payload: Record<string, unknown>): Promise<StepResult> {
  const hostname = process.env.VERCEL_URL
  const origin = process.env.WICKER_API_SERVICE_URL || process.env.WICKER_API_ORIGIN || (hostname ? `https://${hostname}` : '')
  if (!origin) throw new Error('Canvas API service origin is not configured.')
  const body = JSON.stringify(payload)
  const response = await fetch(new URL('api/internal/canvas-queue', `${origin.replace(/\/$/, '')}/`), {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-canvas-task': signCanvasTask(body),
      ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}) },
    body, signal: AbortSignal.timeout(240_000), cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Canvas task service returned ${response.status}.`)
  return response.json()
}
export async function sendCanvasStep(jobId: string, delaySeconds = 0) {
  // The current production dispatcher owns pinning. Consumers request it
  // through the stable production URL rather than pinning continuations here.
  // No deduplication key shared across steps: a new step of the same job must
  // remain deliverable. SQL claims make duplicate notifications harmless.
  await send(CANVAS_QUEUE_TOPIC, { version: 1, jobId }, { retentionSeconds: 604800, delaySeconds })
}
export async function dispatchCanvasSteps() {
  if (process.env.VERCEL_ENV === 'preview') return { disabled: true, sent: 0 }
  const { ids = [] } = await callCanvasService({ action: 'dispatch' })
  const sent: string[] = []
  for (const id of ids) { await sendCanvasStep(id); sent.push(id) }
  if (sent.length) await callCanvasService({ action: 'sent', ids: sent })
  try {
    const { ids: studyIds = [] } = await callCanvasService({ action: 'study-dispatch' })
    for (const id of studyIds) await sendCanvasStep(id)
    return { sent: sent.length, studySent: studyIds.length }
  } catch {
    console.warn('Study dispatch deferred to the next outbox sweep')
    return { sent: sent.length, studySent: 0, studyDeferred: true }
  }
}

export async function sendCanvasProbe() {
  const id = crypto.randomUUID()
  await send(CANVAS_QUEUE_TOPIC, { version: 1, jobId: 'csj-probe', probe: id }, { retentionSeconds: 3600 })
  return { probe: id }
}

// A deployment can still receive its previously pinned notifications after a
// release. Ask the current production dispatcher to publish the next steps.
// Never grow a continuation chain on the obsolete deployment. The minute
// outbox sweep is the fallback if this wake-up fails or run_after is in future.
export async function wakeCurrentCanvasDispatcher() {
  if (process.env.VERCEL_ENV !== 'production') return
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (!host) return
  const body = JSON.stringify({ action: 'dispatch' })
  try {
    const response = await fetch(`https://${host}/internal/canvas-dispatch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-canvas-task': signCanvasTask(body) },
      body, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    })
    if (!response.ok) console.warn('Canvas dispatcher wake-up deferred to cron', response.status)
  } catch { console.warn('Canvas dispatcher wake-up deferred to cron') }
}
