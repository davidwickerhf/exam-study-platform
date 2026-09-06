import test from 'node:test'
import assert from 'node:assert/strict'
import { queueWorkersEnabled, queueWorkerAllowsUser, queueDispatcherOrigin, queueRequestHeaders } from '../lib/queue-runtime.mjs'

const preview = { VERCEL_ENV: 'preview', DATABASE_URL: 'postgres://test:fixture@preview.test/db',
  WICKER_PREVIEW_DATABASE_HOST: 'preview.test', WICKER_PREVIEW_WORKER_USERS: 'student-one, student-two',
  VERCEL_BRANCH_URL: 'branch.vercel.app', VERCEL_URL: 'deployment.vercel.app',
  VERCEL_PROJECT_PRODUCTION_URL: 'production.example' }
test('preview queue requires an explicit database and test-account configuration', () => {
  assert.equal(queueWorkersEnabled(preview), true)
  for (const patch of [{ DATABASE_URL: 'postgres://test:fixture@production.test/db' },
    { DATABASE_URL: '' }, { WICKER_PREVIEW_DATABASE_HOST: '' }, { WICKER_PREVIEW_WORKER_USERS: '' }]) {
    assert.equal(queueWorkersEnabled({ ...preview, ...patch }), false)
  }
  assert.equal(queueWorkerAllowsUser('student-two', preview), true)
  assert.equal(queueWorkerAllowsUser('copied-production-account', preview), false)
  assert.equal(queueWorkerAllowsUser('student-one', { ...preview, DATABASE_URL: '' }), false)
})
test('preview wakes its branch dispatcher and never the production alias', () => {
  assert.equal(queueDispatcherOrigin(preview), 'https://branch.vercel.app')
  assert.equal(queueDispatcherOrigin({ ...preview, VERCEL_BRANCH_URL: '' }), 'https://deployment.vercel.app')
  assert.equal(queueDispatcherOrigin({ ...preview, VERCEL_BRANCH_URL: '', VERCEL_URL: '' }), '')
  assert.equal(queueDispatcherOrigin({ ...preview, DATABASE_URL: '' }), '')
  assert.deepEqual(queueRequestHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: 'fixture' }), { 'x-vercel-protection-bypass': 'fixture' })
})
test('production continues through the stable production dispatcher', () => {
  const env = { ...preview, VERCEL_ENV: 'production' }
  assert.equal(queueDispatcherOrigin(env), 'https://production.example')
  assert.equal(queueWorkerAllowsUser('production-account', env), true)
  assert.equal(queueWorkersEnabled({}), true)
})
