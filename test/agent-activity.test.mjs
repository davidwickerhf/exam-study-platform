import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { agentActivityEntry, beginAgentActivity, readAgentActivity } from '../lib/agent-activity.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument } from '../lib/user-store.mjs'
import { exportPersonalData } from '../lib/account-data.mjs'
const req = (method='GET') => ({ method, headers: { authorization: 'Bearer secret', 'x-wicker-tool': 'get_attendance', 'x-wicker-client': 'wicker-study-mcp 2.9.0' } })
async function fixture(run) { const auth = { userId: `agent-activity-${crypto.randomUUID()}`, keyId: 'fixture-key', mode: 'api-key' }; try { await withRequestContext(auth, () => run(auth)) } finally { await withRequestContext(auth, deleteAllDocuments) } }
function response() { const res = new EventEmitter(); res.statusCode = 200; let done; res.finished = new Promise(resolve => { done = resolve }); res.end = () => { done(); return res }; return res }

test('audit records contain metadata only; paths and query/body content are never copied', () => {
  const request = { ...req('POST'), body: { text: 'private text' } }
  const entry = agentActivityEntry(request, { keyId: 'key' }, new URL('https://fixture/api/retrieve?query=private-secret'))
  assert.equal(entry.operation, 'read')
  assert.equal(entry.route, '/api/retrieve')
  assert.doesNotMatch(JSON.stringify(entry), /private|Bearer|authorization/)
  const file = agentActivityEntry(req(), {}, new URL('https://fixture/api/material/course/private-filename.pdf?token=secret'))
  assert.equal(file.route, '/api/material/{courseId}/{sourcePath}')
  assert.doesNotMatch(JSON.stringify(file), /private-filename|secret/)
  assert.equal(agentActivityEntry(req('POST'), {}, new URL('https://fixture/api/tutor/updates/prepare')).operation, 'prepare')
})

test('start is durable; final result and confirmed review are saved before response completion', () => fixture(async auth => {
  const res = response()
  await beginAgentActivity(req('POST'), res, auth, new URL('https://fixture/api/tutor/updates/confirm'))
  assert.equal((await readAgentActivity()).items[0].status, 'running')
  res.agentActivityConfirmation = 'review-123'; res.end('ok'); await res.finished
  const item = (await readAgentActivity()).items[0]
  assert.equal(item.status, 'completed')
  assert.equal(item.confirmationId, 'review-123')
  assert.equal(item.statusCode, 200)
  assert.equal((await exportPersonalData()).agentActivity.length, 1)
}))

test('failed requests remain inspectable and filters/pagination do not cross accounts', () => fixture(async auth => {
  for (let i=0; i<3; i++) {
    const res = response(); res.statusCode = 403
    await beginAgentActivity(req(i ? 'POST' : 'GET'), res, auth, new URL('https://fixture/api/tutor')); res.end(); await res.finished
  }
  const first = await readAgentActivity({ limit: 2, status: 'failed' })
  assert.equal(first.items.length, 2); assert.ok(first.nextCursor)
  const second = await readAgentActivity({ limit: 2, before: first.nextCursor })
  assert.equal(second.items.length, 1)
  assert.equal(new Set([...first.items,...second.items].map(item => item.id)).size, 3)
  assert.equal((await readAgentActivity({ operation: 'write' })).items.length, 2)
  await withRequestContext({ userId: 'different-activity-owner' }, async () => assert.equal((await readAgentActivity()).items.length, 0))
}))

test('successful erasure cannot recreate audit documents', () => fixture(async auth => {
  const res = response()
  await beginAgentActivity(req('DELETE'), res, auth, new URL('https://fixture/api/account/data'))
  await deleteAllDocuments(); res.agentActivityErased = true; res.end(); await res.finished
  assert.equal((await readAgentActivity()).items.length, 0)
}))
