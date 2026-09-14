import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, deleteDocument, readDocument, compareAndSwapDocument } from '../lib/user-store.mjs'
import { addStudyNote, listStudySources } from '../lib/study-version-sources.mjs'
import { studyVersionApi } from '../lib/study-version-api.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'
import { coursePaperBank } from '../lib/study-paper-bank.mjs'
import { activeProgrammeId } from '../lib/programme-scope.mjs'
import { stepStudyPractice } from '../lib/study-practice.mjs'
const fixture = fn => withRequestContext({userId:`local-paper-${randomUUID()}`,mode:'api-key',scopes:['read','write']},async()=>{try{await fn()}finally{await deleteAllDocuments()}})
const api = async (pathname,body={}) => (await studyVersionApi({pathname,method:'POST',body})).data
async function start() {
  const note=await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain why a blocked task does not wake when an ordinary variable changes.'}])
  const source=(await listStudySources(course))[0]
  const state=await api('/api/study-versions/course-papers/local',{...course,questionSourceKey:source.key,confirmed:true})
  const chunks=JSON.parse(state.request.prompt.split('EVIDENCE: ').at(-1))
  const response={title:'Original paper',questions:chunks.map(c=>({label:'1',question:c.text,sharedContext:'',type:'written',options:[],correctOptions:[],marks:null,page:c.page,answer:'',answerBasis:'unavailable',hint:'',difficulty:'standard',sourceIds:[c.id],answerSourceIds:[],needsOriginal:false})),warnings:[]}
  const route=`/api/study-versions/${state.set.versionId}/papers/${state.set.id}`
  return {note,state,response,route,source}
}
test('local paper import validates exact citations, reviews and activates the course library without hosted calls',()=>fixture(async()=>{
  const {state,response,route}=await start()
  await assert.rejects(()=>stepStudyPractice(state.set.versionId,state.set.id,{generate:()=>{throw Error('must not run')}}),/local paper workflow/)
  const bad=structuredClone(response);bad.questions[0].sourceIds=['invented']
  await assert.rejects(()=>api(`${route}/submit`,{requestId:state.request.requestId,response:bad}),/citation/)
  assert.equal((await api(`${route}/next`)).request.requestId,state.request.requestId)
  const body={requestId:state.request.requestId,response}
  const review=await api(`${route}/submit`,body)
  assert.equal(review.request.stage,'review')
  assert.equal((await api(`${route}/submit`,body)).request.requestId,review.request.requestId)
  await assert.rejects(()=>api(`${route}/submit`,{...body,response:bad}),/different response/)
  const complete=await api(`${route}/submit`,{requestId:review.request.requestId,response:{issues:[]}})
  assert.equal(complete.set.status,'complete');assert.equal(complete.request,null)
  assert.equal(complete.set.localReview.provenance,'client-reported')
  const bank=await coursePaperBank({course,programmeId:await activeProgrammeId()})
  assert.equal(bank.sets.find(s=>s.id===state.set.id).questionCount,1)
  assert.equal(complete.set.billingSource,undefined)
}))
test('local paper review has a bounded correction with the original candidate and remains inactive on failure',()=>fixture(async()=>{
  const {state,response,route}=await start()
  let review=await api(`${route}/submit`,{requestId:state.request.requestId,response})
  const correction=await api(`${route}/submit`,{requestId:review.request.requestId,response:{issues:['Check omitted subquestion.']}})
  assert.match(correction.request.prompt,/PREVIOUS CANDIDATE/)
  assert.ok(correction.request.prompt.includes(response.questions[0].question))
  review=await api(`${route}/submit`,{requestId:correction.request.requestId,response})
  const failed=await api(`${route}/submit`,{requestId:review.request.requestId,response:{issues:['Still omitted.']}})
  assert.equal(failed.set.status,'failed');assert.equal(failed.request,null)
}))
test('local imports reject invented text and revoked evidence; request IDs cannot cross owners',()=>fixture(async()=>{
  const {note,state,response,route}=await start()
  const bad=structuredClone(response);bad.questions[0].question='Invented question.'
  await assert.rejects(()=>api(`${route}/submit`,{requestId:state.request.requestId,response:bad}),/differs/)
  await withRequestContext({userId:`other-${randomUUID()}`,mode:'local'},async()=>{
    await assert.rejects(()=>api(`${route}/next`),/not found|access/i)
  })
  await deleteDocument('study-notes',note.id)
  await assert.rejects(()=>api(`${route}/submit`,{requestId:state.request.requestId,response}),/accessible/)
}))

test('changed paper content invalidates a pending import without activating stale questions',()=>fixture(async()=>{
  const {note,state,response,route}=await start()
  const old=await readDocument('study-notes',note.id,null)
  await compareAndSwapDocument('study-notes',note.id,{...old,revision:randomUUID(),pages:[{page:1,text:'A changed paper.'}]},old.revision)
  await assert.rejects(()=>api(`${route}/submit`,{requestId:state.request.requestId,response}),/paper changed/)
}))
