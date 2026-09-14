import test from 'node:test'
import assert from 'node:assert/strict'
import { lesson, pedagogicalReview } from '../scripts/verification/study-fixtures.mjs'
import { objectiveCoverageIssues, pedagogyReviewIssues, pedagogyPrompt, teachingPlanPrompt } from '../lib/study-pedagogy.mjs'
import { iotPedagogyFixture } from '../lib/study-pedagogy-fixtures.mjs'
import { pedagogicalEvaluationCheck } from '../lib/study-evaluation-steps.mjs'

test('difficult objectives require teaching, worked reasoning, supported practice and transfer', () => {
  const chapter = lesson(['e-1'])
  assert.deepEqual(objectiveCoverageIssues(chapter), [])
  chapter.objectiveCoverage[0].workedExampleSectionIds = []
  chapter.questions[0].hints = []
  chapter.questions[2].misconceptions[0].followUpKey = 'invented'
  const issues = objectiveCoverageIssues(chapter).join(' ')
  assert.match(issues, /worked reasoning/)
  assert.match(issues, /progressively/)
  assert.match(issues, /different question/)
})
test('passing prose-free reviews and invented evidence cannot activate chapters', () => {
  const chapter = lesson(['e-1']), review = pedagogicalReview(chapter)
  assert.deepEqual(pedagogyReviewIssues(chapter, review), [])
  review.objectives[0].explanation.quote = 'This was never taught.'
  assert.match(pedagogyReviewIssues(chapter, review).map(i => i.detail).join(' '), /actual visible teaching/)
  assert.ok(pedagogyReviewIssues(chapter, { objectives: [], issues: [] }).some(i => i.severity === 'error'))
})
test('review is independent of prior verdicts; textbook citations do not imply book access', () => {
  const chapter = {...lesson(['e-1']), evidenceReview: {secretPriorVerdict: 'pass'}, pedagogicalReview: {secretPriorVerdict: 'pass'}}
  assert.doesNotMatch(pedagogyPrompt('Evidence', chapter), /secretPriorVerdict/)
  assert.match(teachingPlanPrompt('Evidence', {}), /not access to its contents/)
})
test('IoT positive and shallow controls have identical structural coverage: semantics must decide', () => {
  const good = iotPedagogyFixture().chapter, shallow = iotPedagogyFixture({shallow:true}).chapter
  assert.deepEqual(objectiveCoverageIssues(good), [])
  assert.deepEqual(objectiveCoverageIssues(shallow), [])
  assert.equal(good.teachingPlan.objectives.length, 5)
  assert.deepEqual(good.questions, shallow.questions)
  const step = {kind:'iot-shallow', chapter:shallow}
  assert.equal(pedagogicalEvaluationCheck(step, pedagogicalReview(shallow)).passed, false)
  assert.equal(pedagogicalEvaluationCheck(step, pedagogicalReview(shallow, {shallow:true})).passed, true)
  assert.equal(pedagogicalEvaluationCheck(step, {objectives:[],issues:[]}).passed, false)
})

test('a changed exam-scope announcement invalidates otherwise unchanged chapter reuse',async()=>{
  const {inputHash}=await import('../lib/study-version-content.mjs')
  const topic={title:'Polling',sourceIds:['e-teach']},teaching={id:'e-teach',text:'Polling samples periodically.'}
  const before={id:'e-scope',scopeContext:true,text:'Polling is examined.'}
  const after={...before,text:'Polling will not be on this exam.'}
  assert.notEqual(inputHash(topic,[teaching,before]),inputHash(topic,[teaching,after]))
})


test('provider schema requires diagnostic feedback for any difficult-objective question',async()=>{
  const {teachingResponseSchema,teachingSchema}=await import('../lib/study-version-content.mjs')
  const {default:Ajv}=await import('ajv')
  const chapter=lesson(['e-1']),plan=chapter.teachingPlan
  const raw=teachingSchema.parse(chapter)
  const validate=new Ajv({strict:false}).compile(teachingResponseSchema(plan,['e-1']))
  assert.equal(validate(raw),true,JSON.stringify(validate.errors))
  raw.questions[0].misconceptions=[]
  assert.equal(validate(raw),false)
  raw.questions[0].objectiveIds=['invented']
  assert.equal(validate(raw),false)
})


test('reviewer evidence choices are exact visible excerpts and bind to their section', async () => {
  const {pedagogicalResponseSchema}=await import('../lib/study-version-content.mjs')
  const {default:Ajv}=await import('ajv')
  const chapter=iotPedagogyFixture().chapter
  const schema=pedagogicalResponseSchema(chapter)
  const choices=schema.properties.objectives.items.properties.explanation.anyOf
  const validate=new Ajv({strict:false}).compile({anyOf:choices})
  for(const choice of choices){
    const sectionId=choice.properties.sectionId.enum[0]
    const section=chapter.sections.find(s=>s.id===sectionId)
    for(const quote of choice.properties.quote.enum){
      assert.ok(section.text.includes(quote))
      assert.ok(quote.length<=280)
      assert.ok(validate({sectionId,quote}))
    }
  }
  assert.equal(validate({sectionId:chapter.sections[0].id,quote:'Invented explanation.'}),false)
  const quote=choices[0].properties.quote.enum[0]
  assert.equal(validate({sectionId:chapter.sections[1].id,quote}),false)
})


test('live-evaluation regression rejects an incomplete feasible intersection range', async()=>{
  const {intersectionRangeIssues}=await import('../lib/study-content-quality.mjs')
  const q={question:'Given P(A)=0.7, P(B)=0.5, give the allowable intersection range.',answer:'The allowable range is [0,0.5].'}
  assert.equal(intersectionRangeIssues(q).length,1)
  assert.deepEqual(intersectionRangeIssues({...q,answer:'The allowable intersection range is [0.2,0.5].'}),[])
  assert.deepEqual(intersectionRangeIssues({question:'Given P(A)=1/4 and P(B)=1/3.',answer:'The intersection range is [0,1/4].'}),[])
  assert.deepEqual(intersectionRangeIssues({...q,answer:'An incorrect student claimed the range [0,0.5]; explain the mistake.'}),[])
  assert.deepEqual(intersectionRangeIssues({...q,question:'First P(A)=0.7, then P(A)=0.1; P(B)=0.5.'}),[])
})

test('terminal remediation breaks diagnostic cycles without replacing assessment coverage',()=>{
  const chapter=lesson(['e-1'])
  const source=chapter.questions[0]
  const followUp={...structuredClone(source),id:'remediation-1',key:'remediation-1',practiceStage:'remediation',misconceptions:[]}
  source.misconceptions[0].followUpKey=followUp.key
  chapter.questions.push(followUp)
  assert.deepEqual(objectiveCoverageIssues(chapter),[])
  followUp.misconceptions=structuredClone(source.misconceptions)
  assert.match(objectiveCoverageIssues(chapter).join(' '),/terminal follow-up/)
  followUp.misconceptions=[]
  source.misconceptions[0].followUpKey='question-4'
  assert.match(objectiveCoverageIssues(chapter).join(' '),/linked from a diagnosed mistake/)
  source.misconceptions[0].followUpKey=followUp.key
  chapter.objectiveCoverage[0].independentQuestionKeys=[followUp.key]
  assert.match(objectiveCoverageIssues(chapter).join(' '),/independent question/)
})
