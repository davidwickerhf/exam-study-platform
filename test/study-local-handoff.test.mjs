import test from 'node:test'
import assert from 'node:assert/strict'
import {localStudyTask,localStudyNextAction} from '../lib/study-local-handoff.mjs'
import {LocalStudyRequest,studyGenerationContract} from '../lib/study-generation-contract.mjs'

test('local work packets identify isolated review phases without adding author context',async()=>{
 const contract=await studyGenerationContract()
 for(const phase of ['factual-solve','factual-answers','factual-content','pedagogical-review']){
  const options={stage:'quality',usageMetadata:{phase,chapterId:'mechanism'},responseSchema:{type:'object'},maxOutputTokens:32000,reasoningEffort:'low'}
  const request=new LocalStudyRequest('Exact step evidence only',options,contract,'draft').localStudyRequest
  assert.equal(request.task.contextMode,'fresh-isolated')
  assert.equal(request.task.role,phase==='factual-solve'?'independent-solver':'reviewer')
  assert.equal(request.task.phase,phase);assert.equal(request.task.chapterId,'mechanism')
  assert.equal(request.prompt,'Exact step evidence only');assert.deepEqual(request.responseSchema,options.responseSchema)
  assert.equal(request.reasoningEffort,'low')
 }
 assert.equal(localStudyTask({usageMetadata:{phase:'teaching-plan'}}).contextMode,'request-scoped')
 assert.match(contract.handoff.review,/cannot isolate/)
 assert.match(contract.handoff.provenance,/client reviewer/)
})

test('next actions distinguish work, busy leases, activation and terminal review failure',()=>{
 const version={id:'version',activeRevisionId:null,draft:{status:'local-ready',runAfter:0}}
 assert.deepEqual(localStudyNextAction(version,null,100),{kind:'next',tool:'study_generation_next',args:{versionId:'version'}})
 const request={id:'request',contractId:'contract'}
 version.draft.status='waiting-local'
 assert.deepEqual(localStudyNextAction(version,request,100),{kind:'generate',tool:'study_generation_submit',args:{versionId:'version',requestId:'request',contractId:'contract'},responseField:'response'})
 version.draft.status='local-running';version.draft.lease={expiresAt:100000}
 assert.equal(localStudyNextAction(version,null,100).retryAfterMs,60000)
 version.draft.lease=null;version.draft.runAfter=500
 assert.equal(localStudyNextAction(version,null,100).retryAfterMs,1000)
 for(const status of ['failed','stopped']){
  version.draft.status=status;version.draft.error='Review findings retained'
  const action=localStudyNextAction(version,null,100)
  assert.equal(action.kind,status==='failed'?'blocked':'stopped');assert.equal(action.automaticRetry,false);assert.equal(action.tool,undefined)
 }
 version.draft.status='complete'
 assert.equal(localStudyNextAction(version,null,100).kind,'blocked')
 version.activeRevisionId='revision'
 assert.deepEqual(localStudyNextAction(version,null,100),{kind:'complete',revisionId:'revision',url:'/app/study/version'})
})
