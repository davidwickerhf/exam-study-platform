import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'

export async function migrationFiles(root) {
  return (await readdir(join(root, 'db'))).filter(name => /^\d+.*\.sql$/.test(name)).sort()
}

/** A single read replaces spawning the migration CLI on every warm-schema boot. */
export async function hasVerifiedHostedSchema(root, env = process.env, readApplied) {
  if (!env.DATABASE_URL) return false
  try {
    const names = await migrationFiles(root)
    const expected = await Promise.all(names.map(async name => ({ name, checksum: createHash('sha256').update(await readFile(join(root, 'db', name))).digest('hex') })))
    const rows = await (readApplied ? readApplied() : neon(env.DATABASE_URL)`SELECT name, checksum FROM schema_migrations`)
    const applied = new Map(rows.map(row => [row.name, row.checksum]))
    return expected.length > 0 && expected.every(row => applied.get(row.name) === row.checksum)
  } catch {
    // Missing ledger, unknown schema or connectivity errors use the existing
    // migration path, which refuses to serve until the schema is known good.
    return false
  }
}
