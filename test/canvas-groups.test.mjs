import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchCanvasGroups, canvasGroupRecord } from '../lib/canvas-groups.mjs'
import { readCanvasGroups } from '../lib/canvas-group-context.mjs'
import { normalizeTutorContext, evidenceFromTool, TUTOR_TOOLS } from '../lib/tutor-agent.mjs'
import { courseDetailTab } from '../lib/workspace/course-detail.mjs'

const origin='https://canvas.example.edu'
const courses=[{id:'1',courseCode:'KEN2220',name:'Graph Theory',term:{name:'2026-2027'}},{id:'2',courseCode:'KEN2220',name:'Graph Theory',term:{name:'2025-2026'}}]
const current={id:10,name:'Tutorial team 4',course_id:1,context_type:'Course',members_count:3,group_category_id:5}
const prior={...current,id:11,course_id:2}
const global={id:20,name:'Data Science society',context_type:'Account',context_name:'Student communities'}
const json=(body,headers={})=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json',...headers}})
function fixture(overrides={}){
  const calls=[]
  const fetchImpl=async value=>{
    const url=new URL(value);calls.push(url.pathname+url.search)
    if(overrides[url.pathname])return overrides[url.pathname](url)
    if(url.pathname==='/api/v1/users/self/groups')return json([current,prior,global])
    if(url.pathname==='/api/v1/users/self/profile')return json({id:100,email:'not-returned@example.test',login_id:'private'})
    if(url.pathname==='/api/v1/courses/1/groups') {assert.equal(url.searchParams.get('only_own_groups'),'true');return json([current])}
    if(url.pathname==='/api/v1/groups/10/users')return json([{id:101,name:'Ada'},{id:100,name:'Student',email:'private@example.test'}],{link:`<${origin}/api/v1/groups/10/users?page=2>; rel="next"`})
    throw new Error(`Unexpected request ${url.pathname}`)
  }
  return {calls,fetchImpl}
}
const options={origin,token:'fixture-token',courses}

test('global and course memberships retain exact course IDs and academic years; lists do not fetch rosters',async()=>{
  const f=fixture(),result=await fetchCanvasGroups({...options,...f})
  assert.equal(result.groups.length,3)
  assert.equal(result.groups.find(g=>g.id==='10').academicYear,'2026-2027')
  assert.equal(result.groups.find(g=>g.id==='11').academicYear,'2025-2026')
  assert.equal(result.groups.find(g=>g.id==='20').scope,'global')
  assert.ok(result.groups.every(g=>g.members===null))
  assert.equal(f.calls.length,1)
})
test('selected course deduplicates memberships and paginates teammates without leaking other user fields',async()=>{
  const f=fixture({'/api/v1/groups/10/users':url=>url.searchParams.get('page')==='2'?json([{id:102,name:'Grace'},{id:101,name:'Ada'}]):json([{id:101,name:'Ada',email:'private@example.test'},{id:100,name:'Student'}],{link:`<${origin}/api/v1/groups/10/users?page=2>; rel="next"`})})
  const result=await fetchCanvasGroups({...options,...f,courseIds:['1'],scope:'course',groupId:'10'})
  assert.equal(result.groups.length,1)
  assert.deepEqual(result.groups[0].members.map(m=>m.name),['Student','Ada','Grace'])
  assert.equal(result.groups[0].members[0].isYou,true)
  assert.equal(result.groups[0].membersStatus,'loaded')
  assert.doesNotMatch(JSON.stringify(result),/email|login_id|fixture-token/)
  assert.equal(f.calls.filter(path=>path.startsWith('/api/v1/groups/10/users')).length,2)
})
test('arbitrary or other-edition group IDs cannot fetch members',async()=>{
  for(const groupId of ['999','11']){
    const f=fixture(),result=await fetchCanvasGroups({...options,...f,courseIds:['1'],groupId})
    assert.match(result.problems[0].message,/not in your available memberships/)
    assert.equal(f.calls.some(path=>path.includes(`/groups/${groupId}/users`)),false)
  }
})
test('a restricted global listing retains available course memberships; denied rosters are unknown, not empty',async()=>{
  const f=fixture({'/api/v1/users/self/groups':()=>new Response('',{status:403}),'/api/v1/groups/10/users':()=>new Response('',{status:403})})
  const result=await fetchCanvasGroups({...options,...f,courseIds:['1'],groupId:'10'})
  assert.equal(result.groups.length,1)
  assert.equal(result.groups[0].membersStatus,'unavailable')
  assert.equal(result.groups[0].members,null)
  assert.equal(result.problems.length,2)
  assert.equal(result.membershipsLoaded,false)
})
test('global-only filters omit course teams and non-collaborative tags are not teammates',async()=>{
  const f=fixture(),result=await fetchCanvasGroups({...options,...f,scope:'global'})
  assert.deepEqual(result.groups.map(g=>g.id),['20'])
  assert.equal(canvasGroupRecord({...current,non_collaborative:true},{origin}),null)
  assert.equal(canvasGroupRecord({id:'bad'},{origin}),null)
  const record=canvasGroupRecord({...current,html_url:'https://untrusted.test/?verifier=secret'},{origin,courses})
  assert.equal(record.url,`${origin}/groups/10`)
})
test('own-group pagination keeps memberships from later pages',async()=>{
  const f=fixture({'/api/v1/users/self/groups':url=>url.searchParams.has('page')?json([global]):json([current],{link:`<${origin}/api/v1/users/self/groups?page=2>; rel="next"`})})
  const result=await fetchCanvasGroups({...options,...f})
  assert.equal(result.groups.length,2)
})
test('group filters reject invalid identifiers and tutor recognizes the Groups course page',async()=>{
  await assert.rejects(readCanvasGroups({groupId:'../users'}),/valid group/)
  await assert.rejects(readCanvasGroups({academicYear:'yesterday'}),/valid group/)
  assert.equal(courseDetailTab('?tab=groups'),'groups')
  assert.equal(normalizeTutorContext({courseTab:'groups',academicYear:'2026-2027'}).courseTabLabel,'Groups')
  const selected=normalizeTutorContext({courseTab:'groups',selection:{kind:'group',title:'Team',groupId:'10',canvasUrl:origin}})
  assert.equal(selected.selection.groupId,'10')
  assert.equal(selected.selection.canvasUrl,origin)
  assert.ok(TUTOR_TOOLS.some(tool=>tool.function.name==='get_course_groups'))
})

