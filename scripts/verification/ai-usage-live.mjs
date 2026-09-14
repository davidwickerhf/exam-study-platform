// Tiny opt-in transport evaluation. Uses an isolated local user and no hosted database.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
if(process.env.DATABASE_URL)throw new Error('This probe requires isolated local storage.')
if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is required.')
const {withRequestContext}=await import('../../lib/request-context.mjs')
const {runStudyAgentsSdk}=await import('../../lib/study-agents-sdk.mjs')
const {callModel}=await import('../../lib/model-loop.mjs')
const {embedTexts}=await import('../../lib/embeddings.mjs')
const {aiCallReport}=await import('../../lib/ai-call-store.mjs')
const {deleteAllDocuments}=await import('../../lib/user-store.mjs')
const userId=`usage-live-${randomUUID()}`
try {await withRequestContext({userId},async()=>{
 const messages=[{role:'user',content:'Reply with OK.'}]
 await callModel(messages,{model:'gpt-5-mini',maxOutputTokens:1024,usageFeature:'usage-evaluation'})
 await callModel(messages,{model:'gpt-5-mini',maxOutputTokens:1024,usageFeature:'usage-evaluation',onContent:()=>{}})
 await runStudyAgentsSdk('Reply with OK.',{apiKey:process.env.OPENAI_API_KEY,model:'gpt-5-mini',maxOutputTokens:1024,providerTimeoutMs:90000,reasoningEffort:'low'})
 await embedTexts(['Usage evaluation.'])
 const report=await aiCallReport()
 assert.equal(report.totals.calls,4);assert.equal(report.totals.unknownUsageCalls,0)
 assert.equal(report.recent.filter(e=>e.status==='completed').length,4)
 console.log(JSON.stringify({passed:true,totals:report.totals,calls:report.recent.map(({provider,model,operation,status,inputTokens,outputTokens,cachedInputTokens,reasoningTokens,estimatedCostUsd})=>({provider,model,operation,status,inputTokens,outputTokens,cachedInputTokens,reasoningTokens,estimatedCostUsd}))},null,2))
})}finally{await withRequestContext({userId},deleteAllDocuments)}
