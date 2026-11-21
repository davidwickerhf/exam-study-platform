import test from 'node:test'
import assert from 'node:assert/strict'
import { createSql } from '../lib/pg.mjs'

function fakeSql(url = 'postgres://fixture@127.0.0.1:1/fixture') {
  const sql = createSql(url, { queryTimeoutMs: 1234 })
  const calls = []
  const client = { query: async (text, params) => { calls.push(['client', text, params]); if (text === 'FAIL') throw new Error('boom'); return { rows: [{ text }] } }, release: error => calls.push(['release', Boolean(error)]) }
  sql.pool.query = async (text, params) => { calls.push(['pool', text, params]); return { rows: [{ ok: true }] } }
  sql.pool.connect = async () => client
  return { sql, calls }
}

test('tagged templates compile to positional parameters and resolve to rows', async () => {
  const { sql, calls } = fakeSql()
  const rows = await sql`SELECT * FROM t WHERE a=${1} AND b=${'x'} AND c=ANY(${['p', 'q']}::text[])`
  assert.deepEqual(rows, [{ ok: true }])
  assert.deepEqual(calls[0], ['pool', 'SELECT * FROM t WHERE a=$1 AND b=$2 AND c=ANY($3::text[])', [1, 'x', ['p', 'q']]])
})

test('queries are lazy until awaited and run once', async () => {
  const { sql, calls } = fakeSql()
  const query = sql.query('SELECT $1', [7])
  assert.equal(calls.length, 0)
  await query; await query
  assert.equal(calls.length, 1)
})

test('transaction runs built queries on one client between BEGIN and COMMIT', async () => {
  const { sql, calls } = fakeSql()
  const results = await sql.transaction([sql`SELECT ${1}`, sql.query('SELECT 2')], { isolationLevel: 'Serializable' })
  assert.equal(results.length, 2)
  assert.deepEqual(calls.map(call => call[1]), ['BEGIN ISOLATION LEVEL SERIALIZABLE', 'SELECT $1', 'SELECT 2', 'COMMIT', false])
  assert.equal(calls.some(call => call[0] === 'pool'), false)
})

test('a failed statement rolls the transaction back and releases the client', async () => {
  const { sql, calls } = fakeSql()
  await assert.rejects(sql.transaction([sql`SELECT 1`, sql.query('FAIL')]), /boom/)
  assert.deepEqual(calls.map(call => call[1]), ['BEGIN', 'SELECT 1', 'FAIL', 'ROLLBACK', false])
})

test('a pool is shared per connection string and timeout', () => {
  const a = createSql('postgres://share@127.0.0.1:1/db', { queryTimeoutMs: 5 })
  const b = createSql('postgres://share@127.0.0.1:1/db', { queryTimeoutMs: 5 })
  assert.equal(a.pool, b.pool)
})

test('TLS follows sslmode and Neon hosts; plain Postgres has none', () => {
  assert.equal(createSql('postgres://u@db:5432/app').pool.options.ssl, false)
  assert.ok(createSql('postgres://u@ep-x.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require').pool.options.ssl)
  assert.ok(createSql('postgres://u@db:5432/app?sslmode=require').pool.options.ssl)
  assert.equal(createSql('postgres://u@db:5432/app?sslmode=disable').pool.options.ssl, false)
})
