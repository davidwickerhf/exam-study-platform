import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { stageCourseBundle, publishCourseBundle, materializeCourseBundle } from '../lib/study-course-bundle.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument } from '../lib/user-store.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy, addLocalStudyNotes } from '../lib/study-local-generation.mjs'
import { ownStudyVersion, studyRevision, saveStudyRevision, mutateStudyVersion, listOwnStudyVersions, listCourseBundleChildren, pendingStudyVersions } from '../lib/study-version-store.mjs'
import { readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

const asStudent = fn => withRequestContext({ userId: 'bundle-' + randomUUID(), mode: 'local' }, async () => { try { await fn() } finally { await deleteAllDocuments() } })

// A checked two-guide course plan, saved as an immutable parent revision, without
// any model call: the publication fence is what these tests exercise.
async function plannedCourse() {
 const note = await addLocalStudyNotes({ ...course, title: 'Course evidence', pages: [{ page: 1, text: 'Adding disjoint quantities: two plus three equals five.' }, { page: 2, text: 'Subtract to check a total. All quantities need matching units.' }] })
 const { version } = await startLocalStudy({ ...course, sourceKeys: [note.id], courseBundle: true })
 const parent = await ownStudyVersion(version.id), snapshot = parent.draft.snapshot
 const ids = snapshot.chunks.map(c => c.id)
 assert.equal(ids.length, 2)
 const topics = [{ id: 'combine', title: 'Combine quantities', sourceIds: [ids[0]], guideId: 'combine' }, { id: 'check', title: 'Check quantities', sourceIds: [ids[1]], guideId: 'check' }]
 const chapters = topics.map(t => ({ id: t.id, title: t.title, review: 'passed', sourceIds: t.sourceIds, blocks: [{ text: t.title, sourceIds: t.sourceIds }], questions: [{ id: `${t.id}-q`, kind: 'recall', question: 'Why?', answer: 'Because.', sourceId: t.sourceIds[0] }] }))
 const work = { ...parent.draft, guides: [{ id: 'combine', title: 'Combining quantities' }, { id: 'check', title: 'Checking quantities' }], topics, chapters }
 return { note, parent, snapshot, revision: await saveStudyRevision(parent, work) }
}
const holdLease = async (parent, expiresIn = 60000) => {
 const token = randomUUID()
 await mutateStudyVersion(parent.id, next => { next.draft.lease = { token, expiresAt: Date.now() + expiresIn } })
 return { draftId: parent.draft.id, token }
}
// Stands in for the parent's lease-checked commit that records the decision.
const recordPublication = (parent, bundle, revision) => mutateStudyVersion(parent.id, next => {
 next.bundleGuides = bundle.guides
 next.bundlePublication = { revisionId: revision.id, state: 'publishing' }
})

test('a crash between staging and the parent commit leaves no visible guide and a retry converges', async () => asStudent(async () => {
 const { parent, revision } = await plannedCourse()
 const bundle = await stageCourseBundle(parent, revision, await holdLease(parent))
 assert.equal(bundle.guides.length, 2)
 // Crash here: staged children exist on disk but are not part of the workspace.
 assert.equal((await listCourseBundleChildren(parent.id)).length, 2)
 for (const guide of bundle.guides) {
  await assert.rejects(() => ownStudyVersion(guide.id), /not found/)
  assert.equal((await ownStudyVersion(guide.id, { includeStaged: true })).activeRevisionId, null)
 }
 const listed = await listOwnStudyVersions(course.courseCode)
 assert.equal(listed.some(v => bundle.guides.some(g => g.id === v.id)), false)

 const fence = await holdLease(parent)
 const retry = await stageCourseBundle(parent, revision, fence)
 assert.deepEqual(retry.guides.map(g => g.id), bundle.guides.map(g => g.id))
 assert.deepEqual(retry.guides.map(g => g.revisionId), bundle.guides.map(g => g.revisionId))
 await recordPublication(parent, retry, revision)
 await publishCourseBundle(parent, revision, retry, fence)
 assert.deepEqual(new Set((await listOwnStudyVersions(course.courseCode)).map(v => v.id)), new Set(retry.guides.map(g => g.id)))
 for (const guide of retry.guides) {
  const child = await ownStudyVersion(guide.id)
  assert.equal(child.activeRevisionId, guide.revisionId)
  assert.equal(child.history.length, 1)
  assert.equal(child.draft.status, 'complete')
 }
 // Republishing the same revision is a converging no-op, not a second guide.
 const converged = await materializeCourseBundle(parent, revision, {})
 assert.deepEqual(converged.guides.map(g => g.id), retry.guides.map(g => g.id))
 assert.equal((await listCourseBundleChildren(parent.id)).length, 2)
 for (const guide of retry.guides) assert.equal((await ownStudyVersion(guide.id)).history.length, 1)
}))

test('a superseded worker can neither create nor repoint managed guides', async () => asStudent(async () => {
 const { parent, revision } = await plannedCourse()
 const stale = { draftId: parent.draft.id, token: randomUUID() }
 await assert.rejects(() => stageCourseBundle(parent, revision, stale), /lease expired/)
 assert.equal((await listCourseBundleChildren(parent.id)).length, 0)

 const expired = await holdLease(parent, -1000)
 await assert.rejects(() => stageCourseBundle(parent, revision, expired), /lease expired/)
 assert.equal((await listCourseBundleChildren(parent.id)).length, 0)

 const fence = await holdLease(parent)
 const bundle = await stageCourseBundle(parent, revision, fence)
 await recordPublication(parent, bundle, revision)
 await publishCourseBundle(parent, revision, bundle, fence)
 const pointers = (await listCourseBundleChildren(parent.id)).map(v => [v.id, v.activeRevisionId])

 // A stale worker holding a different revision of the same plan is refused
 // before it can write a child document or move an active pointer.
 const superseded = { ...revision, id: 'rev-superseded' }
 await assert.rejects(() => materializeCourseBundle(parent, superseded, { draftId: parent.draft.id, token: randomUUID() }), /lease expired/)
 await assert.rejects(() => materializeCourseBundle(parent, superseded, {}), /lease expired/)
 assert.deepEqual((await listCourseBundleChildren(parent.id)).map(v => [v.id, v.activeRevisionId]), pointers)
}))

test('staged guides cannot be listed, opened or claimed before the parent publishes', async () => asStudent(async () => {
 const { parent, revision } = await plannedCourse()
 const fence = await holdLease(parent)
 const bundle = await stageCourseBundle(parent, revision, fence)
 for (const guide of bundle.guides) {
  const staged = await ownStudyVersion(guide.id, { includeStaged: true })
  assert.equal(staged.courseBundleParent.state, 'staged')
  assert.equal(staged.courseBundleParent.active, false)
  assert.equal(staged.draft.status, 'managed')
  assert.equal((await studyRevision(staged)), null)
  assert.equal((await pendingStudyVersions()).some(row => row.key === guide.id), false)
 }
 await recordPublication(parent, bundle, revision)
 await publishCourseBundle(parent, revision, bundle, fence)
 for (const guide of bundle.guides) {
  const child = await ownStudyVersion(guide.id)
  assert.equal(child.courseBundleParent.state, 'published')
  assert.equal(child.courseBundleParent.active, true)
  assert.equal((await pendingStudyVersions()).some(row => row.key === guide.id), false)
  assert.equal((await studyRevision(child)).chapters.length, 1)
 }
}))

test('a managed guide shares the course snapshot by reference and keeps its citations and refresh guard', async () => asStudent(async () => {
 const { note, parent, revision, snapshot } = await plannedCourse()
 const fence = await holdLease(parent)
 const bundle = await stageCourseBundle(parent, revision, fence)
 await recordPublication(parent, bundle, revision)
 await publishCourseBundle(parent, revision, bundle, fence)
 const guide = bundle.guides[0], child = await ownStudyVersion(guide.id)
 const stored = await readDocument('study-revisions', `${child.id}-${guide.revisionId}`, null)
 assert.deepEqual(stored.snapshot.ref, { versionId: parent.id, revisionId: revision.id })
 assert.deepEqual(stored.snapshot.chunks, [])
 assert.equal(stored.snapshot.sources.length, 1)
 assert.equal(stored.snapshot.sourceIds.length, 1)
 // Scoped to what this guide cites, not the whole course snapshot.
 assert.ok(snapshot.chunks.length > stored.snapshot.sourceIds.length)

 const hydrated = await studyRevision(child)
 assert.deepEqual(hydrated.snapshot.chunks.map(c => c.id), hydrated.topics[0].sourceIds)
 assert.ok(hydrated.snapshot.chunks[0].text.length)
 assert.deepEqual(hydrated.snapshot.sources.map(s => s.key), [hydrated.snapshot.chunks[0].sourceKey])
 assert.equal(hydrated.snapshot.sources[0].kind, 'notes')
 assert.ok(hydrated.snapshot.sources[0].sha256)

 // sourceHash stays the course run's, so refresh detection is unchanged.
 const unchanged = await readStudySourceSnapshot(course, [note.id], { includeHistorical: true, courseBundle: true })
 assert.equal(hydrated.snapshot.sourceHash, snapshot.sourceHash)
 assert.equal(hydrated.snapshot.sourceHash, unchanged.sourceHash)
 const added = await addLocalStudyNotes({ ...course, title: 'More evidence', pages: [{ page: 1, text: 'Units must match before adding two measured amounts together.' }] })
 const changed = await readStudySourceSnapshot(course, [note.id, added.id], { includeHistorical: true, courseBundle: true })
 assert.notEqual(hydrated.snapshot.sourceHash, changed.sourceHash)
 assert.equal(child.history[0].sourceHash, snapshot.sourceHash)
}))

test('administrative-only material fails a course bundle before any outline call', async () => asStudent(async () => {
 const note = await addLocalStudyNotes({ ...course, title: 'Course manual', pages: [{ page: 1, text: 'Grading: the final exam is 60% of the mark. Attendance is mandatory. Office hours are on Tuesday afternoons.' }] })
 const { version } = await startLocalStudy({ ...course, sourceKeys: [note.id], courseBundle: true })
 let outlineCalls = 0, mapCalls = 0
 for (let n = 0; n < 10; n++) {
  const next = await nextLocalStudy(version.id)
  if (!next.request) break
  if (next.request.prompt.includes('WHOLE-COURSE GUIDE BUNDLE')) outlineCalls++
  else mapCalls++
  await submitLocalStudy(version.id, { requestId: next.request.id, contractId: next.request.contractId, response: { topics: [], gaps: ['This batch is course administration only.'] } })
 }
 assert.equal(outlineCalls, 0)
 assert.equal(mapCalls, 1)
 const failed = await ownStudyVersion(version.id)
 assert.equal(failed.draft.status, 'failed')
 assert.match(failed.draft.error, /no teachable topics/)
 assert.equal(failed.draft.maps.length, 1)
 assert.deepEqual(failed.draft.maps[0].topics, [])
 assert.equal(failed.bundleGuides, undefined)
 assert.equal((await listCourseBundleChildren(version.id)).length, 0)
}))
