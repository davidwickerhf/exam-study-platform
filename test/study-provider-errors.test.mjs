import test from 'node:test'
import assert from 'node:assert/strict'
import { studyProviderError } from '../lib/study-provider-errors.mjs'

test('generation distinguishes credit exhaustion, throttling and configuration without leaking provider details', async () => {
  for (const [status, detail, code, message] of [
    [429, {type:'insufficient_quota',message:'You have no credits remaining. private-account'}, 'provider_credits', /Restore its credits/],
    [429, {code:'rate_limit_exceeded',message:'private-account'}, 'provider_rate_limit', /Wait a little/],
    [400, {message:'Your credit balance is too low to access the Anthropic API. private-account'}, 'provider_credits', /Restore its credits/],
    [401, {message:'private-account'}, 'provider_configuration', /API key and model access/],
    [503, {message:'private-account'}, 'provider_unavailable', /Try again shortly/]
  ]) {
    const error = await studyProviderError(new Response(JSON.stringify({error:detail}), {status}))
    assert.equal(error.code, code)
    assert.match(error.message, message)
    assert.doesNotMatch(error.message, /private-account|HTTP|insufficient_quota/)
    assert.equal(error.status, 502)
    assert.equal(error.retryAfter, undefined, 'no automatic paid retry')
  }
})

test('oversized and malformed upstream bodies are bounded and never displayed', async () => {
  let cancelled = false, pulls = 0
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(10_000).fill(120)) },
    cancel() { cancelled = true }
  })
  const error = await studyProviderError(new Response(body, {status:429}))
  assert.equal(error.code, 'provider_rate_limit')
  assert.ok(cancelled)
  assert.ok(pulls <= 3)
  const malformed = await studyProviderError(new Response('<html>private-account</html>', {status:502}))
  assert.equal(malformed.code, 'provider_unavailable')
  assert.doesNotMatch(malformed.message, /private-account/)
})
