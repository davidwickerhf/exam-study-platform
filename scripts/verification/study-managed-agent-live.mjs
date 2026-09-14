// Small managed-runtime compatibility/context probe, not a full guide eval.
// No tools, sandbox, production data, or unlimited repair loop. API session usage
// is best effort; this does not claim enforcement of Wicker's guide spending cap.
import OpenAI from 'openai'
import {writeFile} from 'node:fs/promises'
if(!process.env.OPENAI_API_KEY)throw new Error('An existing API key is required.')
const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:120000})
const report={model:process.env.STUDY_PIPELINE_MODEL || 'gpt-5.6-sol',turns:[],passed:false}
let sessionId
async function collect(stream){
  let text=''
  for await(const event of stream){
    sessionId ||= event.session_id || event.session?.id
    if(event.type==='agent.session.turn.output_text.delta')text+=event.delta
    if(event.type==='agent.session.turn.completed'){
      const turn=await client.beta.agents.sessions.turns.retrieve(event.turn_id,{session_id:sessionId})
      return {answer:JSON.parse(text),usage:turn.usage || event.usage || null}
    }
    if(['agent.session.turn.failed','agent.session.turn.cancelled','agent.session.failed','error'].includes(event.type))throw new Error(`Managed agent ended with ${event.type}`)
  }
  throw new Error('Managed agent stream ended without a completed turn.')
}
try{
  const schema={type:'object',properties:{startMs:{type:'number'},ordinaryFlagReleasesWait:{type:'boolean'},explanation:{type:'string'}},required:['startMs','ordinaryFlagReleasesWait','explanation'],additionalProperties:false}
  const stream=await client.beta.agents.sessions.create({agent:{model:report.model,tools:[],reasoning:{effort:'medium'},text:{format:{type:'json_schema',schema}},instructions:'Answer the teaching check using the stated assumptions. Keep the explanation under 100 words.'},environment:{type:'none'},input:'Single-core priority-preemptive system: at t=30 ms a higher-priority logger has 70 ms CPU work remaining. An ISR runs for 8 ms and notifies a lower-priority button task. When can the button task run? Separately, would writing an ordinary flag alone release its indefinite notification wait? Ignore all other overhead and tasks.',stream:true},{signal:AbortSignal.timeout(120000)})
  report.turns.push(await collect(stream))
  const next=await client.beta.agents.sessions.events.stream(sessionId,{signal:AbortSignal.timeout(120000)})
  await client.beta.agents.sessions.events.create(sessionId,{events:[{type:'agent.session.input.message',input:[{role:'user',content:[{type:'input_text',text:'Change only one assumption from the preceding scenario: the button task now has higher priority than the logger. Recalculate; retain the separate ordinary-flag question.'}]}]}]})
  report.turns.push(await collect(next))
  report.passed=report.turns[0].answer.startMs===108 && report.turns[1].answer.startMs===38 && report.turns.every(t=>t.answer.ordinaryFlagReleasesWait===false)
}catch(error){report.error=error.message}
finally{
  if(sessionId){await client.beta.agents.sessions.delete(sessionId);report.sessionDeleted=true}
  await writeFile(process.env.STUDY_AGENT_REPORT || '/tmp/wicker-managed-agent-context.json',JSON.stringify(report,null,2))
}
console.log(JSON.stringify(report,null,2))
if(!report.passed)process.exitCode=1
