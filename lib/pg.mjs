import pg from 'pg'

// node-postgres behind the tagged-template interface the repositories were
// written against (formerly @neondatabase/serverless):
//
//   sql`SELECT ... WHERE id=${id}`          -> Promise<row[]>
//   sql.query('SELECT ... $1', [id])        -> Promise<row[]>
//   sql.transaction([sql`...`, sql`...`])   -> Promise<row[][]> (one BEGIN/COMMIT)
//
// Queries are lazy: nothing runs until the query is awaited or handed to
// transaction(), so statements built for a transaction never execute twice.
// One Pool per connection string per process. Plain PostgreSQL works without
// TLS; Neon (or any URL with sslmode=require) keeps TLS, so the same code runs
// before and after the database moves.

const pools = new Map()

function sslFor(connectionString) {
  try {
    const url = new URL(connectionString)
    const mode = url.searchParams.get('sslmode')
    if (mode === 'disable') return false
    if (mode && mode !== 'prefer' && mode !== 'allow') return true
    return /\.neon\.tech$/i.test(url.hostname)
  } catch { return false }
}

function cleanConnectionString(connectionString) {
  // TLS is configured explicitly below; leaving sslmode in the string makes pg
  // override that config (and warn), and channel_binding is libpq-only.
  try {
    const url = new URL(connectionString)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('channel_binding')
    return url.toString()
  } catch { return connectionString }
}

export function poolFor(connectionString, { queryTimeoutMs } = {}) {
  const timeout = Number(queryTimeoutMs ?? process.env.DATABASE_QUERY_TIMEOUT_MS ?? 25_000)
  const key = `${connectionString}\u0000${timeout}`
  let pool = pools.get(key)
  if (!pool) {
    pool = new pg.Pool({
      connectionString: cleanConnectionString(connectionString),
      ssl: sslFor(connectionString) ? { rejectUnauthorized: true } : false,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      // Bound every statement on the client side, as the HTTP driver did. No
      // automatic retry: a timed-out statement may still have executed.
      ...(timeout > 0 ? { query_timeout: timeout } : {}),
      // Let one-shot scripts exit without an explicit pool.end().
      allowExitOnIdle: true,
    })
    // An idle client losing its connection must not crash the process.
    pool.on('error', error => console.error('PostgreSQL pool error:', error.message))
    pools.set(key, pool)
  }
  return pool
}

class PgQuery {
  constructor(pool, text, params) {
    this.pool = pool
    this.text = text
    this.params = params
    this.promise = null
  }
  execute() {
    if (!this.promise) this.promise = this.pool.query(this.text, this.params).then(result => result.rows)
    return this.promise
  }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
  catch(reject) { return this.execute().catch(reject) }
  finally(callback) { return this.execute().finally(callback) }
  get [Symbol.toStringTag]() { return 'PgQuery' }
}

function compile(strings) {
  let text = strings[0]
  for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`
  return text
}

function beginStatement({ isolationLevel, readOnly, deferrable } = {}) {
  const modes = []
  if (isolationLevel) {
    const level = String(isolationLevel).replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()
    if (!['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'].includes(level)) throw new Error(`Unsupported isolation level ${isolationLevel}.`)
    modes.push(`ISOLATION LEVEL ${level}`)
  }
  if (readOnly !== undefined) modes.push(readOnly ? 'READ ONLY' : 'READ WRITE')
  if (deferrable !== undefined) modes.push(deferrable ? 'DEFERRABLE' : 'NOT DEFERRABLE')
  return modes.length ? `BEGIN ${modes.join(' ')}` : 'BEGIN'
}

export function createSql(connectionString, options = {}) {
  if (!connectionString) throw new Error('A PostgreSQL connection string is required.')
  const pool = poolFor(connectionString, options)
  const sql = (strings, ...values) => {
    if (!Array.isArray(strings) || !('raw' in strings)) throw new Error('sql must be used as a tagged template; use sql.query(text, params) for strings.')
    return new PgQuery(pool, compile(strings), values)
  }
  sql.query = (text, params = []) => new PgQuery(pool, text, params)
  sql.transaction = async (queries, transactionOptions) => {
    const list = typeof queries === 'function' ? queries(sql) : queries
    for (const query of list) {
      if (!(query instanceof PgQuery)) throw new Error('transaction() expects queries built with this sql instance.')
      if (query.promise) throw new Error('A query passed to transaction() was already executed.')
    }
    const client = await pool.connect()
    let broken = null
    try {
      await client.query(beginStatement(transactionOptions))
      const results = []
      for (const query of list) results.push((await client.query(query.text, query.params)).rows)
      await client.query('COMMIT')
      return results
    } catch (error) {
      await client.query('ROLLBACK').catch(rollbackError => { broken = rollbackError })
      throw error
    } finally {
      // Discard a connection whose ROLLBACK failed (e.g. after a client-side timeout).
      client.release(broken || undefined)
    }
  }
  sql.pool = pool
  return sql
}
