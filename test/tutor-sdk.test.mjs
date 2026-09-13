import test from 'node:test'
import assert from 'node:assert/strict'
import { runTutorSdk } from '../lib/tutor-sdk.mjs'
const tools=[{type:'function',function:{name:'get_source',description:'Read a source',parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}}}]
const completion=(content,tool_calls=[])=>({message:{content,tool_calls},finishReason:tool_calls.length?'tool_calls':'stop',usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})
const call={id:'call-1',type:'function',function:{name:'get_source',arguments:'{"id":"source-1"}'}}
test('actual SDK dispatches source tools, preserves history, grounding, dynamic schemas and usage',async()=>{
  let requests=0,recorded=false;const streamed=[]
  const result=await runTutorSdk({messages:[{role:'user',content:'Read my source'}],tools,
    runTool:async(name,args)=>{assert.equal(name,'get_source');assert.equal(args.id,'source-1');return {evidence:'Source content'}},
    onToolCall:()=>{recorded=true},requiredTools:()=>recorded?[]:['get_source'],responseFormat:()=>({evidence:recorded}),
    modelCall:async(messages,options)=>{
      requests++
      assert.equal(options.responseFormat.evidence,recorded)
      if(requests===1){assert.equal(options.toolChoice,'required');return completion('',[call])}
      assert.equal(messages.at(-1).role,'tool');assert.match(messages.at(-1).content,/Source content/)
      return completion('Grounded answer')
    },reviewAnswer:answer=>answer==='Grounded answer'?null:'Repair',onContent:value=>streamed.push(value)})
  assert.equal(requests,2);assert.deepEqual(streamed,['Grounded answer'])
  assert.deepEqual(result.added.map(m=>m.role),['assistant','tool','assistant'])
  assert.equal(result.added[1].tool_call_id,call.id);assert.equal(result.usage.total_tokens,30)
})
test('rejected drafts never stream or persist and correction is bounded',async()=>{
  let requests=0;const streamed=[]
  const result=await runTutorSdk({messages:[{role:'user',content:'Question'}],modelCall:async messages=>{
    if(++requests===1)return completion('Unsupported answer')
    assert.equal(messages.at(-1).content,'Use the source');return completion('Supported answer')
  },reviewAnswer:answer=>answer.startsWith('Unsupported')?'Use the source':null,onContent:value=>streamed.push(value)})
  assert.deepEqual(streamed,['Supported answer']);assert.deepEqual(result.added.map(m=>m.content),['Supported answer'])
  await assert.rejects(runTutorSdk({messages:[{role:'user',content:'Question'}],modelCall:async()=>completion('Wrong'),reviewAnswer:()=> 'Repair'}),/could not verify/)
})
test('exhaustion forces tools off and unknown calls never execute',async()=>{
  let requests=0,executed=0
  const result=await runTutorSdk({messages:[{role:'user',content:'Question'}],tools,maxRounds:1,runTool:async()=>{executed++;return {}},modelCall:async(_messages,options)=>{
    if(++requests===1)return completion('',[call])
    assert.deepEqual(options.tools,[]);return completion('Gap explained')
  }})
  assert.equal(executed,1);assert.equal(result.exhausted,true)
  await assert.rejects(runTutorSdk({messages:[],tools,runTool:()=>{throw Error('must not execute')},modelCall:async()=>completion('',[{...call,function:{...call.function,name:'write_grade'}}])}),/unexpected tool/)
})
test('aborted turns never execute tools or publish content',async()=>{
  const controller=new AbortController();controller.abort()
  await assert.rejects(runTutorSdk({messages:[],signal:controller.signal,modelCall:()=>{throw Error('must not call')}}),/abort/i)
})
