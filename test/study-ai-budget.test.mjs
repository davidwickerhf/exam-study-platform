import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  reserveStudyLedger,
  settleStudyLedger,
  studyBudgetLimits,
  estimateStudyCall,
  resolveStudyBilling,
  runBudgetedStudyCall
} from '../lib/study-ai-budget.mjs'
import {
  sealAiKey,
  openAiKey,
  updatePersonalAiSettings,
  personalAiSettings,
  removePersonalAiKey
} from '../lib/study-ai-settings.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument } from '../lib/user-store.mjs'
const limits = {
  ...studyBudgetLimits(),
  platformDayUsd: 1,
  platformMonthUsd: 2,
  userDayUsd: 0.5,
  userMonthUsd: 1,
  chaptersDay: 2,
  chaptersMonth: 3,
  tokensDay: 100000,
  requestsMinute: 4
}
const input = {
  now: Date.UTC(2026, 8, 6),
  user: 'a',
  jobKey: 'j',
  source: 'platform',
  model: 'gpt-5-mini',
  estimate: { micros: 200000, inputTokens: 5000, outputTokens: 5000 },
  maxJobUsd: 1,
  chapterKey: 'one'
}
test('spending reservations enforce shared, individual, chapter, token and job caps before calls', () => {
  const a = reserveStudyLedger(null, input, limits)
  assert.throws(
    () => reserveStudyLedger(a.ledger, input, limits),
    /Another chapter/
  )
  const settled = settleStudyLedger(a.ledger, a.reservation.id, null)
  const b = reserveStudyLedger(settled, { ...input, chapterKey: 'two' }, limits)
  const spent = settleStudyLedger(b.ledger, b.reservation.id, null)
  assert.throws(
    () => reserveStudyLedger(spent, { ...input, chapterKey: 'three' }, limits),
    /allowance is used/
  )
  assert.throws(
    () =>
      reserveStudyLedger(
        spent,
        {
          ...input,
          estimate: { ...input.estimate, micros: 1000 },
          chapterKey: 'three'
        },
        limits
      ),
    /chapter allowance/
  )
  assert.throws(
    () =>
      reserveStudyLedger(
        spent,
        {
          ...input,
          user: 'b',
          estimate: { ...input.estimate, micros: 700000 }
        },
        limits
      ),
    /shared generation budget/
  )
  assert.throws(
    () => reserveStudyLedger(null, { ...input, maxJobUsd: 0.1 }, limits),
    /spending cap/
  )
  assert.throws(
    () => reserveStudyLedger(null, input, { ...limits, tokensDay: 1 }),
    /token allowance/
  )
})
test('only measured usage refunds reservations; settlement is idempotent and failures retain their cost', () => {
  const a = reserveStudyLedger(null, input, limits)
  const measured = settleStudyLedger(a.ledger, a.reservation.id, {
    inputTokens: 1000,
    outputTokens: 1000,
    estimated: false
  })
  assert.equal(measured.total, 2250)
  assert.equal(measured.users.a.days['2026-09-06'].tokens, 2000)
  assert.deepEqual(
    settleStudyLedger(measured, a.reservation.id, {
      inputTokens: 0,
      outputTokens: 0
    }),
    measured
  )
  assert.equal(
    settleStudyLedger(a.ledger, a.reservation.id, {
      inputTokens: 1,
      outputTokens: 1,
      estimated: true
    }).total,
    200000
  )
  assert.equal(
    settleStudyLedger(a.ledger, a.reservation.id, null).total,
    200000
  )
})
test('personal billing bypasses included chapter caps but enforces its own monthly cap and rate limits', () => {
  const personal = { ...input, source: 'personal', personalMonthUsd: 0.3 }
  const a = reserveStudyLedger(null, personal, {
    ...limits,
    chaptersDay: 0,
    platformDayUsd: 0
  })
  const ledger = settleStudyLedger(a.ledger, a.reservation.id, null)
  assert.throws(
    () => reserveStudyLedger(ledger, personal, limits),
    /monthly spending limit/
  )
  assert.throws(
    () => reserveStudyLedger(null, personal, { ...limits, requestsMinute: 0 }),
    /per-minute/
  )
  const bounded = estimateStudyCall('🙂'.repeat(100), 50000, 'gpt-5-mini')
  assert.equal(bounded.inputTokens, 2448)
  assert.equal(bounded.outputTokens, 12000)
})
test('BYOK is encrypted, account-bound, redacted, explicitly selected, and never falls back to platform billing', async () => {
  const oldKey = process.env.AI_CONNECTION_ENCRYPTION_KEY
  process.env.AI_CONNECTION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
    'base64'
  )
  const userId = `ai-budget-test-${randomUUID()}`
  try {
    await withRequestContext({ userId, mode: 'local' }, async () => {
      const key = 'test-only-provider-key-not-a-real-secret',
        sealed = sealAiKey(key)
      assert.equal(openAiKey(sealed), key)
      assert.equal(sealed.includes(key), false)
      assert.throws(
        () => openAiKey(sealed, 'another-account'),
        /cannot be read/
      )
      await assert.rejects(
        updatePersonalAiSettings({
          model: 'gpt-5-mini',
          apiKey: key,
          monthlyLimitUsd: 1
        }),
        /Confirm/
      )
      await updatePersonalAiSettings({
        model: 'gpt-5-mini',
        apiKey: key,
        monthlyLimitUsd: 1,
        consent: true
      })
      assert.equal(
        JSON.stringify(await personalAiSettings()).includes(key),
        false
      )
      assert.equal(
        JSON.stringify(
          await readDocument('ai-connection', 'settings')
        ).includes(key),
        false
      )
      const billing = await resolveStudyBilling(
        { billingSource: 'personal', maxJobUsd: 1 },
        { configured: false }
      )
      let calls = 0,
        started,
        release
      const entered = new Promise((r) => (started = r)),
        pending = new Promise((r) => (release = r))
      const config = {
        billing,
        jobKey: 'test-job',
        callPlatform: () => {
          throw new Error('Platform must never be called')
        },
        callPersonal: async (_prompt, opts) => {
          calls++
          assert.equal(opts.apiKey, key)
          started()
          await pending
          return {
            text: 'ok',
            usage: { inputTokens: 10, outputTokens: 10, estimated: false }
          }
        }
      }
      const first = runBudgetedStudyCall('hello', {}, config)
      await entered
      await assert.rejects(
        runBudgetedStudyCall('hello', {}, config),
        /Another chapter/
      )
      release()
      assert.equal(await first, 'ok')
      assert.equal(calls, 1)
      await removePersonalAiKey()
      await assert.rejects(
        runBudgetedStudyCall('hello', {}, config),
        /Connect your own/
      )
      await assert.rejects(
        resolveStudyBilling(
          {},
          { configured: true, provider: 'openai', model: 'unpriced' }
        ),
        /not enabled/
      )
      await deleteAllDocuments()
    })
  } finally {
    if (oldKey === undefined) delete process.env.AI_CONNECTION_ENCRYPTION_KEY
    else process.env.AI_CONNECTION_ENCRYPTION_KEY = oldKey
  }
})

