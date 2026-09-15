import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {routeStudyModel} from '../lib/study-model-routing.mjs'
import {runBudgetedStudyCall,studyModelCost} from '../lib/study-ai-budget.mjs'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteAllDocuments,readDocument} from '../lib/user-store.mjs'
const billing={source:'platform',provider:'openai',model:'gpt-6-astra',maxJobUsd:1}
const options={billing,generationRuntime:'agents-sdk-responses',maxOutputTokens:100,usageMetadata:{versionId:'sv-test',phase:'source-mapping'}}
const policy={version:1,routes:{'source-mapping':'gpt-5-mini','factual-review':'gpt-5.6-sol'}}
test('routing is opt-in, phase-specific and leaves personal/local and unrelated calls alone',()=>{
 assert.equal(routeStudyModel(billing,options,null),null)
 assert.equal(routeStudyModel({...billing,source:'personal'},options,policy),null)
 assert.equal(routeStudyModel(billing,{...options,usageMetadata:{}},policy),null)
 assert.equal(routeStudyModel(billing,{...options,generationRuntime:undefined},policy),null)
 assert.equal(routeStudyModel(billing,{...options,usageMetadata:{versionId:'sv-test',phase:'pedagogical-review'}},policy),null)
 assert.equal(routeStudyModel(billing,options,policy).model,'gpt-5-mini')
 assert.equal(routeStudyModel(billing,{...options,usageMetadata:{versionId:'sv-test',phase:'factual-solve'}},policy).model,'gpt-5.6-sol')
})
test('unpriced models, provider changes, malformed routes and price escalation fail closed',()=>{
 for(const p of ['not-json',{version:1,routes:{typo:'gpt-5-mini'}},{version:1,routes:{'source-mapping':'unknown'}},{version:1,routes:{'source-mapping':'claude-sonnet-4-5'}}])assert.throws(()=>routeStudyModel(billing,options,p))
 assert.throws(()=>routeStudyModel({...billing,model:'gpt-5-mini'},options,{version:1,routes:{'source-mapping':'gpt-6-astra'}}),/cannot increase/)
})
test('routed call reserves and settles the actual model; exhausted caps still prevent calls',async()=>{
 await withRequestContext({userId:'route-'+randomUUID(),mode:'local'},async()=>{try{
  let called=0;const jobKey='test-route-'+randomUUID();const usage={inputTokens:100,outputTokens:20,estimated:false,cachedInputTokens:0,cacheWriteInputTokens:0}
  const callPlatform=async(prompt,opts)=>{called++;assert.equal(opts.model,'gpt-5-mini');assert.equal(opts.billing.model,'gpt-5-mini');assert.equal(opts.usageMetadata.modelRoute.baseModel,'gpt-6-astra');return {text:'result',usage}}
  assert.equal(await runBudgetedStudyCall('test',options,{billing,jobKey,callPlatform,modelRouting:policy}),'result')
  await assert.rejects(()=>runBudgetedStudyCall('test',options,{billing:{...billing,maxJobUsd:0.000001},jobKey:'blocked-route',callPlatform,modelRouting:policy}))
  assert.equal(called,1)
  await withRequestContext({userId:'wicker-study-platform-budget',mode:'study-budget'},async()=>{
   const ledger=await readDocument('study-ai-platform-budget',new Date().toISOString().slice(0,7),null)
   const reservation=Object.values(ledger.reservations).find(r=>r.jobKey===jobKey)
   assert.equal(reservation.model,'gpt-5-mini');assert.equal(reservation.micros,studyModelCost('gpt-5-mini',100,20,usage))
  })
 }finally{await deleteAllDocuments()}})
})
