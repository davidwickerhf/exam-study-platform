import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Build and runtime must refer to the same database and tracked migrations.
// The marker contains only hashes; neither the database URL nor credentials.
export async function hostedSchemaFingerprint(root, databaseUrl) {
  const target = new URL(databaseUrl)
  const hash = createHash('sha256').update(`${target.hostname}${target.pathname}`)
  for (const file of (await readdir(join(root, 'db'))).filter(name => name.endsWith('.sql')).sort()) {
    hash.update(file).update(await readFile(join(root, 'db', file)))
  }
  hash.update(await readFile(join(root, 'scripts/db-migrate.mjs')))
  return hash.digest('hex')
}
export async function hasVerifiedHostedSchema(root, env = process.env) {
  if (!env.VERCEL || !env.DATABASE_URL) return false
  try {
    const marker = JSON.parse(await readFile(join(root, '.next/wicker-schema.json'), 'utf8'))
    return marker.fingerprint === await hostedSchemaFingerprint(root, env.DATABASE_URL)
  } catch { return false }
}
