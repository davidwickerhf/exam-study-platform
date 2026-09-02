import test from 'node:test'
import assert from 'node:assert/strict'
import { currentRequest, requestPayload, stageState, validateRequestFiles } from '../lib/v2/course-request.mjs'

test('request files enforce type, per-file, count, total and duplicate rules', () => {
  assert.equal(validateRequestFiles([], [{ name: 'notes.pdf', size: 10 }]).length, 1)
  assert.equal(validateRequestFiles([{ name: 'notes.pdf', size: 10 }], [{ name: 'notes.pdf', size: 10 }]).length, 1)
  assert.throws(() => validateRequestFiles([], [{ name: 'bad.exe', size: 10 }]), /Unsupported/)
  assert.throws(() => validateRequestFiles([], [{ name: 'large.pdf', size: 11 * 1024 * 1024 }]), /larger than 10 MB/)
  assert.throws(() => validateRequestFiles([], Array.from({ length: 9 }, (_, i) => ({ name: `${i}.pdf`, size: 1 }))), /at most 8/)
})
test('payload validates links and consent while keeping private requests private', () => {
  const payload = requestPayload({ course: { id: 'c', period: 'P2' }, categories: ['slides', 'slides'], urls: 'https://example.edu/a\nhttps://example.edu/a', notes: ' hi ', files: [{}] })
  assert.deepEqual(payload.urls, ['https://example.edu/a']); assert.deepEqual(payload.categories, ['slides']); assert.equal(payload.contributionLicense, ''); assert.equal(payload.expectsFiles, true)
  assert.throws(() => requestPayload({ course: { id: 'c' }, urls: 'javascript:alert(1)' }), /http or https/)
  assert.throws(() => requestPayload({ course: { id: 'c' }, consent: true }), /Choose why/)
})
test('active request and ingestion marks are honest', () => {
  assert.equal(currentRequest([{ id: 'old', status: 'declined' }, { id: 'live', status: 'review' }]).id, 'live')
  assert.deepEqual(stageState([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { pipelineStage: 'b', status: 'review' }).map(x => x.state), ['complete', 'current', 'waiting'])
})
