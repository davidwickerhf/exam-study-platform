import test from 'node:test'
import assert from 'node:assert/strict'
import { nextFactualReview, acceptFactualReview, factualAuditIssues, answerKind } from '../lib/study-factual-review.mjs'
import { questionRepairStep, applyQuestionRepair, locateReviewIssues, teachingContent } from '../lib/study-chapter-repair.mjs'
import { nextPedagogicalReview, acceptPedagogicalReview, preservePedagogicalReview, combinedPedagogicalReview } from '../lib/study-pedagogical-review.mjs'
import { reviewBaseline, reviewFocusFor, reviewRoundOutcome } from '../lib/study-review-rounds.mjs'
import { deriveObjectiveCoverage, pedagogyReviewIssues } from '../lib/study-pedagogy.mjs'
import { studyLessonQuality } from '../lib/study-content-quality.mjs'
import { evidencePrompt } from '../lib/study-version-content.mjs'
import { course, lesson, teachingPlan, teachingResponse } from '../scripts/verification/study-fixtures.mjs'

const evidence=[{id:'e-current',sourceKey:'source',text:'Adding disjoint groups: two plus three equals five. Check with subtraction.'}]
const chapter=()=>({...lesson(['e-current']),id:'addition',teachingPlan:teachingPlan(['e-current'])})
const MOSCOW='Prioritise these release requirements with MoSCoW and justify each category: route between rooms, spoken directions, saved favourite rooms.'

// Solve every question, then return the answers step for the caller to judge.
function answersStep(draft) {
  const solve=nextFactualReview(course,[],evidence,draft)
  acceptFactualReview(draft,solve,teachingResponse(solve.prompt,['e-current']))
  const step=nextFactualReview(course,[],evidence,draft)
  assert.equal(step.kind,'answers')
  return step
}
function judge(draft,key,verdict) {
  const step=answersStep(draft)
  const raw=teachingResponse(step.prompt,['e-current'])
  raw.items[key]=verdict
  acceptFactualReview(draft,step,raw)
  // Finish the audit (re-solves, content verdicts) so per-item findings exist.
  for(let s;(s=nextFactualReview(course,[],evidence,draft));)acceptFactualReview(draft,s,teachingResponse(s.prompt,['e-current']))
  return factualAuditIssues(draft).filter(issue=>issue.itemKey===key)
}

test('judgment questions are identified deterministically, and exact question types never are',()=>{
  assert.equal(answerKind({type:'written',question:MOSCOW}),'judgment')
  assert.equal(answerKind({type:'mc',question:'Which design option is most appropriate for a noisy factory floor?'}),'judgment')
  assert.equal(answerKind({type:'calc',question:'Prioritise by computing the weighted score 0.4*3+0.6*5.'}),'exact')
  assert.equal(answerKind({type:'tf',question:'MoSCoW has four categories.'}),'exact')
  assert.equal(answerKind({type:'written',question:'Why must the groups be disjoint?'}),'unspecified')
})

test('a judgment question whose key and solver differ but are both defensible yields no error',()=>{
  const draft=chapter(),q=draft.questions[1];q.question=MOSCOW
  const key=`question:${q.key}`
  const issues=judge(draft,key,{correct:false,fault:'independent-solution',judgment:true,defensibleAlternative:true,rationale:'Both classifications follow from the evidence; the key justifies its choice.',
    issues:[{detail:'IndependentSolution classifies spoken directions as Must despite the evidence stating users can temporarily follow the visual route.',severity:'error',about:'independent-solution'}]})
  assert.ok(!issues.some(issue=>issue.severity==='error'),'a defensible alternative is never a chapter error')
  assert.ok(issues.some(issue=>issue.severity==='warning' && /acknowledging that alternative/.test(issue.detail)),'the alternative is recorded as a warning')
  assert.ok(draft.factualAudit.solutions[q.key],'no re-solve is scheduled for a judgment disagreement')
  assert.equal(draft.factualAudit.solveRetries[q.key],undefined)
  // The saved pilot shape: correct=true, blamed on the solver, error-severity
  // issues without an explicit target. Those are about the solver too.
  const saved=chapter();saved.questions[1].question=MOSCOW
  const pilot=judge(saved,key,{correct:true,fault:'independent-solution',rationale:'The proposed key is supported.',
    issues:[{detail:'The IndependentSolution relies on an interpretation the evidence does not support.',severity:'error'}]})
  assert.ok(pilot.length && pilot.every(issue=>issue.severity==='warning'))
})

