import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument, listDocuments, deleteDocument, writeDocument } from '../lib/user-store.mjs'
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
  assert.equal(calls.length,previous);assert.equal((await listDocuments(PAPER_JOBS)).length,2)
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
  assert.equal(paperJobRecord('a','p',course,source).id,paperJobRecord('a','p',course,{...source,key:'another-placement'}).id)
  assert.notEqual(paperJobRecord('a','p',course,source).id,paperJobRecord('a','p',{...course,academicYear:'2025-2026'},source).id)
  const sections=paperSections(Array.from({length:15},(_,i)=>({page:i+1,text:'x'.repeat(12000)})))
  assert.deepEqual([...new Set(sections.flatMap(s=>Array.from({length:s.to-s.from+1},(_,i)=>s.from+i)))],Array.from({length:15},(_,i)=>i+1))
  const q={...question({id:'c',page:1,text:'Original question'}),id:'q-1'}
  assert.throws(()=>combinePaperSections([{result:{questions:[q]}},{result:{questions:[{...q,marks:2}]}}]),/disagree/)
})

test('paper bank classifies the observed Canvas names, collapses duplicate bytes, and reconciles old jobs',async()=>fixture(async()=>{
  const files = [
    ['OS-Exam-P1-2025.pdf','paper'],
    ['OS-Exam-P1-2025-solutions.pdf','solutions'],
    ['resit-P1-2025.pdf','paper'],
    ['F14-t1.pdf','paper'],
    ['S19-T2.pdf','paper'],
    ['S17-t3.pdf','paper'],
    ['F14-t1-solution.pdf','solutions'],
    ['S19-T2-solutions.pdf','solutions'],
    ['S17-t3-solutions.pdf','solutions'],
    ['S19-final-optional.pdf','paper'],
    ['final-OS-y3.pdf','paper'],
    ['solutions-Exam-Y3-P4-25-25.docx.pdf','solutions'],
  ]
  const sources = files.map(([title], index) => ({
    key:`source-${index}`, title, academicYear:course.academicYear, period:course.period,
    sha256:`sha-${index}`, pages:[{page:1,text:`Readable content for ${title}`}],
    locations:[{moduleId:`module-${index}`,moduleName:'Exam Prep',assignmentTitle:title}],
  }))
  for(let index=1;index<=6;index++) sources.push({
    ...sources[0], key:`duplicate-${index}`, sourcePath:`copy-${index}.pdf`,
    locations:[{moduleId:`duplicate-module-${index}`,moduleName:'Practice Exams',assignmentTitle:`Copy ${index}`}],
  })
  const sourceOptions={editorialSources:async()=>sources}
  const programmeId=await activeProgrammeId()
  let bank=await coursePaperBank({course,programmeId},{sourceOptions})
  assert.equal(bank.papers.length,12)
  assert.equal(bank.papers.filter(p=>p.paperKind==='paper').length,7)
  assert.equal(bank.papers.filter(p=>p.paperKind==='solutions').length,5)
  const canonical=bank.papers.find(p=>p.sha256==='sha-0')
  assert.equal(canonical.sourceKeys.length,7)
  assert.equal(canonical.locations.length,7)
  const distinctTitleBank=await coursePaperBank({course,programmeId},{sourceOptions:{editorialSources:async()=>[
    ...sources,
    {...sources[0],key:'same-title-new-bytes',sha256:'different-bytes'},
  ]}})
  assert.equal(distinctTitleBank.papers.length,13)
  assert.equal(distinctTitleBank.papers.filter(p=>p.title===files[0][0]).length,2)

  await writeDocument('study-versions','moved-version',{id:'moved-version',programmeId})
  await writeDocument('study-practice','moved-set',{
    id:'moved-set',versionId:'moved-version',revisionId:'revision',topicId:'course-paper',course,
    kind:'set',mode:'extract',questionSourceKey:'retired-placement',status:'complete',createdAt:'2026-09-22T09:00:00.000Z',
    snapshot:{sources:[{key:'retired-placement',sha256:'sha-0'}],chunks:[{id:'old-chunk',sourceKey:'retired-placement',page:1,text:'Question one.'}]},
    result:{title:'Moved paper',questions:[{id:'question-one'}]},
  })
  bank=await coursePaperBank({course,programmeId},{sourceOptions})
  assert.equal(bank.sets.find(set=>set.id==='moved-set').questionSourceKey,canonical.key)

  const base={programmeId,course,sha256:'sha-0',title:files[0][0],revision:randomUUID(),sections:[{id:'saved'}],createdAt:'2026-09-22T10:00:00.000Z',runAfter:0,queueDeliveryUntil:0,lease:null}
  await writeDocument(PAPER_JOBS,'legacy-paused',{...base,id:'legacy-paused',sourceKey:'source-0',status:'paused',completedSections:3})
  await writeDocument(PAPER_JOBS,'legacy-complete',{...base,id:'legacy-complete',sourceKey:'duplicate-1',status:'complete',completedSections:1,setId:'ready'})
  bank=await coursePaperBank({course,programmeId},{sourceOptions})
  assert.equal(bank.processing.length,1)
  assert.equal(bank.processing[0].id,'legacy-complete')
  assert.equal(bank.processing[0].status,'complete')
  assert.equal(bank.processing[0].sourceKey,canonical.key)
}))

test('duplicate source placements enqueue only one canonical automatic job',async()=>fixture(async()=>{
  const sourceOptions={editorialSources:async()=>[
    {key:'first-placement',title:'Practice exam.pdf',academicYear:course.academicYear,period:course.period,sha256:'same-bytes',pages:[{page:1,text:'Question one.'}]},
    {key:'second-placement',title:'Practice exam.pdf',academicYear:course.academicYear,period:course.period,sha256:'same-bytes',pages:[{page:1,text:'Question one.'}]},
  ]}
  const first=await queueCoursePapers(course,{sourceOptions})
  const second=await queueCoursePapers(course,{sourceOptions})
  assert.equal(first.length,1)
  assert.equal(second.length,1)
  assert.equal(first[0].id,second[0].id)
  assert.equal((await listDocuments(PAPER_JOBS)).length,1)
}))

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
