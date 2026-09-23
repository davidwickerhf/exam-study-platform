import { lessonQualityFindings, practiceMix, PRACTICE_MIX_MINIMUMS } from './study-content-quality.mjs'

// THE CHAPTER CONTRACT. One machine-readable statement of every deterministic
// rule a chapter must satisfy, derived from its teaching plan, and one checker
// that reports each violation with a stable rule id and the item that owns it.
// Plan validation, drafting, the structural fill, correction prompts and the
// merged-chapter acceptance check all read this single source of truth, so a
// step is told exactly what it will be checked against and a finding is always
// locatable. The rules themselves live where they always have
// (objectiveCoverageFindings, lessonQualityFindings); nothing here adds or
// relaxes a standard.

// Findings a purely ADDITIVE fill can resolve: a missing stage question, a
// missing explanation or worked example, or a chapter practice-mix shortfall.
// A stage-locked bounded patch can never add an item, so these are never
// routed to one.
export const FILLABLE_RULES = Object.freeze(['objective.explain-assess', 'objective.difficult-stages', 'chapter.practice-mix'])
// The same rules recognised from their historical detail text, for findings
// saved before rule ids existed (a resumed draft carries only the text).
const FILLABLE_DETAIL = [
  /^[a-z0-9-]{1,70}: explain and independently assess this objective\.$/,
  /^[a-z0-9-]{1,70}: difficult objectives need worked reasoning, a supported attempt and transfer practice\.$/,
  /^Practice needs varied skills, progressive challenge, useful hints and reasoned solutions covering the learning goals\.$/
]
export function isFillableFinding(issue) {
  if (issue?.rule) return FILLABLE_RULES.includes(issue.rule)
  return FILLABLE_DETAIL.some(pattern => pattern.test(String(issue?.detail || '')))
}

export function chapterContract(plan, blueprint = null) {
  const practice = Array.isArray(blueprint) ? blueprint : []
  return {
    objectives: (plan?.objectives || []).map(objective => {
      const difficult = objective.complexity === 'difficult'
      const planned = stage => practice.filter(row => row.objectiveId === objective.id && row.stage === stage).map(row => row.key)
      return {
        id: objective.id, complexity: objective.complexity,
        needs: {explanation: 1, workedExample: difficult ? 1 : 0, guided: difficult ? 1 : 0, independent: 1, transfer: difficult ? 1 : 0},
        guidedHints: 2, misconceptionsPerQuestion: difficult ? 1 : 0,
        blueprint: {guided: planned('guided'), independent: planned('independent'), transfer: planned('transfer'), remediation: planned('remediation')}
      }
    }),
    invariants: {...PRACTICE_MIX_MINIMUMS, summary: 5, flashcards: 10, flashcardKinds: 3, visuals: 1}
  }
}

// Every deterministic violation on a chapter, as structured findings with a
// stable rule id. The detail text is the historical wording, so the string
// views (studyLessonQuality, objectiveCoverageIssues) are unchanged.
export function contractIssues(chapter, evidence = []) {
  const seen = new Set(), issues = []
  for (const finding of lessonQualityFindings(chapter, evidence)) {
    const key = issueKey(finding)
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({severity: 'error', ...finding})
  }
  return issues
}
export const issueKey = issue => `${issue.rule || ''}|${issue.itemKey || ''}|${issue.detail}`

// MERGED-CHAPTER ACCEPTANCE. `before` is the chapter a correction was applied
// to, `after` the merged result. A regression is any violation the merge
// introduced; a deterministic finding the correction was asked to fix and did
// not is still outstanding. Either one rejects the merge.
export function contractRegressions(before, after, evidence = [], targeted = []) {
  const prior = new Set(contractIssues(before, evidence).map(issueKey))
  const current = contractIssues(after, evidence)
  const regressions = current.filter(issue => !prior.has(issueKey(issue)))
  const wanted = new Set(targeted.map(issue => issue.detail))
  const outstanding = current.filter(issue => prior.has(issueKey(issue)) && wanted.has(issue.detail))
  return {regressions, outstanding, rejected: regressions.length > 0 || outstanding.length > 0}
}

