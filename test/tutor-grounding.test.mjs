import test from 'node:test'
import assert from 'node:assert/strict'
import { createTutorGrounding, selectTutorEvidence, tutorResearchRequirements } from '../lib/tutor-grounding.mjs'
import { createTutorToolRunner, evidenceFromTool, tutorToolResultForModel } from '../lib/tutor-agent.mjs'
import { readCanvasAssignments, readTutorAssignmentDetail } from '../lib/tutor-study-tools.mjs'
import { runToolLoop } from '../lib/model-loop.mjs'

const assignment = { id:'33:44',courseId:'33',canvasId:'44',courseCode:'BCS3300',title:'Review of Example Project Plans',sourceKey:'https://canvas.example/assignments/33:44',dueAt:'2026-09-09T21:59:59Z',unlockAt:null,lockAt:null,description:'Review three project plans.',url:'https://canvas.example/courses/33/assignments/44' }
const answer = evidenceIds => JSON.stringify({summary:'Due tomorrow at 23:59 CEST.',evidenceIds})

test('deadline reply cannot finish after only searching indexed files or old conversations',async()=>{
  const grounding=createTutorGrounding({message:'when is the group 3-1 paper review assignment thing due?'})
  const calls=[], previews=[]
  let round=0
  const output=await runToolLoop({messages:[],tools:[],maxRounds:4,reviewAnswer:grounding.review,onContent:text=>previews.push(text),
    modelCall:async(messages,options)=>{
      assert.equal(typeof options.onContent,'function','provider streaming stays enabled while drafts are withheld')
      options.onContent(answer(['unsupported-draft']))
      assert.equal(previews.length,0,'rejected drafts must not stream to the student')
      round++
      if(round===1)return {message:{content:answer([])}}
      if(round===2){assert.match(messages.at(-1).content,/get_canvas_assignments/);return {message:{tool_calls:[{id:'a',function:{name:'get_canvas_assignments',arguments:'{"courseCode":"BCS3300"}'}}]}}}
      return {message:{content:answer([`assignment:${assignment.sourceKey}`])}}
    },runTool:async(name,args)=>{calls.push({name,args});return {assignments:[assignment]}},
    onToolCall:(name,args,result)=>grounding.record(name,result,evidenceFromTool(name,result)),toolResultForModel:tutorToolResultForModel})
  assert.equal(calls[0].name,'get_canvas_assignments')
  assert.equal(previews.length,1)
  assert.equal(output.added.filter(item=>item.role==='assistant'&&!item.tool_calls).length,1)
})

test('representative preparation checks full announcements and schedule, rather than generic attendance alone',()=>{
  const g=createTutorGrounding({message:'tomorrow we have a meeting related to the project. two of my teammates are going. Do they need to prepare anything in advance?'})
  g.record('get_course_obligations',{})
  assert.match(g.review(answer([])),/get_announcements/)
  g.record('get_announcements',{})
  assert.match(g.review(answer([])),/get_schedule/)
  g.record('get_schedule',{})
  assert.equal(g.review(answer([])),null)
  assert.deepEqual(tutorResearchRequirements('Explain the XOR function'),[])
  assert.deepEqual(tutorResearchRequirements('so its for tomorrow night',[{role:'user',content:'when is the paper review due?'}]),[])
})

test('bounded source-check failure never publishes an unsupported final answer',async()=>{
  const g=createTutorGrounding({message:'When is the assignment due?'})
  const previews=[]
  await assert.rejects(runToolLoop({messages:[],maxRounds:1,tools:[],reviewAnswer:g.review,onContent:x=>previews.push(x),modelCall:async()=>({message:{content:answer([])}})}),/could not verify/)
  assert.deepEqual(previews,[])
})

test('source outages permit an explicit coverage-gap answer without inventing citations',()=>{
  const g=createTutorGrounding({message:'When is the assignment due?'})
  g.record('get_canvas_assignments',{error:'Canvas not connected'})
  assert.equal(g.review(JSON.stringify({summary:'Canvas could not be read, so I cannot verify the deadline.',evidenceIds:[]})),null)
})

