import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument, listDocuments, deleteDocument } from '../lib/user-store.mjs'
import { addStudyNote, listStudySources } from '../lib/study-version-sources.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'
import { queueCoursePapers, processPaperJob, PAPER_JOBS, claimPaperDispatch, retryPaperJob, paperSections, combinePaperSections, paperJobRecord } from '../lib/study-paper-jobs.mjs'
import { coursePaperBank } from '../lib/study-paper-bank.mjs'
import { activeProgrammeId } from '../lib/programme-scope.mjs'
const platform={configured:true,provider:'openai',model:'gpt-5-mini'}
async function fixture(fn) { return withRequestContext({userId:`paper-job-${randomUUID()}`,mode:'local'},async()=>{try{await fn()}finally{await deleteAllDocuments()}}) }
function question(c) { return {label:`${c.page}`,question:c.text,sharedContext:'',type:'written',options:[],correctOptions:[],marks:null,page:c.page,answer:'',answerBasis:'unavailable',hint:'',difficulty:'standard',sourceIds:[c.id],answerSourceIds:[],needsOriginal:false} }
function generation(calls) {return async(prompt,opts)=>{
  calls.push(opts)
  if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
  const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1))
  return JSON.stringify({title:'Original questions',questions:chunks.map(question),warnings:[]})
}}
async function drain(id,options){for(let i=0;i<20;i++){if(!(await processPaperJob(id,options)).again)return}throw new Error('Job did not finish')}
test('retrieved papers run without a browser, join all pages, dedupe overlap and respect a single budget identity',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Practice exam.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  await addStudyNote({...course,title:'Practice exam solutions.pdf'},[{page:1,text:'Solutions only.'}])
  const [a,b]=await Promise.all([queueCoursePapers(course),queueCoursePapers(course)])
  assert.equal(a.length,1);assert.equal(a[0].id,b[0].id)
  const claims=await Promise.all([claimPaperDispatch(),claimPaperDispatch()])
  assert.equal(claims.flat().filter(id=>id===a[0].id).length,1)
  const calls=[]
  await drain(a[0].id,{platform,generate:generation(calls)})
  const job=await readDocument(PAPER_JOBS,a[0].id,null)
  assert.equal(job.status,'complete',job.error);assert.equal(job.completedSections,2)
  const set=await readDocument('study-practice',job.setId,null)
  assert.equal(set.result.questions.length,8);assert.equal(set.snapshot.chunks.length,8)
  assert.ok(set.result.questions.every(q=>q.answerBasis==='unavailable' && q.answer===''))
  assert.equal(new Set(calls.map(c=>c.jobKey)).size,1);assert.equal(calls[0].jobKey,job.id)
  const previous=calls.length
  await drain(job.id,{platform,generate:generation(calls)})
  await queueCoursePapers({...course,academicYear:'2025-2026'})
  assert.equal(calls.length,previous);assert.equal((await listDocuments(PAPER_JOBS)).length,1)
  const bank=await coursePaperBank({course,programmeId:await activeProgrammeId()})
  assert.equal(bank.sets.length,1);assert.equal(bank.sets[0].questionCount,8)
}))
test('provider failures pause paid work, explicit retry resumes, revoked sources prevent further calls',async()=>fixture(async()=>{
  const note=await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [job]=await queueCoursePapers(course)
  let calls=0
  const fail=async()=>{calls++;throw Object.assign(new Error('Provider rate limit'),{status:429})}
  await drain(job.id,{platform,generate:fail})
  assert.equal((await readDocument(PAPER_JOBS,job.id,null)).status,'paused')
  await drain(job.id,{platform,generate:fail});await queueCoursePapers(course);assert.equal(calls,1)
  await retryPaperJob(job.id)
  await deleteDocument('study-notes',note.id)
  await drain(job.id,{platform,generate:fail})
  assert.equal(calls,1);assert.match((await readDocument(PAPER_JOBS,job.id,null)).error,/access|changed/)
}))
test('paper job identities isolate owners and content changes; ranges never drop pages and conflicting overlaps fail',()=>{
  const source={key:'x',title:'exam.pdf',sha256:'one'}
  assert.notEqual(paperJobRecord('a','p',course,source).id,paperJobRecord('b','p',course,source).id)
  assert.notEqual(paperJobRecord('a','p',course,source).id,paperJobRecord('a','p',course,{...source,sha256:'two'}).id)
  const sections=paperSections(Array.from({length:15},(_,i)=>({page:i+1,text:'x'.repeat(12000)})))
  assert.deepEqual([...new Set(sections.flatMap(s=>Array.from({length:s.to-s.from+1},(_,i)=>s.from+i)))],Array.from({length:15},(_,i)=>i+1))
  const q={...question({id:'c',page:1,text:'Original question'}),id:'q-1'}
  assert.throws(()=>combinePaperSections([{result:{questions:[q]}},{result:{questions:[{...q,marks:2}]}}]),/disagree/)
})

test('automatic preparation reuses an identical completed manual extraction without another paid call',async()=>fixture(async()=>{
  const {coursePracticeHost}=await import('../lib/study-course-practice.mjs')
  const {createStudyPractice,stepStudyPractice}=await import('../lib/study-practice.mjs')
  await addStudyNote({...course,title:'Practice exam.pdf'},[{page:1,text:'Explain this original exam question.'}])
  const source=(await listStudySources(course))[0],host=await coursePracticeHost(course,await activeProgrammeId())
  let manual=await createStudyPractice(host.id,{mode:'extract',questionSourceKey:source.key,includeHistorical:true},{billing:{source:'platform',model:'gpt-5-mini',provider:'openai',maxJobUsd:1}})
  const initial=[]
  while(manual.status==='pending')manual=await stepStudyPractice(host.id,manual.id,{generate:generation(initial)})
  assert.equal(manual.status,'complete')
  const [job]=await queueCoursePapers(course),calls=[]
  await drain(job.id,{platform,generate:generation(calls)})
  assert.equal((await readDocument(PAPER_JOBS,job.id,null)).status,'complete')
  assert.equal(calls.length,0)
}))
