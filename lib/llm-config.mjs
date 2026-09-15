export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini'
export const DEFAULT_OPENAI_REASONING_EFFORT = 'low'

export const OPENAI_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high'])

export function openAiReasoningEffort(model, configured = DEFAULT_OPENAI_REASONING_EFFORT) {
  if (!/^gpt-(?:5|6)(?:[-.]|$)/i.test(String(model || '').trim())) return null
  const normalized = String(configured || '').trim().toLowerCase()
  if (/^gpt-6-astra(?:-|$)/i.test(model) && normalized === 'minimal') return 'low'
  return OPENAI_REASONING_EFFORTS.has(normalized) ? normalized : DEFAULT_OPENAI_REASONING_EFFORT
}

export function publicLlmConfiguration({
  provider,
  codexModel = '',
  claudeModel = '',
  anthropicModel = '',
  openAiModel = DEFAULT_OPENAI_MODEL,
  openAiReasoning = DEFAULT_OPENAI_REASONING_EFFORT,
  configured = false
}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase()
  const model = normalizedProvider === 'openai' ? openAiModel
    : normalizedProvider === 'api' || normalizedProvider === 'anthropic' ? anthropicModel
      : normalizedProvider === 'codex' ? codexModel
        : normalizedProvider === 'claude' ? claudeModel
          : ''
  const reasoningEffort = normalizedProvider === 'openai'
    ? openAiReasoningEffort(openAiModel, openAiReasoning)
    : null

  return {
    provider: normalizedProvider,
    ...(model ? { model } : {}),
    configured: Boolean(configured),
    ...(reasoningEffort ? { reasoningEffort } : {})
  }
}
