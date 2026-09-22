import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { incoherentProseReason, repairIncoherentProse } from '../lib/study-preflight.mjs'
import { blueprintIssues, estimateDraftOutput, DRAFT_OUTPUT_BUDGET } from '../lib/study-chapter-contract.mjs'
import { course, teachingPlan, practiceBlueprint } from '../scripts/verification/study-fixtures.mjs'

const validBlueprint = practiceBlueprint

test('the prose gate drops leaked schema vocabulary and placeholders but leaves real sentences byte-identical', () => {
  for (const entry of ['prerequisites', 'teachingApproach', 'placeholder_for_schema_compliance_repair', 'Placeholder entry for schema compliance.', 'TBD', 'See the sourceIds field for this objective.'])
    assert.ok(incoherentProseReason(entry), entry)
  for (const entry of ['The lab package ships placeholder images that the extracted slides do not reproduce, so consult the original files.', 'The iPhone case study slides are unreadable in the extraction.', 'No readable excerpt of the textbook chapter was supplied.'])
    assert.equal(incoherentProseReason(entry), null, entry)
  const plan = {...teachingPlan(['e-1']), gaps: ['demonstration', 'The recorded lecture was not transcribed.', 'teachingApproach']}
  const repaired = repairIncoherentProse({caveats: [], teachingPlan: plan})
  assert.deepEqual(repaired.teachingPlan.gaps, ['The recorded lecture was not transcribed.'])
  assert.equal(repaired.proseRepairs.length, 2)
  assert.ok(repaired.proseRepairs.every(row => row.dropped))
})

test('blueprint validation names every contract violation before drafting', () => {
  const plan = teachingPlan(['e-1'])
  assert.deepEqual(blueprintIssues(plan, validBlueprint(plan)), [])
  const broken = validBlueprint(plan).filter(row => !(row.objectiveId === 'objective-2' && row.stage === 'transfer'))
  broken[0] = {...broken[0], misconception: null}
  broken.push({key: 'orphan', objectiveId: 'objective-1', stage: 'remediation', skill: 'apply', difficulty: 'standard', kind: 'application', misconception: null})
  const rules = blueprintIssues(plan, broken).map(issue => issue.rule)
  assert.ok(rules.includes('blueprint.transfer'))
  assert.ok(rules.includes('blueprint.misconception'))
  assert.ok(rules.includes('blueprint.remediation-linked'))
  assert.ok(rules.includes('blueprint.follow-up'), 'objective-2 guided pointed at its removed transfer row')
  const thin = validBlueprint(plan).map(row => ({...row, difficulty: 'standard'}))
  assert.deepEqual(blueprintIssues(plan, thin).map(issue => issue.rule), ['blueprint.challenge'])
})

test('the size gate is conservative on the measured pilot drafts', () => {
  const objectives = n => ({objectives: Array.from({length: n}, (_, i) => ({id: `o-${i}`}))})
  const rows = n => Array.from({length: n}, () => ({}))
  // An 8-objective, 20-question plan drafted in 19.8k output tokens: no split.
  assert.ok(estimateDraftOutput(objectives(8), rows(20)) <= DRAFT_OUTPUT_BUDGET)
  assert.ok(estimateDraftOutput(objectives(8), rows(30)) > DRAFT_OUTPUT_BUDGET)
})

async function fixture() {
  const userId = `study-plan-validation-${randomUUID()}`
  const run = fn => withRequestContext({userId, mode: 'local'}, fn)
  const {version, snapshot} = await run(async () => {
    const note = await addStudyNote({...course, title: 'Plan notes'}, [{page: 1, text: 'Addition combines disjoint quantities; subtraction checks the total.'}])
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    return {version: await createStudyVersion(course, 'programme-test', snapshot), snapshot}
  })
  const ids = snapshot.chunks.map(c => c.id)
  await run(() => mutateStudyVersion(version.id, v => {
    v.draft.stage = 'chapters'
    v.draft.topics = [{id: 'plan-chapter', title: 'Plan chapter', sourceIds: ids}]
    v.draft.chapters = []
    v.draft.teachingPlans = {}
  }))
  return {run, version, ids, cleanup: () => run(deleteAllDocuments)}
}
const draftOf = async id => (await ownStudyVersion(id)).draft

