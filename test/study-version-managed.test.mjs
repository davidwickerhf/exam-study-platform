import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import {
  createStudyVersion, ownStudyVersion, mutateStudyVersion, studyRevision,
  saveStudyRevision, listOwnStudyVersions, countedStudyVersions, STUDY_VERSION_LIMIT
} from '../lib/study-version-store.mjs'
import {
  editStudyText, improveStudyChapter, decideStudyProposal, restoreStudyRevision, forkStudyVersion
} from '../lib/study-version-editing.mjs'
import { studyVersionApi, studyVersionSummary } from '../lib/study-version-api.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

const chapter = (id = 'addition') => ({
  id, title: 'Addition', review: 'passed',
  sections: [{ id: 's1', title: 'Combine quantities', text: 'Addition combines disjoint quantities that share a unit.' }],
  summary: [{ id: 'sum-1', text: 'Check a total by subtracting one part.' }],
  questions: [], flashcards: []
})

// Fixtures build a bundle by hand so this suite stays independent of the
// generation pipeline: no model is called and nothing is queued.
async function workspace() {
  const context = { userId: `managed-${randomUUID()}`, mode: 'local', email: 'student@example.test' }
  const run = fn => withRequestContext(context, fn)
  const snapshot = await run(async () => {
    const note = await addStudyNote({ ...course, title: 'Course evidence' }, [{ page: 1, text: 'Adding disjoint quantities: two plus three equals five. Subtract to check.' }])
    return readStudySourceSnapshot(course, [note.id])
  })
  const complete = async (version, chapters = [chapter()]) => {
    const revision = await saveStudyRevision(version, {
      id: `rev-${randomUUID()}`, snapshot, topics: chapters.map(c => ({ id: c.id, title: c.title })),
      chapters, billing: null, maps: [], issues: [], gaps: [], reused: 0, execution: 'local'
    })
    return mutateStudyVersion(version.id, next => {
      next.activeRevisionId = revision.id
      next.history.unshift({ id: revision.id, createdAt: revision.createdAt, chapters: chapters.length })
      next.draft = { id: revision.id, status: 'complete', stage: 'finish', execution: 'local', billing: null, finishedAt: revision.createdAt }
    })
  }
  const bundle = async (guides = ['first', 'second']) => {
    const parent = await createStudyVersion(course, 'programme-test', snapshot, { title: 'Whole course', courseBundle: true, execution: 'local' })
    const children = []
    for (const guideId of guides) {
      const child = await createStudyVersion(course, 'programme-test', snapshot, {
        title: `Guide ${guideId}`, execution: 'local', courseBundleParent: { versionId: parent.id, guideId, active: true }
      })
      children.push(await complete(child))
    }
    const published = await mutateStudyVersion(parent.id, next => {
      next.bundleGuides = children.map((c, i) => ({ id: c.id, guideId: guides[i], title: c.title, revisionId: c.activeRevisionId, chapters: 1 }))
      next.draft = { id: next.draft.id, status: 'complete', stage: 'finish', execution: 'local', billing: null }
    })
    return { parent: published, children }
  }
  return { run, snapshot, complete, bundle, cleanup: () => run(deleteAllDocuments) }
}

test('managed guides refuse every manual mutation and name the parent course run', async () => {
  const f = await workspace()
  try {
    await f.run(async () => {
      const { parent, children } = await f.bundle()
      const child = children[0], base = await studyRevision(child)
      const input = { baseRevisionId: base.id, topicId: base.chapters[0].id }
      const named = new RegExp(`managed by course run ${parent.id}`)
      for (const [label, call] of [
        ['edit', () => editStudyText(child.id, { ...input, field: 'sections.0.text', text: 'My own wording.' })],
        ['improve', () => improveStudyChapter(child.id, { ...input, feedback: 'Add a clearer worked example.' })],
        ['restore', () => restoreStudyRevision(child.id, { ...input, revisionId: base.id })],
        ['proposal', () => decideStudyProposal(child.id, { revisionId: base.id, decision: 'apply' })]
      ]) {
        await assert.rejects(call, named, label)
        await assert.rejects(call, error => error.status === 409, label)
      }
      // The refusal is stated by the route too, before execution or billing
      // branches can answer with an unrelated message.
      for (const action of ['improve', 'restore', 'refresh', 'stop']) {
        await assert.rejects(studyVersionApi({
          pathname: `/api/study-versions/${child.id}/${action}`, method: 'POST', query: {}, body: {},
          platform: { configured: true, provider: 'openai', model: 'gpt-5-mini' }
        }), named, action)
      }
      assert.equal((await studyRevision(await ownStudyVersion(child.id))).id, base.id)
    })
  } finally { await f.cleanup() }
})

