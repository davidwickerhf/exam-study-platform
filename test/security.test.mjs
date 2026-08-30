import test from 'node:test'
import assert from 'node:assert/strict'
import { consume, classifyRequest, resetRateLimits } from '../lib/rate-limit.mjs'
import { assertPublicUrl, isForbiddenCrossSite, isPrivateAddress, contentSecurityPolicy } from '../lib/security.mjs'

test('rate limiter counts within a window and resets after it', () => {
  resetRateLimits()
  const now = 1_000_000
  for (let i = 0; i < 3; i++) assert.equal(consume('k', { limit: 3, windowMs: 1000, now }).allowed, true)
  const blocked = consume('k', { limit: 3, windowMs: 1000, now })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfter, 1)
  assert.equal(consume('k', { limit: 3, windowMs: 1000, now: now + 1001 }).allowed, true)
})

test('requests are classified into policies', () => {
  assert.equal(classifyRequest('GET', '/api/state'), 'user')
  assert.equal(classifyRequest('POST', '/api/sr/review'), 'write')
  assert.equal(classifyRequest('POST', '/api/chat'), 'ai')
  assert.equal(classifyRequest('POST', '/api/account/api-keys'), 'keyCreate')
  assert.equal(classifyRequest('DELETE', '/api/account'), 'accountDanger')
  assert.equal(classifyRequest('PUT', '/api/admin/courses/x/materials'), 'upload')
  assert.equal(classifyRequest('PUT', '/api/admin/courses/x'), 'admin')
})

test('private addresses are rejected by the SSRF guard', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', '100.64.0.1']) assert.equal(isPrivateAddress(ip), true, ip)
  assert.equal(isPrivateAddress('93.184.216.34'), false)
  await assert.rejects(() => assertPublicUrl('http://127.0.0.1/x'), /Private/)
  await assert.rejects(() => assertPublicUrl('http://localhost/x'), /Internal/)
  await assert.rejects(() => assertPublicUrl('ftp://example.com/x'), /http\(s\)/)
  await assert.rejects(() => assertPublicUrl('http://user:pw@example.com/x'), /credentials/)
  await assert.rejects(() => assertPublicUrl('http://example.com:8080/x'), /ports/)
})

test('cookie-authenticated cross-site mutations are refused, bearer calls are not', () => {
  const base = { method: 'POST', headers: { host: 'study.wicker.life' } }
  assert.equal(isForbiddenCrossSite({ ...base, headers: { ...base.headers, 'sec-fetch-site': 'cross-site' } }), true)
  assert.equal(isForbiddenCrossSite({ ...base, headers: { ...base.headers, origin: 'https://evil.example' } }), true)
  assert.equal(isForbiddenCrossSite({ ...base, headers: { ...base.headers, 'sec-fetch-site': 'same-origin' } }), false)
  assert.equal(isForbiddenCrossSite({ ...base, headers: { ...base.headers, 'sec-fetch-site': 'cross-site', authorization: 'Bearer x' } }), false)
  assert.equal(isForbiddenCrossSite({ method: 'GET', headers: { 'sec-fetch-site': 'cross-site' } }), false)
})

test('the CSP forbids inline scripts and framing', () => {
  const csp = contentSecurityPolicy()
  assert.match(csp, /frame-ancestors 'none'/)
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp))
  assert.ok(!/script-src[^;]*unsafe-eval/.test(csp))
})
