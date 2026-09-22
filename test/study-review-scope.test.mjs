import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, prepareLesson } from '../lib/study-version-pipeline.mjs'
import { teachingSchema } from '../lib/study-version-content.mjs'
import { course, teachingResponse, twoObjectiveLesson } from '../scripts/verification/study-fixtures.mjs'

const ID = 'scoped-chapter'
test('after a bounded correction the next round re-reviews only the changed question and its objective, and records its calls', async () => {
  const userId = `study-review-scope-${randomUUID()}`
  const run = fn => withRequestContext({userId, mode: 'local'}, fn)
  try {
    await run(async () => {
      const note = await addStudyNote({...course, title: 'Scope notes'}, [{page: 1, text: 'Addition combines disjoint quantities; overlapping groups must be counted once.'}])
      const snapshot = await readStudySourceSnapshot(course, [note.id])
      const version = await createStudyVersion(course, 'programme-test', snapshot)
      const ids = snapshot.chunks.map(c => c.id)
      const {plan, draft} = twoObjectiveLesson(ids)
      const chapter = prepareLesson(JSON.stringify(draft), {id: ID, sourceIds: ids}, snapshot.chunks, plan)
      await mutateStudyVersion(version.id, v => {
        v.draft.stage = 'review'
        v.draft.topics = [{id: ID, title: 'Scoped chapter', sourceIds: ids}]
        v.draft.chapters = [chapter]
        v.draft.teachingPlans = {[ID]: plan}
      })
      const q3 = teachingSchema.shape.questions.element.parse(draft.questions[2])
      let flagged = false
      const calls = []
      const generate = async (prompt, options) => {
        calls.push({phase: options.usageMetadata.phase, prompt})
        if (/REPAIR SELECTED PRACTICE/.test(prompt)) return {questions: {'question-3': {...q3, answer: `${q3.answer} Check by subtracting one group from the total.`}}}
        const response = teachingResponse(prompt, ids)
        if (prompt.includes('INDEPENDENT PEDAGOGICAL REVIEW') && !flagged) {
          flagged = true
          response.issues = [{topicId: 'question-3', scope: 'question', severity: 'error', detail: 'question-3: the answer omits the inverse check.'}]
        }
        return response
      }
      for (let i = 0; i < 40; i++) {
        await processStudyStep(version.id, {generate})
        const saved = (await ownStudyVersion(version.id)).draft
        if (saved.chapters[0]?.review === 'passed' || saved.status === 'failed') break
      }
      const saved = (await ownStudyVersion(version.id)).draft
      assert.equal(saved.chapters[0].review, 'passed')
      assert.equal(saved.automaticRepairs[ID], 1)
      const correction = calls.findIndex(call => call.phase === 'practice-correction')
      const after = calls.slice(correction + 1)
      // Factual review re-runs only the judgment the change invalidated: the
      // answer check for the changed question (its blind solution is kept,
      // since the question itself is unchanged).
      const factual = after.filter(call => call.phase.startsWith('factual-'))
      assert.ok(factual.length >= 1)
      for (const call of factual) {
        const payload = JSON.parse(call.prompt.split('Review payload: ').at(-1))
        assert.deepEqual(payload.map(item => item.key), ['question:question-3'])
      }
      // The pedagogical re-review covers only the changed question's objective.
      const pedagogical = after.filter(call => call.phase === 'pedagogical-review')
      assert.equal(pedagogical.length, 1)
      assert.match(pedagogical[0].prompt, /RE-REVIEW AFTER CORRECTION 1/)
      const round = saved.reviewRounds.at(-1)
      assert.deepEqual(round.resolved.map(finding => finding.itemKey), ['question:question-3'])
      assert.equal(round.calls.pedagogical, 1)
      assert.equal(round.calls.pedagogicalObjectives, 1, 'one objective of two is re-reviewed')
      assert.equal(round.calls.factual, factual.length)
      assert.equal(saved.chapters[0].reviewCalls, undefined)
    })
  } finally { await run(deleteAllDocuments) }
})
