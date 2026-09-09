// Opt-in model regression: uses the configured provider with synthetic course
// fixtures. No real student records, Canvas writes, or proposals are persisted.
import assert from 'node:assert/strict'
import { runToolLoop, llmSettings } from '../../lib/model-loop.mjs'
import { TUTOR_TOOLS, tutorStableSystemPrompt, tutorTurnContextPrompt, evidenceFromTool, tutorToolResultForModel } from '../../lib/tutor-agent.mjs'
import { TUTOR_RESPONSE_FORMAT, parseTutorResponse } from '../../lib/tutor-response.mjs'
import { createTutorGrounding } from '../../lib/tutor-grounding.mjs'

const code='BCS3300'
const assignment={id:'33:44',canvasId:'44',courseId:'33',courseCode:code,title:'Review of Example Project Plans',sourceKey:'https://canvas.example/assignments/33:44',dueAt:'2026-09-09T21:59:59Z',unlockAt:null,lockAt:null,url:'https://canvas.example/courses/33/assignments/44',description:'Individually review three example project plans. See the assignment brief.'}
const announcement={id:'announcement:skill',course:code,title:'Skill Class Project Plan Writing - Intro and first assignment',postedAt:'2026-09-02T12:00:38Z',author:'Course team',text:'The skills training consists of four parts: an individual assignment in which you review three project plans; an onsite class attended by two representatives of your group; a group-internal meeting facilitated by the two representatives who explain what they have learned; a group assignment reviewing the current status of the project plan. You pass if you individually review the three plans reasonably, your group attends the onsite class with two representatives (you might want to plan a backup), AND your group reviews your project plan reasonably. The individual assignment deadline is already next week. The assignment description contains all details and instructions.',url:'https://canvas.example/courses/33/announcements/1'}
const announcementEvidence={id:announcement.id,sourceType:'Canvas announcement',title:announcement.title,course:code,excerpt:announcement.text,url:announcement.url}
const cases=[
  {name:'tomorrow-priorities-completes',message:'aight tomorrow I am lazy, what do I have to do',check(a,calls){assert.ok(calls.includes('get_briefing'));assert.ok(a.summary.length>0);assert.ok(a.evidenceIds.length>0);assert.ok(a.evidenceIds.length<=10)}},
  {name:'oversized-priorities-completes',oversized:true,message:'aight tomorrow I am lazy, what do I have to do',check(a,calls){assert.ok(calls.includes('get_briefing'));assert.ok(a.summary.length>0);assert.ok(a.evidenceIds.length>0)}},
  {name:'assignment-deadline',message:'when is the group 3-1 paper review assignment thing due?',check(a,calls){assert.ok(calls.includes('get_canvas_assignments'));assert.match(a.summary,/9\s*(?:Sep|September)|tomorrow/i);assert.match(a.summary,/23:59/);assert.doesNotMatch(a.summary,/submissions? close|no later submissions|approval/i)}},
  {name:'two-representative-skill-class',message:'tomorrow we have a meeting related to the project. two of my teammates are going. Do they need to prepare anything in advance?',check(a,calls){assert.ok(calls.includes('get_announcements'));assert.ok(calls.includes('get_schedule'));assert.match(a.summary,/skills?[-\s]*class|onsite class|skills training/i);assert.equal(a.priorities.length,0);assert.ok(!calls.some(name=>name.startsWith('propose_')));assert.doesNotMatch(a.summary,/(?:must|need to|required to) (?:bring|prepare) (?:a |the |your )?(?:one.page|status|draft|completed)/i)}},
  {name:'later-deadline-does-not-cancel-prereading',message:'but bringing the results of the individual review doesnt make sense, its due AFTER the skill class',history:[{role:'user',content:'Do the two reps need to prepare anything before the skill class?'},{role:'assistant',content:'Bring completed individual reviews.'}],preparation:'Before the onsite skill class, the two representatives must read the three example project plans. Completed written reviews are submitted by the individual deadline, not brought to class.',check(a,calls){assert.ok(calls.includes('get_canvas_assignment_detail'));assert.match(a.summary,/read|reading/i);assert.match(a.summary,/before|advance/i);assert.equal(a.priorities.length,0);assert.doesNotMatch(a.summary,/no preparation|do not need to prepare/i)}},
  {name:'narrow-date-confirmation',message:'so its for tomorrow night',history:[{role:'user',content:'When is the individual review assignment due?'},{role:'assistant',content:'Canvas shows 9 September 2026 at 23:59:59 CEST.'}],check(a){assert.match(a.summary,/tomorrow|9 September|9 Sep/i);for(const key of ['priorities','courses','drafts','agenda','options'])assert.equal(a[key].length,0,key)}}
]
const settings=await llmSettings()
assert.ok(settings.apiKey,'Configure the existing provider key before running this opt-in evaluation.')
console.log(JSON.stringify({model:settings.model,reasoningEffort:'medium',cases:cases.length}))
const failures=[]
for(const scenario of cases){
 try {
  const calls=[]
  const history=scenario.history||[]
  const grounding=createTutorGrounding({message:scenario.message,history})
  const started=Date.now()
  const result=await runToolLoop({
    signal:AbortSignal.timeout(180_000),
    onDiagnostic:diagnostic=>console.log(JSON.stringify({case:scenario.name,...diagnostic})),
    messages:[{role:'system',content:tutorStableSystemPrompt()},...history,{role:'system',content:tutorTurnContextPrompt({memory:{},context:{courseCode:code},now:new Date('2026-09-08T16:12:00Z')})},{role:'user',content:scenario.message}],
    tools:TUTOR_TOOLS,responseFormat:()=>grounding.responseFormat(TUTOR_RESPONSE_FORMAT),reviewAnswer:grounding.review,requiredTools:grounding.requiredTools,reasoningEffort:'medium',maxRounds:6,maxOutputTokens:8192,parallelTools:true,
    toolResultForModel:tutorToolResultForModel,
    runTool:async(name,args)=>{
      calls.push(name)
      if(name==='get_canvas_assignments')return {assignments:[assignment]}
      if(name==='get_canvas_assignment_detail')return {assignment:{...assignment,descriptionHtml:`<p>${scenario.preparation||'Review the three example plans individually and submit your written review by the due date. The brief does not state any pre-class deliverable.'}</p>`,rubric:[]}}
      if(name==='get_announcements')return {announcements:[announcement],evidence:[announcementEvidence]}
      if(name==='get_schedule')return {events:[{course:code,title:'Project 3-1 — Project / Skill Class',when:'2026-09-09T11:00:00+02:00',category:'timetable',activity:'Project',room:'Room A'}]}
      if(name==='get_course_obligations')return {obligations:[{courseCode:code,status:'confirmed',attendanceRules:[{text:'Attend project meetings; the project opening, company kickoff and midway evaluation count as project meetings.'}]}],recentRuleAnnouncements:[announcement],evidence:[announcementEvidence]}
      if(name==='search_study_sources'||name==='read_study_source')return {context:announcement.text,evidence:[announcementEvidence]}
      if(name==='get_study_work')return {items:[],note:'No personal tasks recorded.'}
      if(name==='get_briefing')return {...(scenario.oversized ? {courseObligations:Array.from({length:74},(_,i)=>({id:`background-${i}`,title:`Background note ${i}`,detail:'This is optional background reading, not a dated task. '.repeat(25),courseCode:code}))} : {}),today:'2026-09-08',horizon:'2026-09-10',priorities:[{course:code,title:assignment.title,when:assignment.dueAt,url:assignment.url}],teaching:[{course:code,title:'Project Plan Writing skill class',when:'2026-09-09',time:'11:00',room:'Room A',activity:'Skill class'}],announcements:[announcement],notConnected:[]}
      return {error:'This fixture has no additional source for that tool. Do not invent its contents or save actions.'}
    },onToolCall:(name,args,result)=>grounding.record(name,result,evidenceFromTool(name,result))
  })
  const raw=JSON.parse(result.added.at(-1).content)
  parseTutorResponse(result.added.at(-1).content)
  console.log(JSON.stringify({case:scenario.name,elapsedMs:Date.now()-started,calls,answer:raw,usage:result.usage}))
  scenario.check(raw,calls)
 } catch(error) {
  failures.push(scenario.name)
  console.error(JSON.stringify({case:scenario.name,failure:error.message}))
 }
}
assert.deepEqual(failures,[],`Failed tutor scenarios: ${failures.join(', ')}`)
console.log('PASS: all tutor grounding model scenarios.')
