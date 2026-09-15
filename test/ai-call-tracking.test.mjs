import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { normalizeCallUsage, callCost, aggregateCallEvents } from '../lib/ai-call-metrics.mjs'
import { trackAiCall, withAiCallContext, trackedJsonFetch } from '../lib/ai-call-tracking.mjs'
import { aiCallReport, saveAiCallEvent } from '../lib/ai-call-store.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
const raw={input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:40,cache_write_tokens:10},output_tokens_details:{reasoning_tokens:12}}
test('normalizes provider counts without double-counting cached and reasoning tokens',()=>{
 const u=normalizeCallUsage(raw);assert.equal(u.totalTokens,120);assert.equal(u.reasoningTokens,12);assert.equal(u.cachedInputTokens,40)
 assert.equal(normalizeCallUsage({input_tokens:50,cache_read_input_tokens:40,cache_creation_input_tokens:10,output_tokens:20},'anthropic').totalTokens,120)
 assert.equal(normalizeCallUsage({prompt_tokens:0},'openai','embeddings').totalTokens,0)
 assert.equal(normalizeCallUsage({input_tokens:-1,output_tokens:20}).usageStatus,'unavailable')
 assert.equal(normalizeCallUsage({input_tokens:100,output_tokens:0}).usageStatus,'reported')
 assert.equal(callCost('gpt-6-astra',u).estimatedCostUsd,.001665)
 assert.equal(callCost('unknown-model',u).estimatedCostUsd,null)
 assert.equal(callCost('gpt-6-astra',normalizeCallUsage({...raw,input_tokens_details:{cached_tokens:0}})).estimatedCostUsd,null)
 assert.equal(callCost('gpt-6-astra',u,{serviceTier:'priority'}).estimatedCostUsd,null)
})
test('one durable event per attempt, with isolated user/context and no prompt leakage',async()=>{
 const saved=[];const save=async e=>saved.push(structuredClone(e))
 await Promise.all(['alice','bob'].map(userId=>withRequestContext({userId},()=>withAiCallContext({feature:'study-generation',phase:userId,payer:'personal'},()=>trackAiCall({provider:'openai',model:'gpt-6-astra'},async observe=>{observe({id:'resp_test',usage:raw});return 'secret lesson'}, {save})))))
 assert.equal(saved.length,4);assert.equal(new Set(saved.map(e=>e.id)).size,2)
 for(const id of ['alice','bob']){const rows=saved.filter(e=>e.userId===id);assert.equal(rows[0].status,'pending');assert.equal(rows[1].status,'completed');assert.equal(rows[1].phase,id);assert.equal(rows[1].payer,'personal')}
 assert.ok(!JSON.stringify(saved).includes('secret lesson'))
})
test('missing counts fail acceptance without retrying and remain explicitly unpriced',async()=>{
 const saved=[];let calls=0
 await assert.rejects(trackAiCall({provider:'openai',model:'gpt-5-mini'},async()=>{calls++;return {usage:null}}, {save:async e=>saved.push(structuredClone(e))}),e=>e.code==='provider_usage_missing'&&e.retryable===false)
 assert.equal(calls,1);assert.equal(saved.at(-1).status,'failed');assert.equal(saved.at(-1).inputTokens,null);assert.equal(saved.at(-1).estimatedCostUsd,null)
})
test('failed parsing preserves reported usage and settlement failure cannot trigger a paid retry',async()=>{
 let calls=0, writes=0;const error=new Error('parse failed')
 await assert.rejects(trackAiCall({provider:'openai',model:'gpt-5-mini'},async observe=>{calls++;observe({usage:raw});throw error},{save:async()=>{if(++writes===2)throw new Error('db unavailable')}}),e=>e===error&&e.usage.inputTokens===100)
 assert.equal(calls,1)
})
test('global reporting requires admin and personal reporting cannot be widened',async()=>{
 const userId=`usage-${randomUUID()}`,other=`usage-${randomUUID()}`,createdAt=new Date().toISOString()
 const event={id:randomUUID(),userId,createdAt,feature:'tutor',model:'gpt-5-mini',payer:'platform',phase:'answer',status:'completed',...normalizeCallUsage(raw),estimatedCostUsd:.01,durationMs:20}
 try{
  await saveAiCallEvent(event);await saveAiCallEvent(event) // idempotent
  await saveAiCallEvent({...event,id:randomUUID(),userId:other,estimatedCostUsd:10})
  await withRequestContext({userId},async()=>{
   const own=await aiCallReport({userId:other});assert.equal(own.totals.calls,1);assert.equal(own.totals.estimatedCostUsd,.01)
   await assert.rejects(aiCallReport({}, {global:true}),e=>e.status===403)
   await assert.rejects(aiCallReport({from:'2026-01-01',to:'2026-12-31'}),e=>e.status===400)
  })
  await withRequestContext({userId,admin:true},async()=>{const report=await aiCallReport({userId:other},{global:true});assert.equal(report.totals.estimatedCostUsd,10);assert.equal(report.groups.day.length,30)})
  await withRequestContext({userId,admin:true,mode:'api-key',scopes:['read']},()=>assert.rejects(aiCallReport({}, {global:true}),e=>e.status===403))
 }finally{await withRequestContext({userId},deleteAllDocuments);await withRequestContext({userId:other},deleteAllDocuments)}
})
test('aggregate cost never silently treats unknown usage as a measured zero',()=>{
 const rows=aggregateCallEvents([{createdAt:new Date().toISOString(),status:'failed',usageStatus:'unavailable',inputTokens:null,outputTokens:null,estimatedCostUsd:null}])
 const total=rows.find(r=>r.dimension==='total');assert.equal(total.calls,1);assert.equal(total.unknownUsageCalls,1);assert.equal(total.unpricedCalls,1)
})