test('past tutor answers and unrelated first results cannot crowd out the selected source',()=>{
  const old=Array.from({length:12},(_,i)=>({id:`chat:${i}`,sourceType:'Past conversation'}))
  const fresh=evidenceFromTool('get_canvas_assignments',{assignments:[assignment]})
  assert.deepEqual(selectTutorEvidence([...old,{id:'unrelated',sourceType:'Timetable'},...fresh],[old[0].id,fresh[0].id,'invented']),fresh)
  assert.deepEqual(evidenceFromTool('search_conversation_history',{evidence:old}),[])
  const g=createTutorGrounding({message:'Explain this assignment'})
  g.record('search_conversation_history',{},old)
  assert.match(g.review(answer([old[0].id])),/Past conversation/)
  g.record('get_canvas_assignments',{},fresh)
  assert.equal(g.review(answer([fresh[0].id])),null)
})

test('assignment evidence retains deadline versus closure and is available to the model',()=>{
  const result=tutorToolResultForModel('get_canvas_assignments',{assignments:[assignment]})
  assert.match(result.evidence[0].excerpt,/Due: 2026-09-09T21:59:59Z/)
  assert.match(result.evidence[0].excerpt,/Closes: not recorded/)
  assert.equal(result.evidence[0].course,'BCS3300')
})

test('full assignment lookup uses only this account’s observed source keys and preserves the full brief',async()=>{
  let requests=0
  const deps={accessToken:async({canvasUrl})=>{assert.equal(canvasUrl,'https://canvas.example');return {token:'test'}},readDetail:async args=>{
    requests++;assert.equal(args.courseId,'33');assert.equal(args.assignmentId,'44')
    return {assignment:{dueAt:assignment.dueAt,lockAt:null,descriptionHtml:'<p>Before class, read the examples.</p>',rubric:[{description:'Review three plans'}]}}
  }}
  await assert.rejects(readTutorAssignmentDetail('https://attacker.example/assignments/33:44',{},deps),/get_canvas_assignments first/)
  assert.equal(requests,0)
  const result=await readTutorAssignmentDetail(assignment.sourceKey,{assignments:new Map([[assignment.sourceKey,assignment]])},deps)
  assert.match(result.assignment.descriptionHtml,/Before class/)
  assert.equal(result.assignment.lockAt,null)
  assert.equal(result.assignment.courseCode,'BCS3300')
  assert.match(result.note,/null lockAt does not establish a late policy/)
})


test('course-scoped assignment discovery normalizes Canvas edition labels and fetches only matching courses',async()=>{
  const requested=[]
  const result=await readCanvasAssignments({courseCode:'BCS3300'},{connectionsForUser:async()=>[{origin:'https://canvas.example'}],accessToken:async()=>({token:'test'}),readHub:async args=>{
    requested.push(args)
    if(!args.parts.length)return {courses:[{id:'33',courseCode:'2026-2027-100-BCS3300'},{id:'99',courseCode:'BCS3120'}]}
    return {assignments:[{...assignment,courseCode:'2026-2027-100-BCS3300'}],problems:[]}
  }})
  assert.deepEqual(requested[1].courseIds,['33'])
  assert.equal(result.assignments[0].courseCode,'BCS3300')
  assert.equal(result.assignments[0].dueAt,assignment.dueAt)
  assert.equal(result.omitted,0)
})


test('an early detail lookup can recover after discovery rather than reusing its cached error',async()=>{
  let discovered=false, attempts=0
  const read=createTutorToolRunner({},async name=>{
    if(name==='get_canvas_assignments'){discovered=true;return {assignments:[assignment]}}
    attempts++
    return discovered ? {assignment} : {error:'Call get_canvas_assignments first.'}
  })
  assert.ok((await read('get_canvas_assignment_detail',{sourceKey:assignment.sourceKey})).error)
  await read('get_canvas_assignments',{courseCode:'BCS3300'})
  assert.equal((await read('get_canvas_assignment_detail',{sourceKey:assignment.sourceKey})).assignment.id,assignment.id)
  await read('get_canvas_assignment_detail',{sourceKey:assignment.sourceKey})
  assert.equal(attempts,2,'successful reads are still reused')
})

