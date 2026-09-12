import test from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js'
import { createRemoteMcpServer } from '../lib/mcp-http.mjs'
import { toolAnnotations } from '../mcp/tool-annotations.mjs'

async function fixture(t) {
  const calls = []
  const api = async (path, options = {}) => {
    calls.push({path, ...options})
    if (path === '/api/courses') return {courses: []}
    if (path === '/api/corpus/materials') return {materials: [{assetId:'canvas-only',courseCode:options.query.courseCode}]}
    if (path === '/api/retrieve') return {chunks:[{assetId:'canvas-only',corpus:'canvas',...options.body}]}
    return {path, ...options}
  }
  const server = createRemoteMcpServer({api, auth:{userId:'student',scopes:['read']}})
  const client = new Client({name:'course-contract-test',version:'1'})
  const [a,b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  t.after(async()=>{await client.close();await server.close()})
  const listed = await client.listTools()
  return {client,calls,tools:new Map(listed.tools.map(tool=>[tool.name,tool]))}
}

test('discovered read and mutation hints describe effects rather than confirmation policy',async t=>{
  const {tools}=await fixture(t)
  for(const tool of tools.values()) assert.equal(typeof tool.annotations?.readOnlyHint,'boolean',tool.name)
  for(const name of ['search_course','search_regulations','list_courses','get_course','canvas_course_materials','read_course_source','read_original_chunk','wicker_guidance','get_attendance']){
    assert.equal(tools.get(name).annotations.readOnlyHint,true,name)
    assert.equal(tools.get(name).inputSchema.required?.includes('confirmed')||false,false,name)
  }
  for(const name of ['set_mastery','tutor_ask','study_generation_start','study_generation_next','study_generation_submit','study_generation_stop','tutor_prepare_context','feedback_prepare','prepare_original_download']){
    assert.equal(tools.get(name).annotations.readOnlyHint,false,name)
  }
  assert.equal(tools.get('tutor_prepare_context').annotations.destructiveHint,false)
  assert.equal(tools.get('tutor_forget_context').annotations.destructiveHint,true)
  assert.equal(toolAnnotations('download_course_original').readOnlyHint,false,'a local file download writes its environment')
  assert.equal(toolAnnotations('future_unclassified_tool').readOnlyHint,false)
  assert.equal(tools.get('get_course').annotations.openWorldHint,false)
  assert.equal(tools.get('canvas_updates').annotations.openWorldHint,true)
})

test('published search JSON Schema and tools/call enforce the same course identity requirement',async t=>{
  const {client,tools,calls}=await fixture(t)
  const schema=tools.get('search_course').inputSchema
  const validate=new AjvJsonSchemaValidator().getValidator(schema)
  assert.equal(schema.type,'object')
  const invalid=[{query:'lab attendance'},{query:'x',courseCode:''},{query:'x',courseId:'  '},{query:'',courseCode:'BCS3120'},{query:'   ',canonicalCourseId:'course-a'}]
  for(const args of invalid){
    assert.equal(validate(args).valid,false,JSON.stringify(args))
    const count=calls.length
    const result=await client.callTool({name:'search_course',arguments:args})
    assert.equal(result.isError,true,JSON.stringify(args))
    assert.equal(calls.length,count,'invalid arguments must not reach retrieval')
  }
  for(const selector of [{courseId:'published-id'},{courseCode:'BCS3120'},{canonicalCourseId:'canonical-a'},{courseId:'published-id',courseCode:'BCS3120'}]){
    const args={query:'lab attendance',...selector,academicYear:'2026-2027',sourceType:'materials',includeHistorical:false,limit:4}
    assert.equal(validate(args).valid,true)
    const result=await client.callTool({name:'search_course',arguments:args})
    assert.notEqual(result.isError,true)
    assert.deepEqual(calls.at(-1),{path:'/api/retrieve',method:'POST',body:args})
  }
})

test('Canvas inventory and course-code search remain available when no study courses are published',async t=>{
  const {client,tools}=await fixture(t)
  const read=async(name,args={})=>JSON.parse((await client.callTool({name,arguments:args})).content[0].text)
  assert.deepEqual((await read('list_courses')).courses,[])
  assert.equal((await read('canvas_course_materials',{courseCode:'BCS3120'})).materials[0].assetId,'canvas-only')
  assert.equal((await read('search_course',{courseCode:'BCS3120',query:'course introduction'})).chunks[0].corpus,'canvas')
  assert.match(tools.get('list_courses').description,/NOT the Canvas material inventory/)
  assert.match(tools.get('get_course').description,/exact id from list_courses/)
  assert.match(tools.get('canvas_course_materials').description,/absent from list_courses/)
  assert.match(tools.get('search_course').description,/courseCode/)
})

test('course material refresh requires confirmation and queues only the selected edition', async t => {
  const { client, tools, calls } = await fixture(t)
  const tool = tools.get('refresh_course_materials')
  assert.equal(tool.annotations.readOnlyHint, false)
  assert.ok(tool.inputSchema.required.includes('confirmed'))
  for (const args of [{ canvasCourseId: '42' }, { canvasCourseId: 'BCS2120', confirmed: true }]) {
    const result = await client.callTool({ name: tool.name, arguments: args })
    assert.equal(result.isError, true)
  }
  assert.equal(calls.length, 0)
  const result = await client.callTool({ name: tool.name, arguments: {
    canvasCourseId: '42', canvasUrl: 'https://canvas.example.edu', confirmed: true
  } })
  assert.ok(!result.isError)
  assert.deepEqual(calls, [{ path: '/api/integrations/canvas/corpus/course', method: 'POST', body: {
    canvasCourseId: '42', canvasUrl: 'https://canvas.example.edu', force: true
  } }])
  await client.callTool({ name: tool.name, arguments: { canvasCourseId: '43', confirmed: true } })
  assert.equal(calls[1].body.canvasUrl, 'https://canvas.maastrichtuniversity.nl')
})

test('course material refresh preserves queue receipts and reports consent errors', async t => {
  let denied = false
  const receipt = { observed: 1, queued: 1, syncId: 'sync-fixture' }
  const server = createRemoteMcpServer({ auth: { userId: 'student', scopes: ['read', 'write'] }, api: async () => {
    if (denied) throw Object.assign(new Error('Choose a Canvas material authorization in Settings first.'), { status: 409 })
    return receipt
  } })
  const client = new Client({ name: 'refresh-test', version: '1' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  t.after(async () => { await client.close(); await server.close() })
  const call = () => client.callTool({ name: 'refresh_course_materials', arguments: { canvasCourseId: '42', confirmed: true } })
  const queued = await call()
  assert.deepEqual(JSON.parse(queued.content[0].text), receipt)
  denied = true
  const rejected = await call()
  assert.equal(rejected.isError, true)
  assert.equal(JSON.parse(rejected.content[0].text).status, 409)
})
