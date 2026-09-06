import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hasVerifiedHostedSchema, migrationFiles } from '../lib/hosted-schema.mjs'

test('one ledger read permits startup only when every tracked migration matches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wicker-schema-'))
  try {
    await mkdir(join(root, 'db'))
    await writeFile(join(root, 'db/001.sql'), 'SELECT 1;')
    const env = { DATABASE_URL: 'postgres://example.test/study' }
    let calls = 0
    const read = async () => { calls++; return [{ name: '001.sql', checksum: createHash('sha256').update('SELECT 1;').digest('hex') }] }
    assert.equal(await hasVerifiedHostedSchema(root, env, read), true)
    assert.equal(calls, 1)
    assert.equal(await hasVerifiedHostedSchema(root, {}, read), false)
    assert.equal(await hasVerifiedHostedSchema(root, env, async () => []), false)
    assert.equal(await hasVerifiedHostedSchema(root, env, async () => { throw new Error('Ledger unavailable') }), false)
    await writeFile(join(root, 'db/001.sql'), 'SELECT 9;')
    assert.equal(await hasVerifiedHostedSchema(root, env, read), false)
    await writeFile(join(root, 'db/001.sql'), 'SELECT 1;')
    await writeFile(join(root, 'db/002.sql'), 'SELECT 2;')
    await writeFile(join(root, 'db/README.md'), 'Not a migration')
    assert.deepEqual(await migrationFiles(root), ['001.sql', '002.sql'])
    assert.equal(await hasVerifiedHostedSchema(root, env, read), false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
