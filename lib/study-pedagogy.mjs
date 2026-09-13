import { z } from 'zod'

const key = z.string().regex(/^[a-z0-9-]{1,70}$/)
const prose = z.string().trim().min(1).max(4000)
const ids = z.array(key).max(24)
const refs = z.array(z.string().min(1).max(120)).min(1).max(120)
export const teachingPlanSchema = z.object({
  objectives: z.array(z.object({
    id: key, goal: z.string().trim().min(1).max(180),
    complexity: z.enum(['simple', 'difficult']),
    basis: z.enum(['course', 'background']), sourceIds: refs,
    prerequisites: z.array(z.object({ text: prose, basis: z.enum(['course', 'background']), sourceIds: refs })).max(8),
    demonstration: prose,
    teachingApproach: prose,
  })).min(1).max(8),
  exclusions: z.array(prose).max(15),
  gaps: z.array(prose).max(15),
})
export const coverageSchema = z.array(z.object({
  objectiveId: key, explanationSectionIds: ids.min(1), workedExampleSectionIds: ids,
  guidedQuestionKeys: ids, independentQuestionKeys: ids.min(1), transferQuestionKeys: ids,
})).min(1).max(8)
export const diagnosticQuestionFields = {
  key, objectiveIds: ids.min(1), practiceStage: z.enum(['guided', 'independent', 'transfer']),
  hints: z.array(prose).max(4),
  misconceptions: z.array(z.object({ mistake: prose, explanation: prose, followUpKey: key })).max(4),
}
export const pedagogyReviewSchema = z.object({
  objectives: z.array(z.object({
    objectiveId: key, adequate: z.boolean(),
    explanation: z.object({ sectionId: key, quote: prose }),
    workedExample: z.object({ sectionId: key, quote: prose }).nullable(),
    guidedQuestionKey: key.nullable(), independentQuestionKey: key,
    rationale: prose, missingReasoning: z.array(prose).max(8),
  })).min(1).max(8),
  issues: z.array(z.object({ topicId: z.string(), detail: prose, severity: z.enum(['warning', 'error']) })).max(40),
})

export function teachingPlanPrompt(context, topic) {
  return `${context}\nPLAN THE TEACHING before drafting ${JSON.stringify(topic)}. Identify what a beginner must explain or do, the prerequisites, and an observable demonstration of understanding. Mark mechanism traces, multi-step reasoning and interacting concepts difficult; a short definition may be simple. Allocate teaching according to difficulty, not equal word counts or a universal template. Distinguish course-supported objectives from conventional background needed to understand them. Background must not broaden the examinable syllabus. Preserve exclusions and source gaps. A syllabus naming a textbook/chapter is a reading requirement, not access to its contents. Teach textbook-dependent objectives only from supplied readable excerpts or accessible book content; identify missing readings explicitly and never invent what an unavailable book says. Cite the course evidence that motivates each objective/prerequisite; a background citation indicates relevance, not that the source explicitly teaches it. Describe a suitable teaching approach for each objective, including worked reasoning, a supported attempt, an independent variation and a boundary/misconception when useful. Return only the structured plan.`
}
export function pedagogyPrompt(context, chapter) {
  const { evidenceReview, pedagogicalReview, review, ...artifact } = chapter
  return `${context}\nINDEPENDENT PEDAGOGICAL REVIEW. Judge whether a beginner can learn the assessed reasoning from the actual artifact. Do not trust its objectiveCoverage map, skill labels, section counts, word counts or the author's claims of depth. Review EACH planned objective, including whether its complexity is understated, prerequisites are taught and source exclusions are respected. For each objective identify an exact short quote from visible section.text (not optional detail) that explains the mechanism, the worked example with assumptions/intermediate steps for difficult objectives, and the guided and independent questions that this teaching prepares the learner to solve. Simple definitions need proportionate instruction; do not impose a universal template. A correct exercise requiring untaught reasoning is a blocking error. Explain exactly how the cited teaching prepares the learner, or name the missing reasoning. Examine progressive hints, plausible mistakes, and whether related follow-ups change a meaningful condition rather than just numbers. Identify transfer beyond copied worked steps. Set adequate=false and report missingReasoning when teaching is shallow even if every statement is factually true. Flag missing prerequisites, misclassified difficult objectives, syllabus expansion or unsupported claims. Quote only text actually present; missing examples may use null, with an inadequate verdict. Do not fabricate a passing review. Return the structured review, not a rewritten lesson. Chapter: ${JSON.stringify(artifact)}`
}

