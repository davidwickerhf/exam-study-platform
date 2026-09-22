import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { studyPlanPrecheckStep } from '../lib/study-plan-precheck.mjs'
import { studyPlanPrecheckEnabled, studyModelPhase } from '../lib/study-model-routing.mjs'
import { course, teachingPlan, practiceBlueprint } from '../scripts/verification/study-fixtures.mjs'

test('the plan precheck validates exact objective and practice targets',()=>{
 const evidence=[{id:'e-1',text:'Addition combines disjoint groups and subtraction checks the result.'}]
 const plan=teachingPlan(['e-1']),practice=practiceBlueprint(plan)
 const step=studyPlanPrecheckStep(evidence,plan,practice)
 assert.match(step.prompt,/before any chapter is drafted/)
 assert.equal(step.accept({findings:[{targetType:'practice',targetId:practice[0].key,detail:'The changed condition introduces an untaught mechanism.',severity:'error'}]}).length,1)
 assert.throws(()=>step.accept({findings:[{targetType:'practice',targetId:'missing',detail:'Unknown target.',severity:'error'}]}),/unknown practice missing/)
})

test('the semantic plan gate is opt-in and routable',()=>{
 assert.equal(studyPlanPrecheckEnabled({STUDY_MODEL_ROUTES:JSON.stringify({version:1,routes:{'teaching-plan':'gpt-5-mini'}})}),false)
 assert.equal(studyPlanPrecheckEnabled({STUDY_MODEL_ROUTES:JSON.stringify({version:1,routes:{'teaching-plan-check':'gpt-5-mini'}})}),true)
 assert.equal(studyModelPhase({usageMetadata:{phase:'teaching-plan-check'}}),'teaching-plan-check')
})

test('a failed semantic plan gate schedules at most two narrowing re-plans before drafting',async()=>{
 const userId=`study-plan-precheck-${randomUUID()}`
 const run=fn=>withRequestContext({userId,mode:'local'},fn)
 const saved=process.env.STUDY_MODEL_ROUTES
 process.env.STUDY_MODEL_ROUTES=JSON.stringify({version:1,routes:{'teaching-plan-check':'gpt-5-mini'}})
 try{
  await run(async()=>{
   const note=await addStudyNote({...course,title:'Plan check notes'},[{page:1,text:'Addition combines disjoint groups and subtraction checks the result.'}])
   const snapshot=await readStudySourceSnapshot(course,[note.id]),ids=snapshot.chunks.map(row=>row.id)
   const version=await createStudyVersion(course,'programme-test',snapshot)
   const plan=teachingPlan(ids),practice=practiceBlueprint(plan),topic={id:'addition',title:'Addition',sourceIds:ids}
   await mutateStudyVersion(version.id,next=>{
    next.draft.stage='chapters';next.draft.topics=[topic];next.draft.teachingPlans={addition:plan};next.draft.practiceBlueprints={addition:{practice,valid:true,issues:[]}}
   })
   let calls=0
   const finding={targetType:'practice',targetId:practice[0].key,detail:'The changed condition requires reasoning absent from the evidence.',severity:'error'}
   await processStudyStep(version.id,{generate:async(_prompt,options)=>{
    calls++;assert.equal(options.usageMetadata.phase,'teaching-plan-check')
    return {findings:[finding]}
   }})
   let draft=(await ownStudyVersion(version.id)).draft
   assert.equal(calls,1)
   assert.equal(draft.teachingPlans.addition,undefined)
   assert.equal(draft.practiceBlueprints.addition,undefined)
   assert.equal(draft.planSemanticAttempts.addition,1)
   assert.match(draft.planValidation.addition.issues[0],/practice:/)
   assert.equal(draft.stage,'chapters')

   await processStudyStep(version.id,{generate:async(prompt,options)=>{
    calls++;assert.equal(options.usageMetadata.phase,'teaching-plan')
    assert.match(prompt,/Remove every unsupported mechanism/)
    return {...plan,practice}
   }})
   draft=(await ownStudyVersion(version.id)).draft
   assert.ok(draft.teachingPlans.addition,'the single revised plan is persisted')

   await processStudyStep(version.id,{generate:async(_prompt,options)=>{
    calls++;assert.equal(options.usageMetadata.phase,'teaching-plan-check')
    return {findings:[finding]}
   }})
   draft=(await ownStudyVersion(version.id)).draft
   assert.equal(calls,3)
   assert.equal(draft.status,'running')
   assert.equal(draft.planSemanticAttempts.addition,2)
   assert.equal(draft.teachingPlans.addition,undefined)

   await processStudyStep(version.id,{generate:async(prompt,options)=>{
    calls++;assert.equal(options.usageMetadata.phase,'teaching-plan');assert.match(prompt,/Remove every unsupported mechanism/)
    return {...plan,practice}
   }})
   await processStudyStep(version.id,{generate:async(_prompt,options)=>{
    calls++;assert.equal(options.usageMetadata.phase,'teaching-plan-check')
    return {findings:[finding]}
   }})
   draft=(await ownStudyVersion(version.id)).draft
   assert.equal(calls,5)
   assert.equal(draft.status,'failed')
   assert.equal(draft.planSemanticAttempts.addition,2,'no third re-plan is scheduled')
   assert.equal(draft.planSemanticChecks.addition.status,'failed')
   assert.match(draft.error,/still exceeds its evidence/)
  })
 }finally{
  if(saved===undefined)delete process.env.STUDY_MODEL_ROUTES;else process.env.STUDY_MODEL_ROUTES=saved
  await run(deleteAllDocuments)
 }
})