test('quota exemption bypasses usage ceilings while retaining metering and duplicate protection', () => {
  const zero={platformDayUsd:0,platformMonthUsd:0,userDayUsd:0,userMonthUsd:0,chaptersDay:0,chaptersMonth:0,requestsMinute:0,tokensDay:0,personalTokensDay:0,maxJobUsd:0}
  const input={user:'owner',jobKey:'uncapped',source:'platform',model:'gpt-5-mini',estimate:{micros:9000000,inputTokens:2000000,outputTokens:10000},chapterKey:'chapter',maxJobUsd:0,personalMonthUsd:0,quotaExempt:true}
  for (const source of ['platform','personal']) {
    const reserved=reserveStudyLedger(null,{...input,source},zero)
    assert.equal(reserved.ledger.total,9000000)
    assert.equal(reserved.reservation.quotaExempt,true)
    assert.equal(reserved.ledger.users.owner.days[new Date().toISOString().slice(0,10)].chapters,1)
    assert.throws(()=>reserveStudyLedger(reserved.ledger,{...input,source},zero),/Another chapter/)
    assert.throws(()=>reserveStudyLedger(null,{...input,source,quotaExempt:false},zero),/allowance/)
  }
})

test('enhanced generation explicitly selects its priced model without relaxing budget controls', async () => {
  await withRequestContext({ userId: `model-choice-${randomUUID()}`, mode: 'hosted', email: 'student@example.test' }, async () => {
    const platform = { configured: true, provider: 'openai', model: 'gpt-5-mini' }
    assert.equal((await resolveStudyBilling({}, platform)).model, 'gpt-5-mini')
    const enhanced = await resolveStudyBilling({ quality: 'enhanced', maxJobUsd: 0.5 }, platform)
    assert.equal(enhanced.model, 'gpt-5.4')
    assert.equal(enhanced.source, 'platform')
    const mini = estimateStudyCall('Example', 10000, 'gpt-5-mini'), strong = estimateStudyCall('Example', 10000, enhanced.model)
    assert.ok(strong.micros > mini.micros * 7)
    assert.throws(() => reserveStudyLedger(null, { ...input, model: enhanced.model, estimate: strong, maxJobUsd: 0.05 }, limits), /cap|budget|spending/i)
    await assert.rejects(resolveStudyBilling({ quality: 'enhanced' }, { ...platform, provider: 'anthropic' }), /OpenAI/)
    await assert.rejects(resolveStudyBilling({ quality: 'unknown' }, platform), /standard or enhanced/)
  })
})
