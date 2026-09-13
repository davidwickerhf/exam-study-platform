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
