import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { activeProgrammeId } from '../lib/programme-scope.mjs'
import { deleteAllDocuments, readDocument, writeDocument } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy } from '../lib/study-local-generation.mjs'
import { stageCourseBundle, publishCourseBundle } from '../lib/study-course-bundle.mjs'
import { enrollGuideMaintenance } from '../lib/study-guide-maintenance.mjs'
import { reconcileModuleGuides } from '../lib/study-module-automation.mjs'
import { refreshStudyVersion } from '../lib/study-version-pipeline.mjs'
import { forkStudyVersion } from '../lib/study-version-editing.mjs'
import { selectStudyPublication } from '../lib/study-version-sharing.mjs'
import { exportPersonalData } from '../lib/account-data.mjs'
import { ownStudyVersion, studyRevision, saveStudyRevision, mutateStudyVersion, listOwnStudyVersions, listCourseBundleChildren, pendingStudyVersions } from '../lib/study-version-store.mjs'

// pendingStudyVersions scans every local account, so always ask about this run.
const hostedWork = async id => (await pendingStudyVersions()).filter(row => row.key === id || row.value.courseBundleParent?.versionId === id).map(row => row.key)
import { course, lesson, teachingResponse } from '../scripts/verification/study-fixtures.mjs'

const asStudent = fn => withRequestContext({ userId: 'bundle-refresh-' + randomUUID(), mode: 'local' }, async () => { try { await fn() } finally { await deleteAllDocuments() } })
const paragraph = (n, subject) => `Lesson ${n}: ${subject}. Adding disjoint quantities keeps their matching units, and subtracting one part from the total checks the result. Count every item exactly once before combining the groups.`

// A checked course plan saved straight into an immutable parent revision. No
// model call: these tests are about what a second publication does to the
// guides the first one published.
async function plannedCourse(guides, { note = null, revisionId = null } = {}) {
  const source = note || await addStudyNote({ ...course, title: 'Course evidence' }, guides.map((g, i) => ({ page: i + 1, text: paragraph(i + 1, g[1]) })))
  const parent = await ownStudyVersion((await startLocalStudy({ ...course, sourceKeys: [source.id], courseBundle: true })).version.id)
  return { note: source, ...(await planRevision(parent, guides, revisionId)) }
}
async function planRevision(parent, guides, revisionId = null) {
  const snapshot = parent.draft.snapshot, ids = snapshot.chunks.map(c => c.id)
  const topics = guides.map((g, i) => ({ id: g[0], title: g[1], sourceIds: [ids[i]], guideId: g[0] }))
  const chapters = topics.map(t => ({ id: t.id, title: t.title, review: 'passed', sourceIds: t.sourceIds, blocks: [{ text: t.title, sourceIds: t.sourceIds }], questions: [{ id: `${t.id}-q`, kind: 'recall', question: 'Why?', answer: 'Because.', sourceId: t.sourceIds[0] }] }))
  const work = { ...parent.draft, ...(revisionId ? { id: revisionId } : {}), guides: guides.map(g => ({ id: g[0], title: `${g[1]} guide` })), topics, chapters }
  return { parent, revision: await saveStudyRevision(parent, work) }
}
const holdLease = async parent => {
  const token = randomUUID()
  await mutateStudyVersion(parent.id, next => { next.draft.lease = { token, expiresAt: Date.now() + 60000 } })
  return { draftId: parent.draft.id, token }
}
async function publish(parent, revision) {
  const fence = await holdLease(parent)
  const bundle = await stageCourseBundle(parent, revision, fence)
  await mutateStudyVersion(parent.id, next => { next.bundleGuides = bundle.guides; next.bundlePublication = { revisionId: revision.id, state: 'publishing' } })
  await publishCourseBundle(parent, revision, bundle, fence)
  await mutateStudyVersion(parent.id, next => {
    next.activeRevisionId = revision.id
    if (!next.history.some(r => r.id === revision.id)) next.history.unshift({ id: revision.id, createdAt: revision.createdAt, chapters: revision.chapters.length, sourceHash: revision.snapshot.sourceHash })
  })
  return bundle
}

