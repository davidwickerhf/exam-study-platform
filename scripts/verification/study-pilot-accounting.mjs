import {studyModelCost} from '../../lib/study-ai-budget.mjs'
export function pilotAccounting(report) {
 let knownUsageUsd=0,measuredCalls=0
 const phases={}
 for(const call of report.callDetails||[]){
  const usage=call.usage
  if(!usage)continue
  const inputTokens=usage.inputTokens??usage.prompt_tokens,outputTokens=usage.outputTokens??usage.completion_tokens
  if(!Number.isFinite(inputTokens)||!Number.isFinite(outputTokens))continue
  const normalized={...usage,cachedInputTokens:usage.cachedInputTokens??usage.prompt_tokens_details?.cached_tokens,cacheWriteInputTokens:usage.cacheWriteInputTokens??usage.prompt_tokens_details?.cache_write_tokens}
  const usd=studyModelCost(report.model,inputTokens,outputTokens,normalized)/1000000
  knownUsageUsd+=usd;measuredCalls++
  const phase=call.experimentPhase||'initial'
  phases[phase]||={knownUsageUsd:0,inputTokens:0,outputTokens:0,calls:0}
  phases[phase].knownUsageUsd+=usd;phases[phase].inputTokens+=inputTokens;phases[phase].outputTokens+=outputTokens;phases[phase].calls++
 }
 return {knownUsageUsd,unsettledReservationUsd:Math.max(0,(report.calculatedUsd||0)-knownUsageUsd),measuredCalls,unknownUsageCalls:Math.max(0,(report.calls||0)-measuredCalls),phases}
}
