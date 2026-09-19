import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, deleteDocument, compareAndSwapDocument } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, studyRevision, mutateStudyVersion, listOwnStudyVersions, listCourseBundleChildren, pendingStudyVersions, claimStudyDispatch } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration } from '../lib/study-version-pipeline.mjs'
import { estimateStudyCall, reserveStudyLedger, settleStudyLedger } from '../lib/study-ai-budget.mjs'
import { digest } from '../lib/study-version-content.mjs'
import { course, lesson, teachingResponse } from '../scripts/verification/study-fixtures.mjs'

// The hosted state machine, not the MCP/local one: real processStudyStep runs
// with mocked provider responses, the same dispatcher discovery a queue worker
// uses, and the same budget ledger a hosted call reserves against.
const billing = { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 50 }
const outputLimit = () => Object.assign(new Error('The AI reached this step’s output limit before finishing.'), { status: 502, code: 'provider_output_limit' })
// Same derivation as study-course-bundle.mjs, so the test can name a child
// identity before the publication that creates it.
const derivedId = (prefix, value) => { const h = digest(value).slice(0, 32); return `${prefix}-${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` }

async function fixture() {
  const userId = `bundle-hosted-${randomUUID()}`
  const run = fn => withRequestContext({ userId, mode: 'local' }, fn)
  const version = await run(async () => {
    const note = await addStudyNote({ ...course, title: 'Arithmetic notes' },
      Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: `Lesson ${i + 1}: adding disjoint quantities keeps their matching units and subtraction checks the result.` })))
    return createStudyVersion(course, 'programme-test', await readStudySourceSnapshot(course, [note.id], { courseBundle: true }),
      { courseBundle: true, billing, title: 'Whole course plan' })
  })
  return { run, version, cleanup: () => run(deleteAllDocuments) }
}

// Reserve and settle every mocked call exactly as runBudgetedStudyCall does, so
// the recorded ledger shows which job a bundle's spending was charged to.
function jobLedger() {
  let ledger = null
  return {
    read: () => ledger,
    charge(prompt, options) {
      const estimate = estimateStudyCall(prompt + JSON.stringify(options.responseSchema || {}), options.maxOutputTokens || 10000, options.billing.model)
      const { ledger: next, reservation } = reserveStudyLedger(ledger, {
        user: 'student', quotaExempt: true, jobKey: options.jobKey, source: options.billing.source, model: options.billing.model,
        chapterKey: options.usageMetadata?.chapterId ? digest([options.jobKey, options.usageMetadata.chapterId]) : null,
        estimate, maxJobUsd: options.billing.maxJobUsd
      })
      ledger = settleStudyLedger(next, reservation.id, null)
    }
  }
}

function hostedProvider(versionId, ledger) {
  const calls = []
  let limited = false
  return {
    calls,
    generate: async (prompt, options) => {
      calls.push({ phase: options.usageMetadata?.phase || null, jobKey: options.jobKey, versionId: options.usageMetadata?.versionId, billing: options.billing })
      ledger.charge(prompt, options)
      const draft = (await ownStudyVersion(versionId)).draft
      if (prompt.includes('Map this evidence batch')) {
        // One output limit on the first batch: hosted recovery must halve it.
        if (!limited) { limited = true; throw outputLimit() }
        const ids = JSON.parse(prompt.split('\nEvidence: ')[1].split('\nMap this evidence batch')[0]).map(c => c.id)
        return { topics: [{ id: `concept-${draft.maps.length}`, title: draft.maps.length ? 'Checking totals' : 'Combining quantities', sourceIds: ids }], gaps: [] }
      }
      if (prompt.includes('WHOLE-COURSE GUIDE BUNDLE')) {
        const mapped = JSON.parse(prompt.split('Mapped concepts: ')[1].split('\nSource gaps:')[0])
        return { guides: mapped.map((item, index) => ({ id: `guide-${index + 1}`, title: `${item.title} guide`, topics: [{ id: item.id, title: item.title, topicRefs: [item.ref] }] })), gaps: [] }
      }
      const pending = draft.chapters.find(c => c.review === 'pending')
      const topic = pending ? draft.topics.find(t => t.id === pending.id) : draft.topics.find(t => !draft.chapters.some(c => c.id === t.id))
      const ids = topic.sourceIds
      return teachingResponse(prompt, ids) || lesson(ids)
    }
  }
}

async function step(id, generate) {
  await processStudyStep(id, { generate })
  // Whatever a future writer leaves on a derived draft, a managed guide must
  // never be discoverable as hosted work.
  for (const child of await listCourseBundleChildren(id))
    assert.ok(['managed', 'complete'].includes(child.draft.status), `managed guide entered ${child.draft.status}`)
  assert.equal((await pendingStudyVersions()).some(row => row.value.courseBundleParent), false)
  return ownStudyVersion(id)
}

