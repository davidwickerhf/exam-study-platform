import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {resolveCourseBundle,materializeCourseBundle} from '../lib/study-course-bundle.mjs'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteAllDocuments} from '../lib/user-store.mjs'
import {startLocalStudy,nextLocalStudy,submitLocalStudy,addLocalStudyNotes} from '../lib/study-local-generation.mjs'
import {ownStudyVersion,studyRevision,listOwnStudyVersions,pendingStudyVersions} from '../lib/study-version-store.mjs'
import {course,lesson,teachingResponse} from '../scripts/verification/study-fixtures.mjs'

test('whole-course outlines assign every mapped concept once and reject repeated guide ownership',()=>{
 // "orphan" lives on its own map with its own evidence, so dropping it alone
 // (unlike dropping a same-map sibling) has no deterministic placement
 // candidate and must still be reported as an omitted concept.
 const maps=[{topics:[{id:'a',title:'Mechanism A',sourceIds:['e-a']},{id:'b',title:'Mechanism B',sourceIds:['e-b']},{id:'a2',title:'Mechanism A',sourceIds:['e-a2']}],gaps:[]},{topics:[{id:'orphan',title:'Mechanism Orphan',sourceIds:['e-orphan']}],gaps:[]}]
 const candidate={guides:[{id:'one',title:'First guide',topics:[{id:'a',title:'Mechanism A',topicRefs:['map-0-topic-0','map-0-topic-2']}]},{id:'two',title:'Second guide',topics:[{id:'b',title:'Mechanism B',topicRefs:['map-0-topic-1','map-1-topic-0']}]}],gaps:[]}
 const result=resolveCourseBundle(candidate,maps)
 assert.deepEqual(result.topics.map(t=>t.guideId),['one','two'])
 assert.deepEqual(result.topics[0].sourceIds,['e-a','e-a2'])
 const repeated=structuredClone(candidate);repeated.guides[0].topics[0].topicRefs.pop();repeated.guides[1].topics[0].topicRefs.push('map-0-topic-2')
 assert.throws(()=>resolveCourseBundle(repeated,maps),/multiple guide owners/)
 const omitted=structuredClone(candidate);omitted.guides[1].topics[0].topicRefs.pop()
 assert.throws(()=>resolveCourseBundle(omitted,maps),/omitted/)
 const duplicate=structuredClone(candidate);duplicate.guides[1].topics[0].id='a'
 assert.throws(()=>resolveCourseBundle(duplicate,maps),/unique/)
})

test('whole-course outlines keep the first exact ref owner and remove later duplicate placements',()=>{
 const maps=[{topics:[{id:'a',title:'Mechanism A',sourceIds:['e-a']},{id:'b',title:'Mechanism B',sourceIds:['e-b']},{id:'c',title:'Mechanism C',sourceIds:['e-c']}],gaps:[]}]
 const candidate={guides:[
  {id:'one',title:'First guide',topics:[{id:'a',title:'Mechanism A',topicRefs:['map-0-topic-0'],supportingRefs:['map-0-topic-1']}]},
  {id:'two',title:'Second guide',topics:[{id:'b',title:'Mechanism B',topicRefs:['map-0-topic-1','map-0-topic-2'],supportingRefs:[]}]}
 ],gaps:[]}
 const result=resolveCourseBundle(candidate,maps)
 assert.deepEqual(result.deduplicatedRefs,[{ref:'map-0-topic-1',keptGuideId:'one',keptChapterId:'a',removedGuideId:'two',removedChapterId:'b',removedKind:'core'}])
 assert.deepEqual(result.topics[0].concepts,['Mechanism A','Mechanism B'])
 assert.deepEqual(result.topics[1].concepts,['Mechanism C'])
})

test('MCP course generation produces distinct checked guides idempotently without hosted work',async()=>{
 await withRequestContext({userId:'bundle-'+randomUUID(),mode:'local'},async()=>{
  try{
   const note=await addLocalStudyNotes({...course,title:'Course evidence',pages:[{page:1,text:'Adding disjoint quantities: two plus three equals five. Subtract to check. All quantities need matching units.'}]})
   const {version}=await startLocalStudy({...course,sourceKeys:[note.id],courseBundle:true})
   const ids=(await ownStudyVersion(version.id)).draft.snapshot.chunks.map(c=>c.id)
   let authorCalls=0
   for(let n=0;n<45;n++){
    const next=await nextLocalStudy(version.id)
    if(!next.request)break
    const request=next.request
    let response
    if(request.prompt.includes('WHOLE-COURSE GUIDE BUNDLE'))response={guides:[{id:'combine',title:'Combining quantities',topics:[{id:'combine',title:'Combine quantities',topicRefs:['map-0-topic-0']}]},{id:'check',title:'Checking quantities',topics:[{id:'check',title:'Check quantities',topicRefs:['map-0-topic-1']}]}],gaps:[]}
    else if(request.prompt.includes('Map this evidence batch'))response={topics:[{id:'combine',title:'Combine quantities',sourceIds:ids},{id:'check',title:'Check quantities',sourceIds:ids}],gaps:[]}
    else response=teachingResponse(request.prompt,ids)
    if(!response){response=lesson(ids);authorCalls++}
    await submitLocalStudy(version.id,{requestId:request.id,contractId:request.contractId,response})
   }
   const parent=await ownStudyVersion(version.id),revision=await studyRevision(parent)
   assert.equal(parent.draft.status,'complete',JSON.stringify(parent.draft.issues))
   assert.equal(authorCalls,2)
   assert.equal(parent.bundleGuides.length,2)
   const visible=await listOwnStudyVersions(course.courseCode)
   assert.deepEqual(new Set(visible.map(v=>v.id)),new Set(parent.bundleGuides.map(g=>g.id)))
   for(const child of visible){
    assert.equal(child.draft.status,'complete')
    assert.equal((await studyRevision(child)).chapters.length,1)
    assert.equal(child.courseBundleParent.versionId,parent.id)
    assert.equal((await pendingStudyVersions()).some(row=>row.key===child.id),false)
   }
   const again=await materializeCourseBundle(parent,revision,{})
   assert.deepEqual(again.guides.map(g=>g.id),parent.bundleGuides.map(g=>g.id))
   for(const child of visible)assert.equal((await ownStudyVersion(child.id)).history.length,1)
   assert.equal((await nextLocalStudy(version.id)).request,null)
  }finally{await deleteAllDocuments()}
 })
})