test('an unsupported key on a judgment question is still an error',()=>{
  const draft=chapter(),q=draft.questions[1];q.question=MOSCOW
  const key=`question:${q.key}`
  const issues=judge(draft,key,{correct:false,fault:'authored',judgment:true,defensibleAlternative:true,rationale:'The key marks spoken directions Won\'t although the evidence makes them a release goal.',
    issues:[{detail:'The key contradicts the stated release goal for spoken directions.',severity:'error',about:'authored'}]})
  assert.ok(issues.some(issue=>issue.severity==='error'))
})

test('a factual or numeric question still requires the exact answer even if the reviewer calls it a judgment',()=>{
  const draft=chapter(),q=draft.questions[0];q.type='calc'
  const key=`question:${q.key}`
  const issues=judge(draft,key,{correct:false,fault:'none',judgment:true,defensibleAlternative:true,rationale:'The authored total is 6; the correct total is 5.',
    issues:[{detail:'The authored total is 6 but two plus three is five.',severity:'error',about:'authored'}]})
  assert.ok(issues.some(issue=>issue.severity==='error'))
  assert.equal(draft.factualAudit.judgments[key].judgment,false)
})

test('findings that only dispute the independent solution never create chapter errors',()=>{
  const draft=chapter(),key=`question:${draft.questions[2].key}`
  const issues=judge(draft,key,{correct:true,fault:'none',rationale:'The authored answer is correct.',
    issues:[{detail:'The blind solution skipped the subtraction check.',severity:'error',about:'independent-solution'}]})
  assert.deepEqual(issues.map(issue=>issue.severity),['warning'])
  // An authored-tagged error on a correct factual verdict keeps today's rigor.
  const strict=chapter(),strictKey=`question:${strict.questions[2].key}`
  assert.ok(judge(strict,strictKey,{correct:true,fault:'none',rationale:'Mostly correct.',issues:[{detail:'The explanation states the wrong unit.',severity:'error',about:'authored'}]}).some(issue=>issue.severity==='error'))
})

// Three objectives with separate teaching, practice and evidence.
function scopedChapter() {
  const draft=chapter()
  const [first,second,third]=draft.teachingPlan.objectives
  first.sourceIds=['e-one'];second.sourceIds=['e-two'];third.sourceIds=['e-three']
  for(const objective of draft.teachingPlan.objectives)for(const p of objective.prerequisites)p.sourceIds=objective.sourceIds
  const ownership=[[first],[first,second],[second],[third]]
  // The shared section cites only objective-two evidence.
  draft.sections.forEach((section,i)=>{section.objectiveIds=ownership[i].map(o=>o.id);section.sourceIds=[ownership[i].at(-1).sourceIds[0]]})
  draft.sections[3].text+=' OTHER-OBJECTIVE-TEACHING'
  const owners={'question-1':first,'question-3':first,'question-7':first,'question-2':second,'question-4':second,'question-8':second,'question-5':third,'question-6':third}
  for(const q of draft.questions){q.objectiveIds=[owners[q.key].id];q.sourceIds=owners[q.key].sourceIds}
  draft.questions.find(q=>q.key==='question-6').practiceStage='guided'
  draft.objectiveCoverage=[[first,'section-2'],[second,'section-3'],[third,'section-4']].map(([objective,worked])=>({objectiveId:objective.id,workedExampleSectionIds:[worked]}))
  deriveObjectiveCoverage(draft)
  return draft
}
const scopedEvidence=[
  {id:'e-one',sourceKey:'one',text:'Objective one evidence. '+'UNCITED-ONE '.repeat(400)},
  {id:'e-two',sourceKey:'two',text:'Objective two evidence: groups must be disjoint before adding.'},
  {id:'e-three',sourceKey:'three',text:'Objective three evidence. '+'UNCITED-THREE '.repeat(400)},
]
const scopedSources=['one','two','three'].map(key=>({key,title:key,kind:'slides'}))

