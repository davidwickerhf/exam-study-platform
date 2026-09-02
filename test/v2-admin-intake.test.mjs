import test from 'node:test'
import assert from 'node:assert/strict'
import { canPrepareRequest, intakeCounts, intakeDraft, intakePayload, replaceRequest } from '../lib/v2/admin-intake.mjs'

const stages = [{ id: 'triage' }, { id: 'rights' }]

test('draft reads only the editable workflow fields', () => {
  assert.deepEqual(intakeDraft({ status: 'review', pipelineStage: 'rights', adminNote: 'Check citations', private: 'held' }), {
    status: 'review', pipelineStage: 'rights', adminNote: 'Check citations'
  })
})

test('payload validates status and server-provided stage and bounds the note', () => {
  assert.deepEqual(intakePayload({ status: 'in-progress', pipelineStage: 'rights', adminNote: '  accepted  ' }, stages), {
    status: 'in-progress', pipelineStage: 'rights', adminNote: 'accepted'
  })
  assert.throws(() => intakePayload({ status: 'deleted', pipelineStage: 'rights', adminNote: '' }, stages), /valid request status/)
  assert.throws(() => intakePayload({ status: 'review', pipelineStage: 'invented', adminNote: '' }, stages), /valid workflow stage/)
  assert.equal(intakePayload({ status: 'review', pipelineStage: 'rights', adminNote: 'x'.repeat(5000) }, stages).adminNote.length, 4000)
})

test('a shared draft can only be prepared from an open consenting request without an edition', () => {
  assert.equal(canPrepareRequest({ contributionConsent: true, editionId: null, status: 'submitted' }), true)
  assert.equal(canPrepareRequest({ contributionConsent: false, editionId: null, status: 'submitted' }), false)
  assert.equal(canPrepareRequest({ contributionConsent: true, editionId: 'edition-1', status: 'submitted' }), false)
  assert.equal(canPrepareRequest({ contributionConsent: true, editionId: null, status: 'declined' }), false)
})

test('saving replaces exactly one request and leaves the source array alone', () => {
  const original = [{ id: 'a', status: 'submitted' }, { id: 'b', status: 'review' }]
  const next = replaceRequest(original, { id: 'a', status: 'in-progress' })
  assert.deepEqual(next.map((item) => item.status), ['in-progress', 'review'])
  assert.equal(next[1], original[1])
  assert.equal(original[0].status, 'submitted')
})

test('published and declined requests are closed', () => {
  assert.deepEqual(intakeCounts([{ status: 'submitted' }, { status: 'review' }, { status: 'published' }, { status: 'declined' }]), { total: 4, open: 2 })
})
