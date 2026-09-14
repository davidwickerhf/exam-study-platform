import test from 'node:test'
import assert from 'node:assert/strict'
import { nextFactualReview, acceptFactualReview, factualAuditIssues, factualReviewItems } from '../lib/study-factual-review.mjs'
import { deriveObjectiveCoverage, pedagogyPrompt } from '../lib/study-pedagogy.mjs'
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

test('diagnostic corrections can repair linked targets while retaining unrelated questions',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter(),q=draft.questions[0]
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',detail:q.key+': follow-up does not target the misconception'}])
  assert.ok(step.keys.includes(q.key))
  for(const m of q.misconceptions)assert.ok(step.keys.includes(m.followUpKey))
  const replacements=Object.fromEntries(draft.questions.filter(q=>step.keys.includes(q.key)).map(q=>[q.key,{...q,question:q.question+' Explain the changed condition.'}]))
  const fixed=applyQuestionRepair(draft,step,{questions:replacements})
  assert.deepEqual(fixed.questions.filter(q=>!step.keys.includes(q.key)),draft.questions.filter(q=>!step.keys.includes(q.key)))
  assert.deepEqual(fixed.sections,draft.sections)
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

test('section-only correction preserves all practice and unflagged teaching',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter(),section=draft.sections[0]
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:`section:${section.id}`,detail:'Caption contradicts the example.'}])
  assert.ok(step)
  const fixed=applyQuestionRepair(draft,step,{sections:{[section.id]:{...section,text:section.text+' This illustration is a separate example.'}}})
  assert.deepEqual(fixed.questions,draft.questions)
  assert.deepEqual(fixed.sections.slice(1),draft.sections.slice(1))
  assert.notEqual(fixed.sections[0].text,section.text)
  assert.equal(questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:'section:unknown',detail:'Unknown section'}]),null)
})

test('null corruption blocks acceptance even when a model called it a formatting warning',async()=>{
  const {studyLessonQuality}=await import('../lib/study-content-quality.mjs')
  const draft=chapter();draft.sections[0].text='The complement is 1\u0000\u0000=5/6.'
  assert.ok(studyLessonQuality(draft,evidence).some(issue=>issue.includes('null-character corruption')))
})

test('flashcard-only correction preserves the lesson and practice instead of regenerating them',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter();draft.factualAudit={marker:'DO NOT COPY ACCEPTANCE METADATA'}
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:'cards:0',detail:'Clarify the illustrative assumption.'}])
  assert.ok(step);assert.doesNotMatch(step.prompt,/DO NOT COPY ACCEPTANCE METADATA/)
  const flashcards=Object.fromEntries(step.cardIndexes.map(index=>[`card-${index}`,{...draft.flashcards[index],back:'Assume disjoint groups. '+draft.flashcards[index].back}]))
  const fixed=applyQuestionRepair(draft,step,{flashcards})
  assert.deepEqual(fixed.questions,draft.questions);assert.deepEqual(fixed.sections,draft.sections)
  assert.deepEqual(fixed.flashcards.slice(4),draft.flashcards.slice(4));assert.notEqual(fixed.flashcards[0].back,draft.flashcards[0].back)
})


test('factual scope review preserves syllabus constraints without grading private drafting instructions as lesson text',()=>{
  const draft=chapter()
  draft.teachingPlan.objectives[0].teachingApproach='PRIVATE DRAFTING APPROACH'
  draft.teachingPlan.objectives[0].demonstration='PRIVATE PLANNED EXAMPLE'
  draft.teachingPlan.exclusions=['Current exam excludes advanced calculus.']
  draft.sections[0].text='ACTUAL FINISHED TEACHING'
  const items=factualReviewItems(draft),scope=items.find(item=>item.key==='scope')
  assert.doesNotMatch(JSON.stringify(items),/PRIVATE DRAFTING|PRIVATE PLANNED/)
  assert.doesNotMatch(pedagogyPrompt('',draft),/PRIVATE DRAFTING|PRIVATE PLANNED/)
  assert.equal(scope.content.teachingPlan.objectives[0].goal,draft.teachingPlan.objectives[0].goal)
  assert.deepEqual(scope.content.teachingPlan.objectives[0].sourceIds,draft.teachingPlan.objectives[0].sourceIds)
  assert.deepEqual(scope.content.teachingPlan.exclusions,draft.teachingPlan.exclusions)
  assert.match(JSON.stringify(items),/ACTUAL FINISHED TEACHING/)
})

