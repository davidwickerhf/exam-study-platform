import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// A hung database call used to hang the request that made it, with no bound.
test('every database query is given a timeout', async () => {
  const source = await readFile(new URL('../lib/db.mjs', import.meta.url), 'utf8')
  assert.match(source, /neonConfig\.fetchFunction/, 'the driver fetch must be wrapped')
  assert.match(source, /AbortSignal\.timeout\(DATABASE_QUERY_TIMEOUT_MS\)/, 'the wrapper must apply the timeout')
})

test('the timeout is configurable and has a finite default', async () => {
  const { DATABASE_QUERY_TIMEOUT_MS } = await import('../lib/db.mjs')
  assert.ok(Number.isFinite(DATABASE_QUERY_TIMEOUT_MS) && DATABASE_QUERY_TIMEOUT_MS > 0)
})
