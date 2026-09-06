export async function tutorStream<T>(path: string, init: RequestInit, onProgress: (message: string) => void, onAnswer: (text: string) => void = () => {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', ...init.headers } })
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || 'Tutor could not answer.')
    return value as T
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Tutor could not open the reply stream.')
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1)
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'progress' && event.stage === 'answer-text') onAnswer(event.text)
        else if (event.type === 'progress') onProgress(event.message)
        if (event.type === 'error') throw new Error(event.error || 'Tutor could not finish. Please retry.')
        if (event.type === 'result') return event.result as T
      }
      if (done) throw new Error('The reply was interrupted. Please retry your question.')
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
