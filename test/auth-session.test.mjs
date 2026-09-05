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
test('parallel API requests share token resolution without caching an expiring token', async () => {
  let count = 0
  const seen = []
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async () => `token-${++count}`, fetchImpl: async (_, init) => { seen.push(init.headers.get('authorization')); return new Response('ok') } })
  await Promise.all([signedFetch('/api/auth/session'), signedFetch('/api/onboarding/status')])
  assert.equal(count, 1)
  assert.deepEqual(seen, ['Bearer token-1', 'Bearer token-1'])
  await signedFetch('/api/state')
  assert.equal(count, 2, 'ask Clerk again so its expiry rules govern reuse')
})
test('an expired token is refreshed once without signing out or losing a POST body', async () => {
  const tokens = [], bodies = [], callbacks = []
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async options => { tokens.push(options); return options?.skipCache ? 'fresh' : 'old' }, onUnauthorized: e => callbacks.push(e), fetchImpl: async (_, init) => { bodies.push(init.body); return init.headers.get('authorization') === 'Bearer old' ? unauthorized() : new Response('ok') } })
  const response = await signedFetch('/api/onboarding/finish', { method: 'POST', body: '{"skip":false}' })
  assert.equal(response.status, 200)
  assert.deepEqual(tokens, [undefined, { skipCache: true }])
  assert.deepEqual(bodies, ['{"skip":false}', '{"skip":false}'])
  assert.equal(callbacks.length, 0)
})
test('Request bodies remain replayable on a confirmed pre-handler authentication failure', async () => {
  let calls = 0
  const bodies = []
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async () => 'token', fetchImpl: async input => { bodies.push(await input.text()); return ++calls === 1 ? unauthorized() : new Response('ok') } })
  const input = new Request(`${origin}/api/save`, { method: 'POST', body: 'content' })
  assert.equal((await signedFetch(input)).status, 200)
  assert.deepEqual(bodies, ['content', 'content'])
})
test('a second authentication rejection stops retrying and reports recovery once', async () => {
  let requests = 0, recovered = 0
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async () => 'token', fetchImpl: async () => { requests++; return unauthorized() }, onUnauthorized: () => recovered++ })
  assert.equal((await signedFetch('/api/state')).status, 401)
  assert.equal(requests, 2)
  assert.equal(recovered, 1)
})
test('foreign requests, domain errors and eligibility denials do not refresh or replay', async () => {
  let tokens = 0, requests = 0
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async () => { tokens++; return 'token' }, fetchImpl: async url => { requests++; return url === '/api/denied' ? new Response('', { status: 403 }) : Response.json({ error: 'Canvas token invalid' }, { status: 401 }) } })
  await signedFetch('https://canvas.example/api/course')
  assert.equal(tokens, 0)
  await signedFetch('/api/denied')
  await signedFetch('/api/canvas')
  assert.equal(tokens, 2)
  assert.equal(requests, 3)
})
test('a stuck token lookup times out and can be tried again', async () => {
  let attempt = 0
  const signedFetch = createAuthenticatedFetch({ origin, tokenTimeoutMs: 5, getToken: () => ++attempt === 1 ? new Promise(() => {}) : Promise.resolve('token'), fetchImpl: async () => new Response('ok') })
  await assert.rejects(signedFetch('/api/state'), /taking longer/)
  assert.equal((await signedFetch('/api/state')).status, 200)
})
test('aborted startup requests do not reach the server after token resolution', async () => {
  const controller = new AbortController()
  controller.abort()
  const signedFetch = createAuthenticatedFetch({ origin, getToken: async () => 'token', fetchImpl: async () => { throw new Error('Must not send') } })
  await assert.rejects(signedFetch('/api/state', { signal: controller.signal }), error => error.name === 'AbortError')
})


test('a session switch cancels a pending request before it can use the next account token', async () => {
  let active = true, release
  const signedFetch = createAuthenticatedFetch({ origin, isActive: () => active, getToken: () => new Promise(resolve => { release = resolve }), fetchImpl: async () => { throw new Error('Must not send old work under another identity') } })
  const request = signedFetch('/api/save', { method: 'POST', body: 'old account data' })
  await Promise.resolve()
  active = false
  release('new-account-token')
  await assert.rejects(request, error => error.name === 'AbortError')
})
