// One tool-calling conversation loop, shared by the setup assistant and the
// tutor. Deliberately separate from the editorial `runCodex` path: that one is
// single-shot with a JSON schema, and these are conversations that call tools
// and come back.

import {providerFailure, tutorFailure} from './tutor-errors.mjs'
import { readFile } from 'node:fs/promises'
import { openAiReasoningEffort } from './llm-config.mjs'
import { readModelStream } from './model-stream.mjs'
import { reserveRemoteModelBudget } from './mcp-model-budget.mjs'

export const MODEL_TIMEOUT_MS = 90_000

export class ModelError extends Error {
  constructor(message, status = 502, failure = null) { super(message); this.status = status; if(failure){this.failure=failure;this.code=failure.code} }
}

const validTokens = value => Number.isFinite(Number(value)) ? Math.max(0,Math.floor(Number(value))) : 0

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

export async function callModel(messages, { tools = [], maxOutputTokens = 1400, responseFormat = null, signal, reasoningEffort = null, model: requestedModel = null, onContent } = {}) {
  const { apiKey, model: configuredModel, baseUrl } = await llmSettings()
  const model = requestedModel || configuredModel
  if (!apiKey) throw new ModelError('This conversation needs a language model, and none is configured.', 503)
  const settleRemoteBudget = await reserveRemoteModelBudget({messages,tools,responseFormat},maxOutputTokens)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      ...(onContent ? { stream: true, stream_options: { include_usage: true } } : {}),
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(reasoningEffort && openAiReasoningEffort(model, reasoningEffort) ? { reasoning_effort: openAiReasoningEffort(model, reasoningEffort) } : {}),
      max_completion_tokens: maxOutputTokens
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]) : AbortSignal.timeout(MODEL_TIMEOUT_MS)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const failure=providerFailure(response.status,detail)
    const error = new ModelError(failure.message, response.status, failure)
    // Retain transport metadata, never provider bodies or student content.
    error.providerStatus = response.status
    error.providerRequestId = response.headers.get('x-request-id')?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 160)
    throw error
  }
  if (onContent && response.headers.get('content-type')?.includes('text/event-stream')) {
    const result=await readModelStream(response,onContent)
    await settleRemoteBudget?.(result.usage)
    return result
  }
  const data = await response.json()
  const message = data.choices?.[0]?.message
  if (!message) throw new ModelError('The assistant returned nothing.')
  await settleRemoteBudget?.(data.usage)
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

export function serializeToolResult(result, limit = 60_000) {
  const serialized = JSON.stringify(result)
  if (serialized.length <= limit) return serialized
  // Citation IDs used to sit at the end of the JSON and disappeared when a
  // briefing was clipped. Keep a compact, complete citation table first.
  const evidence = []
  let evidenceSize = 0
  for (const item of result?.evidence || []) {
    if (!item?.id) continue
    const compact = { id: item.id, title: String(item.title || '').slice(0, 160), course: item.course || null, sourceType: item.sourceType,
      location: String(item.location || '').slice(0, 200), excerpt: String(item.excerpt || '').slice(0, 300) }
    const size = JSON.stringify(compact).length
    if (evidenceSize + size > limit / 2) break
    evidence.push(compact)
    evidenceSize += size
  }
  const { evidence: _sources, ...rest } = result
  const raw = JSON.stringify(rest)
  const envelope = { truncated: true, note: 'This source result is incomplete. Narrow the lookup before making claims about omitted material.', evidence,
    omittedEvidence: Math.max(0, (result?.evidence?.length || 0) - evidence.length), excerpt: '' }
  // Escaping nested JSON expands it; budget the actual serialized envelope.
  let low = 0, high = Math.min(raw.length, limit)
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (JSON.stringify({ ...envelope, excerpt: raw.slice(0, mid) }).length <= limit) low = mid
    else high = mid - 1
  }
  return JSON.stringify({ ...envelope, excerpt: raw.slice(0, low) })
}

