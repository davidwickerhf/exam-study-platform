import test from 'node:test'
import assert from 'node:assert/strict'
import { courseMatchSummary, exportEnvelope, exportFilename, importCandidate, programmeLabel } from '../lib/workspace/planning-settings.mjs'

test('blank programme titles remain explicitly untitled', () => {
  assert.equal(programmeLabel({ programme: ' MSc Data Science ' }), 'MSc Data Science')
  assert.equal(programmeLabel({ programme: ' ' }), 'Untitled programme')
})

test('exports use the versioned envelope accepted by the importer', () => {
  const workspace = { profile: {}, courses: [] }
  assert.deepEqual(exportEnvelope(workspace), { version: 1, data: workspace })
  assert.equal(importCandidate(exportEnvelope(workspace)), workspace)
  assert.equal(importCandidate(workspace), workspace)
  assert.throws(() => importCandidate({ profile: {}, courses: 'no' }), /does not contain/)
})

test('course matches are case-insensitive and absence is unmatched', () => {
  const result = courseMatchSummary(
    { courses: [{ code: 'bcs1000' }, { code: ' BCS2000 ' }, { code: '' }] },
    [{ code: 'BCS1000' }, { code: 'bcs2000' }]
  )
  assert.deepEqual(result, { total: 3, matched: 2, unmatched: 1 })
})

test('the download name carries a stable calendar date', () => {
  assert.equal(exportFilename(new Date('2026-09-02T23:00:00Z')), 'wicker-academics-2026-09-02.json')
})
