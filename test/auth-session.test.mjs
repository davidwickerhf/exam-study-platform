import test from 'node:test'
import assert from 'node:assert/strict'
import { safeAuthDestination, createAuthenticatedFetch } from '../lib/workspace/auth-session.mjs'
const origin = 'https://study.example'
const unauthorized = () => Response.json({ error: 'Sign in required', reason: 'session-token-expired' }, { status: 401 })

test('auth redirects preserve workspace routes and reject outside/recursive destinations', () => {
  for (const value of [null, 'https://evil.example/app', '//evil.example/app', '/sign-in?redirect_url=/app', '/app/../sign-up', '/api/account', 'javascript:alert(1)', '/\\evil.example/app']) assert.equal(safeAuthDestination(value, origin), '/app')
  assert.equal(safeAuthDestination('/app/settings/canvas-sync/logs?job=abc#latest', origin), '/app/settings/canvas-sync/logs?job=abc#latest')
  assert.equal(safeAuthDestination(`${origin}/app/courses/ai`, origin), '/app/courses/ai')
  assert.equal(safeAuthDestination('/connect?code=one', origin), '/connect?code=one')
})
test('remote MCP login resumes the exact consent request without allowing arbitrary callbacks', () => {
  const destination = '/connect/remote?request=opaque-request-123'
  const signIn = new URL(`/sign-in?redirect_url=${encodeURIComponent(destination)}`, origin)
  assert.equal(safeAuthDestination(signIn.searchParams.get('redirect_url'), origin), destination)
  assert.equal(safeAuthDestination(`${origin}${destination}`, origin), destination)
  for (const value of ['https://evil.example/connect/remote?request=abc', '//evil.example/connect/remote', '/connect/remote/extra', '/connect/remote/../../api/mcp', '/connect/remote-evil']) {
    assert.equal(safeAuthDestination(value, origin), '/app')
  }
})

test('same-origin API requests go out unchanged, with cookies doing the authentication', async () => {
  const seen = []
  const sessionFetch = createAuthenticatedFetch({ origin, fetchImpl: async (input, init) => { seen.push([input, init.headers ? new Headers(init.headers).get('authorization') : null]); return new Response('ok') } })
  await Promise.all([sessionFetch('/api/auth/session'), sessionFetch('/api/onboarding/status')])
  assert.deepEqual(seen, [['/api/auth/session', null], ['/api/onboarding/status', null]])
})
test('a session the server no longer accepts is reported once per response and never replayed', async () => {
  let requests = 0
  const callbacks = []
  const sessionFetch = createAuthenticatedFetch({ origin, onUnauthorized: failure => callbacks.push(failure.reason), fetchImpl: async () => { requests++; return unauthorized() } })
  assert.equal((await sessionFetch('/api/onboarding/finish', { method: 'POST', body: '{}' })).status, 401)
  assert.equal(requests, 1)
  assert.deepEqual(callbacks, ['session-token-expired'])
})
test('foreign requests, domain errors and eligibility denials are not treated as a lost session', async () => {
  let requests = 0, lost = 0
  const sessionFetch = createAuthenticatedFetch({ origin, onUnauthorized: () => lost++, fetchImpl: async url => { requests++; return url === '/api/denied' ? new Response('', { status: 403 }) : Response.json({ error: 'Canvas token invalid' }, { status: 401 }) } })
  await sessionFetch('https://canvas.example/api/course')
  await sessionFetch('/api/denied')
  await sessionFetch('/api/canvas')
  assert.equal(requests, 3)
  assert.equal(lost, 0)
})
test('aborted startup requests do not reach the server', async () => {
  const controller = new AbortController()
  controller.abort()
  const sessionFetch = createAuthenticatedFetch({ origin, fetchImpl: async () => { throw new Error('Must not send') } })
  await assert.rejects(sessionFetch('/api/state', { signal: controller.signal }), error => error.name === 'AbortError')
})
test('a session switch cancels work queued under the previous account', async () => {
  let active = true
  const sessionFetch = createAuthenticatedFetch({ origin, isActive: () => active, fetchImpl: async () => { throw new Error('Must not send old work under another identity') } })
  active = false
  await assert.rejects(sessionFetch('/api/save', { method: 'POST', body: 'old account data' }), error => error.name === 'AbortError')
})
