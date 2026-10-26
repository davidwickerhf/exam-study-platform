import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDevelopmentDataUsers, resolveLocalAccounts, resolveLocalTestUser } from '../lib/auth.mjs'

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

test('it cannot be combined with hosted sign-in', () => {
  assert.throws(() => resolveLocalTestUser({
    WICKER_LOCAL_USER: 'user_localtest',
    BETTER_AUTH_SECRET: 'a-test-secret'
  }), /cannot be combined with hosted sign-in/)
})

test('malformed identifiers are rejected rather than silently used', () => {
  for (const id of ['ab', 'user localtest', 'user_local;drop', 'a'.repeat(121)]) {
    assert.throws(() => resolveLocalTestUser({ WICKER_LOCAL_USER: id }), /plain identifier/, id)
  }
})

test('development login accounts are explicit email to user mappings', () => {
  assert.deepEqual(resolveLocalAccounts({ WICKER_LOCAL_ACCOUNTS: 'test@example.com=user_test, second@example.com=user_second' }), [
    { email: 'test@example.com', userId: 'user_test' },
    { email: 'second@example.com', userId: 'user_second' }
  ])
  assert.throws(() => resolveLocalAccounts({ WICKER_LOCAL_ACCOUNTS: 'test@example.com=user_test', NODE_ENV: 'production' }), /development-only/)
  assert.throws(() => resolveLocalAccounts({ WICKER_LOCAL_ACCOUNTS: 'not-a-mapping' }), /email=user_id/)
})

test('development data users are explicit email mappings and never run in production', () => {
  assert.deepEqual(resolveDevelopmentDataUsers({ WICKER_DEV_DATA_USERS: 'student@example.com=user_production' }), [
    { email: 'student@example.com', userId: 'user_production' }
  ])
  assert.throws(() => resolveDevelopmentDataUsers({ WICKER_DEV_DATA_USERS: 'student@example.com=user_production', NODE_ENV: 'production' }), /development-only/)
  assert.throws(() => resolveDevelopmentDataUsers({ WICKER_DEV_DATA_USERS: 'not-a-mapping' }), /email=user_id/)
})
