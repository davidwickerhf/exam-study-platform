import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteAllDocuments} from '../lib/user-store.mjs'
import {startLocalStudy,addLocalStudyNotes} from '../lib/study-local-generation.mjs'
import {ownStudyVersion,mutateStudyVersion} from '../lib/study-version-store.mjs'
import {replanPilotRemainder} from '../scripts/verification/study-pilot-replan.mjs'
import {course,lesson} from '../scripts/verification/study-fixtures.mjs'

async function fixture(fn){
 await withRequestContext({userId:'pilot-replan-'+randomUUID(),mode:'local'},async()=>{
  try{
   const note=await addLocalStudyNotes({...course,title:'Arithmetic',pages:[{page:1,text:'Add disjoint quantities with matching units. Two plus three equals five. Subtraction reverses addition.'}]})
   const {version}=await startLocalStudy({...course,sourceKeys:[note.id]})
   await mutateStudyVersion(version.id,next=>{
    const sourceIds=next.draft.snapshot.chunks.map(c=>c.id)
    next.draft.topics=['saved','addition','units'].map(id=>({id,title:id,sourceIds}))
    next.draft.maps=[{topics:structuredClone(next.draft.topics),gaps:[]}]
    next.draft.chapters=[{...lesson(sourceIds),id:'saved',review:'passed',factualAudit:{solutions:{unchanged:{answer:'preserved'}}}}]
    next.draft.automaticRepairs={saved:1};next.draft.stage='chapters'
   })
   await fn(version.id)
  }finally{await deleteAllDocuments()}
 })
}
const valid={topics:[{id:'combined',title:'Adding matching quantities',topicRefs:['map-0-topic-0','map-0-topic-1']}],gaps:[]}

test('pilot regrouping retains authored chapters, review checks, maps and correction counters',async()=>fixture(async id=>{
 const before=await ownStudyVersion(id);let calls=0
 const result=await replanPilotRemainder(id,async()=>{calls++;return JSON.stringify(valid)})
 const after=await ownStudyVersion(id)
 assert.equal(result.beforeChapters,3);assert.equal(result.afterChapters,2)
 assert.deepEqual(after.draft.chapters,before.draft.chapters)
 assert.deepEqual(after.draft.maps,before.draft.maps)
 assert.deepEqual(after.draft.automaticRepairs,before.draft.automaticRepairs)
 assert.deepEqual(after.draft.topics[1].concepts,['addition','units'])
 assert.equal(after.activeRevisionId,before.activeRevisionId)
 await replanPilotRemainder(id,async()=>{throw Error('must reuse applied plan')})
 assert.equal(calls,1)
}))

test('invalid grouping gets one correction with its base proposal, then stops durably',async()=>fixture(async id=>{
 const before=await ownStudyVersion(id);let calls=0
 const invalid={...valid,topics:[{...valid.topics[0],topicRefs:['map-0-topic-0']}]}
 await assert.rejects(replanPilotRemainder(id,async prompt=>{
  if(calls++)assert.match(prompt,/"candidate"/)
  return JSON.stringify(invalid)
 }),/after two attempts/)
 const after=await ownStudyVersion(id)
 assert.deepEqual(after.draft.topics,before.draft.topics)
 assert.deepEqual(after.draft.chapters,before.draft.chapters)
 await assert.rejects(replanPilotRemainder(id,async()=>{calls++;return JSON.stringify(valid)}),/after two attempts/)
 assert.equal(calls,2)
}))
