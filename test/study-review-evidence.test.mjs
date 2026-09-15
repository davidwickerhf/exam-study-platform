import test from 'node:test'
import assert from 'node:assert/strict'
import {focusedReviewEvidence,focusedReviewPrompt} from '../lib/study-review-evidence.mjs'
import {nextFactualReview} from '../lib/study-factual-review.mjs'
import {course,lesson,teachingPlan} from '../scripts/verification/study-fixtures.mjs'
const evidence=['cited','prerequisite','linked','scope','unrelated'].map(id=>({id,sourceKey:id,text:`${id} evidence`,...(id==='scope'?{scopeContext:true}:{})}))
const chapter={teachingPlan:{objectives:[{id:'objective',sourceIds:['cited'],prerequisites:[{sourceIds:['prerequisite']}]}]},sections:[{objectiveIds:['objective'],sourceIds:['prerequisite']}],questions:[{key:'follow-up',objectiveIds:['objective'],sourceIds:['linked']}]}
test('focused review keeps scope, complete prerequisite passages and diagnostic targets',()=>{
 const item={sourceIds:['cited'],objectiveIds:['objective'],misconceptions:[{followUpKey:'follow-up'}]}
 assert.deepEqual(focusedReviewEvidence(evidence,chapter,[item]).map(c=>c.id),['cited','prerequisite','linked','scope'])
 const prompt=focusedReviewPrompt(course,evidence.map(c=>({key:c.id,title:c.id})),evidence,chapter,[item])
 assert.doesNotMatch(prompt,/unrelated/);assert.match(prompt,/scope evidence/)
})
test('ambiguous references or absent annotations conservatively retain all evidence',()=>{
 for(const item of [{},{sourceIds:['missing']},{sourceIds:['cited'],objectiveIds:['unknown']}])assert.deepEqual(focusedReviewEvidence(evidence,chapter,[item]),evidence)
})
test('focused blind solver still cannot see authored answers or teaching',()=>{
 const draft={...lesson(['cited']),teachingPlan:teachingPlan(['cited'])};draft.questions[0].answer='SECRET ANSWER';draft.sections[0].text='SECRET TEACHING'
 const step=nextFactualReview(course,evidence.map(c=>({key:c.id,title:c.id})),evidence,draft)
 assert.doesNotMatch(step.prompt,/SECRET|unrelated evidence/)
 assert.match(step.prompt,/scope evidence/)
})


test('a cited source retains its uncited surrounding passages, including contradictions',()=>{
 const extra={id:'contradiction',sourceKey:'cited',text:'A later passage contradicts the earlier claim.'}
 assert.ok(focusedReviewEvidence([...evidence,extra],chapter,[{sourceIds:['cited']}]).includes(extra))
})
