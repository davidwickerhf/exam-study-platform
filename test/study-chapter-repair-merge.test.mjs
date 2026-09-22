import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, prepareLesson } from '../lib/study-version-pipeline.mjs'
import { isSchemaFormatError } from '../lib/study-version-content.mjs'
import { course, lesson, teachingPlan } from '../scripts/verification/study-fixtures.mjs'

// A chapter with two CLEANLY SEPARATED objectives (unlike the shared lesson()
// fixture, whose three objectives all share every section/question): the
// first four questions/first two sections belong to objective-1, the rest to
// objective-2. This is what actually exercises a bounded, single-objective
// patch — the shared fixture's entangled tagging cannot, because a finding
// on one objective there pulls in every section and question at once.
function twoObjectiveChapter(ids, { breakObjective2 = false } = {}) {
  const base = lesson(ids)
  const plan = {
    objectives: [
      { id: 'objective-1', goal: 'Goal one.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'd1', teachingApproach: 'a1' },
      { id: 'objective-2', goal: 'Goal two.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'd2', teachingApproach: 'a2' }
    ],
    exclusions: [], gaps: []
  }
  const sections = base.sections.map((s, i) => ({ ...s, objectiveIds: [i < 2 ? 'objective-1' : 'objective-2'] }))
  // base.questions practiceStage layout: index 0-1 guided, 2-5 independent, 6-7 transfer.
  // The base fixture's misconception follow-ups all point across its three
  // shared objectives; once retagged onto two disjoint objectives here those
  // links would cross objectives (a real objectiveCoverageIssues finding
  // unrelated to what these tests exercise), so they are cleared — these
  // objectives are 'simple' and do not require diagnostic misconceptions.
  const questions = base.questions.map((q, i) => ({
    ...q,
    objectiveIds: [i < 4 ? 'objective-1' : 'objective-2'],
    practiceStage: breakObjective2 && i >= 4 && i < 6 ? 'guided' : q.practiceStage,
    misconceptions: []
  }))
  const objectiveCoverage = [
    { objectiveId: 'objective-1', explanationSectionIds: ['section-1'], workedExampleSectionIds: ['section-1'], guidedQuestionKeys: ['question-1', 'question-2'], independentQuestionKeys: ['question-3', 'question-4'], transferQuestionKeys: [] },
    { objectiveId: 'objective-2', explanationSectionIds: ['section-3'], workedExampleSectionIds: ['section-3'], guidedQuestionKeys: breakObjective2 ? ['question-5', 'question-6'] : [], independentQuestionKeys: breakObjective2 ? [] : ['question-5', 'question-6'], transferQuestionKeys: ['question-7', 'question-8'] }
  ]
  return { ...base, id: 'two-objective-chapter', teachingPlan: plan, objectiveCoverage, sections, questions }
}

async function fixture() {
  const userId = `study-chapter-repair-merge-${randomUUID()}`
  const context = { userId, mode: 'local' }
  const run = (fn) => withRequestContext(context, fn)
  const { version, snapshot } = await run(async () => {
    const note = await addStudyNote(
      { ...course, title: 'Merge notes' },
      [{ page: 1, text: 'Two disjoint objectives, each with its own teaching and practice, for merge-order testing.' }]
    )
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(course, 'programme-test', snapshot)
    return { version, snapshot }
  })
  return { run, version, snapshot, cleanup: () => run(deleteAllDocuments) }
}
const draftOf = async (id) => (await ownStudyVersion(id)).draft

// --- Unit level: prepareLesson is the single acceptance point, and it must
// derive objectiveCoverage from the merged content BEFORE the strict schema
// runs, not validate the stale coverage a bounded patch never touched. ---

test('prepareLesson recomputes coverage from the merged content before the strict schema check', () => {
  const ids = ['e-1']
  const chapter = twoObjectiveChapter(ids)
  const merged = structuredClone(chapter)
  // Simulate applyQuestionRepair's merge: a bounded patch already fixed
  // objective-1's questions, but never touches objectiveCoverage (see the
  // PATCH PACKET note in study-chapter-repair.mjs), so the merged object
  // still carries the stale, pre-correction coverage row for objective-1.
  merged.objectiveCoverage[0] = { ...merged.objectiveCoverage[0], independentQuestionKeys: [] }
  const prepared = prepareLesson(merged, { id: 'two-objective-chapter', sourceIds: ids }, ids.map((id) => ({ id })), chapter.teachingPlan)
  const objective1 = prepared.objectiveCoverage.find((c) => c.objectiveId === 'objective-1')
  const objective2 = prepared.objectiveCoverage.find((c) => c.objectiveId === 'objective-2')
  // objective-1's TRUE coverage (recomputed from the merged questions) wins
  // over the stale claim that it had none.
  assert.deepEqual([...objective1.independentQuestionKeys].sort(), ['question-3', 'question-4'])
  // objective-2 was never touched by the patch: its links come back exactly
  // as they already were, because its own questions/sections did not change.
  assert.deepEqual([...objective2.independentQuestionKeys].sort(), ['question-5', 'question-6'])
})

test('prepareLesson still rejects a merged chapter whose untouched objective genuinely lacks required coverage', () => {
  const ids = ['e-1']
  const chapter = twoObjectiveChapter(ids, { breakObjective2: true })
  // objective-2 genuinely has no independent question in the merged content
  // (not a stale artifact): recomputing must not fabricate a pass.
  assert.throws(
    () => prepareLesson(chapter, { id: 'two-objective-chapter', sourceIds: ids }, ids.map((id) => ({ id })), chapter.teachingPlan),
    (error) => isSchemaFormatError(error) && /independentQuestionKeys/.test(error.message)
  )
})

// --- Pipeline level: the bounded patch really is only about its targeted
// question, a genuinely broken untouched objective is caught (not crashed),
// exactly one format retry happens, and the correction budget/resume path
// carries the state forward instead of resetting it. ---

test('a bounded patch merges and passes using the untouched objective\'s existing coverage', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      const chapter = twoObjectiveChapter(ids)
      const correctedQuestion3 = { ...chapter.questions[2], answer: 'Corrected reasoning for question-3.' }
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'two-objective-chapter', title: 'Two Objective Chapter', sourceIds: ids }]
        v.draft.teachingPlans = { 'two-objective-chapter': chapter.teachingPlan }
        v.draft.chapters = []
        v.draft.automaticRepairs = {}
        v.draft.issues = [{ severity: 'error', topicId: 'two-objective-chapter', itemKey: 'question:question-3', detail: 'question-3: fix the reasoning.' }]
        v.draft.repair = { topicId: 'two-objective-chapter', phase: 'structure', chapter }
      })
      let calls = 0
      await processStudyStep(f.version.id, {
        generate: async () => { calls++; return { questions: { 'question-3': correctedQuestion3 } } }
      })
      assert.equal(calls, 1)
      const draft = await draftOf(f.version.id)
      assert.notEqual(draft.status, 'failed')
      assert.equal(draft.chapters.length, 1)
      const merged = draft.chapters[0]
      assert.equal(merged.questions.find((q) => q.key === 'question-3').answer, 'Corrected reasoning for question-3.')
      const objective2 = merged.objectiveCoverage.find((c) => c.objectiveId === 'objective-2')
      assert.deepEqual([...objective2.independentQuestionKeys].sort(), ['question-5', 'question-6'])
    })
  } finally {
    await f.cleanup()
  }
})

