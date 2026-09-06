import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, listDocuments, deleteDocument } from '../lib/user-store.mjs'
import { studyVersionApi } from '../lib/study-version-api.mjs'
import { addStudyNote } from '../lib/study-version-sources.mjs'
import { runBudgetedStudyCall } from '../lib/study-ai-budget.mjs'
import { lesson, course } from '../scripts/verification/study-fixtures.mjs'

import { lessonSchema, reviewSchema, studyResponseSchema } from '../lib/study-version-content.mjs'

const platform = { configured: true, provider: 'openai', model: 'gpt-5-mini' }
async function fixture(fn) {
  return withRequestContext({ userId: `evaluation-test-${randomUUID()}`, mode: 'local' }, async () => {
    try { await fn() } finally { await deleteAllDocuments() }
  })
}
const api = (pathname, method, body, extra = {}) => studyVersionApi({ pathname, method, body, platform, ...extra })
const start = (body = {}) => api('/api/study-versions/evaluations', 'POST', body).then(r => r.data)
const step = (r, generateEvaluation) => api(`/api/study-versions/evaluations/${r.id}/step`, 'POST', { revision: r.revision }, { generateEvaluation }).then(r => r.data)
const generated = (ids = ['e-current']) => ({ text: JSON.stringify(lesson(ids)), usage: { inputTokens: 800, outputTokens: 1500, estimated: false } })

test('browser evaluation runs generation, independent review and corruption checks without creating queue jobs', () => fixture(async () => {
  let row = await start(), calls = 0
  const generate = async (prompt, options) => {
    assert.equal(options.billing.maxJobUsd, 0.25)
    assert.equal(options.jobKey, row.id)
    assert.deepEqual(options.responseSchema, studyResponseSchema(calls === 0 ? lessonSchema : reviewSchema, row.snapshot.chunks.map(c => c.id)))
    calls++
    if (calls === 1) return generated()
    if (calls === 2) return { text: '{"issues":[]}' }
    assert.match(prompt, /current 2026-2027 exam is 90 minutes/)
    assert.match(prompt, /occupy four of the six faces/)
    return { text: JSON.stringify({ issues: [
      { topicId: 'probability', severity: 'error', detail: 'Even probability is 1/2, not 2/3.' },
      { topicId: 'probability', severity: 'error', detail: 'Historical exam rules are not current: use 120 minutes closed book.' }
    ] }) }
  }
  for (let i = 0; i < 3; i++) row = await step(row, generate)
  assert.equal(row.status, 'complete')
  assert.equal(row.checks.length, 3)
  assert.ok(row.checks.every(c => c.passed))
  assert.equal(row.calls.length, 3)
  assert.equal(row.calls[0].chargedUsd, 0.0032)
  assert.equal((await listDocuments('study-versions')).length, 0)
  assert.equal(row.billing.credentialRevision, undefined)
  await step(row, generate)
  assert.equal(calls, 3)
}))

test('duplicate delivery and stale revisions cannot trigger another paid model call', () => fixture(async () => {
  const original = await start()
  let calls = 0, release
  const gate = new Promise(resolve => { release = resolve })
  const generate = async () => { calls++; await gate; return generated() }
  const first = step(original, generate)
  while (!calls) await new Promise(resolve => setTimeout(resolve, 2))
  const duplicate = await step(original, generate)
  assert.equal(duplicate.status, 'running')
  release()
  const completed = await first
  const repeated = await step(original, generate)
  assert.equal(repeated.revision, completed.revision)
  assert.equal(calls, 1)
}))

test('evaluations enforce owner isolation, browser authentication and hard cap bounds', () => fixture(async () => {
  const row = await start()
  await assert.rejects(withRequestContext({ userId: 'another-evaluation-user', mode: 'local' }, () => api(`/api/study-versions/evaluations/${row.id}`, 'GET')), e => e.status === 404)
  await assert.rejects(withRequestContext({ userId: 'api-user', mode: 'api-key' }, () => start()), e => e.status === 403)
  await assert.rejects(start({ billing: { maxJobUsd: 1.01 } }), /spending cap/)
  await assert.rejects(start({ billing: { maxJobUsd: 0 } }), /spending cap/)
}))

test('real budget wrapper prevents a provider call when an evaluation cannot reserve its maximum cost', () => fixture(async () => {
  const row = await start({ billing: { maxJobUsd: 0.05 } }), huge = 'x'.repeat(200000)
  let calls = 0
  const result = await step(row, async (prompt, options) => {
    const text = await runBudgetedStudyCall(huge + prompt, options, { billing: options.billing, jobKey: options.jobKey,
      callPlatform: async () => { calls++; return generated() }, callPersonal: async () => { throw new Error('No fallback') } })
    return { text }
  })
  assert.equal(calls, 0)
  assert.equal(result.status, 'failed')
  assert.match(result.error, /cap|limit|budget/i)
}))

test('invalid citations and malformed output fail the diagnostic, and provider secrets are redacted', () => fixture(async () => {
  const bad = await step(await start(), async () => generated(['invented-reference']))
  assert.equal(bad.status, 'failed')
  assert.equal(bad.checks.at(-1).passed, false)
  const unavailable = await step(await start(), async () => { throw new Error('provider secret sk-should-not-appear') })
  assert.equal(unavailable.status, 'failed')
  assert.doesNotMatch(JSON.stringify(unavailable), /sk-should-not-appear/)
}))

test('selected-source evaluation remains private and stops when source access is withdrawn', () => fixture(async () => {
  const note = await addStudyNote({ ...course, title: 'Selected evidence' }, [{ page: 1, text: 'Addition combines disjoint quantities.' }])
  const row = await start({ scenario: 'sources', course, sourceKeys: [note.id], topic: 'Addition' })
  assert.equal(row.snapshot.sources.length, 1)
  assert.equal(row.snapshot.sources[0].key, note.id)
  await deleteDocument('study-notes', note.id)
  let calls = 0
  await assert.rejects(step(row, async () => { calls++; return generated() }), e => e.status === 410)
  assert.equal(calls, 0)
}))
