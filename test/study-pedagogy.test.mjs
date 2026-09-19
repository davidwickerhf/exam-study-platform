import test from 'node:test'
import assert from 'node:assert/strict'
import { lesson, pedagogicalReview } from '../scripts/verification/study-fixtures.mjs'
import { objectiveCoverageIssues, pedagogyReviewIssues, pedagogyPrompt, teachingPlanPrompt, normalizeObjectiveCoverageLinks, OBJECTIVE_LINK_ISSUE_PATTERN } from '../lib/study-pedagogy.mjs'
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
test('normalizeObjectiveCoverageLinks drops a stray worked-example reference when a valid one remains', () => {
  const chapter = lesson(['e-1'])
  // section-4 exists but is not tagged for objective-1; the real bug's shape.
  chapter.sections[3].objectiveIds = ['objective-2', 'objective-3']
  chapter.objectiveCoverage[0].workedExampleSectionIds = ['section-3', 'section-4']
  assert.match(objectiveCoverageIssues(chapter).join(' '), OBJECTIVE_LINK_ISSUE_PATTERN)
  const normalized = normalizeObjectiveCoverageLinks(chapter)
  assert.deepEqual(normalized.objectiveCoverage[0].workedExampleSectionIds, ['section-3'])
  assert.deepEqual(normalized.linkRepairs, [{ objectiveId: 'objective-1', list: 'workedExampleSectionIds', ref: 'section-4', reason: 'section is not tagged with this objective' }])
  assert.deepEqual(objectiveCoverageIssues(normalized), [])
  // The original is untouched; only the returned chapter changed.
  assert.deepEqual(chapter.objectiveCoverage[0].workedExampleSectionIds, ['section-3', 'section-4'])
})
test('normalizeObjectiveCoverageLinks drops a reference to a section that does not exist', () => {
  const chapter = lesson(['e-1'])
  chapter.objectiveCoverage[0].workedExampleSectionIds = ['section-3', 'section-missing']
  const normalized = normalizeObjectiveCoverageLinks(chapter)
  assert.deepEqual(normalized.objectiveCoverage[0].workedExampleSectionIds, ['section-3'])
  assert.deepEqual(normalized.linkRepairs, [{ objectiveId: 'objective-1', list: 'workedExampleSectionIds', ref: 'section-missing', reason: 'section does not exist' }])
})
test('normalizeObjectiveCoverageLinks drops a question-key reference with the wrong practice stage when a valid one remains', () => {
  const chapter = lesson(['e-1'])
  // question-3 exists and is tagged for objective-1, but it is independent
  // practice, not guided; the reference is invalid for guidedQuestionKeys.
  chapter.objectiveCoverage[0].guidedQuestionKeys = ['question-1', 'question-3']
  const normalized = normalizeObjectiveCoverageLinks(chapter)
  assert.deepEqual(normalized.objectiveCoverage[0].guidedQuestionKeys, ['question-1'])
  assert.deepEqual(normalized.linkRepairs, [{ objectiveId: 'objective-1', list: 'guidedQuestionKeys', ref: 'question-3', reason: 'question is not a guided question' }])
})
test('normalizeObjectiveCoverageLinks leaves a list untouched, and the error standing, when dropping would empty it', () => {
  const chapter = lesson(['e-1'])
  chapter.objectiveCoverage[0].guidedQuestionKeys = ['question-3'] // the only reference; wrong stage
  const normalized = normalizeObjectiveCoverageLinks(chapter)
  assert.equal(normalized, chapter) // untouched: no valid reference remains to keep
  assert.match(objectiveCoverageIssues(normalized).join(' '), /must identify a guided question/)
})
test('normalizeObjectiveCoverageLinks never adds an objective tag or invents a link', () => {
  const chapter = lesson(['e-1'])
  chapter.sections[3].objectiveIds = ['objective-2', 'objective-3']
  chapter.objectiveCoverage[0].workedExampleSectionIds = ['section-3', 'section-4']
  const before = JSON.stringify({ sections: chapter.sections.map(s => ({ id: s.id, objectiveIds: s.objectiveIds })), questions: chapter.questions.map(q => ({ key: q.key, objectiveIds: q.objectiveIds })) })
  const normalized = normalizeObjectiveCoverageLinks(chapter)
  const after = JSON.stringify({ sections: normalized.sections.map(s => ({ id: s.id, objectiveIds: s.objectiveIds })), questions: normalized.questions.map(q => ({ key: q.key, objectiveIds: q.objectiveIds })) })
  assert.equal(after, before) // no section/question objective tag changed
  for (const row of normalized.objectiveCoverage) {
    const original = chapter.objectiveCoverage.find(r => r.objectiveId === row.objectiveId)
    for (const field of ['explanationSectionIds', 'workedExampleSectionIds', 'guidedQuestionKeys', 'independentQuestionKeys', 'transferQuestionKeys'])
      assert.ok((row[field] || []).every(ref => (original[field] || []).includes(ref))) // only removals, never additions
  }
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

// The recurring, evidenced failure classes from the hosted pilots are stated
// once in the drafting and planning prompts so a chapter stops earning the
// correction that costs far more than avoiding the fault.
test('the drafting and teaching-plan prompts state the recurring failure rules', async () => {
  const { lessonPrompt } = await import('../lib/study-version-content.mjs')
  const chunks = [{ id: 'e-1', sourceKey: 'slides', page: 1, text: 'Addition combines disjoint quantities.' }]
  const draft = lessonPrompt({ courseCode: 'CS101', courseName: 'Foundations', academicYear: '2026-2027' }, [], chunks, { title: 'Addition', sourceIds: ['e-1'] })
  const plan = teachingPlanPrompt('Evidence', { id: 'addition', title: 'Addition' })
  for (const prompt of [draft, plan]) {
    assert.match(prompt, /RECURRING FAILURES TO AVOID/)
    assert.match(prompt, /misconception/i)
    assert.match(prompt, /exercise that specific mistaken reasoning/)
    assert.match(prompt, /transfer/i)
    assert.match(prompt, /absent from the supplied evidence/)
    assert.match(prompt, /background/)
    assert.match(prompt, /internal evidence identifiers/)
    assert.match(prompt, /current-edition evidence/)
  }
  // Existing instructions are not weakened by the additions.
  assert.match(draft, /Return JSON only/)
  assert.match(draft, /At most 2 simple recall questions/)
  assert.match(plan, /not access to its contents/)
  assert.match(plan, /Return only the structured plan/)
})
