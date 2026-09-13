// Focused real-model positive and shallow IoT controls through checkpointed review.
import { writeFile } from 'node:fs/promises'
import { iotPedagogyFixture } from '../../lib/study-pedagogy-fixtures.mjs'
import { evidencePrompt } from '../../lib/study-version-content.mjs'
import { nextPedagogicalReview, acceptPedagogicalReview } from '../../lib/study-pedagogical-review.mjs'
import { pedagogicalEvaluationCheck } from '../../lib/study-evaluation-steps.mjs'
const key=process.env.OPENAI_API_KEY
if(!key)throw new Error('An existing API key is required.')
const report={model:'gpt-5-mini',calls:0,usd:0,checks:[],artifacts:[]}
try {
  for(const shallow of [false,true]) {
    const f=iotPedagogyFixture({shallow}),context=evidencePrompt(f.course,f.sources,f.chunks)
    for(;;){
      const step=nextPedagogicalReview(context,f.chapter);if(!step)break
      if(report.usd+0.04>0.5)throw new Error('IoT evaluation cap reached.')
      console.log(`${shallow?'shallow':'worked'}: ${step.objectiveId}`)
      const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify({model:report.model,max_completion_tokens:step.tokens,reasoning_effort:'medium',messages:[{role:'user',content:step.prompt}],response_format:{type:'json_schema',json_schema:{name:'pedagogy',strict:true,schema:step.responseSchema}}}),signal:AbortSignal.timeout(180000)})
      if(!response.ok)throw new Error(`Provider ${response.status}`)
      const result=await response.json();report.calls++;report.usd+=((result.usage?.prompt_tokens||0)*0.25+(result.usage?.completion_tokens||0)*2)/1000000
      const raw=result.choices[0].message.content
      report.artifacts.push({shallow,objectiveId:step.objectiveId,response:JSON.parse(raw)})
      const aggregate=acceptPedagogicalReview(f.chapter,step,raw)
      if(aggregate)report.checks.push(pedagogicalEvaluationCheck({kind:shallow?'iot-shallow':'iot-teaching',chapter:f.chapter},aggregate))
      await writeFile('/tmp/wicker-iot-v6.json',JSON.stringify(report,null,2))
    }
  }
}catch(error){report.error=error.message}
await writeFile('/tmp/wicker-iot-v6.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({...report,artifacts:undefined},null,2))
if(report.error||report.checks.some(c=>!c.passed))process.exitCode=1