// Which existing items currently satisfy each objective's obligations.
export function objectiveStatus(chapter, objectiveId) {
  const row = (chapter.objectiveCoverage || []).find(item => item.objectiveId === objectiveId) || {}
  const stage = name => (chapter.questions || []).filter(q => q.objectiveIds?.includes(objectiveId) && q.practiceStage === name).map(q => q.key)
  return {
    explanation: (chapter.sections || []).filter(section => section.objectiveIds?.includes(objectiveId)).map(section => section.id),
    workedExample: row.workedExampleSectionIds || [],
    guided: stage('guided'), independent: stage('independent'), transfer: stage('transfer'), remediation: stage('remediation')
  }
}

const describeNeeds = (objective) => {
  const parts = ['a visible explanation section tagged with this objective']
  if (objective.needs.workedExample) parts.push('a worked example (a section tagged with this objective, listed in objectiveCoverage.workedExampleSectionIds, showing assumptions and intermediate steps)')
  if (objective.needs.guided) parts.push('at least one guided question with at least 2 progressively explicit hints')
  parts.push('at least one independent question')
  if (objective.needs.transfer) parts.push('at least one transfer question that changes the reasoning required')
  if (objective.misconceptionsPerQuestion) parts.push('every non-remediation question of this objective carries at least one misconception whose followUpKey is a different question of the same objective')
  return parts.join('; ')
}
// The contract as prompt text. With a chapter it also names the items that
// satisfy each obligation now and the chapter margins, so a correction can see
// exactly what it must not break ("q11 is obj-5's only independent question").
export function renderContract(plan, {chapter = null, blueprint = null, objectiveIds = null} = {}) {
  const contract = chapterContract(plan, blueprint)
  const selected = objectiveIds ? contract.objectives.filter(objective => objectiveIds.includes(objective.id)) : contract.objectives
  const lines = selected.map(objective => {
    let line = `- ${objective.id} (${objective.complexity}): ${describeNeeds(objective)}.`
    const planned = Object.entries(objective.blueprint).filter(([, keys]) => keys.length).map(([stage, keys]) => `${stage} ${keys.join(', ')}`)
    if (planned.length) line += ` Planned practice keys: ${planned.join('; ')}.`
    if (chapter) {
      const status = objectiveStatus(chapter, objective.id)
      const held = ['explanation', 'workedExample', 'guided', 'independent', 'transfer'].map(stage => {
        const keys = status[stage]
        const only = keys.length === 1 && (objective.needs[stage] || 0) >= 1 ? ` (the only ${stage === 'workedExample' ? 'worked example' : stage} item: keep it)` : ''
        return `${stage === 'workedExample' ? 'worked example' : stage}: ${keys.length ? keys.join(', ') : 'NONE'}${only}`
      })
      line += ` Currently satisfied by: ${held.join('; ')}.`
    }
    return line
  })
  const mix = chapter ? practiceMix(chapter) : null
  const invariant = (key, label) => mix ? `${label} >= ${mix[key].minimum} (now ${mix[key].now}${mix[key].margin <= 0 ? ', no margin: do not lower it' : ''})` : `${label} >= ${PRACTICE_MIX_MINIMUMS[key]}`
  const chapterRules = [
    invariant('questions', 'questions'), invariant('nonRecall', 'application or exam-style questions'), invariant('challenge', 'challenge questions'), invariant('skills', 'distinct skills'),
    'every question has a non-empty first hint and objective', 'remediation questions have misconceptions=[] and are the followUpKey of some diagnosed mistake',
    'question keys and section ids are unique', 'true/false questions use options ["True","False"] in that order', 'written, calc and pseudocode questions carry no options',
    'summary has at least 5 substantive entries', 'at least 10 flashcards with distinct fronts over at least 3 kinds', 'at least one section visual', 'every section has a takeaway'
  ]
  return `\nCHAPTER CONTRACT (checked deterministically on the complete chapter before any review; a result that breaks any rule is rejected). Per objective:\n${lines.join('\n')}\nChapter: ${chapterRules.join('; ')}.`
}