test('a patch request carries only the targeted items, their objectives, dependent teaching and cited evidence plus a compact outline',()=>{
  const draft=scopedChapter()
  const step=questionRepairStep(course,scopedSources,scopedEvidence,draft,[{severity:'error',itemKey:'question:question-2',detail:'question-2: the answer does not explain why the groups must be disjoint.'}])
  assert.deepEqual(step.keys,['question-2'])
  const packet=JSON.parse(step.prompt.split('preserved automatically: ').at(-1))
  assert.deepEqual(packet.targets.questions.map(q=>q.key),['question-2'])
  assert.deepEqual(packet.objectives.map(o=>o.id),['objective-2'])
  assert.deepEqual(packet.dependentTeaching.map(s=>s.id),['section-2','section-3'])
  assert.deepEqual(packet.linkedPractice.map(q=>q.key),['question-4'],'the follow-up target travels read-only')
  assert.equal(packet.linkedPractice[0].answer,undefined)
  assert.deepEqual(packet.outline.sections.map(s=>s.id),['section-1','section-4'])
  assert.ok(packet.outline.sections.every(s=>!('text' in s)))
  assert.ok(packet.outline.questions.some(q=>q.key==='question-5' && !('question' in q)))
  assert.doesNotMatch(step.prompt,/OTHER-OBJECTIVE-TEACHING|UNCITED-ONE|UNCITED-THREE/)
  assert.match(step.prompt,/Objective two evidence/)
  assert.deepEqual(step.evidenceIds,['e-two'])
  const full=evidencePrompt(course,scopedSources,scopedEvidence).length+JSON.stringify(teachingContent(draft)).length
  assert.ok(step.prompt.length<full*0.5,`patch prompt ${step.prompt.length} should be far below the full-chapter ${full}`)
})

