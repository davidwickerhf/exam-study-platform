// Concurrent source mapping over the local next/submit protocol. Only mapping
// hands out more than one packet; every other step stays a single request.
import { STUDY_GENERATION_LIMITS } from '../lib/study-generation-limits.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { ownStudyVersion, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy, addLocalStudyNotes } from '../lib/study-local-generation.mjs'
import { studyGenerationContract } from '../lib/study-generation-contract.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

const answer = (id, request, response) => submitLocalStudy(id, {requestId:request.id,contractId:request.contractId,response})
// Six long pages become five 36,000-character mapping batches, so the default
// pool of four leaves a remainder that must still be mapped afterwards.
async function fixture(fn) {
  await withRequestContext({ userId: `local-map-${randomUUID()}`, mode: 'local' }, async () => {
    try {
      const page=i=>`Chapter ${i}: `+Array.from({length:200},(_,n)=>`Sentence ${n} of chapter ${i} explains how adding disjoint quantities keeps matching units and subtraction checks the result.`).join(' ')
      const note=await addLocalStudyNotes({...course,title:'Long lecture extraction',pages:Array.from({length:6},(_,i)=>({page:i+1,text:page(i+1)}))})
      const {version}=await startLocalStudy({...course,sourceKeys:[note.id]})
      await fn(version.id)
    } finally { await deleteAllDocuments() }
  })
}
const batchIds=request=>JSON.parse(request.prompt.split('\nEvidence: ')[1].split('\nMap this evidence batch')[0]).map(c=>c.id)
const mapFor=request=>({topics:[{id:'addition',title:'Addition',sourceIds:batchIds(request)}],gaps:[]})

test('next hands out a bounded set of mapping requests that submit in any order',async()=>fixture(async id=>{
  const step=await nextLocalStudy(id)
  assert.equal(step.requests.length,STUDY_GENERATION_LIMITS.mappingConcurrency)
  // Old clients that only read `request`/`nextAction` still get the first one.
  assert.deepEqual(step.request,step.requests[0])
  assert.equal(step.nextAction.args.requestId,step.requests[0].id)
  assert.equal(step.nextAction.kind,'generate')
  assert.equal(new Set(step.requests.map(r=>r.id)).size,step.requests.length)
  assert.equal(new Set(step.requests.map(r=>r.inputHash)).size,step.requests.length)
  for(const request of step.requests){
    assert.ok(request.responseSchema && request.maxOutputTokens)
    assert.equal(request.usageMetadata.phase,'source-mapping')
    assert.equal(request.contractId,step.requests[0].contractId)
  }
  // Scoped evidence: each packet carries its own batch and no other batch.
  const scopes=step.requests.map(batchIds)
  assert.equal(new Set(scopes.flat()).size,scopes.flat().length)
  // Fetching next again while packets are outstanding changes nothing.
  assert.deepEqual((await nextLocalStudy(id)).requests,step.requests)
  // Submit in reverse order; every peer keeps its ID while it stays pending.
  const reversed=[...step.requests].reverse()
  for(const [position,request] of reversed.slice(0,3).entries()){
    assert.equal((await answer(id,request,mapFor(request))).accepted,true)
    const held=await nextLocalStudy(id)
    // Accepting one frees a slot, so the bounded pool refills from the batches
    // the first round never reached. Untouched peers keep their request IDs.
    assert.ok(held.requests.length>=1 && held.requests.length<=STUDY_GENERATION_LIMITS.mappingConcurrency,'the outstanding set stays bounded by the pool')
    assert.equal(new Set(held.requests.map(r=>r.id)).size,held.requests.length)
    assert.equal((await ownStudyVersion(id)).draft.maps.length+Object.keys((await ownStudyVersion(id)).draft.mappingAccepted||{}).length,position+1,'each accepted map is kept exactly once')
    const survivors=step.requests.filter(original=>!reversed.slice(0,position+1).includes(original))
    assert.ok(survivors.every(original=>held.requests.some(pending=>pending.id===original.id)),'pending peers keep their request IDs')
  }
  const last=reversed[3]
  // An exact repeat replays the saved receipt; a changed response is refused.
  await answer(id,last,mapFor(last))
  assert.equal((await answer(id,last,mapFor(last))).duplicate,true)
  await assert.rejects(answer(id,last,{topics:[],gaps:['changed']}),/different result/)
  const after=await nextLocalStudy(id)
  assert.equal((await ownStudyVersion(id)).draft.maps.length,4)
  assert.equal(after.requests.length,1,'the remaining batch becomes a single request')
  assert.equal((await ownStudyVersion(id)).draft.localRequests,undefined,'a single outstanding packet stores no set')
  await answer(id,after.request,mapFor(after.request))
  const outline=await nextLocalStudy(id)
  assert.equal(outline.requests.length,1,'only mapping is parallelised')
  const draft=(await ownStudyVersion(id)).draft
  assert.equal(draft.stage,'outline')
  assert.equal(draft.maps.length,5)
  assert.equal(draft.mappingAccepted,undefined)
  assert.deepEqual(draft.maps.map(m=>m.topics[0].sourceIds),draft.mappingBatches)
}))

