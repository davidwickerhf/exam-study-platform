import test from 'node:test'
import assert from 'node:assert/strict'
import Ajv from 'ajv'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { draftResponseSchema, flattenDraftPractice, teachingSchema } from '../lib/study-version-content.mjs'
import { course, lesson, teachingPlan, practiceBlueprint as validBlueprint } from '../scripts/verification/study-fixtures.mjs'

const mixedPlan = ids => {
  const plan = teachingPlan(ids)
  plan.objectives[2] = {...plan.objectives[2], complexity: 'simple'}
  return plan
}
// Express the fixture lesson in the keyed draft shape.
function keyedLesson(ids, plan) {
  const {questions, ...rest} = teachingSchema.parse(lesson(ids))
  const practice = Object.fromEntries(plan.objectives.map(o => [o.id, {guided: [], independent: [], transfer: [], remediation: []}]))
  for (const q of questions) {
    const {practiceStage, ...item} = q
    const home = plan.objectives.find(o => o.complexity === 'difficult' && q.objectiveIds.includes(o.id))?.id || q.objectiveIds[0]
    practice[home][practiceStage].push(item)
  }
  const {teachingPlan: _plan, ...content} = rest
  return {...content, practice}
}

test('the draft schema makes a missing stage question or a missing diagnosis impossible to emit', () => {
  const ids = ['e-1']
  const plan = mixedPlan(ids)
  const schema = draftResponseSchema(plan, ids)
  assert.equal(schema.properties.questions, undefined)
  const difficult = schema.properties.practice.properties['objective-1'].properties
  const simple = schema.properties.practice.properties['objective-3'].properties
  assert.deepEqual([difficult.guided.minItems, difficult.independent.minItems, difficult.transfer.minItems, difficult.remediation.minItems], [1, 1, 1, undefined])
  assert.deepEqual([simple.guided.minItems, simple.independent.minItems, simple.transfer.minItems], [undefined, 1, undefined])
  const defs = schema.$defs
  assert.equal(defs[difficult.guided.items.$ref.split('/').at(-1)].properties.misconceptions.minItems, 1)
  assert.equal(defs[difficult.guided.items.$ref.split('/').at(-1)].properties.hints.minItems, 2)
  assert.equal(defs[difficult.remediation.items.$ref.split('/').at(-1)].properties.misconceptions.maxItems, 0)
  assert.deepEqual(defs[simple.independent.items.$ref.split('/').at(-1)].properties.objectiveIds.items.enum, ['objective-3'])
  assert.deepEqual(defs.evidence_id.enum, ids)
  // A validated blueprint raises the minimums to the planned counts.
  const planned = draftResponseSchema(teachingPlan(ids), ids, validBlueprint(teachingPlan(ids)).concat([{key: 'extra', objectiveId: 'objective-1', stage: 'transfer'}]))
  assert.equal(planned.properties.practice.properties['objective-1'].properties.transfer.minItems, 2)
  // The grammar itself rejects a difficult objective without transfer practice.
  const validate = new Ajv({strict: false}).compile(schema)
  const response = keyedLesson(ids, plan)
  response.practice['objective-2'] = structuredClone(response.practice['objective-1'])
  response.practice['objective-3'].independent = [{...structuredClone(response.practice['objective-1'].independent[0]), objectiveIds: ['objective-3'], misconceptions: []}]
  assert.ok(validate(response), JSON.stringify(validate.errors?.slice(0, 3)))
  const missing = structuredClone(response)
  missing.practice['objective-1'].transfer = []
  assert.equal(validate(missing), false)
})

test('a keyed draft flattens into the ordinary questions list, taking its stage from its array', () => {
  const ids = ['e-1']
  const plan = mixedPlan(ids)
  const flat = JSON.parse(flattenDraftPractice(JSON.stringify(keyedLesson(ids, plan))))
  assert.equal(flat.practice, undefined)
  assert.equal(flat.questions.length, lesson(ids).questions.length)
  for (const q of flat.questions) {
    const original = lesson(ids).questions.find(item => item.key === q.key)
    assert.equal(q.practiceStage, original.practiceStage)
    assert.ok(q.objectiveIds.length >= original.objectiveIds.length)
  }
  // Saved and scripted drafts that already carry questions are untouched.
  const legacy = JSON.stringify(lesson(ids))
  assert.equal(flattenDraftPractice(legacy), legacy)
  assert.equal(flattenDraftPractice('not json'), 'not json')
})

test('a first draft is told the rendered contract and its blueprint, and a keyed response is accepted', async () => {
  const userId = `study-draft-contract-${randomUUID()}`
  const run = fn => withRequestContext({userId, mode: 'local'}, fn)
  try {
    await run(async () => {
      const note = await addStudyNote({...course, title: 'Draft notes'}, [{page: 1, text: 'Addition combines disjoint quantities; subtraction checks the total.'}])
      const snapshot = await readStudySourceSnapshot(course, [note.id])
      const version = await createStudyVersion(course, 'programme-test', snapshot)
      const ids = snapshot.chunks.map(c => c.id)
      const plan = teachingPlan(ids)
      await mutateStudyVersion(version.id, v => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{id: 'draft-chapter', title: 'Draft chapter', sourceIds: ids}]
        v.draft.chapters = []
        v.draft.teachingPlans = {'draft-chapter': plan}
        v.draft.practiceBlueprints = {'draft-chapter': {practice: validBlueprint(plan), valid: true, issues: []}}
      })
      let seen = null
      await processStudyStep(version.id, {generate: async (prompt, options) => {
        seen = {prompt, options}
        return JSON.stringify(keyedLesson(ids, plan))
      }})
      assert.match(seen.prompt, /CHAPTER CONTRACT/)
      assert.match(seen.prompt, /objective-2 \(difficult\)/)
      assert.match(seen.prompt, /objective-1-transfer/)
      assert.match(seen.prompt, /PRACTICE SHAPE/)
      assert.ok(seen.options.responseSchema.properties.practice)
      assert.equal(seen.options.responseSchema.properties.practice.properties['objective-1'].properties.guided.minItems, 1)
      const draft = (await ownStudyVersion(version.id)).draft
      assert.equal(draft.chapters.length, 1)
      assert.equal(draft.stage, 'review')
      assert.equal(draft.chapters[0].questions.length, lesson(ids).questions.length)
      assert.ok(draft.chapters[0].questions.every(q => q.practiceStage))
    })
  } finally { await run(deleteAllDocuments) }
})
