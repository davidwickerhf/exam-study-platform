import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { writeDocument, listDocuments, deleteAllDocuments } from '../lib/user-store.mjs'
import { saveModuleGuideSettings, reconcileModuleGuides, localGenerationQueue, MODULE_INVENTORIES, MODULE_SETTINGS, moduleGuideStatus } from '../lib/study-module-automation.mjs'
import { saveRecurringPolicy, recurringStatus } from '../lib/study-recurring-policy.mjs'
import { inferModuleCandidate, validateModuleReadiness } from '../lib/study-module-readiness.mjs'
import { nextLocalStudy, submitLocalStudy } from '../lib/study-local-generation.mjs'
import { ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { priorityAnnouncementDocument } from '../lib/priority-announcements.mjs'
const course={courseCode:'IOT101',courseName:'IoT',academicYear:'2026-2027',period:'1'}
const settings={enabled:true,execution:'local',rule:'auto',supportingSourceKeys:[],billing:{source:'platform',quality:'standard',maxJobUsd:1}}
const module={id:'one',name:'Polling and interrupts',position:1,unlockAt:null,items:2}
const day=86400000
const fixture=fn=>withRequestContext({userId:`module-test-${randomUUID()}`,mode:'local'},async()=>{try{await fn()}finally{await deleteAllDocuments()}})
function sources(){return [{key:'slides',title:'Lecture.pdf',bindingId:'binding',academicYear:course.academicYear,period:'1',locations:[{moduleId:'one'}],sha256:'v1',pages:[{page:1,text:'Polling samples an input at intervals. The interrupt handler suspends the main calculation.'}]},{key:'practice',title:'Practice sheet.pdf',bindingId:'binding',academicYear:course.academicYear,period:'1',locations:[{moduleId:'one'}],sha256:'p1',pages:[{page:1,text:'Trace the main calculation interrupted by an eight millisecond handler.'}]}]}
async function setup(){const data=sources(),sourceOptions={editorialSources:async()=>data};await writeDocument(MODULE_INVENTORIES,'binding',{bindingId:'binding',course,modules:[module],skipped:[]});await saveModuleGuideSettings(course,settings,{sourceOptions});const [{key}]=await listDocuments(MODULE_SETTINGS);return{data,sourceOptions,key}}

test('weekly and topic candidates use different evidence without treating silence or mastery as completeness',()=>{
  const now=Date.now(),data=sources()
  const first=inferModuleCandidate(module,[module],data,null,{now})
  assert.equal(first.status,'gathering')
  const next=inferModuleCandidate(module,[module],data,first,{now:now+2*day})
  assert.equal(next.status,'candidate')
  const week={...module,name:'Week 1'},before=inferModuleCandidate(week,[week],data.slice(0,1),null,{now})
  assert.equal(inferModuleCandidate(week,[week],data.slice(0,1),before,{now:now+3*day}).status,'gathering')
  const future={...module,unlockAt:new Date(now+10*day).toISOString()}
  assert.ok(inferModuleCandidate(future,[future],data,next,{now:now+3*day}).blockers.some(s=>/future/.test(s)))
})
test('textbook and scope review cannot pass by citing an unavailable chapter or invented evidence',()=>{
  const snapshot={chunks:[{id:'e-1',text:'Read chapter 4 of the textbook.'}]}
  assert.throws(()=>validateModuleReadiness({ready:true,organisation:'textbook',evidence:[{sourceId:'e-1',quote:'Read chapter 4'}],missingReadings:['Chapter 4 text'],unresolvedTopics:[]},snapshot),/missing readings/)
  assert.throws(()=>validateModuleReadiness({ready:true,organisation:'topic',evidence:[{sourceId:'e-1',quote:'invented'}],missingReadings:[],unresolvedTopics:[]},snapshot),/quote/)
})
test('stable modules queue one local preflight; honest missing-book result is saved with no hosted fallback',()=>fixture(async()=>{
  const {sourceOptions,key}=await setup()
  assert.equal((await localGenerationQueue()).versions.length,0)
  await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+3*day})
  const [{id}]=(await localGenerationQueue()).versions
  await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+4*day})
  assert.equal((await localGenerationQueue()).versions.length,1)
  const next=await nextLocalStudy(id,{},sourceOptions)
  assert.match(next.request.prompt,/ASSESS MODULE READINESS/)
  const submitted=await submitLocalStudy(id,{contractId:next.contract.id,requestId:next.request.id,response:{ready:false,organisation:'textbook',reason:'The assigned chapter is not supplied.',evidence:[],missingReadings:['Textbook chapter 4'],unresolvedTopics:[]}},sourceOptions)
  assert.equal(submitted.accepted,true)
  const version=await ownStudyVersion(id)
  assert.equal(version.draft.status,'failed')
  assert.equal(version.draft.moduleReadiness.ready,false)
  assert.equal(version.draft.billing.source,'local')
  assert.ok((await recurringStatus()).events.length)
}))
test('changes trigger another revision of the same module; global pause/resume prevents local calls',()=>fixture(async()=>{
  const {sourceOptions,key,data}=await setup()
  await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+3*day})
  const [{id}]=(await localGenerationQueue()).versions
  const before=await ownStudyVersion(id)
  await mutateStudyVersion(id,v=>{v.draft.status='failed'})
  data[0].sha256='v2';data[0].pages[0].text+=' New condition: a pulse may fall entirely between samples.'
  await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+4*day})
  const after=await ownStudyVersion(id)
  assert.notEqual(after.draft.id,before.draft.id)
  assert.equal((await listDocuments('study-versions')).length,1)
  await saveRecurringPolicy({guides:false,papers:true,priorities:false})
  await assert.rejects(nextLocalStudy(id,{},sourceOptions),/paused/)
  await saveRecurringPolicy({guides:true,papers:true,priorities:true})
  assert.ok((await nextLocalStudy(id,{},sourceOptions)).request)
}))
test('new announcements change the candidate signature and carry dates and exclusions as evidence',()=>{
  const binding={id:'b',course_code:course.courseCode,academic_year:course.academicYear,period:'1'}
  const doc=priorityAnnouncementDocument({id:9,title:'Exam scope',posted_at:'2026-09-01',message:'<p>Interrupts will not be examined.</p>'},{...binding,origin:'https://canvas.example.test',canvas_course_id:'123'})
  const source={key:'announcement-9',announcement:true,sha256:doc.sha,pages:[{text:doc.text}]}
  assert.match(source.pages[0].text,/2026-09-01/)
  assert.match(source.pages[0].text,/not be examined/)
  const first=inferModuleCandidate(module,[module],sources(),null)
  const changed=inferModuleCandidate(module,[module],[...sources(),source],{...first,versionId:'existing'})
  assert.notEqual(changed.signature,first.signature)
  assert.ok(changed.sourceKeys.includes(source.key))
  assert.equal(changed.status,'candidate')
})
test('MCP cannot enable hosted spending or alter global pipeline controls',()=>fixture(async()=>{
  await withRequestContext({userId:'api-automation-test',mode:'api-key'},async()=>{
    await assert.rejects(saveModuleGuideSettings(course,{...settings,execution:'hosted'}),e=>e.status===403)
    await assert.rejects(saveRecurringPolicy({guides:true,papers:true,priorities:true}),e=>e.status===403)
    assert.equal((await moduleGuideStatus(course)).settings.enabled,false)
  })
}))

