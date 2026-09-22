import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterContract, contractIssues, contractRegressions, isFillableFinding, renderContract, issueKey } from '../lib/study-chapter-contract.mjs'
import { studyLessonQuality } from '../lib/study-content-quality.mjs'
import { objectiveCoverageIssues, dedupePedagogicalFindings, pedagogicalFindings } from '../lib/study-pedagogy.mjs'
import { applyQuestionRepair, questionRepairStep } from '../lib/study-chapter-repair.mjs'
import { isSchemaFormatError } from '../lib/study-version-content.mjs'
import { deriveObjectiveCoverage } from '../lib/study-pedagogy.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'

const ids = ['e-1']
// A chapter with one simple and one difficult objective on disjoint items.
function twoObjectiveChapter() {
  const base = lesson(ids)
  const plan = {objectives: [
    {id: 'obj-a', goal: 'Goal a.', complexity: 'simple', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'd', teachingApproach: 't'},
    {id: 'obj-b', goal: 'Goal b.', complexity: 'difficult', basis: 'course', sourceIds: ids, prerequisites: [], demonstration: 'd', teachingApproach: 't'}
  ], exclusions: [], gaps: []}
  const sections = base.sections.map((s, i) => ({...s, objectiveIds: [i < 2 ? 'obj-a' : 'obj-b']}))
  const stages = ['independent', 'independent', 'independent', 'independent', 'guided', 'independent', 'transfer', 'transfer']
  const questions = base.questions.map((q, i) => ({...q, objectiveIds: [i < 4 ? 'obj-a' : 'obj-b'], practiceStage: stages[i],
    hints: ['First hint.', 'Second hint.'],
    misconceptions: i < 4 ? [] : [{mistake: 'A mistake.', explanation: 'Why it is wrong.', followUpKey: base.questions[i === 7 ? 6 : 7].key}]}))
  const chapter = {...base, id: 'contract-chapter', teachingPlan: plan, sections, questions,
    objectiveCoverage: [{objectiveId: 'obj-a', workedExampleSectionIds: []}, {objectiveId: 'obj-b', workedExampleSectionIds: ['section-3']}]}
  return deriveObjectiveCoverage(chapter, plan)
}

test('chapterContract states each objective obligation from its complexity and the planned practice keys', () => {
  const chapter = twoObjectiveChapter()
  const contract = chapterContract(chapter.teachingPlan, [{key: 'q-plan-1', objectiveId: 'obj-b', stage: 'guided'}])
  const [simple, difficult] = contract.objectives
  assert.deepEqual(simple.needs, {explanation: 1, workedExample: 0, guided: 0, independent: 1, transfer: 0})
  assert.deepEqual(difficult.needs, {explanation: 1, workedExample: 1, guided: 1, independent: 1, transfer: 1})
  assert.equal(difficult.misconceptionsPerQuestion, 1)
  assert.deepEqual(difficult.blueprint.guided, ['q-plan-1'])
  assert.equal(contract.invariants.challenge, 2)
})

test('contractIssues reproduces every historical finding text with a stable rule id and owning item', () => {
  const chapter = twoObjectiveChapter()
  assert.deepEqual(contractIssues(chapter), [])
  // Remove obj-b's only guided question's stage and its transfer questions.
  const broken = structuredClone(chapter)
  for (const q of broken.questions) if (q.objectiveIds[0] === 'obj-b' && q.practiceStage !== 'independent') q.practiceStage = 'independent'
  deriveObjectiveCoverage(broken, broken.teachingPlan)
  const issues = contractIssues(broken)
  const difficult = issues.find(issue => issue.rule === 'objective.difficult-stages')
  assert.equal(difficult.itemKey, 'objective:obj-b')
  assert.equal(difficult.detail, 'obj-b: difficult objectives need worked reasoning, a supported attempt and transfer practice.')
  assert.deepEqual(difficult.missing, ['guided', 'transfer'])
  assert.ok(isFillableFinding(difficult))
  // The string views are exactly the details, unchanged.
  assert.deepEqual(studyLessonQuality(broken), [...new Set(issues.map(issue => issue.detail))])
  assert.ok(objectiveCoverageIssues(broken).includes(difficult.detail))
})

test('a practice-mix shortfall is reported with its margins, and legacy detail text is still recognised as fillable', () => {
  const chapter = twoObjectiveChapter()
  for (const q of chapter.questions) q.difficulty = 'standard'
  const mix = contractIssues(chapter).find(issue => issue.rule === 'chapter.practice-mix')
  assert.equal(mix.mix.challenge.margin, -2)
  assert.ok(isFillableFinding({detail: mix.detail}))
  assert.ok(isFillableFinding({detail: 'obj-5: difficult objectives need worked reasoning, a supported attempt and transfer practice.'}))
  assert.ok(isFillableFinding({detail: 'obj-6: explain and independently assess this objective.'}))
  assert.ok(!isFillableFinding({detail: 'q1: supported attempts need progressively more explicit hints.'}))
})

