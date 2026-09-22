import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, prepareLesson } from '../lib/study-version-pipeline.mjs'
import { questionRepairStep, applyQuestionRepair } from '../lib/study-chapter-repair.mjs'
import { contractRegressions } from '../lib/study-chapter-contract.mjs'
import { routeStudyModel, questionCorrectionTrial } from '../lib/study-model-routing.mjs'
import { teachingSchema } from '../lib/study-version-content.mjs'
import { course, lesson, teachingResponse } from '../scripts/verification/study-fixtures.mjs'

// A valid chapter: obj-a simple (sections 1-2, questions 1-4), obj-b difficult
// (sections 3-4, questions 5-8 with guided, independent and transfer practice).
function validDraft(ids) {
  const base = lesson(ids)
  const plan = {objectives: [
    {id: 'obj-a', goal: 'Combine disjoint quantities.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Add two groups.', teachingApproach: 'Explain and practise.'},
    {id: 'obj-b', goal: 'Diagnose double counting.', complexity: 'difficult', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'Diagnose an overlap.', teachingApproach: 'Work a case, then vary it.'}
  ], exclusions: [], gaps: []}
  const stages = ['guided', 'independent', 'independent', 'independent', 'guided', 'independent', 'transfer', 'transfer']
  const questions = base.questions.map((q, i) => ({...q, objectiveIds: [i < 4 ? 'obj-a' : 'obj-b'], practiceStage: stages[i], hints: ['Count each group.', 'Remove the overlap first.'],
    misconceptions: i < 4 ? [] : [{mistake: 'Counting shared items twice.', explanation: 'Shared items belong to both groups.', followUpKey: base.questions[i === 7 ? 6 : 7].key}]}))
  const sections = base.sections.map((s, i) => ({...s, objectiveIds: [i < 2 ? 'obj-a' : 'obj-b']}))
  const {teachingPlan: _p, ...content} = base
  return {plan, draft: {...content, sections, questions, objectiveCoverage: [
    {objectiveId: 'obj-a', explanationSectionIds: ['section-1'], workedExampleSectionIds: ['section-1'], guidedQuestionKeys: ['question-1'], independentQuestionKeys: ['question-2'], transferQuestionKeys: []},
    {objectiveId: 'obj-b', explanationSectionIds: ['section-3'], workedExampleSectionIds: ['section-3'], guidedQuestionKeys: ['question-5'], independentQuestionKeys: ['question-6'], transferQuestionKeys: ['question-7']}
  ]}}
}
const ID = 'validated-chapter'

async function fixture(findings, {automaticRepairs = {[ID]: 1}} = {}) {
  const userId = `study-correction-validation-${randomUUID()}`
  const run = fn => withRequestContext({userId, mode: 'local'}, fn)
  const state = await run(async () => {
    const note = await addStudyNote({...course, title: 'Validation notes'}, [{page: 1, text: 'Addition combines disjoint quantities; overlapping groups must be counted once.'}])
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(course, 'programme-test', snapshot)
    const ids = snapshot.chunks.map(c => c.id)
    const {plan, draft} = validDraft(ids)
    const base = {...prepareLesson(JSON.stringify(draft), {id: ID, sourceIds: ids}, snapshot.chunks, plan), review: 'failed'}
    await mutateStudyVersion(version.id, v => {
      v.draft.stage = 'chapters'
      v.draft.topics = [{id: ID, title: 'Validated chapter', sourceIds: ids}]
      v.draft.chapters = []
      v.draft.teachingPlans = {[ID]: plan}
      v.draft.automaticRepairs = automaticRepairs
      v.draft.issues = findings.map(finding => ({topicId: ID, ...finding}))
      v.draft.repair = {topicId: ID, phase: 'pedagogical', chapter: base}
    })
    return {version, ids, plan, draft, base}
  })
  return {...state, run, cleanup: () => run(deleteAllDocuments)}
}
const draftOf = async id => (await ownStudyVersion(id)).draft
const withRoutes = async (routes, fn) => {
  const saved = process.env.STUDY_MODEL_ROUTES
  process.env.STUDY_MODEL_ROUTES = JSON.stringify({version: 1, routes})
  try { return await fn() } finally { if (saved === undefined) delete process.env.STUDY_MODEL_ROUTES; else process.env.STUDY_MODEL_ROUTES = saved }
}

