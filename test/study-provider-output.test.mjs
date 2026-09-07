import test from 'node:test'
import assert from 'node:assert/strict'
import { openAiResponseText, studyReviewTokenLimit } from '../lib/study-provider-output.mjs'
import { StudyVersionError } from '../lib/study-version-content.mjs'
test('incomplete provider output produces an actionable safe error instead of parsing truncated JSON', () => {
  assert.throws(() => openAiResponseText({ choices: [{ finish_reason: 'length', message: { content: '{"issues":[' } }] }), e => e instanceof StudyVersionError && /token limit/.test(e.message))
  assert.throws(() => openAiResponseText({ choices: [{ message: { refusal: 'sensitive upstream detail' } }] }), e => !e.message.includes('sensitive') && e.status === 422)
  assert.throws(() => openAiResponseText({ choices: [] }), /empty response/)
  assert.equal(openAiResponseText({ choices: [{ finish_reason: 'stop', message: { content: ' {"issues":[]} ' } }] }), '{"issues":[]}')
  assert.equal(studyReviewTokenLimit('gpt-5.4'), 8000)
  assert.equal(studyReviewTokenLimit('gpt-5-mini'), 4000)
})
