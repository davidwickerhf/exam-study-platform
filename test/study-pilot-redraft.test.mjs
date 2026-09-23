import test from 'node:test'
import assert from 'node:assert/strict'
import { redraftPilotChapter } from '../scripts/verification/study-pilot-redraft.mjs'

test('a model A/B redraft keeps the checked plan and removes only downstream chapter state', () => {
  const chapterId = 'chapter-a'
  const draft = {
    stage: 'review', status: 'failed', error: 'review failed', reviewOnly: true,
    topics: [{ id: chapterId }, { id: 'chapter-b' }],
    teachingPlans: { [chapterId]: { objectives: [{ id: 'objective-a' }] } },
    chapters: [{ id: chapterId, review: 'failed' }, { id: 'chapter-b', review: 'passed' }],
    issues: [{ topicId: chapterId }, { topicId: 'chapter-b' }],
    repair: { topicId: chapterId, chapter: { id: chapterId } },
    automaticRepairs: { [chapterId]: 2, 'chapter-b': 1 },
    pedagogicalPrechecks: { [chapterId]: { status: 'complete' }, 'chapter-b': { status: 'complete' } },
    correctionHistory: [{ chapterId }, { chapterId: 'chapter-b' }],
    precheckLog: [{ chapterId }, { chapterId: 'chapter-b' }],
    mappingBatches: [{ id: 'map-a' }], planSemanticChecks: { [chapterId]: { status: 'passed' } }
  }
  const reset = redraftPilotChapter(draft, chapterId)
  assert.deepEqual(reset.teachingPlans, draft.teachingPlans)
  assert.deepEqual(reset.mappingBatches, draft.mappingBatches)
  assert.deepEqual(reset.planSemanticChecks, draft.planSemanticChecks)
  assert.deepEqual(reset.chapters.map((chapter) => chapter.id), ['chapter-b'])
  assert.deepEqual(reset.issues, [{ topicId: 'chapter-b' }])
  assert.deepEqual(reset.correctionHistory, [{ chapterId: 'chapter-b' }])
  assert.deepEqual(reset.precheckLog, [{ chapterId: 'chapter-b' }])
  assert.equal(reset.automaticRepairs[chapterId], undefined)
  assert.equal(reset.pedagogicalPrechecks[chapterId], undefined)
  assert.equal(reset.repair, undefined)
  assert.equal(reset.error, undefined)
  assert.equal(reset.reviewOnly, undefined)
  assert.equal(reset.stage, 'chapters')
  assert.equal(draft.chapters.length, 2, 'the saved comparison baseline is not mutated')
})

test('a redraft refuses unknown, unplanned and already-passing chapters', () => {
  assert.throws(() => redraftPilotChapter({ topics: [], teachingPlans: {} }, 'missing'), /unknown/)
  assert.throws(() => redraftPilotChapter({ topics: [{ id: 'a' }], teachingPlans: {} }, 'a'), /checked teaching plan/)
  assert.throws(() => redraftPilotChapter({ topics: [{ id: 'a' }], teachingPlans: { a: {} }, chapters: [{ id: 'a', review: 'passed' }] }, 'a'), /passing/)
})

test('a model A/B redraft can enforce the experiment correction target', () => {
  const reset = redraftPilotChapter({ topics: [{ id: 'a' }], teachingPlans: { a: {} }, correctionPolicy: { maxAttempts: 3 } }, 'a', { maxCorrections: 1 })
  assert.equal(reset.correctionPolicy.maxAttempts, 1)
  assert.throws(() => redraftPilotChapter({ topics: [{ id: 'a' }], teachingPlans: { a: {} } }, 'a', { maxCorrections: 6 }), /0 to 5/)
})
