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

test('MCP inherits the verified owner exemption for every key, without trusting connector claims or preview mode',async()=>{
  const {withRequestContext}=await import('../lib/request-context.mjs')
  for(const keyId of ['personal-key','oauth-existing-grant','oauth-new-grant']) {
    await withRequestContext({userId:'owner',keyId,remoteMcp:true},async()=>{
      assert.equal(await aiQuotaExemption({env:{VERCEL_ENV:'production'},lookup:async id=>{assert.equal(id,'owner');return {email:'d.wicker@student.maastrichtuniversity.nl'}}}),'account')
      assert.equal(await aiQuotaExemption({env:{VERCEL_ENV:'preview'},lookup:async()=>({email:'ordinary@example.com'})}),null)
    })
  }
  await withRequestContext({userId:'ordinary',remoteMcp:true,email:'davidwickerhf@gmail.com',admin:true,unlimited:true},async()=>{
    assert.equal(await aiQuotaExemption({env:{VERCEL_ENV:'production'},lookup:async()=>({email:'ordinary@example.com'})}),null)
    assert.equal(await aiQuotaExemption({env:{VERCEL_ENV:'production'},lookup:async()=>{throw new Error('Unavailable')}}),null)
  })
})
