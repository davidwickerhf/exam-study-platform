import { createHmac, timingSafeEqual } from 'node:crypto'
export const CANVAS_QUEUE_TOPIC = 'canvas-sync-v1'
export function signCanvasTask(body, timestamp = String(Date.now()), key = process.env.CANVAS_CONNECTION_ENCRYPTION_KEY) {
  if (!key) throw new Error('Canvas service signing is not configured.')
  const signature = createHmac('sha256', key).update(`wicker:canvas-queue:v1:${timestamp}:${body}`).digest('hex')
  return `${timestamp}.${signature}`
}
export function verifyCanvasTask(body, signature, { now = Date.now(), key = process.env.CANVAS_CONNECTION_ENCRYPTION_KEY } = {}) {
  if (!key || typeof signature !== 'string' || !/^\d{13}\.[a-f0-9]{64}$/.test(signature)) return false
  const [timestamp, mac] = signature.split('.')
  if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(mac || '') || Math.abs(now - Number(timestamp)) > 300_000) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(signCanvasTask(body, timestamp, key)))
}
export class CanvasCheckpointYield extends Error {
  constructor() { super('Progress saved; continuing in the next queue task.'); this.checkpointYield = true }
}
export function resourceId(jobId, path) {
  return `cqr-${createHmac('sha256', jobId).update(path).digest('hex').slice(0, 40)}`
}
export function validateDownloadRange(response, offset, expectedTotal, etag) {
  if (!response.ok) throw new Error(`Canvas file download failed (HTTP ${response.status}).`)
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '')
  const receivedEtag = response.headers.get('etag')
  if (offset && etag && receivedEtag !== etag) throw new Error('Canvas file changed during download; retry to collect its new version.')
  if (response.status === 206 && (!match || Number(match[1]) !== offset || Number(match[2]) < offset)) throw new Error('Canvas returned an unexpected byte range.')
  const total = match ? Number(match[3]) : Number(response.headers.get('content-length'))
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Canvas did not provide a verifiable file size.')
  if (expectedTotal != null && Number(expectedTotal) !== total) throw new Error('Canvas file size changed during download; retry to collect its new version.')
  return { total, start: response.status === 206 ? offset : 0, end: match ? Number(match[2]) + 1 : total, etag: receivedEtag }
}
