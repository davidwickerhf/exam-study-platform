// One tool-calling conversation loop, shared by the setup assistant and the
// tutor. Deliberately separate from the editorial `runCodex` path: that one is
// single-shot with a JSON schema, and these are conversations that call tools
// and come back.

import { readFile } from 'node:fs/promises'

export const MODEL_TIMEOUT_MS = 90_000

export class ModelError extends Error {
  constructor(message, status = 502) { super(message); this.status = status }
}

let cachedConfig
export async function llmSettings(env = process.env) {
  if (!cachedConfig) {
    try { cachedConfig = JSON.parse(await readFile(new URL('../data/llm-config.json', import.meta.url), 'utf8')) }
    catch { cachedConfig = {} }
  }
  return {
    apiKey: env.OPENAI_API_KEY || cachedConfig.openaiApiKey || '',
    model: env.CHAT_MODEL || env.OPENAI_MODEL || cachedConfig.openaiModel || 'gpt-5-mini',
    baseUrl: (env.OPENAI_BASE_URL || cachedConfig.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  }
}

export function chatAvailable(env = process.env) {
  const provider = String(env.LLM_PROVIDER || 'codex').toLowerCase()
  // The CLI providers are a developer convenience and are not driven per turn.
  return provider === 'openai' ? Boolean(env.OPENAI_API_KEY) : false
}

export async function callModel(messages, { tools = [], maxOutputTokens = 1400, responseFormat = null, signal } = {}) {
  const { apiKey, model, baseUrl } = await llmSettings()
  if (!apiKey) throw new ModelError('This conversation needs a language model, and none is configured.', 503)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      max_completion_tokens: maxOutputTokens
    }),
    signal: signal ?? AbortSignal.timeout(MODEL_TIMEOUT_MS)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ModelError(`The assistant is unavailable (${response.status}). ${detail.slice(0, 200)}`)
  }
  const data = await response.json()
  const message = data.choices?.[0]?.message
  if (!message) throw new ModelError('The assistant returned nothing.')
  return { message, usage: data.usage || null }
}

/**
 * Runs a conversation turn to completion: the model may call tools, read their
 * results, and call more, up to `maxRounds`. Returns every message produced so
 * the caller can persist the whole exchange, not just the visible reply.
 *
 * `onToolCall` observes each call for side effects the caller cares about —
 * a control to render, a step completed — without the loop knowing about them.
 */
export async function runToolLoop({
  messages,
  tools,
  runTool,
  maxRounds = 6,
  maxOutputTokens = 1400,
  onToolCall = () => {}
} = {}) {
  const added = []
  let usage = null

  for (let round = 0; round < maxRounds; round++) {
    const { message, usage: turnUsage } = await callModel(messages, { tools, maxOutputTokens })
    usage = turnUsage || usage
    const calls = message.tool_calls || []
    messages.push(message)
    added.push({ role: 'assistant', content: message.content || '', tool_calls: calls.length ? calls : undefined, at: new Date().toISOString() })

    if (!calls.length) {
      // An assistant turn with nothing in it is a dead end for the reader, not
      // a valid reply. Ask once more before giving up on the turn.
      if (!String(message.content || '').trim()) {
        added.pop()
        messages.push({ role: 'system', content: 'Your last reply was empty. Answer the question now, in your own words.' })
        continue
      }
      return { added, usage, exhausted: false }
    }

    for (const call of calls) {
      let args = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch {}
      const result = await runTool(call.function?.name, args)
      onToolCall(call.function?.name, args, result)
      const payload = { role: 'tool', tool_call_id: call.id, name: call.function?.name, content: JSON.stringify(result).slice(0, 60_000) }
      messages.push(payload)
      added.push({ ...payload, at: new Date().toISOString() })
    }
  }

  return { added, usage, exhausted: true }
}
