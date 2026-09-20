import OpenAI from 'openai'
import { Agent, Runner, OpenAIResponsesModel } from '@openai/agents'
import { providerFetch } from './provider-fetch.mjs'
import { StudyVersionError } from './study-version-content.mjs'
import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { studyProviderError, providerErrorCode } from './study-provider-errors.mjs'

// One paid request per checkpoint. The durable pipeline, not SDK-internal
// retries or a shared session, owns recovery and independent review contexts.
export async function runStudyAgentsSdk(prompt, {apiKey,baseUrl='https://api.openai.com/v1',model,
  responseSchema,maxOutputTokens,providerTimeoutMs=600000,callDeadlineMs=generationLimits.callDeadlineMs,reasoningEffort='medium',signal}={}) {
  if(!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens<1)throw new Error('A finite output cap is required.')
  if(!Number.isFinite(callDeadlineMs) || callDeadlineMs<=0)throw new Error('A finite per-call deadline is required.')
  let rawUsage=null,responseId=null,incompleteReason=null,requestId=null
  // A bounded deadline for the whole checkpoint, not just the HTTP exchange:
  // the transport, the SDK's own parsing and any body still streaming are all
  // cut off by this one explicit abort. Held by the timer closure so it cannot
  // be collected while a stalled call keeps its reservation alive.
  const deadline=new AbortController()
  const expire=setTimeout(()=>deadline.abort(new DOMException(`This AI call exceeded its ${callDeadlineMs}ms deadline.`,'TimeoutError')),callDeadlineMs)
  expire.unref?.()
  const runSignal=signal?AbortSignal.any([signal,deadline.signal]):deadline.signal
  const client=new OpenAI({apiKey,baseURL:baseUrl,maxRetries:0,timeout:providerTimeoutMs,
    fetch:async(url,options)=>{
      const requestSignal=options?.signal?AbortSignal.any([options.signal,deadline.signal]):deadline.signal
      const response=await providerFetch(url,{...options,signal:requestSignal},providerTimeoutMs)
      const header=response.headers.get('x-request-id')
      if(/^req_[a-zA-Z0-9_-]{1,200}$/.test(header || ''))requestId=header
      if(!response.ok)throw await studyProviderError(response)
      // Keep provider usage even when SDK parsing rejects an incomplete result.
      const data=await response.clone().json()
      rawUsage=data.usage;responseId=data.id;incompleteReason=data.incomplete_details?.reason
      return response
    }})
  const usage=()=>rawUsage && Number.isSafeInteger(rawUsage.input_tokens) && rawUsage.input_tokens>=0 && Number.isSafeInteger(rawUsage.output_tokens) && rawUsage.output_tokens>=0 ? {
    inputTokens:rawUsage.input_tokens,outputTokens:rawUsage.output_tokens,estimated:false,
    cachedInputTokens:rawUsage.input_tokens_details?.cached_tokens || 0,
    ...(Number.isSafeInteger(rawUsage.input_tokens_details?.cache_write_tokens)
      ? {cacheWriteInputTokens:rawUsage.input_tokens_details.cache_write_tokens}:{}),
    ...(Number.isSafeInteger(rawUsage.output_tokens_details?.reasoning_tokens)
      ? {reasoningTokens:rawUsage.output_tokens_details.reasoning_tokens}:{}),
    responseId,runtime:'agents-sdk-responses'
  }:null
  const agent=new Agent({name:'Wicker study checkpoint',model:new OpenAIResponsesModel(client,model),
    instructions:'Use the supplied evidence and instructions. Return the requested structured result.',
    // These single-message checkpoints have changing strict schemas/payloads.
    // Implicit end-of-message cache writes rarely match the next checkpoint.
    // Explicit mode without breakpoints avoids writing single-use input (5.6+).
    modelSettings:{maxTokens:maxOutputTokens,reasoning:{effort:reasoningEffort},store:false,
      ...(/^gpt-(?:6(?:[.-]|$)|5\.6(?:[.-]|$))/.test(model)?{promptCacheOptions:{mode:'explicit',ttl:'30m'}}:{})},
    ...(responseSchema?{outputType:{type:'json_schema',name:'wicker_output',strict:true,schema:responseSchema}}:{})})
  try {
    const result=await new Runner({tracingDisabled:true}).run(agent,prompt,{maxTurns:1,signal:runSignal})
    if(!usage())throw new Error('The AI service did not return usage; the full reservation remains charged.')
    return {text:typeof result.finalOutput==='string'?result.finalOutput:JSON.stringify(result.finalOutput),usage:usage()}
  } catch(error) {
    // Classification is a diagnostic: it may never replace the provider failure
    // it is describing. Anything unexpected here re-throws the original error
    // with whatever usage and request id we did observe.
    let classified=null
    try { classified=classifyAgentFailure(error,{usage:usage(),requestId,responseId,incompleteReason,deadline,callDeadlineMs,callerAborted:signal?.aborted===true}) }
    catch { classified=null }
    if(classified)throw classified
    if(usage())error.usage=usage()
    if(requestId && !error.providerRequestId)error.providerRequestId=requestId
    throw error
  } finally {
    clearTimeout(expire)
  }
}

function classifyAgentFailure(error,{usage,requestId,responseId,incompleteReason,deadline,callDeadlineMs,callerAborted}) {
  // Our own deadline fired: settle exactly like any other unknown-usage
  // failure. Measured usage is attached when the provider did report it;
  // otherwise usage stays null and the full reservation is retained. An
  // abandoned call is never treated as free.
  if(deadline.signal.aborted && !callerAborted) {
    const expired=new StudyVersionError(`The AI service did not finish this step within its ${Math.round(callDeadlineMs/1000)}s allowance. The abandoned call remains charged at its reservation; finished work is saved. Retry the unfinished step.`,504)
    expired.name='TimeoutError'
    expired.code='provider_timeout'
    expired.retryable=true
    expired.retryAfter=10
    if(usage)expired.usage=usage
    if(requestId)expired.providerRequestId=requestId
    return expired
  }
  if(responseId && !usage){
    const missing=new Error('The AI service did not return valid input and output token counts; the full reservation remains held.')
    missing.code='provider_missing_usage'
    if(requestId)missing.providerRequestId=requestId
    return missing
  }
  if(incompleteReason==='max_output_tokens') {
    const limited=new StudyVersionError('The AI reached this step’s output limit before finishing. Completed work is saved; reduce the review batch or revise the generation limits before retrying.',502)
    limited.code='provider_output_limit';limited.usage=usage
    if(requestId)limited.providerRequestId=requestId
    return limited
  }
  // The OpenAI client wraps fetch errors; preserve our sanitized classification.
  // `cause.code` is not necessarily a string (a DOMException carries a numeric
  // legacy code), so it is matched by value, never by calling into it.
  if(providerErrorCode(error.cause)) {
    error.cause.usage=usage
    if(requestId && !error.cause.providerRequestId)error.cause.providerRequestId=requestId
    return error.cause
  }
  return null
}
