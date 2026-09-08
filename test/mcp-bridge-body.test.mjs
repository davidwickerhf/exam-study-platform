import test from 'node:test'
import assert from 'node:assert/strict'
import { createMcpApiBridge, internalMcpAuth } from '../lib/mcp-bridge.mjs'

for (const method of ['POST', 'PATCH', 'PUT']) {
  test(`MCP ${method} supplies a byte stream to the HTTP JSON body reader`, async () => {
    const body = { kind: 'context', text: 'Quiz 1 → Thursday; café 🧠', startDate: '2026-09-08', endDate: '2026-09-10' }
    const api = createMcpApiBridge(async (req, res) => {
      assert.equal(req.method, method)
      assert.equal(internalMcpAuth.get(req).userId, 'student')
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      // This is the byte-stream contract used by server.mjs readBody.
      const bytes = Buffer.concat(chunks)
      assert.equal(bytes.length, Buffer.byteLength(JSON.stringify(body), 'utf8'))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ received: JSON.parse(bytes.toString('utf8')) }))
    }, { userId: 'student', mode: 'api-key', scopes: ['read', 'write'] })
    assert.deepEqual(await api('/api/tutor/updates/prepare', { method, body }), { received: body })
  })
}

test('MCP GET without a body remains an empty byte stream', async () => {
  const api = createMcpApiBridge(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    assert.equal(Buffer.concat(chunks).length, 0)
    res.end('{}')
  }, { userId: 'student' })
  assert.deepEqual(await api('/api/tutor/context'), {})
})
