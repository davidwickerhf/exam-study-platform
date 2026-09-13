import { z } from 'zod/v3'

const key = z.string().regex(/^[a-z0-9-]{1,70}$/)
const prose = z.string().trim().min(1).max(4000)
const quote = z.string().trim().min(1).max(280)
const ids = z.array(key).max(48)
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
    explanation: z.object({ sectionId: key, quote }),
    workedExample: z.object({ sectionId: key, quote }).nullable(),
    guidedQuestionKey: key.nullable(), independentQuestionKey: key,
    rationale: prose, missingReasoning: z.array(prose).max(8),
  })).min(1).max(8),
  transferChecks: z.array(z.object({ questionKey:key, closestExampleSectionId:key.nullable(), changedCondition:prose, variation:z.enum(['copied','numbers_only','new_context','reverse_inference','combined_mechanisms','diagnosis','boundary_change']), rationale:prose })).max(48).default([]),
  followUpChecks: z.array(z.object({ questionKey:key, useful:z.boolean(), rationale:prose })).max(48).default([]),
  issues: z.array(z.object({ topicId: z.string(), detail: prose, severity: z.enum(['warning', 'error']) })).max(40),
})

export function teachingPlanPrompt(context, topic) {
  return `${context}\nPLAN THE TEACHING before drafting ${JSON.stringify(topic)}. Identify what a beginner must explain or do, the prerequisites, and an observable demonstration of understanding. Mark mechanism traces, multi-step reasoning and interacting concepts difficult; a short definition may be simple. Allocate teaching according to difficulty, not equal word counts or a universal template. Distinguish course-supported objectives from conventional background needed to understand them. Background must not broaden the examinable syllabus. Preserve exclusions and source gaps separately: silence about a topic never establishes an exam exclusion. Keep each goal a complete phrase under 20 words, and all prose complete within field limits; never truncate a sentence. Independently check the arithmetic in each proposed demonstration. A syllabus naming a textbook/chapter is a reading requirement, not access to its contents. Teach textbook-dependent objectives only from supplied readable excerpts or accessible book content; identify missing readings explicitly and never invent what an unavailable book says. Cite the course evidence that motivates each objective/prerequisite; a background citation indicates relevance, not that the source explicitly teaches it. Describe a suitable teaching approach for each objective, including worked reasoning, a supported attempt, an independent variation and a boundary/misconception when useful. Return only the structured plan.`
}
export function pedagogyPrompt(context, chapter) {
  const { evidenceReview, pedagogicalReview, pedagogyAudit, factualAudit, factualRetry, practiceLinkReview, review, ...content } = chapter
  // Answer keys must not be mistaken for instruction available before attempting a question.
  const artifact={...content,teachingPlan:content.teachingPlan && {...content.teachingPlan,objectives:content.teachingPlan.objectives.map(({teachingApproach,demonstration,...objective})=>objective)},questions:content.questions.map(({answer,...question})=>question)}
  return `${context}\nINDEPENDENT PEDAGOGICAL REVIEW. Judge whether a beginner can learn the assessed reasoning from the actual artifact. Do not trust its objectiveCoverage map, skill labels, section counts, word counts or the author's claims of depth. CORE TEACHING IS ONLY sections[].text. Question prompts, hints, misconception feedback, source excerpts and answer keys are not worked teaching before the attempt. Reference answers are intentionally withheld: correctness is checked separately. If a difficult objective has only a definition in section.text, set adequate=false and workedExample=null even when its questions or hints reveal a solution. Inspect the actual intermediate reasoning in section.text, not the coverage map's workedExampleSectionIds claim. Select an excerpt provided by the response schema for the appropriate section, or copy ONE contiguous sentence or shorter excerpt, at most 280 characters, as an exact substring of the selected section.text. The selectable excerpts are evidence locations, not evidence of adequacy; judge the entire section and set adequate=false when its reasoning is insufficient. Never join separated sentences, even from the same paragraph. Do not translate Unicode mathematics to LaTeX, substitute punctuation, join separated sentences or quote another field under a section ID. Review EACH planned objective, including whether its complexity is understated, prerequisites are taught and source exclusions are respected. Judge prerequisites needed for the assessed reasoning. Do not require alternative mathematical formulations, formal proofs, API names, extra mechanisms or a standalone prerequisite section when the actual explanation already prepares the learner. Out-of-scope enrichment is not missingReasoning. adequate=true requires missingReasoning=[]. Optional improvements belong in warning issues; missingReasoning is reserved for blocking untaught reasoning required by an actual assessment. For each objective identify an exact short quote from visible section.text (not optional detail) that explains the mechanism, the worked example with assumptions/intermediate steps for difficult objectives, and the guided and independent questions that this teaching prepares the learner to solve. Simple definitions need proportionate instruction; do not impose a universal template. A correct exercise requiring untaught reasoning is a blocking error. Explain exactly how the cited teaching prepares the learner, or name the missing reasoning. Examine progressive hints, plausible mistakes, and whether related follow-ups change a meaningful condition rather than just numbers. Identify transfer beyond copied worked steps. Transfer may select or combine already-taught mechanisms in a new situation, reverse the direction of inference, diagnose an impossible claim or change a boundary that alters the reasoning. It does not require a new theory or untaught concept. Combining two known methods counts when the learner must choose that combination and the worked example did not already do it. Merely substituting numbers or event sizes into the same worked procedure does not count. Compare each transfer question with the visible worked examples: reusing the same case, inputs and requested conclusion is not transfer even when the wording or question key differs. Such a question must be replaced with an assessment that changes context or required reasoning. Set adequate=false and report missingReasoning when teaching is shallow even if every statement is factually true. Flag missing prerequisites, misclassified difficult objectives, syllabus expansion or unsupported claims. Quote only text actually present; missing examples may use null, with an inadequate verdict. Do not fabricate a passing review. Return one transferChecks row for EVERY practiceStage=transfer question, naming the closest visible example and the actual changed condition/reasoning. Classify variation as copied, numbers_only, new_context, reverse_inference, combined_mechanisms, diagnosis or boundary_change. Compare the required task with the closest worked example, not whether it uses a new theory. Reverse inference (e.g. deciding which hidden histories fit a log) is different from forward calculation even when both use the same principle. Diagnosis of an unbounded wait is different from calculating a known finite delay. Mere renaming or new numbers is numbers_only, not new_context. Use copied when the same inputs and requested conclusion recur. Explain the classification with the actual difference. Return one followUpChecks row for EVERY question with misconceptions; inspect EVERY misconception and its own linked question, not just whether one link is useful or shares a broad objective. Each target must practise the specific reasoning implicated by that mistake. A forward calculation with an already supplied quantity does not remediate failure to recover that unknown quantity from a result. Rephrasing the source question does not fix an unchanged inappropriate target. Set useful=false if any attached misconception lacks a suitable follow-up, and identify that mistake and target key in the rationale. Do not omit failed checks. Return the structured review, not a rewritten lesson. Chapter: ${JSON.stringify(artifact)}`
}

