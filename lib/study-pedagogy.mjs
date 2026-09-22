import { z } from 'zod/v3'

const key = z.string().regex(/^[a-z0-9-]{1,70}$/)
const prose = z.string().trim().min(1).max(4000)
const quote = z.string().trim().min(1).max(280)
const ids = z.array(key).max(48)
const refs = z.array(z.string().min(1).max(120)).min(1).max(120)
export const teachingPlanSchema = z.object({
  objectives: z.array(z.object({
    id: key, goal: z.string().trim().min(1).max(400),
    complexity: z.enum(['simple', 'difficult']),
    basis: z.enum(['course', 'background']), sourceIds: refs,
    prerequisites: z.array(z.object({ text: prose, basis: z.enum(['course', 'background']), sourceIds: refs })).max(8),
    demonstration: prose,
    teachingApproach: prose,
  })).min(1).max(8),
  exclusions: z.array(prose).max(15),
  gaps: z.array(prose).max(15),
})
// PRACTICE BLUEPRINT. The plan call also commits to the practice skeleton the
// draft will write: per objective, the stable question keys, stage, skill,
// difficulty and kind, and for every core question of a difficult objective
// one diagnosed misconception, its follow-up key and the changed condition
// that follow-up tests. The skeleton is checked deterministically against the
// chapter contract before any drafting money is spent (blueprintIssues).
// Stored beside the plan, never inside it, so saved plans, reviews and their
// dependency hashes are unchanged.
export const practiceBlueprintSchema = z.array(z.object({
  key, objectiveId: key, stage: z.enum(['guided', 'independent', 'transfer', 'remediation']),
  skill: z.enum(['recall', 'compare', 'apply', 'diagnose', 'transfer']), difficulty: z.enum(['foundation', 'standard', 'challenge']), kind: z.enum(['recall', 'application', 'exam-style']),
  misconception: z.object({ mistake: z.string().trim().min(1).max(400), followUpKey: key, changedCondition: z.string().trim().min(1).max(400) }).nullable(),
})).max(48)
// The provider must return a blueprint; a saved or scripted plan without one
// is still accepted and simply drafts without it.
export const teachingPlanResponseSchema = teachingPlanSchema.extend({ practice: practiceBlueprintSchema })
export const teachingPlanAcceptSchema = teachingPlanSchema.extend({ practice: practiceBlueprintSchema.optional() })
export const PRACTICE_BLUEPRINT_INSTRUCTIONS = ' PRACTICE BLUEPRINT: also return practice, the skeleton of the chapter\'s practice questions that the draft will write, 8 to 24 rows. Each row names a stable question key (lowercase, hyphenated), its objectiveId, stage (guided, independent, transfer or remediation), skill, difficulty and kind. Rules the skeleton is checked against before drafting: every objective has at least one independent question; every difficult objective additionally has at least one guided and one transfer question; every guided, independent or transfer row of a difficult objective has a misconception (the specific mistaken reasoning, the followUpKey of a different row for the same objective that makes the learner exercise exactly that reasoning, and the changed condition in that follow-up); remediation rows have misconception=null and are the followUpKey of some misconception; at least 8 rows, at least 4 with kind application or exam-style, at least 2 with difficulty challenge, at least 3 distinct skills. Keep recall-skill rows to at most 2. Plan transfer as a change in the reasoning required, not a restated worked case.'
export const coverageSchema = z.array(z.object({
  objectiveId: key, explanationSectionIds: ids.min(1), workedExampleSectionIds: ids,
  guidedQuestionKeys: ids, independentQuestionKeys: ids.min(1), transferQuestionKeys: ids,
})).min(1).max(8)
export const diagnosticQuestionFields = {
  key, objectiveIds: ids.min(1), practiceStage: z.enum(['guided', 'independent', 'transfer', 'remediation']),
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
  // Every finding names what it is about, so a correction can patch exactly
  // that section, objective or question instead of rewriting the chapter.
  // 'chapter' is reserved for genuinely chapter-wide problems.
  issues: z.array(z.object({ topicId: z.string(), scope: z.enum(['section', 'objective', 'question', 'chapter']), detail: prose, severity: z.enum(['warning', 'error']) })).max(40),
})

