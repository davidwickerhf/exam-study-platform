import { tutorFailure, type TutorFailure } from '../tutor-errors.mjs'

export class TutorReplyError extends Error {
  failure: TutorFailure
  constructor(value: {error?: string; failure?: {code?: string}}) {
    const failure = tutorFailure(value)
    super(failure.message)
    this.failure = failure
  }
}

export async function tutorStream<T>(path: string, init: RequestInit, onProgress: (message: string) => void, onAnswer: (text: string) => void = () => {}, { idleTimeoutMs = 45_000 } = {}): Promise<T> {
  const signal = AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(190_000)])
  const response = await fetch(path, { ...init, signal, headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', ...init.headers } })
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json()
    if (!response.ok) throw new TutorReplyError(value)
    return value as T
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Tutor could not open the reply stream.')
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      // Heartbeats keep a healthy, slow turn alive. A lost connection must not
      // leave the composer waiting indefinitely, even if a proxy stalls EOF.
      const readSignal = AbortSignal.any([signal, AbortSignal.timeout(idleTimeoutMs)])
      readSignal.throwIfAborted()
      let onAbort: () => void = () => {}
      const interrupted = new Promise<never>((_, reject) => {
        onAbort = () => reject(readSignal.reason)
        readSignal.addEventListener('abort', onAbort, { once: true })
      })
      const { done, value } = await Promise.race([reader.read(), interrupted]).finally(() => readSignal.removeEventListener('abort', onAbort))
      buffer += decoder.decode(value, { stream: !done })
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1)
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'progress' && event.stage === 'answer-text') onAnswer(event.text)
        else if (event.type === 'progress') onProgress(event.message)
        if (event.type === 'error') throw new TutorReplyError(event)
        if (event.type === 'result') return event.result as T
      }
      if (done) throw new Error('The reply was interrupted. Please retry your question.')
    }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
}
