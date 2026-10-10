import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument, listDocuments, deleteDocument } from '../lib/user-store.mjs'
import { addStudyNote, listStudySources } from '../lib/study-version-sources.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'
import { queueCoursePapers, processPaperJob, PAPER_JOBS, claimPaperDispatch, retryPaperJob, paperSections, combinePaperSections, paperJobRecord, paperJobSummary } from '../lib/study-paper-jobs.mjs'
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

async function later(ms,fn){const real=Date.now;Date.now=()=>real()+ms;try{return await fn()}finally{Date.now=real}}
test('a busy account budget lease queues the paper with a delay instead of pausing it, and it later completes',async()=>fixture(async()=>{
  const {StudyBudgetError}=await import('../lib/study-ai-budget.mjs')
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [job]=await queueCoursePapers(course),calls=[]
  let busy=true
  const generate=async(prompt,opts)=>{if(busy){busy=false;throw new StudyBudgetError('Another chapter is generating on your account. This job will continue shortly.',30)}return generation(calls)(prompt,opts)}
  await drain(job.id,{platform,generate})
  let saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'queued');assert.ok(saved.runAfter>Date.now());assert.equal(saved.queueDeliveryUntil,saved.runAfter)
  assert.equal(paperJobSummary(saved).notice,'Another chapter is generating on your account. This job will continue shortly.')
  assert.deepEqual(await claimPaperDispatch(),[])
  await drain(job.id,{platform,generate});assert.equal(calls.length,0)
  await later(31000,async()=>{
    assert.deepEqual(await claimPaperDispatch(),[job.id])
    await drain(job.id,{platform,generate})
  })
  saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error);assert.equal(calls.length,2)
}))
test('dispatch delivers at most one paper per account at a time',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  await addStudyNote({...course,title:'Resit exam.pdf'},[{page:1,text:'Explain this other original problem.'}])
  assert.equal((await queueCoursePapers(course)).length,2)
  assert.equal((await claimPaperDispatch()).length,1)
  assert.deepEqual(await claimPaperDispatch(),[])
}))
test('an output-limit failure splits the section by page instead of pausing',async()=>fixture(async()=>{
  const {OPENAI_OUTPUT_LIMIT_MESSAGE}=await import('../lib/study-provider-output.mjs')
  const {StudyVersionError}=await import('../lib/study-version-content.mjs')
  await addStudyNote({...course,title:'Practice exam.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  const [job]=await queueCoursePapers(course),calls=[]
  const generate=async(prompt,opts)=>{
    if(opts.usageMetadata.stage!=='review' && new Set(JSON.parse(prompt.split('EVIDENCE: ').at(-1)).map(c=>c.page)).size>3)throw new StudyVersionError(OPENAI_OUTPUT_LIMIT_MESSAGE,502)
    return generation(calls)(prompt,opts)
  }
  await drain(job.id,{platform,generate})
  const saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error)
  assert.ok(saved.sections.every(s=>s.to-s.from<3))
  assert.deepEqual([...new Set(saved.sections.flatMap(s=>Array.from({length:s.to-s.from+1},(_,i)=>s.from+i)))].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8])
  assert.equal((await readDocument('study-practice',saved.setId,null)).result.questions.length,8)
  assert.ok(calls.filter(c=>c.usageMetadata.stage!=='review').every(c=>c.maxOutputTokens>12000))
  assert.ok(calls.filter(c=>c.usageMetadata.stage==='review').every(c=>c.maxOutputTokens===4000))
}))
test('review issues are shown on the paused job and an explicit retry restores the repair allowance',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [job]=await queueCoursePapers(course),calls=[]
  let reviews=['Question 1 omits its marks.','Question 1 omits its marks.','Question 1 still omits its marks.']
  const generate=async(prompt,opts)=>opts.usageMetadata.stage==='review' && reviews.length ? JSON.stringify({issues:[reviews.shift()]}) : generation(calls)(prompt,opts)
  await drain(job.id,{platform,generate})
  let saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'paused');assert.deepEqual(paperJobSummary(saved).issues,['Question 1 omits its marks.'])
  await retryPaperJob(job.id)
  await drain(job.id,{platform,generate})
  saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error);assert.deepEqual(saved.issues,[])
}))
test('one question that differs from its cited text is omitted and reported; the rest of the section is kept',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Practice exam.pdf'},Array.from({length:3},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  const [job]=await queueCoursePapers(course)
  const generate=async(prompt,opts)=>{
    if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
    const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1))
    return JSON.stringify({title:'Original questions',questions:chunks.map((c,i)=>i===1?{...question(c),question:'A paraphrased question.'}:question(c)),warnings:[]})
  }
  await drain(job.id,{platform,generate})
  const saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error)
  const set=await readDocument('study-practice',saved.setId,null)
  assert.deepEqual(set.result.questions.map(q=>q.page),[1,3])
  assert.ok(set.result.warnings.some(w=>/Question 2 \(page 2\) was omitted: An extracted question differs/.test(w)))
}))
test('copies of one file under different source keys share one job and one paper row; same-titled different files do not',async()=>fixture(async()=>{
  const pages=[{page:1,text:'Explain this original problem.'}]
  await addStudyNote({...course,title:'OS-Exam-P1-2025.pdf'},pages)
  await addStudyNote({...course,title:'OS-Exam-P1-2025.pdf'},pages)
  await addStudyNote({...course,title:'Copy of OS-Exam-P1-2025.pdf'},pages)
  await addStudyNote({...course,title:'OS-Exam-P1-2025.pdf'},[{page:1,text:'A different paper with the same name.'}])
  const sources=await listStudySources(course)
  assert.equal(new Set(sources.map(s=>s.key)).size,4);assert.equal(new Set(sources.map(s=>s.sha256)).size,2)
  const first=await queueCoursePapers(course)
  assert.equal(first.length,2)
  assert.deepEqual((await queueCoursePapers(course)).map(j=>j.id).sort(),first.map(j=>j.id).sort(),'re-queueing is idempotent')
  assert.equal((await listDocuments(PAPER_JOBS)).length,2)
  const {coursePracticeHost}=await import('../lib/study-course-practice.mjs')
  const bank=await coursePaperBank(await coursePracticeHost(course,await activeProgrammeId()))
  assert.equal(bank.papers.length,2)
  const copied=bank.papers.find(p=>p.copies.length===3)
  assert.ok(copied);assert.ok(bank.processing.some(j=>j.sourceKey===copied.key),'the job points at the row that is shown')
  assert.equal(bank.papers.find(p=>p!==copied).copies.length,1)
}))
test('a job saved under a legacy source-key id still blocks a second job for the same file',async()=>fixture(async()=>{
  const {compareAndSwapDocument}=await import('../lib/user-store.mjs')
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [source]=await listStudySources(course)
  const legacy={...paperJobRecord('owner',await activeProgrammeId(),course,source),id:'pap-00000000-0000-0000-0000-000000000001',sourceKey:source.key}
  await compareAndSwapDocument(PAPER_JOBS,legacy.id,legacy,null)
  assert.deepEqual((await queueCoursePapers(course)).map(j=>j.id),[legacy.id])
  assert.equal((await listDocuments(PAPER_JOBS)).length,1)
  await compareAndSwapDocument(PAPER_JOBS,legacy.id,{...legacy,status:'duplicate',revision:'next'},legacy.revision)
  assert.notEqual((await queueCoursePapers(course))[0].id,legacy.id,'a merged duplicate does not count as the file\'s job')
}))
test('a used daily allowance makes the paper wait for the reset; a job spending cap still pauses',async()=>fixture(async()=>{
  const {StudyBudgetError}=await import('../lib/study-ai-budget.mjs')
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  await addStudyNote({...course,title:'Resit exam.pdf'},[{page:1,text:'Explain this other original problem.'}])
  const [daily,capped]=await queueCoursePapers(course),resetsAt=Date.now()+5*3600000
  await drain(daily.id,{platform,generate:async()=>{throw new StudyBudgetError('Your platform generation allowance is used. Resume later or explicitly choose your own AI key in Settings.',5*3600,resetsAt)}})
  const waiting=await readDocument(PAPER_JOBS,daily.id,null)
  assert.equal(waiting.status,'queued');assert.equal(waiting.runAfter,resetsAt);assert.match(paperJobSummary(waiting).notice,/allowance is used/)
  await drain(capped.id,{platform,generate:async()=>{throw new StudyBudgetError('This generation reached its spending cap. Review its progress and explicitly raise the cap to continue.')}})
  assert.equal((await readDocument(PAPER_JOBS,capped.id,null)).status,'paused')
}))
