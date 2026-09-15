import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {withRequestContext} from '../lib/request-context.mjs'
import {activeProgrammeId} from '../lib/programme-scope.mjs'
import {writeDocument,readDocument,listDocuments,deleteAllDocuments} from '../lib/user-store.mjs'
import {readStudySourceSnapshot} from '../lib/study-version-sources.mjs'
import {createStudyVersion,saveStudyRevision,mutateStudyVersion,ownStudyVersion} from '../lib/study-version-store.mjs'
import {enrollGuideMaintenance} from '../lib/study-guide-maintenance.mjs'
import {reconcileModuleGuides,moduleGuideStatus} from '../lib/study-module-automation.mjs'
import {saveRecurringPolicy,automaticGuideAllowed,recurringStatus} from '../lib/study-recurring-policy.mjs'
const course={courseCode:'AI101',courseName:'AI',academicYear:'2026-2027',period:'1'}
async function fixture(fn){await withRequestContext({userId:'maintenance-'+randomUUID(),mode:'local'},async()=>{try{
 const data=[{key:'slide',title:'Lecture',academicYear:course.academicYear,period:'1',bindingId:'binding',locations:[{moduleId:'one'}],sha256:'one',pages:[{page:1,text:'Current course explanation.'}]}],sourceOptions={editorialSources:async()=>data}
 await writeDocument('canvas-module-inventories','binding',{bindingId:'binding',course,modules:[{id:'one',name:'AI',items:1}]})
 const snapshot=await readStudySourceSnapshot(course,['slide'],sourceOptions),version=await createStudyVersion(course,await activeProgrammeId(),snapshot,{execution:'local',title:'Existing manual guide'})
 const draft={...version.draft,status:'complete',chapters:[],topics:[]};await saveStudyRevision(version,draft)
 await mutateStudyVersion(version.id,v=>{v.history=[{id:draft.id,chapters:0}];v.activeRevisionId=draft.id;v.draft={...draft,manualRepairs:{original:1}}})
 const input={versionId:version.id,expectedRevisionId:draft.id,enabled:true,moduleRefs:[{bindingId:'binding',moduleId:'one'}]}
 await fn({version:await ownStudyVersion(version.id),input,data,sourceOptions})
 }finally{await deleteAllDocuments()}})}
test('enrollment dry run is read-only, uses the existing ID, and preserves its revision and counters',()=>fixture(async({version,input,sourceOptions})=>{
 assert.equal((await enrollGuideMaintenance(input,{sourceOptions})).dryRun,true)
 assert.deepEqual(await ownStudyVersion(version.id),version)
 await enrollGuideMaintenance({...input,dryRun:false},{sourceOptions})
 const enrolled=await ownStudyVersion(version.id)
 assert.deepEqual(enrolled.draft,version.draft);assert.equal(enrolled.activeRevisionId,version.activeRevisionId)
 assert.equal((await listDocuments('study-versions')).length,1)
 assert.equal((await moduleGuideStatus(course,{sourceOptions})).maintainedGuides.length,1)
 assert.equal((await recurringStatus()).jobs[0].status,'complete')
 await assert.rejects(()=>enrollGuideMaintenance({...input,expectedRevisionId:'stale',dryRun:false},{sourceOptions}),/Reload/)
 await assert.rejects(()=>enrollGuideMaintenance({...input,moduleRefs:[{bindingId:'other',moduleId:'one'}],dryRun:false},{sourceOptions}),/accessible/)
}))
test('new material queues one local revision; unchanged sources, active work and global pause do not duplicate it',()=>fixture(async({version,input,sourceOptions,data})=>{
 await enrollGuideMaintenance({...input,dryRun:false},{sourceOptions})
 const enrolled=await ownStudyVersion(version.id),key=enrolled.automation.settingsKey
 await reconcileModuleGuides(key,{sourceOptions})
 assert.equal((await ownStudyVersion(version.id)).draft.id,version.draft.id)
 data.push({...data[0],key:'new-practice',sha256:'new',pages:[{page:2,text:'An additional worked exercise.'}]})
 await saveRecurringPolicy({guides:false,papers:true,priorities:true})
 await reconcileModuleGuides(key,{sourceOptions});assert.equal((await ownStudyVersion(version.id)).draft.id,version.draft.id)
 await saveRecurringPolicy({guides:true,papers:true,priorities:true})
 await reconcileModuleGuides(key,{sourceOptions})
 const updated=await ownStudyVersion(version.id)
 assert.equal(updated.draft.execution,'local');assert.equal(updated.draft.refreshFrom,version.activeRevisionId)
 assert.equal(updated.activeRevisionId,version.activeRevisionId)
 await reconcileModuleGuides(key,{sourceOptions,now:Date.now()+86400001})
 assert.equal((await ownStudyVersion(version.id)).draft.id,updated.draft.id)
 assert.equal((await listDocuments('study-versions')).length,1)
 assert.ok((await readDocument('study-module-settings',key,null)).events[0].maintenance.length)
 assert.equal(await automaticGuideAllowed({...updated.automation,versionId:'wrong'},'local'),false)
 await enrollGuideMaintenance({...input,enabled:false,dryRun:false},{sourceOptions:{editorialSources:async()=>{throw new Error('Unavailable')}}})
 assert.equal(await automaticGuideAllowed(updated.automation,'local'),false)
 assert.deepEqual((await ownStudyVersion(version.id)).draft,updated.draft)
 assert.equal((await recurringStatus()).jobs[0].status,'paused')
}))
