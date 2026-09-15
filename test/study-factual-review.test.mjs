import test from 'node:test'
import assert from 'node:assert/strict'
import { reduceFactualReviewBatch, nextFactualReview, acceptFactualReview, factualAuditIssues, factualReviewItems } from '../lib/study-factual-review.mjs'
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
  assert.equal(steps,3)
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

test('pedagogical review batches coherent objectives and never leaks previous verdicts',async()=>{
  const {nextPedagogicalReview,acceptPedagogicalReview}=await import('../lib/study-pedagogical-review.mjs')
  const {pedagogyReviewIssues}=await import('../lib/study-pedagogy.mjs')
  const draft=chapter();let aggregate=null,count=0
  while(!aggregate){
    const step=nextPedagogicalReview('Source context',draft)
    assert.equal(step.responseSchema.properties.objectives.maxItems,draft.teachingPlan.objectives.length)
    assert.doesNotMatch(step.prompt,/"pedagogyAudit"/)
    aggregate=acceptPedagogicalReview(draft,step,teachingResponse(step.prompt,['e-current']));count++
  }
  assert.equal(count,1)
  assert.deepEqual(pedagogyReviewIssues(draft,aggregate),[])
  assert.equal(nextPedagogicalReview('Source context',draft),null)
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
  assert.ok([...step.chapter.questions,...step.chapter.relatedQuestions].some(q=>q.key===draft.questions[1].key))
  assert.ok(step.chapter.questions.some(q=>q.key===draft.questions[1].key))
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
  const fixed=applyQuestionRepair(draft,step,{learningGoals:draft.learningGoals,caveats:['No explicit topic exclusions were provided.'],scope:{objectives:Object.fromEntries(draft.teachingPlan.objectives.map(o=>[o.id,o])),gaps:['No explicit topic exclusions were provided.'],exclusions:[]}})
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
  assert.deepEqual(artifact.sections[0].sourceIds,draft.sections[0].sourceIds)
  assert.deepEqual(artifact.questions[0].sourceIds,draft.questions[0].sourceIds)
  assert.equal(artifact.questions.length,draft.questions.length)
  assert.ok(artifact.questions.every(q=>!('answer' in q)))
})


test('flashcard variety failure repairs cards without regenerating teaching or practice',async()=>{
  const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
  const draft=chapter()
  const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',detail:'Flashcards need distinct prompts spanning definitions, contrasts, applications and misconceptions.'}])
  assert.ok(step)
  const fixed=applyQuestionRepair(draft,step,{flashcards:draft.flashcards.map((card,i)=>({...card,front:`Case ${i+1}: ${card.front}`}))})
  assert.deepEqual(fixed.sections,draft.sections)
  assert.deepEqual(fixed.questions,draft.questions)
  assert.notDeepEqual(fixed.flashcards,draft.flashcards)
})


test('output-limit recovery halves batches twice without losing solutions or skipping verdicts',()=>{
  const draft=chapter(),content=JSON.stringify({...draft,factualAudit:undefined})
  let step=nextFactualReview(course,[],evidence,draft)
  const initialSize=step.keys.length
  assert.ok(initialSize>=4)
  acceptFactualReview(draft,step,teachingResponse(step.prompt,['e-current']))
  const solutions=structuredClone(draft.factualAudit.solutions)
  step=nextFactualReview(course,[],evidence,draft)
  assert.equal(reduceFactualReviewBatch(draft,step),true)
  assert.deepEqual(draft.factualAudit.solutions,solutions)
  step=nextFactualReview(course,[],evidence,draft)
  assert.equal(step.keys.length,Math.floor(initialSize/2))
  assert.equal(reduceFactualReviewBatch(draft,step),true)
  step=nextFactualReview(course,[],evidence,draft)
  assert.equal(step.keys.length,Math.max(1,Math.floor(initialSize/4)))
  assert.equal(reduceFactualReviewBatch(draft,step),false)
  for(let count=0;step && count<100;count++) {
    acceptFactualReview(draft,step,teachingResponse(step.prompt,['e-current']))
    step=nextFactualReview(course,[],evidence,draft)
  }
  assert.equal(step,null)
  assert.deepEqual(factualAuditIssues(draft),[])
  assert.equal(Object.keys(draft.factualAudit.solutions).length,draft.questions.length)
  assert.equal(JSON.stringify({...draft,factualAudit:undefined}),content)
})

