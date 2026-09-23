import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration, splitChapterDraft, recoverFailedChapterByOutputLimit } from '../lib/study-version-pipeline.mjs'
import { PROVIDER_OUTPUT_LIMIT_MESSAGE } from '../lib/study-provider-errors.mjs'
import { GUIDE_CHAPTER_LIMIT, StudyVersionError } from '../lib/study-version-content.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'

const outputLimit = () => Object.assign(new StudyVersionError(PROVIDER_OUTPUT_LIMIT_MESSAGE, 502), { code: 'provider_output_limit' })

// A minimal but schema-valid two-objective plan whose objectives cite
// disjoint evidence, so a split's evidence partition is actually meaningful
// to assert on (unlike the shared fixture teachingPlan(), whose objectives
// all cite the identical full evidence set).
function twoObjectivePlan(ids) {
  return {
    objectives: [
      { id: 'objective-1', goal: 'Explain the first half of the material.', complexity: 'simple', basis: 'course', sourceIds: [ids[0], ids[1], ids[2]], prerequisites: [], demonstration: 'Demonstrate the first half.', teachingApproach: 'Teach the first half directly.' },
      { id: 'objective-2', goal: 'Explain the second half of the material.', complexity: 'simple', basis: 'course', sourceIds: [ids[3], ids[4], ids[5]], prerequisites: [], demonstration: 'Demonstrate the second half.', teachingApproach: 'Teach the second half directly.' }
    ],
    exclusions: [], gaps: []
  }
}
// Reuse the fixture's rich, already-valid chapter content, but retag every
// section/question onto a single objective id so it matches a split half's
// reduced plan instead of the fixture's own three shared objectives.
function forObjective(ids, objectiveId) {
  const base = lesson(ids)
  return {
    ...base,
    sections: base.sections.map(s => ({ ...s, objectiveIds: [objectiveId] })),
    questions: base.questions.map(q => ({ ...q, objectiveIds: [objectiveId] }))
  }
}

async function fixture() {
  const userId = `study-chapter-split-${randomUUID()}`
  const context = { userId, mode: 'local' }
  const run = (fn) => withRequestContext(context, fn)
  const { version, snapshot } = await run(async () => {
    const note = await addStudyNote(
      { ...course, title: 'Split notes' },
      Array.from({ length: 6 }, (_, i) => ({ page: i + 1, text: `Lesson ${i + 1} explains a distinct part of the material with enough words to count as real teaching content.` }))
    )
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(course, 'programme-test', snapshot)
    return { version, snapshot }
  })
  return { run, version, snapshot, cleanup: () => run(deleteAllDocuments) }
}
const draftOf = async id => (await ownStudyVersion(id)).draft

