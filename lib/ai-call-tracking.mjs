import { studyProviderError } from './study-provider-errors.mjs'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { currentAuth, currentUserId } from './request-context.mjs'
import { normalizeCallUsage, callCost } from './ai-call-metrics.mjs'
import { saveAiCallEvent } from './ai-call-store.mjs'
const context=new AsyncLocalStorage()
export function withAiCallContext(metadata, work) { return context.run({...context.getStore(),...metadata},work) }
const label=(v,fallback='unclassified')=>typeof v==='string'&&v? v.slice(0,180):fallback
function routeFeature(route='') {
  if(route.startsWith('/api/tutor'))return 'tutor'
  if(route.includes('onboarding'))return 'onboarding'
  if(route.startsWith('/api/admin'))return 'editorial'
  if(route.includes('practice'))return 'practice'
  if(route.includes('academic'))return 'academic-intake'
  return 'other'
}
export function missingUsageError() {
  return Object.assign(new Error('The AI provider did not return valid token counts. The call is recorded with usage unavailable; its spending reservation is retained.'),{code:'provider_usage_missing',status:502,retryable:false})
}
// One record per provider attempt, never per tool call, quota reservation, or SDK summary.
// Pending is persisted before sending; interrupted processes remain visible as pending.
export async function trackAiCall(metadata, work, {save=saveAiCallEvent}={}) {
  const m={...context.getStore(),...metadata},auth=currentAuth(),started=Date.now()
  const event={id:randomUUID(),userId:currentUserId(),createdAt:new Date(started).toISOString(),
    provider:label(m.provider),model:label(m.model),feature:label(m.feature,routeFeature(auth.aiRoute)),
    phase:label(m.phase),payer:label(m.payer,'platform'),operation:label(m.operation,'generation'),
    jobId:label(m.jobId,''),chapterId:label(m.chapterId,''),source:auth.mode==='api-key'?'mcp':auth.aiRoute?'app':'background',
    status:'pending',...normalizeCallUsage(null),estimatedCostUsd:null,pricingVersion:null,durationMs:0}
  await save(event)
  let captured=null
  const observe=data=>{
    captured=data
    if(m.requireUsage!==false && normalizeCallUsage(data?.usage,event.provider,event.operation).usageStatus!=='reported')throw missingUsageError()
    return data
  }
  try {
    const result=await work(observe)
    const raw=captured?.usage ?? result?.usage
    Object.assign(event,normalizeCallUsage(raw,event.provider,event.operation))
    event.responseId=label(captured?.id ?? raw?.responseId,'')
    event.serviceTier=label(captured?.service_tier,'default')
    if(event.usageStatus!=='reported' && m.requireUsage!==false)throw missingUsageError()
    Object.assign(event,callCost(event.model,event,{provider:event.provider,serviceTier:event.serviceTier,firstParty:m.firstParty!==false}))
    event.status=captured?.status==='incomplete'||captured?.choices?.some(c=>c.finish_reason==='length')||captured?.stop_reason==='max_tokens'?'incomplete':'completed'
    return result
  } catch(error) {
    if(captured?.usage || error.usage)Object.assign(event,normalizeCallUsage(captured?.usage || error.usage,event.provider,event.operation))
    Object.assign(event,callCost(event.model,event,{provider:event.provider,serviceTier:captured?.service_tier || 'default',firstParty:m.firstParty!==false}))
    event.status=error.name==='AbortError'||error.name==='TimeoutError'?'aborted':'failed'
    event.errorCode=label(error.code || error.name,'provider_error')
    event.providerRequestId=label(error.providerRequestId,'')
    // Preserve usage for the existing hard-cap ledger even if parsing failed later.
    if(event.usageStatus==='reported') error.usage={...event,estimated:false}
    throw error
  } finally {
    event.responseId=label(captured?.id || captured?.usage?.responseId,'')
    event.providerRequestId=label(captured?.providerRequestId || event.providerRequestId,'')
    event.durationMs=Date.now()-started;event.completedAt=new Date().toISOString()
    // A failed metrics write must not cause a second paid model call. The durable
    // pending row makes the gap visible, and operational logs identify its ID.
    try { await save(event) } catch { console.error(JSON.stringify({code:'AI_USAGE_SETTLEMENT_FAILED',eventId:event.id})) }
  }
}
export async function trackedJsonFetch(url, options, fetchImpl) {
  let body;try{body=JSON.parse(options.body)}catch{return fetchImpl(url,options)}
  const endpoint=new URL(url),operation=endpoint.pathname.endsWith('/embeddings')?'embeddings':'generation'
  const provider=endpoint.hostname==='api.anthropic.com'?'anthropic':'openai'
  return trackAiCall({provider,model:body.model,operation,firstParty:['api.openai.com','api.anthropic.com'].includes(endpoint.hostname)},async observe=>{
    const response=await fetchImpl(url,options)
    if(!response.ok){const error=await studyProviderError(response);error.providerRequestId=response.headers.get('x-request-id') || response.headers.get('request-id');throw error}
    const data=await response.clone().json();observe({...data,providerRequestId:response.headers.get('x-request-id') || response.headers.get('request-id')})
    return response
  })
}
