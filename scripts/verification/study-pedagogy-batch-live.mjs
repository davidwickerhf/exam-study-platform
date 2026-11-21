// Isolated live test: a factually innocuous but untaught chapter must be rejected.
import {readFile,writeFile} from 'node:fs/promises'
import {runStudyAgentsSdk} from '../../lib/study-agents-sdk.mjs'
import {nextPedagogicalReview,acceptPedagogicalReview} from '../../lib/study-pedagogical-review.mjs'
import {evidencePrompt} from '../../lib/study-version-content.mjs'
import {pedagogyReviewIssues} from '../../lib/study-pedagogy.mjs'
import {estimateStudyCall,studyModelCost} from '../../lib/study-ai-budget.mjs'
if(process.env.DATABASE_URL)throw Error('Use isolated storage only.')
const base=JSON.parse(await readFile(process.env.STUDY_REVIEW_BASE_FILE,'utf8')).runs.find(r=>r.passed)?.revision
if(!base)throw Error('A checked baseline is required.')
const chapter=structuredClone(base.chapters[0]);delete chapter.pedagogyAudit;delete chapter.pedagogicalReview
for(const section of chapter.sections)section.text='This section names the topic. It provides no explanation or worked reasoning.'
const report={model:'gpt-6-astra',capUsd:5,accountedUsd:0,calls:[],passed:false}
try {
 for(let n=0;n<10;n++) {
  const step=nextPedagogicalReview(evidencePrompt(base.course,base.snapshot.sources,base.snapshot.chunks),chapter)
  if(!step)break
  const reserve=estimateStudyCall(step.prompt+JSON.stringify(step.responseSchema),step.tokens,report.model).micros/1e6
  if(report.accountedUsd+reserve>report.capUsd)throw Error('Evaluation cap reached.')
  report.accountedUsd+=reserve
  const start=Date.now(),result=await runStudyAgentsSdk(step.prompt,{apiKey:process.env.OPENAI_API_KEY,model:report.model,responseSchema:step.responseSchema,maxOutputTokens:step.tokens,reasoningEffort:'medium'})
  report.accountedUsd+=studyModelCost(report.model,result.usage.inputTokens,result.usage.outputTokens,result.usage)/1e6-reserve
  const review=acceptPedagogicalReview(chapter,step,result.text)
  report.calls.push({objectives:step.objectiveIds,usage:result.usage,elapsedMs:Date.now()-start})
  if(review){report.issues=pedagogyReviewIssues(chapter,review);report.passed=report.issues.some(i=>i.severity==='error');break}
 }
}catch(error){report.error=error.message}
await writeFile(process.env.STUDY_PEDAGOGY_REPORT || '/tmp/wicker-resume-pedagogy-live.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({passed:report.passed,calls:report.calls.length,accountedUsd:report.accountedUsd,error:report.error}))
if(!report.passed)process.exitCode=1