test('an invalid blueprint is re-planned once with its exact issues, then drafting begins', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const plan = teachingPlan(f.ids)
      const calls = []
      const generate = async (prompt, options) => {
        calls.push({prompt, phase: options.usageMetadata.phase, replan: options.usageMetadata.replan})
        if (prompt.includes('PLAN THE TEACHING')) {
          assert.ok(options.responseSchema.properties.practice, 'the provider is asked for a blueprint')
          if (calls.length === 1) return {...plan, gaps: ['prerequisites', 'The recorded lecture was not transcribed.'], practice: validBlueprint(plan).filter(row => row.stage !== 'transfer' || row.objectiveId !== 'objective-3')}
          return {...plan, practice: validBlueprint(plan)}
        }
        throw new Error('stop at the draft')
      }
      await processStudyStep(f.version.id, {generate})
      let draft = await draftOf(f.version.id)
      assert.equal(draft.teachingPlans['plan-chapter'], undefined, 'an invalid blueprint is not accepted')
      assert.match(draft.planValidation['plan-chapter'].issues.join(' '), /objective-3 \(difficult\) plans no transfer question/)
      assert.equal(draft.planChecks[0].proseDrops, 1)
      await processStudyStep(f.version.id, {generate})
      draft = await draftOf(f.version.id)
      assert.equal(calls.length, 2)
      assert.equal(calls[1].phase, 'teaching-plan')
      assert.equal(calls[1].replan, 1)
      assert.match(calls[1].prompt, /PLAN VALIDATION RETRY/)
      assert.match(calls[1].prompt, /objective-3 \(difficult\) plans no transfer question/)
      assert.ok(draft.teachingPlans['plan-chapter'])
      assert.equal(draft.practiceBlueprints['plan-chapter'].valid, true)
      assert.equal(draft.planValidation['plan-chapter'], undefined)
      assert.equal(draft.automaticRepairs?.['plan-chapter'] || 0, 0, 'plan validation never uses a correction slot')
      await processStudyStep(f.version.id, {generate})
      assert.equal(calls.length, 3)
      assert.doesNotMatch(calls[2].prompt, /PLAN THE TEACHING/)
    })
  } finally { await f.cleanup() }
})

test('a blueprint still invalid after the one re-plan is kept as guidance and drafting proceeds', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const plan = teachingPlan(f.ids)
      const invalid = validBlueprint(plan).map(row => ({...row, difficulty: 'standard'}))
      let plans = 0
      const generate = async prompt => {
        if (prompt.includes('PLAN THE TEACHING')) { plans++; return {...plan, practice: invalid} }
        throw new Error('stop at the draft')
      }
      await processStudyStep(f.version.id, {generate})
      await processStudyStep(f.version.id, {generate})
      const draft = await draftOf(f.version.id)
      assert.equal(plans, 2)
      assert.equal(draft.practiceBlueprints['plan-chapter'].valid, false)
      assert.ok(draft.teachingPlans['plan-chapter'])
    })
  } finally { await f.cleanup() }
})

test('a plan whose draft would exceed the output budget is split along its objectives before drafting', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const plan = teachingPlan(f.ids)
      // Twelve rows per objective: well over the draft output budget.
      const large = plan.objectives.flatMap(objective => validBlueprint({objectives: [objective]}).concat(Array.from({length: 9}, (_, i) => ({key: `${objective.id}-extra-${i}`, objectiveId: objective.id, stage: 'independent', skill: 'apply', difficulty: 'challenge', kind: 'application', misconception: {mistake: 'm', followUpKey: `${objective.id}-guided`, changedCondition: 'c'}}))))
      await processStudyStep(f.version.id, {generate: async () => ({...plan, practice: large})})
      const draft = await draftOf(f.version.id)
      assert.deepEqual(draft.topics.map(t => t.id), ['plan-chapter-part-1', 'plan-chapter-part-2'])
      assert.equal(draft.chapterSplits[0].reason, 'planned_output_size')
      assert.deepEqual(draft.teachingPlans['plan-chapter-part-1'].objectives.map(o => o.id), ['objective-1', 'objective-2'])
      assert.ok(draft.practiceBlueprints['plan-chapter-part-2'].practice.every(row => row.objectiveId === 'objective-3'))
      assert.equal(draft.practiceBlueprints['plan-chapter'], undefined)
    })
  } finally { await f.cleanup() }
})
