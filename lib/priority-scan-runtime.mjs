import { createHash } from 'node:crypto'
import { withRequestContext } from './request-context.mjs'
import { readDocument, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { callModel, llmSettings, chatAvailable } from './model-loop.mjs'
import { runBudgetedStudyCall, resolveStudyBilling } from './study-ai-budget.mjs'

export const priorityBatchKey = (version, rows) => createHash('sha256').update(JSON.stringify([version, rows])).digest('hex')
const namespace = 'priority-evidence-cache'
export function priorityBatchCache(accountId, bindingId) {
  const own = fn => withRequestContext({userId:accountId}, fn)
  return {
    load: key => own(async () => (await readDocument(namespace,bindingId,null))?.batches?.[key]?.result || null),
    save: (key,result) => own(async () => {
      for (let attempt=0;attempt<3;attempt++) {
        const held=await readDocument(namespace,bindingId,null)
        const entries=Object.entries(held?.batches || {}).filter(([id])=>id!==key).slice(-63)
        const value={revision:(held?.revision || 0)+1,batches:Object.fromEntries([...entries,[key,{result,savedAt:new Date().toISOString()}]])}
        try { await compareAndSwapDocument(namespace,bindingId,value,held?.revision ?? null); return }
        catch(error) { if (!(error instanceof DocumentConflictError)) throw error }
      }
    })
  }
}

// Background extraction spends only platform allowance, never a saved personal
// key. It shares atomic user/platform caps with study generation, without
// consuming chapter credits. Each evidence revision has its own ceiling for capped accounts; development
// and verified owner exemptions still meter spend.
export function priorityModelCall(accountId, bindingId, evidenceHash, {settings=llmSettings,available=chatAvailable,modelCall=callModel,budgetCall=runBudgetedStudyCall} = {}) {
  return (messages, options) => withRequestContext({userId:accountId}, async () => {
    const config=await settings()
    if (config.baseUrl !== 'https://api.openai.com/v1') throw Object.assign(new Error('Priority extraction requires a priced first-party provider.'),{status:503})
    const billing=await resolveStudyBilling({billingSource:'platform',maxJobUsd:0.20},{configured:available(),provider:'openai',model:config.model})
    const prompt=JSON.stringify(messages)
    const text=await budgetCall(prompt,options,{billing,jobKey:`priority:${bindingId}:${evidenceHash}`,
      callPlatform: async () => {
        const result=await modelCall(messages,options)
        return {text:typeof result.message.content === 'string' ? result.message.content : JSON.stringify(result.message.content),usage:result.usage ? {inputTokens:result.usage.prompt_tokens,outputTokens:result.usage.completion_tokens} : null}
      }
    })
    return {message:{content:text}}
  })
}
