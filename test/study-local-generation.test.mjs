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
import { course, lesson, teachingPlan, teachingResponse } from '../scripts/verification/study-fixtures.mjs'

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
  const plan = await nextLocalStudy(id)
  assert.match(plan.request.prompt, /PLAN THE TEACHING/)
  await answer(id, plan.request, teachingPlan(ids))
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
  let reviews = 0
  for (let i = 0; i < 20; i++) {
    const review = await nextLocalStudy(id)
    if (!review.request) break
    assert.equal(review.request.stage, 'quality')
    const result = teachingResponse(review.request.prompt, ids)
    assert.ok(result, 'all review stages use the shared contract')
    await answer(id, review.request, result)
    reviews++
  }
  assert.equal(reviews, 10)
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
  let repair
  for (let i = 0; i < 20; i++) {
    const review = await nextLocalStudy(id)
    if (review.request.prompt.includes('smallest coherent changes')) { repair = review; break }
    await answer(id, review.request, teachingResponse(review.request.prompt, ids, {reviewIssues:[{topicId:'addition',severity:'error',detail:'The example assumes disjoint groups; explain that assumption before the calculation.'}]}))
  }
  assert.ok(repair)
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

for(const attempts of [0,3])test(`missing follow-up targets use the shared correction policy at ${attempts} attempts`,async()=>fixture(async id=>{
  const ids=await map(id), next=await nextLocalStudy(id)
  await answer(id,next.request,lesson(ids))
  await mutateStudyVersion(id,version=>{
    const chapter=version.draft.chapters[0]
    chapter.questions[0].objectiveIds=['objective-1']
    for(const question of chapter.questions.slice(1))question.objectiveIds=['objective-2','objective-3']
    version.draft.automaticRepairs={addition:attempts}
  })
  const result=await nextLocalStudy(id)
  const version=await ownStudyVersion(id)
  assert.equal(version.activeRevisionId,null)
  if(attempts===0){
    assert.ok(result.request)
    assert.match(result.request.prompt,/Missing related practice for question-1/)
    assert.match(result.request.prompt,/Return the complete chapter/)
    assert.equal(version.draft.automaticRepairs.addition,1)
    assert.equal(version.draft.correctionHistory.at(-1).phase,'links')
    const duplicate=await nextLocalStudy(id)
    assert.equal(duplicate.request.id,result.request.id)
    assert.equal((await ownStudyVersion(id)).draft.automaticRepairs.addition,1)
  }else{
    assert.equal(result.request,null)
    assert.equal(result.version.status,'failed')
    assert.match(result.version.error,/3 of 3/)
    assert.equal(version.draft.chapters.length,1)
    assert.match(version.draft.issues[0].detail,/Missing related practice/)
  }
}))

for(const rejectedDrafts of [2,99])test(`local correction loop ${rejectedDrafts===2?'recovers from repeated review failures':'stops at its shared limit'} without discarding its base`,async()=>fixture(async id=>{
  const ids=await map(id)
  let drafts=0,lastText='',lastResponse
  for(let index=0;index<100;index++) {
    const next=await nextLocalStudy(id)
    if(!next.request){lastResponse=next;break}
    const findings=drafts<=rejectedDrafts?[{topicId:'addition',severity:'error',detail:'Explain why these groups must be disjoint before adding them.'}]:[]
    let response=teachingResponse(next.request.prompt,ids,{reviewIssues:findings})
    if(!response){
      if(lastText)assert.ok(next.request.prompt.includes(lastText),'each correction receives the immediately preceding saved draft')
      drafts++
      response=lesson(ids)
      response.sections[0].text+=` Teaching revision ${drafts}.`
      lastText=response.sections[0].text
    }
    const result=await answer(id,next.request,response)
    const duplicate=await answer(id,next.request,response)
    assert.equal(duplicate.duplicate,true)
    assert.deepEqual(duplicate.version.corrections,result.version.corrections,'duplicate submissions cannot consume another correction')
  }
  assert.ok(lastResponse,'loop must reach a terminal state')
  const held=await ownStudyVersion(id)
  if(rejectedDrafts===2){
    assert.equal(lastResponse.version.status,'complete')
    assert.equal(drafts,3)
    const revision=await studyRevision(held)
    assert.equal(revision.generation.corrections.attempts.addition,2)
    assert.equal(new Set(revision.generation.corrections.history.map(item=>item.baseHash)).size,2)
  }else{
    assert.equal(lastResponse.version.status,'failed')
    assert.equal(drafts,4,'one initial draft plus three corrections')
    assert.equal(lastResponse.version.corrections.attempts.addition,3)
    assert.match(lastResponse.version.error,/3 of 3/)
    assert.equal(held.activeRevisionId,null)
    assert.equal(held.draft.chapters[0].sections[0].text,lastText)
    const retry=await nextLocalStudy(id,{retry:true})
    assert.ok(retry.request.prompt.includes(lastText))
    assert.equal(retry.version.corrections.attempts.addition,3,'explicit retry does not reset the automatic allowance')
    assert.equal(retry.version.corrections.manualAttempts.addition,1)
  }
}))

test('MCP scope correction persists in both the saved plan and prepared chapter',async()=>fixture(async id=>{
  const ids=await map(id),next=await nextLocalStudy(id)
  await answer(id,next.request,lesson(ids))
  await mutateStudyVersion(id,version=>{
    const chapter=version.draft.chapters[0]
    chapter.teachingPlan.gaps=['No assessment rules were supplied.']
    version.draft.teachingPlans.addition=structuredClone(chapter.teachingPlan)
    version.draft.repair={topicId:'addition',phase:'factual',chapter:structuredClone(chapter)}
    version.draft.chapters=[]
    version.draft.stage='chapters'
    version.draft.issues=[{topicId:'addition',severity:'error',itemKey:'scope',detail:'Correct the false claim that assessment rules were absent.'}]
    version.draft.automaticRepairs={addition:1}
  })
  const repair=await nextLocalStudy(id)
  assert.match(repair.request.prompt,/REPAIR SOURCE SCOPE NOTES/)
  const response={caveats:['No explicit exam-topic exclusions.'],scope:{gaps:['No explicit exam-topic exclusions.'],exclusions:[]}}
  await answer(id,repair.request,response)
  assert.equal((await answer(id,repair.request,response)).duplicate,true)
  const draft=(await ownStudyVersion(id)).draft
  assert.deepEqual(draft.teachingPlans.addition.gaps,response.scope.gaps)
  assert.deepEqual(draft.chapters[0].teachingPlan.gaps,response.scope.gaps)
  assert.equal(draft.automaticRepairs.addition,1)
}))
