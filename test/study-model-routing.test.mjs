import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {effectiveStudyModelRouting,pedagogicalPrecheckEnabled,questionCorrectionTrial,routeStudyModel,STANDARD_STUDY_MODEL_ROUTES,studyModelPhase,studyPlanPrecheckEnabled} from '../lib/study-model-routing.mjs'
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
test('a repair-triggered whole-chapter rewrite is billed and routed as a correction, while a first draft stays authoring',()=>{
 // The chapters-stage generate call for a genuine first draft never sets an
 // explicit phase; it is derived from options.usageMetadata.stage==='chapters'.
 assert.equal(studyModelPhase({usageMetadata:{stage:'chapters'}}),'authoring')
 // study-version-pipeline.mjs tags a repair-triggered whole-chapter rewrite
 // (questionRepairStep found no bounded question-only patch) with an explicit
 // '*-correction' phase so it is never silently billed/routed as authoring.
 assert.equal(studyModelPhase({usageMetadata:{stage:'chapters',phase:'whole-chapter-correction'}}),'correction')
 const draftRoute={version:1,routes:{authoring:'gpt-5-mini','correction':'gpt-5.6-sol'}}
 const firstDraftOptions={...options,usageMetadata:{versionId:'sv-test',stage:'chapters'}}
 const correctionOptions={...options,usageMetadata:{versionId:'sv-test',stage:'chapters',chapterId:'ch-1',phase:'whole-chapter-correction',correctionAttempt:1}}
 assert.equal(routeStudyModel(billing,firstDraftOptions,draftRoute).model,'gpt-5-mini')
 assert.equal(routeStudyModel(billing,correctionOptions,draftRoute).model,'gpt-5.6-sol')
 // Every other correction call site (question/section/scope/flashcard/links/
 // source-refresh repairs) already tags its own '*-correction' phase and
 // routes identically through the shared 'correction' phase.
 for(const phase of ['revision-correction','scope-correction','objective-correction','content-correction','section-correction','flashcard-correction','practice-correction','source-refresh'])
  assert.equal(studyModelPhase({usageMetadata:{stage:'chapters',phase}}),'correction')
})
test('unpriced models, provider changes, malformed routes and price escalation fail closed',()=>{
 for(const p of ['not-json',{version:1,routes:{typo:'gpt-5-mini'}},{version:1,routes:{'source-mapping':'unknown'}},{version:1,routes:{'source-mapping':'claude-sonnet-4-5'}}])assert.throws(()=>routeStudyModel(billing,options,p))
 assert.throws(()=>routeStudyModel({...billing,model:'gpt-5-mini'},options,{version:1,routes:{'source-mapping':'gpt-6-astra'}}),/cannot increase/)
})
test('GPT-6 Sol is a priced route below Astra without changing the selected job model',()=>{
 const routed=routeStudyModel(billing,{...options,usageMetadata:{versionId:'sv-test',stage:'chapters'}},{version:1,routes:{authoring:{model:'gpt-6-sol',reasoning:'medium'}}})
 assert.deepEqual(routed,{model:'gpt-6-sol',baseModel:'gpt-6-astra',phase:'authoring',policyVersion:1,reasoningEffort:'medium'})
 assert.throws(()=>routeStudyModel({...billing,model:'gpt-5-mini'},options,{version:1,routes:{'source-mapping':'gpt-6-sol'}}),/cannot increase/)
})
test('the GPT-6 Sol standard uses the measured mixed profile without the failed Mini question trial',()=>{
 const standard={source:'platform',provider:'openai',model:'gpt-6-sol'}
 assert.equal(effectiveStudyModelRouting(standard),STANDARD_STUDY_MODEL_ROUTES)
 assert.equal(routeStudyModel(standard,options,STANDARD_STUDY_MODEL_ROUTES).model,'gpt-5-mini')
 const authoring=routeStudyModel(standard,{...options,usageMetadata:{versionId:'sv-test',stage:'chapters'}},STANDARD_STUDY_MODEL_ROUTES)
 assert.equal(authoring.model,'gpt-6-sol')
 assert.equal(authoring.reasoningEffort,'medium')
 assert.equal(routeStudyModel(standard,{...options,usageMetadata:{versionId:'sv-test',phase:'practice-correction',routePhase:'question-correction'}},STANDARD_STUDY_MODEL_ROUTES).model,'gpt-6-sol')
 assert.equal(questionCorrectionTrial({STUDY_MODEL_ROUTES:JSON.stringify(STANDARD_STUDY_MODEL_ROUTES)}).active,false)
 assert.equal(studyPlanPrecheckEnabled(standard),true)
 assert.equal(pedagogicalPrecheckEnabled(standard),true)
 assert.equal(effectiveStudyModelRouting({...standard,source:'personal'}),null)
 const override={version:1,routes:{authoring:'gpt-5-mini'}}
 assert.equal(effectiveStudyModelRouting(standard,override),override)
})
test('a route may set a supported reasoning effort without changing the model or raising price',()=>{
 const effort={version:1,routes:{'source-mapping':{model:'gpt-5-mini',reasoning:'low'}}}
 assert.deepEqual(routeStudyModel(billing,options,effort),{model:'gpt-5-mini',baseModel:'gpt-6-astra',phase:'source-mapping',policyVersion:1,reasoningEffort:'low'})
 assert.deepEqual(routeStudyModel(billing,options,{version:1,routes:{'source-mapping':{model:'gpt-5-mini'}}}),{model:'gpt-5-mini',baseModel:'gpt-6-astra',phase:'source-mapping',policyVersion:1})
 // Same model, lower effort only: still routed so the effort is recorded.
 assert.deepEqual(routeStudyModel({...billing,model:'gpt-5-mini'},options,effort),{model:'gpt-5-mini',baseModel:'gpt-5-mini',phase:'source-mapping',policyVersion:1,reasoningEffort:'low'})
 // Astra has no minimal effort; the provider layer's supported value is recorded.
 assert.equal(routeStudyModel(billing,options,{version:1,routes:{'source-mapping':{model:'gpt-6-astra',reasoning:'minimal'}}}).reasoningEffort,'low')
 for(const route of [{model:'gpt-5-mini',reasoning:'exhaustive'},{model:'gpt-5-mini',reasoning:'MEDIUM'},{model:'gpt-5-mini',reasoning:true},{model:'gpt-5-mini',effort:'low'},{reasoning:'low'},['gpt-5-mini']])
  assert.throws(()=>routeStudyModel(billing,options,{version:1,routes:{'source-mapping':route}}))
 assert.throws(()=>routeStudyModel({...billing,model:'gpt-5-mini'},options,{version:1,routes:{'source-mapping':{model:'gpt-6-astra',reasoning:'low'}}}),/cannot increase/)
})
test('routed call reserves and settles the actual model; exhausted caps still prevent calls',async()=>{
 await withRequestContext({userId:'route-'+randomUUID(),mode:'local'},async()=>{try{
  let called=0;const jobKey='test-route-'+randomUUID();const usage={inputTokens:100,outputTokens:20,estimated:false,cachedInputTokens:0,cacheWriteInputTokens:0}
  const callPlatform=async(prompt,opts)=>{called++;assert.equal(opts.model,'gpt-5-mini');assert.equal(opts.billing.model,'gpt-5-mini');assert.equal(opts.usageMetadata.modelRoute.baseModel,'gpt-6-astra');return {text:'result',usage}}
  assert.equal(await runBudgetedStudyCall('test',options,{billing,jobKey,callPlatform,modelRouting:policy}),'result')
  const withEffort=async(prompt,opts)=>{assert.equal(opts.reasoningEffort,'low');assert.equal(opts.usageMetadata.modelRoute.reasoningEffort,'low');return {text:'result',usage}}
  assert.equal(await runBudgetedStudyCall('test',options,{billing,jobKey:'effort-route-'+randomUUID(),callPlatform:withEffort,modelRouting:{version:1,routes:{'source-mapping':{model:'gpt-5-mini',reasoning:'low'}}}}),'result')
  const standardBilling={...billing,model:'gpt-6-sol'}
  const standardCall=async(_prompt,opts)=>{assert.equal(opts.model,'gpt-5-mini');assert.equal(opts.usageMetadata.modelRoute.baseModel,'gpt-6-sol');return {text:'result',usage}}
  assert.equal(await runBudgetedStudyCall('test',options,{billing:standardBilling,jobKey:'standard-route-'+randomUUID(),callPlatform:standardCall}),'result')
  await assert.rejects(()=>runBudgetedStudyCall('test',options,{billing:{...billing,maxJobUsd:0.000001},jobKey:'blocked-route',callPlatform,modelRouting:policy}))
  assert.equal(called,1)
  await withRequestContext({userId:'wicker-study-platform-budget',mode:'study-budget'},async()=>{
   const ledger=await readDocument('study-ai-platform-budget',new Date().toISOString().slice(0,7),null)
   const reservation=Object.values(ledger.reservations).find(r=>r.jobKey===jobKey)
   assert.equal(reservation.model,'gpt-5-mini');assert.equal(reservation.micros,studyModelCost('gpt-5-mini',100,20,usage))
  })
 }finally{await deleteAllDocuments()}})
})

