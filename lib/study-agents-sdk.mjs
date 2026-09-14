import OpenAI from 'openai'
import { Agent, Runner, OpenAIResponsesModel } from '@openai/agents'
import { providerFetch } from './provider-fetch.mjs'
import { StudyVersionError } from './study-version-content.mjs'
import { studyProviderError } from './study-provider-errors.mjs'

// One paid request per checkpoint. The durable pipeline, not SDK-internal
// retries or a shared session, owns recovery and independent review contexts.
export async function runStudyAgentsSdk(prompt, {apiKey,baseUrl='https://api.openai.com/v1',model,
  responseSchema,maxOutputTokens,providerTimeoutMs=600000,reasoningEffort='medium',signal}={}) {
  if(!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens<1)throw new Error('A finite output cap is required.')
  let rawUsage=null,responseId=null,incompleteReason=null
  const client=new OpenAI({apiKey,baseURL:baseUrl,maxRetries:0,timeout:providerTimeoutMs,
    fetch:async(url,options)=>{
      const response=await providerFetch(url,options,providerTimeoutMs)
      if(!response.ok)throw await studyProviderError(response)
      // Keep provider usage even when SDK parsing rejects an incomplete result.
      const data=await response.clone().json()
      rawUsage=data.usage;responseId=data.id;incompleteReason=data.incomplete_details?.reason
      return response
    }})
  const usage=()=>rawUsage ? {
    inputTokens:rawUsage.input_tokens,outputTokens:rawUsage.output_tokens,estimated:false,
    cachedInputTokens:rawUsage.input_tokens_details?.cached_tokens || 0,
    ...(Number.isSafeInteger(rawUsage.input_tokens_details?.cache_write_tokens)
      ? {cacheWriteInputTokens:rawUsage.input_tokens_details.cache_write_tokens}:{}),
    responseId,runtime:'agents-sdk-responses'
  }:null
  const agent=new Agent({name:'Wicker study checkpoint',model:new OpenAIResponsesModel(client,model),
    instructions:'Use the supplied evidence and instructions. Return the requested structured result.',
    modelSettings:{maxTokens:maxOutputTokens,reasoning:{effort:reasoningEffort},store:false},
    ...(responseSchema?{outputType:{type:'json_schema',name:'wicker_output',strict:true,schema:responseSchema}}:{})})
  try {
    const result=await new Runner({tracingDisabled:true}).run(agent,prompt,{maxTurns:1,signal})
    if(!usage())throw new Error('The AI service did not return usage; the full reservation remains charged.')
    return {text:typeof result.finalOutput==='string'?result.finalOutput:JSON.stringify(result.finalOutput),usage:usage()}
  } catch(error) {
    if(incompleteReason==='max_output_tokens') {
      const limited=new StudyVersionError('The AI reached this step’s output limit before finishing. Completed work is saved; reduce the review batch or revise the generation limits before retrying.',502)
      limited.code='provider_output_limit';limited.usage=usage();throw limited
    }
    if(usage())error.usage=usage()
    // The OpenAI client wraps fetch errors; preserve our sanitized classification.
    if(error.cause?.code?.startsWith('provider_')) {
      error.cause.usage=usage();throw error.cause
    }
    throw error
  }
}