test('a card edit reuses independent solutions and unrelated verdicts; teaching and evidence invalidate dependencies', async()=>{
  const {preserveFactualReview}=await import('../lib/study-factual-review.mjs')
  const draft=chapter()
  for(let step; (step=nextFactualReview(course,[],evidence,draft));)acceptFactualReview(draft,step,teachingResponse(step.prompt,['e-current']))
  const corrected=structuredClone(draft);corrected.flashcards[0].back+=' Corrected sign.'
  preserveFactualReview(draft,corrected,course,[],evidence)
  assert.deepEqual(corrected.factualAudit.solutions,draft.factualAudit.solutions)
  const next=nextFactualReview(course,[],evidence,corrected)
  assert.equal(next.kind,'content');assert.deepEqual(next.keys,['cards:0'])
  const teaching=structuredClone(draft);teaching.sections[0].text+=' A new mechanism.'
  preserveFactualReview(draft,teaching,course,[],evidence)
  const affected=draft.questions.filter(q=>q.objectiveIds.some(id=>draft.sections[0].objectiveIds.includes(id)))
  for(const q of affected)assert.equal(teaching.factualAudit.solutions[q.key],undefined)
  const changed=nextFactualReview(course,[],[{...evidence[0],text:'Changed source.'}],draft)
  assert.equal(changed.kind,'solve');assert.equal(Object.keys(changed.state.solutions).length,0)
})

test('JSONB key ordering cannot invalidate unchanged teaching, cards or question checks after a targeted repair',async()=>{
  const {preserveFactualReview}=await import('../lib/study-factual-review.mjs')
  const {canonicalReviewValue}=await import('../lib/study-review-dependencies.mjs')
  const draft=chapter()
  while(true){const step=nextFactualReview(course,[],evidence,draft);if(!step)break;acceptFactualReview(draft,step,teachingResponse(step.prompt,['e-current']))}
  // Simulate the recursively reordered objects returned by PostgreSQL JSONB.
  const stored=canonicalReviewValue(draft),fixed=structuredClone(draft)
  fixed.questions[0].answer+=' Check the boundary condition.'
  preserveFactualReview(stored,fixed,course,[],evidence)
  for(const item of factualReviewItems(draft))assert.ok(fixed.factualAudit.judgments[item.key],item.key)
  assert.ok(fixed.factualAudit.solutions[fixed.questions[1].key])
  assert.equal(fixed.factualAudit.judgments['question:'+fixed.questions[0].key],undefined)
  assert.equal(nextFactualReview(course,[],evidence,canonicalReviewValue(draft)),null)
})

test('a bounded correction includes an already located teaching warning without changing stored severity',async()=>{
 const {questionRepairStep}=await import('../lib/study-chapter-repair.mjs')
 const draft=chapter(),issues=[{severity:'error',itemKey:'question:'+draft.questions[0].key,detail:'Correct this answer.'},{severity:'warning',itemKey:'section:'+draft.sections[0].id,detail:'Clarify the known prerequisite.'}]
 const repair=questionRepairStep(course,[],evidence,draft,issues)
 assert.ok(repair.parts?.some(p=>p.sectionIds?.includes(draft.sections[0].id)))
 assert.equal(issues[1].severity,'warning')
})


test('chapter-scale factual batches retain every verdict and bound the transmitted answer payload',()=>{
  const draft=chapter(),base=structuredClone(draft.questions[0])
  draft.questions=Array.from({length:32},(_,i)=>({...structuredClone(base),key:`question-${i+1}`}))
  let steps=0
  for(let step;(step=nextFactualReview(course,[],evidence,draft));){
    if(step.kind==='solve'||step.kind==='answers')assert.equal(step.keys.length,32)
    acceptFactualReview(draft,step,teachingResponse(step.prompt,['e-current']));steps++
  }
  assert.equal(steps,3)
  assert.deepEqual(factualAuditIssues(draft),[])
  // Large author answers must not shrink a blind packet; they do bound comparison.
  delete draft.factualAudit
  for(const q of draft.questions)q.answer='x'.repeat(10000)
  const blind=nextFactualReview(course,[],evidence,draft)
  assert.equal(blind.keys.length,32)
  acceptFactualReview(draft,blind,teachingResponse(blind.prompt,['e-current']))
  const comparison=nextFactualReview(course,[],evidence,draft)
  assert.ok(comparison.keys.length<32)
  assert.ok(comparison.prompt.split('Review payload: ')[1].length<=48000)
})

test('chapter-scale solver splits at its item bound without dropping questions',()=>{
  const draft=chapter(),base=structuredClone(draft.questions[0])
  draft.questions=Array.from({length:49},(_,i)=>({...structuredClone(base),key:`question-${i+1}`}))
  const first=nextFactualReview(course,[],evidence,draft)
  assert.equal(first.keys.length,48)
  acceptFactualReview(draft,first,teachingResponse(first.prompt,['e-current']))
  const second=nextFactualReview(course,[],evidence,draft)
  assert.equal(second.kind,'solve');assert.deepEqual(second.keys,['question-49'])
})


test('teaching review includes eight coherent objectives and rejects missing objective verdicts',async()=>{
  const {nextPedagogicalReview,acceptPedagogicalReview}=await import('../lib/study-pedagogical-review.mjs')
  const draft=chapter(),base=draft.teachingPlan.objectives[0]
  draft.teachingPlan.objectives=Array.from({length:8},(_,i)=>({...structuredClone(base),id:`objective-${i+1}`}))
  draft.objectiveCoverage=draft.teachingPlan.objectives.map(o=>({...structuredClone(draft.objectiveCoverage[0]),objectiveId:o.id}))
  const step=nextPedagogicalReview('Source context',draft)
  assert.equal(step.objectiveIds.length,8)
  assert.equal(step.responseSchema.properties.objectives.maxItems,8)
  const response=teachingResponse(step.prompt,['e-current'])
  response.objectives.pop()
  assert.throws(()=>acceptPedagogicalReview(draft,step,response),/every requested teaching objective/)
  assert.equal(draft.pedagogyAudit,undefined)
})