test('past-year supplements match meaningful topics and cannot define this year’s scope',async()=>{
  const {historicalModuleSuggestions}=await import('../lib/study-module-readiness.mjs')
  const old={...sources()[0],key:'past',academicYear:'2025-2026',title:'Polling and interrupts.pdf'}
  assert.equal(historicalModuleSuggestions(module,[old],course.academicYear).length,1)
  assert.deepEqual(historicalModuleSuggestions({name:'Week 1'},[{...old,title:'Week 1 slides.pdf'}],course.academicYear),[])
  const snapshot={sources:[old],chunks:[{id:'old-e',sourceKey:'past',text:'Polling samples the input.'}]}
  assert.throws(()=>validateModuleReadiness({ready:true,organisation:'topic',reason:'Prior course was complete',scope:[{topic:'Polling',sourceIds:['old-e']}],evidence:[{sourceId:'old-e',quote:'Polling samples'}],missingReadings:[],unresolvedTopics:[]},snapshot,course),/Current-edition evidence/)
})

test('course pause retains local checkpoints and resumes without a new run',()=>fixture(async()=>{
  const {sourceOptions,key}=await setup()
  await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+3*day})
  const [{id}]=(await localGenerationQueue()).versions
  const waiting=await nextLocalStudy(id,{},sourceOptions)
  await saveModuleGuideSettings(course,{...settings,enabled:false},{sourceOptions})
  await assert.rejects(nextLocalStudy(id,{},sourceOptions),/paused/)
  await saveModuleGuideSettings(course,settings,{sourceOptions})
  const resumed=await nextLocalStudy(id,{},sourceOptions)
  assert.equal(resumed.request.id,waiting.request.id)
}))
