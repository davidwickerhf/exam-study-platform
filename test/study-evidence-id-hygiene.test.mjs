import test from 'node:test'
import assert from 'node:assert/strict'
import { stripUnsupportedEvidenceIds } from '../lib/study-version-content.mjs'

const evidence = [{ id: 'e-aaaaaaaaaaaaaaaaaaaaaaaa' }, { id: 'e-bbbbbbbbbbbbbbbbbbbbbbbb' }]
const supported = evidence[0].id
const unsupported = 'e-cccccccccccccccccccccccc'

function chapter(overrides = {}) {
  return {
    caveats: ['Historical rules predate the current edition.'],
    teachingPlan: { gaps: ['No worked proof was supplied.'], exclusions: ['Grading policy is excluded.'] },
    ...overrides
  }
}

test('a chapter with no unsupported citations is returned unchanged', () => {
  const original = chapter()
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result, original)
  assert.equal(result.evidenceIdRepairs, undefined)
})

test('an unsupported evidence id is stripped from caveats and recorded, leaving other prose intact', () => {
  const original = chapter({ caveats: [`Historical rules predate the current edition (${unsupported}).`] })
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result.caveats[0], 'Historical rules predate the current edition.')
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'caveats', index: 0, ref: unsupported }])
  // Unrelated fields are untouched (same reference, not merely equal).
  assert.equal(result.teachingPlan, original.teachingPlan)
})

test('a supported evidence id citation is left alone', () => {
  const original = chapter({ caveats: [`See ${supported} for the current-edition rule.`] })
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result, original)
})

test('unsupported ids are stripped from teaching-plan gaps and exclusions independently, each recorded', () => {
  const original = chapter({
    teachingPlan: {
      gaps: [`No worked proof was supplied, citing ${unsupported}.`],
      exclusions: ['Grading policy is excluded.']
    }
  })
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result.teachingPlan.gaps[0], 'No worked proof was supplied, citing.')
  assert.equal(result.teachingPlan.exclusions[0], 'Grading policy is excluded.')
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'teachingPlan.gaps', index: 0, ref: unsupported }])
})

test('an entry that is only the unsupported identifier is left untouched so review still flags it', () => {
  const original = chapter({ teachingPlan: { gaps: [unsupported], exclusions: [] } })
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result, original)
  assert.equal(result.evidenceIdRepairs, undefined)
})

test('multiple unsupported ids across fields are all stripped and each removal is recorded', () => {
  const secondUnsupported = 'e-dddddddddddddddddddddddd'
  const original = chapter({
    caveats: [`Two stray citations here (${unsupported}) and (${secondUnsupported}).`],
    teachingPlan: { gaps: [`Also here: ${unsupported}.`], exclusions: [] }
  })
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result.caveats[0], 'Two stray citations here and.')
  assert.equal(result.teachingPlan.gaps[0], 'Also here:.')
  assert.equal(result.evidenceIdRepairs.length, 3)
  assert.ok(result.evidenceIdRepairs.every(r => [unsupported, secondUnsupported].includes(r.ref)))
})

test('a chapter with no teaching plan only strips caveats', () => {
  const original = { caveats: [`Stray citation (${unsupported}).`] }
  const result = stripUnsupportedEvidenceIds(original, evidence)
  assert.equal(result.caveats[0], 'Stray citation.')
  assert.equal(result.teachingPlan, undefined)
})
