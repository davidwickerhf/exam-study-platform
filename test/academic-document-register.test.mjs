import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withRequestContext } from '../lib/request-context.mjs'
import {
  deleteAcademicDocumentVersion,
  listAcademicDocumentRecords,
  recordAcademicDocumentVersion
} from '../lib/academic-document-register.mjs'

test('document register keeps derived version metadata without retaining file contents', async () => {
  const owner = `user_docs_${randomUUID().slice(0, 8)}`
  const asOwner = (callback) => withRequestContext({ userId: owner, mode: 'clerk' }, callback)
  try {
    const first = await asOwner(() => recordAcademicDocumentVersion({
      kind: 'transcript',
      label: 'Transcript May.pdf',
      fingerprint: 'sha256:first',
      sources: [{ name: 'Transcript May.pdf', type: 'application/pdf', size: 48120 }],
      impact: { applied: 12, proposed: 0 }
    }))
    assert.equal(first.unchanged, false)
    assert.equal(first.record.versions.length, 1)
    assert.ok(!JSON.stringify(first.record).includes('raw document text'))

    const duplicate = await asOwner(() => recordAcademicDocumentVersion({
      kind: 'transcript',
      label: 'Transcript May copy.pdf',
      fingerprint: 'sha256:first'
    }))
    assert.equal(duplicate.unchanged, true)

    const second = await asOwner(() => recordAcademicDocumentVersion({
      kind: 'transcript',
      label: 'Transcript September.pdf',
      fingerprint: 'sha256:second',
      impact: { applied: 2, proposed: 1 }
    }))
    assert.equal(second.record.versions.length, 2)

    const records = await asOwner(() => listAcademicDocumentRecords())
    assert.equal(records.length, 1)
    assert.deepEqual(records[0].versions.map((version) => version.sourceLabel), ['Transcript September.pdf', 'Transcript May.pdf'])

    await asOwner(() => deleteAcademicDocumentVersion({ kind: 'transcript', versionId: second.version.id }))
    assert.equal((await asOwner(() => listAcademicDocumentRecords()))[0].versions.length, 1)
    await asOwner(() => deleteAcademicDocumentVersion({ kind: 'transcript', versionId: first.version.id }))
    assert.deepEqual(await asOwner(() => listAcademicDocumentRecords()), [])
  } finally {
    await rm(join(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data/users'), owner), { recursive: true, force: true })
  }
})
