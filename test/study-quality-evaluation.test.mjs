import { evaluationStep } from '../lib/study-evaluation-steps.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, listDocuments, deleteDocument } from '../lib/user-store.mjs'
import { studyVersionApi } from '../lib/study-version-api.mjs'
import { addStudyNote } from '../lib/study-version-sources.mjs'
import { runBudgetedStudyCall } from '../lib/study-ai-budget.mjs'
import { lesson, course, teachingPlan, teachingResponse, pedagogicalReview } from '../scripts/verification/study-fixtures.mjs'

import { teachingSchema, reviewSchema, studyResponseSchema } from '../lib/study-version-content.mjs'

const platform = { configured: true, provider: 'openai', model: 'gpt-5-mini' }
async function fixture(fn) {
  return withRequestContext({ userId: `evaluation-test-${randomUUID()}`, mode: 'local' }, async () => {
    try { await fn() } finally { await deleteAllDocuments() }
  })
}
const api = (pathname, method, body, extra = {}) => studyVersionApi({ pathname, method, body, platform, ...extra })
const start = (body = {}) => api('/api/study-versions/evaluations', 'POST', body).then(r => r.data)
const step = (r, generateEvaluation) => api(`/api/study-versions/evaluations/${r.id}/step`, 'POST', { revision: r.revision }, { generateEvaluation }).then(r => r.data)
const planned = () => ({text: JSON.stringify(teachingPlan(['e-current']))})
const generated = (ids = ['e-current']) => ({ text: JSON.stringify(lesson(ids)), usage: { inputTokens: 800, outputTokens: 1500, estimated: false } })

test('browser evaluation runs generation, independent review and corruption checks without creating queue jobs', () => fixture(async () => {
  let row = await start(), calls = 0
  const generate = async (prompt, options) => {
    assert.equal(options.billing.maxJobUsd, 0.25)
    assert.equal(options.jobKey, row.id)
    const spec = evaluationStep(row)
    assert.deepEqual(options.responseSchema, spec.responseSchema || studyResponseSchema(spec.schema, row.snapshot.chunks.map(c => c.id)))
    if (row.stage >= 2) assert.equal(options.reasoningEffort, 'medium')
    calls++
    if (row.stage === 0) return planned()
    if (row.stage === 1) return generated()
    if (row.stage === 2) return { text: JSON.stringify(teachingResponse(prompt, ['e-current'])) }
    if ([3,5,6].includes(row.stage)) return {text: JSON.stringify(pedagogicalReview(spec.pedagogical.chapter, {shallow:row.stage === 6}))}
    return { text: JSON.stringify(teachingResponse(prompt, ['e-current'], {reviewIssues: [
      { topicId: 'probability', severity: 'error', detail: 'Even probability is 1/2, not 2/3.' },
      { topicId: 'probability', severity: 'error', detail: 'Historical exam rules are not current: use 120 minutes closed book.' },
        { topicId:'probability', severity:'error', detail:'The visual includes odd face 1 in the even set; its membership is incorrect.' },
        { topicId:'probability',severity:'error',detail:'The intersection range needs lower bound 0.2 because the union cannot exceed one.' }
    ] })) }
  }
  for (let i = 0; i < 50 && row.status === 'pending'; i++) row = await step(row, generate)
  assert.equal(row.status, 'complete')
  assert.equal(row.checks.length, 7)
  assert.ok(row.checks.every(c => c.passed))
  assert.equal(row.calls.length, 13)
  assert.equal(row.calls[1].chargedUsd, 0.0032)
  assert.equal((await listDocuments('study-versions')).length, 0)
  assert.equal(row.billing.credentialRevision, undefined)
  await step(row, generate)
  assert.equal(calls, 13)
}))

test('duplicate delivery and stale revisions cannot trigger another paid model call', () => fixture(async () => {
  const original = await start()
  let calls = 0, release
  const gate = new Promise(resolve => { release = resolve })
  const generate = async () => { calls++; await gate; return planned() }
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

test('a pre-provider concurrency rejection preserves evaluation results and can resume without duplicate generation', () => fixture(async () => {
  const { StudyBudgetError } = await import('../lib/study-ai-budget.mjs')
  let row = await step(await start(), async () => planned())
  row = await step(row, async () => generated())
  row = await step(row, async () => { throw new StudyBudgetError('Another chapter is generating on your account. This job will continue shortly.', 30) })
  assert.equal(row.status, 'pending')
  assert.equal(row.stage, 2)
  assert.equal(row.calls.length, 2)
  assert.equal(row.checks.length, 2)
  assert.match(row.error, /No AI call was started/)
  row = await step(row, async prompt => ({text:JSON.stringify(teachingResponse(prompt,['e-current']))}))
  assert.equal(row.stage, 2)
  assert.ok(Object.keys(row.generated.factualAudit.solutions).length)
  assert.equal(row.error, undefined)
  assert.equal(row.calls.length, 3)
}))

test('rechecking preserves the exact artifact and prior failures without another generation call', () => fixture(async () => {
  const plannedRow = await step(await start(), async () => planned())
  const original = await step(plannedRow, async () => generated())
  const reviewed = await step(original, async () => ({ text: JSON.stringify({ issues: [{ topicId:'probability', severity:'error', detail:'A reviewer finding to preserve for audit.' }] }) }))
  const next = (await api(`/api/study-versions/evaluations/${reviewed.id}/recheck`, 'POST', { revision:reviewed.revision })).data
  assert.notEqual(next.id, reviewed.id)
  assert.deepEqual(next.generated, reviewed.generated)
  assert.equal(next.reusedFrom, reviewed.id)
  assert.equal(next.stage, 2)
  assert.equal(next.calls.length, 0)
  assert.equal(next.checks.length, 2)
  const old = (await api(`/api/study-versions/evaluations/${reviewed.id}`, 'GET')).data
  assert.deepEqual(old.checks, reviewed.checks)
  assert.deepEqual(old.calls, reviewed.calls)
  const result = await step(next, async prompt => { assert.match(prompt, /INDEPENDENT QUESTION SOLVING/); return { text:JSON.stringify(teachingResponse(prompt,['e-current'])) } })
  assert.equal(result.stage, 2)
  assert.equal(result.calls.length, 1)
  await assert.rejects(api(`/api/study-versions/evaluations/${reviewed.id}/recheck`, 'POST', {revision:original.revision}), /current check/)
}))
