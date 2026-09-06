#!/usr/bin/env node
import '../lib/env.mjs'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { splitSqlStatements } from '../lib/sql-statements.mjs'
import { migrationFiles } from '../lib/hosted-schema.mjs'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)
const migrations = await migrationFiles(resolve('.'))

// Keep a durable ledger instead of replaying the entire schema on every web
// container start. Existing installations do one final idempotent pass to
// seed this table; subsequent boots only execute migrations that are new.
await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`
const appliedRows = await sql`SELECT name, checksum FROM schema_migrations`
const applied = new Map(appliedRows.map((row) => [row.name, row.checksum]))
const queries = [sql`SELECT pg_advisory_xact_lock(2026083001)`]
const pending = []
for (const migration of migrations) {
  const source = await readFile(resolve('db', migration), 'utf8')
  const checksum = createHash('sha256').update(source).digest('hex')
  if (applied.has(migration)) {
    if (applied.get(migration) !== checksum) {
      throw new Error(`Applied migration ${migration} no longer matches its recorded checksum. Add a new migration instead of editing migration history.`)
    }
    continue
  }
  for (const statement of splitSqlStatements(source)) queries.push(sql.query(statement))
  queries.push(sql`INSERT INTO schema_migrations (name, checksum) VALUES (${migration}, ${checksum}) ON CONFLICT (name) DO NOTHING`)
  pending.push(migration)
}
if (pending.length) {
  await sql.transaction(queries)
  for (const migration of pending) console.log(`Applied db/${migration}`)
} else {
  console.log('Database schema is up to date.')
}