export async function runToolLoop({
  messages,
  tools,
  runTool,
  maxRounds = 6,
  maxOutputTokens = 1400,
  onToolCall = () => {},
  onModelStart = () => {},
  onContent,
  signal,
  reasoningEffort = null,
  parallelTools = false,
  toolResultForModel = (_name, result) => result,
  modelCall = callModel,
  responseFormat = null,
  reviewAnswer = null,
  maxAnswerRepairs = 1,
  onDiagnostic = () => {}
} = {}) {
  const added = []
  let usage = null
  let answerRepairs = 0
  let requests = 0
  const remember = message => {
    messages.push(message)
    added.push({ ...message, at: new Date().toISOString() })
  }
  const complete = async (availableTools, budget) => {
    onModelStart()
    const format = typeof responseFormat === 'function' ? responseFormat() : responseFormat
    const started = Date.now()
    requests++
    // Keep the provider connection streaming even while drafts are withheld
    // from the browser until they pass review.
    const contentHandler = reviewAnswer ? () => {} : onContent
    const result = await abortable(() => modelCall(messages, { tools: availableTools, maxOutputTokens: budget, signal, reasoningEffort, ...(contentHandler ? { onContent: contentHandler } : {}), ...(format ? { responseFormat: format } : {}) }), signal)
    onDiagnostic({ stage: 'model', request: requests, elapsedMs: Date.now() - started, finishReason: result.finishReason || null })
    // Account for every request, including empty reasoning-only completions.
    if (result.usage) {
      usage ||= { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) usage[key] += validTokens(result.usage[key])
      const details=result.usage.prompt_tokens_details
      if(details && Number.isFinite(details.cached_tokens)) {
        usage.prompt_tokens_details ||= {cached_tokens:0}
        usage.prompt_tokens_details.cached_tokens += Math.min(validTokens(details.cached_tokens),validTokens(result.usage.prompt_tokens))
      }
    }
    return result
  }

  for (let round = 0; round < maxRounds; round++) {
    const { message, finishReason } = await complete(tools, maxOutputTokens)
    const calls = message.tool_calls || []
    if (!calls.length) {
      if (String(message.content || '').trim() && finishReason !== 'length') {
        const correction = reviewAnswer?.(message.content)
        if (correction) {
          onDiagnostic({ stage: 'answer-review', request: requests, repair: answerRepairs + 1 })
          if (answerRepairs++ >= maxAnswerRepairs) throw new ModelError('Tutor could not verify the sources needed for this answer. Please retry your question.', 502, tutorFailure({code:'evidence_check'}))
          // The repair must see the draft it is correcting. Do not persist or
          // stream that rejected draft as an answer.
          messages.push({ role: 'assistant', content: message.content })
          messages.push({ role: 'system', content: correction })
          continue
        }
        if (reviewAnswer) onContent?.(message.content)
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
    const results = parallelTools && calls.every(call => /^(get_|search_|read_)/.test(call.function?.name || ''))
      ? await Promise.all(calls.map(execute))
      : await calls.reduce(async (previous, call) => [...await previous, await execute(call)], Promise.resolve([]))
    for (const { call, args, result } of results) {
      onToolCall(call.function?.name, args, result)
      const content = serializeToolResult(toolResultForModel(call.function?.name, result))
      remember({ role: 'tool', tool_call_id: call.id, name: call.function?.name, content })
    }
  }

  messages.push({ role: 'system', content: 'Finish this turn now with an answer to the student, using the evidence already returned. State what could be established, the useful next steps, and any specific gaps. Do not invent missing facts or claim that actions were performed. No more tools are available for this turn.' })
  const { message, finishReason } = await complete([], Math.min(16384, Math.max(8192, maxOutputTokens * 2)))
  if (!String(message.content || '').trim() || message.tool_calls?.length || finishReason === 'length') {
    throw new ModelError('Tutor checked your sources but could not finish an answer. Please retry your question.')
  }
  if (reviewAnswer?.(message.content)) throw new ModelError('Tutor could not verify the sources needed for this answer. Please retry your question.', 502, tutorFailure({code:'evidence_check'}))
  if (reviewAnswer) onContent?.(message.content)
  remember({ role: 'assistant', content: message.content })
  return { added, usage, exhausted: true }
}
