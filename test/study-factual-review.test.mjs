import test from 'node:test'
import assert from 'node:assert/strict'
import { nextFactualReview, acceptFactualReview, factualAuditIssues, factualReviewItems } from '../lib/study-factual-review.mjs'
import { deriveObjectiveCoverage } from '../lib/study-pedagogy.mjs'
import { practiceLinkStep, applyPracticeLinks } from '../lib/study-practice-links.mjs'
import { course, lesson, teachingPlan, teachingResponse } from '../scripts/verification/study-fixtures.mjs'
const evidence=[{id:'e-current',sourceKey:'source',text:'Adding disjoint groups: two plus three equals five. Check with subtraction.'}]
const chapter=()=>({...lesson(['e-current']),id:'addition',teachingPlan:teachingPlan(['e-current'])})
test('independent solving excludes the generated answers, hints and lesson',()=>{
  const draft=chapter();draft.sections[0].text='SECRET LESSON';draft.questions[0].answer='SECRET ANSWER';draft.questions[0].hints=['SECRET HINT'];draft.questions[0].misconceptions[0].explanation='SECRET DIAGNOSIS'
  const step=nextFactualReview(course,[],evidence,draft)
  assert.equal(step.kind,'solve');assert.doesNotMatch(step.prompt,/SECRET/)
  assert.match(step.prompt,/lower AND upper|both bounds/)
  assert.throws(()=>acceptFactualReview(draft,step,{issues:[]}),/format/)
})
test('audit requires every item, records a failure among passes, and invalidates on any content change',()=>{
  const draft=chapter();let steps=0
  for(;;){
    const step=nextFactualReview(course,[],evidence,draft);if(!step)break
    const response=teachingResponse(step.prompt,['e-current'])
    if(step.kind==='answers' && step.keys.includes('question:question-4'))response.items['question:question-4']={correct:false,rationale:'The lower bound violates the union constraint.',issues:[]}
    acceptFactualReview(draft,step,response);steps++
    if(nextFactualReview(course,[],evidence,draft))assert.ok(factualAuditIssues(draft).some(i=>i.severity==='error'))
  }
  assert.equal(steps,7)
  const issues=factualAuditIssues(draft)
  assert.equal(issues.length,1);assert.equal(issues[0].itemKey,'question:question-4')
  assert.equal(Object.keys(draft.factualAudit.judgments).length,draft.questions.length+factualReviewItems(draft).length)
  draft.sections[0].text+=' New claim.'
  assert.match(factualAuditIssues(draft)[0].detail,/exact current chapter/)
  assert.equal(nextFactualReview(course,[],evidence,draft).kind,'solve')
})
test('blind-solver arithmetic witnesses cannot silently contain wrong calculations',()=>{
  const draft=chapter(),step=nextFactualReview(course,[],evidence,draft),raw=teachingResponse(step.prompt,['e-current'])
  raw.items[step.keys[0]].calculations=[{expression:'0.7 + 0.5 - 1',result:0}]
  assert.throws(()=>acceptFactualReview(draft,step,raw),/invalid arithmetic/)
  assert.equal(draft.factualAudit,undefined)
})
test('coverage comes from actual objective annotations and link repair cannot rewrite content',()=>{
  const draft=chapter();draft.objectiveCoverage[0].independentQuestionKeys=['invented']
  deriveObjectiveCoverage(draft)
  assert.ok(!draft.objectiveCoverage[0].independentQuestionKeys.includes('invented'))
  draft.questions[0].misconceptions[0].followUpKey='invented'
  const before=structuredClone(draft),step=practiceLinkStep(draft)
  assert.ok(step)
  assert.throws(()=>applyPracticeLinks(draft,step,{links:Object.fromEntries(step.invalid.map(row=>[row.key,{followUpKey:'invented',changedCondition:'Claim'}]))}),/format/)
  applyPracticeLinks(draft,step,teachingResponse(step.prompt,['e-current']))
  assert.deepEqual(draft.sections,before.sections)
  assert.equal(practiceLinkStep(draft),null)
})

test('pedagogical review checkpoints one objective and never leaks previous verdicts',async()=>{
  const {nextPedagogicalReview,acceptPedagogicalReview}=await import('../lib/study-pedagogical-review.mjs')
  const {pedagogyReviewIssues}=await import('../lib/study-pedagogy.mjs')
  const draft=chapter();let aggregate=null,count=0
  while(!aggregate){
    const step=nextPedagogicalReview('Source context',draft)
    assert.equal(step.responseSchema.properties.objectives.maxItems,1)
    assert.doesNotMatch(step.prompt,/"pedagogyAudit"/)
    aggregate=acceptPedagogicalReview(draft,step,teachingResponse(step.prompt,['e-current']));count++
  }
  assert.equal(count,draft.teachingPlan.objectives.length)
  assert.deepEqual(pedagogyReviewIssues(draft,aggregate),[])
  assert.equal(nextPedagogicalReview('',draft),null)
  draft.questions[0].question+=' Changed condition.'
  assert.ok(nextPedagogicalReview('',draft))
})
test('provider quote choices omit forbidden quotes while remaining exact lesson excerpts',async()=>{
  const {pedagogicalResponseSchema}=await import('../lib/study-version-content.mjs')
  const draft=chapter();draft.sections[0].text='The lecturer calls this "ready", which means runnable. The CPU can still be occupied.'
  const choices=pedagogicalResponseSchema(draft).properties.objectives.items.properties.explanation.anyOf
  for(const choice of choices)for(const quote of choice.properties.quote.enum){assert.ok(!quote.includes('"'));assert.ok(draft.sections.find(s=>s.id===choice.properties.sectionId.enum[0]).text.includes(quote))}
})
test('question-only correction preserves all other teaching and cannot drop objectives or evade transfer',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter(),q=draft.questions.find(q=>q.practiceStage==='transfer')
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',detail:q.key+': repeats a worked example'}])
  assert.ok(step);const replacement={...q,question:'A new decision: is addition enough when one item belongs to both groups? Explain.'}
  const fixed=applyQuestionRepair(draft,step,{questions:{[q.key]:replacement}})
  assert.deepEqual(fixed.sections,draft.sections)
  assert.deepEqual(fixed.questions.filter(item=>item.key!==q.key),draft.questions.filter(item=>item.key!==q.key))
  assert.throws(()=>applyQuestionRepair(draft,step,{questions:{[q.key]:{...replacement,practiceStage:'independent'}}}),/format/)
  assert.equal(questionRepairStep(course,[],evidence,draft,[{severity:'error',detail:'Untaught prerequisite across objectives'}]),null)
})

test('an objective review can inspect a linked follow-up from another objective',async()=>{
  const {nextPedagogicalReview}=await import('../lib/study-pedagogical-review.mjs')
  const draft=chapter(),[a,b]=draft.teachingPlan.objectives.map(o=>o.id)
  draft.questions[0].objectiveIds=[a,b]
  draft.questions[1].objectiveIds=[b]
  draft.questions[0].misconceptions[0].followUpKey=draft.questions[1].key
  const step=nextPedagogicalReview('',draft)
  assert.ok(step.chapter.relatedQuestions.some(q=>q.key===draft.questions[1].key))
  assert.ok(!step.chapter.questions.some(q=>q.key===draft.questions[1].key))
  assert.ok(step.chapter.relatedQuestions.every(q=>!Object.hasOwn(q,'answer')))
})
