import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticateApiKey, createApiKey, listApiKeys, revokeApiKey } from '../lib/api-keys.mjs'
import { authorise, isClerkAdministrator } from '../lib/auth.mjs'
import { deletePersonalData } from '../lib/account-data.mjs'
import { withRequestContext } from '../lib/request-context.mjs'

test('api keys are hashed, scoped, resolvable, and revocable', async () => {
  const userId = `test-keys-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      const created = await createApiKey({ name: 'Agent', scopes: ['write'] })
      assert.match(created.secret, /^wsk_/)
      assert.deepEqual(created.scopes, ['read', 'write'])
      const listed = await listApiKeys()
      assert.equal(listed.length, 1)
      assert.equal(listed[0].secret, undefined)
      assert.equal(listed[0].prefix, created.secret.slice(0, 10))

      const resolved = await authenticateApiKey(created.secret)
      assert.equal(resolved.userId, userId)
      assert.deepEqual(resolved.scopes, ['read', 'write'])
      assert.equal(await authenticateApiKey('wsk_nope'), null)

      await assert.rejects(() => createApiKey({ name: 'Admin', scopes: ['admin'] }), /administrators/)

      assert.equal(await revokeApiKey(created.id), true)
      assert.equal(await authenticateApiKey(created.secret), null)
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})

test('authorise enforces scopes for key requests and admin routes', () => {
  const readOnly = { mode: 'api-key', scopes: ['read'], admin: false }
  assert.equal(authorise(readOnly, { method: 'GET', pathname: '/api/state' }), null)
  assert.match(authorise(readOnly, { method: 'POST', pathname: '/api/sr/review' }), /read-only/)
  assert.match(authorise({ mode: 'api-key', scopes: ['read', 'write'], admin: false }, { method: 'GET', pathname: '/api/admin/courses' }), /Administrator/)
  assert.match(authorise({ mode: 'api-key', scopes: ['read', 'write'], admin: false }, { method: 'GET', pathname: '/api/account/api-keys' }), /Account page/)
  assert.equal(authorise({ mode: 'clerk', admin: true }, { method: 'PUT', pathname: '/api/admin/courses/x' }), null)
  assert.equal(authorise({ mode: 'clerk', admin: false }, { method: 'POST', pathname: '/api/sr/review' }), null)
})

test('Clerk private metadata grants only the explicit global administrator role', () => {
  assert.equal(isClerkAdministrator({ wickerStudyRole: 'admin' }), true)
  assert.equal(isClerkAdministrator({ wickerStudyRole: 'member' }), false)
  assert.equal(isClerkAdministrator({ role: 'admin' }), false)
})
