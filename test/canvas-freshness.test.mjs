import test from 'node:test'
import assert from 'node:assert/strict'
import { collectCanvasMetadata, compareCanvasMetadata, replayCanvasMetadata } from '../lib/canvas-freshness.mjs'
const origin='https://canvas.example.edu', courseId='7'
const response=(value,headers={})=>new Response(JSON.stringify(value),{headers})
function fixture(edits={}) {
  const calls=[],checkpoints=[]
  const rows={
    '/courses/7':{id:7,name:'AI',syllabus_body:'Labs are mandatory'},
    '/courses/7/files':[{id:1,display_name:'Lecture.pdf',size:100,updated_at:'2026-09-01'}],
    '/courses/7/assignments':[{id:2,name:'Lab',description:'<a href="/courses/7/files/9/download">worksheet</a>',due_at:'2026-09-14'}],
    '/courses/7/discussion_topics':[{id:3,title:'Welcome',message:'Hello',discussion_subentry_count:4}],
    '/courses/7/pages':[{page_id:5,title:'Reading',updated_at:'2026-09-01'}],
    '/courses/7/quizzes':[],
    '/courses/7/modules':[{id:6,name:'Week 1',items_count:1,items:[{id:20,type:'Page',page_url:'reading',title:'Reading',position:1}]}],
    '/courses/7/modules/6/items':[{id:20,type:'Page',page_url:'reading',title:'Reading',position:1}],
    '/courses/7/files/9':{id:9,display_name:'Worksheet.pdf',size:50,updated_at:'2026-09-01'},
    ...edits
  }
  const fetchImpl=async (input,opts)=>{
    const url=new URL(input);calls.push(url.href)
    assert.equal(url.origin,origin)
    assert.equal(opts.headers.authorization,'Bearer test-token')
    const value=rows[url.pathname.replace('/api/v1','')]
    const res=typeof value==='function'?value(url):value?response(value):new Response('',{status:404})
    checkpoints.push({key:url.href,value:{body:await res.clone().text(),status:res.status,headers:Object.fromEntries(res.headers)}})
    return res
  }
  return {calls,checkpoints,fetchImpl}
}
async function collect(f, extra={}) {return collectCanvasMetadata({origin,courseId,token:'test-token',fetchImpl:f.fetchImpl,...extra})}
test('metadata checks cover source families and hidden assignment attachments without downloading files or model calls',async()=>{
  const f=fixture(),snapshot=await collect(f)
  assert.equal(f.calls.length,9)
  assert.ok(f.calls.every(url=>!url.includes('/download')))
  assert.equal(snapshot.categories.attachments.items[0].title,'Worksheet.pdf')
  assert.ok(Object.values(snapshot.categories).every(c=>c.complete))
  assert.doesNotMatch(JSON.stringify(snapshot),/test-token|Labs are mandatory|worksheet<|Bearer/)
})
test('new files, edits to old announcements, due dates, page revisions and module changes are detected',async()=>{
  const before=await collect(fixture())
  const after=await collect(fixture({
    '/courses/7/files':[{id:1,display_name:'Lecture.pdf',size:101,updated_at:'2026-09-02'},{id:11,display_name:'Lecture 2.pdf'}],
    '/courses/7/discussion_topics':[{id:3,title:'Welcome',message:'Corrected exam date',discussion_subentry_count:4}],
    '/courses/7/assignments':[{id:2,name:'Lab',description:'<a href="/courses/7/files/9/download">worksheet</a>',due_at:'2026-09-15'}],
    '/courses/7/pages':[{page_id:5,title:'Reading',updated_at:'2026-09-03'}],
    '/courses/7/modules':[{id:6,name:'Week 1',items_count:1,items:[{id:20,type:'Page',title:'Updated reading',page_url:'reading',position:1}]}]
  }))
  const result=compareCanvasMetadata(before,after)
  assert.equal(result.status,'updates')
  for(const kind of ['files','announcements','assignments','pages','modules'])assert.ok(result.changes.some(c=>c.kind===kind&&c.change==='changed'),kind)
  assert.ok(result.changes.some(c=>c.id==='11'&&c.change==='new'))
})
test('reordering lists, signed file URLs and discussion reply counts do not create updates',async()=>{
  const before=await collect(fixture()),f=fixture({
    '/courses/7/files':[{id:1,display_name:'Lecture.pdf',size:100,updated_at:'2026-09-01',url:'https://cdn.example.test/random-signed-url'}],
    '/courses/7/discussion_topics':[{id:3,title:'Welcome',message:'Hello',discussion_subentry_count:30}]
  })
  assert.equal(compareCanvasMetadata(before,await collect(f)).status,'current')
})
test('unchanged assignment text still detects replaced attachment bytes through metadata',async()=>{
  const before=await collect(fixture()),after=await collect(fixture({'/courses/7/files/9':{id:9,display_name:'Worksheet.pdf',size:60,updated_at:'2026-09-02'}}))
  assert.deepEqual(compareCanvasMetadata(before,after).changes.map(c=>c.kind),['attachments'])
})
test('403 and failed pagination never mean deletion or up to date, and retain previously observed changes',async()=>{
  const baseline=await collect(fixture()),changed=await collect(fixture({'/courses/7/files':[{id:1,display_name:'New lecture.pdf'}]}))
  const previous=compareCanvasMetadata(baseline,changed)
  const partial=await collect(fixture({'/courses/7/files':url=>url.searchParams.has('page')?new Response('',{status:403}):response([],{link:`<${origin}/api/v1/courses/7/files?page=2>; rel="next"`})}))
  const result=compareCanvasMetadata(baseline,partial,previous)
  assert.ok(result.unchecked.includes('files'))
  assert.deepEqual(result.changes.filter(c=>c.kind==='files'),previous.changes.filter(c=>c.kind==='files'))
  assert.ok(!result.changes.some(c=>c.kind==='files'&&c.change==='unavailable'))
})
test('complete pagination detects new files beyond the first page',async()=>{
  const f=fixture({'/courses/7/files':url=>url.searchParams.has('page')?response([{id:12,display_name:'Last.pdf'}]):response([],{link:`<${origin}/api/v1/courses/7/files?page=2>; rel="next"`})})
  const result=await collect(f)
  assert.equal(result.categories.files.items[0].id,'12')
  assert.equal(result.categories.files.complete,true)
})
test('missing module inline items are fetched; checkpoint replay recreates a successful scrape with no live requests',async()=>{
  const f=fixture({'/courses/7/modules':[{id:6,name:'Week 1',items_count:1}]})
  const baseline=await collect(f)
  const replay=await collectCanvasMetadata({origin,courseId,replay:true,fetchImpl:replayCanvasMetadata(f.checkpoints)})
  assert.equal(compareCanvasMetadata(replay,baseline).status,'current')
  const noBaseline=await collectCanvasMetadata({origin,courseId,replay:true,fetchImpl:replayCanvasMetadata([])})
  assert.equal(compareCanvasMetadata(noBaseline,baseline).status,'partial')
})
test('request and response size budgets stop oversized metadata scans with explicit incomplete coverage',async()=>{
  const f=fixture(),limited=await collect(f,{maxRequests:3})
  assert.equal(f.calls.length,3)
  assert.equal(limited.categories.modules.complete,false)
  const large=await collect(fixture(),{maxBytes:10})
  assert.equal(large.categories.syllabus.complete,false)
  assert.equal(compareCanvasMetadata(large,large).status,'partial')
})
test('a successful new baseline clears changes; simply rechecking does not acknowledge them',async()=>{
  const baseline=await collect(fixture()),changed=await collect(fixture({'/courses/7/files':[]}))
  const first=compareCanvasMetadata(baseline,changed)
  assert.equal(first.changes[0].change,'unavailable')
  assert.deepEqual(compareCanvasMetadata(baseline,changed,first).changes,first.changes)
  assert.equal(compareCanvasMetadata(changed,changed,first).status,'current')
})
