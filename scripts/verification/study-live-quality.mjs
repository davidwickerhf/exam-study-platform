import { acceptPedagogicalReview } from '../../lib/study-pedagogical-review.mjs'
import { acceptFactualReview, nextFactualReview, factualAuditIssues } from '../../lib/study-factual-review.mjs'
import { deriveObjectiveCoverage } from '../../lib/study-pedagogy.mjs'
import { evaluationStep, pedagogicalEvaluationCheck } from '../../lib/study-evaluation-steps.mjs'
import { evaluationCourse, evaluationSources, evaluationChunks, evaluationTopic, corruptEvaluationChapter, reviewerCatchesKnownErrors } from '../../lib/study-quality-fixture.mjs'
// Opt-in, local evaluation of real model output. Never runs in npm test/verify.
// OPENAI_API_KEY=... npm run test:study:live -- --require-live
import { readFile, writeFile } from 'node:fs/promises'
import {
  lessonPrompt,
  reviewPrompt,
  teachingSchema,
  reviewSchema,
  parseStudyJson,
  assertEvidence,
  studyResponseSchema
} from '../../lib/study-version-content.mjs'
import { studyLessonQuality } from '../../lib/study-content-quality.mjs'
import {
  estimateStudyCall,
  reserveStudyLedger,
  settleStudyLedger,
  studyBudgetLimits
} from '../../lib/study-ai-budget.mjs'
const key = process.env.OPENAI_API_KEY,
  model = 'gpt-5-mini'
if (!key || key === '[SENSITIVE]') {
  console.log(
    'SKIP live model evaluation: OPENAI_API_KEY is not available. No AI requests made.'
  )
  process.exit(process.argv.includes('--require-live') ? 1 : 0)
}
const cap = Number(process.env.STUDY_EVAL_MAX_USD || 0.25)
if (!Number.isFinite(cap) || cap < 0.05 || cap > 1)
  throw new Error('Evaluation cap must be between $0.05 and $1.')
let ledger = null,
  calls = 0,
  measuredUsd = 0
