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
  const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1)),roles=JSON.parse(prompt.match(/SOURCE ROLES: (\{.*?\})\n/)[1])
  return JSON.stringify({title:'Original questions',questions:chunks.filter(c=>c.sourceKey===roles.question).map(question),warnings:[]})
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
  assert.equal(set.result.questions.length,8);assert.equal(set.snapshot.chunks.length,9,'8 question pages plus the paired solutions page')
  assert.equal(job.solution.title,'Practice exam solutions.pdf')
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
test('paper job identities isolate owners and content changes; ranges never drop pages and conflicting overlaps keep one reading with a warning',()=>{
  const source={key:'x',title:'exam.pdf',sha256:'one'}
  assert.notEqual(paperJobRecord('a','p',course,source).id,paperJobRecord('b','p',course,source).id)
  assert.notEqual(paperJobRecord('a','p',course,source).id,paperJobRecord('a','p',course,{...source,sha256:'two'}).id)
  const sections=paperSections(Array.from({length:15},(_,i)=>({page:i+1,text:'x'.repeat(12000)})))
  assert.deepEqual([...new Set(sections.flatMap(s=>Array.from({length:s.to-s.from+1},(_,i)=>s.from+i)))],Array.from({length:15},(_,i)=>i+1))
  const q={...question({id:'c',page:1,text:'Original question'}),id:'q-1'}
  const joined=combinePaperSections([{result:{questions:[q]}},{result:{questions:[{...q,marks:2,sourceIds:['c','d']}]}}])
  assert.equal(joined.questions.length,1);assert.equal(joined.questions[0].marks,2,'the better-evidenced reading wins')
  assert.match(joined.warnings[0],/read differently by two overlapping sections/)
  assert.equal(combinePaperSections([{result:{questions:[{...q,marks:3}]}},{result:{questions:[{...q,marks:2}]}}]).questions[0].marks,2,'the later section wins a tie')
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
test('review findings left after the correction round become notes on a completed paper',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [job]=await queueCoursePapers(course),calls=[]
  let reviews=['Question 1 depends on a figure.','Question 1 still depends on a figure.']
  const generate=async(prompt,opts)=>opts.usageMetadata.stage==='review' && reviews.length ? JSON.stringify({issues:[reviews.shift()]}) : generation(calls)(prompt,opts)
  await drain(job.id,{platform,generate})
  const saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error)
  const set=await readDocument('study-practice',saved.setId,null)
  assert.equal(set.result.questions.length,1)
  assert.ok(set.result.warnings.includes('Review note: Question 1 still depends on a figure.'))
  assert.equal(calls.filter(c=>c.usageMetadata.stage==='generate').length,2,'one correction round still runs first')
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
test('the BCS2140 Exam Prep files classify as papers and solutions; weak names need corroboration',async()=>{
  const {paperKind,solutionPairsFor}=await import('../lib/study-paper-bank.mjs')
  const examPrep=[{moduleName:'Exam Prep'}]
  const expected={'020 OS-Exam-P1-2025--file-6587123.pdf':'paper','021 OS-Exam-P1-2025-solutions--file-6587085.pdf':'solutions','022 resit-P1-2025--file-6587293.pdf':'paper',
    'F14-t1.pdf':'paper','S19-T2.pdf':'paper','S17-t3.pdf':'paper','F14-t1-solution.pdf':'solutions','S19-T2-solutions.pdf':'solutions','S17-t3-solutions.pdf':'solutions',
    'S19-final-optional.pdf':'paper','final-OS-y3.pdf':'paper','030 solutions-Exam-Y3-P4-25-25.docx--file-6587292.pdf':'solutions'}
  const files=Object.keys(expected).map(title=>({title,locations:examPrep})),solutionPairs=solutionPairsFor(files)
  assert.deepEqual(Object.fromEntries(files.map(f=>[f.title,paperKind(f,{solutionPairs})])),expected)
  for(const title of ['final-OS-y3.pdf','F14-t1.pdf','Final project report.pdf','Quiz night poster.pdf'])assert.equal(paperKind({title}),null,title)
  assert.equal(paperKind({title:'009 Assessment of Example Project Plans--file-6691733.pdf'}),null,'"example" is not "exam"')
  assert.equal(paperKind({title:'F14-t1.pdf'},{solutionPairs:solutionPairsFor([{title:'F14-t1-solution.pdf'}])}),'paper','a matching solutions file corroborates a term code')
  assert.equal(paperKind({title:'final-OS-y3.docx'}),null,'only PDFs are papers')
})
test('a term-coded paper is queued through its solutions file, which is paired but never processed itself',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'F14-t1.pdf'},[{page:1,text:'Explain this original problem.'}])
  await addStudyNote({...course,title:'F14-t1-solution.pdf'},[{page:1,text:'The worked solution.'}])
  const jobs=await queueCoursePapers(course)
  assert.deepEqual(jobs.map(j=>j.title),['F14-t1.pdf'])
  const {coursePracticeHost}=await import('../lib/study-course-practice.mjs')
  const bank=await coursePaperBank(await coursePracticeHost(course,await activeProgrammeId()))
  const paper=bank.papers.find(p=>p.title==='F14-t1.pdf'),solution=bank.papers.find(p=>p.title==='F14-t1-solution.pdf')
  assert.equal(paper.paperKind,'paper');assert.equal(solution.paperKind,'solutions');assert.equal(paper.solutionKey,solution.key);assert.equal(solution.solutionKey,null)
}))
test('Canvas ingestion uses the module placement to corroborate a weak paper name',async()=>fixture(async()=>{
  const {indexedPaperJob}=await import('../lib/study-paper-jobs.mjs')
  const {currentUserId}=await import('../lib/request-context.mjs')
  const binding={id:'b1',course_code:course.courseCode,course_name:course.courseName,academic_year:course.academicYear,period:course.period}
  assert.equal(await indexedPaperJob(currentUserId(),binding,'linked-files/materials/031 final-OS-y3--file-1.pdf','sha-final'),null)
  const job=await indexedPaperJob(currentUserId(),binding,'linked-files/materials/031 final-OS-y3--file-1.pdf','sha-final',[{moduleName:'Exam Prep'}])
  assert.ok(job);assert.equal(job.sha256,'sha-final')
}))
test('a job for a file the classifier no longer accepts is skipped before any paid call',async()=>fixture(async()=>{
  const {compareAndSwapDocument}=await import('../lib/user-store.mjs')
  const {paperKind}=await import('../lib/study-paper-bank.mjs')
  for(const title of ['001 IUI_Exam_manual--file-5716305.pdf','002 Lecture 2 - Course Logistics Assignment--file-1.pdf','003 Project_plan_Example_C--file-2.pdf'])assert.equal(paperKind({title}),null,title)
  assert.equal(paperKind({title:'Exam guide with practice questions.pdf'}),'paper')
  await addStudyNote({...course,title:'001 IUI_Exam_manual--file-5716305.pdf'},[{page:1,text:'Rules for the exam.'}])
  const [source]=await listStudySources(course)
  const legacy=paperJobRecord('owner',await activeProgrammeId(),course,{...source,title:'Mock exam.pdf'})
  await compareAndSwapDocument(PAPER_JOBS,legacy.id,{...legacy,title:source.title},null)
  let calls=0
  await drain(legacy.id,{platform,generate:async()=>{calls++;throw new Error('no call expected')}})
  const saved=await readDocument(PAPER_JOBS,legacy.id,null)
  assert.equal(saved.status,'skipped');assert.equal(calls,0);assert.match(paperJobSummary(saved).notice,/not recognised/)
}))
test('a section without questions completes without a review call',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Exam logistics and room information only.'}])
  const [job]=await queueCoursePapers(course),calls=[]
  await drain(job.id,{platform,generate:async(prompt,opts)=>{calls.push(opts.usageMetadata.stage);return JSON.stringify({title:'Mock exam',questions:[],warnings:[]})}})
  const saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error);assert.deepEqual(calls,['generate'])
  assert.equal((await readDocument('study-practice',saved.setId,null)).result.questions.length,0)
}))
test('the extraction review is told which outcomes are allowed, and sees the page range',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},[{page:1,text:'Explain this original problem.'}])
  const [job]=await queueCoursePapers(course),prompts=[]
  await drain(job.id,{platform,generate:async(prompt,opts)=>{if(opts.usageMetadata.stage==='review')prompts.push(prompt);return generation([])(prompt,opts)}})
  assert.equal(prompts.length,1)
  for(const allowed of ['empty questions list','needsOriginal=true','answerBasis=unavailable','outside questionPageRange'])assert.ok(prompts[0].includes(allowed),allowed)
  assert.match(prompts[0],/"questionPageRange":\{"from":1,"to":1\}/)
}))
test('automatic preparation sends the paired answer key, and answers cite it',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'F14-t1.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  await addStudyNote({...course,title:'F14-t1-solution.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Official answer ${i+1}: the reasoning follows from the definition.`})))
  const [job]=await queueCoursePapers(course),seen=[]
  const generate=async(prompt,opts)=>{
    if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
    const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1)),roles=JSON.parse(prompt.match(/SOURCE ROLES: (\{.*?\})\n/)[1])
    seen.push(roles.solution)
    const answers=chunks.filter(c=>c.sourceKey===roles.solution)
    return JSON.stringify({title:'F14-t1',questions:chunks.filter(c=>c.sourceKey===roles.question).map(c=>{const a=answers.find(x=>x.page===c.page);return {...question(c),...(a?{answer:a.text,answerBasis:'source',answerSourceIds:[a.id]}:{})}}),warnings:[]})
  }
  await drain(job.id,{platform,generate})
  const saved=await readDocument(PAPER_JOBS,job.id,null)
  assert.equal(saved.status,'complete',saved.error);assert.equal(saved.solution.title,'F14-t1-solution.pdf')
  assert.ok(seen.length>=2 && seen.every(key=>key===saved.solution.key),'every section names the paired key')
  const set=await readDocument('study-practice',saved.setId,null)
  assert.equal(set.result.questions.length,8);assert.equal(set.solutionSourceKey,saved.solution.key)
  assert.ok(set.result.questions.every(q=>q.answerBasis==='source' && /Official answer/.test(q.answer)))
  assert.ok(set.result.questions.every(q=>q.answerSourceIds.every(id=>set.snapshot.chunks.some(c=>c.id===id))),'answer citations stay resolvable in the joined set')
}))
test('a long answer key is windowed per section, and an oversized one is left out with a warning',async()=>{
  const {solutionWindow}=await import('../lib/study-paper-jobs.mjs')
  const questions=Array.from({length:12},(_,i)=>({page:i+1,text:'x'.repeat(3000)}))
  const pageChars=n=>Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,n]))
  assert.deepEqual(solutionWindow({from:1,to:6},questions,{pageChars:pageChars(1000)}),{from:1,to:10000},'a short key goes in whole')
  const window=solutionWindow({from:7,to:12},questions,{pageChars:pageChars(5000)})
  assert.ok(window.from>=6 && window.from<=7 && window.to===12,JSON.stringify(window))
  assert.deepEqual(solutionWindow({from:1,to:6},questions,{pageChars:pageChars(40000)}),{skipped:true})
  assert.equal(solutionWindow({from:1,to:6},questions,null),null)
})
test('a paper finished without its answer key can be prepared again, replacing its set with official answers',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Resit exam 2019.pdf'},[{page:1,text:'Explain this original problem.'}])
  const answering=async(prompt,opts)=>{
    if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
    const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1)),roles=JSON.parse(prompt.match(/SOURCE ROLES: (\{.*?\})\n/)[1])
    const key=chunks.find(c=>c.sourceKey===roles.solution)
    return JSON.stringify({title:'S19-T2',questions:chunks.filter(c=>c.sourceKey===roles.question).map(c=>({...question(c),...(key?{answer:key.text,answerBasis:'source',answerSourceIds:[key.id]}:{})})),warnings:[]})
  }
  const [record]=await queueCoursePapers(course)
  await drain(record.id,{platform,generate:answering})
  let job=await readDocument(PAPER_JOBS,record.id,null)
  assert.equal(job.status,'complete');assert.equal(paperJobSummary(job).preparedWithAnswerKey,false)
  const before=await readDocument('study-practice',job.setId,null)
  assert.equal(before.result.questions[0].answerBasis,'unavailable')
  // Even without a new key, preparing again extracts again rather than reusing the cached section.
  const calls=[]
  await retryPaperJob(record.id,{withAnswerKey:true})
  await drain(record.id,{platform,generate:async(prompt,opts)=>{calls.push(opts.usageMetadata.stage);return answering(prompt,opts)}})
  assert.ok(calls.includes('generate'),'a re-preparation makes a fresh extraction call')
  job=await readDocument(PAPER_JOBS,record.id,null);assert.equal(job.preparation,2)
  await addStudyNote({...course,title:'Resit exam 2019 solutions.pdf'},[{page:1,text:'Official answer: it follows from the definition.'}])
  assert.equal((await retryPaperJob(record.id)).status,'complete','a plain retry leaves a finished paper alone')
  await retryPaperJob(record.id,{withAnswerKey:true})
  await drain(record.id,{platform,generate:answering})
  job=await readDocument(PAPER_JOBS,record.id,null)
  assert.equal(job.status,'complete',job.error);assert.equal(paperJobSummary(job).preparedWithAnswerKey,true)
  const after=await readDocument('study-practice',job.setId,null)
  assert.equal(after.id,before.id,'the same set is replaced');assert.notEqual(after.revision,before.revision)
  assert.equal(after.result.questions[0].answerBasis,'source');assert.match(after.result.questions[0].answer,/Official answer/)
}))
test('BCS3210 mock: typography, page breaks with running headers and miscited pages no longer drop questions',async()=>{
  const {validatePracticeSet}=await import('../lib/study-practice.mjs')
  const header='BCS3210 — Mock Exam                                                                     Page 3 / 7'
  const chunks=[
    {id:'p3',sourceKey:'mock',page:3,text:`BCS3210 — Mock Exam                                                                     Page 2 / 7\n\n[2p] 4a How does Ethereum’s state-transition function fundamentally differ from Bitcoin’s?\nA) It consumes UTXOs\nB) It runs a program over the world state\n[2p] 4b Under EIP-1559, if the previous block was completely full (used its full gas limit), what`},
    {id:'p4',sourceKey:'mock',page:4,text:`${header}\n\nhappens to the base fee for the next block?\nA) It is reset to zero\nB) It increases by 12.5%\n[2p] 1 Explain why gas exists.\nExercise 2\n[2p] 1 Explain why blocks have a gas limit.`},
  ]
  const record={mode:'extract',questionSourceKey:'mock',solutionSourceKey:null,snapshot:{chunks,questionPageRange:{from:3,to:4}}}
  const item=(over)=>({label:'x',question:'',sharedContext:'',type:'mc',options:['A','B'],correctOptions:[],marks:2,page:3,answer:'',answerBasis:'unavailable',hint:'',difficulty:'standard',sourceIds:['p3'],answerSourceIds:[],needsOriginal:false,...over})
  const set=validatePracticeSet({title:'Mock',warnings:[],questions:[
    item({label:'4a',question:"How does Ethereum's state-transition function fundamentally differ from Bitcoin's?"}),
    item({label:'4b',page:4,sourceIds:['p4'],question:'Under EIP-1559, if the previous block was completely full (used its full gas limit), what happens to the base fee for the next block?'}),
    item({label:'1',page:4,sourceIds:['p4'],type:'written',options:[],question:'Explain why gas exists.'}),
    item({label:'1',page:4,sourceIds:['p4'],type:'written',options:[],question:'Explain why blocks have a gas limit.'}),
  ]},record,{dropInvalid:true})
  assert.deepEqual(set.questions.map(q=>q.label),['4a','4b','1','1'],JSON.stringify(set.omittedQuestions))
  const b=set.questions[1];assert.equal(b.page,3,'4b starts on page 3');assert.deepEqual(b.sourceIds.sort(),['p3','p4'])
  assert.throws(()=>validatePracticeSet({title:'Mock',warnings:[],questions:[item({label:'4a',question:'How does Ethereum work?'})]},record),/differs from its cited text/,'paraphrases are still rejected')
})
test('joining treats "8a (b)" and "8a(b)" as one item and drops introductions and lab steps',()=>{
  const q=(over)=>({...question({id:'c',page:6,text:'x'}),...over})
  const intro='A smart contract escrow holds funds until both parties approve the release.'
  const {questions}=combinePaperSections([
    {result:{questions:[q({label:'8a (shared)',question:intro,marks:null}),q({label:'8a (b)',question:'Explain the reentrancy risk.',sharedContext:intro,marks:3})]}},
    {result:{questions:[q({label:'8a(b)',question:'Explain the reentrancy risk.',sharedContext:intro,marks:3}),q({label:'2',question:'Run the provided EthereumKeyManager code.'})]}},
  ])
  assert.deepEqual(questions.map(x=>[x.label,x.question]),[['8a (b)','Explain the reentrancy risk.']])
})
test('"Mock_Exam_Solutions_Slides" pairs with "Mock_Exam"',async()=>{
  const {paperKind,solutionPairsFor,pairedSolution}=await import('../lib/study-paper-bank.mjs')
  const files=[{title:'003 Mock_Exam--file-6729909.pdf'},{title:'001 Mock_Exam_Solutions_Slides--file-6748534.pdf'}]
  assert.equal(paperKind(files[1]),'solutions')
  assert.equal(pairedSolution(files[0],solutionPairsFor(files))?.title,files[1].title)
})
test('the practice list hides a joined paper\'s sections and sets without questions',async()=>fixture(async()=>{
  const {listStudyPractice}=await import('../lib/study-practice.mjs')
  await addStudyNote({...course,title:'Mock exam.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  await addStudyNote({...course,title:'Resit exam.pdf'},[{page:1,text:'Room and time information only.'}])
  const [mock,resit]=await queueCoursePapers(course)
  await drain(mock.id,{platform,generate:generation([])})
  await drain(resit.id,{platform,generate:async()=>JSON.stringify({title:'Resit',questions:[],warnings:[]})})
  const job=await readDocument(PAPER_JOBS,mock.id,null)
  const sets=(await listStudyPractice(job.versionId)).filter(r=>r.kind==='set')
  assert.deepEqual(sets.map(s=>s.id),[job.setId])
}))
test('re-joining a completed paper makes no AI calls and replaces its set in place',async()=>fixture(async()=>{
  const {compareAndSwapDocument}=await import('../lib/user-store.mjs')
  await addStudyNote({...course,title:'Mock exam.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  const [queued]=await queueCoursePapers(course)
  await drain(queued.id,{platform,generate:generation([])})
  const job=await readDocument(PAPER_JOBS,queued.id,null),before=await readDocument('study-practice',job.setId,null)
  await compareAndSwapDocument(PAPER_JOBS,job.id,{...job,status:'queued',revision:'rejoin'},job.revision)
  await drain(job.id,{platform,generate:async()=>{throw new Error('no AI call expected')}})
  const after=await readDocument(PAPER_JOBS,job.id,null),set=await readDocument('study-practice',after.setId,null)
  assert.equal(after.status,'complete',after.error);assert.equal(set.id,before.id);assert.notEqual(set.revision,before.revision)
  assert.equal(set.result.questions.length,8)
}))
test('Tutorial 3: a page-numbered footer between the halves of a task is layout, not wording',async()=>{
  const {validatePracticeSet}=await import('../lib/study-practice.mjs')
  const head='Introduction to Blockchains                                                      Tutorial 3'
  const page=(n,body)=>({id:`p${n}`,page:n,sourceKey:'t',text:`${head}\n\n${body}\n\n                                              ${n}               DACS, Maastricht University`})
  const chunks=[page(12,'Step 6'),page(13,' Task 2: Implement Pause Functionality\n Requirements:\n      • Add pause() function (owner only)'),page(14,'      • Emit Paused and Unpaused events\n    Task 3: Add Maximum Supply Cap')]
  const item={hint:'',page:14,type:'written',label:'Task 2',marks:null,answer:'',options:[],sourceIds:['p14'],difficulty:'standard',answerBasis:'unavailable',needsOriginal:false,sharedContext:'',correctOptions:[],answerSourceIds:[],
    question:'Task 2: Implement Pause Functionality\nRequirements:\n • Add pause() function (owner only)\n • Emit Paused and Unpaused events'}
  const set=validatePracticeSet({title:'T3',warnings:[],questions:[item]},{mode:'extract',questionSourceKey:'t',snapshot:{chunks,questionPageRange:{from:12,to:14}}},{dropInvalid:true})
  assert.deepEqual(set.questions.map(q=>[q.label,q.page]),[['Task 2',13]])
})
test('an automatic paper keeps going when every item in one section fails verification',async()=>fixture(async()=>{
  await addStudyNote({...course,title:'Mock exam.pdf'},Array.from({length:8},(_,i)=>({page:i+1,text:`Explain the reasoning for problem ${i+1} in detail.`})))
  const [job]=await queueCoursePapers(course)
  let first=true
  const generate=async(prompt,opts)=>{
    if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
    const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1)),roles=JSON.parse(prompt.match(/SOURCE ROLES: (\{.*?\})\n/)[1])
    const qs=chunks.filter(c=>c.sourceKey===roles.question).map(question)
    if(first){first=false;return JSON.stringify({title:'Mock',warnings:[],questions:qs.map(q=>({...q,question:'A paraphrase that is not in the paper.'}))})}
    return JSON.stringify({title:'Mock',warnings:[],questions:qs})
  }
  await drain(job.id,{platform,generate})
  const saved=await readDocument(PAPER_JOBS,job.id,null),set=await readDocument('study-practice',saved.setId,null)
  assert.equal(saved.status,'complete',saved.error)
  assert.ok(set.result.questions.length>0 && set.result.questions.length<8,'the other section still contributes')
  assert.ok(set.result.warnings.some(w=>/was omitted/.test(w)))
}))
test('BCS3210 mock 8a(a): subscript spacing and line-break hyphens in the PDF text layer still verify',async()=>{
  const {validatePracticeSet}=await import('../lib/study-practice.mjs')
  const p6=` (a) [7 points] Give the complete sequence of hash computations Bitcoin performs to build this\n     tree, showing explicitly where duplication occurs at each level, all the way to the Merkle\n     root. Write hi1 ,i2 ,... for the node whose subtree covers leaves ti1 , ti2 , . . . in left-to-right order,\n     listing every contributing index. For example h12 = H(h1 ∥h2 ) and h1234 = H(h12 ∥h34 ),\n     where ∥ denotes concatenation. Indices here are single digits, so no separator is needed.\n\n (b) [7 points] Trace the execution of the combined script ScriptSig ∥ ScriptPK, operation-by-\n     operation, giving the stack state (top at right) after every single step.`
  const p7=`[8p] 8d A PBFT deployment has n = 10 replicas, satisfying the required n = 3f + 1 form.\n (a) What is the maximum number of Byzantine replicas f this system tolerates?`
  const chunks=[{id:'q6',page:6,sourceKey:'mock',text:p6},{id:'q7',page:7,sourceKey:'mock',text:p7},{id:'k14',page:14,sourceKey:'key',text:'Solution 8d: f = 3.'}]
  const item=(over)=>({hint:'',type:'written',marks:7,answer:'',options:[],difficulty:'standard',answerBasis:'unavailable',needsOriginal:false,sharedContext:'',correctOptions:[],answerSourceIds:[],...over})
  const set=validatePracticeSet({title:'Mock',warnings:[],questions:[
    item({label:'8a(a)',page:6,sourceIds:['q6'],question:'Give the complete sequence of hash computations Bitcoin performs to build this tree, showing explicitly where duplication occurs at each level, all the way to the Merkle root. Write hi1,i2,... for the node whose subtree covers leaves ti1, ti2, ... in left-to-right order, listing every contributing index. For example h12 = H(h1 ∥h2) and h1234 = H(h12 ∥h34), where ∥ denotes concatenation.'}),
    item({label:'8b(b)',page:6,sourceIds:['q6'],question:'Trace the execution of the combined script ScriptSig ∥ ScriptPK, operation-by-operation, giving the stack state (top at right) after every single step.'}),
    item({label:'8d(a)',page:14,sourceIds:['k14'],question:'What is the maximum number of Byzantine replicas f this system tolerates?'}),
  ]},{mode:'extract',questionSourceKey:'mock',solutionSourceKey:'key',snapshot:{chunks,questionPageRange:{from:6,to:7}}},{dropInvalid:true})
  assert.deepEqual(set.questions.map(q=>[q.label,q.page]),[['8a(a)',6],['8b(b)',6],['8d(a)',7]],JSON.stringify(set.omittedQuestions))
  assert.ok(set.questions[2].sourceIds.includes('q7'),'8d cites the paper, not the key page it was tagged with')
})
test('joining keeps one copy when only one section could see the exercise header',()=>{
  const q=(over)=>({...question({id:'c',page:4,text:'x'}),label:'4c',question:'How long does transient storage persist?',...over})
  const {questions}=combinePaperSections([{result:{questions:[q({sharedContext:''})]}},{result:{questions:[q({sharedContext:'Exercise 4 Ethereum & Smart Contracts'})]}}])
  assert.equal(questions.length,1);assert.equal(questions[0].sharedContext,'Exercise 4 Ethereum & Smart Contracts')
})
