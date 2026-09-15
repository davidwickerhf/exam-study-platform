import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { addStudyNote, readStudySourceSnapshot } from '../lib/study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { splitMappingBatch, MAPPING_OUTPUT_RECOVERY_LIMIT } from '../lib/study-course-plan.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

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

test('one mapping output limit halves that batch and keeps every accepted map',async()=>{
  const f=await fixture()
  try{await f.run(async()=>{
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
  })}finally{await f.cleanup()}
})

test('a second output limit splits again and a third fails safely with earlier maps preserved',async()=>{
  const f=await fixture()
  try{await f.run(async()=>{
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
  })}finally{await f.cleanup()}
})

test('a resumed run repeats the recorded split boundaries and remaps nothing',async()=>{
  const f=await fixture()
  try{await f.run(async()=>{
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
  })}finally{await f.cleanup()}
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
