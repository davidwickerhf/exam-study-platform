import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateCanvasCorpusChunks, formatRetrievalContext } from '../lib/retrieval-store.mjs'

const chunk = (academicYear, extra = {}) => ({
  corpus: 'canvas',
  assetId: 'asset-shared',
  editionId: `edition-${academicYear}`,
  courseCode: 'BCS2140',
  academicYear,
  period: '1',
  sourcePath: 'Slides/week-1.pdf',
  page: 3,
  chunkIndex: 0,
  content: 'A process is a program in execution.',
  score: 0.8,
  lexicalScore: 0.8,
  semanticScore: 0,
  current: true,
  editions: [{ editionId: `edition-${academicYear}`, academicYear, period: '1', sourcePath: 'Slides/week-1.pdf', current: true }],
  ...extra
})

test('identical retake material occupies one retrieval slot with both editions attached', () => {
  const [result] = aggregateCanvasCorpusChunks([
    chunk('2024-2025'),
    chunk('2026-2027', { score: 0.7, lexicalScore: 0.7 })
  ], 8)
  assert.equal(result.academicYear, '2026-2027')
  assert.deepEqual(result.editions.map((edition) => edition.academicYear), ['2026-2027', '2024-2025'])
  assert.equal(result.score, 0.8)
  assert.match(formatRetrievalContext([result]), /editions 2026-2027 P1; 2024-2025 P1/)
})

test('different material from different retake years remains separately retrievable', () => {
  const results = aggregateCanvasCorpusChunks([
    chunk('2024-2025'),
    chunk('2026-2027', { assetId: 'asset-new', sourcePath: 'Slides/week-2.pdf', content: 'Threads share a process address space.' })
  ], 8)
  assert.equal(results.length, 2)
})
