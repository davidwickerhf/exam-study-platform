import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocalTestUser } from '../lib/auth.mjs'

test('unset means no local test user', () => {
  assert.equal(resolveLocalTestUser({}), null)
  assert.equal(resolveLocalTestUser({ WICKER_LOCAL_USER: '   ' }), null)
})

test('a plain identifier resolves', () => {
  assert.equal(resolveLocalTestUser({ WICKER_LOCAL_USER: 'user_localtest' }), 'user_localtest')
  assert.equal(resolveLocalTestUser({ WICKER_LOCAL_USER: '  user_localtest  ' }), 'user_localtest')
})

// The setting hands an unauthenticated caller a real user's data, so every
// environment that could be a real deployment must refuse to start.
test('production environments refuse it', () => {
  assert.throws(() => resolveLocalTestUser({ WICKER_LOCAL_USER: 'user_localtest', NODE_ENV: 'production' }), /development-only/)
  assert.throws(() => resolveLocalTestUser({ WICKER_LOCAL_USER: 'user_localtest', VERCEL: '1' }), /development-only/)
})

test('it cannot be combined with Clerk', () => {
  assert.throws(() => resolveLocalTestUser({
    WICKER_LOCAL_USER: 'user_localtest',
    CLERK_SECRET_KEY: 'sk_test_x',
    CLERK_PUBLISHABLE_KEY: 'pk_test_x'
  }), /cannot be combined with Clerk/)
})

test('malformed identifiers are rejected rather than silently used', () => {
  for (const id of ['ab', 'user localtest', 'user_local;drop', 'a'.repeat(121)]) {
    assert.throws(() => resolveLocalTestUser({ WICKER_LOCAL_USER: id }), /plain identifier/, id)
  }
})
