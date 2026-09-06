import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { registerStudyTools } from '../mcp/study-tools.mjs'

function fixture() {
  const tools = new Map()
  registerStudyTools({ tool: (name, description, schema, handler) => tools.set(name, { description, schema: z.object(schema), handler }) }, {
    z, run: fn => fn, api: async (path, options = {}) => ({ path, ...options }), defaultCanvasUrl: 'https://canvas.example.edu'
  })
  const call = (name, args = {}) => tools.get(name).handler(tools.get(name).schema.parse(args))
  return { tools, call }
}
test('MCP exposes focused reads without requesting unrelated payloads', async () => {
  const { tools, call } = fixture()
  assert.equal(tools.size, 26)
  assert.deepEqual(await call('read_course_source', { assetId: 'esa-source', courseCode: 'BCS3120', offset: 12 }), { path: '/api/retrieve/source', query: { assetId: 'esa-source', courseCode: 'BCS3120', offset: 12 } })
  assert.equal((await call('tutor_history')).query.view, 'history')
  assert.equal((await call('tutor_sources')).query.view, 'sources')
  assert.equal((await call('get_attendance', { courseCode: 'BCS2140' })).query.view, 'attendance')
  assert.equal((await call('get_course_obligations')).query.view, 'obligations')
  assert.equal((await call('get_study_readiness', { courseCode: 'BCS3120' })).query.view, 'readiness')
  assert.equal((await call('get_weekly_review')).query.view, 'weekly-review')
  assert.equal((await call('canvas_search_announcements', { query: 'paper 17', rulesOnly: false })).query.query, 'paper 17')
  const assignment = await call('canvas_assignment_detail', { courseId: '12', assignmentId: '34', refresh: true })
  assert.equal(assignment.query.refresh, '1'); assert.equal(assignment.query.canvasUrl, 'https://canvas.example.edu')
})
test('MCP writes preserve exact proposals, identities and idempotency keys', async () => {
  const { call } = fixture()
  assert.throws(() => call('tutor_approve_action', { conversation: 'chat', proposalId: 'proposal' }))
  assert.deepEqual((await call('tutor_approve_action', { conversation: 'chat', proposalId: 'proposal', confirmed: true })).body, { conversation: 'chat', proposalId: 'proposal' })
  assert.equal((await call('tutor_ask', { message: 'Track my project', conversation: 'existing' })).body.conversation, 'existing')
  assert.equal((await call('tutor_ask', { message: 'Track my project' })).timeoutMs, 185000)
  assert.equal((await call('canvas_sync_course', { canvasCourseId: '42' })).body.force, false)
  assert.throws(() => call('canvas_sync_control', { jobId: 'job', action: 'grant-consent' }))
  assert.equal((await call('canvas_sync_control', { jobId: 'job', action: 'retry' })).body.action, 'retry')
  const diagnostic = await call('answer_study_diagnostic', { diagnosticId: 'quiz', answers: { q1: 2 }, requestId: 'attempt-1234' })
  assert.deepEqual(diagnostic.body, { answers: { q1: 2 }, requestId: 'attempt-1234' })
  const source = await call('tutor_add_source', { name: 'Draft', text: 'My draft' })
  assert.equal(source.body.dataUrl, 'data:text/plain;base64,TXkgZHJhZnQ=')
})

test('standalone MCP publishes the new tools and schemas over stdio', async () => {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const client = new Client({ name: 'release-check', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL('../mcp/server.mjs', import.meta.url).pathname], env: { PATH: process.env.PATH, WICKER_STUDY_URL: 'http://127.0.0.1:4177', WICKER_STUDY_API_KEY: 'wsk_fixture_never_sent' }, stderr: 'pipe' })
  try {
    await client.connect(transport)
    assert.equal(client.getServerVersion().version, '2.9.0')
    const listed = await client.listTools()
    for (const name of fixture().tools.keys()) assert.ok(listed.tools.some(tool => tool.name === name), name)
    const approval = listed.tools.find(tool => tool.name === 'tutor_approve_action')
    assert.ok(approval.inputSchema.required.includes('confirmed'))
  } finally { await client.close() }
})


test('MCP requires a fresh confirmation on student writes, including legacy tools', async () => {
  const { installWriteConfirmation } = await import('../mcp/write-confirmation.mjs')
  const tools = new Map(), server = { tool: (name, description, schema, handler) => tools.set(name, { schema: z.object(schema), handler }) }
  installWriteConfirmation(server, z)
  for (const name of ['set_mastery', 'tutor_ask', 'tutor_confirm_update', 'canvas_sync_control', 'get_attendance', 'tutor_prepare_context']) server.tool(name, 'fixture', {}, args => args)
  for (const name of ['set_mastery', 'tutor_ask', 'tutor_confirm_update', 'canvas_sync_control']) {
    assert.equal(tools.get(name).schema.safeParse({}).success, false)
    assert.equal(tools.get(name).schema.safeParse({ confirmed: true }).success, true)
  }
  assert.equal(tools.get('get_attendance').schema.safeParse({}).success, true)
  assert.equal(tools.get('tutor_prepare_context').schema.safeParse({}).success, true)
})
