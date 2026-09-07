import test from 'node:test'
import assert from 'node:assert/strict'
import { providerFailure, tutorFailure } from '../lib/tutor-errors.mjs'
import { callModel, runToolLoop } from '../lib/model-loop.mjs'
import { readModelStream } from '../lib/model-stream.mjs'
import { tutorStableSystemPrompt, tutorTurnContextPrompt, tutorSystemPrompt } from '../lib/tutor-agent.mjs'
import { visibleTutorConversation } from '../lib/tutor-turns.mjs'
import { TutorStoreError } from '../lib/tutor-store.mjs'
import { tutorStream } from '../lib/workspace/tutor-stream.ts'
import { embedTexts } from '../lib/embeddings.mjs'

const quota = {error:{type:'insufficient_quota',code:'generic_error',message:'You have no credits remaining. private-account-details'}}
test('billing exhaustion is not treated as a transient rate limit, even with a different provider code', () => {
  assert.equal(providerFailure(429, quota).code, 'provider_credits')
  assert.equal(providerFailure(429, quota).retryable, false)
  assert.equal(providerFailure(429, {error:{code:'rate_limit_exceeded'}}).retryable, true)
  assert.equal(providerFailure(429, 'unparseable upstream body').code, 'provider_rate_limit')
  assert.equal(providerFailure(401, {}).code, 'provider_configuration')
  assert.equal(providerFailure(502, {error:{type:'authentication_error'}}).code, 'provider_configuration')
  assert.equal(providerFailure(503, {}).code, 'provider_unavailable')
  assert.equal(tutorFailure(new TutorStoreError('Internal conflict detail',409)).code, 'conversation_changed')
  assert.equal(tutorFailure(new TutorStoreError('Missing',404)).code, 'conversation_missing')
  assert.equal(tutorFailure(new DOMException('deadline','TimeoutError')).code,'timeout')
})
test('legacy saved failures are classified without exposing their original bodies', () => {
  const saved={id:'failed',reply:{status:'failed',error:JSON.stringify(quota)},messages:[{role:'user',content:'Explain agents'}]}
  const visible=visibleTutorConversation(saved)
  assert.equal(visible.reply.failure.code,'provider_credits')
  assert.doesNotMatch(JSON.stringify(visible),/private-account-details|insufficient_quota/)
  assert.equal(visible.messages.length,1)
  assert.equal(saved.reply.error,JSON.stringify(quota))
})
test('static tutor prefix is reusable while every turn retains fresh clock, memory and page context', () => {
  const options={now:new Date('2026-09-07T12:00:00Z'),memory:{facts:[{id:'a',fact:'Monday lab'}]},context:{courseCode:'BCS2120',courseTab:'materials',courseTabLabel:'Materials'}}
  const later={...options,now:new Date('2026-09-08T13:00:00Z'),memory:{facts:[]},context:{courseCode:'KEN2220',courseTab:'exercises',courseTabLabel:'Exercises'}}
  const prefix=tutorStableSystemPrompt()
  assert.ok(tutorSystemPrompt(options).startsWith(prefix))
  assert.ok(tutorSystemPrompt(later).startsWith(prefix))
  assert.doesNotMatch(prefix,/Monday lab|BCS2120|KEN2220|Right now it is/)
  assert.match(tutorTurnContextPrompt(options),/7 September 2026.*14:00/)
  assert.match(tutorTurnContextPrompt(later),/8 September 2026.*15:00/)
  assert.match(tutorTurnContextPrompt(options),/Monday lab|Materials/)
  assert.match(tutorTurnContextPrompt(later),/Exercises/)
  assert.doesNotMatch(tutorTurnContextPrompt(later),/Monday lab/)
  assert.match(prefix,/Call a tool before answering/)
})
test('cached tokens aggregate across tool rounds and the forced final answer without changing total usage', async () => {
  let calls=0
  const result=await runToolLoop({messages:[{role:'user',content:'Explain'}],maxRounds:1,runTool:async()=>({evidence:'Source'}),modelCall:async()=>{
    calls++
    return {message:calls===1?{tool_calls:[{id:'one',function:{name:'read',arguments:'{}'}}]}:{content:'Answer'},usage:{prompt_tokens:2000,completion_tokens:100,total_tokens:2100,prompt_tokens_details:{cached_tokens:calls===1?1024:1536}}}
  }})
  assert.equal(calls,2)
  assert.deepEqual(result.usage,{prompt_tokens:4000,completion_tokens:200,total_tokens:4200,prompt_tokens_details:{cached_tokens:2560}})
  const missing=await runToolLoop({messages:[],modelCall:async()=>({message:{content:'Answer'},usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}})})
  assert.equal(missing.usage.prompt_tokens_details,undefined,'missing cache telemetry is not a measured zero')
})
test('HTTP and streamed provider errors, and both browser response formats, carry only safe failure details',async()=>{
  const original=globalThis.fetch, key=process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY='test-placeholder'
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify(quota),{status:429})
    await assert.rejects(callModel([]),e=>e.code==='provider_credits'&&!e.message.includes('private-account'))
    await assert.rejects(readModelStream(new Response(`data: ${JSON.stringify(quota)}\n\n`),()=>{}),e=>e.code==='provider_credits')
    for(const streaming of [true,false]){
      const failure=providerFailure(429,quota), payload={error:'raw private-account-details',failure}
      globalThis.fetch=async()=>new Response(JSON.stringify(streaming?{type:'error',...payload}:payload)+(streaming?'\n':''),{status:streaming?200:429,headers:{'content-type':streaming?'application/x-ndjson':'application/json'}})
      await assert.rejects(tutorStream('/api/tutor',{},()=>{}),e=>e.failure.code==='provider_credits'&&!e.message.includes('private-account'))
    }
    const usage={prompt_tokens:2048,prompt_tokens_details:{cached_tokens:1024}}
    const frames=[{choices:[{delta:{content:'Answer'},finish_reason:'stop'}]},{choices:[],usage}]
    const result=await readModelStream(new Response(frames.map(x=>`data: ${JSON.stringify(x)}\n\n`).join('')),()=>{})
    assert.deepEqual(result.usage,usage)
  } finally {globalThis.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key}
})
test('embedding billing failures stop retries without deleting work, while temporary throttling stays retryable',async()=>{
  const original=globalThis.fetch,key=process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY='test-placeholder'
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify(quota),{status:429})
    await assert.rejects(embedTexts(['Graph theory']),e=>{
      assert.equal(e.retryable,false);assert.equal(e.blockedReason,'provider_credits')
      assert.match(e.message,/Materials already saved are retained/)
      assert.doesNotMatch(e.message,/private-account|Reconnect Canvas/)
      return true
    })
    globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429})
    await assert.rejects(embedTexts(['Graph theory']),e=>e.retryable===true&&e.blockedReason===null)
  }finally{globalThis.fetch=original;if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key}
})
