import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, listDocuments, deleteDocument } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration } from '../lib/study-version-pipeline.mjs'
import { splitMappingBatch, MAPPING_OUTPUT_RECOVERY_LIMIT, studyMappingConcurrency } from '../lib/study-course-plan.mjs'
import { STUDY_GENERATION_LIMITS } from '../lib/study-generation-limits.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

// The recovery tests below describe the sequential contract: one batch per
// step. Concurrency is a bounded pool over exactly this behaviour, so pinning
// the pool to one is what makes "N=1 is the old path" a checked claim.
async function sequentially(fn) {
  const before=process.env.STUDY_MAPPING_CONCURRENCY
  process.env.STUDY_MAPPING_CONCURRENCY='1'
  try{return await fn()}finally{if(before===undefined)delete process.env.STUDY_MAPPING_CONCURRENCY;else process.env.STUDY_MAPPING_CONCURRENCY=before}
}

const outputLimit=()=>Object.assign(new Error('The AI reached this step’s output limit before finishing.'),{status:502,code:'provider_output_limit'})
const mapped=(prompt)=>({topics:[{id:'addition',title:'Addition',sourceIds:batchIds(prompt)}],gaps:[]})
const batchIds=prompt=>JSON.parse(prompt.split('\nEvidence: ')[1].split('\nMap this evidence batch')[0]).map(c=>c.id)
async function fixture() {
  const userId=`study-mapping-${randomUUID()}`,context={userId,mode:'local'}
  const run=fn=>withRequestContext(context,fn)
  const version=await run(async()=>{
    const note=await addStudyNote({...course,title:'Arithmetic notes'},
      Array.from({length:8},(_,i)=>({page:i+1,text:`Lesson ${i+1}: adding disjoint quantities keeps their matching units and subtraction checks the result.`})))
    return createStudyVersion(course,'programme-test',await readStudySourceSnapshot(course,[note.id]))
  })
  return {run,version,cleanup:()=>run(deleteAllDocuments)}
}
const draftOf=async id=>(await ownStudyVersion(id)).draft
// Drop the shared course plan so a second run must map rather than reuse it.
async function emptyCoursePlan() {
  for(const record of await listDocuments('study-course-plans'))await deleteDocument('study-course-plans',record.key)
}
// Five 36,000-character mapping batches: enough evidence for the default pool
// to hold several independent batches in flight at the same time.
async function wideFixture() {
  const userId=`study-mapping-wide-${randomUUID()}`,context={userId,mode:'local'}
  const run=fn=>withRequestContext(context,fn)
  const page=i=>`Chapter ${i}: `+Array.from({length:200},(_,n)=>`Sentence ${n} of chapter ${i} explains how adding disjoint quantities keeps matching units and subtraction checks the result.`).join(' ')
  const version=await run(async()=>{
    const note=await addStudyNote({...course,title:'Long arithmetic notes'},Array.from({length:6},(_,i)=>({page:i+1,text:page(i+1)})))
    return createStudyVersion(course,'programme-test',await readStudySourceSnapshot(course,[note.id]))
  })
  return {run,version,cleanup:()=>run(deleteAllDocuments)}
}
// A generate that records how many mapping calls were in flight together and
// resolves them in reverse order, so nothing may depend on completion order.
function overlapping(respond=mapped) {
  const state={calls:[],completed:[],peak:0,inFlight:0}
  const generate=async prompt=>{
    const ids=batchIds(prompt)
    state.calls.push(ids)
    state.peak=Math.max(state.peak,++state.inFlight)
    try{
      await new Promise(resolve=>setTimeout(resolve,5*(6-state.inFlight)))
      const result=await respond(prompt,ids)
      state.completed.push(ids)
      return result
    } finally {state.inFlight--}
  }
  return {state,generate}
}