// BLUEPRINT VALIDATION. The practice skeleton returned with the teaching plan,
// checked against the same contract before drafting. Each issue names the rule
// and the exact row or objective, so a single re-plan can fix precisely it.
export function blueprintIssues(plan, practice) {
  const issues = []
  const push = (rule, detail) => issues.push({rule, detail})
  const objectives = new Map((plan?.objectives || []).map(objective => [objective.id, objective]))
  const rows = Array.isArray(practice) ? practice : []
  const byKey = new Map()
  for (const row of rows) {
    if (byKey.has(row.key)) push('blueprint.unique-keys', `blueprint: question key ${row.key} is used twice; give every row a distinct key.`)
    byKey.set(row.key, row)
    if (!objectives.has(row.objectiveId)) push('blueprint.objective', `blueprint: ${row.key} names ${row.objectiveId}, which is not a planned objective.`)
  }
  for (const objective of objectives.values()) {
    const count = stage => rows.filter(row => row.objectiveId === objective.id && row.stage === stage).length
    if (!count('independent')) push('blueprint.independent', `blueprint: ${objective.id} (${objective.complexity}) plans no independent question.`)
    if (objective.complexity === 'difficult') for (const stage of ['guided', 'transfer']) if (!count(stage)) push(`blueprint.${stage}`, `blueprint: ${objective.id} (difficult) plans no ${stage} question.`)
  }
  for (const row of rows) {
    const objective = objectives.get(row.objectiveId)
    if (row.stage === 'remediation') {
      if (row.misconception) push('blueprint.remediation-terminal', `blueprint: remediation ${row.key} must have misconception=null.`)
      if (!rows.some(other => other.key !== row.key && other.misconception?.followUpKey === row.key)) push('blueprint.remediation-linked', `blueprint: remediation ${row.key} is not the followUpKey of any misconception.`)
      continue
    }
    if (objective?.complexity === 'difficult' && !row.misconception) push('blueprint.misconception', `blueprint: ${row.key} belongs to difficult ${row.objectiveId} and needs a misconception with a follow-up.`)
    if (row.misconception) {
      const target = byKey.get(row.misconception.followUpKey)
      if (!target || target.key === row.key || target.objectiveId !== row.objectiveId) push('blueprint.follow-up', `blueprint: ${row.key}'s followUpKey ${row.misconception.followUpKey} must be a different row for ${row.objectiveId}.`)
    }
  }
  const count = predicate => rows.filter(predicate).length
  if (rows.length < PRACTICE_MIX_MINIMUMS.questions) push('blueprint.questions', `blueprint: plan at least ${PRACTICE_MIX_MINIMUMS.questions} questions (now ${rows.length}).`)
  if (count(row => row.kind !== 'recall') < PRACTICE_MIX_MINIMUMS.nonRecall) push('blueprint.non-recall', `blueprint: plan at least ${PRACTICE_MIX_MINIMUMS.nonRecall} application or exam-style questions (now ${count(row => row.kind !== 'recall')}).`)
  if (count(row => row.difficulty === 'challenge') < PRACTICE_MIX_MINIMUMS.challenge) push('blueprint.challenge', `blueprint: plan at least ${PRACTICE_MIX_MINIMUMS.challenge} challenge questions (now ${count(row => row.difficulty === 'challenge')}).`)
  if (new Set(rows.map(row => row.skill)).size < PRACTICE_MIX_MINIMUMS.skills) push('blueprint.skills', `blueprint: plan at least ${PRACTICE_MIX_MINIMUMS.skills} distinct skills (now ${new Set(rows.map(row => row.skill)).size}).`)
  return issues
}

