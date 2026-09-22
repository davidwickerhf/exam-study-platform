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
