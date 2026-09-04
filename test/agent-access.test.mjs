import test from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_MANIFEST } from '../lib/agent-manifest.mjs'
import { adminStatus, upsertCourse, AdminError } from '../lib/editorial-admin.mjs'
import { normalizeEditorialProgramme, setEditorialProgrammeCatalogue, loadEditorialProgrammeCatalogue } from '../lib/editorial-programmes.mjs'
import { EDITORIAL_RIGHTS_BASES, listEditorialWorkspace } from '../lib/editorial-workflow.mjs'

test('agent manifest lists every scope and has unique method+path pairs', () => {
  const seen = new Set()
  for (const endpoint of AGENT_MANIFEST.endpoints) {
    assert.ok(['read', 'write', 'admin'].includes(endpoint.scope), `${endpoint.path} scope`)
    const key = `${endpoint.method} ${endpoint.path}`
    assert.ok(!seen.has(key), `duplicate ${key}`)
    seen.add(key)
  }
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.path.startsWith('/api/admin/')))
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.scope === 'write'))
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.path === '/api/admin/editorial-editions/{editionId}/sources'))
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.path === '/api/admin/editorial-editions/{editionId}/publish'))
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.method === 'GET' && e.path === '/api/planning/context' && e.scope === 'read'))
  assert.ok(AGENT_MANIFEST.endpoints.some((e) => e.method === 'PATCH' && e.path === '/api/planning/objectives/{courseId}' && e.scope === 'write'))
})

test('editorial writes are unavailable without a hosted database', async () => {
  assert.deepEqual(await adminStatus(), { mode: 'local', writable: false })
  await assert.rejects(() => upsertCourse('x', { code: 'X', name: 'Y' }), (error) => error instanceof AdminError && error.status === 501)
  await assert.rejects(() => listEditorialWorkspace(), (error) => error.status === 501)
  assert.deepEqual(EDITORIAL_RIGHTS_BASES, ['own-notes', 'authorised-course-material', 'public-source', 'admin-supplied'])
})

test('programme catalogue can be replaced in memory from stored definitions', () => {
  const original = loadEditorialProgrammeCatalogue()
  const programme = normalizeEditorialProgramme({
    id: 'test-university-bsc-testing',
    institution: { name: 'Test University' },
    name: 'Testing',
    degree: 'BSc',
    durationYears: 3,
    totalEcts: 180,
    versions: [{ id: '2030', label: '2030', status: 'draft', courses: [{ id: 'tst101', code: 'TST101', name: 'Testing 101', ects: 6, yearLevel: 'Year 1', period: 'P1' }] }]
  })
  try {
    setEditorialProgrammeCatalogue([programme])
    assert.deepEqual(loadEditorialProgrammeCatalogue().programmes.map((p) => p.id), ['test-university-bsc-testing'])
  } finally {
    setEditorialProgrammeCatalogue(original.programmes)
  }
})