test('a schema-invalid merge is retried once with the validation error, then routed to correction instead of crashing', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      // objective-2 is genuinely broken; the finding only targets objective-1's
      // question-3, and the provider's bounded response is itself schema-valid
      // both times, so this reproduces the real failure: the merge is rejected
      // on objective-2, not on anything the patch actually returned.
      const chapter = twoObjectiveChapter(ids, { breakObjective2: true })
      const correctedQuestion3 = { ...chapter.questions[2], answer: 'Corrected reasoning for question-3.' }
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'two-objective-chapter', title: 'Two Objective Chapter', sourceIds: ids }]
        v.draft.teachingPlans = { 'two-objective-chapter': chapter.teachingPlan }
        v.draft.chapters = []
        v.draft.automaticRepairs = {}
        v.draft.issues = [{ severity: 'error', topicId: 'two-objective-chapter', itemKey: 'question:question-3', detail: 'question-3: fix the reasoning.' }]
        v.draft.repair = { topicId: 'two-objective-chapter', phase: 'structure', chapter }
      })
      let calls = 0
      const prompts = []
      await processStudyStep(f.version.id, {
        generate: async (prompt) => { calls++; prompts.push(prompt); return { questions: { 'question-3': correctedQuestion3 } } }
      })
      // Bounded to exactly one retry: the original attempt plus one retry, never more.
      assert.equal(calls, 2)
      assert.doesNotMatch(prompts[0], /FORMAT RETRY/)
      assert.match(prompts[1], /FORMAT RETRY/)
      assert.match(prompts[1], /independentQuestionKeys/)
      const draft = await draftOf(f.version.id)
      // Not exhausted (default limit is 3, this is the first attempt): routed
      // through the ordinary correction budget instead of failing the run.
      assert.notEqual(draft.status, 'failed')
      assert.equal(draft.automaticRepairs['two-objective-chapter'], 1)
      assert.ok(draft.repair?.chapter, 'a fresh repair round is queued instead of the run crashing')
      assert.equal(draft.chapters.length, 0)
    })
  } finally {
    await f.cleanup()
  }
})

