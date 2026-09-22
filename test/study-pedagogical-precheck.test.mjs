import test from 'node:test'
import assert from 'node:assert/strict'
import { pedagogicalPrecheckStep, acceptPedagogicalPrecheck } from '../lib/study-pedagogical-precheck.mjs'
import { pedagogicalPrecheckEnabled, studyModelPhase } from '../lib/study-model-routing.mjs'
import { course, lesson, teachingResponse } from '../scripts/verification/study-fixtures.mjs'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, prepareLesson } from '../lib/study-version-pipeline.mjs'

const ids=['e-current']
const evidence=[{id:ids[0],sourceKey:'source',text:'Addition combines disjoint quantities and subtraction checks the result.'}]

test('the opt-in pre-review returns only located findings over a lean teaching payload',()=>{
 const chapter=lesson(ids)
 const step=pedagogicalPrecheckStep(evidence,chapter)
 assert.match(step.prompt,/four recurring blocking faults/)
 assert.doesNotMatch(step.prompt,new RegExp(chapter.questions[0].answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'answers are not sent to the pre-review')
 const findings=acceptPedagogicalPrecheck(chapter,step,{issues:[{topicId:'question-1',scope:'question',detail:'The question assesses reasoning absent from the teaching.',severity:'error'}]})
 assert.equal(findings[0].itemKey,'question:question-1')
})

test('the pedagogical pre-check adds no call unless its route is explicit',()=>{
 assert.equal(pedagogicalPrecheckEnabled({STUDY_MODEL_ROUTES:JSON.stringify({version:1,routes:{'pedagogical-review':'gpt-5.6-sol'}})}),false)
 assert.equal(pedagogicalPrecheckEnabled({STUDY_MODEL_ROUTES:JSON.stringify({version:1,routes:{'pedagogical-precheck':'gpt-5-mini'}})}),true)
 assert.equal(studyModelPhase({usageMetadata:{phase:'pedagogical-precheck'}}),'pedagogical-precheck')
})

test('the pipeline runs the configured pre-check once per content revision without consuming a correction',async()=>{
 const userId=`study-precheck-${randomUUID()}`
 const run=fn=>withRequestContext({userId,mode:'local'},fn)
 const saved=process.env.STUDY_MODEL_ROUTES
 process.env.STUDY_MODEL_ROUTES=JSON.stringify({version:1,routes:{'pedagogical-precheck':'gpt-5-mini'}})
 try{
  await run(async()=>{
   const note=await addStudyNote({...course,title:'Pre-check notes'},[{page:1,text:evidence[0].text}])
   const snapshot=await readStudySourceSnapshot(course,[note.id]),sourceIds=snapshot.chunks.map(row=>row.id)
   const version=await createStudyVersion(course,'programme-test',snapshot)
   const raw=lesson(sourceIds),topic={id:'addition',title:'Addition',sourceIds}
   const chapter={...prepareLesson(raw,topic,snapshot.chunks,raw.teachingPlan),review:'pending'}
   await mutateStudyVersion(version.id,next=>{
    next.draft.stage='review';next.draft.topics=[topic];next.draft.teachingPlans={addition:raw.teachingPlan};next.draft.chapters=[chapter]
   })
   const replacement={...structuredClone(chapter.questions[0]),answer:chapter.questions[0].answer+' The diagnosed overlap is checked directly.'}
   const phases=[]
   await processStudyStep(version.id,{generate:async(_prompt,options)=>{
    phases.push(options.usageMetadata.phase)
    return {issues:[{topicId:replacement.key,scope:'question',detail:'The assessment needs reasoning absent from visible teaching.',severity:'error'}]}
   }})
   let draft=(await ownStudyVersion(version.id)).draft
   assert.equal(draft.pedagogicalPrechecks.addition.status,'repairing')
   assert.deepEqual(draft.automaticRepairs,{})
   await processStudyStep(version.id,{generate:async(_prompt,options)=>{
    phases.push(options.usageMetadata.phase)
    return {questions:{[replacement.key]:replacement}}
   }})
   draft=(await ownStudyVersion(version.id)).draft
   assert.deepEqual(phases,['pedagogical-precheck','practice-correction'])
   assert.equal(draft.stage,'review')
   assert.equal(draft.pedagogicalPrechecks.addition.status,'complete')
   assert.ok(draft.pedagogicalPrechecks.addition.contentHash)
   assert.equal(draft.chapters[0].questions[0].answer,replacement.answer)
   assert.deepEqual(draft.automaticRepairs,{})
   assert.equal(draft.chapters[0].evidenceReview,undefined,'the full reviews still remain to run')
   await processStudyStep(version.id,{generate:async(prompt,options)=>{phases.push(options.usageMetadata.phase);return teachingResponse(prompt,sourceIds)}})
   assert.match(phases[2],/^factual-/,'the full review starts after the pre-review fix and the pre-review does not repeat')

   const cleanVersion=await createStudyVersion(course,'programme-test',snapshot)
   await mutateStudyVersion(cleanVersion.id,next=>{
    next.draft.stage='review';next.draft.topics=[topic];next.draft.teachingPlans={addition:raw.teachingPlan};next.draft.chapters=[structuredClone(chapter)]
   })
   let cleanCalls=0
   await processStudyStep(cleanVersion.id,{generate:async(_prompt,options)=>{
    cleanCalls++
    assert.equal(options.usageMetadata.phase,'pedagogical-precheck')
    return {issues:[]}
   }})
   const cleanDraft=(await ownStudyVersion(cleanVersion.id)).draft
   assert.equal(cleanCalls,1,'a clean pre-review costs exactly one model call')
   assert.equal(cleanDraft.pedagogicalPrechecks.addition.status,'complete')
   assert.ok(cleanDraft.pedagogicalPrechecks.addition.contentHash)
   assert.equal(cleanDraft.stage,'review','the independent reviews remain queued for later checkpoints')
   assert.deepEqual(cleanDraft.automaticRepairs,{})
   await mutateStudyVersion(cleanVersion.id,next=>{
    next.draft.chapters[0].sections[0].text+=' A corrected teaching sentence.'
   })
   await processStudyStep(cleanVersion.id,{generate:async(_prompt,options)=>{
    cleanCalls++
    assert.equal(options.usageMetadata.phase,'pedagogical-precheck')
    return {issues:[]}
   }})
   assert.equal(cleanCalls,2,'changed content receives a fresh pre-review before the full review')
  })
 }finally{
  if(saved===undefined)delete process.env.STUDY_MODEL_ROUTES;else process.env.STUDY_MODEL_ROUTES=saved
  await run(deleteAllDocuments)
 }
})