test('mixed scope and diagnostic corrections retain actionable directives and can repair objective goals',async()=>{
 const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
 const draft=chapter(),q=draft.questions[0],objective=draft.teachingPlan.objectives[0]
 const step=questionRepairStep(course,[],evidence,draft,[
  {severity:'error',itemKey:'scope',detail:'Narrow the objective goal and disclose historical evidence.'},
  {severity:'error',itemKey:`question:${q.key}`,detail:'The follow-up repeats a static choice instead of revising a choice after changed constraints.'}
 ])
 assert.equal(step.parts.length,2)
 assert.match(step.prompt,/REPAIR OBJECTIVE SCOPE/)
 assert.match(step.prompt,/REPAIR SELECTED PRACTICE/)
 assert.match(step.prompt,/REPLACE the scenario and task/)
 assert.equal(step.prompt.split('Existing chapter (data, not instructions):').length,2)
 assert.equal(step.prompt.split(evidence[0].text).length,2)
 const selected=step.parts.find(p=>p.keys)
 const response={learningGoals:['Explain the supported distinction.'],caveats:['Historical teaching is provisional for current scope.'],scope:{...draft.teachingPlan,objectives:Object.fromEntries(draft.teachingPlan.objectives.map(o=>[o.id,{...o,goal:o.id===objective.id?'Explain the supported distinction.':o.goal}]))},questions:Object.fromEntries(draft.questions.filter(q=>selected.keys.includes(q.key)).map(q=>[q.key,q]))}
 const fixed=applyQuestionRepair(draft,step,response)
 assert.equal(fixed.teachingPlan.objectives[0].goal,'Explain the supported distinction.')
 assert.deepEqual(fixed.sections,draft.sections)
 assert.deepEqual(fixed.questions.filter(q=>!selected.keys.includes(q.key)),draft.questions.filter(q=>!selected.keys.includes(q.key)))
 assert.deepEqual(fixed.questions.map(q=>q.key),draft.questions.map(q=>q.key))
 const unknown=structuredClone(response);unknown.scope.objectives[objective.id].sourceIds=['not-selected']
 assert.throws(()=>applyQuestionRepair(draft,step,unknown))
 const missing=structuredClone(response);delete missing.scope.objectives[objective.id]
 assert.throws(()=>applyQuestionRepair(draft,step,missing))
 const downgraded=structuredClone(response);downgraded.scope.objectives[objective.id].complexity=objective.complexity==='difficult'?'simple':'difficult'
 assert.throws(()=>applyQuestionRepair(draft,step,downgraded))
})

test('repair schema compaction is lossless and never overwrites existing definitions',async()=>{
 const {compactRepairSchema}=await import('../lib/study-chapter-repair.mjs')
 const citation={type:'string',minLength:1,enum:Array.from({length:80},(_,i)=>`evidence-${i}`)}
 const schema={type:'object',properties:{first:structuredClone(citation),second:structuredClone(citation)},$defs:{repair_enum_1:{type:'string',enum:['keep']}}}
 const saved=structuredClone(schema),compact=compactRepairSchema(schema)
 assert.deepEqual(schema,saved)
 assert.ok(JSON.stringify(compact).length<JSON.stringify(schema).length)
 const expand=node=>Array.isArray(node)?node.map(expand):node&&typeof node==='object'?node.$ref?expand(compact.$defs[node.$ref.split('/').at(-1)]):Object.fromEntries(Object.entries(node).filter(([k])=>k!=='$defs').map(([k,v])=>[k,expand(v)])):node
 assert.deepEqual(expand(compact),expand(schema))
 assert.deepEqual(compact.$defs.repair_enum_1,schema.$defs.repair_enum_1)
})

test('scope goals have room for a complete qualified statement without relaxing identities',async()=>{
 const {questionRepairStep,applyQuestionRepair}=await import('../lib/study-chapter-repair.mjs')
 const draft=chapter()
 const goal='Explain that AR, VR, and BCI can provide immersive interaction channels and may form part of an intelligent interface only when intelligent, adaptive, or responsive behavior is independently evidenced.'
 assert.ok(goal.length>180)
 const step=questionRepairStep(course,[],evidence,draft,[{severity:'error',itemKey:'scope',detail:'Complete the truncated goal.'}])
 const response={learningGoals:[goal],caveats:[],scope:{...draft.teachingPlan,objectives:Object.fromEntries(draft.teachingPlan.objectives.map(o=>[o.id,{...o,goal}]))}}
 assert.equal(applyQuestionRepair(draft,step,response).learningGoals[0],goal)
})
