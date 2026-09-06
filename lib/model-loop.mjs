// One tool-calling conversation loop, shared by the setup assistant and the
// tutor. Deliberately separate from the editorial `runCodex` path: that one is
// single-shot with a JSON schema, and these are conversations that call tools
// and come back.

import { readFile } from 'node:fs/promises'
import { openAiReasoningEffort } from './llm-config.mjs'

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

export async function callModel(messages, { tools = [], maxOutputTokens = 1400, responseFormat = null, signal, reasoningEffort = null } = {}) {
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
      ...(reasoningEffort && openAiReasoningEffort(model, reasoningEffort) ? { reasoning_effort: openAiReasoningEffort(model, reasoningEffort) } : {}),
      max_completion_tokens: maxOutputTokens
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]) : AbortSignal.timeout(MODEL_TIMEOUT_MS)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new ModelError(`The assistant is unavailable (${response.status}). ${detail.slice(0, 200)}`)
  }
  const data = await response.json()
  const message = data.choices?.[0]?.message
  if (!message) throw new ModelError('The assistant returned nothing.')
  return { message, usage: data.usage || null, finishReason: data.choices?.[0]?.finish_reason || null }
}

/**
 * Runs a conversation turn to completion: the model may call tools, read their
 * results, and call more, up to `maxRounds`. Returns every message produced so
 * the caller can persist the whole exchange, not just the visible reply.
 *
 * `onToolCall` observes each call for side effects the caller cares about —
 * a control to render, a step completed — without the loop knowing about them.
 */
// Race non-network tool work too: not every source adapter accepts a signal.
// Callers must check the signal before committing any result.
export async function abortable(work, signal) {
  signal?.throwIfAborted()
  if (!signal) return work()
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([Promise.resolve().then(work), aborted]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

export async function runToolLoop({
  messages,
  tools,
  runTool,
  maxRounds = 6,
  maxOutputTokens = 1400,
  onToolCall = () => {},
  signal,
  reasoningEffort = null,
  parallelTools = false,
  toolResultForModel = (_name, result) => result,
  modelCall = callModel,
  responseFormat = null
} = {}) {
  const added = []
  let usage = null
  const remember = message => {
    messages.push(message)
    added.push({ ...message, at: new Date().toISOString() })
  }
  const complete = async (availableTools, budget) => {
    const result = await abortable(() => modelCall(messages, { tools: availableTools, maxOutputTokens: budget, signal, reasoningEffort, ...(responseFormat ? { responseFormat } : {}) }), signal)
    // Account for every request, including empty reasoning-only completions.
    if (result.usage) {
      usage ||= { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) usage[key] += Number(result.usage[key] || 0)
    }
    return result
  }

  for (let round = 0; round < maxRounds; round++) {
    const { message, finishReason } = await complete(tools, maxOutputTokens)
    const calls = message.tool_calls || []
    if (!calls.length) {
      if (String(message.content || '').trim() && finishReason !== 'length') {
        remember({ role: 'assistant', content: message.content })
        return { added, usage, exhausted: false }
      }
      // An empty/truncated completion is not another useful research round.
      // Reserve one larger, tools-disabled request for the actual answer.
      break
    }
    if (finishReason === 'length') throw new ModelError('Tutor could not finish reading the sources. Please retry your question.')
    remember({ role: 'assistant', content: message.content || '', tool_calls: calls })
    const execute = async call => {
      let args = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch {}
      const result = await abortable(() => runTool(call.function?.name, args), signal)
      return { call, args, result }
    }
    // Only independent read tools may overlap. Proposals/mutations keep order.
    const results = parallelTools && calls.every(call => /^(get_|search_)/.test(call.function?.name || ''))
      ? await Promise.all(calls.map(execute))
      : await calls.reduce(async (previous, call) => [...await previous, await execute(call)], Promise.resolve([]))
    for (const { call, args, result } of results) {
      onToolCall(call.function?.name, args, result)
      const serialized = JSON.stringify(toolResultForModel(call.function?.name, result))
      // Never send broken JSON when a broad lookup exceeds the context budget.
      const content = serialized.length <= 60_000 ? serialized : JSON.stringify({ truncated: true, note: 'This source result is incomplete. Narrow the lookup before making claims about omitted material.', excerpt: serialized.slice(0, 58_000) })
      remember({ role: 'tool', tool_call_id: call.id, name: call.function?.name, content })
    }
  }

  messages.push({ role: 'system', content: 'Finish this turn now with an answer to the student, using the evidence already returned. State what could be established, the useful next steps, and any specific gaps. Do not invent missing facts or claim that actions were performed. No more tools are available for this turn.' })
  const { message, finishReason } = await complete([], Math.min(16384, Math.max(8192, maxOutputTokens * 2)))
  if (!String(message.content || '').trim() || message.tool_calls?.length || finishReason === 'length') {
    throw new ModelError('Tutor checked your sources but could not finish an answer. Please retry your question.')
  }
  remember({ role: 'assistant', content: message.content })
  return { added, usage, exhausted: true }
}
