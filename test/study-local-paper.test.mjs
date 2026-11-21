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

test('dry-run accepts parsed IDs/page bindings, reports exact bad citations, and preserves provenance on replay',()=>fixture(async()=>{
  const {state,response,route,source}=await start()
  const parsed=structuredClone(response);const q=parsed.questions[0]
  q.id='paper-2025-p1-q1';q.sourceKey=source.key;delete q.sourceIds
  q.paperId='selected-pages-not-a-complete-exam';q.visualPages=[1];q.needsOriginal=true
  q.answerBasis='generated';q.answer='An illustrative explanation.'
  const body={requestId:state.request.requestId,manifestHash:state.request.evidenceManifest.hash,response:parsed}
  const dry=await api(`${route}/validate`,body)
  assert.equal(dry.valid,true);assert.equal(dry.dryRun,true)
  assert.equal((await api(`${route}/next`)).request.requestId,body.requestId)
  const bad=structuredClone(body);bad.response.questions[0].sourceIds=['bad-citation']
  const invalid=await api(`${route}/validate`,bad)
  assert.equal(invalid.valid,false);assert.equal(invalid.issues[0].questionId,q.id);assert.equal(invalid.issues[0].citation,'bad-citation')
  const review=await api(`${route}/submit`,body)
  const complete=await api(`${route}/submit`,{requestId:review.request.requestId,response:{issues:[]}})
  assert.equal(complete.set.result.questions[0].id,q.id)
  assert.equal(complete.set.result.questions[0].original.paperId,q.paperId)
  assert.equal(complete.set.result.questions[0].answerBasis,'unavailable')
  assert.equal(complete.set.result.questions[0].workedAnswer.provenance,'generated-not-official')
  assert.equal((await api(`${route}/submit`,body)).set.result.questions.length,1)
}))

test('original image transcription requires an explicit hash/page binding and cannot use private notes as an original',async()=>{
  const {validateLocalPaperImport}=await import('../lib/study-practice.mjs')
  const record={mode:'extract',questionSourceKey:'canvas-a',snapshot:{sources:[{key:'canvas-a',sha256:'original-sha',kind:'canvas'}],chunks:[{id:'e-a',sourceKey:'canvas-a',page:1,text:'Image label only.'}]}}
  const response={title:'Image paper',questions:[{id:'stable-image-question',label:'6a',sourceKey:'canvas-a',page:1,marks:null,options:[],question:'An image question transcribed from the original.',answerBasis:'unavailable',answer:'',correctOptions:[],needsOriginal:true}],warnings:[]}
  assert.equal(validateLocalPaperImport(response,record).valid,false)
  response.questions[0].originalTranscription={sourceKey:'canvas-a',sha256:'original-sha',page:1,reason:'image'}
  const checked=validateLocalPaperImport(response,record)
  assert.equal(checked.valid,true)
  record.snapshot.chunks=[]
  assert.equal(validateLocalPaperImport(response,record).valid,true)
  response.questions[0].sourceIds=['invented']
  assert.equal(validateLocalPaperImport(response,record).valid,false)
  delete response.questions[0].sourceIds
  assert.equal(checked.result.questions[0].questionProvenance,'client-transcribed-original')
  assert.equal(checked.result.questions[0].needsOriginal,true)
  response.questions[0].originalTranscription.sha256='wrong'
  assert.equal(validateLocalPaperImport(response,record).valid,false)
  response.questions[0].originalTranscription.sha256='original-sha'
  record.snapshot.sources[0].kind='notes'
  assert.equal(validateLocalPaperImport(response,record).valid,false)
})

test('a transcribed original cannot activate without a matching affirmative original-page review',()=>fixture(async()=>{
  const sourceOptions={editorialSources:async()=>[{key:'image-original',title:'Exam.pdf',academicYear:course.academicYear,sha256:'image-sha',pages:[]},{key:'supporting-diagram',title:'Maze.pdf',academicYear:course.academicYear,sha256:'maze-sha',pages:[]}]}
  const request=async(pathname,body)=>(await studyVersionApi({pathname,method:'POST',body,sourceOptions})).data
  const start=await request('/api/study-versions/course-papers/local',{...course,questionSourceKey:'image-original',supportingSourceKeys:['supporting-diagram'],fromPage:1,toPage:2,confirmed:true})
  assert.equal(start.request.evidenceManifest.chunks.length,0)
  assert.deepEqual(start.request.evidenceManifest.questionPageRange,{from:1,to:2})
  assert.ok(start.request.responseSchema.properties.questions.items.properties.originalTranscription)
  assert.equal(start.request.responseSchema.properties.questions.items.properties.sourceIds.minItems,undefined)
  assert.equal(start.request.evidenceManifest.sources.find(s=>s.key==='supporting-diagram').sha256,'maze-sha')
  const route=`/api/study-versions/${start.set.versionId}/papers/${start.set.id}`
  const response={title:'Transcribed paper',questions:[{id:'image-q1',label:'1',question:'Explain the original diagram.',page:1,marks:null,options:[],correctOptions:[],answerBasis:'unavailable',answer:'',needsOriginal:true,originalTranscription:{sourceKey:'image-original',sha256:'image-sha',page:1,reason:'image'}}],warnings:[]}
  response.questions[0].dependencies=[{sourceKey:'supporting-diagram',page:1}]
  const outside=structuredClone(response);outside.questions[0].page=3;outside.questions[0].originalTranscription.page=3
  await assert.rejects(()=>request(`${route}/submit`,{requestId:start.request.requestId,response:outside}),/outside the selected page range/)
  const review=await request(`${route}/submit`,{requestId:start.request.requestId,response})
  await assert.rejects(()=>request(`${route}/submit`,{requestId:review.request.requestId,response:{issues:[]}}),/format/)
  const original={questionId:'image-q1',sourceKey:'image-original',sha256:'image-sha',page:1,reviewed:false}
  await assert.rejects(()=>request(`${route}/submit`,{requestId:review.request.requestId,response:{issues:[],originalChecks:[original]}}),/every transcribed/)
  const ready=await request(`${route}/submit`,{requestId:review.request.requestId,response:{issues:[],originalChecks:[{...original,reviewed:true}]}})
  assert.equal(ready.set.status,'complete')
  assert.equal(ready.set.result.questions[0].questionProvenance,'client-transcribed-original')
  assert.equal(ready.set.localReview.provenance,'client-reported')
}))
