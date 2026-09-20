import test from 'node:test'
import assert from 'node:assert/strict'
import { repairIncoherentProse, incoherentProseReason, incoherentProseRemains } from '../lib/study-preflight.mjs'
import { recoverFailedChapterByCorruptPlanProse, prepareLesson } from '../lib/study-version-pipeline.mjs'
import { lesson, teachingPlan } from '../scripts/verification/study-fixtures.mjs'

// The exact entry a hosted pilot produced, curly quotes included. It bought
// two whole-chapter corrections before anything deterministic looked at it.
const CORRUPT = 'prerequisites”:”: [    {'

function chapter(overrides = {}) {
  return {
    caveats: ['Historical rules predate the current edition.'],
    teachingPlan: { gaps: ['No worked proof was supplied.'], exclusions: ['Grading policy is excluded.'] },
    ...overrides
  }
}

test('a gaps entry that is a stray JSON fragment is dropped before review and the drop is recorded', () => {
  const original = chapter({ teachingPlan: { gaps: ['Slide diagrams are not transcribed in the supplied text.', CORRUPT], exclusions: [] } })
  const result = repairIncoherentProse(original)
  assert.deepEqual(result.teachingPlan.gaps, ['Slide diagrams are not transcribed in the supplied text.'])
  assert.deepEqual(result.proseRepairs, [{ field: 'teachingPlan.gaps', index: 1, reason: 'stray JSON key punctuation', dropped: true }])
  assert.equal(incoherentProseRemains(result), false)
  // Unrelated fields keep their identity, not merely their value.
  assert.equal(result.caveats, original.caveats)
})

test('a real gap sentence that merely ends in a JSON fragment keeps its sentence: the fragment alone is cut', () => {
  const original = chapter({ teachingPlan: { gaps: [`The syllabus never states the assumed maths background. prerequisites”:”: [    {`], exclusions: [] } })
  const result = repairIncoherentProse(original)
  assert.deepEqual(result.teachingPlan.gaps, ['The syllabus never states the assumed maths background.'])
  assert.deepEqual(result.proseRepairs, [{ field: 'teachingPlan.gaps', index: 0, reason: 'stray JSON key punctuation' }])
})

test('an entry with unbalanced brackets is repaired when prose survives and dropped when it does not', () => {
  const repaired = repairIncoherentProse(chapter({ caveats: ['The lecture slides omit the derivation (see week three of the module.'] }))
  assert.deepEqual(repaired.caveats, ['The lecture slides omit the derivation see week three of the module.'])
  assert.deepEqual(repaired.proseRepairs, [{ field: 'caveats', index: 0, reason: 'unbalanced brackets' }])
  const dropped = repairIncoherentProse(chapter({ teachingPlan: { gaps: ['{ "gaps": [', 'A genuine remaining gap in the evidence.'], exclusions: [] } }))
  assert.deepEqual(dropped.teachingPlan.gaps, ['A genuine remaining gap in the evidence.'])
  assert.deepEqual(dropped.proseRepairs, [{ field: 'teachingPlan.gaps', index: 0, reason: 'stray JSON key punctuation', dropped: true }])
})

test('an entry truncated on an opening bracket or a trailing comma is not sent to a reviewer as it stands', () => {
  assert.equal(incoherentProseReason('The reading list stops mid-sentence and the remaining items are,'), 'truncated entry')
  assert.equal(incoherentProseReason('Missing worked examples for the second half of the module. ['), 'unbalanced brackets')
  assert.equal(incoherentProseReason('The textbook chapter is quoted as “partially covered by the slides.'), 'unbalanced quotes')
})

test('coherent prose with legitimate punctuation is left byte-identical, quotes, colons, parentheses and bracketed citations included', () => {
  const original = chapter({
    caveats: ['The term "affordance": a property that suggests its own use (Norman, 1988) — see [Shneiderman 2016, ch. 3] for the fuller treatment.'],
    teachingPlan: {
      gaps: ['The syllabus lists the textbook, but the book’s chapters (3–5) are not in the supplied evidence; treat them as unread.', 'Implementation-level code details for the hardware labs are out of scope: nothing in the evidence covers them.'],
      exclusions: ['Assessment weighting (40%/60%) is excluded — it is administrative, not teaching content.']
    }
  })
  const result = repairIncoherentProse(original)
  assert.equal(result, original)
  assert.equal(result.proseRepairs, undefined)
  for (const entry of [...original.caveats, ...original.teachingPlan.gaps, ...original.teachingPlan.exclusions]) assert.equal(incoherentProseReason(entry), null)
})

test('the chapter-acceptance point repairs corrupt plan prose before any review call, for a first draft and a correction alike', () => {
  const evidence = ids.map(id => ({ id }))
  const topic = { id: 'addition', title: 'Addition', sourceIds: ids }
  const corruptPlan = { ...teachingPlan(ids), gaps: ['A genuine gap in the supplied evidence.', CORRUPT], exclusions: [] }
  const draft = prepareLesson(lesson(ids), topic, evidence, corruptPlan)
  assert.deepEqual(draft.teachingPlan.gaps, ['A genuine gap in the supplied evidence.'])
  assert.ok(draft.proseRepairs?.some(r => r.field === 'teachingPlan.gaps' && r.dropped))
  const correction = prepareLesson({ ...lesson(ids), caveats: [CORRUPT] }, topic, evidence, teachingPlan(ids))
  assert.deepEqual(correction.caveats, [])
  assert.ok(correction.proseRepairs?.some(r => r.field === 'caveats' && r.dropped))
})

