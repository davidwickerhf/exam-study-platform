import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hostedSchemaFingerprint, hasVerifiedHostedSchema } from '../lib/hosted-schema.mjs'

test('only a matching hosted build can skip startup migration checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-schema-'))
  try {
    for (const dir of ['db', 'scripts', '.next']) await mkdir(join(root, dir))
    await writeFile(join(root, 'db/001.sql'), 'SELECT 1;')
    await writeFile(join(root, 'scripts/db-migrate.mjs'), 'migration implementation')
    const env = { VERCEL: '1', DATABASE_URL: 'postgres://user:secret@example.test/study' }
    assert.equal(await hasVerifiedHostedSchema(root, env), false)
    const fingerprint = await hostedSchemaFingerprint(root, env.DATABASE_URL)
    await writeFile(join(root, '.next/wicker-schema.json'), JSON.stringify({ fingerprint }))
    assert.equal(await hasVerifiedHostedSchema(root, env), true)
    assert.equal(await hasVerifiedHostedSchema(root, { ...env, VERCEL: '' }), false)
    assert.equal(await hasVerifiedHostedSchema(root, { ...env, DATABASE_URL: 'postgres://user:secret@other.test/study' }), false)
    await writeFile(join(root, 'db/002.sql'), 'SELECT 2;')
    assert.equal(await hasVerifiedHostedSchema(root, env), false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
