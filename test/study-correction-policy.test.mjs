import test from 'node:test'
import assert from 'node:assert/strict'
import { correctionLimit, correctionStatus, recordCorrection } from '../lib/study-correction-policy.mjs'

test('one persisted correction allowance covers every phase and manual retries do not reset it',()=>{
  let draft={}
  const chapter={id:'scheduler',sections:[{text:'Ready is not Running.'}]}
  const findings=[{severity:'error',detail:'Explain the remaining higher-priority work.'},{severity:'warning',detail:'Optional extension.'}]
  for(const phase of ['structure','factual','pedagogical']){
    assert.ok((draft.automaticRepairs?.scheduler || 0)<correctionLimit(draft))
    recordCorrection(draft,chapter,findings,phase)
    draft=JSON.parse(JSON.stringify(draft))
  }
  assert.equal(draft.automaticRepairs.scheduler,correctionLimit(draft))
  recordCorrection(draft,chapter,findings,'manual',{manual:true})
  const status=correctionStatus(draft)
  assert.equal(status.attempts.scheduler,3)
  assert.equal(status.manualAttempts.scheduler,1)
  assert.deepEqual(status.history.map(row=>row.phase),['structure','factual','pedagogical','manual'])
  assert.ok(status.history.every(row=>row.findings.length===1 && row.baseHash))
  assert.equal(correctionLimit({correctionPolicy:{maxAttempts:0}}),0)
  assert.equal(correctionLimit({correctionPolicy:{maxAttempts:999}}),3)
})

test('correction context carries earlier fixes without leaking other chapters',async()=>{
  const {correctionContext}=await import('../lib/study-correction-policy.mjs')
  const draft={correctionHistory:[{chapterId:'a',phase:'factual',findings:[{detail:'Explain nonnegativity.'}]},{chapterId:'b',phase:'factual',findings:[{detail:'Other chapter secret.'}]}]}
  const context=correctionContext(draft,'a')
  assert.match(context,/Explain nonnegativity/)
  assert.match(context,/Earlier findings may already be resolved/)
  assert.match(context,/distinct from the independent and transfer/)
  // Unsupported-evidence findings must be told to remove/relabel the content
  // and its assessment, never to invent new teaching to justify it.
  assert.match(context,/not established by the supplied evidence/)
  assert.match(context,/remove it or clearly relabel it as background/)
  assert.match(context,/[Dd]o not add new teaching to justify unsupported content/)
  assert.ok(!context.includes('Other chapter secret'))
  assert.equal(correctionContext({},'a'),'')
})
