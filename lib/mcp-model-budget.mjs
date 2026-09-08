import { currentAuth } from './request-context.mjs'
import { AI_LIMITS } from './ai-usage.mjs'

// Bound every hosted conversational model round, including tool-result context.
// UTF-8 bytes plus framing conservatively bound input tokens across models.
// A failed/interrupted provider call keeps its reservation: it may be billable.
export async function reserveRemoteModelBudget(payload, maxOutputTokens) {
  const auth=currentAuth()
  if(!auth.remoteMcp)return null
  const store=auth.mcpBudgetStore
  if(!store)throw Object.assign(new Error('The remote AI budget is unavailable.'),{status:503})
  const input=Buffer.byteLength(JSON.stringify(payload))+1024,cost=input+maxOutputTokens
  const now=new Date(),month=`${now.getUTCFullYear()}-${now.getUTCMonth()+1}`
  const reservations=[]
  for(const [period,window,limit]of [[`day:${Math.floor(Date.now()/86400000)}`,86400000,AI_LIMITS.tokensPerDay],[`month:${month}`,32*86400000,AI_LIMITS.tokensPerMonth]]){
    for(const identity of [`user:${auth.userId}`,`key:${auth.keyId}`]){
      const id=`mcp-model:${period}:${identity}`
      if(!await store.charge(id,cost,limit,window*2)){
        for(const held of reservations)await store.charge(held.id,-cost,Number.MAX_SAFE_INTEGER,held.window*2)
        const reset=period.startsWith('day:')?(Math.floor(Date.now()/86400000)+1)*86400000:Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)
        throw Object.assign(new Error('The hosted AI token budget is insufficient for this request. Use direct source tools, shorten the conversation, or wait for the allowance to reset.'),{status:429,code:'remote_token_budget',retryAfter:Math.max(1,Math.ceil((reset-Date.now())/1000))})
      }
      reservations.push({id,window})
    }
  }
  return async usage=>{
    const actual=Number(usage?.prompt_tokens)+Number(usage?.completion_tokens)
    if(!Number.isFinite(actual)||actual<=0)return
    const refund=Math.max(0,cost-actual)
    for(const held of reservations)await store.charge(held.id,-refund,Number.MAX_SAFE_INTEGER,held.window*2)
  }
}
