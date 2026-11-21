import test from 'node:test'
import assert from 'node:assert/strict'
import { stripUnsupportedEvidenceIds } from '../lib/study-version-content.mjs'

const supported = 'e-aaaaaaaaaaaaaaaaaaaaaaaa'
const unsupported = 'e-cccccccccccccccccccccccc'

function chapter(overrides = {}) {
  return {
    caveats: ['Historical rules predate the current edition.'],
    teachingPlan: { gaps: ['No worked proof was supplied.'], exclusions: ['Grading policy is excluded.'] },
    ...overrides
  }
}

test('a chapter with no evidence-id citations in prose is returned unchanged', () => {
  const original = chapter()
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result, original)
  assert.equal(result.evidenceIdRepairs, undefined)
})

test('an evidence id is stripped from caveats and recorded, its punctuation tidied, leaving other prose intact', () => {
  const original = chapter({ caveats: [`Historical rules predate the current edition (${unsupported}).`] })
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result.caveats[0], 'Historical rules predate the current edition.')
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'caveats', index: 0, ref: unsupported }])
  // Unrelated fields are untouched (same reference, not merely equal).
  assert.equal(result.teachingPlan, original.teachingPlan)
})

test('an identifier that IS part of the chapter’s own supplied evidence is stripped from prose too: it belongs in structured citation fields only', () => {
  const original = chapter({ caveats: [`See ${supported} for the current-edition rule.`] })
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result.caveats[0], 'See for the current-edition rule.')
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'caveats', index: 0, ref: supported }])
})

test('ids are stripped from teaching-plan gaps and exclusions independently, each recorded', () => {
  const original = chapter({
    teachingPlan: {
      gaps: [`No worked proof was supplied, citing ${unsupported}.`],
      exclusions: ['Grading policy is excluded.']
    }
  })
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result.teachingPlan.gaps[0], 'No worked proof was supplied, citing.')
  assert.equal(result.teachingPlan.exclusions[0], 'Grading policy is excluded.')
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'teachingPlan.gaps', index: 0, ref: unsupported }])
})

test('an entry that would become a meaningless fragment is dropped entirely, not left holding the identifier, and the drop is recorded', () => {
  const original = chapter({ teachingPlan: { gaps: [unsupported, 'A real remaining gap.'], exclusions: [] } })
  const result = stripUnsupportedEvidenceIds(original)
  assert.deepEqual(result.teachingPlan.gaps, ['A real remaining gap.'])
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'teachingPlan.gaps', index: 0, ref: unsupported, dropped: true }])
})

test('an entry that is only punctuation once its identifier is removed is also dropped, not left as a punctuation fragment', () => {
  const original = chapter({ caveats: [`(${unsupported}).`] })
  const result = stripUnsupportedEvidenceIds(original)
  assert.deepEqual(result.caveats, [])
  assert.deepEqual(result.evidenceIdRepairs, [{ field: 'caveats', index: 0, ref: unsupported, dropped: true }])
})

test('multiple ids across fields are all stripped and each removal is recorded', () => {
  const secondUnsupported = 'e-dddddddddddddddddddddddd'
  const original = chapter({
    caveats: [`Two stray citations here (${unsupported}) and (${secondUnsupported}).`],
    teachingPlan: { gaps: [`Also here: ${unsupported}.`], exclusions: [] }
  })
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result.caveats[0], 'Two stray citations here and.')
  assert.equal(result.teachingPlan.gaps[0], 'Also here:.')
  assert.equal(result.evidenceIdRepairs.length, 3)
  assert.ok(result.evidenceIdRepairs.every(r => [unsupported, secondUnsupported].includes(r.ref)))
})

test('a chapter with no teaching plan only strips caveats', () => {
  const original = { caveats: [`Stray citation (${unsupported}).`] }
  const result = stripUnsupportedEvidenceIds(original)
  assert.equal(result.caveats[0], 'Stray citation.')
  assert.equal(result.teachingPlan, undefined)
})

test('removals accumulate onto an existing evidenceIdRepairs list rather than replacing it', () => {
  const original = chapter({ caveats: [`Stray citation (${unsupported}).`], evidenceIdRepairs: [{ field: 'caveats', index: 0, ref: 'e-earlier00000000000000000' }] })
  const result = stripUnsupportedEvidenceIds(original)
  assert.deepEqual(result.evidenceIdRepairs, [
    { field: 'caveats', index: 0, ref: 'e-earlier00000000000000000' },
    { field: 'caveats', index: 0, ref: unsupported }
  ])
})