test('splitChapterDraft partitions objectives and evidence with nothing lost', () => {
  const evidence = [
    { id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }, { id: 'e5' }, { id: 'c1', scopeContext: true }
  ]
  const topic = { id: 'addition', title: 'Addition', guideId: 'guide-1', sourceIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'c1'] }
  const plan = {
    objectives: [
      { id: 'o1', goal: 'Goal one', complexity: 'simple', basis: 'course', sourceIds: ['e1', 'e2'], prerequisites: [{ text: 'Prereq', basis: 'background', sourceIds: ['c1'] }], demonstration: 'D1', teachingApproach: 'A1' },
      { id: 'o2', goal: 'Goal two', complexity: 'simple', basis: 'course', sourceIds: ['e3'], prerequisites: [], demonstration: 'D2', teachingApproach: 'A2' },
      // e4 is never cited by any objective: it must not be dropped.
      { id: 'o3', goal: 'Goal three', complexity: 'simple', basis: 'course', sourceIds: ['e5'], prerequisites: [], demonstration: 'D3', teachingApproach: 'A3' }
    ],
    exclusions: [], gaps: []
  }
  const work = { topics: [{ id: 'before', guideId: 'guide-1' }, topic, { id: 'after', guideId: 'guide-1' }], teachingPlans: { addition: plan } }
  assert.equal(splitChapterDraft(work, topic, evidence), true)
  assert.equal(work.topics.length, 4)
  const [before, part1, part2, after] = work.topics
  assert.equal(before.id, 'before')
  assert.equal(after.id, 'after')
  assert.equal(part1.id, 'addition-part-1')
  assert.equal(part2.id, 'addition-part-2')
  assert.equal(part1.title, 'Addition · Part 1')
  assert.equal(part2.title, 'Addition · Part 2')
  assert.equal(part1.guideId, 'guide-1')
  assert.equal(part2.guideId, 'guide-1')
  assert.equal(part1.chapterSplitPart, true)
  assert.equal(part2.chapterSplitPart, true)
  // Objectives: o1+o2 in the first half, o3 alone in the second. Both keep
  // their complete definitions untouched.
  assert.deepEqual(work.teachingPlans['addition-part-1'].objectives, [plan.objectives[0], plan.objectives[1]])
  assert.deepEqual(work.teachingPlans['addition-part-2'].objectives, [plan.objectives[2]])
  assert.equal(work.teachingPlans.addition, undefined)
  // Evidence: e1/e2 (o1) and e3 (o2) plus the unassigned e4 land in the
  // first half; e5 (o3) in the second. Context c1 is shared by both. Every
  // original evidence id is present in the union, nothing is duplicated
  // away and nothing is lost.
  assert.deepEqual([...part1.sourceIds].sort(), ['c1', 'e1', 'e2', 'e3', 'e4'])
  assert.deepEqual([...part2.sourceIds].sort(), ['c1', 'e5'])
  const union = new Set([...part1.sourceIds, ...part2.sourceIds])
  assert.deepEqual([...union].sort(), [...topic.sourceIds].sort())
  assert.equal(work.chapterSplits.length, 1)
  assert.deepEqual(work.chapterSplits[0].parts, ['addition-part-1', 'addition-part-2'])
  assert.equal(work.chapterSplits[0].originalId, 'addition')
  assert.equal(work.chapterSplits[0].reason, 'provider_output_limit')
})

test('a produced half can never split again', () => {
  const evidence = [{ id: 'e1' }, { id: 'e2' }]
  const topic = { id: 'addition-part-1', title: 'Addition · Part 1', chapterSplitPart: true, sourceIds: ['e1', 'e2'] }
  const plan = { objectives: [
    { id: 'o1', goal: 'g', complexity: 'simple', basis: 'course', sourceIds: ['e1'], prerequisites: [], demonstration: 'd', teachingApproach: 'a' },
    { id: 'o2', goal: 'g', complexity: 'simple', basis: 'course', sourceIds: ['e2'], prerequisites: [], demonstration: 'd', teachingApproach: 'a' }
  ], exclusions: [], gaps: [] }
  const work = { topics: [topic], teachingPlans: { 'addition-part-1': plan } }
  assert.equal(splitChapterDraft(work, topic, evidence), false)
})

test('a split that would breach the guide chapter cap fails safely', () => {
  const evidence = [{ id: 'e1' }, { id: 'e2' }]
  const topic = { id: 'addition', title: 'Addition', guideId: 'guide-1', sourceIds: ['e1', 'e2'] }
  const plan = { objectives: [
    { id: 'o1', goal: 'g', complexity: 'simple', basis: 'course', sourceIds: ['e1'], prerequisites: [], demonstration: 'd', teachingApproach: 'a' },
    { id: 'o2', goal: 'g', complexity: 'simple', basis: 'course', sourceIds: ['e2'], prerequisites: [], demonstration: 'd', teachingApproach: 'a' }
  ], exclusions: [], gaps: [] }
  const siblings = Array.from({ length: GUIDE_CHAPTER_LIMIT - 1 }, (_, i) => ({ id: `sibling-${i}`, guideId: 'guide-1' }))
  const work = { topics: [...siblings, topic], teachingPlans: { addition: plan } }
  assert.equal(work.topics.filter(t => t.guideId === 'guide-1').length, GUIDE_CHAPTER_LIMIT)
  assert.equal(splitChapterDraft(work, topic, evidence), false)
  assert.equal(work.topics.length, GUIDE_CHAPTER_LIMIT)
})