test('one hosted step maps several independent batches at once and merges them in batch order',async()=>{
  const f=await wideFixture()
  try{await f.run(async()=>{
    const {state,generate}=overlapping()
    const before=Date.now()
    await processStudyStep(f.version.id,{generate})
    const draft=await draftOf(f.version.id)
    assert.equal(studyMappingConcurrency(),STUDY_GENERATION_LIMITS.mappingConcurrency)
    assert.equal(draft.mappingBatches.length,5)
    assert.equal(state.calls.length,4,'the pool is bounded by the configured concurrency')
    assert.ok(state.peak>1,'mapping calls genuinely overlap')
    // Order-independent identity: maps follow the recorded batch boundaries,
    // never the order the provider happened to answer in.
    assert.deepEqual(draft.maps.map(m=>m.topics[0].sourceIds),draft.mappingBatches.slice(0,4))
    assert.notDeepEqual(state.completed,draft.mappingBatches.slice(0,4),'responses completed out of order')
    assert.equal(draft.stage,'mapping')
    assert.equal(draft.mappingAccepted,undefined,'a complete round leaves nothing waiting')
    assert.ok(Date.now()-before>=0)
    await processStudyStep(f.version.id,{generate})
    const done=await draftOf(f.version.id)
    assert.equal(done.maps.length,5)
    assert.equal(done.stage,'outline')
    assert.equal(state.calls.length,5,'no batch is mapped twice')
    assert.deepEqual(done.maps.flatMap(m=>m.topics.flatMap(t=>t.sourceIds)).sort(),done.snapshot.chunks.map(c=>c.id).sort())
  })}finally{await f.cleanup()}
})

test('an output limit on one concurrent batch splits only that batch and keeps its peers',async()=>{
  const f=await wideFixture()
  try{await f.run(async()=>{
    // Record the original boundaries without splitting anything, then fail
    // exactly the second batch on the next attempt.
    await processStudyStep(f.version.id,{generate:async()=>{throw new Error('record the boundaries')}})
    const boundaries=(await draftOf(f.version.id)).mappingBatches
    assert.equal(boundaries.length,5)
    await controlStudyGeneration(f.version.id,'retry')
    const failing=JSON.stringify(boundaries[1])
    const {state,generate}=overlapping(async(prompt,ids)=>{
      if(JSON.stringify(ids)===failing)throw outputLimit()
      return mapped(prompt)
    })
    await processStudyStep(f.version.id,{generate})
    const split=await draftOf(f.version.id)
    assert.equal(split.status!=='failed',true)
    // Only the failed batch was halved; the batches around it are untouched.
    assert.equal(split.mappingBatches.length,boundaries.length+1)
    assert.deepEqual(split.mappingBatches[0],boundaries[0])
    assert.deepEqual(split.mappingBatches.slice(3),boundaries.slice(2))
    assert.deepEqual([...split.mappingBatches[1],...split.mappingBatches[2]],boundaries[1])
    // The first batch merged; the batches behind the hole wait, already paid for.
    assert.equal(split.maps.length,1)
    assert.equal(Object.keys(split.mappingAccepted).length,2)
    const mappedBefore=state.calls.length
    for(let i=0;i<4;i++)await processStudyStep(f.version.id,{generate})
    const done=await draftOf(f.version.id)
    assert.equal(done.stage,'outline')
    assert.equal(done.maps.length,6)
    assert.equal(done.mappingAccepted,undefined)
    // The two halves plus the one batch the first bounded round never reached.
    assert.equal(state.calls.length,mappedBefore+3,'no accepted batch was mapped a second time')
    assert.deepEqual(done.maps.map(m=>m.topics[0].sourceIds),done.mappingBatches)
    assert.deepEqual(done.maps.flatMap(m=>m.topics.flatMap(t=>t.sourceIds)).sort(),done.snapshot.chunks.map(c=>c.id).sort())
  })}finally{await f.cleanup()}
})