// Referential integrity establishes coverage, not pedagogical truth. The
// independent review must evaluate the actual explanations and exercises.
export function objectiveCoverageIssues(chapter, plan = chapter.teachingPlan) {
  if (chapter.formatVersion !== 3) return []
  const issues = []
  if (!plan?.objectives?.length) return ['The lesson needs its pre-drafting objective/evidence plan.']
  const objectives = new Map(plan.objectives.map(o => [o.id, o]))
  const sections = new Map(chapter.sections.map(s => [s.id, s]))
  const questions = new Map(chapter.questions.map(q => [q.key, q]))
  if (objectives.size !== plan.objectives.length || sections.size !== chapter.sections.length || questions.size !== chapter.questions.length) issues.push('Objective, section and question keys must be unique.')
  const coverage = chapter.objectiveCoverage || []
  if (coverage.length !== objectives.size || new Set(coverage.map(c => c.objectiveId)).size !== objectives.size) issues.push('Map every planned objective exactly once.')
  for (const block of [...chapter.sections, ...chapter.questions]) {
    if (!block.objectiveIds?.length || block.objectiveIds.some(id => !objectives.has(id))) issues.push('Teaching and questions must reference valid planned objectives.')
  }
  for (const path of coverage) {
    const objective = objectives.get(path.objectiveId)
    if (!objective) { issues.push('Coverage references an unknown objective.'); continue }
    for (const field of ['explanationSectionIds', 'workedExampleSectionIds']) {
      for (const id of path[field] || []) if (!sections.get(id)?.objectiveIds.includes(objective.id)) issues.push(`${objective.id}: ${field} must point to visible teaching for this objective.`)
    }
    for (const [field, stage] of [['guidedQuestionKeys', 'guided'], ['independentQuestionKeys', 'independent'], ['transferQuestionKeys', 'transfer']]) {
      for (const id of path[field] || []) {
        const q = questions.get(id)
        if (!q?.objectiveIds.includes(objective.id) || q.practiceStage !== stage) issues.push(`${objective.id}: ${field} must identify a ${stage} question for this objective.`)
      }
    }
    if (!path.explanationSectionIds?.length || !path.independentQuestionKeys?.length) issues.push(`${objective.id}: explain and independently assess this objective.`)
    if (objective.complexity === 'difficult' && (!path.workedExampleSectionIds?.length || !path.guidedQuestionKeys?.length || !path.transferQuestionKeys?.length)) issues.push(`${objective.id}: difficult objectives need worked reasoning, a supported attempt and transfer practice.`)
  }
  for (const q of chapter.questions) {
    if (q.practiceStage === 'guided' && q.hints.length < 2) issues.push(`${q.key}: supported attempts need progressively more explicit hints.`)
    for (const misconception of q.misconceptions || []) {
      const followUp = questions.get(misconception.followUpKey)
      if (!followUp || followUp.key === q.key || !followUp.objectiveIds.some(id => q.objectiveIds.includes(id))) issues.push(`${q.key}: misconception follow-ups must be a different question testing the same objective.`)
    }
    if (q.objectiveIds.some(id => objectives.get(id)?.complexity === 'difficult') && !q.misconceptions?.length) issues.push(`${q.key}: difficult-objective practice needs diagnostic mistakes and related follow-ups.`)
  }
  return [...new Set(issues)]
}

export function pedagogyReviewIssues(chapter, review) {
  const issues = [...review.issues]
  const fail = detail => issues.push({ topicId: chapter.id, severity: 'error', detail })
  const objectives = chapter.teachingPlan?.objectives || []
  if (review.objectives.length !== objectives.length || new Set(review.objectives.map(o => o.objectiveId)).size !== objectives.length) fail('Pedagogical review must evaluate every planned objective exactly once.')
  for (const objective of objectives) {
    const check = review.objectives.find(o => o.objectiveId === objective.id)
    if (!check) { fail(`Missing pedagogical review for ${objective.id}.`); continue }
    if (!check.adequate || check.missingReasoning.length) fail(`${objective.id}: ${check.missingReasoning.join(' ') || check.rationale}`)
    for (const evidence of [check.explanation, check.workedExample].filter(Boolean)) {
      const section = chapter.sections.find(s => s.id === evidence.sectionId)
      if (!section?.objectiveIds.includes(objective.id) || !section.text.includes(evidence.quote)) fail(`${objective.id}: review evidence must quote its actual visible teaching.`)
    }
    for (const [field, stage] of [['guidedQuestionKey', 'guided'], ['independentQuestionKey', 'independent']]) {
      if (field === 'guidedQuestionKey' && objective.complexity === 'simple' && !check[field]) continue
      const q = chapter.questions.find(q => q.key === check[field])
      if (!q?.objectiveIds.includes(objective.id) || q.practiceStage !== stage) fail(`${objective.id}: review must identify the actual ${stage} assessment.`)
    }
    if (objective.complexity === 'difficult' && !check.workedExample) fail(`${objective.id}: no worked reasoning identified by the pedagogical reviewer.`)
  }
  return issues
}