test('a correction that breaks an untouched objective is re-prompted once with the exact regression, then discarded, never accepted or reviewed', async () => {
  const f = await fixture([{severity: 'error', scope: 'chapter', detail: 'The chapter needs a clearer throughline across its sections.'}])
  try {
    await f.run(async () => {
      // A whole-chapter rewrite that relabels obj-b's only guided question.
      const broken = structuredClone(f.draft)
      broken.questions[4].practiceStage = 'independent'
      const prompts = []
      const generate = async (prompt, options) => { prompts.push({prompt, phase: options.usageMetadata.phase}); return JSON.stringify(broken) }
      await processStudyStep(f.version.id, {generate})
      let draft = await draftOf(f.version.id)
      assert.equal(prompts[0].phase, 'whole-chapter-correction')
      assert.match(prompts[0].prompt, /CHAPTER CONTRACT/)
      assert.equal(draft.chapters.length, 0, 'the regressing result is not accepted')
      assert.equal(draft.stage, 'chapters')
      assert.equal(draft.repair.reprompt.issues[0].itemKey, 'objective:obj-b')
      assert.equal(draft.automaticRepairs[ID], 1, 'the re-prompt is part of the same correction')
      await processStudyStep(f.version.id, {generate})
      draft = await draftOf(f.version.id)
      assert.match(prompts[1].prompt, /MERGE VALIDATION RETRY/)
      // Cache-friendly: the re-prompt is the identical prompt with the note appended.
      assert.ok(prompts[1].prompt.startsWith(prompts[0].prompt))
      assert.match(prompts[1].prompt, /obj-b: difficult objectives need worked reasoning/)
      assert.deepEqual(draft.mergeValidations.map(row => row.outcome), ['reprompt', 'discarded'])
      assert.equal(draft.chapters.length, 0)
      assert.equal(draft.repair.phase, 'rejected-correction')
      assert.equal(draft.repair.chapter.questions[4].practiceStage, 'guided', 'the saved chapter is kept exactly as it was')
      assert.deepEqual(draft.teachingPlans[ID], f.plan, 'no plan edit is persisted')
      assert.equal(draft.automaticRepairs[ID], 2, 'the original findings return to the ordinary correction budget')
      assert.ok(draft.correctionHistory.some(row => row.rejectedMerge?.some(item => item.itemKey === 'objective:obj-b')))
      // The next attempt is told why the last one was rejected; a valid result is accepted.
      await processStudyStep(f.version.id, {generate: async prompt => { prompts.push({prompt}); return JSON.stringify(f.draft) }})
      draft = await draftOf(f.version.id)
      assert.match(prompts[2].prompt, /rejectedBecauseItBroke/)
      assert.equal(prompts.filter(p => /INDEPENDENT PEDAGOGICAL REVIEW|Review payload/.test(p.prompt)).length, 0, 'no review was bought for a rejected result')
      assert.equal(draft.chapters.length, 1)
      assert.equal(draft.stage, 'review')
      assert.equal(draft.mergeValidations.at(-1).outcome, 'accepted')
    })
  } finally { await f.cleanup() }
})