test('two concurrent mapping submissions serialize on the lease without rejecting each other',async()=>fixture(async id=>{
  const step=await nextLocalStudy(id)
  const [first,second]=step.requests
  const results=await Promise.all([
    answer(id,first,mapFor(first)),
    answer(id,second,mapFor(second))
  ])
  assert.deepEqual(results.map(r=>r.accepted),[true,true],'neither submission rejects the other')
  assert.deepEqual(results.map(r=>r.busy),[false,false])
  const saved=await ownStudyVersion(id)
  assert.equal(saved.localReceipts.length,2,'each submission recorded exactly one receipt')
  assert.equal(saved.draft.maps.length,2,'both accepted maps are committed, in batch order')
  assert.deepEqual(saved.draft.maps.map(m=>m.topics[0].sourceIds),saved.draft.mappingBatches.slice(0,2))
  const held=await nextLocalStudy(id)
  assert.equal(held.requests.length,3,'the remaining batches, bounded by the pool')
  assert.ok([step.requests[2],step.requests[3]].every(original=>held.requests.some(r=>r.id===original.id)),'untouched peers keep their request IDs')
}))

test('a contract change reissues every outstanding mapping request and keeps accepted maps',async()=>fixture(async id=>{
  const step=await nextLocalStudy(id)
  assert.equal(step.requests.length,4)
  await answer(id,step.requests[1],mapFor(step.requests[1]))
  await mutateStudyVersion(id,next=>{
    next.draft.localContractId='old-deployment'
    next.draft.localRequest.contractId='old-deployment'
    for(const request of next.draft.localRequests)request.contractId='old-deployment'
  })
  const reissued=await nextLocalStudy(id)
  assert.equal(reissued.requests.length,4,'the accepted batch is not reissued and the pool refills')
  assert.ok(reissued.requests.every(request=>!step.requests.some(old=>old.id===request.id)),'every outstanding request is reissued')
  assert.equal(reissued.requests[0].contractId,(await studyGenerationContract()).id)
  await assert.rejects(answer(id,step.requests[0],mapFor(step.requests[0])),/stale|pipeline changed/)
  assert.equal(Object.keys((await ownStudyVersion(id)).draft.mappingAccepted).length,1,'the accepted map survives the reissue')
  for(const request of reissued.requests)await answer(id,request,mapFor(request))
  const draft=(await ownStudyVersion(id)).draft
  assert.equal(draft.stage,'outline')
  assert.equal(draft.maps.length,5)
  assert.deepEqual(draft.maps.map(m=>m.topics[0].sourceIds),draft.mappingBatches)
}))

test('a pool of one keeps the local protocol on exactly one outstanding request',async()=>{
  const before=process.env.STUDY_MAPPING_CONCURRENCY
  process.env.STUDY_MAPPING_CONCURRENCY='1'
  try{
    await fixture(async id=>{
      for(let batch=0;batch<5;batch++){
        const step=await nextLocalStudy(id)
        assert.equal(step.requests.length,1)
        assert.deepEqual(step.request,step.requests[0])
        assert.equal((await ownStudyVersion(id)).draft.localRequests,undefined)
        assert.equal((await ownStudyVersion(id)).draft.maps.length,batch)
        await answer(id,step.request,mapFor(step.request))
      }
      const draft=(await ownStudyVersion(id)).draft
      assert.equal(draft.stage,'outline')
      assert.equal(draft.maps.length,5)
      assert.equal(draft.mappingAccepted,undefined)
    })
  } finally { if(before===undefined)delete process.env.STUDY_MAPPING_CONCURRENCY;else process.env.STUDY_MAPPING_CONCURRENCY=before }
})
