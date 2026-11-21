// Recheck saved teaching with seeded factual errors using the production reviewer.
// Opt-in; no production storage. Supply OPENAI_API_KEY and STUDY_REVIEW_BASE_FILE.
import {readFile,writeFile} from 'node:fs/promises'
import {runStudyAgentsSdk} from '../../lib/study-agents-sdk.mjs'
import {nextFactualReview,acceptFactualReview,factualAuditIssues} from '../../lib/study-factual-review.mjs'
import {corruptEvaluationChapter,reviewerCatchesKnownErrors} from '../../lib/study-quality-fixture.mjs'
import {estimateStudyCall,studyModelCost} from '../../lib/study-ai-budget.mjs'
if(process.env.DATABASE_URL)throw new Error('Use isolated local evaluation without DATABASE_URL.')
if(!process.env.OPENAI_API_KEY || !process.env.STUDY_REVIEW_BASE_FILE)throw new Error('A key and saved probability evaluation are required.')
const base=JSON.parse(await readFile(process.env.STUDY_REVIEW_BASE_FILE,'utf8')).runs.find(r=>r.passed)?.revision
if(!base)throw new Error('A completed baseline is required.')
const chapter=corruptEvaluationChapter(base.chapters[0])
// Focus this regression on the two incorrect answers, scope attribution and visual.
if(process.env.STUDY_REVIEW_FULL_CHAPTER!=='1'){chapter.questions=chapter.questions.slice(0,2);chapter.sections=chapter.sections.slice(0,1);chapter.flashcards=[]}
delete chapter.factualAudit
const report={model:'gpt-6-astra',reasoningEffort:'low',capUsd:5,accountedUsd:Number(process.env.STUDY_REVIEW_PRIOR_RESERVED_USD || 0),calls:[],passed:false}
const artifact=process.env.STUDY_REVIEW_REPORT || '/tmp/wicker-review-regression-live.json'
try{
 for(let n=0;n<20;n++){
  const step=nextFactualReview(base.course,base.snapshot.sources,base.snapshot.chunks,chapter)
  if(!step)break
  const reserved=estimateStudyCall(step.prompt+JSON.stringify(step.responseSchema),step.tokens,report.model).micros/1e6
  if(report.accountedUsd+reserved>report.capUsd)throw new Error('Regression cap reached before the next request.')
  report.accountedUsd+=reserved
  const call={kind:step.kind,keys:step.keys};report.calls.push(call)
  const start=Date.now();let usage
  try{
   const result=await runStudyAgentsSdk(step.prompt,{apiKey:process.env.OPENAI_API_KEY,model:report.model,responseSchema:step.responseSchema,maxOutputTokens:step.tokens,reasoningEffort:report.reasoningEffort})
   usage=result.usage;call.response=JSON.parse(result.text);acceptFactualReview(chapter,step,result.text)
  }catch(error){usage=error.usage;throw error}
  finally{call.elapsedMs=Date.now()-start;call.usage=usage;if(usage)report.accountedUsd+=studyModelCost(report.model,usage.inputTokens,usage.outputTokens,usage)/1e6-reserved}
  await writeFile(artifact,JSON.stringify(report,null,2))
 }
 report.issues=factualAuditIssues(chapter)
 report.passed=!nextFactualReview(base.course,base.snapshot.sources,base.snapshot.chunks,chapter)&&reviewerCatchesKnownErrors(report.issues)
}catch(error){report.error=error.message}
await writeFile(artifact,JSON.stringify(report,null,2))
console.log(JSON.stringify({passed:report.passed,calls:report.calls.length,accountedUsd:report.accountedUsd,error:report.error}))
if(!report.passed)process.exitCode=1