test('the structural fill and question-only corrections have their own routes that fall back to authoring and correction',()=>{
 const billing={source:'platform',provider:'openai',model:'gpt-6-astra'}
 const at=(phase,extra={})=>({generationRuntime:'agents-sdk-responses',usageMetadata:{versionId:'sv-test',stage:'chapters',phase,...extra}})
 assert.equal(studyModelPhase(at('structural-fill')),'structural-fill')
 assert.equal(studyModelPhase(at('practice-correction',{routePhase:'question-correction'})),'question-correction')
 assert.equal(studyModelPhase(at('section-correction',{routePhase:'question-correction'})),'question-correction')
 assert.equal(studyModelPhase(at('practice-correction')),'correction')
 // Unconfigured specific phases route exactly as their general phase did.
 const general={version:1,routes:{authoring:'gpt-5-mini',correction:'gpt-5.6-sol'}}
 assert.deepEqual(routeStudyModel(billing,at('structural-fill'),general),{model:'gpt-5-mini',baseModel:'gpt-6-astra',phase:'authoring',requestedPhase:'structural-fill',policyVersion:1})
 assert.equal(routeStudyModel(billing,at('practice-correction',{routePhase:'question-correction'}),general).model,'gpt-5.6-sol')
 // Configured, they route on their own.
 const trial={version:1,routes:{authoring:'gpt-5-mini','structural-fill':'gpt-5-mini',correction:'gpt-5.6-sol','question-correction':'gpt-5-mini'}}
 assert.equal(routeStudyModel(billing,at('practice-correction',{routePhase:'question-correction'}),trial).model,'gpt-5-mini')
 assert.equal(routeStudyModel(billing,at('practice-correction',{routePhase:'question-correction'}),trial).phase,'question-correction')
 assert.equal(routeStudyModel(billing,at('practice-correction'),trial).model,'gpt-5.6-sol')
 // The price guard applies to the new phases too.
 assert.throws(()=>routeStudyModel({...billing,model:'gpt-5-mini'},at('practice-correction',{routePhase:'question-correction'}),{version:1,routes:{'question-correction':'gpt-6-astra'}}),/cannot increase/)
})

