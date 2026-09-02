import test from 'node:test'
import assert from 'node:assert/strict'
import { programmeCounts, programmeEditPayload } from '../lib/workspace/admin-catalogue.mjs'

test('programme editor preserves nested curriculum and locks the route id', () => {
  const result = programmeEditPayload('real-id', JSON.stringify({ id: 'changed', name: 'Computer Science', versions: [{ id: '2026', courses: [{ id: 'a' }] }], calendar: [{ id: 'd' }] }))
  assert.equal(result.id, 'real-id')
  assert.equal(result.versions[0].courses[0].id, 'a')
})

test('programme editor rejects malformed curricula before a write', () => {
  assert.throws(() => programmeEditPayload('id', '{'), /not valid JSON/)
  assert.throws(() => programmeEditPayload('id', { name: '', versions: [] }), /needs a name/)
  assert.throws(() => programmeEditPayload('id', { name: 'X', versions: [{}] }), /needs an id and courses array/)
})

test('programme counts unique courses across versions', () => {
  assert.deepEqual(programmeCounts({ versions: [{ courses: [{ id: 'a' }, { id: 'b' }] }, { courses: [{ id: 'a' }] }], calendar: [{}, {}] }), { versions: 2, courses: 2, dates: 2 })
})