test('one failed concurrent mapping call preserves every map its peers accepted',async()=>{
  const f=await wideFixture()
  try{await f.run(async()=>{
    await processStudyStep(f.version.id,{generate:async()=>{throw new Error('record the boundaries')}})
    const boundaries=(await draftOf(f.version.id)).mappingBatches
    await controlStudyGeneration(f.version.id,'retry')
    // A spending-limit refusal on one batch, while its peers are in flight.
    let refusals=0
    const capped=JSON.stringify(boundaries[2])
    const {state,generate}=overlapping(async(prompt,ids)=>{
      if(JSON.stringify(ids)===capped && refusals++===0)
        throw Object.assign(new Error('This generation reached its spending cap. Review its progress and explicitly raise the cap to continue.'),{status:429,retryAfter:86400})
      return mapped(prompt)
    })
    await processStudyStep(f.version.id,{generate})
    const stopped=await draftOf(f.version.id)
    assert.match(stopped.error,/spending cap/)
    assert.equal(stopped.stage,'mapping')
    assert.equal(state.calls.length,4,'each batch was requested exactly once, so each reserved exactly once')
    // The three peers that finished keep their accepted maps and citations.
    assert.equal(stopped.maps.length,2)
    assert.equal(Object.keys(stopped.mappingAccepted).length,1)
    assert.deepEqual(stopped.maps.map(m=>m.topics[0].sourceIds),boundaries.slice(0,2))
    assert.deepEqual(stopped.mappingBatches,boundaries,'a refused call never changes the batch boundaries')
    // Raising the cap resumes exactly the unfinished batches.
    await controlStudyGeneration(f.version.id,'retry')
    for(let i=0;i<4;i++)await processStudyStep(f.version.id,{generate})
    const done=await draftOf(f.version.id)
    assert.equal(done.maps.length,5)
    assert.equal(done.stage,'outline')
    assert.equal(done.mappingAccepted,undefined)
    assert.equal(state.calls.length,6,'only the refused batch and the unreached one were mapped afterwards')
    assert.deepEqual(done.maps.map(m=>m.topics[0].sourceIds),boundaries)
  })}finally{await f.cleanup()}
})

test('a pool of one reproduces the sequential mapping result exactly',async()=>{
  const f=await wideFixture()
  try{await f.run(async()=>{
    const concurrent=overlapping()
    for(let i=0;i<8;i++)await processStudyStep(f.version.id,{generate:concurrent.generate})
    const pooled=await draftOf(f.version.id)
    assert.equal(pooled.stage,'outline')
    assert.ok(concurrent.state.peak>1)
    // Map the identical evidence again in a second version with the pool set to
    // one, from an emptied shared plan so nothing is reused instead of mapped.
    await emptyCoursePlan()
    const second=await createStudyVersion(course,'programme-test',structuredClone(pooled.snapshot))
    const sequential=await sequentially(async()=>{
      const one=overlapping()
      for(let i=0;i<8;i++)await processStudyStep(second.id,{generate:one.generate})
      assert.equal(one.state.peak,1,'a pool of one never overlaps calls')
      assert.equal(one.state.calls.length,5,'one batch per step')
      return draftOf(second.id)
    })
    assert.equal(sequential.stage,'outline')
    assert.deepEqual(sequential.maps,pooled.maps,'the same evidence yields byte-identical maps')
    assert.deepEqual(sequential.mappingBatches,pooled.mappingBatches)
    assert.equal(sequential.mappingAccepted,undefined)
    assert.equal(pooled.mappingAccepted,undefined)
  })}finally{await f.cleanup()}
})

test('the mapping pool is configurable, hard-capped and rejects nonsense',()=>{
  assert.equal(studyMappingConcurrency({}),STUDY_GENERATION_LIMITS.mappingConcurrency)
  assert.equal(studyMappingConcurrency({STUDY_MAPPING_CONCURRENCY:''}),STUDY_GENERATION_LIMITS.mappingConcurrency)
  assert.equal(studyMappingConcurrency({STUDY_MAPPING_CONCURRENCY:'1'}),1)
  assert.equal(studyMappingConcurrency({STUDY_MAPPING_CONCURRENCY:' 3 '}),3)
  assert.equal(studyMappingConcurrency({STUDY_MAPPING_CONCURRENCY:'500'}),STUDY_GENERATION_LIMITS.maxMappingConcurrency)
  for(const bad of ['0','-2','2.5','many'])assert.throws(()=>studyMappingConcurrency({STUDY_MAPPING_CONCURRENCY:bad}),/whole number/)
})

