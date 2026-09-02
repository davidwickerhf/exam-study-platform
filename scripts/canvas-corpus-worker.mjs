import '../lib/env.mjs'
import { processNextCanvasCorpusJob } from '../lib/canvas-corpus-worker.mjs'

const intervalMs = Math.max(1_000, Number(process.env.CANVAS_CORPUS_WORKER_INTERVAL_MS || 5_000))
let stopping = false

process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

console.log('Canvas corpus worker process: ready')
while (!stopping) {
  try {
    const worked = await processNextCanvasCorpusJob()
    if (worked) continue
  } catch (error) {
    console.error('Canvas corpus worker process failed:', error)
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs))
}