test('a republished course keeps guide identities, keeps the old guides readable while the new plan stages, and archives a dropped guide', async () => asStudent(async () => {
  const { note, parent, revision } = await plannedCourse([['combine', 'Combining quantities'], ['check', 'Checking totals']])
  const first = await publish(parent, revision)
  const kept = first.guides.find(g => g.guideId === 'combine'), dropped = first.guides.find(g => g.guideId === 'check')
  assert.equal((await ownStudyVersion(kept.id)).activeRevisionId, kept.revisionId)

  // Second plan for the same course: 'combine' survives, 'check' is dropped and
  // 'extra' is new. The parent revision is new, so every child revision is too.
  const reloaded = await ownStudyVersion(parent.id)
  const { revision: second } = await planRevision({ ...reloaded, draft: { ...reloaded.draft, id: `rev-${randomUUID()}` } },
    [['combine', 'Combining quantities'], ['extra', 'Estimating totals']])
  assert.notEqual(second.id, revision.id)
  const fence = await holdLease(await ownStudyVersion(parent.id))
  const staged = await stageCourseBundle(await ownStudyVersion(parent.id), second, fence)

  // Staged, not published: the student still reads exactly the first plan.
  assert.equal((await ownStudyVersion(kept.id)).activeRevisionId, kept.revisionId)
  assert.equal((await ownStudyVersion(dropped.id)).courseBundleParent.state, 'published')
  const fresh = staged.guides.find(g => g.guideId === 'extra')
  await assert.rejects(() => ownStudyVersion(fresh.id), /not found/)
  assert.deepEqual((await listOwnStudyVersions(course.courseCode)).map(v => v.id).sort(), [kept.id, dropped.id].sort())

  const current = await ownStudyVersion(parent.id)
  await mutateStudyVersion(parent.id, next => { next.bundleGuides = staged.guides; next.bundlePublication = { revisionId: second.id, state: 'publishing' } })
  await publishCourseBundle(current, second, staged, fence)

  // Identity is derived from (course run, guide), so the surviving guide is the
  // same document with a new revision, not a second copy.
  assert.equal(staged.guides.find(g => g.guideId === 'combine').id, kept.id)
  const survivor = await ownStudyVersion(kept.id)
  assert.notEqual(survivor.activeRevisionId, kept.revisionId)
  assert.equal(survivor.history.length, 2)
  assert.equal(survivor.courseBundleParent.parentRevisionId, second.id)
  assert.equal((await ownStudyVersion(fresh.id)).courseBundleParent.state, 'published')

  // The dropped guide is archived, not deleted: it keeps its document, its
  // revision and its hydrated snapshot from the first course revision.
  const archived = await ownStudyVersion(dropped.id)
  assert.equal(archived.courseBundleParent.state, 'archived')
  assert.equal(archived.courseBundleParent.active, false)
  assert.ok(archived.courseBundleParent.archivedAt)
  assert.equal(archived.activeRevisionId, dropped.revisionId)
  const archivedRevision = await studyRevision(archived)
  assert.equal(archivedRevision.chapters.length, 1)
  assert.equal(archivedRevision.snapshot.chunks.length, 1)
  assert.equal((await listCourseBundleChildren(parent.id)).length, 3)
  assert.deepEqual((await listOwnStudyVersions(course.courseCode)).map(v => v.id).sort(), [kept.id, fresh.id].sort())
  assert.equal((await listOwnStudyVersions(course.courseCode, { includeManaged: true })).some(v => v.id === dropped.id), true)
  assert.ok(note.id)
}))