test('live citation contract changes after research and never advertises past-chat IDs', async () => {
  const { TUTOR_RESPONSE_FORMAT } = await import('../lib/tutor-response.mjs')
  const g=createTutorGrounding({message:'What must I do tomorrow?'})
  const before=g.responseFormat(TUTOR_RESPONSE_FORMAT)
  assert.equal(before.json_schema.schema.properties.evidenceIds.maxItems,0)
  const briefing={teaching:[{when:'2026-09-10',time:'08:30',course:'BCS3120',title:'Ubiquitous Computing',activity:'Lecture',room:'Room A'}],courseObligations:[{id:'step:project:1',title:'Discuss project idea',courseCode:'BCS3120',dueAt:'2026-09-10',detail:'Bring the one-page idea.'}],recentRuleAnnouncements:[{title:'Project ideas',course:'BCS3120',excerpt:'Discuss your idea tomorrow.',url:'https://canvas.example/announcement/1'}]}
  const result=tutorToolResultForModel('get_briefing',briefing)
  assert.equal(result.evidence.length,3,'every briefing source family can be cited')
  g.record('get_briefing',briefing,result.evidence)
  g.record('search_conversation_history',{},[{id:'chat:old',sourceType:'Past conversation'}])
  const ids=g.responseFormat(TUTOR_RESPONSE_FORMAT).json_schema.schema.properties.evidenceIds.items.enum
  assert.deepEqual(new Set(ids),new Set(result.evidence.map(item=>item.id)))
  assert.equal(g.review(answer(ids)),null)
  assert.equal(TUTOR_RESPONSE_FORMAT.json_schema.schema.properties.evidenceIds.items.enum,undefined,'shared schema remains unchanged')
})

test('repeated rejected drafts stop after one repair, with the rejected draft available only to the model',async()=>{
  let requests=0
  const emitted=[]
  await assert.rejects(runToolLoop({messages:[],maxRounds:5,tools:[],reviewAnswer:()=> 'Correct the citation.',onContent:text=>emitted.push(text),modelCall:async(messages,options)=>{
    requests++
    options.onContent('Unverified text')
    if(requests===2)assert.equal(messages.at(-2).content,'Rejected draft')
    return {message:{content:'Rejected draft'},finishReason:'stop'}
  }}),e=>e.failure.code==='evidence_check')
  assert.equal(requests,2,'do not spend five more full generations on the same failure')
  assert.deepEqual(emitted,[])
})

test('each model request receives the current evidence schema, including the final fallback',async()=>{
  const formats=[]
  let researched=false
  await runToolLoop({messages:[],tools:[],maxRounds:1,responseFormat:()=>({phase:researched?'after':'before'}),runTool:async()=>{researched=true;return {}},modelCall:async(_,options)=>{
    formats.push(options.responseFormat.phase)
    return {message:researched?{content:'Answer'}:{tool_calls:[{id:'a',function:{name:'get_briefing',arguments:'{}'}}]}}
  }})
  assert.deepEqual(formats,['before','after'])
})

test('oversized briefings keep citation IDs instead of cutting off the evidence table',async()=>{
  const {serializeToolResult}=await import('../lib/model-loop.mjs')
  const source={id:'priority:assignment:44',title:'Individual review',course:'BCS3300',sourceType:'Canvas assignment',excerpt:'Due 9 September at 23:59.'}
  const raw={courseObligations:Array.from({length:74},()=>({detail:'"Review" \\ project notes '.repeat(80)})),evidence:[source]}
  assert.ok(JSON.stringify(raw).length>60_000)
  const serialized=serializeToolResult(raw)
  assert.ok(serialized.length<=60_000)
  const model=JSON.parse(serialized)
  assert.equal(model.truncated,true)
  assert.equal(model.evidence[0].id,source.id)
  assert.equal(model.evidence[0].excerpt,source.excerpt)
  assert.equal(model.omittedEvidence,0)
})
