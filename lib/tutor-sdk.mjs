// The Agents SDK owns tool dispatch and continuation. The provider adapter keeps
// Wicker's existing provider configuration, billing and streaming transport; the
// persistent conversation remains in our account/programme-scoped store.
import { Agent, Runner, tool, Usage } from '@openai/agents'
import { callModel, abortable, serializeToolResult, ModelError } from './model-loop.mjs'
import { tutorFailure } from './tutor-errors.mjs'

const tokens = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0
const evidenceError = () => new ModelError('Tutor could not verify the sources needed for this answer. Please retry your question.', 502, tutorFailure({code:'evidence_check'}))

export function tutorSdkInput(messages) {
  return messages.flatMap(message => {
    if (message.role === 'tool') return [{type:'function_call_result',callId:message.tool_call_id,name:message.name,output:message.content || '',status:'completed'}]
    if (message.role === 'assistant') return [
      ...(message.content ? [{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:message.content}]}] : []),
      ...(message.tool_calls || []).map(call => ({type:'function_call',callId:call.id,name:call.function.name,arguments:call.function.arguments,status:'completed'}))
    ]
    return [{role:message.role,content:message.content || ''}]
  })
}

export async function runTutorSdk({messages,tools=[],runTool,maxRounds=5,maxOutputTokens=8192,
  onToolCall=()=>{},onModelStart=()=>{},onContent,signal,reasoningEffort=null,
  toolResultForModel=(_name,result)=>result,modelCall=callModel,responseFormat=null,
  reviewAnswer=null,requiredTools=()=>[],maxAnswerRepairs=1,onDiagnostic=()=>{}}={}) {
  const added=[]
  // Canonical legacy messages preserve existing saved conversations and prompt
  // cache prefixes. SDK input carries the same transcript for its run lifecycle.
  const transcript=messages.map(message=>({...message}))
  let usage=null, requests=0, exhausted=false, finishNext=false, toolQueue=Promise.resolve()
  let allowedCalls=new Set()
  const remember=message=>{transcript.push(message);added.push({...message,at:new Date().toISOString()})}
  const definitions=tools.map(definition=>tool({
    name:definition.function.name,description:definition.function.description,
    parameters:definition.function.parameters,strict:false,errorFunction:null,
    execute(args,_context,details) {
      // Source reads and proposal preparation keep deterministic order. The
      // existing tool runner still deduplicates reads and stages approvals.
      const pending=toolQueue.then(async()=>{
        signal?.throwIfAborted()
        const callId=details?.toolCall?.callId
        if (!allowedCalls.delete(callId)) throw new ModelError('Tutor returned an unexpected tool call.')
        const name=definition.function.name
        const result=await abortable(()=>runTool(name,args),signal)
        signal?.throwIfAborted()
        onToolCall(name,args,result)
        const content=serializeToolResult(toolResultForModel(name,result))
        remember({role:'tool',tool_call_id:callId,name,content})
        return content
      })
      toolQueue=pending.catch(()=>{})
      return pending
    }
  }))
  const model={
    async getResponse() {
      signal?.throwIfAborted()
      if(requests>=maxRounds+2) throw new ModelError('Tutor reached its bounded request limit. Please retry your question.')
      const final=finishNext || requests>=maxRounds
      if(final) {
        exhausted=true
        transcript.push({role:'system',content:'Finish this turn using the evidence already returned. State specific gaps. Do not invent missing facts or claim that proposed actions were applied. No more tools are available.'})
      }
      const required=new Set(requiredTools())
      const pending=tools.filter(item=>required.has(item.function.name))
      const available=final?[]:pending.length?pending:tools
      const format=typeof responseFormat==='function'?responseFormat():responseFormat
      onModelStart()
      const started=Date.now()
      requests++
      const result=await abortable(()=>modelCall(transcript,{usageFeature:'tutor',tools:available,toolChoice:pending.length&&!final?'required':'auto',
        maxOutputTokens:final?Math.min(16384,Math.max(8192,maxOutputTokens*2)):maxOutputTokens,
        signal,reasoningEffort,onContent:()=>{},...(format?{responseFormat:format}:{})}),signal)
      onDiagnostic({stage:'model',harness:'openai-agents-sdk',request:requests,elapsedMs:Date.now()-started,finishReason:result.finishReason||null})
      if(result.usage) {
        usage ||= {prompt_tokens:0,completion_tokens:0,total_tokens:0}
        for(const key of ['prompt_tokens','completion_tokens','total_tokens'])usage[key]+=tokens(result.usage[key])
        if(result.usage.prompt_tokens_details) {
          usage.prompt_tokens_details ||= {cached_tokens:0}
          usage.prompt_tokens_details.cached_tokens+=Math.min(tokens(result.usage.prompt_tokens_details.cached_tokens),tokens(result.usage.prompt_tokens))
        }
      }
      const message=result.message, calls=message.tool_calls||[]
      if(calls.length && (final || result.finishReason==='length'))throw new ModelError('Tutor could not finish reading the sources. Please retry your question.')
      const output=[]
      if(calls.length) {
        const permitted=new Set(available.map(item=>item.function.name))
        if(calls.some(call=>!call.id || !permitted.has(call.function?.name)) || new Set(calls.map(call=>call.id)).size!==calls.length)throw new ModelError('Tutor returned an unexpected tool call.')
        allowedCalls=new Set(calls.map(call=>call.id))
        remember({role:'assistant',content:message.content||'',tool_calls:calls})
        output.push(...calls.map(call=>({type:'function_call',callId:call.id,name:call.function.name,arguments:call.function.arguments,status:'completed'})))
      } else {
        finishNext=!String(message.content||'').trim() || result.finishReason==='length'
        output.push({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:finishNext?'':message.content}]})
      }
      return {output,usage:new Usage({requests:1,inputTokens:tokens(result.usage?.prompt_tokens),outputTokens:tokens(result.usage?.completion_tokens),totalTokens:tokens(result.usage?.total_tokens)})}
    },
    async *getStreamedResponse(){throw new Error('Use the billed streaming transport through a non-streaming SDK run.')}
  }
  const agent=new Agent({name:'Wicker Tutor',model,tools:definitions})
  // Student conversations never enter automatic external tracing. Provider calls
  // still stream through the existing transport; only grounded answers reach UI.
  const runner=new Runner({tracingDisabled:true,modelSettings:{parallelToolCalls:false}})
  let repairs=0
  for(;;) {
    const result=await runner.run(agent,tutorSdkInput(transcript),{signal,maxTurns:maxRounds+3})
    const answer=String(result.finalOutput||'')
    if(!answer.trim()) {
      if(exhausted)throw new ModelError('Tutor checked your sources but could not finish an answer. Please retry your question.')
      finishNext=true
      continue
    }
    const correction=reviewAnswer?.(answer)
    if(correction) {
      onDiagnostic({stage:'answer-review',request:requests,repair:repairs+1})
      if(repairs++>=maxAnswerRepairs)throw evidenceError()
      transcript.push({role:'assistant',content:answer},{role:'system',content:correction})
      continue
    }
    onContent?.(answer)
    remember({role:'assistant',content:answer})
    return {added,usage,exhausted}
  }
}