async function generate(prompt, maxOutputTokens = 10000, schema = teachingSchema, responseSchema) {
  const reserved = reserveStudyLedger(
    ledger,
    {
      user: 'evaluation',
      jobKey: 'quality-suite',
      source: 'platform',
      model,
      maxJobUsd: cap,
      estimate: estimateStudyCall(prompt, maxOutputTokens, model)
    },
    {
      ...studyBudgetLimits(),
      platformDayUsd: cap,
      platformMonthUsd: cap,
      userDayUsd: cap,
      userMonthUsd: cap,
      requestsMinute: 20,
      tokensDay: 1000000
    }
  )
  ledger = reserved.ledger
  let usage = null
  try {
    calls++
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: 'medium',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_schema', json_schema: { name: 'study_evaluation', strict: true, schema: responseSchema || studyResponseSchema(schema, evaluationChunks.map(c => c.id)) } }
      }),
      signal: AbortSignal.timeout(210000)
    })
    if (!response.ok) {
      if(response.status < 500) usage={inputTokens:0,outputTokens:0,estimated:false}
      throw new Error(`Evaluation provider returned HTTP ${response.status}.`)
    }
    const result = await response.json()
    if (result.usage)
      usage = {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        estimated: false
      }
    if(usage) measuredUsd += (usage.inputTokens*0.25 + usage.outputTokens*2)/1000000
    if(result.choices?.[0]?.finish_reason==='length')throw new Error(`Provider output truncated at ${maxOutputTokens} tokens.`)
    return result.choices?.[0]?.message?.content || ''
  } finally {
    ledger = settleStudyLedger(ledger, reserved.reservation.id, usage)
  }
}
const course = evaluationCourse, sources = evaluationSources, chunks = evaluationChunks, topic = evaluationTopic
const report = {
  model,
  capUsd: cap,
  calls: 0,
  spentUsd: 0,
  checks: [],
  generated: null,
  artifacts: [],
  limitations:
    'Small fixed source set; AI review is not proof of educational correctness across courses.'
}
try {
  const row = { course, snapshot:{sources,chunks}, topic, stage:0 }
  if(process.env.STUDY_EVAL_PLAN_FILE){
    const previous=JSON.parse(await readFile(process.env.STUDY_EVAL_PLAN_FILE,'utf8'))
    row.teachingPlan=assertEvidence(previous.artifacts.find(a=>a.kind==='plan').response,chunks)
    row.stage=1;report.artifacts.push({kind:'plan',response:row.teachingPlan,reused:true})
  }
  if (process.env.STUDY_EVAL_RECHECK_FILE) {
    const previous = JSON.parse(await readFile(process.env.STUDY_EVAL_RECHECK_FILE, 'utf8'))
    row.teachingPlan = previous.generated.teachingPlan
    row.generated = report.generated = structuredClone(previous.generated)
    if (!process.env.STUDY_EVAL_RESUME_CHECKS) delete row.generated.factualAudit
    row.stage = 2
    report.recheckedFrom = process.env.STUDY_EVAL_RECHECK_FILE
    report.checks.push({name:'Format, citations, coverage and arithmetic',passed:!studyLessonQuality(row.generated,chunks).length,issues:studyLessonQuality(row.generated,chunks)})
  }
  for (; row.stage < 7; row.stage++) {
    const step = evaluationStep(row)
    console.log(`Starting live ${step.kind} (${row.stage+1}/7)` )
    const parsed = parseStudyJson(await generate(step.prompt, step.tokens, step.schema, step.responseSchema), step.schema)
    report.artifacts.push({kind:step.kind,response:parsed})
    await writeFile('/tmp/wicker-study-quality-progress.json',JSON.stringify({...report,calls,measuredUsd},null,2))
    console.log(`Completed live ${step.kind}`)
    if (step.kind === 'plan') row.teachingPlan = assertEvidence(parsed, chunks)
    else if (step.kind === 'lesson') {
      row.generated = report.generated = deriveObjectiveCoverage({...assertEvidence(parsed, chunks), teachingPlan:row.teachingPlan})
      let issues = studyLessonQuality(row.generated, chunks)
      if(issues.length){
        report.initialDraftIssues=issues
        console.log('Repairing deterministic findings once, matching the production pipeline.')
        const fixed=parseStudyJson(await generate(step.prompt+'\nCorrect this saved draft with the smallest coherent changes needed. Preserve sound teaching. Findings: '+JSON.stringify(issues)+'\nSaved draft: '+JSON.stringify(row.generated),step.tokens,step.schema,step.responseSchema),step.schema)
        row.generated=report.generated=deriveObjectiveCoverage({...assertEvidence(fixed,chunks),teachingPlan:row.teachingPlan})
        report.artifacts.push({kind:'lesson-repair',response:fixed})
        issues=studyLessonQuality(row.generated,chunks)
      }
      report.checks.push({name:'Format, citations, coverage and arithmetic',passed:!issues.length,issues})
    } else if (step.kind === 'evidence' || step.kind === 'corruption') {
      try { acceptFactualReview(step.chapter,step.factual,parsed) }
      catch (error) {
        if (error.status !== 502) throw error
        report.reviewRetries ||= []
        report.reviewRetries.push({kind:step.kind,keys:step.factual.keys,error:error.message})
        const corrected=parseStudyJson(await generate(step.prompt+'\nThe previous review could not be accepted: '+error.message+' Return only executable numeric expressions in calculations, with explicit operators. Keep only useful calculations; omit labels and filler. Correct this review step without changing the lesson.',step.tokens,step.schema,step.responseSchema),step.schema)
        report.artifacts.push({kind:step.kind+'-retry',response:corrected})
        acceptFactualReview(step.chapter,step.factual,corrected)
      }
      if(step.kind==='evidence')row.generated=report.generated=step.chapter
      else row.corrupted=step.chapter
      if(nextFactualReview(course,sources,chunks,step.chapter))row.stage--
      else {
        const issues=factualAuditIssues(step.chapter)
        report.checks.push({name:step.kind,passed:step.kind==='corruption'?reviewerCatchesKnownErrors(issues):!issues.some(i=>i.severity==='error'),issues})
      }
    } else {
      const review=acceptPedagogicalReview(step.chapter,step.pedagogical,parsed)
      if(row.stage===3)row.generated=report.generated=step.chapter
      else {row.pedagogyFixtures ||= {};row.pedagogyFixtures[row.stage]=step.chapter}
      if(review)report.checks.push(pedagogicalEvaluationCheck(step,review))
      else row.stage--
    }
  }
} catch (error) {
  report.checks.push({
    name: 'evaluation completed',
    passed: false,
    issues: [error.message]
  })
}
report.calls = calls
report.spentUsd = measuredUsd
report.reservedOrSettledUsd = (ledger?.total || 0) / 1000000
await writeFile(
  process.env.STUDY_EVAL_OUTPUT || '/tmp/wicker-study-quality-evaluation.json',
  JSON.stringify(report, null, 2)
)
console.log(JSON.stringify({ ...report, generated: undefined, artifacts:undefined }, null, 2))
console.log('Full evaluation artifact: '+(process.env.STUDY_EVAL_OUTPUT || '/tmp/wicker-study-quality-evaluation.json'))
if (report.checks.some((c) => !c.passed)) process.exitCode = 1
