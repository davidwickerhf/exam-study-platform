// Real provider responses through hosted and local next/submit state machines.
// Stores only isolated local validation accounts; never writes production data.
import { writeFile, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
if(process.env.DATABASE_URL)throw new Error('Live pipeline validation requires isolated local storage, not a database URL.')
const key=process.env.OPENAI_API_KEY
if(!key || key==='[SENSITIVE]')throw new Error('A usable OPENAI_API_KEY is required.')
const {withRequestContext}=await import('../../lib/request-context.mjs')
const {deleteAllDocuments}=await import('../../lib/user-store.mjs')
const {readStudySourceSnapshot}=await import('../../lib/study-version-sources.mjs')
const {createStudyVersion,ownStudyVersion,studyRevision,mutateStudyVersion}=await import('../../lib/study-version-store.mjs')
const {processStudyStep}=await import('../../lib/study-version-pipeline.mjs')
const {startLocalStudy,nextLocalStudy,submitLocalStudy}=await import('../../lib/study-local-generation.mjs')
const {evaluationCourse:course,evaluationSources,evaluationChunks}=await import('../../lib/study-quality-fixture.mjs')
const sourceOptions={editorialSources:async()=>evaluationSources.map(s=>({...s,pages:evaluationChunks.filter(c=>c.sourceKey===s.key).map(c=>({page:c.page,text:c.text}))}))}
const report={contract:'student-source-teaching-v6',model:'gpt-5-mini',calls:0,calculatedUsd:0,runs:[],limitation:'Live provider plus real state machines in isolated local storage. Queue delivery, database isolation and browser behavior are validated separately.'}
const artifact=process.env.STUDY_PIPELINE_REPORT || '/tmp/wicker-study-pipeline-live.json'
async function generate(prompt,options){
  if(report.calculatedUsd+0.1>2)throw new Error('Live pipeline validation spending cap reached.')
  console.log(`Provider call ${report.calls+1}: ${options.stage || 'generation'}`)
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model:report.model,max_completion_tokens:options.maxOutputTokens,reasoning_effort:'medium',messages:[{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'pipeline',strict:true,schema:options.responseSchema}}}),signal:AbortSignal.timeout(210000)})
  report.calls++
  if(!response.ok){const failure=await response.json().catch(()=>({}));report.providerFailures ||= [];report.providerFailures.push({status:response.status,message:failure.error?.message||'Provider error'});throw new Error(`Provider HTTP ${response.status}: ${failure.error?.message||'No detail'}`)}
  const result=await response.json();report.calculatedUsd+=((result.usage?.prompt_tokens||0)*0.25+(result.usage?.completion_tokens||0)*2)/1000000
  return result.choices?.[0]?.message?.content || ''
}
for(const execution of ['hosted','local'].filter(mode=>!process.env.STUDY_PIPELINE_MODE || mode===process.env.STUDY_PIPELINE_MODE)){
  const run={execution,steps:[],passed:false};report.runs.push(run)
  await withRequestContext({userId:`live-validation-${randomUUID()}`,mode:'local'},async()=>{
    try{
      let id
      if(execution==='hosted'){
        const snapshot=await readStudySourceSnapshot(course,['current','old'],{...sourceOptions,includeHistorical:true})
        id=(await createStudyVersion(course,'default',snapshot,{execution,billing:{source:'platform',model:report.model,maxJobUsd:1}})).id
      }else id=(await startLocalStudy({...course,sourceKeys:['current','old'],includeHistorical:true,title:'Isolated live validation'},sourceOptions)).version.id
      if(process.env.STUDY_PIPELINE_RESUME_FILE) {
        const previous=JSON.parse(await readFile(process.env.STUDY_PIPELINE_RESUME_FILE,'utf8'))
        const saved=previous.runs.find(r=>r.execution===execution)?.draft
        if(!saved)throw new Error('No saved draft for this execution mode.')
        await mutateStudyVersion(id,version=>{
          version.draft={...structuredClone(saved),id:version.draft.id,status:execution==='local'?'local-ready':'queued',execution,lease:null,error:null}
          delete version.draft.localRequest
        })
        run.resumedFrom=process.env.STUDY_PIPELINE_RESUME_FILE
      }
      for(let step=0;step<180;step++){
        const before=await ownStudyVersion(id)
        console.log(`${execution}: ${before.draft.stage} / ${before.draft.status}`)
        if(['complete','failed','stopped'].includes(before.draft.status))break
        if(execution==='hosted')await processStudyStep(id,{sourceOptions,generate})
        else{
          const next=await nextLocalStudy(id,{},sourceOptions)
          if(next.request){
            const response=await generate(next.request.prompt,next.request)
            const submission={requestId:next.request.id,contractId:next.request.contractId,response}
            await submitLocalStudy(id,submission,sourceOptions)
            const duplicate=await submitLocalStudy(id,submission,sourceOptions)
            if(!duplicate.duplicate)throw new Error('Identical local submission was not idempotent.')
          }
        }
        const after=await ownStudyVersion(id)
        run.steps.push({stage:before.draft.stage,status:after.draft.status,error:after.draft.error,issues:after.draft.issues})
        await writeFile(artifact,JSON.stringify(report,null,2))
      }
      const version=await ownStudyVersion(id)
      run.status=version.draft.status;run.error=version.draft.error;run.issues=version.draft.issues
      run.revision=await studyRevision(version);run.passed=run.status==='complete' && !!run.revision
      if(!run.passed)run.draft=version.draft
    }catch(error){run.error=error.message}
    finally{await deleteAllDocuments()}
  })
  await writeFile(artifact,JSON.stringify(report,null,2))
  console.log(`${execution}: ${run.passed?'PASS':'FAIL'} ${run.error||''}`)
}
console.log(JSON.stringify({calls:report.calls,calculatedUsd:report.calculatedUsd,runs:report.runs.map(({execution,passed,status,error})=>({execution,passed,status,error}))},null,2))
if(report.runs.some(r=>!r.passed))process.exitCode=1
