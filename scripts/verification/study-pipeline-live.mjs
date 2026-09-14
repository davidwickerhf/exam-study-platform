// Real provider responses through hosted and local next/submit state machines.
// Stores only isolated local validation accounts; never writes production data.
import { writeFile, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { estimateStudyCall, studyModelCost } from '../../lib/study-ai-budget.mjs'
if(process.env.DATABASE_URL)throw new Error('Live pipeline validation requires isolated local storage, not a database URL.')
const key=process.env.OPENAI_API_KEY
if(!key || key==='[SENSITIVE]')throw new Error('A usable OPENAI_API_KEY is required.')
const {withRequestContext}=await import('../../lib/request-context.mjs')
const {deleteAllDocuments}=await import('../../lib/user-store.mjs')
const {readStudySourceSnapshot}=await import('../../lib/study-version-sources.mjs')
const {createStudyVersion,ownStudyVersion,studyRevision,mutateStudyVersion}=await import('../../lib/study-version-store.mjs')
const {processStudyStep,controlStudyGeneration}=await import('../../lib/study-version-pipeline.mjs')
const {startLocalStudy,nextLocalStudy,submitLocalStudy}=await import('../../lib/study-local-generation.mjs')
const {evaluationCourse:course,evaluationSources,evaluationChunks}=await import('../../lib/study-quality-fixture.mjs')
const sourceOptions={editorialSources:async()=>evaluationSources.map(s=>({...s,pages:evaluationChunks.filter(c=>c.sourceKey===s.key).map(c=>({page:c.page,text:c.text}))}))}
const {STUDY_STANDARD}=await import('../../lib/study-version-content.mjs')
const report={contract:STUDY_STANDARD,model:process.env.STUDY_PIPELINE_MODEL || 'gpt-5-mini',calls:0,calculatedUsd:0,runs:[],limitation:'Live provider plus real state machines in isolated local storage. Queue delivery, database isolation and browser behavior are validated separately.'}
const artifact=process.env.STUDY_PIPELINE_REPORT || '/tmp/wicker-study-pipeline-live.json'
async function generate(prompt,options){
  const reserved=estimateStudyCall(prompt+JSON.stringify(options.responseSchema || {}),options.maxOutputTokens,report.model).micros/1000000
  if(report.calculatedUsd+reserved>5)throw new Error('Live pipeline validation spending cap reached.')
  console.log(`Provider call ${report.calls+1}: ${options.stage || 'generation'}`)
  report.calculatedUsd+=reserved
  report.calls++
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model:report.model,max_completion_tokens:options.maxOutputTokens,reasoning_effort:'medium',messages:[{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'pipeline',strict:true,schema:options.responseSchema}}}),signal:AbortSignal.timeout(options.providerTimeoutMs || 600000)}).catch(error=>{report.providerFailures ||= [];report.providerFailures.push({name:error.name,message:error.message.slice(0,500)});throw error})
  if(!response.ok){const failure=await response.json().catch(()=>({}));report.providerFailures ||= [];report.providerFailures.push({status:response.status,message:failure.error?.message||'Provider error'});throw new Error(`Provider HTTP ${response.status}: ${failure.error?.message||'No detail'}`)}
  const result=await response.json();report.calculatedUsd-=reserved;report.calculatedUsd+=studyModelCost(report.model,result.usage?.prompt_tokens||0,result.usage?.completion_tokens||0,{cachedInputTokens:result.usage?.prompt_tokens_details?.cached_tokens,cacheWriteInputTokens:result.usage?.prompt_tokens_details?.cache_write_tokens})/1000000
  if(result.choices?.[0]?.finish_reason==='length'){report.providerFailures ||= [];report.providerFailures.push({name:'OutputLimit',maxOutputTokens:options.maxOutputTokens});throw new Error('Provider output budget exhausted before a complete correction was returned.')}
  return result.choices?.[0]?.message?.content || ''
}
for(const execution of ['hosted','local'].filter(mode=>!process.env.STUDY_PIPELINE_MODE || mode===process.env.STUDY_PIPELINE_MODE)){
  const run={execution,steps:[],passed:false};report.runs.push(run)
  await withRequestContext({userId:`live-validation-${randomUUID()}`,mode:'local'},async()=>{
    try{
      let id
      if(execution==='hosted'){
        const snapshot=await readStudySourceSnapshot(course,['current','old'],{...sourceOptions,includeHistorical:true})
        id=(await createStudyVersion(course,'default',snapshot,{execution,billing:{source:'platform',model:report.model,maxJobUsd:5}})).id
      }else id=(await startLocalStudy({...course,sourceKeys:['current','old'],includeHistorical:true,title:'Isolated live validation'},sourceOptions)).version.id
      if(process.env.STUDY_PIPELINE_RESUME_FILE) {
        const previous=JSON.parse(await readFile(process.env.STUDY_PIPELINE_RESUME_FILE,'utf8'))
        const saved=previous.runs.find(r=>r.execution===execution)?.draft
        if(!saved)throw new Error('No saved draft for this execution mode.')
        await mutateStudyVersion(id,version=>{
          version.draft={...structuredClone(saved),id:version.draft.id,status:execution==='local'?'local-ready':'queued',execution,lease:null,error:null}
          delete version.draft.localRequest
          if(process.env.STUDY_PIPELINE_RECHECK_PEDAGOGY || process.env.STUDY_PIPELINE_RECHECK_ALL) {
            for(const chapter of version.draft.chapters) {
              delete chapter.pedagogyAudit;delete chapter.pedagogicalReview
              if(process.env.STUDY_PIPELINE_RECHECK_ALL){delete chapter.factualAudit;delete chapter.evidenceReview}
              chapter.review='pending'
            }
            version.draft.stage='review'
            version.draft.issues=[]
            version.draft.reviewOnly=true
          }
        })
        if(process.env.STUDY_PIPELINE_CORRECT) {
          await mutateStudyVersion(id,version=>{version.draft.status='failed'})
          await controlStudyGeneration(id,'retry')
          run.requestedCorrection=true
        }
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
