import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteDocument } from '../lib/user-store.mjs'
import {
  AI_LIMITS,
  AiLimitError,
  completeAiUsage,
  estimateTokens,
  getAiUsageSummary,
  reserveAiUsage
} from '../lib/ai-usage.mjs'

test('AI usage is accounted per user and enforces the minute request limit', async () => {
  const userId = `test-ai-${Date.now()}-${Math.random().toString(16).slice(2)}`

  try {
    await withRequestContext({ userId }, async () => {
      assert.equal(estimateTokens('12345'), 2)

      for (let index = 0; index < AI_LIMITS.chat.requestsPerMinute; index += 1) {
        const reservation = await reserveAiUsage('chat', { inputTokens: 10, maxOutputTokens: 20 })
        await completeAiUsage(reservation, { inputTokens: 8, outputTokens: 12, estimated: false })
      }

      const summary = await getAiUsageSummary()
      assert.equal(summary.usage.minute.requests.chat, AI_LIMITS.chat.requestsPerMinute)
      assert.equal(summary.usage.minute.requests.intake, 0)
      assert.equal(summary.usage.today.tokens, AI_LIMITS.chat.requestsPerMinute * 20)
      assert.equal(summary.remaining.chatToday, AI_LIMITS.chat.requestsPerDay - AI_LIMITS.chat.requestsPerMinute)
      assert.equal(summary.remaining.intakeToday, AI_LIMITS.intake.requestsPerDay)

      await assert.rejects(
        () => reserveAiUsage('chat', { inputTokens: 10, maxOutputTokens: 20 }),
        (error) => error instanceof AiLimitError && error.reason === 'minute_requests' && error.status === 429
      )
    })
  } finally {
    await withRequestContext({ userId }, () => deleteDocument('ai', 'usage'))
  }
})
