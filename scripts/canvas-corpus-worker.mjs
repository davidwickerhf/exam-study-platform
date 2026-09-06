import '../lib/env.mjs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { processNextCanvasCorpusJob } from '../lib/canvas-corpus-worker.mjs'
import { hasVerifiedHostedSchema } from '../lib/hosted-schema.mjs'
import { runWorker } from '../lib/worker-runtime.mjs'

if (!process.env.DATABASE_URL) throw new Error('The independent worker requires DATABASE_URL.')
if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('Run this worker on an always-running host, outside Vercel web deployments.')
if (Buffer.from(process.env.CANVAS_CONNECTION_ENCRYPTION_KEY || '', 'base64').length !== 32) throw new Error('The worker requires the same Canvas encryption key as the API.')
for (const [command, args] of [['pdftotext', ['-v']], ['pdftoppm', ['-v']], ['tesseract', ['--version']], ['unzip', ['-v']]]) {
  execFileSync(command, args, { stdio: 'ignore', timeout: 5000 })
}
if (!await hasVerifiedHostedSchema(process.cwd())) throw new Error('Apply tracked database migrations before starting this worker.')

const controller = new AbortController()
let state = 'starting'
let changedAt = Date.now()
const health = createServer((req, res) => {
  if (req.url !== '/healthz') { res.writeHead(404); res.end(); return }
  const ok = !controller.signal.aborted && ['working', 'idle'].includes(state) && Date.now() - changedAt < 35 * 60_000
  res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ ok, service: 'canvas-worker', state }))
})
health.listen(Number(process.env.CANVAS_WORKER_HEALTH_PORT || process.env.PORT || 8080), '0.0.0.0')
health.on('error', error => { console.error(error); process.exit(1) })
function shutdown() {
  if (controller.signal.aborted) return
  controller.abort()
  // Native tools may still be finishing. Lease fencing prevents late writes;
  // the deployment must stop in bounded time even if an external call hangs.
  setTimeout(() => process.exit(0), 25_000).unref()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
console.log('Independent Canvas worker ready; web traffic is not required.')
await runWorker({
  processJob: processNextCanvasCorpusJob,
  signal: controller.signal,
  intervalMs: Math.max(1000, Number(process.env.CANVAS_CORPUS_WORKER_INTERVAL_MS || 5000)),
  onState: next => { state = next; changedAt = Date.now() },
  onError: error => console.error('Canvas worker poll failed:', error)
})
health.close()
