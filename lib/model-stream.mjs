// Assemble the same final message as a non-streaming completion. Only the
// answer's summary field is previewed, never reasoning or tool arguments.
export function partialTutorSummary(content) {
  const match = /^\s*\{\s*"summary"\s*:\s*"/.exec(content)
  if (!match) return ''
  const raw = content.slice(match[0].length)
  let result = ''
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (char === '"') break
    if (char !== '\\') { result += char; continue }
    if (i + 1 >= raw.length) break
    if (raw[i + 1] === 'u') {
      if (i + 5 >= raw.length) break
      try { result += JSON.parse(`"${raw.slice(i, i + 6)}"`) } catch { break }
      i += 5
    } else {
      try { result += JSON.parse(`"${raw.slice(i, i + 2)}"`) } catch { break }
      i++
    }
  }
  return result.replace(/[\uD800-\uDBFF]$/, '')
}

export async function readModelStream(response, onContent) {
  const reader = response.body.getReader(), decoder = new TextDecoder()
  const message = { role: 'assistant', content: '' }, calls = new Map()
  let buffer = '', usage = null, finishReason = null, finished = false
  try {
    while (!finished) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') { finished = true; break }
        const event = JSON.parse(data)
        if (event.error) throw new Error('The model reply was interrupted.')
        if (event.usage) usage = event.usage
        const choice = event.choices?.[0]
        if (!choice) continue
        if (choice.finish_reason) finishReason = choice.finish_reason
        const delta = choice.delta || {}
        for (const part of delta.tool_calls || []) {
          const call = calls.get(part.index) || { id: '', type: 'function', function: { name: '', arguments: '' } }
          if (part.id) call.id = part.id
          if (part.function?.name) call.function.name += part.function.name
          call.function.arguments += part.function?.arguments || ''
          calls.set(part.index, call)
        }
        if (delta.content) {
          message.content += delta.content
          if (!calls.size) onContent(message.content)
        }
      }
      if (done) break
    }
    if (!finishReason) throw new Error('The model reply was interrupted. Please retry.')
    if (calls.size) message.tool_calls = [...calls.values()]
    return { message, usage, finishReason }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