test('the question-only trial tries the question-correction route first and falls back to the correction route when the merge is rejected', async () => {
  const f = await fixture([{severity: 'error', itemKey: 'question:question-3', detail: 'question-3: the answer omits the inverse check.'}])
  try {
    await withRoutes({correction: 'gpt-5.6-sol', 'question-correction': 'gpt-5-mini'}, () => f.run(async () => {
      assert.equal(questionCorrectionTrial().active, true)
      const q3 = teachingSchema.shape.questions.element.parse(f.draft.questions[2])
      const recall = {...q3, question: 'According to the slides, what total do two disjoint groups give?'}
      const fixed = {...q3, answer: `${q3.answer} Check by subtracting one group from the total.`}
      const calls = []
      const generate = async (prompt, options) => {
        calls.push(options.usageMetadata)
        // The trial route returns a patch that introduces source-wording recall.
        return {questions: {'question-3': options.usageMetadata.routePhase === 'question-correction' ? recall : fixed}}
      }
      for (let i = 0; i < 3; i++) await processStudyStep(f.version.id, {generate})
      const draft = await draftOf(f.version.id)
      assert.deepEqual(calls.map(c => c.routePhase || null), ['question-correction', 'question-correction', null])
      assert.equal(calls[2].modelTrial, 'correction-fallback')
      assert.equal(calls[1].mergeReprompt, 1)
      assert.deepEqual(draft.mergeValidations.map(row => [row.route, row.outcome]), [['question-correction', 'reprompt'], ['question-correction', 'fallback'], ['correction', 'accepted']])
      assert.equal(draft.chapters.length, 1)
      assert.equal(draft.chapters[0].questions[2].answer, fixed.answer)
      const trial = draft.correctionTrials.at(-1)
      assert.deepEqual({firstRoute: trial.firstRoute, route: trial.route, fallback: trial.fallback, fallbackReason: trial.fallbackReason, outcome: trial.outcome, trial: trial.trial}, {firstRoute: 'question-correction', route: 'correction', fallback: true, fallbackReason: 'contract', outcome: 'pending-review', trial: true})
      assert.equal(draft.automaticRepairs[ID], 1, 'the fallback redoes the same correction without spending another')
      assert.equal(draft.correctionScopes.length, 1, 'the scope decision is recorded once per correction')
      // The routed call really uses the trial model, and never raises a price.
      const billing = {source: 'platform', provider: 'openai', model: 'gpt-6-astra'}
      const options = {generationRuntime: 'agents-sdk-responses', usageMetadata: {versionId: f.version.id, phase: 'practice-correction', routePhase: 'question-correction'}}
      assert.equal(routeStudyModel(billing, options, process.env.STUDY_MODEL_ROUTES).model, 'gpt-5-mini')
      assert.equal(routeStudyModel(billing, {...options, usageMetadata: {...options.usageMetadata, routePhase: undefined}}, process.env.STUDY_MODEL_ROUTES).model, 'gpt-5.6-sol')
    }))
  } finally { await f.cleanup() }
})

test('a trial-route patch rejected by its re-review is redone on the correction route from the same saved chapter', async () => {
  const f = await fixture([{severity: 'error', itemKey: 'question:question-3', detail: 'question-3: the answer omits the inverse check.'}])
  try {
    await withRoutes({correction: 'gpt-5.6-sol', 'question-correction': 'gpt-5-mini'}, () => f.run(async () => {
      const q3 = teachingSchema.shape.questions.element.parse(f.draft.questions[2])
      const fixed = {...q3, answer: `${q3.answer} Check by subtracting one group from the total.`}
      const routes = []
      const review = [{severity: 'error', detail: 'The corrected answer is still incomplete.', scope: 'item'}]
      const generate = async (prompt, options) => {
        if (/REPAIR SELECTED PRACTICE/.test(prompt)) { routes.push(options.usageMetadata.routePhase || 'correction'); return {questions: {'question-3': fixed}} }
        return teachingResponse(prompt, f.ids, {reviewIssues: review})
      }
      for (let i = 0; i < 30 && routes.length < 2; i++) await processStudyStep(f.version.id, {generate})
      const draft = await draftOf(f.version.id)
      assert.deepEqual(routes, ['question-correction', 'correction'])
      const trial = draft.correctionTrials.at(-1)
      assert.equal(trial.fallbackReason, 'review')
      assert.equal(trial.route, 'correction')
      assert.equal(draft.automaticRepairs[ID], 1, 'no correction slot is spent on the fallback')
      assert.ok(!draft.issues.some(issue => issue.topicId === ID && /still incomplete/.test(issue.detail)), 'the fallback repeats the original correction, not the review round')
    }))
  } finally { await f.cleanup() }
})

