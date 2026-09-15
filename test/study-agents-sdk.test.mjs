import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {runStudyAgentsSdk} from '../lib/study-agents-sdk.mjs'
const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}
async function fixture(handler,work){
 const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening')
 try{await work({apiKey:'test',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'gpt-6-astra',responseSchema:schema,maxOutputTokens:1000})}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
}
const response=()=>({id:'resp_test',object:'response',created_at:1,status:'completed',model:'gpt-6-astra',output:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'{"ok":true}',annotations:[]}]}],usage:{input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:40},output_tokens_details:{reasoning_tokens:10}}})
test('native Responses uses strict output caps and fresh independent contexts',async()=>{
 const requests=[]
 await fixture(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({url:req.url,...JSON.parse(body)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response()))},async options=>{
  const result=await runStudyAgentsSdk('author context',options)
  await runStudyAgentsSdk('review context',options)
  assert.deepEqual(JSON.parse(result.text),{ok:true});assert.equal(result.usage.inputTokens,100);assert.equal(result.usage.cachedInputTokens,40);assert.equal(result.usage.reasoningTokens,10)
 })
 assert.equal(requests.length,2)
 for(const req of requests){assert.equal(req.url,'/v1/responses');assert.equal(req.max_output_tokens,1000);assert.equal(req.store,false);assert.deepEqual(req.prompt_cache_options,{mode:'explicit',ttl:'30m'});assert.equal(req.text.format.strict,true);assert.deepEqual(req.text.format.schema,schema);assert.equal(req.previous_response_id,undefined)}
 assert.doesNotMatch(JSON.stringify(requests[1]),/author context/)
})
test('transient provider failure makes exactly one paid request',async()=>{
 let calls=0
 await fixture((req,res)=>{calls++;res.writeHead(503,{'content-type':'application/json'});res.end('{"error":{"message":"private provider details"}}')},async options=>{
  await assert.rejects(runStudyAgentsSdk('test',options),error=>error.code==='provider_unavailable'&&error.retryable&&!error.message.includes('private'))
 });assert.equal(calls,1)
})
test('incomplete output retains measured usage for settlement',async()=>{
 await fixture((req,res)=>{const data=response();data.status='incomplete';data.incomplete_details={reason:'max_output_tokens'};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))},async options=>{
  await assert.rejects(runStudyAgentsSdk('test',options),error=>error.code==='provider_output_limit' && error.usage?.outputTokens===20)
 })
})

test('caller cancellation stops the native SDK request without retrying',async()=>{
 let calls=0
 const controller=new AbortController()
 await fixture((req,res)=>{calls++;controller.abort()},async options=>{
  const pending=runStudyAgentsSdk('test',{...options,signal:controller.signal})
  await assert.rejects(pending)
 });assert.equal(calls,1)
})


for(const usage of [null,{}, {input_tokens:100}, {input_tokens:'100',output_tokens:20}, {input_tokens:100,output_tokens:-1}])test(`missing or invalid provider counters cannot settle a reservation: ${JSON.stringify(usage)}`,async()=>{
 await fixture((req,res)=>{const data=response();data.usage=usage;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))},async options=>{
  await assert.rejects(runStudyAgentsSdk('test',options),error=>error.code==='provider_missing_usage'&&!error.usage)
 })
})


test('legacy models do not receive unsupported explicit cache options',async()=>{
 let request
 await fixture(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;request=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response()))},async options=>{
  await runStudyAgentsSdk('test',{...options,model:'gpt-5.4'})
 })
 assert.equal(request.prompt_cache_options,undefined)
})