test('a hosted course bundle maps, plans, authors and publishes its guides under one shared job', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ledger = jobLedger(), provider = hostedProvider(f.version.id, ledger)
      const draftId = f.version.draft.id
      // The dispatcher offers the course run itself, never a derived guide.
      assert.equal((await claimStudyDispatch()).includes(f.version.id), true)

      // Stop the publication half-way: the second guide's derived identity is
      // taken by an unrelated run, so the first guide stays staged on disk.
      const blocked = derivedId('sv', [f.version.id, 'guide-2'])
      await compareAndSwapDocument('study-versions', blocked, {
        id: blocked, course, revision: randomUUID(), updatedAt: new Date().toISOString(), history: [], activeRevisionId: null,
        courseBundleParent: { versionId: `sv-${randomUUID()}`, guideId: 'guide-2', state: 'staged', active: false }, draft: { status: 'managed', stage: 'finish' }
      }, null)

      let version = f.version
      for (let i = 0; i < 90 && !['complete', 'failed', 'stopped'].includes(version.draft.status); i++)
        version = await step(f.version.id, provider.generate)
      assert.equal(version.draft.status, 'failed')
      assert.match(version.draft.error, /belongs to another run/)

      // Staged window: one child exists but is invisible, unreadable and not
      // claimable, and the parent has recorded no publication.
      assert.equal(version.bundleGuides, undefined)
      assert.equal(version.bundlePublication, undefined)
      const staged = (await listCourseBundleChildren(f.version.id))
      assert.equal(staged.length, 1)
      assert.equal(staged[0].id, derivedId('sv', [f.version.id, 'guide-1']))
      assert.equal(staged[0].courseBundleParent.state, 'staged')
      assert.equal(staged[0].activeRevisionId, null)
      assert.equal(staged[0].draft.status, 'managed')
      await assert.rejects(() => ownStudyVersion(staged[0].id), /not found/)
      assert.deepEqual((await listOwnStudyVersions(course.courseCode)).map(v => v.id), [f.version.id])
      assert.equal((await claimStudyDispatch()).includes(f.version.id), false)

      // Release the identity and retry: the same fenced finish step converges.
      await deleteDocument('study-versions', blocked)
      await controlStudyGeneration(f.version.id, 'retry')
      version = await ownStudyVersion(f.version.id)
      for (let i = 0; i < 20 && !['complete', 'failed', 'stopped'].includes(version.draft.status); i++)
        version = await step(f.version.id, provider.generate)
      assert.equal(version.draft.status, 'complete', version.draft.error || '')
      assert.equal(version.draft.id, draftId)

      // Mapping recovery happened in hosted mode and lost no evidence.
      const revision = await studyRevision(version)
      assert.equal(revision.maps.length, 2)
      assert.deepEqual(revision.topics.flatMap(t => t.sourceIds).sort(), revision.snapshot.chunks.map(c => c.id).sort())
      assert.equal(provider.calls.filter(c => c.phase === 'source-mapping').length, 3)

      // Publication: staged first, then flipped, both recorded on the parent.
      assert.equal(version.bundlePublication.state, 'published')
      assert.ok(version.bundlePublication.stagedAt <= version.bundlePublication.publishedAt)
      assert.equal(version.bundlePublication.revisionId, revision.id)
      assert.equal(version.bundleGuides.length, 2)
      const children = await listOwnStudyVersions(course.courseCode)
      assert.deepEqual(children.map(v => v.id).sort(), version.bundleGuides.map(g => g.id).sort())
      assert.equal(staged[0].id, version.bundleGuides[0].id)
      for (const child of children) {
        assert.equal(child.courseBundleParent.versionId, f.version.id)
        assert.equal(child.courseBundleParent.state, 'published')
        assert.equal(child.draft.status, 'complete')
        assert.equal(child.history.length, 1)
        assert.equal(child.activeRevisionId, child.history[0].id)
        assert.equal((await studyRevision(child)).chapters.length, 1)
        assert.equal((await pendingStudyVersions()).some(row => row.key === child.id), false)
      }
      assert.equal((await claimStudyDispatch()).some(id => id === f.version.id || version.bundleGuides.some(g => g.id === id)), false)

      // Every provider call was reserved against the parent course run: one job
      // key, one version in the usage metadata and one chapter allowance.
      const spend = ledger.read()
      assert.deepEqual(Object.keys(spend.jobs), [draftId])
      assert.ok(spend.jobs[draftId] > 0)
      assert.equal(spend.total, spend.jobs[draftId])
      assert.equal(Object.keys(spend.users.student.chapters).length, 2)
      assert.deepEqual([...new Set(provider.calls.map(c => c.jobKey))], [draftId])
      assert.deepEqual([...new Set(provider.calls.map(c => c.versionId))], [f.version.id])
      assert.equal(provider.calls.every(c => c.billing.maxJobUsd === billing.maxJobUsd && c.billing.model === billing.model), true)
    })
  } finally { await f.cleanup() }
})

test('hosted work is refused for a managed guide and is never dispatched to one', async () => {
  const f = await fixture()
  try {
    await f.run(async () => {
      const ledger = jobLedger(), provider = hostedProvider(f.version.id, ledger)
      let version = f.version
      for (let i = 0; i < 90 && !['complete', 'failed', 'stopped'].includes(version.draft.status); i++)
        version = await step(f.version.id, provider.generate)
      assert.equal(version.draft.status, 'complete', version.draft.error || '')
      const child = (await listOwnStudyVersions(course.courseCode))[0]
      // Even a hand-forced queue status cannot make a child hosted work.
      await mutateStudyVersion(child.id, next => { next.draft = { ...next.draft, status: 'queued', execution: 'hosted', runAfter: 0 } })
      assert.equal((await pendingStudyVersions()).some(row => row.key === child.id), false)
      assert.equal((await claimStudyDispatch()).includes(child.id), false)
      assert.deepEqual(await processStudyStep(child.id, { generate: async () => { throw new Error('a managed guide must not call a model') } }),
        { again: false, managedBy: f.version.id })
    })
  } finally { await f.cleanup() }
})