test('a first-draft output limit splits the chapter instead of failing, and each half then drafts on its own checkpoint', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: twoObjectivePlan(ids) }
      })
      let calls = 0
      const chapterIds = []
      const generate = async (prompt, options) => {
        calls++
        if (calls === 1) throw outputLimit()
        chapterIds.push(options.usageMetadata.chapterId)
        const half = options.usageMetadata.chapterId === 'addition-part-1' ? ids.slice(0, 3) : ids.slice(3, 6)
        const objectiveId = options.usageMetadata.chapterId === 'addition-part-1' ? 'objective-1' : 'objective-2'
        return forObjective(half, objectiveId)
      }
      await processStudyStep(f.version.id, { generate })
      const split = await draftOf(f.version.id)
      assert.notEqual(split.status, 'failed')
      assert.equal(split.error, null)
      assert.equal(split.topics.length, 2)
      assert.equal(split.topics[0].id, 'addition-part-1')
      assert.equal(split.topics[1].id, 'addition-part-2')
      assert.equal(split.chapters.length, 0)
      assert.equal(split.chapterSplits.length, 1)
      assert.equal(calls, 1)

      // Next checkpoint drafts the FIRST half only.
      await processStudyStep(f.version.id, { generate })
      const afterFirstHalf = await draftOf(f.version.id)
      assert.equal(calls, 2)
      assert.deepEqual(chapterIds, ['addition-part-1'])
      assert.equal(afterFirstHalf.chapters.length, 1)
      assert.equal(afterFirstHalf.chapters[0].id, 'addition-part-1')
      // The second half is still untouched: it drafts separately, later.
      assert.ok(!afterFirstHalf.chapters.some(c => c.id === 'addition-part-2'))
    })
  } finally {
    await f.cleanup()
  }
})

test('a half that also exhausts the output limit fails safely instead of splitting again', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: twoObjectivePlan(ids) }
      })
      const generate = async () => { throw outputLimit() }
      await processStudyStep(f.version.id, { generate })
      const split = await draftOf(f.version.id)
      assert.equal(split.topics.length, 2)
      assert.equal(split.chapterSplits.length, 1)
      // The first half's own first draft also exhausts the output cap.
      await processStudyStep(f.version.id, { generate })
      const failed = await draftOf(f.version.id)
      assert.equal(failed.status, 'failed')
      assert.equal(failed.error, PROVIDER_OUTPUT_LIMIT_MESSAGE)
      // No further split: the topic list and split ledger are unchanged.
      assert.equal(failed.topics.length, 2)
      assert.equal(failed.chapterSplits.length, 1)
    })
  } finally {
    await f.cleanup()
  }
})

test('a correction hitting the output limit does not trigger a split', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      const plan = twoObjectivePlan(ids)
      const failedChapter = { ...forObjective(ids, 'objective-1'), id: 'addition', teachingPlan: plan }
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: plan }
        v.draft.chapters = []
        v.draft.automaticRepairs = { addition: 1 }
        v.draft.issues = [{ severity: 'error', topicId: 'addition', detail: 'Needs a broader correction unrelated to any single item.' }]
        v.draft.repair = { topicId: 'addition', chapter: failedChapter }
      })
      const generate = async () => { throw outputLimit() }
      await processStudyStep(f.version.id, { generate })
      const failed = await draftOf(f.version.id)
      assert.equal(failed.status, 'failed')
      assert.equal(failed.error, PROVIDER_OUTPUT_LIMIT_MESSAGE)
      // No split happened: still one topic, no chapterSplits ledger.
      assert.equal(failed.topics.length, 1)
      assert.equal(failed.topics[0].id, 'addition')
      assert.equal(failed.chapterSplits, undefined)
    })
  } finally {
    await f.cleanup()
  }
})

