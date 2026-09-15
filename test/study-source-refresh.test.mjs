import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceRefreshStep, applySourceRefresh } from '../lib/study-source-refresh.mjs'
import {lesson,teachingPlan} from '../scripts/verification/study-fixtures.mjs'
const before={chunks:[{id:'e-old',sourceKey:'slides',page:1,text:'Two plus three is five.'}]}
const after={chunks:[{id:'e-new',sourceKey:'slides',page:1,text:'Two plus three is five.'},{id:'e-added',sourceKey:'new',page:2,text:'New scope.'}]}
const chapter={...lesson(['e-old']),teachingPlan:teachingPlan(['e-old'])}
const patch={sections:[],removeSectionIds:[],questions:[],removeQuestionKeys:[],flashcards:null,summary:null,caveats:null,learningGoals:null,walkthrough:null}
test('source refresh retains unmentioned teaching and rebinds only identical source/page/text',()=>{
 const step=sourceRefreshStep(chapter,before,after,teachingPlan(['e-new']))
 const updated=applySourceRefresh(step,patch)
 assert.equal(updated.questions.length,chapter.questions.length)
 assert.deepEqual(updated.questions[0].sourceIds,['e-new'])
 assert.equal(updated.sections[0].text,chapter.sections[0].text)
 assert.match(step.prompt,/INCREMENTAL SOURCE REFRESH/)
 const changed=sourceRefreshStep(chapter,before,{chunks:[{...after.chunks[0],text:'Two plus three is six.'}]},chapter.teachingPlan)
 assert.deepEqual(changed.base.questions[0].sourceIds,['e-old'],'changed evidence stays invalid until corrected, never silently rebound')
})
test('source refresh rejects duplicate and conflicting patch identities',()=>{
 const step=sourceRefreshStep(chapter,before,after,chapter.teachingPlan)
 assert.throws(()=>applySourceRefresh(step,{...patch,sections:[chapter.sections[0],chapter.sections[0]]}),/identities/)
 assert.throws(()=>applySourceRefresh(step,{...patch,removeQuestionKeys:['invented']}),/identities/)
})