// A whole local course run, driven through the MCP next/submit state machine
// exactly as a student's agent would, then a genuine source top-up on the
// parent. The mocks are deterministic: one map per batch, one guide per mapped
// concept, one scripted lesson per chapter.
function localProvider(versionId) {
  const authored = []
  return {
    authored,
    respond: async request => {
      const prompt = request.prompt, draft = (await ownStudyVersion(versionId)).draft
      if (prompt.includes('Map this evidence batch')) {
        const chunks = JSON.parse(prompt.split('\nEvidence: ')[1].split('\nMap this evidence batch')[0])
        return { topics: chunks.map(chunk => ({ id: `topic-${chunk.page}`, title: `Concept ${chunk.page}`, sourceIds: [chunk.id] })), gaps: [] }
      }
      if (prompt.includes('WHOLE-COURSE GUIDE BUNDLE')) {
        const mapped = JSON.parse(prompt.split('Mapped concepts: ')[1].split('\nSource gaps:')[0])
        return { guides: mapped.map(item => ({ id: `guide-${item.id}`, title: `${item.title} guide`, topics: [{ id: item.id, title: item.title, topicRefs: [item.ref] }] })), gaps: [] }
      }
      const pending = draft.chapters.find(c => c.review === 'pending')
      const topic = pending ? draft.topics.find(t => t.id === pending.id) : draft.topics.find(t => !draft.chapters.some(c => c.id === t.id))
      const ids = topic.sourceIds
      const scripted = teachingResponse(prompt, ids)
      if (scripted) return scripted
      if (!prompt.includes('INCREMENTAL SOURCE REFRESH')) authored.push(topic.id)
      const value = lesson(ids)
      return prompt.includes('INCREMENTAL SOURCE REFRESH')
        ? { sections: value.sections, removeSectionIds: [], questions: value.questions, removeQuestionKeys: [], flashcards: value.flashcards, summary: value.summary, caveats: value.caveats, learningGoals: value.learningGoals, walkthrough: value.walkthrough }
        : value
    }
  }
}
async function drive(id, provider, { steps = 80, onStep = null, sourceOptions = {} } = {}) {
  for (let i = 0; i < steps; i++) {
    const next = await nextLocalStudy(id, {}, sourceOptions)
    if (onStep) await onStep()
    if (!next.request) break
    await submitLocalStudy(id, { requestId: next.request.id, contractId: next.request.contractId, response: await provider.respond(next.request) }, sourceOptions)
  }
  return ownStudyVersion(id)
}

test('a source top-up runs through the course run only, keeps guide ids and readable revisions, reuses unchanged chapters and starts no hosted work', async () => asStudent(async () => {
  const note = await addStudyNote({ ...course, title: 'Course notes' }, [{ page: 1, text: paragraph(1, 'combining quantities') }, { page: 2, text: paragraph(2, 'checking a total') }])
  const { version } = await startLocalStudy({ ...course, sourceKeys: [note.id], courseBundle: true, title: 'Whole course' })
  const provider = localProvider(version.id)
  let parent = await drive(version.id, provider)
  assert.equal(parent.draft.status, 'complete', JSON.stringify(parent.draft.issues))
  assert.equal(parent.bundleGuides.length, 2)
  const before = Object.fromEntries((await listOwnStudyVersions(course.courseCode)).map(v => [v.courseBundleParent.guideId, { id: v.id, revisionId: v.activeRevisionId }]))
  assert.equal(Object.keys(before).length, 2)
  assert.deepEqual(provider.authored.sort(), ['topic-1', 'topic-2'])

  // A managed guide refuses its own refresh and names the course run.
  const child = before['guide-topic-1']
  await assert.rejects(() => refreshStudyVersion(child.id, { sourceKeys: [note.id] }, {}), new RegExp(`Refresh the managed course run ${version.id}`))

  // Scope is still enforced for a bundle: a wider source limit is not a wider
  // edition scope, so another period's material cannot be added.
  const other = await addStudyNote({ ...course, period: '2', title: 'Next period notes' }, [{ page: 1, text: paragraph(9, 'a later period topic') }])
  await assert.rejects(() => refreshStudyVersion(version.id, { sourceKeys: [note.id, other.id] }, { execution: 'local' }), /edition/i)
  assert.equal((await ownStudyVersion(version.id)).draft.status, 'complete')

  const added = await addStudyNote({ ...course, title: 'Extra notes' }, [{ page: 3, text: paragraph(3, 'estimating a total before calculating it') }])
  await refreshStudyVersion(version.id, { sourceKeys: [note.id, added.id] }, { execution: 'local', billing: { source: 'local', model: 'local-agent', provider: 'local' } })
  const queued = await ownStudyVersion(version.id)
  // A local course run stays local: no hosted queue entry, no hosted status.
  assert.equal(queued.draft.execution, 'local')
  assert.equal(queued.draft.status, 'local-ready')
  assert.equal(queued.draft.refreshFrom, parent.activeRevisionId)
  assert.deepEqual(queued.draft.changes.added, ['Extra notes'])
  assert.deepEqual(await hostedWork(version.id), [])

  provider.authored.length = 0
  parent = await drive(version.id, provider, {
    onStep: async () => {
      // The published guides stay readable and unchanged for the whole run.
      for (const [guideId, saved] of Object.entries(before)) {
        const current = await ownStudyVersion(saved.id)
        if (current.courseBundleParent.parentRevisionId === parent.activeRevisionId)
          assert.equal(current.activeRevisionId, saved.revisionId, `${guideId} lost its readable revision mid-refresh`)
        assert.deepEqual(await hostedWork(version.id), [])
      }
    }
  })
  assert.equal(parent.draft.status, 'complete', JSON.stringify(parent.draft.issues))
  assert.equal(parent.bundleGuides.length, 3)
  const revision = await studyRevision(parent)
  // Unchanged evidence reuses its checked chapter; only the new concept is written.
  assert.equal(revision.reused, 2)
  assert.deepEqual(provider.authored, ['topic-3'])

  const after = Object.fromEntries((await listOwnStudyVersions(course.courseCode)).map(v => [v.courseBundleParent.guideId, { id: v.id, revisionId: v.activeRevisionId }]))
  assert.equal(Object.keys(after).length, 3)
  for (const [guideId, saved] of Object.entries(before)) {
    assert.equal(after[guideId].id, saved.id, 'a surviving guide kept its version id')
    assert.notEqual(after[guideId].revisionId, saved.revisionId)
    const updated = await ownStudyVersion(saved.id)
    assert.equal(updated.history.length, 2)
    assert.equal((await studyRevision(updated)).snapshot.sourceHash, revision.snapshot.sourceHash)
  }
  assert.ok(after['guide-topic-3'])
  assert.equal((await studyRevision(await ownStudyVersion(after['guide-topic-3'].id))).chapters.length, 1)
  assert.deepEqual(await hostedWork(version.id), [])
}))