test('a resumed run repeats the recorded split boundaries', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: twoObjectivePlan(ids) }
      })
      const generate = async () => { throw outputLimit() }
      await processStudyStep(f.version.id, { generate })
      const first = await draftOf(f.version.id)
      const boundaries = first.topics.map(t => t.id)
      const splitLedger = structuredClone(first.chapterSplits)
      // Simulate an interrupted worker resuming: the same saved state is
      // re-entered without repeating the split or reordering the halves.
      await mutateStudyVersion(f.version.id, v => { v.draft.status = 'local-ready'; v.draft.error = null })
      const resumeGenerate = async (prompt, options) => {
        assert.equal(options.usageMetadata.chapterId, 'addition-part-1')
        throw outputLimit()
      }
      await processStudyStep(f.version.id, { generate: resumeGenerate })
      const resumed = await draftOf(f.version.id)
      assert.deepEqual(resumed.topics.map(t => t.id), boundaries)
      assert.deepEqual(resumed.chapterSplits, splitLedger)
    })
  } finally {
    await f.cleanup()
  }
})

test('a draft saved as failed at the output limit resumes into the split, not the oversized draft', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.status = 'failed'
        v.draft.error = PROVIDER_OUTPUT_LIMIT_MESSAGE
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: twoObjectivePlan(ids) }
      })
      // Zero-cost: the split happens inside controlStudyGeneration, before
      // any provider call.
      await controlStudyGeneration(f.version.id, 'retry')
      const resumed = await draftOf(f.version.id)
      assert.notEqual(resumed.status, 'failed')
      assert.equal(resumed.error, null)
      assert.equal(resumed.topics.length, 2)
      assert.equal(resumed.topics[0].id, 'addition-part-1')
      assert.equal(resumed.topics[1].id, 'addition-part-2')
      assert.equal(resumed.chapterSplits.length, 1)
      // The next step drafts the first half directly; it never repeats the
      // original oversized 'addition' draft.
      let calls = 0
      const generate = async (prompt, options) => {
        calls++
        assert.equal(options.usageMetadata.chapterId, 'addition-part-1')
        return forObjective(ids.slice(0, 3), 'objective-1')
      }
      await processStudyStep(f.version.id, { generate })
      assert.equal(calls, 1)
      const after = await draftOf(f.version.id)
      assert.equal(after.chapters.some(c => c.id === 'addition-part-1'), true)
    })
  } finally {
    await f.cleanup()
  }
})

test('recoverFailedChapterByOutputLimit leaves a correction, refresh or edit run untouched', () => {
  const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']
  const plan = twoObjectivePlan(ids)
  const base = { stage: 'chapters', error: PROVIDER_OUTPUT_LIMIT_MESSAGE, topics: [{ id: 'addition', title: 'Addition', sourceIds: ids }], chapters: [], teachingPlans: { addition: plan }, snapshot: { chunks: ids.map(id => ({ id, sourceKey: 'note', text: 'x' })), sources: [] } }
  assert.equal(recoverFailedChapterByOutputLimit({ ...base, repair: { topicId: 'addition' } }, course), false)
  assert.equal(recoverFailedChapterByOutputLimit({ ...base, refreshFrom: 'previous-id' }, course), false)
  assert.equal(recoverFailedChapterByOutputLimit({ ...base, edit: { topicId: 'addition' } }, course), false)
  assert.equal(recoverFailedChapterByOutputLimit({ ...base, error: 'A different failure.' }, course), false)
  assert.equal(recoverFailedChapterByOutputLimit({ ...base, teachingPlans: {} }, course), false)
})

test('a chapter that already passed review is untouched by a sibling chapter splitting', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map(c => c.id)
      const passedChapter = { id: 'intro', review: 'passed', title: 'Intro', standard: 'stub' }
      await mutateStudyVersion(f.version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'intro', title: 'Intro', sourceIds: [] }, { id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: twoObjectivePlan(ids) }
        v.draft.chapters = [passedChapter]
      })
      const generate = async () => { throw outputLimit() }
      await processStudyStep(f.version.id, { generate })
      const after = await draftOf(f.version.id)
      assert.equal(after.chapters.length, 1)
      assert.deepEqual(after.chapters[0], passedChapter)
      assert.equal(after.topics.length, 3)
      assert.equal(after.topics[0].id, 'intro')
      assert.equal(after.topics[1].id, 'addition-part-1')
      assert.equal(after.topics[2].id, 'addition-part-2')
    })
  } finally {
    await f.cleanup()
  }
})
