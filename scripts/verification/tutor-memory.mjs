// Disposable PostgreSQL verification; never accepts a remote database.
// QUEUE_TEST_DATABASE_URL=postgres://... node --experimental-test-module-mocks scripts/verification/tutor-memory.mjs
import { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import pg from 'pg'
import * as neonModule from '@neondatabase/serverless'
const url = new URL(process.env.QUEUE_TEST_DATABASE_URL || '')
if (!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Use a disposable localhost database.')
const pool = new pg.Pool({ connectionString: url.href })
function sql(strings, ...values) {
  const text = strings.reduce((out, part, i) => out + (i ? `$${i}` : '') + part, '')
  return pool.query(text, values).then(result => result.rows)
}
mock.module('@neondatabase/serverless', { namedExports: { ...neonModule, neon: () => sql } })
process.env.DATABASE_URL = url.href
const { withRequestContext } = await import('../../lib/request-context.mjs')
const { writeDocument, readDocument, compareAndSwapDocument } = await import('../../lib/user-store.mjs')
const { rememberFact, rememberPlan, saveTutorPreferences, readTutorMemory } = await import('../../lib/tutor-store.mjs')
const { activeProgrammeId, scopedDocumentKey } = await import('../../lib/programme-scope.mjs')
const { prepareExternalTutorUpdate, confirmExternalTutorUpdate } = await import('../../lib/tutor-external-updates.mjs')
try {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  for (const name of (await readdir(new URL('../../db/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../../db/' + name, import.meta.url), 'utf8'))
  await withRequestContext({ userId: 'memory-fixture' }, async () => {
    const key = scopedDocumentKey(await activeProgrammeId(), 'memory')
    await writeDocument('tutor', key, { facts: [{ id: 'old', fact: 'Keep existing context' }], plans: [], preferences: {} })
    await Promise.all([rememberFact('Works Tuesdays'), rememberFact('Prefers diagrams'), rememberPlan({ title: 'Project testing' }), saveTutorPreferences({ tone: 'warm' })])
    const memory = await readTutorMemory()
    assert.equal(memory.facts.length, 3)
    assert.equal(memory.plans.length, 1)
    assert.equal(memory.preferences.tone, 'warm')
    assert.ok((await readDocument('tutor', key, null)).revision)
    await assert.rejects(compareAndSwapDocument('tutor', key, {}, null), /record changed/)
    await assert.rejects(compareAndSwapDocument('tutor', key, {}, null, { legacyValue: { facts: [] } }), /record changed/)
    const prepared = await prepareExternalTutorUpdate({ kind: 'availability', text: 'Works Fridays', weekdays: ['friday'] })
    let writes = 0
    const execute = async proposal => { writes++; return rememberFact(proposal.payload.fact, proposal.payload) }
    const args = { updateId: prepared.updateId, confirmed: true }
    const results = await Promise.allSettled([confirmExternalTutorUpdate(args, execute), confirmExternalTutorUpdate(args, execute)])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal((await confirmExternalTutorUpdate(args, execute)).duplicate, true)
    assert.equal(writes, 1)
    assert.equal((await readTutorMemory()).facts.length, 4)
  })
  console.log('PostgreSQL memory: legacy migration, concurrent context/plans/preferences, exact confirmation and idempotent receipt passed.')
} finally { await pool.end() }
