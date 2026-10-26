import { queueWorkersEnabled } from './queue-runtime.mjs'
import { callCanvasService, dispatchCanvasSteps } from './canvas-queue-client.mjs'

const JOB_ID = /^(?:csj-[a-zA-Z0-9-]+|(?:sv|pap)-[a-f0-9-]{36})$/

// Body of the former /internal/canvas-consume and /internal/study-consume
// Vercel Queue callbacks. A thrown error makes pg-boss retry the message.
export async function processCanvasQueueMessage(message) {
  if (message?.version !== 1 || typeof message.jobId !== 'string' || !JOB_ID.test(message.jobId)) {
    // Malformed messages can never succeed; drop them rather than retrying.
    console.error('Dropping invalid Canvas task', message)
    return { invalid: true }
  }
  if (message.jobId === 'csj-probe' && message.probe) {
    await callCanvasService({ action: 'probe' })
    console.info('Canvas queue probe delivered through API', message.probe)
    return { probe: message.probe }
  }
  if (!queueWorkersEnabled()) return { disabled: true }
  const study = /^(sv|pap)-/.test(message.jobId)
  if (study) console.info('Study queue step started', message.jobId)
  const result = await callCanvasService({ action: study ? (message.jobId.startsWith('pap-') ? 'paper-step' : 'study-step') : 'step', jobId: message.jobId })
  if (study) console.info('Study queue step finished', message.jobId, result)
  // Publish the next steps now instead of waiting for the minute sweep. A
  // failure here only defers them; the step itself already checkpointed.
  try { await dispatchCanvasSteps() } catch (error) { console.warn('Canvas dispatch deferred to the minute sweep:', error?.message || error) }
  return result
}