test('one mapping output limit halves that batch and keeps every accepted map',async()=>{
  const f=await fixture()
  try{await sequentially(()=>f.run(async()=>{
    let calls=0
    const generate=async prompt=>{calls++;if(calls===1)throw outputLimit();return mapped(prompt)}
    await processStudyStep(f.version.id,{generate})
    const split=await draftOf(f.version.id)
    assert.equal(split.mappingBatches.length,2)
    assert.equal(split.maps.length,0)
    assert.notEqual(split.status,'failed')
    assert.equal(split.error,null)
    assert.deepEqual(Object.values(split.mappingRecoveries),[1,1])
    await processStudyStep(f.version.id,{generate})
    await processStudyStep(f.version.id,{generate})
    const done=await draftOf(f.version.id)
    assert.equal(calls,3)
    assert.equal(done.maps.length,2)
    assert.equal(done.stage,'outline')
    // No evidence is dropped by a split: both halves are mapped and cited.
    assert.deepEqual(done.maps.flatMap(m=>m.topics.flatMap(t=>t.sourceIds)).sort(),done.snapshot.chunks.map(c=>c.id).sort())
  }))}finally{await f.cleanup()}
})

test('a second output limit splits again and a third fails safely with earlier maps preserved',async()=>{
  const f=await fixture()
  try{await sequentially(()=>f.run(async()=>{
    let calls=0
    const generate=async()=>{calls++;throw outputLimit()}
    for(let i=0;i<4;i++)await processStudyStep(f.version.id,{generate})
    assert.equal(calls,3)
    const saved=await draftOf(f.version.id)
    assert.equal(saved.status,'failed')
    assert.equal(saved.stage,'mapping')
    assert.equal(saved.maps.length,0)
    assert.equal(Math.max(...Object.values(saved.mappingRecoveries)),MAPPING_OUTPUT_RECOVERY_LIMIT)
    assert.equal(saved.mappingBatches.length,3)
    assert.deepEqual(saved.mappingBatches.flat().sort(),saved.snapshot.chunks.map(c=>c.id).sort())
  }))}finally{await f.cleanup()}
})

test('a resumed run repeats the recorded split boundaries and remaps nothing',async()=>{
  const f=await fixture()
  try{await sequentially(()=>f.run(async()=>{
    let calls=0
    const generate=async prompt=>{calls++;if(calls===1)throw outputLimit();return mapped(prompt)}
    await processStudyStep(f.version.id,{generate})
    await processStudyStep(f.version.id,{generate})
    const after=await draftOf(f.version.id)
    assert.equal(after.maps.length,1)
    const boundaries=after.mappingBatches.map(ids=>[...ids])
    // Resuming maps only the recorded remainder; the finished half is never repeated.
    await processStudyStep(f.version.id,{generate:async prompt=>{assert.deepEqual(batchIds(prompt),boundaries[1]);return mapped(prompt)}})
    const resumed=await draftOf(f.version.id)
    assert.deepEqual(resumed.mappingBatches,boundaries)
    assert.deepEqual(resumed.mappingRecoveries,after.mappingRecoveries)
    assert.equal(resumed.maps.length,2)
    assert.equal(resumed.stage,'outline')
    assert.equal(calls,2)
  }))}finally{await f.cleanup()}
})

test('splitting stops at a single evidence passage, at the recovery limit and on legacy drafts',()=>{
  const work={mappingBatches:[['a','b','c'],['d']]}
  assert.equal(splitMappingBatch(work,1),false)
  assert.equal(splitMappingBatch({},0),false)
  assert.equal(splitMappingBatch(work,0),true)
  assert.deepEqual(work.mappingBatches,[['a','b'],['c'],['d']])
  assert.equal(splitMappingBatch(work,0),true)
  assert.deepEqual(work.mappingBatches,[['a'],['b'],['c'],['d']])
  const deep={mappingBatches:[['a','b','c','d','e']],mappingRecoveries:{}}
  assert.equal(splitMappingBatch(deep,0),true)
  assert.equal(splitMappingBatch(deep,0),true)
  assert.equal(splitMappingBatch(deep,0),false)
})
