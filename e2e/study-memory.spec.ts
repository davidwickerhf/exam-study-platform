import { test, expect } from '@playwright/test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

test('MCP study checkpoints reach the real Tutor API and obey read-only scopes', async ({ request }) => {
  const keys: string[] = []
  const clients: Client[] = []
  let checkpointId = ''
  const connect = async (scopes: string[]) => {
    const response = await request.post('/api/account/api-keys', { data: { name: 'Study memory integration fixture', scopes } })
    expect(response.status()).toBe(201)
    const key = await response.json()
    keys.push(key.id)
    const client = new Client({ name: 'study-memory-test', version: '1' })
    await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:4188/api/mcp'), { requestInit: { headers: { Authorization: `Bearer ${key.secret}` } } }))
    clients.push(client)
    return client
  }
  const payload = { requestId: `checkpoint-${Date.now()}`, sessionId: 'iot-browser-fixture', courseCode: 'BCS2210', academicYear: '2026-2027', summary: 'Practised task notification timing.', topics: ['Ready versus Running'], observations: [{ topic: 'Scheduling', detail: 'Asked why the notified task waits for the CPU.', basis: 'student_report' }], nextSteps: ['Change the relative priorities and trace again.'], confirmed: true }
  const data = (result: any) => JSON.parse(result.content.find((item: any) => item.type === 'text').text)
  try {
    const reader = await connect(['read'])
    const denied = await reader.callTool({ name: 'study_session_save', arguments: payload })
    expect(denied.isError).toBe(true)
    const writer = await connect(['read', 'write'])
    const result = await writer.callTool({ name: 'study_session_save', arguments: payload })
    expect(result.isError).toBeFalsy()
    checkpointId = data(result).checkpoint.id
    expect(data(await writer.callTool({ name: 'study_session_save', arguments: payload })).duplicate).toBe(true)
    const sources = await (await request.get('/api/tutor?view=sources')).json()
    expect(sources.memory.studySessions.some((entry: any) => entry.id === checkpointId)).toBe(true)
    const saved = data(await reader.callTool({ name: 'study_session_context', arguments: { courseCode: 'BCS2210', academicYear: '2026-2027' } }))
    expect(saved.checkpoints.some((entry: any) => entry.id === checkpointId)).toBe(true)
    const removed = await writer.callTool({ name: 'study_session_forget', arguments: { checkpointId, confirmed: true } })
    expect(data(removed).removed).toBe(true)
    const after = await (await request.get('/api/tutor?view=sources')).json()
    expect(after.memory.studySessions.some((entry: any) => entry.id === checkpointId)).toBe(false)
  } finally {
    for (const client of clients) await client.close()
    if (checkpointId) await request.delete(`/api/tutor/study-sessions/${checkpointId}`)
    for (const id of keys) await request.delete(`/api/account/api-keys/${id}`)
  }
})
