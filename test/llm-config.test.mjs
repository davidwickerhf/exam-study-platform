import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_OPENAI_MODEL,
  openAiReasoningEffort,
  publicLlmConfiguration
} from '../lib/llm-config.mjs'

test('the hosted OpenAI default is the cost-sensitive GPT-5 mini model', () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5-mini')
  assert.equal(openAiReasoningEffort('gpt-5-mini', 'low'), 'low')
  assert.equal(openAiReasoningEffort('gpt-5.6', 'high'), 'high')
  assert.equal(openAiReasoningEffort('gpt-4.1', 'low'), null)
})

test('invalid reasoning settings fall back safely and public status contains no secret', () => {
  const status = publicLlmConfiguration({
    provider: 'openai',
    openAiModel: 'gpt-5-mini',
    openAiReasoning: 'unbounded',
    configured: true
  })

  assert.deepEqual(status, {
    provider: 'openai',
    model: 'gpt-5-mini',
    configured: true,
    reasoningEffort: 'low'
  })
  assert.doesNotMatch(JSON.stringify(status), /api.?key|secret|bearer/i)
})


test('GPT-6 guide calls retain medium reasoning and map unsupported minimal to low',()=>{
  assert.equal(openAiReasoningEffort('gpt-6-astra','medium'),'medium')
  assert.equal(openAiReasoningEffort('gpt-6-astra','minimal'),'low')
  assert.equal(openAiReasoningEffort('gpt-6-sol','medium'),'medium')
  assert.equal(openAiReasoningEffort('gpt-6-sol','minimal'),'low')
  assert.equal(openAiReasoningEffort('gpt-5.6-sol','medium'),'medium')
})
