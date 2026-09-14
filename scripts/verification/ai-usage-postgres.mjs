// Runs only against a disposable local database. Does not touch existing tables.
import { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import * as neonModule from '@neondatabase/serverless'
const url=new URL(process.env.AI_USAGE_TEST_DATABASE_URL || '')
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use a disposable localhost database.')
const pool=new pg.Pool({connectionString:url.href})
function sql(strings,...values){return pool.query(strings.reduce((out,part,i)=>out+(i?`$${i}`:'')+part,''),values).then(r=>r.rows)}
mock.module('@neondatabase/serverless',{namedExports:{...neonModule,neon:()=>sql}})
process.env.DATABASE_URL=url.href
const {saveAiCallEvent,aiCallReport}=await import('../../lib/ai-call-store.mjs')
const {withRequestContext}=await import('../../lib/request-context.mjs')
const {randomUUID}=await import('node:crypto')
const users=[`metrics-${randomUUID()}`,`metrics-${randomUUID()}`]
try {
 await pool.query(await readFile(new URL('../../db/037_ai_call_events.sql',import.meta.url),'utf8'))
 const base={createdAt:new Date().toISOString(),feature:'tutor',model:'gpt-5-mini',payer:'platform',phase:'answer',status:'completed',usageStatus:'reported',inputTokens:100,outputTokens:20,totalTokens:120,cachedInputTokens:10,reasoningTokens:5,estimatedCostUsd:.1,durationMs:15}
 const first={...base,id:randomUUID(),userId:users[0]}
 await Promise.all([saveAiCallEvent(first),saveAiCallEvent({...base,id:randomUUID(),userId:users[1]})]);await saveAiCallEvent(first)
 await saveAiCallEvent({...base,id:randomUUID(),userId:users[0],status:'failed',usageStatus:'unavailable',inputTokens:null,outputTokens:null,totalTokens:null,estimatedCostUsd:null})
 await withRequestContext({userId:users[0]},async()=>{
  const own=await aiCallReport({userId:users[1]});assert.equal(own.totals.calls,2);assert.equal(own.totals.totalTokens,120);assert.equal(own.totals.estimatedCostUsd,.1);assert.equal(own.totals.unpricedCalls,1)
  await assert.rejects(aiCallReport({}, {global:true}),e=>e.status===403)
 })
 await withRequestContext({userId:users[0],admin:true},async()=>{
  const report=await aiCallReport({userId:users[1]},{global:true});assert.equal(report.totals.calls,1);assert.equal(report.groups.feature[0].key,'tutor');assert.equal(report.recent.length,1)
  const none=await aiCallReport({feature:'missing'},{global:true});assert.equal(none.totals.calls,0)
 })
 console.log('PASS: PostgreSQL persistence, idempotency, aggregate totals, missing usage, personal isolation and admin filtering')
}finally{await pool.query('DELETE FROM ai_call_events WHERE user_id=ANY($1)',[users]);await pool.end()}
