// Opt-in, local evaluation of real model output. Never runs in npm test/verify.
// OPENAI_API_KEY=... npm run test:study:live -- --require-live
import { writeFile } from 'node:fs/promises'
import {
  lessonPrompt,
  reviewPrompt,
  lessonSchema,
  reviewSchema,
  parseStudyJson,
  assertEvidence
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
if (!key) {
  console.log(
    'SKIP live model evaluation: OPENAI_API_KEY is not available. No AI requests made.'
  )
  process.exit(process.argv.includes('--require-live') ? 1 : 0)
}
const cap = Number(process.env.STUDY_EVAL_MAX_USD || 0.25)
if (!Number.isFinite(cap) || cap < 0.05 || cap > 1)
  throw new Error('Evaluation cap must be between $0.05 and $1.')
let ledger = null,
  calls = 0
async function generate(prompt, maxOutputTokens = 8000) {
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
        reasoning_effort: 'low',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(210000)
    })
    if (!response.ok)
      throw new Error(`Evaluation provider returned HTTP ${response.status}.`)
    const result = await response.json()
    if (result.usage)
      usage = {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        estimated: false
      }
    return result.choices?.[0]?.message?.content || ''
  } finally {
    ledger = settleStudyLedger(ledger, reserved.reservation.id, usage)
  }
}
const course = {
  courseCode: 'EVAL101',
  courseName: 'Probability',
  academicYear: '2026-2027',
  period: '1'
}
const sources = [
  {
    key: 'current',
    title: 'Current probability lecture',
    kind: 'canvas',
    academicYear: '2026-2027',
    period: '1'
  },
  {
    key: 'old',
    title: 'Historical course notes',
    kind: 'notes',
    academicYear: '2025-2026',
    period: '1'
  }
]
const chunks = [
  {
    id: 'e-current',
    sourceKey: 'current',
    page: 1,
    text: 'For two events A and B, P(A union B) = P(A) + P(B) - P(A intersection B). For disjoint events the intersection has probability zero. Independence instead means P(A intersection B) = P(A)P(B). Complement probability is 1-P(A). With a fair six-sided die each face has probability 1/6. Current exam duration is 120 minutes; it is closed book.'
  },
  {
    id: 'e-old',
    sourceKey: 'old',
    page: 2,
    text: 'In 2025-2026 the exam duration was 90 minutes and notes were permitted. Historical illustration: for a fair die, even outcomes are 2,4,6 so their probability is 3/6.'
  }
]
const topic = {
  id: 'probability',
  title: 'Combining events and checking assumptions',
  sourceIds: chunks.map((c) => c.id)
}
const report = {
  model,
  capUsd: cap,
  calls: 0,
  spentUsd: 0,
  checks: [],
  generated: null,
  limitations:
    'Small fixed source set; AI review is not proof of educational correctness across courses.'
}
try {
  const lesson = assertEvidence(
    parseStudyJson(
      await generate(lessonPrompt(course, sources, chunks, topic)),
      lessonSchema
    ),
    chunks
  )
  const deterministic = studyLessonQuality(lesson, chunks)
  report.generated = lesson
  report.checks.push({
    name: 'format, citations, teaching depth, reasoned solutions and arithmetic',
    passed: deterministic.length === 0,
    issues: deterministic
  })
  const review = parseStudyJson(
    await generate(
      reviewPrompt(course, sources, chunks, { ...lesson, id: topic.id }),
      4000
    ),
    reviewSchema
  )
  report.checks.push({
    name: 'independent evidence review',
    passed: !review.issues.some((i) => i.severity === 'error'),
    issues: review.issues
  })
  const bad = structuredClone(lesson)
  bad.questions[0] = {
    ...bad.questions[0],
    question:
      'What is the probability of an even outcome on a fair six-sided die?',
    answer:
      'It is 2/3 because the even outcomes 2, 4 and 6 occupy four of the six faces.'
  }
  bad.sections[0].text +=
    ' The current 2026-2027 exam is 90 minutes and you may bring notes.'
  const adversarial = parseStudyJson(
    await generate(
      reviewPrompt(course, sources, chunks, { ...bad, id: topic.id }),
      4000
    ),
    reviewSchema
  )
  report.checks.push({
    name: 'review rejects intentionally wrong answer and historical assessment contamination',
    passed:
      adversarial.issues.some(
        (i) =>
          i.severity === 'error' &&
          /probab|2\/3|four|even|incorrect/i.test(i.detail)
      ) &&
      adversarial.issues.some(
        (i) =>
          i.severity === 'error' &&
          /90|120|histor|exam|notes|closed/i.test(i.detail)
      ),
    issues: adversarial.issues
  })
} catch (error) {
  report.checks.push({
    name: 'evaluation completed',
    passed: false,
    issues: [error.message]
  })
}
report.calls = calls
report.spentUsd = (ledger?.total || 0) / 1000000
await writeFile(
  '/tmp/wicker-study-quality-evaluation.json',
  JSON.stringify(report, null, 2)
)
console.log(JSON.stringify({ ...report, generated: undefined }, null, 2))
console.log(
  'Full evaluation artifact: /tmp/wicker-study-quality-evaluation.json'
)
if (report.checks.some((c) => !c.passed)) process.exitCode = 1
