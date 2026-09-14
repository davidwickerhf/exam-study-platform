import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteAllDocuments} from '../lib/user-store.mjs'
import {aiCallReport} from '../lib/ai-call-store.mjs'
import {callModel} from '../lib/model-loop.mjs'
import {embedTexts} from '../lib/embeddings.mjs'

test('real conversation adapter requests stream usage and rejects its omission',async()=>{
 const userId=`metrics-stream-${randomUUID()}`,original=globalThis.fetch,key=process.env.OPENAI_API_KEY
 process.env.OPENAI_API_KEY='fixture-only'
 try {await withRequestContext({userId},async()=>{
  let calls=0,include=true
  globalThis.fetch=async(_url,options)=>{
   calls++;assert.deepEqual(JSON.parse(options.body).stream_options,{include_usage:true})
   const events=[{choices:[{delta:{content:'Answer'},finish_reason:'stop'}]},...(include?[{choices:[],usage:{prompt_tokens:25,completion_tokens:5,total_tokens:30,prompt_tokens_details:{cached_tokens:10},completion_tokens_details:{reasoning_tokens:2}}}]:[])]
   return new Response(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-request-id':'req-fixture'}})
  }
  const result=await callModel([],{onContent:()=>{},usageFeature:'tutor'});assert.equal(result.usage.total_tokens,30)
  include=false;await assert.rejects(callModel([],{onContent:()=>{}}),e=>e.code==='provider_usage_missing')
  assert.equal(calls,2)
  const report=await aiCallReport();assert.equal(report.totals.calls,2);assert.equal(report.totals.totalTokens,30);assert.equal(report.totals.unknownUsageCalls,1);assert.ok(report.recent.every(e=>e.providerRequestId==='req-fixture'))
 })}finally{globalThis.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;await withRequestContext({userId},deleteAllDocuments)}
})
test('embedding adapter persists input-only usage and rejects missing counts',async()=>{
 const userId=`metrics-embed-${randomUUID()}`,original=globalThis.fetch,key=process.env.OPENAI_API_KEY
 process.env.OPENAI_API_KEY='fixture-only'
 try {await withRequestContext({userId},async()=>{
  let include=true
  globalThis.fetch=async()=>Response.json({data:[{index:0,embedding:Array(1536).fill(0)}],...(include?{usage:{prompt_tokens:8,total_tokens:8}}:{})})
  assert.equal((await embedTexts(['example'])).length,1)
  include=false;await assert.rejects(embedTexts(['example']),e=>e.code==='provider_usage_missing')
  const report=await aiCallReport();assert.equal(report.totals.inputTokens,8);assert.equal(report.totals.outputTokens,0);assert.equal(report.groups.feature[0].key,'search-indexing')
 })}finally{globalThis.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;await withRequestContext({userId},deleteAllDocuments)}
})
