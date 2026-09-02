import test from 'node:test'
import assert from 'node:assert/strict'
import { artifactEditPayload, canPublish, contributionReviewPayload, pipelineSteps, productionStage } from '../lib/workspace/admin-production.mjs'

const edition = { id: 'ed-1', status: 'draft', courseCode: 'BCS1001' }
const source = (status, extractedAt = null) => ({ contribution: { editionId: 'ed-1', consentStatus: status }, extractedAt })
const ws = (patch = {}) => ({ sources: [], topics: [], artifacts: [], releases: [], jobs: [], ...patch })

test('the production sequence does not skip a publication safety gate', () => {
  assert.equal(productionStage(edition, ws()), 'sources')
  assert.equal(productionStage(edition, ws({ sources: [source('candidate')] })), 'rights')
  assert.equal(productionStage(edition, ws({ sources: [source('accepted')] })), 'extract')
  assert.equal(productionStage(edition, ws({ sources: [source('accepted', 'now')] })), 'map')
  const mapped = { sources: [source('accepted', 'now')], topics: [{ editionId: 'ed-1' }] }
  assert.equal(productionStage(edition, ws(mapped)), 'drafts')
  assert.equal(productionStage(edition, ws({ ...mapped, artifacts: [{ editionId: 'ed-1', status: 'review' }] })), 'review')
  assert.equal(productionStage(edition, ws({ ...mapped, artifacts: [{ editionId: 'ed-1', status: 'approved' }] })), 'publish')
  assert.equal(productionStage({ ...edition, status: 'active' }, ws({ ...mapped, artifacts: [{ editionId: 'ed-1', status: 'approved' }] })), 'live')
})

test('queued draft work keeps an otherwise approved edition in drafts', () => {
  const workspace = ws({ sources: [source('accepted', 'now')], topics: [{ editionId: 'ed-1' }], artifacts: [{ editionId: 'ed-1', status: 'approved' }], jobs: [{ editionId: 'ed-1', type: 'quality', status: 'pending' }] })
  assert.equal(productionStage(edition, workspace), 'drafts')
  assert.equal(pipelineSteps(edition, workspace).find((step) => step.id === 'drafts').done, false)
})

test('publishing requires every gate and the exact course confirmation', () => {
  const ready = ws({ sources: [source('accepted', 'now')], topics: [{ editionId: 'ed-1' }], artifacts: [{ editionId: 'ed-1', status: 'approved' }] })
  assert.equal(canPublish(edition, ready, 'bcs1001'), true)
  assert.equal(canPublish(edition, ready, 'BCS1002'), false)
  assert.equal(canPublish(edition, ws(), 'BCS1001'), false)
})

test('rights decisions produce the reviewed server note', () => {
  assert.match(contributionReviewPayload('accepted').reviewNote, /Rights basis reviewed/)
  assert.throws(() => contributionReviewPayload('candidate'), /accept or reject/)
})

test('editing an artifact parses JSON and returns it to review', () => {
  assert.deepEqual(artifactEditPayload({ title: '  Chapter 1  ', definition: '{"sourceChunkIds":["x"]}' }), {
    title: 'Chapter 1', definition: { sourceChunkIds: ['x'] }, status: 'review', reviewNote: 'Edited in the editorial workspace; approval is required again.'
  })
  assert.throws(() => artifactEditPayload({ title: 'Chapter', definition: '{' }), /not valid JSON/)
  assert.throws(() => artifactEditPayload({ title: '', definition: '{}' }), /needs a title/)
})
