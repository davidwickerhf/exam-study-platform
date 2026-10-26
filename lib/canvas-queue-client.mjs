import { queueWorkersEnabled, queueDispatcherOrigin, queueRequestHeaders } from './queue-runtime.mjs'
import { CANVAS_QUEUE_TOPIC, queueTopicForJob, signCanvasTask } from './canvas-queue-protocol.mjs'
import { sendJob } from './job-queue.mjs'

// Shared by the Next.js dispatcher route and the pg-boss worker. Every step
// runs in the API service; the queue only carries "work on job X" messages.
export async function callCanvasService(payload) {
  const origin = process.env.WICKER_API_SERVICE_URL || process.env.WICKER_API_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (!origin) throw new Error('Canvas API service origin is not configured.')
  const body = JSON.stringify(payload)
  const response = await fetch(new URL('api/internal/canvas-queue', `${origin.replace(/\/$/, '')}/`), {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-canvas-task': signCanvasTask(body), ...queueRequestHeaders() },
    body, signal: AbortSignal.timeout(payload.action === 'study-step' ? 660_000 : 240_000), cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Canvas task service returned ${response.status}.`)
  return response.json()
}

// No deduplication key shared across steps: a new step of the same job must
// remain deliverable. SQL claims make duplicate notifications harmless.
export async function sendCanvasStep(jobId, delaySeconds = 0) {
  await sendJob(queueTopicForJob(jobId), { version: 1, jobId }, { retentionSeconds: 604800, delaySeconds })
}

export async function dispatchCanvasSteps() {
  if (!queueWorkersEnabled()) return { disabled: true, sent: 0 }
  const { ids = [] } = await callCanvasService({ action: 'dispatch' })
  const sent = []
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

// The former every-minute cron body: dispatch queue steps and run feedback
// maintenance. Throws only when the Canvas dispatch itself failed.
export async function runDispatchSweep() {
  const [canvas, feedback] = await Promise.allSettled([dispatchCanvasSteps(), callCanvasService({ action: 'feedback-maintenance' })])
  const feedbackStatus = feedback.status === 'fulfilled' ? 'processed' : 'deferred'
  if (canvas.status === 'rejected') return { ok: false, error: 'Canvas dispatch failed.', feedback: feedbackStatus }
  return { ok: true, ...canvas.value, feedback: feedbackStatus }
}

export async function sendCanvasProbe() {
  const id = crypto.randomUUID()
  await sendJob(CANVAS_QUEUE_TOPIC, { version: 1, jobId: 'csj-probe', probe: id }, { retentionSeconds: 3600 })
  return { probe: id }
}

// Ask the dispatcher (the web service) to publish the next steps. The minute
// sweep is the fallback if this wake-up fails or run_after is in the future.
export async function wakeCurrentCanvasDispatcher() {
  const origin = queueDispatcherOrigin()
  if (!origin) return
  const body = JSON.stringify({ action: 'dispatch' })
  try {
    const response = await fetch(`${origin}/internal/canvas-dispatch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-canvas-task': signCanvasTask(body), ...queueRequestHeaders() },
      body, signal: AbortSignal.timeout(15_000), cache: 'no-store',
    })
    if (!response.ok) console.warn('Canvas dispatcher wake-up deferred to the minute sweep', response.status)
  } catch { console.warn('Canvas dispatcher wake-up deferred to the minute sweep') }
}
