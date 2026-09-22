import {pilotPlanReady} from './study-pilot-planning.mjs'
import { routeStudyModel } from '../../lib/study-model-routing.mjs'
import { pilotAccounting } from './study-pilot-accounting.mjs'
import { runStudyAgentsSdk } from '../../lib/study-agents-sdk.mjs'
import { transientStudyFailure, studyRetryDelayMs } from '../../lib/study-provider-errors.mjs'
import { providerFetch } from '../../lib/provider-fetch.mjs'
// Real provider responses through hosted and local next/submit state machines.
// Stores only isolated local validation accounts; never writes production data.
import { readFile } from 'node:fs/promises'
import { writePilotJson, assertPilotNotPaused, pilotAttemptCap, assertPilotChapterTarget } from './study-pilot-ledger.mjs'
import { assertPilotExecutionMode, resolveSavedPilotRun } from './study-pilot-execution-gate.mjs'
import { STUDY_GENERATION_LIMITS } from '../../lib/study-generation-limits.mjs'
import { randomUUID } from 'node:crypto'
import { estimateStudyCall, studyModelCost, StudyBudgetError } from '../../lib/study-ai-budget.mjs'
if(process.env.DATABASE_URL)throw new Error('Live pipeline validation requires isolated local storage, not a database URL.')
const key=process.env.OPENAI_API_KEY
if(!key || key==='[SENSITIVE]')throw new Error('A usable OPENAI_API_KEY is required.')
const {withRequestContext}=await import('../../lib/request-context.mjs')
const {deleteAllDocuments}=await import('../../lib/user-store.mjs')
const {readStudySourceSnapshot}=await import('../../lib/study-version-sources.mjs')
const {createStudyVersion,ownStudyVersion,studyRevision,mutateStudyVersion,listCourseBundleChildren}=await import('../../lib/study-version-store.mjs')
const {processStudyStep,controlStudyGeneration}=await import('../../lib/study-version-pipeline.mjs')
const {startLocalStudy,nextLocalStudy,submitLocalStudy}=await import('../../lib/study-local-generation.mjs')
const pilot=process.env.STUDY_PIPELINE_COURSE_FILE ? JSON.parse(await readFile(process.env.STUDY_PIPELINE_COURSE_FILE,'utf8')) : null
const planOnly=!!pilot && process.env.STUDY_PIPELINE_PLAN_ONLY==='1'
if(planOnly && ['STUDY_PIPELINE_CORRECT','STUDY_PIPELINE_RECHECK_ALL','STUDY_PIPELINE_RECHECK_PEDAGOGY','STUDY_PIPELINE_REPLAN_REMAINING','STUDY_PIPELINE_UPDATE_ONLY'].some(key=>process.env[key]))throw Error('Planning-only validation cannot also request corrections, rechecks, replanning or updates.')
const fixture=pilot ? 'course:'+pilot.course.courseCode : process.env.STUDY_PIPELINE_FIXTURE || 'probability'
if(!pilot&&!['probability','iot'].includes(fixture))throw new Error('Unknown evaluation fixture.')
assertPilotExecutionMode(pilot, process.env)
const builtIn=pilot ? null : await import(fixture==='iot'?'./study-iot-fixture.mjs':'../../lib/study-quality-fixture.mjs')
const course=pilot?.course || builtIn.evaluationCourse
let evaluationSources=pilot ? pilot.sources.filter(s=>!pilot.updateSourceKeys.includes(s.key)) : builtIn.evaluationSources.map(s=>({...s,pages:builtIn.evaluationChunks.filter(c=>c.sourceKey===s.key).map(c=>({page:c.page,text:c.text}))}))
const sourceKeys=evaluationSources.map(source=>source.key)
const sourceOptions={editorialSources:async()=>evaluationSources}
const {STUDY_STANDARD}=await import('../../lib/study-version-content.mjs')
const report={runtime:process.env.STUDY_PIPELINE_RUNTIME || 'chat-completions',fixture,callDetails:[],contract:STUDY_STANDARD,model:process.env.STUDY_PIPELINE_MODEL || 'gpt-5-mini',calls:0,calculatedUsd:0,runs:[],limitation:'Live provider plus real state machines in isolated local storage. Queue delivery, database isolation and browser behavior are validated separately.'}
const spendingCap=Number(process.env.STUDY_PIPELINE_MAX_USD || STUDY_GENERATION_LIMITS.defaultJobUsd)
if(!Number.isFinite(spendingCap) || spendingCap<0.05 || spendingCap>STUDY_GENERATION_LIMITS.maxJobUsd)throw new Error('Choose a validation spending cap between $0.05 and $50.')
report.spendingCapUsd=spendingCap
report.priorEvaluationUsd=Number(process.env.STUDY_PIPELINE_PRIOR_USD || 0)
if(!Number.isFinite(report.priorEvaluationUsd)||report.priorEvaluationUsd<0)throw new Error('Invalid prior pilot spending.')
const attemptCap=pilotAttemptCap(spendingCap,report.priorEvaluationUsd,process.env.STUDY_PIPELINE_ATTEMPT_MAX_USD)
report.attemptCapUsd=attemptCap
if(pilot)report.coursePilot={course,initialSourceKeys:sourceKeys,updateSourceKeys:pilot.updateSourceKeys,sourceGaps:pilot.gaps||[],selection:pilot.selection||null}
const artifact=process.env.STUDY_PIPELINE_REPORT || '/tmp/wicker-study-pipeline-live.json'
async function generateOnce(prompt,options){
  await assertPilotNotPaused(pilot ? process.env.STUDY_PIPELINE_PAUSE_FILE : null)
  if(process.env.STUDY_PIPELINE_OUTPUT_LIMIT){
    const limit=Number(process.env.STUDY_PIPELINE_OUTPUT_LIMIT)
    if(!Number.isSafeInteger(limit)||limit<1000||limit>128000)throw Error('Invalid pilot output limit.')
    options={...options,maxOutputTokens:Math.min(options.maxOutputTokens,limit)}
    report.pilotOutputLimit=limit
  }
  const route=routeStudyModel({source:'platform',provider:'openai',model:report.model},{...options,generationRuntime:report.runtime},process.env.STUDY_PIPELINE_MODEL_ROUTES)
  const model=route?.model || report.model
  // A route may also set the phase's reasoning effort; record the effective one.
  const reasoningEffort=route?.reasoningEffort || options.reasoningEffort || 'medium'
  const started=Date.now()
  const meta=options.usageMetadata || {}
  // Pipeline-path markers for the measured run: the question-only trial route
  // and its fallback, merge-validation re-prompts, plan re-plans and fills.
  const path=Object.fromEntries(['modelTrial','mergeReprompt','replan','fillAttempt','correctionAttempt'].filter(key=>meta[key]!==undefined).map(key=>[key,meta[key]]))
  const call={model,modelRoute:route,experimentPhase:report.runs.at(-1)?.phase,chapterId:meta.chapterId,reasoningEffort,phase:meta.phase || options.stage || 'generation',...path,promptCharacters:prompt.length,schemaCharacters:JSON.stringify(options.responseSchema || {}).length,maxOutputTokens:options.maxOutputTokens}
  report.callDetails.push(call)
  const reserved=estimateStudyCall(prompt+JSON.stringify(options.responseSchema || {}),options.maxOutputTokens,model).micros/1000000
  if((report.priorEvaluationUsd || 0)+report.calculatedUsd+reserved>attemptCap){
    report.budgetFailure={spentUsd:report.calculatedUsd,priorUsd:report.priorEvaluationUsd || 0,reservationUsd:reserved,capUsd:attemptCap}
    throw new StudyBudgetError('Live pipeline validation spending cap reached; the next full reservation would exceed the allowance.')
  }
  console.log(`Provider call ${report.calls+1}: ${call.phase}${call.chapterId?' / '+call.chapterId:''}`)
  report.calculatedUsd+=reserved
  report.calls++
  call.reservationUsd=reserved
  // Persist an unresolved reservation before making a potentially interrupted call.
  await writePilotJson(artifact,{...report,accounting:pilotAccounting(report)})
  if(report.runtime==='agents-sdk-responses') {
    let usage
    try {
      const result=await runStudyAgentsSdk(prompt,{...options,apiKey:key,model,reasoningEffort})
      usage=result.usage
      return result.text
    } catch(error) {usage=error.usage;call.error={name:error.name,code:error.code,message:error.message,causeName:error.cause?.name,providerStatus:error.providerStatus,providerRequestId:error.providerRequestId};throw error}
    finally {
      call.elapsedMs=Date.now()-started;call.usage=usage
      if(usage){report.calculatedUsd-=reserved;report.calculatedUsd+=studyModelCost(model,usage.inputTokens,usage.outputTokens,usage)/1000000}
    }
  }
  const response=await providerFetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model,max_completion_tokens:options.maxOutputTokens,reasoning_effort:reasoningEffort,messages:[{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'pipeline',strict:true,schema:options.responseSchema}}}),},options.providerTimeoutMs || 600000).catch(error=>{report.providerFailures ||= [];report.providerFailures.push({name:error.name,message:error.message.slice(0,500),causeCode:error.cause?.code});throw error})
  if(!response.ok){const failure=await response.json().catch(()=>({}));report.providerFailures ||= [];report.providerFailures.push({status:response.status,message:failure.error?.message||'Provider error'});const error=new Error(`Provider HTTP ${response.status}: ${failure.error?.message||'No detail'}`);error.retryable=response.status>=500;throw error}
  const result=await response.json();call.elapsedMs=Date.now()-started;call.usage=result.usage;call.finishReason=result.choices?.[0]?.finish_reason;if(!Number.isSafeInteger(result.usage?.prompt_tokens)||result.usage.prompt_tokens<0||!Number.isSafeInteger(result.usage?.completion_tokens)||result.usage.completion_tokens<0){const error=new Error('Provider omitted valid input/output usage; reservation remains held.');error.code='provider_missing_usage';throw error}report.calculatedUsd-=reserved;report.calculatedUsd+=studyModelCost(model,result.usage?.prompt_tokens||0,result.usage?.completion_tokens||0,{cachedInputTokens:result.usage?.prompt_tokens_details?.cached_tokens,cacheWriteInputTokens:result.usage?.prompt_tokens_details?.cache_write_tokens})/1000000
  if(result.choices?.[0]?.finish_reason==='length'){report.providerFailures ||= [];report.providerFailures.push({name:'OutputLimit',maxOutputTokens:options.maxOutputTokens});throw new Error('Provider output budget exhausted before a complete correction was returned.')}
  return result.choices?.[0]?.message?.content || ''
}
async function generate(prompt,options){
  if(report.runs.at(-1)?.execution==='hosted')return generateOnce(prompt,options)
  for(let attempt=1;attempt<=3;attempt++){
    try{return await generateOnce(prompt,options)}
    catch(error){
      if(attempt===3 || !transientStudyFailure(error))throw error
      console.log(`Temporary provider failure; retry ${attempt} of 2 with a new budget reservation.`)
      await new Promise(resolve=>setTimeout(resolve,studyRetryDelayMs(error,attempt)))
    }
  }
}
for(const execution of ['hosted','local'].filter(mode=>!process.env.STUDY_PIPELINE_MODE || mode===process.env.STUDY_PIPELINE_MODE)){
  let run={execution,phase:'initial',steps:[],passed:false};report.runs.push(run)
  const savedReport=pilot && process.env.STUDY_PIPELINE_RESUME_FILE ? JSON.parse(await readFile(process.env.STUDY_PIPELINE_RESUME_FILE,'utf8')) : null
  const suiteUser=process.env.STUDY_PIPELINE_ISOLATED_USER_ID
  if(suiteUser && !/^live-validation-[a-f0-9-]{36}$/.test(suiteUser))throw Error('Invalid isolated course account.')
  report.isolatedUserId=savedReport?.isolatedUserId || suiteUser || `live-validation-${randomUUID()}`
  await withRequestContext({userId:report.isolatedUserId,mode:'local'},async()=>{
    let id
    try{
      if(savedReport?.isolatedVersionId){
        id=savedReport.isolatedVersionId
      }else if(execution==='hosted'){
        // Both execution modes must plan the same course: a bundle pilot that
        // silently became a single hosted guide would not be hosted parity.
        const courseBundle=pilot?.courseBundle===true
        const snapshot=await readStudySourceSnapshot(course,sourceKeys,{...sourceOptions,includeHistorical:true,courseBundle})
        id=(await createStudyVersion(course,'default',snapshot,{execution,courseBundle,title:pilot?.title || 'Isolated live validation',billing:{source:'platform',model:report.model,maxJobUsd:spendingCap}})).id
      }else id=(await startLocalStudy({...course,sourceKeys,includeHistorical:true,courseBundle:pilot?.courseBundle===true,title:pilot?.title || 'Isolated live validation'},sourceOptions)).version.id
      report.isolatedVersionId=id
      if(process.env.STUDY_PIPELINE_RESUME_FILE && process.env.STUDY_PIPELINE_UPDATE_ONLY!=='1') {
        const previous=JSON.parse(await readFile(process.env.STUDY_PIPELINE_RESUME_FILE,'utf8'))
        report.priorEvaluationUsd=Math.max(report.priorEvaluationUsd,(previous.priorEvaluationUsd || 0)+previous.calculatedUsd)
        // Prefer a saved run from the exact same execution mode. A saved
        // draft from the OTHER mode (for example, this course's saved draft
        // was generated locally and this pass is STUDY_PIPELINE_MODE=hosted)
        // is a genuine mode mismatch: never resume it silently. Require an
        // explicit opt-in that converts the draft's execution for this
        // isolated pilot account, and record the conversion in the report;
        // otherwise refuse with a clear message naming both modes.
        const {savedRun,executionConverted}=resolveSavedPilotRun(previous,execution,process.env.STUDY_PIPELINE_CONVERT_EXECUTION==='1')
        const saved=savedRun?.draft
        if(!saved)throw new Error('No saved draft for this execution mode.')
        if(savedReport){
          evaluationSources=savedRun.phase==='update'?pilot.sources:evaluationSources
          run={...savedRun,steps:[...savedRun.steps],passed:false,planned:false,error:undefined,status:undefined,...(executionConverted?{executionConverted}:{})};report.runs=[...previous.runs.filter(r=>r.passed),run]
        }else if(executionConverted)run.executionConverted=executionConverted
        if(!saved)throw new Error('No saved draft for this execution mode.')
        if(!planOnly || !pilotPlanReady(saved))await mutateStudyVersion(id,version=>{
          version.draft={...structuredClone(saved),id:version.draft.id,status:execution==='local'?'local-ready':'queued',execution,lease:null,error:null,runAfter:0,attempts:0}
          version.draft.billing={...version.draft.billing,maxJobUsd:spendingCap}
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
      if(pilot && savedReport && run.phase==='initial' && process.env.STUDY_PIPELINE_UPDATE_ONLY!=='1' && process.env.STUDY_PIPELINE_REPLAN_REMAINING==='1'){
        const {replanPilotRemainder}=await import('./study-pilot-replan.mjs')
        run.outlineOptimization=await replanPilotRemainder(id,async(prompt,options)=>{run.draft=(await ownStudyVersion(id)).draft;return generate(prompt,options)})
        run.draft=(await ownStudyVersion(id)).draft
        await writePilotJson(artifact,{...report,accounting:pilotAccounting(report)})
      }
      if(pilot && savedReport && process.env.STUDY_PIPELINE_UPDATE_ONLY==='1'){
        if(!savedReport.runs.every(r=>r.passed))throw Error('Finish initial generation before the update experiment.')
        report.runs=[...savedReport.runs]
        const {queuePilotMaintenance}=await import('./study-pilot-maintenance.mjs')
        const maintenance=await queuePilotMaintenance(id,pilot,sourceOptions,async()=>{evaluationSources=pilot.sources})
        run={execution,phase:'update',steps:[],passed:false,maintenance,initialRevisionId:savedReport.runs[0].revision.id};report.runs.push(run)
      }
      for(let cycle=run.phase==='update'?1:0;cycle<(pilot?.updateSourceKeys.length&&process.env.STUDY_PIPELINE_DEFER_UPDATE!=='1'?2:1);cycle++){
      for(let step=0;step<500;step++){
        const before=await ownStudyVersion(id)
        run.draft=before.draft
        if(planOnly && pilotPlanReady(before.draft)){run.planned=true;break}
        if(pilot)assertPilotChapterTarget(before.draft,process.env.STUDY_PIPELINE_STOP_CHECKED_CHAPTERS)
        console.log(`${run.phase}: ${execution}: ${before.draft.stage} / ${before.draft.status}`)
        if(run.maintenance && before.draft.status!=='complete' && before.activeRevisionId!==run.maintenance.readableRevisionId)throw Error('Readable revision changed before maintenance passed.')
        if(['complete','failed','stopped'].includes(before.draft.status))break
        if(before.draft.runAfter>Date.now()){await new Promise(resolve=>setTimeout(resolve,Math.min(60000,before.draft.runAfter-Date.now())));step--;continue}
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
        // Keep a resumable checkpoint even if the evaluation process is interrupted.
        run.draft=after.draft
        run.steps.push({stage:before.draft.stage,status:after.draft.status,error:after.draft.error,issues:after.draft.issues})
        await writePilotJson(artifact,{...report,accounting:pilotAccounting(report)})
      }
      const version=await ownStudyVersion(id)
      run.status=version.draft.status;run.error=version.draft.error;run.issues=version.draft.issues
      run.revision=await studyRevision(version);run.passed=run.status==='complete' && !!run.revision
      // A completed course run is not a completed course: every derived guide
      // must itself be readable, complete and non-empty before this run passes.
      if(version.courseBundle){
        const published=version.bundleGuides || []
        run.guides=[]
        for(const guide of published){
          const child=await ownStudyVersion(guide.id).catch(()=>null)
          const childRevision=child ? await studyRevision(child).catch(()=>null) : null
          run.guides.push({versionId:guide.id,guideId:guide.guideId||child?.courseBundleParent?.guideId||null,title:child?.title||guide.title,
            status:child?.draft?.status || 'missing',state:child?.courseBundleParent?.state || null,activeRevisionId:child?.activeRevisionId||null,chapters:childRevision?.chapters.length||0})
        }
        const derived=(await listCourseBundleChildren(id)).filter(v=>v.courseBundleParent?.state!=='archived')
        const complete=run.guides.filter(g=>g.status==='complete' && g.state==='published' && g.activeRevisionId && g.guideId && g.chapters>0)
        run.bundle={plannedGuides:version.draft.guides?.length||published.length,publishedGuides:published.length,derivedGuides:derived.length,completeGuides:complete.length,publication:version.bundlePublication||null}
        if(run.passed && (!published.length || complete.length!==published.length || derived.length!==published.length)){
          run.passed=false
          run.error=run.error || `Course bundle published ${complete.length} complete guides of ${published.length} (${derived.length} derived documents).`
        }
      }
      if(!run.passed)run.draft=version.draft
      else delete run.draft
      if(cycle===0 && pilot?.updateSourceKeys.length && process.env.STUDY_PIPELINE_DEFER_UPDATE!=='1' && run.passed){
        const initial=run
        const {queuePilotMaintenance}=await import('./study-pilot-maintenance.mjs')
        const maintenance=await queuePilotMaintenance(id,pilot,sourceOptions,async()=>{evaluationSources=pilot.sources})
        run={execution,phase:'update',steps:[],passed:false,maintenance,initialRevisionId:initial.revision.id};report.runs.push(run)
        await writePilotJson(artifact,{...report,accounting:pilotAccounting(report)})
      }else break
      }
      if(pilot && report.runs.length===2 && report.runs.every(r=>r.passed)){
        const {pilotReuse}=await import('./study-pilot-maintenance.mjs')
        report.reuse=pilotReuse(report.runs[0].revision,report.runs[1].revision)
        if(pilot.updateSourceKeys.some(key=>!report.runs[1].revision.snapshot.sources.some(s=>s.key===key)))throw Error('Updated revision omitted a newly released source.')
      }
    }catch(error){if(error.code==='pilot_paused')run.pausedAtCompletedCall=true;run.passed=false;if(!report.runs.includes(run))report.runs.push(run);run.error=error.message;if(id)run.draft=(await ownStudyVersion(id).catch(()=>null))?.draft}
    finally{if(!pilot)await deleteAllDocuments()}
  })
  await writePilotJson(artifact,{...report,accounting:pilotAccounting(report)})
  console.log(`${execution}: ${run.passed?'PASS':run.planned?'PLANNED':'FAIL'} ${run.error||''}`)
}
console.log(JSON.stringify({calls:report.calls,calculatedUsd:report.calculatedUsd,runs:report.runs.map(({execution,passed,status,error})=>({execution,passed,status,error}))},null,2))
if(report.runs.some(r=>!r.passed && !(planOnly && r.planned)))process.exitCode=1