test('forking a managed guide produces an independent editable version with recorded lineage', async () => {
  const f = await workspace()
  try {
    await f.run(async () => {
      const { parent, children } = await f.bundle()
      const child = children[0], base = await studyRevision(child)
      const result = await studyVersionApi({
        pathname: `/api/study-versions/${child.id}/fork`, method: 'POST', query: {},
        body: { title: 'My own copy' }, platform: {}
      })
      assert.equal(result.status, 201)
      const fork = result.data.version
      assert.equal(fork.title, 'My own copy')
      assert.equal(fork.managed, null, 'a fork is not managed by the parent')
      assert.equal(fork.courseBundleParent, null)
      assert.equal(fork.bundle, null)
      assert.deepEqual(fork.parent, { versionId: child.id, revisionId: base.id, courseBundleVersionId: parent.id, guideId: 'first' })
      assert.equal(fork.draft.status, 'complete')
      assert.notEqual(fork.id, child.id)
      const stored = await ownStudyVersion(fork.id)
      const copied = await studyRevision(stored)
      assert.deepEqual(copied.chapters, base.chapters)
      assert.notEqual(copied.id, base.id, 'the fork owns its own revision identity')
      assert.equal(copied.edit.kind, 'fork')
      assert.equal(copied.edit.sourceVersionId, child.id)
      // A fork costs nothing and starts nothing: it copies a saved revision.
      assert.equal(stored.draft.billing, null)
      assert.equal(stored.draft.status, 'complete')
      // And unlike its managed origin it accepts ordinary edits.
      const edited = await editStudyText(fork.id, { baseRevisionId: copied.id, topicId: base.chapters[0].id, field: 'sections.0.text', text: 'My own wording for this explanation.' })
      assert.equal((await studyRevision(edited)).chapters[0].review, 'student-edited')
      assert.equal((await studyRevision(await ownStudyVersion(child.id))).chapters[0].review, 'passed', 'the managed guide is untouched')
    })
  } finally { await f.cleanup() }
})

test('a course bundle counts as one version while forks count on their own', async () => {
  const f = await workspace()
  try {
    await f.run(async () => {
      const { parent, children } = await f.bundle(Array.from({ length: 12 }, (_, i) => `guide-${i}`))
      assert.equal(children.length, 12)
      assert.deepEqual((await countedStudyVersions(course.courseCode)).map(v => v.id), [parent.id])
      const forks = []
      for (let i = 0; i < 3; i++) forks.push(await forkStudyVersion(children[i].id, { title: `Copy ${i}` }))
      assert.equal((await countedStudyVersions(course.courseCode)).length, 4)
      // Ordinary creation still stops at the cap; managed children never do.
      for (let i = (await countedStudyVersions(course.courseCode)).length; i < STUDY_VERSION_LIMIT; i++)
        await createStudyVersion(course, 'programme-test', f.snapshot, { title: `Ordinary ${i}`, execution: 'local' })
      assert.equal((await countedStudyVersions(course.courseCode)).length, STUDY_VERSION_LIMIT)
      await assert.rejects(createStudyVersion(course, 'programme-test', f.snapshot, { title: 'One too many', execution: 'local' }), /already have 20 versions/)
      await assert.rejects(forkStudyVersion(children[5].id, {}), /already have 20 versions/)
      // A full course cannot be planned into managed guides at the cap either.
      await assert.rejects(studyVersionApi({
        pathname: '/api/study-versions', method: 'POST', query: {},
        body: { ...course, sourceKeys: f.snapshot.sources.map(s => s.key), courseBundle: true }, platform: {}
      }), /before planning a whole course/)
      // Materializing more managed children remains possible at the cap.
      const extra = await createStudyVersion(course, 'programme-test', f.snapshot, { title: 'Late guide', execution: 'local', courseBundleParent: { versionId: parent.id, guideId: 'late', active: true } })
      assert.equal(extra.courseBundleParent.versionId, parent.id)
      assert.equal((await countedStudyVersions(course.courseCode)).length, STUDY_VERSION_LIMIT)
    })
  } finally { await f.cleanup() }
})

test('version listing hides published parents and superseded guides unless a caller opts in', async () => {
  const f = await workspace()
  try {
    await f.run(async () => {
      const { parent, children } = await f.bundle()
      await mutateStudyVersion(children[1].id, next => { next.courseBundleParent.active = false })
      const visible = await listOwnStudyVersions(course.courseCode)
      assert.deepEqual(visible.map(v => v.id), [children[0].id])
      assert.deepEqual((await listOwnStudyVersions(course.courseCode, { includeBundleParents: true })).map(v => v.id).sort(), [parent.id, children[0].id].sort())
      assert.deepEqual((await listOwnStudyVersions(course.courseCode, { includeManaged: true })).map(v => v.id).sort(), children.map(c => c.id).sort())
      assert.equal((await listOwnStudyVersions(course.courseCode, { includeBundleParents: true, includeManaged: true })).length, 3)
      assert.equal((await listOwnStudyVersions('OTHER-CODE', { includeBundleParents: true, includeManaged: true })).length, 0)
    })
  } finally { await f.cleanup() }
})

test('summaries carry typed navigation between a course run and its managed guides', async () => {
  const f = await workspace()
  try {
    await f.run(async () => {
      const { parent, children } = await f.bundle()
      const parentSummary = studyVersionSummary(parent)
      assert.equal(parentSummary.managed, null)
      assert.deepEqual(parentSummary.bundle, {
        guides: [
          { guideId: 'first', versionId: children[0].id, title: 'Guide first', chapters: 1, status: 'complete' },
          { guideId: 'second', versionId: children[1].id, title: 'Guide second', chapters: 1, status: 'complete' }
        ], planningComplete: true, complete: true
      })
      const childSummary = studyVersionSummary(await ownStudyVersion(children[0].id))
      assert.deepEqual(childSummary.managed, { parentVersionId: parent.id, guideId: 'first', guideTitle: 'Guide first', active: true, editable: false, forkable: true })
      assert.equal(childSummary.bundle, null)
      // A planned but unpublished bundle reports its guides before publication.
      const planning = await createStudyVersion(course, 'programme-test', f.snapshot, { title: 'Next course run', courseBundle: true, execution: 'local' })
      const planned = await mutateStudyVersion(planning.id, next => { next.draft.guides = [{ id: 'intro', title: 'Introduction' }] })
      assert.deepEqual(studyVersionSummary(planned).bundle, {
        guides: [{ guideId: 'intro', versionId: null, title: 'Introduction', chapters: null, status: 'planned' }],
        planningComplete: true, complete: false
      })
    })
  } finally { await f.cleanup() }
})
