import test from 'node:test'
import assert from 'node:assert/strict'
import { GUIDE_CONTRACT_FILES, guideContractFingerprint } from '../lib/study-generation-contract.mjs'
import { renderingPreflight, repairRenderingControls, parseUniqueJson } from '../lib/study-preflight.mjs'
import { localUsageSummary } from '../lib/study-local-usage.mjs'
test('guide compatibility is scoped away from paper imports and detects acceptance changes',async()=>{
  assert.ok(!GUIDE_CONTRACT_FILES.includes('study-practice.mjs'))
  assert.ok(!GUIDE_CONTRACT_FILES.includes('study-paper-jobs.mjs'))
  const before=await guideContractFingerprint(async file=>file)
  assert.equal(before,await guideContractFingerprint(async file=>file))
  assert.notEqual(before,await guideContractFingerprint(async file=>file==='study-pedagogy.mjs'?file+'changed':file))
})
test('preflight catches control characters, malformed math and duplicate identities before review',()=>{
  const chapter={sections:[{id:'a',text:'$\frac{1}{2}$'},{id:'a',text:'$\times 2$'}],questions:[{key:'q'},{key:'q'}]}
  const issues=renderingPreflight(chapter)
  assert.ok(issues.some(i=>i.includes('control character')))
  assert.ok(issues.some(i=>i.includes('LaTeX')))
  assert.equal(issues.filter(i=>i.includes('duplicate identity')).length,2)
  assert.deepEqual(renderingPreflight({sections:[{id:'a',text:'$\\frac{1}{2}$\nA normal paragraph.\n'}]}),[])
  assert.throws(()=>parseUniqueJson('{"a":1,"\\u0061":2}'),/duplicate/)
  assert.deepEqual(parseUniqueJson('{"a":{"x":1},"b":{"x":2}}'),{a:{x:1},b:{x:2}})
})
test('render hygiene repairs observed truncated Unicode escapes without a model call',()=>{
 const original={teachingPlan:{objectives:[{goal:'acquisition \u000212 inference \u000212 representation'},{goal:'Apply re\u000209ranking'}],gaps:['textbook\u000202dependent detail']}}
 const repaired=repairRenderingControls(original)
 assert.equal(repaired.teachingPlan.objectives[0].goal,'acquisition → inference → representation')
 assert.equal(repaired.teachingPlan.objectives[1].goal,'Apply re-ranking')
 assert.equal(repaired.teachingPlan.gaps[0],'textbook-dependent detail')
 assert.equal(renderingPreflight(repaired).length,0)
 assert.equal(repaired.renderRepairs.length,3)
})
test('local usage keeps unknown totals and separates phases, chapters and task budget',()=>{
  const v={id:'v',course:{courseCode:'AI'},localReviewTaskBudget:1,localReceipts:[{task:{role:'reviewer',phase:'factual-solve',chapterId:'one'},usage:{inputTokens:30,outputTokens:20}},{task:{role:'reviewer',phase:'pedagogical',chapterId:'two'}}]}
  const summary=localUsageSummary(v)
  assert.equal(summary.overBudget,true);assert.equal(summary.phases[1].inputTokens,null)
  assert.equal(summary.phases[0].inputTokens,30)
})