test('mixed section and card findings repair together without rewriting practice',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter(),section=draft.sections[0]
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:`section:${section.id}`,detail:'Explain the set condition.'},{severity:'error',itemKey:'cards:0',detail:'State necessity, not sufficiency.'}])
  assert.equal(step.parts.length,2)
  const response={sections:{[section.id]:{...section,text:section.text+' Additional condition.'}},flashcards:Object.fromEntries(draft.flashcards.slice(0,4).map((card,index)=>[`card-${index}`,{...card,back:card.back+' Corrected condition.'}]))}
  const fixed=applyQuestionRepair(draft,step,response)
  assert.deepEqual(fixed.questions,draft.questions)
  assert.deepEqual(fixed.sections.slice(1),draft.sections.slice(1))
  assert.deepEqual(fixed.flashcards.slice(4),draft.flashcards.slice(4))
  assert.notEqual(fixed.sections[0].text,section.text)
})

test('scope-note repair can correct immutable-plan metadata without changing learning objectives',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter()
  draft.teachingPlan.gaps=['No assessment rules were provided.']
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:'scope',detail:'The source supplies assessment rules; correct the denial.'}])
  assert.equal(step.scope,true)
  const fixed=applyQuestionRepair(draft,step,{caveats:['No explicit topic exclusions were provided.'],scope:{gaps:['No explicit topic exclusions were provided.'],exclusions:[]}})
  assert.deepEqual(fixed.teachingPlan.objectives,draft.teachingPlan.objectives)
  assert.deepEqual(fixed.questions,draft.questions)
  assert.deepEqual(fixed.sections,draft.sections)
  assert.ok(!fixed.teachingPlan.gaps.includes('No assessment rules were provided.'))
})

test('review prose naming a target does not force a full chapter rewrite',async()=>{
  const {questionRepairStep}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter(),question=draft.questions[0],target=question.misconceptions[0].followUpKey
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',detail:`Revise ${target} to address this misconception.`},{severity:'error',detail:`${question.key}: its follow-up does not test the mistake.`}])
  assert.ok(step.keys.includes(question.key))
  assert.ok(step.keys.includes(target))
})

test('review excerpt identifiers resolve to exact visible quotations and reject wrong sections',async()=>{
  const {nextPedagogicalReview,acceptPedagogicalReview}=await import('../lib/study-pedagogical-review.mjs')
  const {pedagogicalReview}=await import('../scripts/verification/study-fixtures.mjs')
  const draft=chapter(),step=nextPedagogicalReview('',draft)
  const response=pedagogicalReview(step.chapter)
  for(const field of ['explanation','workedExample']){
    const value=response.objectives[0][field]
    const entry=Object.entries(step.quoteReferences).find(([,ref])=>ref.sectionId===value.sectionId)
    value.quote=entry[0]
  }
  const wrong=structuredClone(response);wrong.objectives[0].explanation.sectionId='wrong-section'
  assert.throws(()=>acceptPedagogicalReview(draft,step,wrong),/different section/)
  acceptPedagogicalReview(draft,step,response)
  const saved=draft.pedagogyAudit.reviews[step.objectiveId].objectives[0].explanation
  assert.ok(draft.sections.find(s=>s.id===saved.sectionId).text.includes(saved.quote))
  assert.ok(!saved.quote.startsWith('excerpt-'))
})


test('pedagogical checkpoint omits revision payload while preserving teaching and assessment scope',()=>{
  const draft=chapter()
  draft.flashcards[0].back='UNNEEDED REVISION PAYLOAD'
  draft.sections[0].detail='OPTIONAL EXTENSION PAYLOAD'
  draft.teachingPlan.exclusions=['Official assessment excludes recursion.']
  const prompt=pedagogyPrompt('',draft)
  const artifact=JSON.parse(prompt.split('Chapter: ').at(-1))
  assert.doesNotMatch(prompt,/UNNEEDED REVISION PAYLOAD|OPTIONAL EXTENSION PAYLOAD/)
  assert.deepEqual(artifact.teachingPlan.exclusions,draft.teachingPlan.exclusions)
  assert.equal(artifact.sections[0].text,draft.sections[0].text)
  assert.equal(artifact.questions.length,draft.questions.length)
  assert.ok(artifact.questions.every(q=>!('answer' in q)))
})
