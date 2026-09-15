// Observability prices are versioned estimates, separate from conservative budget reservations.
// https://developers.openai.com/api/docs/pricing (2026-09-14)
const prices = {
  'gpt-6-astra': { input:10, cached:1, write:12.5, output:50, threshold:272000 },
  'gpt-5.6-sol': { input:4, cached:.4, write:5, output:20, threshold:272000 },
  'gpt-5.6-terra': { input:2, cached:.2, write:2.5, output:12, threshold:272000 },
  'gpt-5.6-luna': { input:.2, cached:.02, write:.25, output:1.2, threshold:272000 },
  'gpt-5.4': { input:2.5, cached:.25, output:15, threshold:272000 },
  'gpt-5-mini': { input:.25, cached:.025, output:2 },
  'text-embedding-3-small': { input:.02, output:0 },
  'text-embedding-3-large': { input:.13, output:0 },
  'claude-sonnet-4-5': { input:3, cached:.3, write:3.75, output:15, threshold:200000 }
}
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
export function normalizeCallUsage(raw, provider='openai', operation='generation') {
  if (!raw) return { usageStatus:'unavailable', inputTokens:null, outputTokens:null, totalTokens:null }
  let input = count(raw.input_tokens ?? raw.prompt_tokens ?? raw.inputTokens)
  const output = count(raw.output_tokens ?? raw.completion_tokens ?? raw.outputTokens ?? (operation==='embeddings' ? 0 : undefined))
  const inputDetails=raw.input_tokens_details || raw.prompt_tokens_details || {}
  const outputDetails=raw.output_tokens_details || raw.completion_tokens_details || {}
  const cached = count(raw.cache_read_input_tokens ?? inputDetails.cached_tokens ?? raw.cachedInputTokens)
  const write = count(raw.cache_creation_input_tokens ?? inputDetails.cache_write_tokens ?? raw.cacheWriteInputTokens)
  // Anthropic's base input excludes cache reads/writes; OpenAI input includes them.
  if(provider==='anthropic' && input!==null) input+=(cached || 0)+(write || 0)
  return { usageStatus:input===null || output===null?'unavailable':raw.estimated?'estimated':'reported', inputTokens:input, outputTokens:output,
    totalTokens:input!==null && output!==null?input+output:null,
    cachedInputTokens:cached, cacheWriteInputTokens:write,
    reasoningTokens:count(outputDetails.reasoning_tokens ?? raw.reasoningTokens),
    audioInputTokens:count(inputDetails.audio_tokens), audioOutputTokens:count(outputDetails.audio_tokens),
    acceptedPredictionTokens:count(outputDetails.accepted_prediction_tokens), rejectedPredictionTokens:count(outputDetails.rejected_prediction_tokens) }
}
export function callCost(model, usage, {provider='openai', serviceTier='default', firstParty=true}={}) {
  const price=prices[model] || prices[model?.replace(/-\d{4}-\d{2}-\d{2}$/, '')]
  const unknown={ estimatedCostUsd:null, pricingVersion:null }
  if(!firstParty || !price || usage.usageStatus!=='reported' || !['default','standard','auto',null].includes(serviceTier)) return unknown
  const input=usage.inputTokens, output=usage.outputTokens, read=usage.cachedInputTokens || 0, write=usage.cacheWriteInputTokens || 0
  if(read+write>input || (write && !price.write))return unknown
  // New cache-write models must report the write split to calculate a price.
  if(price.write && provider==='openai' && usage.cacheWriteInputTokens===null)return unknown
  const long=price.threshold && input>price.threshold
  const inputCost=((input-read-write)*price.input+read*(price.cached ?? price.input)+write*(price.write || price.input))*(long?2:1)
  return {estimatedCostUsd:(inputCost+output*price.output*(long?1.5:1))/1e6,pricingVersion:`2026-09-14:${provider}:standard`}
}
export const metricKeys=['calls','inputTokens','outputTokens','totalTokens','cachedInputTokens','cacheWriteInputTokens','reasoningTokens','estimatedCostUsd','unknownUsageCalls','unpricedCalls','failedCalls','durationMs']
export function emptyMetrics() { return Object.fromEntries(metricKeys.map(key=>[key,0])) }
export function eventMetrics(event) {
  return {...emptyMetrics(),...Object.fromEntries(metricKeys.filter(k=>k in event).map(k=>[k,event[k] || 0])),calls:1,
    unknownUsageCalls:event.usageStatus==='unavailable'?1:0,unpricedCalls:event.estimatedCostUsd===null?1:0,
    failedCalls:['failed','aborted','incomplete'].includes(event.status)?1:0}
}
export const dimensions=['day','userId','feature','model','payer','phase','status']
export function aggregateCallEvents(events) {
  const groups=new Map()
  for(const event of events) for(const dimension of ['total',...dimensions]) {
    const key=dimension==='total'?'all':dimension==='day'?event.createdAt.slice(0,10):event[dimension] || 'unclassified'
    const id=JSON.stringify([dimension,key]);const row=groups.get(id) || {dimension,key,...emptyMetrics()};const metrics=eventMetrics(event)
    for(const field of metricKeys)row[field]+=metrics[field]
    groups.set(id,row)
  }
  return [...groups.values()]
}
export function usageReport(rows, recent, filters) {
  const groups=Object.fromEntries(dimensions.map(d=>[d,rows.filter(r=>r.dimension===d).sort((a,b)=>d==='day'?a.key.localeCompare(b.key):b.estimatedCostUsd-a.estimatedCostUsd || b.totalTokens-a.totalTokens).slice(0,d==='day'?93:100)]))
  const byDay=new Map(groups.day.map(r=>[r.key,r]))
  groups.day=[]
  for(let time=Date.parse(filters.from.slice(0,10)+'T00:00:00.000Z');time<=Date.parse(filters.to);time+=86400000){const key=new Date(time).toISOString().slice(0,10);groups.day.push(byDay.get(key)||{key,...emptyMetrics()})}
  return {filters,totals:rows.find(r=>r.dimension==='total') || emptyMetrics(),groups,recent,generatedAt:new Date().toISOString(),costNote:'Estimated token cost, not an invoice. Unknown usage/pricing is excluded from cost totals. Cached input and reasoning are subsets, not extra tokens.'}
}
