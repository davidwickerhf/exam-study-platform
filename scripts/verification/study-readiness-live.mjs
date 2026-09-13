// Opt-in semantic readiness controls; uses no production writes.
import { readFile, writeFile } from 'node:fs/promises'
import { moduleReadinessSchema, moduleReadinessPrompt, validateModuleReadiness } from '../../lib/study-module-readiness.mjs'
import { studyResponseSchema, parseStudyJson } from '../../lib/study-version-content.mjs'
const key=process.env.OPENAI_API_KEY
if(!key || key==='[SENSITIVE]')throw new Error('A usable OPENAI_API_KEY is required.')
const course={courseCode:'EVAL-OS',courseName:'Operating Systems',academicYear:'2026-2027',period:'1'}
const source=(id,text,year='2026-2027')=>({id,text,year})
const mechanism='A process is a running program with registers, a program counter and an address space. On a single core only one process runs at a time. The OS saves the running process registers and program counter and restores another process context. A timer interrupt returns control to the OS so it can decide which Ready process runs next. A blocked process is waiting for an event and is not eligible for the CPU. When the event occurs it becomes Ready; it runs only when selected. For example A runs from 0 to 5 ms, the timer interrupts at 5 ms, and B runs from 5 to 10 ms, ignoring switching overhead. Exercise: trace A then B with a 4 ms quantum. Explain why waking does not necessarily mean immediate execution.'
const cases=[
  {name:'Complete weekly unit',ready:true,rows:[source('scope','Week 1 is complete. Objectives: explain process context and trace a timer-driven context switch. No additional required readings; Week 2 starts Monday.'),source('lesson',mechanism)]},
  {name:'Weekly placeholders do not establish completion',ready:false,rows:[source('scope','Week 1 objectives: explain process context and trace context switching. Lecture notes and worked exercises will be uploaded later. Week 2 folder exists but is empty.')]},
  {name:'Textbook reference alone is insufficient',ready:false,rows:[source('scope','Module: process virtualisation. Read chapters 4 and 6 of the assigned textbook. Explain process context, restricted direct execution and context switching. The textbook is the primary teaching source. Slides only list these terms.')]},
  {name:'Readable assigned excerpt permits scoped teaching',ready:true,rows:[source('scope','Module complete. Required reading is the supplied excerpt from chapter 4 below; no other reading is required for this unit. Objectives: define a process and trace timer-driven context switches.'),source('chapter',mechanism)]},
  {name:'Complete prior year cannot establish current scope',ready:false,rows:[source('current','The current syllabus and weekly objectives have not been released.'),source('old','Last year the complete examinable module was process context and context switching. '+mechanism,'2025-2026')]},
  {name:'Current exclusion constrains historical supplements',ready:true,excluded:'priority inheritance',rows:[source('current','Current module objectives: process context and timer-driven context switching. This module is complete. Use the supplied prior-year explanation for these unchanged mechanisms. Announcement dated 13 September 2026: priority inheritance is excluded from this exam; do not assess it.'),source('old',mechanism+' Last year priority inheritance was also examined: a mutex owner inherits the blocked higher-priority waiter’s priority.','2025-2026')]},
]
if(process.env.STUDY_OS_SOURCE_FILE){const real=JSON.parse(await readFile(process.env.STUDY_OS_SOURCE_FILE,'utf8'));cases.push({name:'Actual OS lecture page without its assigned chapters',ready:false,rows:real.chunks.map((c,i)=>source(`actual-${i}`,c.content,c.academicYear))})}
const report={model:'gpt-5-mini',checks:[],calls:0,calculatedUsd:0,limitation:'Fixed positive/negative controls and an optional real source excerpt; not a claim of course-wide completeness or student learning.'}
for(const item of cases.filter(c=>!process.env.STUDY_READINESS_FILTER || c.name.includes(process.env.STUDY_READINESS_FILTER))){
  let decision
  console.log(`Checking: ${item.name}`)
  const snapshot={sources:item.rows.map(r=>({key:r.id,title:r.id,academicYear:r.year})),chunks:item.rows.map(r=>({id:r.id,sourceKey:r.id,page:1,text:r.text}))}
  try{
    if(report.calculatedUsd+0.02>0.5)throw new Error('Readiness evaluation spending cap reached.')
    const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model:report.model,max_completion_tokens:7000,reasoning_effort:'medium',messages:[{role:'user',content:moduleReadinessPrompt(course,snapshot,{title:item.name,organisation:'auto'})}],response_format:{type:'json_schema',json_schema:{name:'readiness',strict:true,schema:studyResponseSchema(moduleReadinessSchema,snapshot.chunks.map(c=>c.id))}}}),signal:AbortSignal.timeout(210000)})
    report.calls++
    if(!response.ok)throw new Error(`Provider HTTP ${response.status}`)
    const result=await response.json();report.calculatedUsd+=((result.usage?.prompt_tokens||0)*0.25+(result.usage?.completion_tokens||0)*2)/1000000
    decision=parseStudyJson(result.choices?.[0]?.message?.content,moduleReadinessSchema)
    validateModuleReadiness(decision,snapshot,course)
    const passed=decision.ready===item.ready && (!item.excluded || !decision.scope.some(s=>s.topic.toLowerCase().includes(item.excluded)))
    report.checks.push({name:item.name,passed,expectedReady:item.ready,decision})
    console.log(`${passed?'PASS':'FAIL'}: ${item.name}`)
  }catch(error){report.checks.push({name:item.name,passed:false,error:error.message,decision})}
  await writeFile('/tmp/wicker-study-readiness-evaluation.json',JSON.stringify(report,null,2))
}
console.log(JSON.stringify({calls:report.calls,calculatedUsd:report.calculatedUsd,checks:report.checks.map(c=>({name:c.name,passed:c.passed,error:c.error}))},null,2))
if(report.checks.some(c=>!c.passed))process.exitCode=1