test('a completed bundle is maintained through its course run, never through a managed guide', async () => asStudent(async () => {
  const data = [{ key: 'slide', sourcePath: 'slides.pdf', title: 'Lecture', academicYear: course.academicYear, period: course.period, bindingId: 'binding', locations: [{ moduleId: 'one' }], sha256: 'one', pages: [{ page: 1, text: paragraph(1, 'combining quantities') }, { page: 2, text: paragraph(2, 'checking a total') }] }]
  const sourceOptions = { editorialSources: async () => data }
  await writeDocument('canvas-module-inventories', 'binding', { bindingId: 'binding', course, modules: [{ id: 'one', name: 'Arithmetic', items: 1 }] })
  const { version } = await startLocalStudy({ ...course, sourceKeys: ['slide'], courseBundle: true, title: 'Whole course' }, sourceOptions)
  const provider = localProvider(version.id)
  let parent = await drive(version.id, provider, { sourceOptions })
  assert.equal(parent.draft.status, 'complete', JSON.stringify(parent.draft.issues))
  const guides = await listOwnStudyVersions(course.courseCode)
  assert.equal(guides.length, 2)

  // A managed guide cannot be enrolled: its course run owns every revision.
  const enrollment = { enabled: true, moduleRefs: [{ bindingId: 'binding', moduleId: 'one' }], dryRun: false }
  await assert.rejects(() => enrollGuideMaintenance({ ...enrollment, versionId: guides[0].id, expectedRevisionId: guides[0].activeRevisionId }, { sourceOptions }), /managed by course run/)

  assert.equal(parent.programmeId, await activeProgrammeId())
  await enrollGuideMaintenance({ ...enrollment, versionId: version.id, expectedRevisionId: parent.activeRevisionId }, { sourceOptions })
  const enrolled = await ownStudyVersion(version.id), settingsKey = enrolled.automation.settingsKey
  assert.equal(enrolled.automation.kind, 'maintenance')
  await reconcileModuleGuides(settingsKey, { sourceOptions })
  assert.equal((await ownStudyVersion(version.id)).draft.id, parent.draft.id, 'unchanged sources queue nothing')

  // The withheld material arrives: the check must queue work on the course run.
  data.push({ ...data[0], key: 'exercises', sourcePath: 'exercises.pdf', sha256: 'two', pages: [{ page: 3, text: paragraph(3, 'estimating a total before calculating it') }] })
  await reconcileModuleGuides(settingsKey, { sourceOptions, now: Date.now() + 86400001 })
  const queued = await ownStudyVersion(version.id)
  assert.equal(queued.draft.execution, 'local')
  assert.equal(queued.draft.status, 'local-ready')
  assert.equal(queued.draft.refreshFrom, parent.activeRevisionId)
  assert.deepEqual(queued.draft.changes.added, ['Lecture'])
  const events = (await readDocument('study-module-settings', settingsKey, null)).events[0].maintenance
  assert.deepEqual(events.map(e => e.versionId), [version.id])
  assert.equal(events[0].status, 'queued')
  for (const guide of guides) {
    const current = await ownStudyVersion(guide.id)
    assert.equal(current.activeRevisionId, guide.activeRevisionId)
    assert.equal(current.automation, undefined)
    assert.equal(current.draft.status, 'complete')
  }
  parent = await drive(version.id, provider, { steps: 60, sourceOptions })
  assert.equal(parent.draft.status, 'complete', JSON.stringify(parent.draft.issues))
  assert.equal(parent.bundleGuides.length, 3)
  assert.deepEqual(await hostedWork(version.id), [])
}))