test('the merge validator rejects a regression on an untouched objective and a targeted finding left unresolved', () => {
  const before = twoObjectiveChapter()
  const merged = structuredClone(before)
  // A patch to obj-a relabels obj-b's only guided question.
  merged.questions.find(q => q.practiceStage === 'guided').practiceStage = 'independent'
  deriveObjectiveCoverage(merged, merged.teachingPlan)
  const result = contractRegressions(before, merged)
  assert.ok(result.rejected)
  assert.deepEqual(result.regressions.map(issue => issue.itemKey), ['objective:obj-b'])
  const unchanged = contractRegressions(merged, structuredClone(merged), [], [{detail: result.regressions[0].detail}])
  assert.ok(unchanged.rejected)
  assert.equal(unchanged.outstanding.length, 1)
  assert.equal(contractRegressions(before, structuredClone(before)).rejected, false)
  assert.equal(issueKey({rule: 'r', itemKey: 'x', detail: 'd'}), 'r|x|d')
})

test('renderContract names the items that currently satisfy each obligation and the chapter margins', () => {
  const chapter = twoObjectiveChapter()
  const text = renderContract(chapter.teachingPlan, {chapter})
  assert.match(text, /obj-b \(difficult\)/)
  assert.match(text, /guided: question-5 \(the only guided item: keep it\)/)
  assert.match(text, /challenge questions >= 2/)
  assert.doesNotMatch(renderContract(chapter.teachingPlan, {chapter, objectiveIds: ['obj-a']}), /obj-b \(/)
})

test('a follow-up finding reported by both the reviewer and its followUpChecks row counts once', () => {
  const chapter = twoObjectiveChapter()
  const q = chapter.questions.find(item => item.misconceptions.length)
  const review = {
    objectives: chapter.teachingPlan.objectives.map(o => ({objectiveId: o.id, adequate: true, explanation: {sectionId: o.id === 'obj-a' ? 'section-1' : 'section-3', quote: chapter.sections[o.id === 'obj-a' ? 0 : 2].text.split('. ')[0]}, workedExample: o.id === 'obj-b' ? {sectionId: 'section-3', quote: chapter.sections[2].text.split('. ')[0]} : null, guidedQuestionKey: o.id === 'obj-b' ? 'question-5' : null, independentQuestionKey: o.id === 'obj-a' ? 'question-1' : 'question-6', rationale: 'ok', missingReasoning: []})),
    transferChecks: chapter.questions.filter(item => item.practiceStage === 'transfer').map(item => ({questionKey: item.key, closestExampleSectionId: null, changedCondition: 'c', variation: 'diagnosis', rationale: 'r'})),
    followUpChecks: chapter.questions.filter(item => item.misconceptions.length).map(item => ({questionKey: item.key, useful: item.key !== q.key, rationale: 'The follow-up does not remediate this misconception.'})),
    issues: [{topicId: q.key, scope: 'question', severity: 'error', detail: `Its follow-up ${q.misconceptions[0].followUpKey} does not remediate the misconception.`}]
  }
  const findings = pedagogicalFindings(chapter, review).filter(issue => issue.severity === 'error')
  assert.equal(findings.length, 1)
  assert.match(findings[0].detail, /Also:/)
  // Distinct kinds on one question, and unlocated findings, are never merged.
  const distinct = dedupePedagogicalFindings([{topicId: 'q', scope: 'question', severity: 'error', detail: 'Wrong arithmetic.'}, {topicId: 'q', scope: 'question', severity: 'error', detail: 'The follow-up is unrelated.'}, {topicId: 'c', scope: 'chapter', severity: 'error', detail: 'x'}, {topicId: 'c', scope: 'chapter', severity: 'error', detail: 'x'}])
  assert.equal(distinct.length, 4)
})

test('a bounded patch that drops an objective is a schema-format error the pipeline retries, never a crash', () => {
  const chapter = twoObjectiveChapter()
  chapter.questions[1].objectiveIds = ['obj-a', 'obj-b']
  const step = questionRepairStep(course, [], [{id: 'e-1', sourceKey: 's', text: 'Evidence.'}], chapter, [{severity: 'error', itemKey: 'question:question-2', detail: 'question-2: the answer is wrong.'}])
  const replacement = {...chapter.questions[1], objectiveIds: ['obj-b']}
  assert.throws(() => applyQuestionRepair(chapter, step, {questions: {'question-2': replacement}}), error => isSchemaFormatError(error) && /cannot drop its teaching objectives/.test(error.message))
})
