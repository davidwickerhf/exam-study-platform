import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceCache, workspaceWriteAffectsReads } from '../lib/workspace/resource-cache.mjs'
const response = value => ({ ok: true, json: async () => value })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('navigation shares in-flight reads and instantly reuses fresh data; stale data stays visible', async () => {
  let at = 100_000, calls = 0
  const cache = createResourceCache({ now: () => at, fetchImpl: async () => { calls++; return response({ calls }) } })
  const first = cache.load('/api/academics')
  assert.equal(cache.load('/api/academics'), first)
  await first
  await cache.load('/api/academics')
  assert.equal(calls, 1)
  at += 301_000
  const revalidating = cache.load('/api/academics')
  assert.deepEqual(cache.read('/api/academics').data, { calls: 1 })
  await revalidating
  assert.equal(calls, 2)
})

test('account change cannot expose cached facts or publish a late previous-account response', async () => {
  const old = deferred(); let calls = 0
  const cache = createResourceCache({ fetchImpl: () => ++calls === 1 ? old.promise : Promise.resolve(response('new account')) })
  cache.setScope('one')
  const pending = cache.load('/api/academics'); await Promise.resolve()
  cache.setScope('two')
  assert.equal(cache.read('/api/academics').data, undefined)
  await cache.load('/api/academics')
  old.resolve(response('old account')); await pending
  assert.equal(cache.read('/api/academics').data, 'new account')
})

test('edits fence stale pending reads and notify mounted readers without blanking their page', async () => {
  let calls = 0; const slow = deferred()
  const cache = createResourceCache({ fetchImpl: () => ++calls === 2 ? slow.promise : Promise.resolve(response(calls)) })
  await cache.load('/api/state')
  const pending = cache.load('/api/state', { force: true }); await Promise.resolve()
  let notified = 0; cache.subscribe('/api/state', () => notified++)
  cache.invalidate()
  assert.equal(cache.read('/api/state').data, 1)
  assert.equal(cache.read('/api/state').version, 1)
  await cache.load('/api/state')
  slow.resolve(response('stale')); await pending
  assert.equal(cache.read('/api/state').data, 3)
  assert.ok(notified >= 2)
})

test('failed refresh preserves data and actionable server error', async () => {
  let fail = false
  const cache = createResourceCache({ fetchImpl: async () => fail ? { ok: false, status: 503, json: async () => ({ error: 'Temporarily offline' }) } : response(92) })
  await cache.load('/api/academics'); fail = true
  await cache.load('/api/academics', { force: true })
  assert.equal(cache.read('/api/academics').data, 92)
  assert.equal(cache.read('/api/academics').error.message, 'Temporarily offline')
  assert.equal(workspaceWriteAffectsReads('/api/items/one', 'PATCH'), true)
  assert.equal(workspaceWriteAffectsReads('/api/browser-state', 'PUT'), false)
  assert.equal(workspaceWriteAffectsReads('/api/tutor/conversations/one', 'POST'), true)
  assert.equal(workspaceWriteAffectsReads('/api/tutor/actions', 'POST'), true)
})

test('ordinary navigation after four minutes reuses stable data but refreshes live syncs', async () => {
  let at = 100_000; const calls = []
  const cache = createResourceCache({ now: () => at, fetchImpl: async path => { calls.push(path); return response(path) } })
  await cache.load('/api/academics'); await cache.load('/api/account/integrations/canvas/corpus?view=summary')
  at += 240_000
  await cache.load('/api/academics'); await cache.load('/api/account/integrations/canvas/corpus?view=summary')
  assert.equal(calls.filter(path => path === '/api/academics').length, 1)
  assert.equal(calls.length, 3)
})

test('deleting a Tutor source invalidates cached context without rebuilding courses or Canvas', async () => {
  const { workspaceInvalidationTargets } = await import('../lib/workspace/resource-cache.mjs')
  const cache = createResourceCache({ fetchImpl: async path => response(path) })
  for (const path of ['/api/tutor?view=sources', '/api/academics', '/api/integrations/canvas/hub']) await cache.load(path)
  cache.invalidate(workspaceInvalidationTargets('/api/tutor/attachments/source'))
  assert.equal(cache.read('/api/tutor?view=sources').version, 1)
  assert.equal(cache.read('/api/academics').version, 0)
  assert.equal(cache.read('/api/integrations/canvas/hub').version, 0)
})