test('course context resolves only the selected edition and never widens an unmatched request',async()=>{
  const requests=[]
  const deps={listConnections:async()=>[{origin}],accessToken:async()=>({token:'private-token'}),fetchHub:async()=>({courses}),fetchGroups:async options=>{requests.push(options);return {groups:[],problems:[]}}}
  await readCanvasGroups({courseCode:'KEN2220',academicYear:'2026-2027'},deps)
  assert.deepEqual(requests[0].courseIds,['1'])
  assert.equal(requests[0].scope,'course')
  const missing=await readCanvasGroups({courseCode:'KEN2220',academicYear:'2024-2025'},deps)
  assert.equal(requests.length,1)
  assert.deepEqual(missing.groups,[])
  assert.deepEqual(missing.matchedCourses,[])
  const result=await readCanvasGroups({scope:'global',refresh:true},deps)
  assert.equal(requests[1].scope,'global')
  assert.equal(requests[1].force,true)
  assert.doesNotMatch(JSON.stringify(result),/private-token/)
})
test('host selection and partial connection failures keep groups account-bound and independent',async()=>{
  const good='https://second.example.edu'
  const deps={listConnections:async()=>[{origin},{origin:good}],accessToken:async({canvasUrl})=>{if(canvasUrl===origin)throw new Error('private decrypt info');return {token:'private-token'}},fetchHub:async()=>({courses:[]}),fetchGroups:async()=>({groups:[global],problems:[]})}
  const result=await readCanvasGroups({},deps)
  assert.equal(result.groups.length,1)
  assert.equal(result.problems.length,1)
  assert.doesNotMatch(JSON.stringify(result),/private decrypt/)
  const selected=await readCanvasGroups({canvasUrl:good},deps)
  assert.equal(selected.problems.length,0)
  assert.equal((await readCanvasGroups({canvasUrl:'https://not-connected.example'},deps)).connected,false)
})

test('tutor group evidence distinguishes verified teammates from membership alone',()=>{
  const group=canvasGroupRecord(current,{origin,courses:[{...courses[0],courseCode:'2627-KEN2220'}]})
  assert.equal(group.courseCode,'KEN2220')
  assert.match(evidenceFromTool('get_course_groups',{groups:[group]})[0].excerpt,/have not been verified/)
  assert.match(evidenceFromTool('get_course_groups',{groups:[{...group,membersStatus:'loaded',members:[{name:'Ada'}]}]})[0].excerpt,/Members: Ada/)
})