test('the opt-in pedagogical pre-review has its own cheap route',()=>{
 const billing={source:'platform',provider:'openai',model:'gpt-6-astra'}
 const options={generationRuntime:'agents-sdk-responses',usageMetadata:{versionId:'sv-test',phase:'pedagogical-precheck'}}
 const policy={version:1,routes:{'pedagogical-precheck':'gpt-5-mini'}}
 assert.deepEqual(routeStudyModel(billing,options,policy),{model:'gpt-5-mini',baseModel:'gpt-6-astra',phase:'pedagogical-precheck',policyVersion:1})
})

test('the question-only trial is switched on only by a distinct question-correction route',async()=>{
 const profile=routes=>JSON.stringify({version:1,routes})
 assert.equal(questionCorrectionTrial({}).active,false)
 assert.equal(questionCorrectionTrial({STUDY_MODEL_ROUTES:profile({correction:'gpt-5.6-sol'})}).active,false)
 assert.equal(questionCorrectionTrial({STUDY_MODEL_ROUTES:profile({correction:'gpt-5.6-sol','question-correction':'gpt-5.6-sol'})}).active,false)
 assert.deepEqual(questionCorrectionTrial({STUDY_PIPELINE_MODEL_ROUTES:profile({correction:'gpt-5.6-sol','question-correction':{model:'gpt-5-mini',reasoning:'medium'}})}),{active:true,model:'gpt-5-mini',fallbackModel:'gpt-5.6-sol'})
 assert.equal(questionCorrectionTrial({STUDY_MODEL_ROUTES:'not json'}).active,false)
})