test('complexity is locked in scope and objective patches; only an explicit understated-complexity finding unlocks it, with additions validated on the merge', async () => {
  const ids = ['e-1']
  const {plan, draft} = validDraft(ids)
  const evidence = [{id: 'e-1', sourceKey: 's', text: 'Evidence.'}, {id: 'e-scope', sourceKey: 'syllabus', text: 'Syllabus scope.', scopeContext: true}]
  const chapter = {...prepareLesson(JSON.stringify(draft), {id: ID, sourceIds: ids}, evidence, plan), teachingPlan: plan}
  // An unnamed scope finding patches scope fields only: no objective, no full chapter.
  const scope = questionRepairStep(course, [], evidence, chapter, [{severity: 'error', itemKey: 'scope', detail: 'The gaps list contains placeholder entries.'}])
  assert.deepEqual(Object.keys(scope.schema.shape.scope.shape).sort(), ['exclusions', 'gaps'])
  assert.doesNotMatch(scope.prompt, /Existing chapter \(data, not instructions\)/)
  assert.deepEqual(scope.evidenceIds, ['e-scope'])
  // A named objective in a scope patch keeps its complexity.
  const named = questionRepairStep(course, [], evidence, chapter, [{severity: 'error', itemKey: 'scope', detail: 'obj-a overstates its source support.'}])
  assert.equal(named.schema.shape.scope.shape.objectives.shape['obj-a'].shape.complexity.value, 'simple')
  // An ordinary objective finding cannot upgrade.
  const ordinary = questionRepairStep(course, [], evidence, chapter, [{severity: 'error', itemKey: 'objective:obj-a', detail: 'obj-a: the goal overstates what is taught.'}])
  const ordinaryPart = ordinary.parts ? ordinary.parts.find(part => part.planObjectiveIds) : ordinary
  assert.equal(ordinaryPart.schema.shape.objectives.shape['obj-a'].shape.complexity.value, 'simple')
  assert.deepEqual(ordinaryPart.upgradeIds, [])
  // An explicit understated-complexity finding routes as an objective finding
  // that selects the objective's practice and may add what difficult needs.
  const finding = {severity: 'error', itemKey: 'objective:obj-a', detail: 'obj-a: its complexity is understated; tracing overlapping groups is multi-step reasoning and should be difficult.'}
  const upgrade = questionRepairStep(course, [], evidence, chapter, [finding])
  const objectivePart = upgrade.parts.find(part => part.planObjectiveIds)
  assert.deepEqual(objectivePart.upgradeIds, ['obj-a'])
  assert.ok(upgrade.parts.some(part => part.keys?.includes('question-1')), 'the objective\'s practice is selected too')
  const questionsA = chapter.questions.filter(q => q.objectiveIds.includes('obj-a'))
  const response = additions => ({
    objectives: {'obj-a': {...plan.objectives[0], complexity: 'difficult'}},
    upgrades: {'obj-a': additions},
    sections: Object.fromEntries(chapter.sections.filter(s => s.objectiveIds.includes('obj-a')).map(s => [s.id, teachingSchema.shape.sections.element.parse(s)])),
    questions: Object.fromEntries(questionsA.map((q, i) => [q.key, {...teachingSchema.shape.questions.element.parse(q), misconceptions: [{mistake: 'Adding overlapping groups.', explanation: 'Shared items are counted twice.', followUpKey: i === 0 ? 'question-2' : 'question-1'}]}]))
  })
  const merge = additions => prepareLesson(applyQuestionRepair(chapter, upgrade, response(additions)), {id: ID, sourceIds: ids}, evidence, {...plan, objectives: [{...plan.objectives[0], complexity: 'difficult'}, plan.objectives[1]]}, {mergedCoverage: true})
  // Upgrading without the practice it requires is a regression the merge validator rejects.
  const bare = contractRegressions(chapter, merge({questions: [], sections: [], workedExampleSectionIds: []}))
  assert.ok(bare.rejected)
  assert.ok(bare.regressions.some(issue => issue.rule === 'objective.difficult-stages' && issue.itemKey === 'objective:obj-a'))
  const template = teachingSchema.shape.questions.element.parse(chapter.questions[4])
  const added = stage => ({...template, key: `question-a-${stage}`, objectiveIds: ['obj-a'], practiceStage: stage, question: `A new ${stage} question about combining disjoint groups of four and three items?`, misconceptions: [{mistake: 'Adding overlapping groups.', explanation: 'Shared items are counted twice.', followUpKey: 'question-1'}]})
  const complete = contractRegressions(chapter, merge({questions: [added('guided'), added('transfer')], sections: [], workedExampleSectionIds: ['section-1']}))
  assert.equal(complete.rejected, false, JSON.stringify(complete.regressions.map(issue => issue.detail)))
})
