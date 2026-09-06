import { aiQuotaExemption } from './ai-quota-policy.mjs'
import { randomUUID } from 'node:crypto'
import { readDocument, compareAndSwapDocument } from './user-store.mjs'
import { currentAuth } from './request-context.mjs'
import { resolveStudyBilling, estimateStudyCall } from './study-ai-budget.mjs'
import { STUDY_MODELS } from './study-ai-settings.mjs'
import { studyCourse, readStudySourceSnapshot, studySourcesStillAvailable } from './study-version-sources.mjs'
import { StudyVersionError, lessonPrompt, reviewPrompt, lessonSchema, reviewSchema, studyResponseSchema, parseStudyJson, assertEvidence } from './study-version-content.mjs'
import { studyLessonQuality } from './study-content-quality.mjs'
import { evaluationCourse, evaluationSources, evaluationChunks, evaluationTopic } from './study-quality-fixture.mjs'

// Separate from study-versions: these private diagnostics can never be picked
// up by a production queue, published, or mistaken for an approved chapter.
const namespace = 'study-quality-evaluations'
function browserOnly() {
  if (currentAuth().mode === 'api-key') throw new StudyVersionError('Run quality evaluations from your signed-in browser.', 403)
}
function report(row) {
  const { billing, ...safe } = row
  return { ...safe, billing: { source: billing.source, model: billing.model, maxJobUsd: billing.maxJobUsd, unlimited: Boolean(billing.unlimited) } }
}
async function own(id) {
  if (!/^sqe-[a-f0-9-]{36}$/.test(id)) throw new StudyVersionError('Evaluation not found.', 404)
  const row = await readDocument(namespace, id, null)
  if (!row) throw new StudyVersionError('Evaluation not found.', 404)
  return row
}
export async function createQualityEvaluation(input, { platform = {}, sourceOptions = {} } = {}) {
  browserOnly()
  const cap = Number(input.billing?.maxJobUsd ?? 0.25)
  if (!(await aiQuotaExemption()) && (!Number.isFinite(cap) || cap < 0.05 || cap > 1)) throw new StudyVersionError('Evaluation spending cap must be between $0.05 and $1.')
  const billing = await resolveStudyBilling({ ...input.billing, maxJobUsd: cap }, platform)
  const scenario = input.scenario || 'reference'
  if (!['reference', 'sources'].includes(scenario)) throw new StudyVersionError('Choose reference or sources evaluation.')
  let course = evaluationCourse, snapshot = { sources: evaluationSources, chunks: evaluationChunks }, topic = evaluationTopic
  if (scenario === 'sources') {
    course = studyCourse(input.course)
    snapshot = await readStudySourceSnapshot(course, input.sourceKeys, { ...sourceOptions, includeHistorical: input.includeHistorical === true })
    if (snapshot.chunks.reduce((n, c) => n + c.text.length, 0) > 36000) throw new StudyVersionError('Select at most 36,000 characters of source evidence for one evaluation. No evidence is silently truncated.')
    const title = String(input.topic || '').trim()
    if (!title || title.length > 180) throw new StudyVersionError('Name the chapter topic to evaluate (up to 180 characters).')
    topic = { id: 'evaluated-chapter', title, sourceIds: snapshot.chunks.map(c => c.id) }
  }
  const row = { id: `sqe-${randomUUID()}`, revision: randomUUID(), scenario, course, snapshot, topic, billing,
    status: 'pending', stage: 0, createdAt: new Date().toISOString(), checks: [], calls: [], generated: null,
    limitations: 'A small diagnostic sample. Model review is not proof of educational correctness; inspect the generated teaching and solutions against the included evidence.' }
  await compareAndSwapDocument(namespace, row.id, row, null)
  return report(row)
}
export async function readQualityEvaluation(id, { sourceOptions = {} } = {}) {
  browserOnly()
  const row = await own(id)
  if (row.scenario === 'sources' && !await studySourcesStillAvailable(row.snapshot, row.course, sourceOptions)) throw new StudyVersionError('Evaluation source access was withdrawn.', 410)
  return report(row)
}
export async function stepQualityEvaluation(id, expectedRevision, { generate, sourceOptions = {} } = {}) {
  browserOnly()
  const row = await own(id)
  await readQualityEvaluation(id, { sourceOptions })
  // A repeated/lost browser response cannot start the next paid step. The
  // caller must explicitly submit the revision it has actually received.
  if (expectedRevision !== row.revision || row.status !== 'pending') return report(row)
  if (typeof generate !== 'function') throw new StudyVersionError('Evaluation provider is unavailable.', 503)
  const claimed = { ...row, revision: randomUUID(), status: 'running', startedAt: new Date().toISOString() }
  await compareAndSwapDocument(namespace, id, claimed, row.revision)
  const next = structuredClone(claimed)
  try {
    let prompt
    if (row.stage === 0) prompt = lessonPrompt(row.course, row.snapshot.sources, row.snapshot.chunks, row.topic)
    else {
      const chapter = structuredClone(row.generated)
      if (row.stage === 2) {
        chapter.questions[0] = { ...chapter.questions[0], question: 'What is the probability of an even outcome on a fair six-sided die?', answer: 'It is 2/3 because the even outcomes 2, 4 and 6 occupy four of the six faces.' }
        chapter.sections[0].text += ' The current 2026-2027 exam is 90 minutes and you may bring notes.'
      }
      prompt = reviewPrompt(row.course, row.snapshot.sources, row.snapshot.chunks, { ...chapter, id: row.topic.id })
    }
    const maxOutputTokens = row.stage === 0 ? 10000 : 4000
    const result = await generate(prompt, { responseSchema: studyResponseSchema(row.stage === 0 ? lessonSchema : reviewSchema), billing: row.billing, jobKey: row.id, maxOutputTokens,
      usageMetadata: row.stage === 0 ? { chapterId: row.topic.id } : {} })
    const usage = result.usage || null, price = STUDY_MODELS[row.billing.model]
    const chargedMicros = usage && !usage.estimated ? Math.ceil(usage.inputTokens * price.input + usage.outputTokens * price.output) : estimateStudyCall(prompt, maxOutputTokens, row.billing.model).micros
    next.calls.push({ stage: row.stage, usage, chargedUsd: chargedMicros / 1000000, conservative: !usage || usage.estimated })
    if (row.stage === 0) {
      next.generated = assertEvidence(parseStudyJson(result.text, lessonSchema), row.snapshot.chunks)
      const issues = studyLessonQuality(next.generated, row.snapshot.chunks)
      next.checks.push({ name: 'Format, citation validity, teaching depth, reasoned solutions and arithmetic', passed: !issues.length, issues })
    } else {
      const { issues } = parseStudyJson(result.text, reviewSchema)
      const passed = row.stage === 1 ? !issues.some(i => i.severity === 'error') :
        issues.some(i => i.severity === 'error' && /probab|2\/3|four|even|incorrect/i.test(i.detail)) &&
        issues.some(i => i.severity === 'error' && /90|120|histor|exam|notes|closed/i.test(i.detail))
      next.checks.push({ name: row.stage === 1 ? 'Independent evidence review' : 'Reviewer detects wrong solution and outdated exam rules', passed, issues })
    }
    next.stage++
    next.status = next.stage >= (row.scenario === 'reference' ? 3 : 2) ? 'complete' : 'pending'
    if (row.scenario === 'sources' && !await studySourcesStillAvailable(row.snapshot, row.course, sourceOptions)) throw new StudyVersionError('Evaluation source access was withdrawn.', 410)
  } catch (error) {
    next.status = 'failed'
    // Provider errors can contain account details; keep them out of reports.
    next.error = error instanceof StudyVersionError ? error.message : 'Evaluation provider request failed. Check the connection and budget before starting a new evaluation.'
    next.checks.push({ name: 'Evaluation completed', passed: false, issues: [next.error] })
    next.limitations += ' Failed or interrupted provider calls may retain their full budget reservation; check AI settings for the account total.'
  }
  next.revision = randomUUID()
  next.updatedAt = new Date().toISOString()
  await compareAndSwapDocument(namespace, id, next, claimed.revision)
  return readQualityEvaluation(id, { sourceOptions })
}
