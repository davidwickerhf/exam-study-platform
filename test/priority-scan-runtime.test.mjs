import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {priorityBatchCache,priorityBatchKey,priorityModelCall} from '../lib/priority-scan-runtime.mjs'
import {currentUserId,withRequestContext} from '../lib/request-context.mjs'
import {deleteDocument,readDocument} from '../lib/user-store.mjs'

test('priority cache is private, versioned, content-sensitive and bounded',async()=>{
  const owner=`priority-${randomUUID()}`,other=`priority-${randomUUID()}`,binding='test-binding'
  try {
    const cache=priorityBatchCache(owner,binding)
    for (let i=0;i<65;i++) await cache.save(`batch-${i}`,{status:'not-found'})
    assert.equal(await cache.load('batch-0'),null)
    assert.equal((await cache.load('batch-64')).status,'not-found')
    assert.equal(await priorityBatchCache(other,binding).load('batch-64'),null)
    assert.equal(Object.keys((await withRequestContext({userId:owner},()=>readDocument('priority-evidence-cache',binding,null))).batches).length,64)
    assert.notEqual(priorityBatchKey(3,[{text:'A'}]),priorityBatchKey(4,[{text:'A'}]))
    assert.notEqual(priorityBatchKey(4,[{text:'A'}]),priorityBatchKey(4,[{text:'B'}]))
  } finally {await withRequestContext({userId:owner},()=>deleteDocument('priority-evidence-cache',binding))}
})
test('background priority calls use owner-scoped platform budget and actual provider usage',async()=>{
  let calls=0
  const generate=priorityModelCall('owner','binding','evidence-v1',{
    settings:async()=>({model:'gpt-5-mini',baseUrl:'https://api.openai.com/v1'}),available:()=>true,
    modelCall:async()=>({message:{content:'{"status":"not-found"}'},usage:{prompt_tokens:12,completion_tokens:4}}),
    budgetCall:async(prompt,options,control)=>{
      calls++
      assert.equal(currentUserId(),'owner')
      assert.equal(control.billing.source,'platform')
      assert.equal(control.billing.maxJobUsd,0.2)
      assert.equal(control.jobKey,'priority:binding:evidence-v1')
      assert.equal(control.callPersonal,undefined)
      const result=await control.callPlatform()
      assert.deepEqual(result.usage,{inputTokens:12,outputTokens:4})
      return result.text
    }
  })
  assert.equal((await generate([{role:'user',content:'Extract obligations'}],{maxOutputTokens:7000})).message.content,'{"status":"not-found"}')
  assert.equal(calls,1)
  await assert.rejects(priorityModelCall('owner','binding','evidence-v1',{settings:async()=>({baseUrl:'https://unpriced.test'})})([],{}),/priced first-party/)
})
