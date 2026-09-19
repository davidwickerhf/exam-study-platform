import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { course, lesson, teachingPlan } from '../scripts/verification/study-fixtures.mjs'

// A finding that is not scoped to any question, section, card or the scope
// metadata. questionRepairStep returns null for it (no bounded question-only
// patch applies), so the pipeline falls back to a whole-chapter rewrite —
// exactly the case that must be billed and routed as 'correction', not
// silently as a first-draft 'authoring' call.
const unscopedFinding = { severity: 'error', topicId: 'addition', detail: 'The chapter overall needs a broader correction unrelated to any single item.' }

async function fixture() {
  const userId = `study-correction-phase-${randomUUID()}`
  const context = { userId, mode: 'local' }
  const run = (fn) => withRequestContext(context, fn)
  const { version, snapshot } = await run(async () => {
    const note = await addStudyNote(
      { ...course, title: 'Arithmetic notes' },
      [{ page: 1, text: 'Adding disjoint quantities: two plus three equals five. Subtract to check. All quantities need matching units.' }]
    )
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(course, 'programme-test', snapshot)
    return { version, snapshot }
  })
  return { run, version, snapshot, cleanup: () => run(deleteAllDocuments) }
}

test('a first draft in the chapters stage carries no explicit phase, so it stays authoring', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: teachingPlan(ids) }
      })
      let captured = null
      await processStudyStep(f.version.id, {
        generate: async (prompt, options) => {
          if (!captured) captured = options.usageMetadata
          return lesson(ids)
        }
      })
      assert.ok(captured)
      assert.equal(captured.phase, undefined)
      assert.equal(captured.stage, 'chapters')
      assert.equal(captured.chapterId, 'addition')
    })
  } finally {
    await f.cleanup()
  }
})

test('a repair-triggered whole-chapter rewrite is billed and routed as a correction', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ids = f.snapshot.chunks.map((c) => c.id)
      const failedChapter = { ...lesson(ids), id: 'addition', teachingPlan: teachingPlan(ids) }
      await mutateStudyVersion(f.version.id, (v) => {
        v.draft.stage = 'chapters'
        v.draft.topics = [{ id: 'addition', title: 'Addition', sourceIds: ids }]
        v.draft.teachingPlans = { addition: teachingPlan(ids) }
        v.draft.chapters = []
        v.draft.automaticRepairs = { addition: 1 }
        v.draft.issues = [unscopedFinding]
        v.draft.repair = { topicId: 'addition', chapter: failedChapter }
      })
      let captured = null
      await processStudyStep(f.version.id, {
        generate: async (prompt, options) => {
          if (!captured) captured = options.usageMetadata
          return lesson(ids)
        }
      })
      assert.ok(captured)
      assert.equal(captured.phase, 'whole-chapter-correction')
      assert.equal(captured.chapterId, 'addition')
      assert.equal(captured.correctionAttempt, 1)
    })
  } finally {
    await f.cleanup()
  }
})
