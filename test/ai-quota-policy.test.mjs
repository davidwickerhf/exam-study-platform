import test from 'node:test'
import assert from 'node:assert/strict'
import {aiQuotaExemption,developmentAiQuotasDisabled,verifiedAccountQuotaExempt} from '../lib/ai-quota-policy.mjs'

test('development and preview are unlimited, production and verification retain caps',()=>{
  assert.equal(developmentAiQuotasDisabled({NODE_ENV:'development'}),true)
  assert.equal(developmentAiQuotasDisabled({NODE_ENV:'production',VERCEL_ENV:'preview'}),true)
  assert.equal(developmentAiQuotasDisabled({NODE_ENV:'development',VERCEL_ENV:'production'}),false)
  assert.equal(developmentAiQuotasDisabled({NODE_ENV:'production'}),false)
  assert.equal(developmentAiQuotasDisabled({NODE_ENV:'test'}),false)
  assert.equal(developmentAiQuotasDisabled({NODE_TEST_CONTEXT:'child-v8'}),false)
})
test('only the two verified account emails are exempt, including queued workers',async()=>{
  const env={NODE_ENV:'production'}
  for (const email of ['davidwickerhf@gmail.com','D.WICKER@STUDENT.MAASTRICHTUNIVERSITY.NL']) {
    let lookedUp
    assert.equal(await aiQuotaExemption({owner:'queued-owner',env,lookup:async id=>{lookedUp=id;return {email}}}),'account')
    assert.equal(lookedUp,'queued-owner')
  }
  assert.equal(verifiedAccountQuotaExempt('davidwickerhf+other@gmail.com'),false)
  assert.equal(await aiQuotaExemption({env,lookup:async()=>({email:null})}),null)
  assert.equal(await aiQuotaExemption({env,lookup:async()=>({email:'someone@student.maastrichtuniversity.nl',admin:true})}),null)
  assert.equal(await aiQuotaExemption({env,lookup:async()=>{throw new Error('Identity unavailable')}}),null)
})
