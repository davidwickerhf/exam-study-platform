import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteAllDocuments} from '../lib/user-store.mjs'
import {courseMappingBatches,reusableCourseMap,saveCourseMap,registerCourseOutline,readCoursePlan,planningProjection,checkPlanningBudget} from '../lib/study-course-plan.mjs'
const course={courseCode:'CS101',courseName:'Foundations',academicYear:'2026-2027',period:'1'}
function setup(){const v={id:'guide-one',programmeId:'programme',course,title:'First guide'},work={id:'revision-one',execution:'local',maps:[],topics:[],chapters:[],snapshot:{sourceHash:'snapshot',sources:[{key:'one',title:'Mechanisms',academicYear:course.academicYear,sha256:'bytes'}],chunks:[{id:'e-one',sourceKey:'one',text:'A mechanism and its assumptions.'}]}};return {v,work,batch:work.snapshot.chunks,result:{topics:[{id:'mechanisms',title:'Mechanisms',sourceIds:['e-one']}],gaps:[]}}}
const fixture=fn=>withRequestContext({userId:'course-plan-'+randomUUID(),mode:'local'},async()=>{try{await fn(setup())}finally{await deleteAllDocuments()}})
test('a second guide reuses exact source maps and only batches new evidence',()=>fixture(async({v,work,batch,result})=>{
 await saveCourseMap(v,work,batch,result)
 const second=structuredClone(work);second.snapshot.sources.push({key:'two',title:'New topic'});second.snapshot.chunks.push({id:'e-two',sourceKey:'two',text:'New content'})
 const batches=await courseMappingBatches({...v,id:'guide-two'},second)
 assert.deepEqual(batches.map(b=>b.map(c=>c.id)),[['e-one'],['e-two']])
 assert.deepEqual(await reusableCourseMap(v,second,batches[0]),result)
 assert.equal(await reusableCourseMap(v,second,batches[1]),null)
 assert.equal((await readCoursePlan(v)).maps[Object.keys((await readCoursePlan(v)).maps)[0]].originVersionId,'guide-one')
}))
test('changed extraction, source provenance, execution and scope cannot reuse an old map',()=>fixture(async({v,work,batch,result})=>{
 await saveCourseMap(v,work,batch,result)
 for(const change of [w=>w.snapshot.chunks[0].text='Corrected mechanism',w=>w.snapshot.sources[0].academicYear='2025-2026',w=>w.execution='hosted',w=>w.moduleReadiness={scope:['different module']},w=>{w.snapshot.sources.push({key:'notice',title:'Announcement',announcement:true,academicYear:course.academicYear});w.snapshot.chunks.push({id:'notice',sourceKey:'notice',text:'Mechanisms are excluded from this exam.'})}]){
  const other=structuredClone(work);change(other);assert.equal(await reusableCourseMap(v,other,[other.snapshot.chunks[0]]),null)
 }
 assert.equal(await reusableCourseMap({...v,programmeId:'other'},work,batch),null)
 assert.equal(await reusableCourseMap({...v,course:{...course,academicYear:'2027-2028'}},work,batch),null)
 await withRequestContext({userId:'different-'+randomUUID(),mode:'local'},async()=>assert.equal(await reusableCourseMap(v,work,batch),null))
}))
test('unfinished mapping preserves its original boundaries and saved work',()=>fixture(async({v,work,batch,result})=>{
 await saveCourseMap(v,work,batch,result)
 work.maps=[{...result,batchHash:'old'}];const before=structuredClone(work)
 assert.deepEqual(await courseMappingBatches(v,work),[batch]);assert.deepEqual(work,before)
}))
test('concurrent guide maps are preserved and unknown citations are rejected',()=>fixture(async({v,work,batch,result})=>{
 const next=structuredClone(work);next.snapshot.chunks[0].text='Another extraction'
 await Promise.all([saveCourseMap(v,work,batch,result),saveCourseMap(v,next,next.snapshot.chunks,result)])
 assert.equal(Object.keys((await readCoursePlan(v)).maps).length,2)
 await assert.rejects(()=>saveCourseMap(v,work,batch,{topics:[{id:'bad',title:'Bad',sourceIds:['invented']}],gaps:[]}))
}))
test('course outline reports overlapping concepts without discarding either guide',()=>fixture(async({v,work,result})=>{
 work.topics=result.topics;await registerCourseOutline(v,work)
 const second=structuredClone(work);second.id='revision-two';second.topics=[{...result.topics[0],id:'another'}]
 const report=await registerCourseOutline({...v,id:'guide-two'},second)
 assert.equal(report.overlappingGuides[0].versionId,'guide-one');assert.equal(report.baselineReviewTasks,4)
 assert.equal(report.estimatedUsd,null);assert.equal(Object.keys((await readCoursePlan(v)).guides).length,2)
 assert.equal(planningProjection({...work,topics:[...work.topics,{...work.topics[0],id:'duplicate'}]}).duplicateConcepts.length,1)
}))


test('a fresh local outline exceeding the task allowance stops before authoring and can resume after adjustment',()=>{
 const {v,work}=setup();work.topics=Array.from({length:3},(_,i)=>({id:`chapter-${i}`,title:`Topic ${i}`}));work.planning=planningProjection(work)
 const before=structuredClone(work)
 assert.match(checkPlanningBudget({...v,localReviewTaskBudget:10},work),/12 first-pass review tasks/)
 assert.deepEqual(work,before)
 assert.equal(checkPlanningBudget({...v,localReviewTaskBudget:12},work),null)
 assert.equal(checkPlanningBudget({...v,localReviewTaskBudget:10},{...work,chapters:[{id:'chapter-0',review:'passed'}]}),null)
})