export function teachingPlanPrompt(context, topic, outline = []) {
  return `${context}\nPLAN THE TEACHING before drafting ${JSON.stringify(topic)}. Identify what a beginner must explain or do, the prerequisites, and an observable demonstration of understanding. Neighboring chapters in this guide: ${JSON.stringify(outline.filter(other=>other.id!==topic.id).map(({id,title,concepts})=>({id,title,...(concepts?{concepts}: {})})))}. When topic.concepts lists mapped concepts, retain each in the planned objectives or necessary prerequisite teaching; consolidate overlapping descriptions without silently dropping their reasoning. Explicitly non-examinable background remains background, not a new exam objective. When conceptEvidence is present, it identifies the mapped evidence supporting each concept in this part. Do not import the entire parent chapter scope into a split part. Give this chapter responsibility for its own concepts: do not expand a neighboring chapter's subject into a duplicate set of objectives, worked exercises and flashcards. Introduce a prerequisite from another chapter briefly when the present reasoning needs it, while retaining the full explanation needed to solve this chapter's actual assessments. Closely related concepts can share one observable objective when that objective still names the reasoning required; do not create a separate objective merely for every definition, tool command or example. Do not omit an essential mechanism or label difficult reasoning simple to reduce the plan. The objective limit is a ceiling, not a target. Mark mechanism traces, multi-step reasoning and interacting concepts difficult; a short definition may be simple. Allocate teaching according to difficulty, not equal word counts or a universal template. Distinguish course-supported objectives from conventional background needed to understand them. Background must not broaden the examinable syllabus. Preserve exclusions and source gaps separately: silence about a topic never establishes an exam exclusion. Keep each goal a complete phrase under 20 words, and all prose complete within field limits; never truncate a sentence. Independently check the arithmetic in each proposed demonstration. A syllabus naming a textbook/chapter is a reading requirement, not access to its contents. Teach textbook-dependent objectives only from supplied readable excerpts or accessible book content; identify missing readings explicitly and never invent what an unavailable book says. Cite the course evidence that motivates each objective/prerequisite; a background citation indicates relevance, not that the source explicitly teaches it. Describe a suitable teaching approach for each objective, including worked reasoning, a supported attempt, an independent variation and a boundary/misconception when useful. RECURRING FAILURES TO AVOID: plan each diagnosed misconception together with a follow-up that makes the learner exercise that specific mistaken reasoning, not another question that merely shares the objective. Plan transfer as a change in the reasoning required, not the worked demonstration restated with a new scenario, domain or numbers. Do not plan an objective, prerequisite or demonstration around a mechanism absent from the supplied evidence: drop it, or mark it clearly as background rather than examinable scope. Never print internal evidence identifiers in goals, prerequisites, exclusions, gaps or any other student-facing prose; carry them only in the structured source fields. The objective that defines this chapter's core idea must cite the current-edition evidence that actually defines it. Return only the structured plan.`
}
export function pedagogyPrompt(context, chapter, {quoteReferences=null}={}) {
  // Keep the teaching needed to assess prerequisites and transfer, but omit revision
  // cards, optional extensions, answer keys and prior acceptance metadata.
  const questionView=({answer,id,...question})=>question
  const artifact={
    title:chapter.title,
    sections:chapter.sections.map(({id,title,text,objectiveIds,sourceIds})=>({id,title,text,objectiveIds,sourceIds})),
    // Teaching owned by objectives outside this review. Context only: it is
    // never quoted or judged here, and a later checkpoint reviews it directly.
    otherSections:(chapter.otherSections||[]).map(({id,title,text,objectiveIds,sourceIds})=>({id,title,text,objectiveIds,sourceIds})),
    teachingPlan:chapter.teachingPlan && {...chapter.teachingPlan,objectives:chapter.teachingPlan.objectives.map(({teachingApproach,demonstration,...objective})=>objective)},
    objectiveCoverage:chapter.objectiveCoverage,
    questions:chapter.questions.map(questionView),
    relatedQuestions:(chapter.relatedQuestions || []).map(questionView),
    caveats:chapter.caveats,
  }
  if(quoteReferences)artifact.reviewExcerpts=quoteReferences
  const quoteInstructions=quoteReferences
    ? 'For explanation and workedExample, select a reviewExcerpts identifier in the quote field and its matching sectionId. The server resolves that identifier to the exact visible excerpt. Judge the whole section: selecting an excerpt does not establish adequacy. Never put free-form prose into quote for this checkpoint. Use null for a missing worked example.'
    : 'Select an excerpt provided by the response schema for the appropriate section, or copy ONE contiguous sentence or shorter excerpt, at most 280 characters, as an exact substring of the selected section.text. The selectable excerpts are evidence locations, not evidence of adequacy; judge the entire section and set adequate=false when its reasoning is insufficient. Never join separated sentences, even from the same paragraph. Do not translate Unicode mathematics to LaTeX, substitute punctuation, join separated sentences or quote another field under a section ID.'
  return `${context}\nINDEPENDENT PEDAGOGICAL REVIEW. Judge whether a beginner can learn the assessed reasoning from the actual artifact. Do not trust its objectiveCoverage map, skill labels, section counts, word counts or the author's claims of depth. CORE TEACHING IS ONLY sections[].text. Question prompts, hints, misconception feedback, source excerpts and answer keys are not worked teaching before the attempt. Reference answers are intentionally withheld: correctness is checked separately. If a difficult objective has only a definition in section.text, set adequate=false and workedExample=null even when its questions or hints reveal a solution. Inspect the actual intermediate reasoning in section.text, not the coverage map's workedExampleSectionIds claim. ${quoteInstructions} Review EACH planned objective, including whether its complexity is understated, prerequisites are taught and source exclusions are respected. Judge prerequisites needed for the assessed reasoning. Do not require alternative mathematical formulations, formal proofs, API names, extra mechanisms or a standalone prerequisite section when the actual explanation already prepares the learner. Out-of-scope enrichment is not missingReasoning. adequate=true requires missingReasoning=[]. Optional improvements belong in warning issues; missingReasoning is reserved for blocking untaught reasoning required by an actual assessment. For each objective identify an exact short quote from visible section.text (not optional detail) that explains the mechanism, the worked example with assumptions/intermediate steps for difficult objectives, and the guided and independent questions that this teaching prepares the learner to solve. Simple definitions need proportionate instruction; do not impose a universal template. A correct exercise requiring untaught reasoning is a blocking error. Explain exactly how the cited teaching prepares the learner, or name the missing reasoning. Only questions explicitly marked practiceStage=remediation are terminal diagnostic follow-ups: they need complete reasoned answers but no further misconception links, and do not count as independent or transfer assessment. An existing guided, independent or transfer question may also be a linked follow-up; that incoming link does not change its practiceStage or disqualify its assessment coverage. Judge whether the linked question targets the mistake, not whether it has incoming links. Do not require transfer novelty from a remediation question; check that its changed condition directly practises the diagnosed reasoning. Examine progressive hints, plausible mistakes, and whether related follow-ups change a meaningful condition rather than just numbers. Identify transfer beyond copied worked steps. Transfer may select or combine already-taught mechanisms in a new situation, reverse the direction of inference, diagnose an impossible claim or change a boundary that alters the reasoning. It does not require a new theory or untaught concept. Combining two known methods counts when the learner must choose that combination and the worked example did not already do it. Merely substituting numbers or event sizes into the same worked procedure does not count. Compare each transfer question with the visible worked examples: reusing the same case, inputs and requested conclusion is not transfer even when the wording or question key differs. Such a question must be replaced with an assessment that changes context or required reasoning. Set adequate=false and report missingReasoning when teaching is shallow even if every statement is factually true. Flag missing prerequisites, misclassified difficult objectives, syllabus expansion or unsupported claims. Quote only text actually present; missing examples may use null, with an inadequate verdict. Do not fabricate a passing review. Return one transferChecks row for EVERY practiceStage=transfer question, naming the closest visible example and the actual changed condition/reasoning. Classify variation as copied, numbers_only, new_context, reverse_inference, combined_mechanisms, diagnosis or boundary_change. Compare the required task with the closest worked example, not whether it uses a new theory. Reverse inference (e.g. deciding which hidden histories fit a log) is different from forward calculation even when both use the same principle. Diagnosis of an unbounded wait is different from calculating a known finite delay. Mere renaming or new numbers is numbers_only, not new_context. Use copied when the same inputs and requested conclusion recur. Explain the classification with the actual difference. Return one followUpChecks row for EVERY question with misconceptions; inspect EVERY misconception and its own linked question, not just whether one link is useful or shares a broad objective. Each target must practise the specific reasoning implicated by that mistake. A forward calculation with an already supplied quantity does not remediate failure to recover that unknown quantity from a result. Rephrasing the source question does not fix an unchanged inappropriate target. Set useful=false if any attached misconception lacks a suitable follow-up, and identify that mistake and target key in the rationale. Do not omit failed checks. SCOPE EVERY ISSUE. Each issues[] entry must name exactly what it is about: scope 'section', 'objective' or 'question' with topicId set to that exact section id, objective id or question key. Reserve scope 'chapter' (topicId ${JSON.stringify(chapter.id)}) for a genuinely chapter-wide fault that cannot be attributed to any single section, objective or question; it forces a full chapter rewrite, so do not use it for a local problem. Return the structured review, not a rewritten lesson. Chapter: ${JSON.stringify(artifact)}`
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

const COVERAGE_SECTION_FIELDS = ['explanationSectionIds', 'workedExampleSectionIds']
const COVERAGE_QUESTION_FIELDS = [['guidedQuestionKeys', 'guided'], ['independentQuestionKeys', 'independent'], ['transferQuestionKeys', 'transfer']]
// The exact text objectiveCoverageIssues raises for a stray cross-objective
// link. Kept in sync with that function so the deterministic recovery below
// (and the pipeline's zero-cost resume gate) can recognise precisely the
// findings it is able to fix, and nothing else.
export const OBJECTIVE_LINK_ISSUE_PATTERN = /^[a-z0-9-]{1,70}: (?:explanationSectionIds|workedExampleSectionIds) must point to visible teaching for this objective\.$|^[a-z0-9-]{1,70}: (?:guidedQuestionKeys|independentQuestionKeys|transferQuestionKeys) must identify a (?:guided|independent|transfer) question for this objective\.$/

// A drafted objectiveCoverage row can name a section or question that exists
// and is fine on its own, but is not actually tagged for this objective (a
// worked example shared with a neighbouring objective, say). That single
// stray cross-reference used to fail the whole chapter's structural review
// and cost a full model correction even though nothing about the actual
// teaching was wrong. This drops only the invalid reference, only when a
// valid one remains in the same list, so the check still blocks a list that
// would otherwise be left empty. It never adds an objective tag or invents a
// link; every drop is recorded in chapter.linkRepairs for visibility.
export function normalizeObjectiveCoverageLinks(chapter, plan = chapter.teachingPlan) {
  if (chapter.formatVersion !== 3 || !plan || !chapter.objectiveCoverage?.length) return chapter
  const objectives = new Map(plan.objectives.map(o => [o.id, o]))
  const sections = new Map(chapter.sections.map(s => [s.id, s]))
  const questions = new Map(chapter.questions.map(q => [q.key, q]))
  const linkRepairs = []
  const objectiveCoverage = chapter.objectiveCoverage.map(row => {
    const objective = objectives.get(row.objectiveId)
    if (!objective) return row
    let changed = false
    const next = { ...row }
    for (const field of COVERAGE_SECTION_FIELDS) {
      const ids = row[field]
      if (!Array.isArray(ids) || !ids.length) continue
      const valid = ids.filter(id => sections.get(id)?.objectiveIds?.includes(objective.id))
      if (valid.length && valid.length < ids.length) {
        for (const id of ids) if (!valid.includes(id)) linkRepairs.push({ objectiveId: objective.id, list: field, ref: id, reason: sections.has(id) ? 'section is not tagged with this objective' : 'section does not exist' })
        next[field] = valid
        changed = true
      }
    }
    for (const [field, stage] of COVERAGE_QUESTION_FIELDS) {
      const keys = row[field]
      if (!Array.isArray(keys) || !keys.length) continue
      const valid = keys.filter(key => questions.get(key)?.objectiveIds?.includes(objective.id) && questions.get(key).practiceStage === stage)
      if (valid.length && valid.length < keys.length) {
        for (const key of keys) if (!valid.includes(key)) linkRepairs.push({ objectiveId: objective.id, list: field, ref: key, reason: !questions.has(key) ? 'question does not exist' : questions.get(key).objectiveIds?.includes(objective.id) ? `question is not a ${stage} question` : 'question is not tagged with this objective' })
        next[field] = valid
        changed = true
      }
    }
    return changed ? next : row
  })
  if (!linkRepairs.length) return chapter
  return { ...chapter, objectiveCoverage, linkRepairs: [...(chapter.linkRepairs || []), ...linkRepairs] }
}

// Referential integrity establishes coverage, not pedagogical truth. The
// independent review must evaluate the actual explanations and exercises.
// Each finding carries a stable rule id and, where one item owns it, the item
// key the correction router uses, so a deterministic finding is always
// locatable. The detail text is the historical wording, byte for byte: saved
// findings, free recoveries and tests match on it.
export function objectiveCoverageFindings(chapter, plan = chapter.teachingPlan) {
  if (chapter.formatVersion !== 3) return []
  const findings = []
  const push = (rule, detail, itemKey = null, extra = {}) => findings.push({ rule, detail, ...(itemKey ? { itemKey } : {}), ...extra })
  if (!plan?.objectives?.length) { push('plan.missing', 'The lesson needs its pre-drafting objective/evidence plan.'); return findings }
  const objectives = new Map(plan.objectives.map(o => [o.id, o]))
  const sections = new Map(chapter.sections.map(s => [s.id, s]))
  const questions = new Map(chapter.questions.map(q => [q.key, q]))
  if (objectives.size !== plan.objectives.length || sections.size !== chapter.sections.length || questions.size !== chapter.questions.length) push('identity.unique', 'Objective, section and question keys must be unique.')
  const coverage = chapter.objectiveCoverage || []
  if (coverage.length !== objectives.size || new Set(coverage.map(c => c.objectiveId)).size !== objectives.size) push('coverage.map-once', 'Map every planned objective exactly once.')
  for (const block of [...chapter.sections, ...chapter.questions]) {
    if (!block.objectiveIds?.length || block.objectiveIds.some(id => !objectives.has(id))) push('coverage.valid-objectives', 'Teaching and questions must reference valid planned objectives.', block.key ? `question:${block.key}` : block.id ? `section:${block.id}` : null)
  }
  for (const path of coverage) {
    const objective = objectives.get(path.objectiveId)
    if (!objective) { push('coverage.unknown-objective', 'Coverage references an unknown objective.'); continue }
    const at = `objective:${objective.id}`
    for (const field of COVERAGE_SECTION_FIELDS) {
      for (const id of path[field] || []) if (!sections.get(id)?.objectiveIds.includes(objective.id)) push('coverage.link', `${objective.id}: ${field} must point to visible teaching for this objective.`, at, { objectiveId: objective.id, field, ref: id })
    }
    for (const [field, stage] of COVERAGE_QUESTION_FIELDS) {
      for (const id of path[field] || []) {
        const q = questions.get(id)
        if (!q?.objectiveIds.includes(objective.id) || q.practiceStage !== stage) push('coverage.link', `${objective.id}: ${field} must identify a ${stage} question for this objective.`, at, { objectiveId: objective.id, field, ref: id })
      }
    }
    if (!path.explanationSectionIds?.length || !path.independentQuestionKeys?.length) push('objective.explain-assess', `${objective.id}: explain and independently assess this objective.`, at, { objectiveId: objective.id, missing: [...(!path.explanationSectionIds?.length ? ['explanation'] : []), ...(!path.independentQuestionKeys?.length ? ['independent'] : [])] })
    if (objective.complexity === 'difficult' && (!path.workedExampleSectionIds?.length || !path.guidedQuestionKeys?.length || !path.transferQuestionKeys?.length)) push('objective.difficult-stages', `${objective.id}: difficult objectives need worked reasoning, a supported attempt and transfer practice.`, at, { objectiveId: objective.id, missing: [...(!path.workedExampleSectionIds?.length ? ['workedExample'] : []), ...(!path.guidedQuestionKeys?.length ? ['guided'] : []), ...(!path.transferQuestionKeys?.length ? ['transfer'] : [])] })
  }
  for (const q of chapter.questions) {
    const at = `question:${q.key}`
    if (q.practiceStage === 'remediation') {
      if (q.misconceptions?.length) push('question.remediation-terminal', `${q.key}: remediation is a terminal follow-up; explain mistakes in its answer instead of creating further links.`, at)
      if (!chapter.questions.some(source => source.key !== q.key && source.misconceptions?.some(m => m.followUpKey === q.key))) push('question.remediation-linked', `${q.key}: remediation must be linked from a diagnosed mistake.`, at)
    }
    if (q.practiceStage === 'guided' && q.hints.length < 2) push('question.guided-hints', `${q.key}: supported attempts need progressively more explicit hints.`, at)
    for (const misconception of q.misconceptions || []) {
      const followUp = questions.get(misconception.followUpKey)
      if (!followUp || followUp.key === q.key || !followUp.objectiveIds.some(id => q.objectiveIds.includes(id))) push('question.follow-up-target', `${q.key}: misconception follow-ups must be a different question testing the same objective.`, at)
    }
    if (q.practiceStage !== 'remediation' && q.objectiveIds.some(id => objectives.get(id)?.complexity === 'difficult') && !q.misconceptions?.length) push('question.difficult-misconceptions', `${q.key}: difficult-objective practice needs diagnostic mistakes and related follow-ups.`, at)
  }
  return findings
}
export function objectiveCoverageIssues(chapter, plan = chapter.teachingPlan) {
  return [...new Set(objectiveCoverageFindings(chapter, plan).map(finding => finding.detail))]
}

export function pedagogyReviewIssues(chapter, review) {
  const issues = [...review.issues]
  // Deterministic findings carry the same explicit scope as reviewer findings:
  // an objective- or question-level fault is patchable, the rest are not.
  const fail = (detail, target = null) => issues.push(target
    ? { topicId: target.id, scope: target.scope, severity: 'error', detail }
    : { topicId: chapter.id, scope: 'chapter', severity: 'error', detail })
  const objectives = chapter.teachingPlan?.objectives || []
  if (review.objectives.length !== objectives.length || new Set(review.objectives.map(o => o.objectiveId)).size !== objectives.length) fail('Pedagogical review must evaluate every planned objective exactly once.')
  for (const objective of objectives) {
    const check = review.objectives.find(o => o.objectiveId === objective.id)
    if (!check) { fail(`Missing pedagogical review for ${objective.id}.`); continue }
    if (!check.adequate || check.missingReasoning.length) fail(`${objective.id}: ${check.missingReasoning.join(' ') || check.rationale}`, { id: objective.id, scope: 'objective' })
    for (const evidence of [check.explanation, check.workedExample].filter(Boolean)) {
      const section = chapter.sections.find(s => s.id === evidence.sectionId)
      if (!section?.objectiveIds.includes(objective.id) || !section.text.includes(evidence.quote)) fail(`${objective.id}: review evidence must quote its actual visible teaching.`, { id: objective.id, scope: 'objective' })
    }
    for (const [field, stage] of [['guidedQuestionKey', 'guided'], ['independentQuestionKey', 'independent']]) {
      if (field === 'guidedQuestionKey' && objective.complexity === 'simple' && !check[field]) continue
      const q = chapter.questions.find(q => q.key === check[field])
      if (!q?.objectiveIds.includes(objective.id) || q.practiceStage !== stage) fail(`${objective.id}: review must identify the actual ${stage} assessment.`, { id: objective.id, scope: 'objective' })
    }
    if (objective.complexity === 'difficult' && !check.workedExample) fail(`${objective.id}: no worked reasoning identified by the pedagogical reviewer.`, { id: objective.id, scope: 'objective' })
  }
  const transfers=chapter.questions.filter(q=>q.practiceStage==='transfer')
  const followUps=chapter.questions.filter(q=>q.misconceptions?.length)
  for(const [rows,questions,label] of [[review.transferChecks||[],transfers,'transfer'],[review.followUpChecks||[],followUps,'misconception follow-up']]) {
    if(rows.length!==questions.length || new Set(rows.map(r=>r.questionKey)).size!==questions.length || rows.some(r=>!questions.some(q=>q.key===r.questionKey)))fail(`Review every ${label} question exactly once.`)
    for(const q of questions){
      const row=rows.find(r=>r.questionKey===q.key)
      if(!row)continue
      if(label==='transfer') {
        if(row.closestExampleSectionId && !chapter.sections.some(s=>s.id===row.closestExampleSectionId))fail(`${q.key}: transfer comparison references missing teaching.`, { id: q.key, scope: 'question' })
        if(!['new_context','reverse_inference','combined_mechanisms','diagnosis','boundary_change'].includes(row.variation))fail(`${q.key}: ${row.rationale}`, { id: q.key, scope: 'question' })
      } else if(!row.useful)fail(`${q.key}: ${row.rationale}`, { id: q.key, scope: 'question' })
    }
  }
  return issues
}

// ONE FINDING PER (ITEM, KIND). A failed followUpChecks/transferChecks row and
// the reviewer's own issues[] entry about the same question describe one fault,
// but pedagogyReviewIssues reports both, which doubled finding counts, patch
// packets and review-round ledgers. Merge them here, keeping the error
// severity and both explanations. pedagogyReviewIssues itself is deliberately
// left untouched: its source text is part of every cached pedagogical verdict's
// dependency hash, and this merge changes no verdict.
const FOLLOW_UP_FINDING = /follow[- ]?up|misconception|remediat/i
const TRANSFER_FINDING = /\btransfer\b|copied|numbers[- ]only|worked example|closest example/i
export function pedagogicalFindingKind(issue) {
  const detail = String(issue?.detail || '')
  return FOLLOW_UP_FINDING.test(detail) ? 'follow-up' : TRANSFER_FINDING.test(detail) ? 'transfer' : `detail:${detail}`
}
export function dedupePedagogicalFindings(issues) {
  const merged = new Map(), order = []
  for (const issue of issues) {
    const located = issue.scope && issue.scope !== 'chapter' && issue.topicId
    const key = located ? `${issue.scope}:${issue.topicId}:${pedagogicalFindingKind(issue)}` : `unlocated:${order.length}`
    const existing = merged.get(key)
    if (!existing) { merged.set(key, issue); order.push(key); continue }
    const severity = existing.severity === 'error' || issue.severity === 'error' ? 'error' : 'warning'
    const detail = existing.detail.includes(issue.detail) ? existing.detail : `${existing.detail} (Also: ${issue.detail})`
    merged.set(key, { ...existing, severity, detail })
  }
  return order.map(key => merged.get(key))
}
export function pedagogicalFindings(chapter, review) {
  return dedupePedagogicalFindings(pedagogyReviewIssues(chapter, review))
}
