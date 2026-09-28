import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuestionDraft } from '../lib/shared-course-questions.mjs'

const passages = [{ id: '12', assetId: 'asset', title: 'Course exercise.pdf', page: 2,
  academicYear: '2026-27' }]

test('question processing keeps only cited, distinct, answerable practice items', () => {
  const valid = Array.from({ length: 6 }, (_, index) => ({ kind: index % 2 ? 'application' : 'exam-style',
    topic: 'Topic', question: `Explain the course concept in situation ${index} with enough context?`,
    expected: `The source supports this detailed answer for situation ${index}.`, sourceChunkId: '12' }))
  const result = parseQuestionDraft(JSON.stringify({ questions: [
    ...valid, { ...valid[0], sourceChunkId: '999', question: 'A long but unsupported question with no approved source?' },
    { ...valid[0] }
  ] }), passages)
  assert.equal(result.length, 6)
  assert.equal(result[0].sourceUrl, '/api/shared-materials/assets/asset')
  assert.equal(result[0].sourcePage, 2)
})

test('question processing rejects a thin or ungrounded draft', () => {
  assert.throws(() => parseQuestionDraft(JSON.stringify({ questions: [{ kind: 'recall', topic: 'Topic',
    question: 'A long enough question about unsupported material?',
    expected: 'A long enough answer but with no approved citation.', sourceChunkId: '999' }] }), passages),
  /Fewer than six grounded questions/)
})