test('a course run and its guides travel together: export, fork and publication all carry the shared evidence', async () => asStudent(async () => {
  const { parent, revision } = await plannedCourse([['combine', 'Combining quantities'], ['check', 'Checking totals']])
  const bundle = await publish(parent, revision)
  const child = await ownStudyVersion(bundle.guides[0].id)
  const childRevision = await studyRevision(child)

  // Export: the guides and the course revision they hydrate from are in the
  // same account export, so the reference can always be resolved.
  const exported = await exportPersonalData()
  const versions = exported.studentStudy['study-versions'].map(row => row.key)
  const revisions = exported.studentStudy['study-revisions'].map(row => row.key)
  assert.equal(versions.includes(parent.id), true)
  for (const guide of bundle.guides) {
    assert.equal(versions.includes(guide.id), true)
    assert.equal(revisions.includes(`${guide.id}-${guide.revisionId}`), true)
  }
  const stored = exported.studentStudy['study-revisions'].find(row => row.key === `${child.id}-${childRevision.id}`).value
  assert.deepEqual(stored.snapshot.ref, { versionId: parent.id, revisionId: revision.id })
  assert.equal(revisions.includes(`${parent.id}-${stored.snapshot.ref.revisionId}`), true)

  // Fork: an independent copy owns its evidence instead of the reference.
  const fork = await forkStudyVersion(child.id, { title: 'My own copy' })
  const forked = await readDocument('study-revisions', `${fork.id}-${fork.activeRevisionId}`, null)
  assert.equal('ref' in forked.snapshot, false)
  assert.equal('sourceIds' in forked.snapshot, false)
  assert.deepEqual(forked.snapshot.chunks.map(c => c.id), childRevision.snapshot.chunks.map(c => c.id))
  assert.ok(forked.snapshot.chunks[0].text.length)
  assert.deepEqual((await studyRevision(await ownStudyVersion(fork.id))).snapshot.chunks.map(c => c.id), forked.snapshot.chunks.map(c => c.id))

  // Publication: a shared selection copies the cited excerpts inline and keeps
  // the private course-run reference out of another student's copy.
  const selected = selectStudyPublication(childRevision, [childRevision.chapters[0].id])
  assert.equal(selected.snapshot.ref, undefined)
  assert.equal(selected.snapshot.sourceIds, undefined)
  assert.equal(selected.snapshot.chunks.length, 1)
  assert.ok(selected.snapshot.chunks[0].text.length)
}))
