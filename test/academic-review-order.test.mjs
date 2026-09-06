import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { createDocumentReview, readDocumentReviews } from '../lib/academic-document-review.mjs'
import { activeProgrammeId } from '../lib/programme-scope.mjs'
import { readDocument, writeDocument, deleteAllDocuments } from '../lib/user-store.mjs'

function reorder(value) {
  if (Array.isArray(value)) return value.map(reorder)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]))
  return value
}

test('transcript review accepts reordered stored fields and distinct failed/passed sittings, but rejects altered results', async () => {
  const userId = `transcript-json-order-${randomUUID()}`
  await withRequestContext({ userId, mode: 'local' }, async () => {
    try {
      const changes = [
        { id: 'date:first', label: 'KEN1130: exam date', payload: { courseId: 'ken1130', examDate: '2023-10-23', attempt: { grade: 4, status: 'failed', creditsEarned: 0 } } },
        { id: 'date:retake', label: 'KEN1130: exam date', payload: { courseId: 'ken1130', examDate: '2024-10-18', attempt: { grade: 6, status: 'passed', creditsEarned: 6 } } }
      ]
      const id = await createDocumentReview({ evidence: { kind: 'transcript', rows: [] }, changes, revision: 3 })
      const key = `${await activeProgrammeId()}:${id}`
      const held = await readDocument('academic-document-reviews', key, null)
      // Simulate the key reordering performed by PostgreSQL JSONB, including
      // nested result fields, without changing any reviewed values.
      await writeDocument('academic-document-reviews', key, reorder(held))
      assert.notEqual(JSON.stringify(held.changes), JSON.stringify(reorder(held).changes))
      assert.equal((await readDocumentReviews([id], changes, 3)).length, 1)
      assert.equal((await readDocumentReviews([id], [changes[1]], 3)).length, 1)
      for (const modify of [
        c => { c[1].payload.attempt.grade = 9 },
        c => { c[0].payload.attempt.status = 'passed' },
        c => { c[0].payload.examDate = c[1].payload.examDate },
        c => { c[1].payload.attempt.creditsEarned = 12 }
      ]) {
        const altered = structuredClone(changes); modify(altered)
        await assert.rejects(() => readDocumentReviews([id], altered, 3), /changed after/)
      }
      await assert.rejects(() => readDocumentReviews([id], changes, 4), /programme changed/)
    } finally { await deleteAllDocuments() }
  })
})
