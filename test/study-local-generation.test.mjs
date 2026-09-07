import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { ownStudyVersion, studyRevision, pendingStudyVersions, mutateStudyVersion } from '../lib/study-version-store.mjs'
import { processStudyStep, controlStudyGeneration } from '../lib/study-version-pipeline.mjs'
import { startLocalStudy, nextLocalStudy, submitLocalStudy, addLocalStudyNotes } from '../lib/study-local-generation.mjs'
import { studyVersionApi } from '../lib/study-version-api.mjs'
import { studyGenerationContract } from '../lib/study-generation-contract.mjs'
import { authorise } from '../lib/auth.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'

async function fixture(fn) {
  await withRequestContext({ userId: `local-study-${randomUUID()}`, mode: 'local' }, async () => {
    try {
      const note = await addLocalStudyNotes({...course,title:'Lecture extraction',pages:[{page:2,text:'Adding disjoint quantities: two plus three equals five. Subtract to check. All quantities need matching units.'}]})
      const {version} = await startLocalStudy({...course,sourceKeys:[note.id]})
      await fn(version.id, note)
    } finally { await deleteAllDocuments() }
  })
}
const answer = (id, request, response) => submitLocalStudy(id, {requestId:request.id,contractId:request.contractId,response})
async function map(id) {
  const {request} = await nextLocalStudy(id)
  const ids = (await ownStudyVersion(id)).draft.snapshot.chunks.map(c=>c.id)
  await answer(id,request,{topics:[{id:'addition',title:'Addition',sourceIds:ids}],gaps:[]})
  return ids
}

test('local generation uses the real staged pipeline without hosted dispatch and retains provenance', async()=>fixture(async id=>{
  let hostedCalls = 0
  assert.equal((await ownStudyVersion(id)).draft.status,'local-ready')
  assert.equal((await pendingStudyVersions()).some(v=>v.key===id),false)
  await processStudyStep(id,{generate:async()=>{hostedCalls++;throw Error('must not call')}})
  assert.equal(hostedCalls,0)
  const first = await nextLocalStudy(id), same = await nextLocalStudy(id)
  assert.deepEqual(first.request,same.request)
  assert.ok(first.request.responseSchema)
  const ids = await map(id)
  const chapter = await nextLocalStudy(id)
  assert.match(chapter.request.prompt,/Addition/)
  const response = lesson(ids)
  const accepted = await answer(id,chapter.request,response)
  assert.equal(accepted.accepted,true)
  const duplicate = await answer(id,chapter.request,response)
  assert.equal(duplicate.duplicate,true)
  await assert.rejects(answer(id,chapter.request,{different:true}),/different result/)
  const review = await nextLocalStudy(id)
  assert.equal(review.request.stage,'quality')
  assert.match(review.request.prompt,/Independently check/)
  await answer(id,review.request,{issues:[]})
  const finished = await nextLocalStudy(id)
  assert.equal(finished.version.status,'complete')
  assert.equal(finished.request,null)
  assert.equal(finished.version.url,`/app/study/${id}`)
  const revision = await studyRevision(await ownStudyVersion(id))
  assert.equal(revision.chapters[0].review,'passed')
  assert.equal(revision.generation.execution,'local')
  assert.equal(revision.generation.semanticReview,'local-agent')
  assert.equal(revision.generation.contractId,(await studyGenerationContract()).id)
  assert.equal((await pendingStudyVersions()).some(v=>v.key===id),false)
}))

test('local semantic findings trigger the same chapter repair and preserve useful work',async()=>fixture(async id=>{
  const ids=await map(id), chapter=await nextLocalStudy(id)
  await answer(id,chapter.request,lesson(ids))
  const review=await nextLocalStudy(id)
  await answer(id,review.request,{issues:[{topicId:'addition',severity:'error',detail:'The example assumes disjoint groups; explain that assumption before the calculation.'}]})
  const repair=await nextLocalStudy(id)
  assert.match(repair.request.prompt,/smallest coherent changes/)
  assert.match(repair.request.prompt,/disjoint groups/)
  assert.equal((await ownStudyVersion(id)).activeRevisionId,null)
}))

test('local results cannot bypass schema, citation or teaching-quality checks',async()=>fixture(async id=>{
  const ids=await map(id)
  let step=await nextLocalStudy(id)
  let result=await answer(id,step.request,{title:'Tiny lesson'})
  assert.equal(result.version.status,'failed')
  step=await nextLocalStudy(id,{retry:true})
  const badCitation=lesson(ids);badCitation.sections[0].sourceIds=['invented-source']
  result=await answer(id,step.request,badCitation)
  assert.equal(result.version.status,'failed')
  step=await nextLocalStudy(id,{retry:true})
  const badTeaching=lesson(ids);badTeaching.flashcards[0].front='What question is on the slide?'
  await answer(id,step.request,badTeaching)
  const version=await ownStudyVersion(id)
  assert.equal(version.activeRevisionId,null)
  assert.ok(version.draft.issues.length>0)
}))

test('stale contract, stopped work, source revocation and another account cannot accept a local result',async()=>fixture(async id=>{
  const step=await nextLocalStudy(id)
  await assert.rejects(submitLocalStudy(id,{requestId:step.request.id,contractId:'outdated',response:{}}),/pipeline changed/)
  await mutateStudyVersion(id,next=>{next.draft.localRequest.contractId='old-deployment'})
  const updated=await nextLocalStudy(id)
  assert.notEqual(updated.request.id,step.request.id)
  await assert.rejects(answer(id,step.request,{}),/stale/)
  await withRequestContext({userId:`other-${randomUUID()}`,mode:'local'},async()=>{
    await assert.rejects(nextLocalStudy(id),/not found/i)
    await assert.rejects(answer(id,updated.request,{}),/not found/i)
  })
  await controlStudyGeneration(id,'stop')
  await assert.rejects(answer(id,updated.request,{}),/stale/)
  await nextLocalStudy(id,{retry:true})
  await mutateStudyVersion(id,next=>{next.draft.snapshot.sources[0].key='missing-source'})
  await assert.rejects(nextLocalStudy(id),/no longer accessible/)
}))

test('read-only API keys cannot advance local generation; hosted actions cannot bill local versions',async()=>fixture(async id=>{
  assert.match(authorise({mode:'api-key',scopes:['read']},{method:'POST',pathname:`/api/study-versions/${id}/local/next`}),/read-only/)
  assert.equal(authorise({mode:'api-key',scopes:['read','write']},{method:'POST',pathname:`/api/study-versions/${id}/local/next`}),null)
  await assert.rejects(studyVersionApi({pathname:`/api/study-versions/${id}/retry`,method:'POST',body:{},query:{}}),/local agent/)
}))
