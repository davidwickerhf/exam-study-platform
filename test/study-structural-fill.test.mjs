import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, prepareLesson, controlStudyGeneration } from '../lib/study-version-pipeline.mjs'
import { repairContractMechanics, contractIssues } from '../lib/study-chapter-contract.mjs'
import { questionRepairStep } from '../lib/study-chapter-repair.mjs'
import { teachingSchema } from '../lib/study-version-content.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'

// One simple and one difficult objective on disjoint items. With
// missingTransfer, obj-b's two transfer questions are drafted as independent,
// so the difficult objective lacks transfer practice.
function draftChapter(ids, {missingTransfer = true} = {}) {
  const base = lesson(ids)
  const plan = {objectives: [
    {id: 'obj-a', goal: 'Combine disjoint quantities.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Add two groups.', teachingApproach: 'Explain and practise.'},
    {id: 'obj-b', goal: 'Diagnose double counting.', complexity: 'difficult', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Diagnose an overlap.', teachingApproach: 'Work a case, then vary it.'}
  ], exclusions: [], gaps: []}
  const stages = ['independent', 'independent', 'independent', 'independent', 'guided', 'independent', missingTransfer ? 'independent' : 'transfer', 'transfer']
  const questions = base.questions.map((q, i) => ({...q, objectiveIds: [i < 4 ? 'obj-a' : 'obj-b'], practiceStage: i === 7 && missingTransfer ? 'independent' : stages[i],
    hints: ['Count each group.', 'Remove the overlap first.'],
    misconceptions: i < 4 ? [] : [{mistake: 'Counting shared items twice.', explanation: 'Shared items belong to both groups.', followUpKey: base.questions[i === 7 ? 6 : 7].key}]}))
  const sections = base.sections.map((s, i) => ({...s, objectiveIds: [i < 2 ? 'obj-a' : 'obj-b']}))
  const {teachingPlan: _p, ...content} = base
  return {plan, draft: {...content, sections, questions, objectiveCoverage: [
    {objectiveId: 'obj-a', explanationSectionIds: ['section-1'], workedExampleSectionIds: [], guidedQuestionKeys: [], independentQuestionKeys: ['question-1'], transferQuestionKeys: []},
    {objectiveId: 'obj-b', explanationSectionIds: ['section-3'], workedExampleSectionIds: ['section-3'], guidedQuestionKeys: ['question-5'], independentQuestionKeys: ['question-6'], transferQuestionKeys: []}
  ]}}
}
function transferAddition(draft, key = 'question-9') {
  const template = teachingSchema.shape.questions.element.parse(draft.questions[4])
  return {...template, key, objectiveIds: ['obj-b'], practiceStage: 'transfer', difficulty: 'challenge', skill: 'transfer',
    question: 'A register lists 7 members of club A and 5 of club B, but the total head count is 10. Which hidden assumption failed, and what does the discrepancy reveal?',
    answer: 'Adding 7 and 5 gives 12, two more than the head count, so the groups were not disjoint: two people belong to both clubs. The reasoning reverses the worked addition by inferring the overlap from the totals.',
    misconceptions: [{mistake: 'Assuming the register must be wrong.', explanation: 'A total below the sum is exactly what overlapping membership predicts.', followUpKey: 'question-5'}]}
}

test('mechanical violations are repaired for free before any check, and every repair is recorded', () => {
  const ids = ['e-1']
  const {plan, draft} = draftChapter(ids, {missingTransfer: false})
  const chapter = {...teachingSchema.parse(draft), teachingPlan: plan}
  chapter.questions[1] = {...chapter.questions[1], key: chapter.questions[0].key, hint: ''}
  chapter.questions[2] = {...chapter.questions[2], objective: ''}
  chapter.questions[3] = {...chapter.questions[3], type: 'tf', options: ['False', 'True'], correctOptions: [0]}
  const repaired = repairContractMechanics(chapter)
  assert.equal(repaired.questions[1].key, `${chapter.questions[0].key}-2`)
  assert.equal(repaired.questions[1].hint, 'Count each group.')
  assert.equal(repaired.questions[2].objective, 'Combine disjoint quantities.')
  assert.deepEqual([repaired.questions[3].options, repaired.questions[3].correctOptions], [['True', 'False'], [1]])
  assert.deepEqual(repaired.contractRepairs.map(row => row.rule).sort(), ['question.duplicate-identity', 'question.first-hint', 'question.objective', 'question.tf-order'])
  // prepareLesson, the single acceptance point, applies the same repairs.
  const prepared = prepareLesson(JSON.stringify({...draft, questions: repaired.questions.map((q, i) => i === 1 ? {...q, key: chapter.questions[0].key} : q)}), {id: 'c', sourceIds: ids}, ids.map(id => ({id})), plan)
  assert.equal(new Set(prepared.questions.map(q => q.key)).size, prepared.questions.length)
  assert.ok(prepared.contractRepairs.some(row => row.rule === 'question.duplicate-identity'))
})

test('a missing-item finding is never routed to a stage-locked bounded patch', () => {
  const ids = ['e-1']
  const {plan, draft} = draftChapter(ids)
  const chapter = {...teachingSchema.parse(draft), teachingPlan: plan, id: 'c'}
  const step = questionRepairStep(course, [], [{id: 'e-1', sourceKey: 's', text: 'Evidence.'}], chapter, [{severity: 'error', itemKey: 'objective:obj-b', detail: 'obj-b: difficult objectives need worked reasoning, a supported attempt and transfer practice.'}])
  assert.equal(step, null, 'only a whole-chapter correction can add what is missing once the fill is exhausted')
})

async function fixture() {
  const userId = `study-structural-fill-${randomUUID()}`
  const run = fn => withRequestContext({userId, mode: 'local'}, fn)
  const {version, snapshot} = await run(async () => {
    const note = await addStudyNote({...course, title: 'Fill notes'}, [{page: 1, text: 'Addition combines disjoint quantities; overlapping groups must be counted once.'}])
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    return {version: await createStudyVersion(course, 'programme-test', snapshot), snapshot}
  })
  const ids = snapshot.chunks.map(c => c.id)
  const {plan, draft} = draftChapter(ids)
  await run(() => mutateStudyVersion(version.id, v => {
    v.draft.stage = 'chapters'
    v.draft.topics = [{id: 'fill-chapter', title: 'Fill chapter', sourceIds: ids}]
    v.draft.chapters = []
    v.draft.teachingPlans = {'fill-chapter': plan}
  }))
  return {run, version, ids, plan, draft, cleanup: () => run(deleteAllDocuments)}
}
const draftOf = async id => (await ownStudyVersion(id)).draft

test('the structural fill adds the missing practice on the authoring route without consuming a correction slot', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const calls = []
      const generate = async (prompt, options) => {
        calls.push({prompt, phase: options.usageMetadata.phase})
        if (prompt.includes('STRUCTURAL FILL')) return {sections: [], questions: [transferAddition(f.draft)], workedExamples: {'obj-b': []}}
        return JSON.stringify(f.draft)
      }
      await processStudyStep(f.version.id, {generate})
      let draft = await draftOf(f.version.id)
      assert.equal(draft.chapters.length, 0, 'the draft waits for its fill before any review')
      assert.equal(draft.structuralFill.findings[0].rule, 'objective.difficult-stages')
      await processStudyStep(f.version.id, {generate})
      draft = await draftOf(f.version.id)
      assert.equal(calls.length, 2)
      assert.equal(calls[1].phase, 'structural-fill')
      assert.match(calls[1].prompt, /STRUCTURAL FILL \(add only\)/)
      assert.match(calls[1].prompt, /CHAPTER CONTRACT/)
      assert.match(calls[1].prompt, /obj-b \(difficult\)/)
      assert.equal(draft.structuralFill, undefined)
      assert.equal(draft.chapters.length, 1)
      assert.equal(draft.stage, 'review')
      assert.equal(draft.chapters[0].review, 'pending')
      assert.deepEqual(draft.chapters[0].objectiveCoverage.find(row => row.objectiveId === 'obj-b').transferQuestionKeys, ['question-9'])
      assert.deepEqual(contractIssues(draft.chapters[0]), [])
      assert.deepEqual(draft.automaticRepairs || {}, {}, 'no correction slot was used')
      assert.equal(draft.structuralFillLog.at(-1).remaining, 0)
    })
  } finally { await f.cleanup() }
})