test('resuming after a routed format failure uses the fixed path without resetting the correction counter', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      const broken = twoObjectiveChapter(ids, { breakObjective2: true })
      const correctedQuestion3 = { ...broken.questions[2], answer: 'Corrected reasoning for question-3.' }
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'two-objective-chapter', title: 'Two Objective Chapter', sourceIds: ids }]
        v.draft.teachingPlans = { 'two-objective-chapter': broken.teachingPlan }
        v.draft.chapters = []
        v.draft.automaticRepairs = {}
        v.draft.issues = [{ severity: 'error', topicId: 'two-objective-chapter', itemKey: 'question:question-3', detail: 'question-3: fix the reasoning.' }]
        v.draft.repair = { topicId: 'two-objective-chapter', phase: 'structure', chapter: broken }
      })
      // Round 1: the same schema-invalid merge as above, routed to correction.
      await processStudyStep(f.version.id, {
        generate: async () => ({ questions: { 'question-3': correctedQuestion3 } })
      })
      const afterRound1 = await draftOf(f.version.id)
      assert.notEqual(afterRound1.status, 'failed')
      assert.equal(afterRound1.automaticRepairs['two-objective-chapter'], 1)
      // The unlocated format finding forces the next round to a whole-chapter
      // rewrite (a bounded patch can never add a missing independent
      // question), so RESUME here supplies one, with objective-2 genuinely
      // fixed this time.
      const fixedChapter = twoObjectiveChapter(ids)
      let calls = 0
      await processStudyStep(f.version.id, {
        generate: async () => { calls++; return fixedChapter }
      })
      assert.equal(calls, 1)
      const afterResume = await draftOf(f.version.id)
      assert.notEqual(afterResume.status, 'failed')
      assert.equal(afterResume.chapters.length, 1)
      // The correction counter carries forward from round 1; resume never
      // resets it back to zero.
      assert.equal(afterResume.automaticRepairs['two-objective-chapter'], 1)
      const objective2 = afterResume.chapters[0].objectiveCoverage.find((c) => c.objectiveId === 'objective-2')
      assert.ok(objective2.independentQuestionKeys.length > 0)
    })
  } finally {
    await f.cleanup()
  }
})

test('an exhausted correction budget fails cleanly with the saved error instead of looping', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      const chapter = twoObjectiveChapter(ids, { breakObjective2: true })
      const correctedQuestion3 = { ...chapter.questions[2], answer: 'Corrected reasoning for question-3.' }
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'two-objective-chapter', title: 'Two Objective Chapter', sourceIds: ids }]
        v.draft.teachingPlans = { 'two-objective-chapter': chapter.teachingPlan }
        v.draft.chapters = []
        // Already at the default correction limit: this attempt cannot buy
        // another round.
        v.draft.automaticRepairs = { 'two-objective-chapter': 3 }
        v.draft.issues = [{ severity: 'error', topicId: 'two-objective-chapter', itemKey: 'question:question-3', detail: 'question-3: fix the reasoning.' }]
        v.draft.repair = { topicId: 'two-objective-chapter', phase: 'structure', chapter }
      })
      let calls = 0
      await processStudyStep(f.version.id, {
        generate: async () => { calls++; return { questions: { 'question-3': correctedQuestion3 } } }
      })
      assert.equal(calls, 2, 'still bounded to exactly one retry even when the budget is already spent')
      const draft = await draftOf(f.version.id)
      assert.equal(draft.status, 'failed')
      assert.match(draft.error, /automatic correction attempts/)
    })
  } finally {
    await f.cleanup()
  }
})