// SIZE GATE. A deliberately conservative estimate of a first draft's visible
// output from its plan, calibrated only on the measured pilot drafts (an
// 8-objective, 20-question chapter drafted in 19.8k output tokens). A plan
// over the budget is split along its objectives BEFORE drafting instead of
// buying a draft that would exhaust the provider output cap; the output-limit
// split after a failed draft remains the backstop.
export const DRAFT_OUTPUT_BUDGET = 26000
export function estimateDraftOutput(plan, practice) {
  return 3000 + 1000 * (plan?.objectives?.length || 0) + 750 * (Array.isArray(practice) ? practice.length : 0)
}
// The rows of a blueprint that belong to a subset of objectives (a split part).
export function blueprintForObjectives(practice, objectiveIds) {
  const ids = new Set(objectiveIds)
  return (practice || []).filter(row => ids.has(row.objectiveId))
}

// FREE MECHANICAL REPAIR. Violations with exactly one correct mechanical fix
// are repaired deterministically before any paid step, never sent to a model:
// a duplicated question key or section id is suffixed (references keep
// pointing at the first holder), a missing first hint takes the first of the
// graduated hints, a missing question objective takes its plan goal, and a
// true/false question whose options are the right pair in the wrong order is
// reordered with its answer key. Every repair is recorded on
// chapter.contractRepairs. Nothing is invented: a question with no hints, no
// plan goal or other options is left for the ordinary checks.
function uniqueIdentity(value, taken) {
  for (let n = 2; ; n++) {
    const candidate = `${String(value).slice(0, 64)}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}
export function repairContractMechanics(chapter, plan = chapter.teachingPlan) {
  if (chapter.formatVersion !== 3) return chapter
  const repairs = []
  const goals = new Map((plan?.objectives || []).map(objective => [objective.id, objective.goal]))
  const renameDuplicates = (items, field, label) => {
    const taken = new Set(items.map(item => item[field])), seen = new Set()
    return items.map(item => {
      if (!seen.has(item[field])) { seen.add(item[field]); return item }
      const renamed = uniqueIdentity(item[field], taken)
      taken.add(renamed); seen.add(renamed)
      repairs.push({rule: `${label}.duplicate-identity`, from: item[field], to: renamed})
      return {...item, [field]: renamed}
    })
  }
  const sections = renameDuplicates(chapter.sections || [], 'id', 'section')
  let questions = renameDuplicates(chapter.questions || [], 'key', 'question').map(q => {
    let next = q
    if (!next.hint && Array.isArray(next.hints) && next.hints[0]) { next = {...next, hint: next.hints[0].slice(0, 400)}; repairs.push({rule: 'question.first-hint', key: q.key}) }
    const goal = (next.objectiveIds || []).map(id => goals.get(id)).find(Boolean)
    if (!next.objective && goal) { next = {...next, objective: goal.slice(0, 180)}; repairs.push({rule: 'question.objective', key: q.key}) }
    if (next.type === 'tf' && JSON.stringify(next.options) === '["False","True"]' && (next.correctOptions || []).length === 1) {
      next = {...next, options: ['True', 'False'], correctOptions: next.correctOptions.map(index => 1 - index)}
      repairs.push({rule: 'question.tf-order', key: q.key})
    }
    return next
  })
  const remediationTargets=new Set(questions.flatMap(question=>(question.misconceptions || []).map(row=>row.followUpKey).filter(Boolean)))
  questions=questions.filter(question=>{
    if(question.practiceStage!=='remediation' || remediationTargets.has(question.key))return true
    // An orphan remediation item cannot remediate any diagnosed mistake and
    // no model patch limited to that item can create the missing incoming
    // link. Dropping the unreachable item is the single mechanical repair;
    // if the practice mix then lacks required work, the additive fill handles
    // that separately before review.
    repairs.push({rule:'question.orphan-remediation',key:question.key,action:'removed'})
    return false
  })
  if (!repairs.length) return chapter
  return {...chapter, sections, questions, contractRepairs: [...(chapter.contractRepairs || []), ...repairs]}
}