test('a rejected fill is retried with its rejection at most three times, then the ordinary structural review applies', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const prompts = []
      const generate = async prompt => {
        prompts.push(prompt)
        // Reuses an existing key every time: never acceptable.
        if (prompt.includes('STRUCTURAL FILL')) return {sections: [], questions: [transferAddition(f.draft, 'question-1')], workedExamples: {'obj-b': []}}
        return JSON.stringify(f.draft)
      }
      for (let i = 0; i < 4; i++) await processStudyStep(f.version.id, {generate})
      const draft = await draftOf(f.version.id)
      assert.equal(prompts.filter(p => p.includes('STRUCTURAL FILL')).length, 3)
      assert.match(prompts[2], /FILL RETRY/)
      assert.equal(draft.structuralFill, undefined)
      assert.equal(draft.automaticRepairs['fill-chapter'], 1, 'only now does the ordinary structural review spend a correction')
      assert.equal(draft.issues.find(issue => issue.topicId === 'fill-chapter').rule, 'objective.difficult-stages')
    })
  } finally { await f.cleanup() }
})

test('a chapter saved failed on a missing item resumes into the fill without touching any counter', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const prepared = prepareLesson(JSON.stringify(f.draft), {id: 'fill-chapter', sourceIds: f.ids}, (await ownStudyVersion(f.version.id)).draft.snapshot.chunks, f.plan)
      const finding = {topicId: 'fill-chapter', severity: 'error', itemKey: 'objective:obj-b', detail: 'obj-b: difficult objectives need worked reasoning, a supported attempt and transfer practice.'}
      await mutateStudyVersion(f.version.id, v => {
        v.draft.chapters = [{...prepared, review: 'failed', evidenceReview: {issues: []}}]
        v.draft.issues = [finding]
        v.draft.automaticRepairs = {'fill-chapter': 3}
        v.draft.manualRepairs = {}
        v.draft.status = 'failed'
        v.draft.error = 'This chapter still needs a correction after 3 of 3 automatic correction attempts.'
      })
      await controlStudyGeneration(f.version.id, 'retry')
      let draft = await draftOf(f.version.id)
      assert.equal(draft.structuralFill.recovered, true)
      assert.deepEqual(draft.manualRepairs, {}, 'a fill is not a manual correction')
      assert.equal(draft.automaticRepairs['fill-chapter'], 3)
      const calls = []
      await processStudyStep(f.version.id, {generate: async (prompt, options) => {
        calls.push(options.usageMetadata.phase)
        return {sections: [], questions: [transferAddition(f.draft)], workedExamples: {'obj-b': []}}
      }})
      draft = await draftOf(f.version.id)
      assert.deepEqual(calls, ['structural-fill'])
      assert.equal(draft.chapters[0].review, 'pending')
      assert.equal(draft.stage, 'review')
      assert.ok(draft.chapters[0].reviewFocus.changed.includes('question:question-9'))
      assert.equal(draft.automaticRepairs['fill-chapter'], 3)
      assert.deepEqual(draft.manualRepairs, {})
    })
  } finally { await f.cleanup() }
})
