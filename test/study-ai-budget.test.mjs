import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  reserveStudyLedger,
  settleStudyLedger,
  studyBudgetLimits,
  estimateStudyCall,
  studyModelCost,
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
  assert.equal(bounded.outputTokens, 50000)
  assert.equal(estimateStudyCall('Deep lesson', 64000, 'gpt-5-mini').outputTokens, 64000)
  assert.equal(estimateStudyCall('Deep lesson', 100000, 'gpt-5-mini').outputTokens, 64000)
  assert.equal(estimateStudyCall('Deep lesson', 20000, 'gpt-5-mini').outputTokens, 20000)
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
          assert.equal(opts.maxOutputTokens, 64000)
          started()
          await pending
          return {
            text: 'ok',
            usage: { inputTokens: 10, outputTokens: 10, estimated: false }
          }
        }
      }
      const first = runBudgetedStudyCall('hello', {maxOutputTokens:64000}, config)
      await entered
      await assert.rejects(
        runBudgetedStudyCall('hello', {}, config),
        /Another chapter/
      )
      release()
      assert.equal(await first, 'ok')
      assert.equal(calls, 1)
      const month=new Date().toISOString().slice(0,7)
      const beforeFailure=await readDocument('study-ai-personal-budget',month)
      const incomplete=Object.assign(new Error('incomplete'),{usage:{inputTokens:10,outputTokens:10,estimated:false}})
      await assert.rejects(runBudgetedStudyCall('hello',{maxOutputTokens:64000},{...config,callPersonal:async()=>{throw incomplete}}),/incomplete/)
      const afterFailure=await readDocument('study-ai-personal-budget',month)
      assert.equal(afterFailure.total-beforeFailure.total,studyModelCost(billing.model,10,10))
      // A call abandoned at its own deadline reports no usage at all, so it
      // settles exactly like any other unknown-usage failure: the whole
      // reservation stays charged rather than being written off as free.
      const timedOut=Object.assign(new Error('deadline'),{name:'TimeoutError',code:'provider_timeout',retryable:true})
      await assert.rejects(runBudgetedStudyCall('hello',{maxOutputTokens:64000},{...config,callPersonal:async()=>{throw timedOut}}),/deadline/)
      const afterTimeout=await readDocument('study-ai-personal-budget',month)
      assert.ok(afterTimeout.total-afterFailure.total>studyModelCost(billing.model,10,10),'an abandoned call retains its full reservation')
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

test('quota exemption preserves the job cap, metering and duplicate protection', () => {
  const zero={platformDayUsd:0,platformMonthUsd:0,userDayUsd:0,userMonthUsd:0,chaptersDay:0,chaptersMonth:0,requestsMinute:0,tokensDay:0,personalTokensDay:0,maxJobUsd:0}
  const input={user:'owner',jobKey:'uncapped',source:'platform',model:'gpt-5-mini',estimate:{micros:9000000,inputTokens:2000000,outputTokens:10000},chapterKey:'chapter',maxJobUsd:10,personalMonthUsd:0,quotaExempt:true}
  for (const source of ['platform','personal']) {
    assert.throws(()=>reserveStudyLedger(null,{...input,source,maxJobUsd:1},zero),/spending cap/)
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
    await assert.rejects(resolveStudyBilling({ quality: 'unknown' }, platform), /standard, enhanced/)
  })
})


test('Sol and Astra preserve explicit model selection and reserve current long-context/cache-write prices',async()=>{
  await withRequestContext({userId:`modern-model-${randomUUID()}`,mode:'hosted',email:'student@example.test'},async()=>{
    const platform={configured:true,provider:'openai',model:'gpt-5-mini'}
    for(const [quality,model] of [['sol','gpt-5.6-sol'],['astra','gpt-6-astra']]){
      const billing=await resolveStudyBilling({quality,maxJobUsd:5},platform)
      assert.equal(billing.model,model)
      assert.equal(billing.maxJobUsd,5)
      const estimate=estimateStudyCall('Complete lesson',64000,model)
      assert.equal(estimate.outputTokens,64000)
      assert.throws(()=>reserveStudyLedger(null,{...input,model,estimate,maxJobUsd:0.05},limits),/cap|budget|spending/i)
      await assert.rejects(resolveStudyBilling({quality},{...platform,provider:'anthropic'}),/OpenAI/)
    }
    assert.equal(studyModelCost('gpt-5.6-sol',1000,1000),25000)
    assert.equal(studyModelCost('gpt-6-sol',1000,1000),12500)
    assert.equal(studyModelCost('gpt-6-astra',1000,1000),62500)
    assert.equal(studyModelCost('gpt-6-sol',1000,1000,{cachedInputTokens:500,cacheWriteInputTokens:200}),11200)
    assert.equal(studyModelCost('gpt-6-astra',1000,1000,{cachedInputTokens:500,cacheWriteInputTokens:200}),56000)
    assert.equal(studyModelCost('gpt-5.6-sol',300000,1000),3030000)
    assert.equal(studyModelCost('gpt-6-sol',300000,1000),1515000)
    assert.equal(studyModelCost('gpt-6-astra',300000,1000),7575000)
  })
})

test('paid-call reservation remains exclusive beyond the old five-minute lease',()=>{
  const first=reserveStudyLedger(null,input,limits)
  assert.throws(()=>reserveStudyLedger(first.ledger,{...input,now:input.now+360000},limits),/Another chapter/)
})

test('guide defaults use GPT-6 Sol without rerouting assessments or changing an existing job',async()=>{
  const {resolveGuideBilling}=await import('../lib/study-ai-budget.mjs')
  const userId=`guide-routing-${randomUUID()}`
  await withRequestContext({userId,mode:'hosted',email:'student@example.test'},async()=>{
    try{
      const platform={configured:true,provider:'openai',model:'gpt-5-mini'}
      assert.equal((await resolveGuideBilling({},platform)).model,'gpt-6-sol')
      assert.equal((await resolveStudyBilling({},platform)).model,'gpt-5-mini')
      const existing={source:'platform',model:'gpt-5.6-sol',maxJobUsd:0.75}
      const resumed=await resolveGuideBilling({},platform,existing)
      assert.equal(resumed.model,existing.model)
      assert.equal(resumed.maxJobUsd,existing.maxJobUsd)
      assert.equal((await resolveGuideBilling({quality:'astra'},platform,existing)).model,'gpt-6-astra')
      assert.equal((await resolveGuideBilling({quality:'standard'},platform)).model,'gpt-6-sol')
      await assert.rejects(resolveGuideBilling({source:'personal'},platform),/key|connect|configured/i)
    }finally{await deleteAllDocuments()}
  })
})
