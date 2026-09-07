import test from 'node:test'
import assert from 'node:assert/strict'
import { createCanvasApi, importCanvasCourse } from '../lib/canvas-course-import.mjs'
import { queueTopicForJob, CANVAS_QUEUE_TOPIC, STUDY_QUEUE_TOPIC, signCanvasTask, verifyCanvasTask, validateDownloadRange, CanvasCheckpointYield } from '../lib/canvas-queue-protocol.mjs'

test('queue service signatures bind payload, time and service key',()=>{
  const time='1788700000000',key='fixture-key',body='{"jobId":"one"}'
  const signed=signCanvasTask(body,time,key)
  assert.equal(verifyCanvasTask(body,signed,{key,now:Number(time)}),true)
  for(const [value,options] of [[body+'x',{key,now:Number(time)}],[body,{key:'other',now:Number(time)}],[body,{key,now:Number(time)+300001}]]) assert.equal(verifyCanvasTask(value,signed,options),false)
  assert.equal(verifyCanvasTask(body,null,{key}),false)
})
test('range validation rejects missing bytes and changing originals',()=>{
  const response=(range,etag='"one"')=>new Response('abc',{status:206,headers:{'content-range':range,etag}})
  assert.deepEqual(validateDownloadRange(response('bytes 8-15/20'),8,20,'"one"'),{start:8,end:16,total:20,etag:'"one"'})
  assert.throws(()=>validateDownloadRange(response('bytes 0-7/20'),8,20,'"one"'),/unexpected/)
  assert.throws(()=>validateDownloadRange(response('bytes 8-15/21'),8,20,'"one"'),/size changed/)
  assert.throws(()=>validateDownloadRange(response('bytes 8-15/20','"two"'),8,20,'"one"'),/changed/)
})
test('checkpointed pagination resumes without re-fetching prior pages and preserves cached access denials',async()=>{
  const cache=new Map();let count=0,limit=1
  const api=createCanvasApi({origin:'https://canvas.test',accessToken:'test',checkpoint:{get:key=>cache.get(key),set:(key,value)=>cache.set(key,value),beforeRequest:()=>{if(count>=limit) throw new CanvasCheckpointYield()}},fetchImpl:async url=>{
    count++
    if(url.pathname==='/denied') return new Response('{}',{status:403})
    return new Response(JSON.stringify([url.searchParams.get('page')||'1']),{headers:url.searchParams.has('page')?{}:{link:'<https://canvas.test/list?page=2>; rel="next"'}})
  }})
  await assert.rejects(api.getPaged('/list'),error=>error.checkpointYield)
  limit=10
  assert.deepEqual(await api.getPaged('/list'),['1','2']);assert.equal(count,2)
  await assert.rejects(api.getJson('/denied'),/HTTP 403/)
  await assert.rejects(api.getJson('/denied'),/HTTP 403/);assert.equal(count,3)
})
test('durable importer replays discovery after interruption without dropping nested links or announcements',async()=>{
  const cache=new Map(),files=new Map(),texts=new Map();let budget=3,used=0,summary
  const fixture={
    '/api/v1/users/self/profile':{id:1},'/api/v1/courses/8':{id:8,name:'Fixture',syllabus_body:'<a href="/courses/8/pages/rules">Rules</a>'},
    '/api/v1/courses/8/modules':[{id:3,position:1,items:[]}],
    '/api/v1/courses/8/modules/3/items':[{id:4,type:'File',content_id:6,position:1}],
    '/api/v1/courses/8/files':[{id:6,filename:'lecture.ipynb',size:4,url:'https://files.test/6'}],
    '/api/v1/courses/8/pages/rules':{title:'Rules',body:'<a href="/courses/8/files/7">Revised coursebook</a>'},
    '/api/v1/courses/8/files/7':{id:7,filename:'coursebook.pdf',size:5,url:'https://files.test/7'},
  }
  const args={courseUrl:'https://canvas.test/courses/8/modules',accessToken:'fixture-token',outputFolder:'/unused',fetchImpl:async url=>{
    if(url.searchParams.get('only_announcements')) return Response.json([{id:10,title:'Attendance relaxed',message:'One absence is allowed.'}])
    return Response.json(fixture[url.pathname]||[])
  },durable:{checkpoint:{get:key=>cache.get(key),set:(key,value)=>cache.set(key,value),beforeRequest:()=>{if(++used>budget)throw new CanvasCheckpointYield()}},write:(path,content)=>texts.set(path,content),file:(path,detail)=>{files.set(path,detail.id);return detail.size},finish:value=>{summary=value}}}
  await assert.rejects(importCanvasCourse(args),error=>error.checkpointYield)
  budget=100
  await importCanvasCourse(args)
  assert.deepEqual(new Set(files.values()),new Set(['6','7']))
  assert.ok([...texts.values()].some(value=>value.includes('One absence is allowed.')))
  assert.equal(summary.skipped.length,0)
  const before=texts.size
  await importCanvasCourse(args)
  assert.equal(texts.size,before);assert.equal(files.size,2)
})

test('student generation uses independent capacity from Canvas imports', () => {
  assert.equal(queueTopicForJob('sv-123'), STUDY_QUEUE_TOPIC)
  assert.equal(queueTopicForJob('pap-123'), STUDY_QUEUE_TOPIC)
  assert.equal(queueTopicForJob('csj-123'), CANVAS_QUEUE_TOPIC)
  assert.notEqual(STUDY_QUEUE_TOPIC, CANVAS_QUEUE_TOPIC)
})
