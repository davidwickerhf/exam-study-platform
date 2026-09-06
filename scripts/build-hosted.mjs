import '../lib/env.mjs'
import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { hostedSchemaFingerprint } from '../lib/hosted-schema.mjs'
for (const script of ['db:migrate', 'build']) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
await writeFile('.next/wicker-schema.json', JSON.stringify({ fingerprint: await hostedSchemaFingerprint(process.cwd(), process.env.DATABASE_URL) }))
