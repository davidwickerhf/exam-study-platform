// The administration surface's rules, tested where they run.
//
// The queue is the part that is quietly wrong when it looks right: an edition
// with nothing left to do must not appear in it, and an ordering by name
// rather than by urgency puts the least pressing decision at the top.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  attentionQueue,
  coverageRows,
  editionStage,
  isOpenRequest,
  openRequests,
  releaseCounters
} from '../lib/v2/admin.mjs'

const edition = (id, counts = {}, extra = {}) => ({
  id,
  canonicalCourseId: id,
  courseCode: id.toUpperCase(),
  courseName: `Course ${id}`,
  status: 'draft',
  counts: { sources: 0, acceptedSources: 0, pendingJobs: 0, reviewArtifacts: 0, approvedArtifacts: 0, ...counts },
  ...extra
})

test('an edition reports the one thing that moves it next', () => {
  assert.deepEqual(editionStage(edition('a')), { id: 'sources', label: 'No sources', next: 'Add the course sources' })
  assert.equal(editionStage(edition('a', { sources: 3 })).id, 'rights')
  assert.equal(editionStage(edition('a', { sources: 3, acceptedSources: 2 })).id, 'drafting')
  assert.equal(editionStage(edition('a', { sources: 3, acceptedSources: 2, approvedArtifacts: 4 })).id, 'ready')
  // Reviewing drafts outranks publishing approved ones, and a queued job
  // outranks both: approving a draft that is about to be regenerated is work
  // thrown away.
  assert.equal(editionStage(edition('a', { approvedArtifacts: 4, reviewArtifacts: 1 })).id, 'review')
  assert.equal(editionStage(edition('a', { reviewArtifacts: 1, pendingJobs: 2 })).label, '2 queued')
  // A published edition is finished whatever its counters say.
  assert.equal(editionStage(edition('a', { reviewArtifacts: 9 }, { status: 'active' })).next, null)
})

test('a request is open until it is published or closed', () => {
  assert.equal(isOpenRequest({ status: 'submitted' }), true)
  assert.equal(isOpenRequest({ status: 'in-progress' }), true)
  assert.equal(isOpenRequest({ status: 'review' }), true)
  assert.equal(isOpenRequest({ status: 'published' }), false)
  assert.equal(isOpenRequest({ status: 'declined' }), false)
  assert.equal(openRequests([{ status: 'submitted' }, { status: 'declined' }]).length, 1)
})

test('the queue holds only what still needs a decision, most urgent first', () => {
  const queue = attentionQueue({
    editions: [
      edition('bio', { sources: 2, acceptedSources: 2, approvedArtifacts: 1 }),
      edition('law', { sources: 1 }),
      edition('mat', { reviewArtifacts: 3 }),
      // Published: no next step, so it is not waiting on anyone.
      edition('fin', { approvedArtifacts: 2 }, { status: 'active' })
    ],
    requests: [{ status: 'submitted' }, { status: 'published' }]
  })
  assert.deepEqual(queue.map((item) => item.id), ['requests', 'edition:mat', 'edition:law', 'edition:bio'])
  assert.equal(queue.every((item) => item.detail), true)
  assert.equal(queue[1].href, '/v2/admin?tab=production&edition=mat')
  // Each source may be absent without the other becoming wrong.
  assert.deepEqual(attentionQueue({}), [])
  assert.equal(attentionQueue({ requests: [{ status: 'submitted' }] }).length, 1)
})

test('a counter the server did not report is unknown, not zero', () => {
  const counters = releaseCounters({ writable: true, counts: { courses: 5, chapters: 40 } })
  assert.equal(counters.find((entry) => entry.key === 'courses')?.value, 5)
  // Printing 0 for a counter the release query did not return would claim the
  // release contains no questions at all.
  assert.equal(counters.find((entry) => entry.key === 'questions')?.value, null)
  assert.equal(releaseCounters(null).every((entry) => entry.value === null), true)
})

test('coverage joins onto course names and refuses to call an empty course complete', () => {
  const rows = coverageRows(
    { totalPending: 5, totalSteps: 20, courses: { bio: { total: 12, pending: 3 }, law: { total: 8, pending: 2 }, new: { total: 0, pending: 0 } } },
    [{ id: 'bio', code: 'BIO1001', name: 'Biology' }, { id: 'law', code: 'LAW1001', name: 'Law' }]
  )
  assert.deepEqual(rows.map((row) => row.id), ['bio', 'law', 'new'])
  assert.equal(rows[0].done, 9)
  assert.equal(rows[0].percent, 75)
  assert.equal(rows[0].name, 'Biology')
  // A course with no planned steps has unknown coverage. 100% would announce
  // that a course nobody has set up is finished.
  assert.equal(rows[2].percent, null)
  // A course missing from /api/courses still appears, under its own id.
  assert.equal(rows[2].code, 'new')
  assert.deepEqual(coverageRows(null, null), [])
})