// Coverage is an index over the finished artifact, not another set of model
// predictions. Deriving it does not establish that those questions teach/test
// their claimed objective; the independent semantic review still has to do so.
export function deriveObjectiveCoverage(chapter, plan=chapter.teachingPlan) {
  if(chapter.formatVersion!==3 || !plan)return chapter
  const supplied=new Map((chapter.objectiveCoverage||[]).map(row=>[row.objectiveId,row]))
  chapter.objectiveCoverage=plan.objectives.map(objective=>({
    objectiveId:objective.id,
    explanationSectionIds:chapter.sections.filter(s=>s.objectiveIds?.includes(objective.id)).map(s=>s.id),
    workedExampleSectionIds:supplied.get(objective.id)?.workedExampleSectionIds || [],
    ...Object.fromEntries([['guidedQuestionKeys','guided'],['independentQuestionKeys','independent'],['transferQuestionKeys','transfer']].map(([field,stage])=>[field,chapter.questions.filter(q=>q.objectiveIds?.includes(objective.id)&&q.practiceStage===stage).map(q=>q.key)]))
  }))
  return chapter
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
  const transfers=chapter.questions.filter(q=>q.practiceStage==='transfer')
  const followUps=chapter.questions.filter(q=>q.misconceptions?.length)
  for(const [rows,questions,label] of [[review.transferChecks||[],transfers,'transfer'],[review.followUpChecks||[],followUps,'misconception follow-up']]) {
    if(rows.length!==questions.length || new Set(rows.map(r=>r.questionKey)).size!==questions.length || rows.some(r=>!questions.some(q=>q.key===r.questionKey)))fail(`Review every ${label} question exactly once.`)
    for(const q of questions){
      const row=rows.find(r=>r.questionKey===q.key)
      if(!row)continue
      if(label==='transfer') {
        if(row.closestExampleSectionId && !chapter.sections.some(s=>s.id===row.closestExampleSectionId))fail(`${q.key}: transfer comparison references missing teaching.`)
        if(!['new_context','reverse_inference','combined_mechanisms','diagnosis','boundary_change'].includes(row.variation))fail(`${q.key}: ${row.rationale}`)
      } else if(!row.useful)fail(`${q.key}: ${row.rationale}`)
    }
  }
  return issues
}