test('a reassembled patch keeps untouched content byte-identical and validates against the packet evidence',()=>{
  const draft=scopedChapter(),q=draft.questions.find(q=>q.key==='question-2')
  const step=questionRepairStep(course,scopedSources,scopedEvidence,draft,[{severity:'error',itemKey:'question:question-2',detail:'The answer skips the disjointness check.'}])
  const fixed=applyQuestionRepair(draft,step,{questions:{[q.key]:{...structuredClone(q),answer:q.answer+' Disjoint groups prevent double counting.'}}})
  assert.equal(JSON.stringify(fixed.sections),JSON.stringify(draft.sections))
  assert.equal(JSON.stringify(fixed.questions.filter(item=>item.key!==q.key)),JSON.stringify(draft.questions.filter(item=>item.key!==q.key)))
  assert.equal(JSON.stringify(fixed.teachingPlan),JSON.stringify(draft.teachingPlan))
  assert.equal(JSON.stringify(fixed.flashcards),JSON.stringify(draft.flashcards))
  // The provider may cite only the passages it was shown.
  assert.deepEqual(JSON.stringify(step.responseSchema).match(/"enum":\["e-[^\]]*\]/g).every(list=>list==='"enum":["e-two"]'),true)
  assert.throws(()=>applyQuestionRepair(draft,step,{questions:{[q.key]:{...structuredClone(q),practiceStage:'transfer'}}}),/format/)
})

test('after a correction the next review verifies prior findings, judges only changed content and keeps accepted verdicts',async()=>{
  const context='Source evidence'
  const draft=scopedChapter()
  for(let step;(step=nextPedagogicalReview(context,draft));)acceptPedagogicalReview(draft,step,teachingResponse(step.prompt,['e-current']))
  draft.pedagogicalReview=combinedPedagogicalReview(draft)
  const findings=[{severity:'error',itemKey:'question:question-2',detail:'question-2: the answer never explains disjointness.'},{severity:'error',itemKey:'section:section-3',detail:'The worked example caption contradicts its total.'}]
  draft.reviewBaseline=reviewBaseline(draft,findings)
  // The correction changes exactly question-2 and section-3.
  const corrected=structuredClone(draft)
  corrected.questions.find(q=>q.key==='question-2').answer+=' Disjoint groups prevent double counting.'
  corrected.sections.find(s=>s.id==='section-3').visual.caption+=' The total is five.'
  preservePedagogicalReview(draft,corrected,context)
  corrected.reviewFocus=reviewFocusFor(draft,corrected,findings,1)
  assert.deepEqual([...corrected.reviewFocus.changed].sort(),['question:question-2','section:section-3'])
  assert.ok(corrected.reviewFocus.accepted.includes('question:question-4'))
  assert.ok(!corrected.reviewFocus.accepted.includes('question:question-2'))
  const step=nextPedagogicalReview(context,corrected)
  assert.deepEqual(step.objectiveIds,['objective-2'],'unchanged objectives keep their saved verdicts')
  assert.match(step.prompt,/RE-REVIEW AFTER CORRECTION 1/)
  assert.match(step.prompt,/never explains disjointness/)
  assert.match(step.prompt,/Changed items: \["section:section-3","question:question-2"\]/)
  const raw=teachingResponse(step.prompt,['e-current'])
  raw.followUpChecks=raw.followUpChecks.map(row=>row.questionKey==='question-4'?{...row,useful:false,rationale:'A new objection to unchanged practice.'}:row)
  raw.transferChecks=raw.transferChecks.map(row=>row.questionKey==='question-8'?{...row,variation:'copied',rationale:'Now repeats the corrected worked example.'}:row)
  raw.issues=[
    {topicId:'question-4',scope:'question',severity:'error',detail:'A new complaint about unchanged, accepted practice.'},
    {topicId:'section-3',scope:'section',severity:'error',detail:'The worked example caption still contradicts its total.'},
  ]
  const combined=acceptPedagogicalReview(corrected,step,raw)
  const located=locateReviewIssues(corrected,pedagogyReviewIssues(corrected,combined))
  const errors=located.filter(issue=>issue.severity==='error').map(issue=>issue.itemKey)
  // question-4 is itself unchanged, but its objective's teaching (section-3)
  // changed, so a new error about it is no longer held back as accepted.
  assert.ok(errors.includes('question:question-4'),'an unchanged question whose objective teaching changed is judged again')
  assert.ok(!located.some(issue=>issue.itemKey==='question:question-4' && issue.carried==='accepted-unchanged'))
  assert.ok(errors.includes('section:section-3'),'a still-open prior finding is reported')
  assert.ok(errors.includes('question:question-8'),'a severe new issue on content whose dependency changed is reported')
  assert.ok(corrected.pedagogyAudit.reviews['objective-1'] && corrected.pedagogyAudit.reviews['objective-3'])
  const outcome=reviewRoundOutcome(corrected,located)
  assert.deepEqual(outcome.resolved.map(f=>f.itemKey),['question:question-2'])
  assert.deepEqual(outcome.carried.map(f=>f.itemKey),['section:section-3'])
  assert.deepEqual(outcome.introduced.map(f=>f.itemKey).sort(),['question:question-4','question:question-8'])
  // The answer check re-verifies the prior finding for its question; the blind
  // solver never sees it.
  const solve=nextFactualReview(course,[],evidence,corrected)
  assert.doesNotMatch(solve.prompt,/PREVIOUSLY REPORTED FINDINGS/)
  acceptFactualReview(corrected,solve,teachingResponse(solve.prompt,['e-current']))
  assert.match(nextFactualReview(course,[],evidence,corrected).prompt,/PREVIOUSLY REPORTED FINDINGS[^\n]*never explains disjointness/)
})

test('without an accepted review baseline nothing is held back',()=>{
  const draft=scopedChapter(),corrected=structuredClone(draft)
  corrected.questions[0].answer+=' Changed.'
  const focus=reviewFocusFor(draft,corrected,[{severity:'error',itemKey:'question:question-1',detail:'x'}],1)
  assert.deepEqual(focus.accepted,[])
  assert.ok(focus.changed.length>1)
})

test('the chapter-4 style practice finding now names its question and is located',()=>{
  const draft=chapter();draft.questions[4].hint=''
  const findings=studyLessonQuality(draft,evidence).filter(detail=>/Practice needs/.test(detail))
  assert.deepEqual(findings,['question-5: Practice needs a useful first hint, a stated objective and a reasoned solution.'])
  const [located]=locateReviewIssues(draft,findings.map(detail=>({severity:'error',detail})))
  assert.equal(located.itemKey,'question:question-5')
  assert.ok(questionRepairStep(course,[],evidence,draft,[located]),'it is patched, not rewritten')
})

test('findings quoting plan or scope text, or naming an objective by ordinal, are located exactly',()=>{
  const draft=chapter()
  draft.teachingPlan.gaps=['Lab asset files are referenced but not supplied in the extracts.']
  draft.teachingPlan.objectives[1].goal='Diagnose double counting when two inventories share products.'
  const [scope,goal,ordinal,apostrophe,ambiguous]=locateReviewIssues(draft,[
    {severity:'error',detail:"The gaps entry 'Lab asset files are referenced but not supplied' is unsupported."},
    {severity:'error',detail:`The goal “${draft.teachingPlan.objectives[1].goal}” overstates the taught reasoning.`},
    {severity:'error',detail:'Objective 3 claims a check the lesson never demonstrates.'},
    {severity:'error',detail:"The chapter's wording isn't precise enough anywhere in the lesson."},
    {severity:'error',detail:`The phrase "${draft.sections[0].text.slice(0,40)}" appears in every section.`},
  ])
  assert.equal(scope.itemKey,'scope')
  assert.equal(goal.itemKey,'objective:objective-2')
  assert.equal(ordinal.itemKey,'objective:objective-3')
  assert.equal(apostrophe.itemKey,undefined,'an apostrophe span that is not chapter text locates nothing')
  assert.equal(ambiguous.itemKey,undefined,'a quote found in several items is never guessed')
})

test('an accepted, unchanged question is held to a warning only while everything it depends on is unchanged',async()=>{
  const {applyReviewFocus}=await import('../lib/study-review-rounds.mjs')
  const chapter=changed=>({
    sections:[{id:'s1',objectiveIds:['o1']},{id:'s2',objectiveIds:['o2']}],
    questions:[{key:'q1',objectiveIds:['o1'],practiceStage:'independent',misconceptions:[{followUpKey:'q2'}]},{key:'q2',objectiveIds:['o1'],practiceStage:'remediation',misconceptions:[]},{key:'q3',objectiveIds:['o2'],practiceStage:'independent',misconceptions:[]}],
    teachingPlan:{objectives:[{id:'o1'},{id:'o2'}]},
    reviewFocus:{accepted:['question:q1','question:q2','question:q3'],changed},reviewBaseline:{transferChecks:{},followUpChecks:{}}
  })
  const review={issues:['q1','q2','q3'].map(topicId=>({topicId,scope:'question',severity:'error',detail:'New complaint.'})),transferChecks:[],followUpChecks:[]}
  const held=focus=>applyReviewFocus(chapter(focus),review).issues.filter(issue=>issue.carried==='accepted-unchanged').map(issue=>issue.topicId)
  assert.deepEqual(held(['section:s2']),['q1','q2'],'q3 depends on the changed teaching of o2')
  assert.deepEqual(held(['question:q2']).includes('q1'),false,'q1 links to the changed follow-up q2')
  assert.deepEqual(held(['objective:o1']),['q3'],'a changed plan entry reopens every question of that objective')
  assert.deepEqual(held(['question:q1']).includes('q2'),false,'a remediation question whose incoming diagnostic link changed is judged again')
})