const ids = ['e-abc123def456']
function failedWork(findings, { chapter: overrides = {}, ...rest } = {}) {
  return {
    chapters: [{ ...lesson(ids), id: 'addition', review: 'failed', caveats: [], teachingPlan: { ...teachingPlan(ids), gaps: ['A genuine gap.', CORRUPT], exclusions: [] }, ...overrides }],
    topics: [{ id: 'addition' }],
    teachingPlans: { addition: { ...teachingPlan(ids), gaps: ['A genuine gap.', CORRUPT], exclusions: [] } },
    issues: findings,
    automaticRepairs: { addition: 3 },
    status: 'failed',
    error: 'This chapter still needs a correction after 3 of 3 automatic correction attempts.',
    ...rest
  }
}

test('a chapter failed only because a gaps entry is corrupt re-enters review for free, with zero model calls, even at the correction limit', () => {
  const work = failedWork([
    { topicId: 'addition', severity: 'error', detail: `The chapter's 'gaps' entry ends with a malformed JSON fragment: '${CORRUPT}'. This is syntactically invalid.` },
    { topicId: 'addition', severity: 'error', detail: `The 'gaps' list in the chapter payload includes a corrupted/truncated entry ('${CORRUPT}') which appears to be malformed JSON or stray text.` },
    { topicId: 'addition', severity: 'warning', detail: 'The gaps subsection could be phrased more concisely.' }
  ], {
    chapter: {
      evidenceReview: { issues: [{ severity: 'error', detail: `corrupted/truncated entry ('${CORRUPT}') in the gaps list`, topicId: 'addition' }] },
      pedagogyAudit: { reviews: { 'objective-1': { issues: [{ severity: 'error', detail: 'The gaps list contains malformed JSON.' }, { severity: 'warning', detail: 'Consider one more worked example.' }] } } },
      factualAudit: { judgments: { scope: { correct: false, issues: [{ severity: 'error', detail: `The gaps entry '${CORRUPT}' is corrupt.` }] } } }
    }
  })
  assert.equal(recoverFailedChapterByCorruptPlanProse(work), true)
  const recovered = work.chapters[0]
  assert.equal(recovered.review, 'pending')
  assert.deepEqual(recovered.teachingPlan.gaps, ['A genuine gap.'])
  assert.deepEqual(work.teachingPlans.addition.gaps, ['A genuine gap.'])
  assert.deepEqual(work.issues, [])
  assert.equal(work.stage, 'review')
  assert.equal(work.error, undefined)
  assert.equal(work.automaticRepairs.addition, 3) // unchanged: no correction spent
  // Every cache that held the same stale finding verbatim is cleared, and
  // nothing else a paid review decided is touched.
  assert.deepEqual(recovered.evidenceReview.issues, [])
  assert.deepEqual(recovered.pedagogyAudit.reviews['objective-1'].issues, [{ severity: 'warning', detail: 'Consider one more worked example.' }])
  assert.deepEqual(recovered.factualAudit.judgments.scope, { correct: true, issues: [] })
})

test('a chapter carrying any other error finding is left for the ordinary correction path', () => {
  const work = failedWork([
    { topicId: 'addition', severity: 'error', detail: `The 'gaps' list includes a corrupted entry ('${CORRUPT}').` },
    { topicId: 'addition', severity: 'error', detail: 'The worked example computes the wrong total.' }
  ])
  assert.equal(recoverFailedChapterByCorruptPlanProse(work), false)
  assert.equal(work.chapters[0].review, 'failed')
  assert.equal(work.issues.length, 2)
})

test('a chapter that never carried corrupt prose is never recovered for free, however the finding is worded', () => {
  const work = failedWork([{ topicId: 'addition', severity: 'error', detail: 'The gaps explanation is truncated mid-sentence and reads as corrupt to a student.' }], {
    chapter: { teachingPlan: { ...teachingPlan(ids), gaps: ['A genuine gap.'], exclusions: [] } }
  })
  assert.equal(recoverFailedChapterByCorruptPlanProse(work), false)
  assert.equal(work.chapters[0].review, 'failed')
})

test('a chapter an earlier pass already repaired still clears its stale findings and re-enters review', () => {
  const work = failedWork([{ topicId: 'addition', severity: 'error', detail: `The 'gaps' list includes a corrupted/truncated entry ('${CORRUPT}'), malformed JSON or stray text.` }], {
    chapter: { teachingPlan: { ...teachingPlan(ids), gaps: ['A genuine gap.'], exclusions: [] }, proseRepairs: [{ field: 'teachingPlan.gaps', index: 1, reason: 'stray JSON key punctuation', dropped: true }] }
  })
  assert.equal(recoverFailedChapterByCorruptPlanProse(work), true)
  assert.equal(work.chapters[0].review, 'pending')
  assert.deepEqual(work.issues, [])
})
