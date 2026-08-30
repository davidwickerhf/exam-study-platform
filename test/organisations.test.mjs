import test from 'node:test'
import assert from 'node:assert/strict'
import { programmesForEmail, organisationName, scopeDecision, scopeCatalogue } from '../lib/organisations.mjs'
import { authorise } from '../lib/auth.mjs'

const cs = { id: 'um-bsc-cs', name: 'Computer Science', degree: 'BSc', institution: { name: 'Maastricht University', domains: ['maastrichtuniversity.nl'] } }
const dke = { id: 'um-bsc-dsai', name: 'Data Science and AI', degree: 'BSc', institution: { name: 'Maastricht University', domains: ['maastrichtuniversity.nl'] } }
const tue = { id: 'tue-bsc-cs', name: 'Computer Science', degree: 'BSc', institution: { name: 'TU/e', domains: ['tue.nl'] } }
const all = [cs, dke, tue]

test('programmes are matched from the email domain, including subdomains', () => {
  assert.deepEqual(programmesForEmail(all, 'a.b@student.maastrichtuniversity.nl').map((p) => p.id), ['um-bsc-cs', 'um-bsc-dsai'])
  assert.deepEqual(programmesForEmail(all, 'x@tue.nl').map((p) => p.id), ['tue-bsc-cs'])
  assert.deepEqual(programmesForEmail(all, 'x@gmail.com'), [])
  assert.deepEqual(programmesForEmail(all, 'x@maastrichtuniversity.nl.evil.com'), [])
  assert.equal(programmesForEmail(all, 'x@gmail.com', { trusted: true }).length, 3)
})

test('scope decision: none, join, choose, unavailable', () => {
  assert.deepEqual(scopeDecision({ memberships: [{ programmeId: 'x' }], eligible: all }), { action: 'none' })
  assert.deepEqual(scopeDecision({ memberships: [], eligible: [tue] }), { action: 'join', programmeId: 'tue-bsc-cs' })
  assert.deepEqual(scopeDecision({ memberships: [], eligible: [cs, dke] }), { action: 'choose' })
  assert.deepEqual(scopeDecision({ memberships: [], eligible: [] }), { action: 'unavailable' })
})

test('catalogue is scoped to memberships, or to joinable programmes before joining', () => {
  const catalogue = { programmes: all }
  assert.deepEqual(scopeCatalogue(catalogue, { memberships: [{ programmeId: 'tue-bsc-cs' }], email: 'x@student.maastrichtuniversity.nl' }).programmes.map((p) => p.id), ['tue-bsc-cs'])
  assert.deepEqual(scopeCatalogue(catalogue, { memberships: [], email: 'x@student.maastrichtuniversity.nl' }).programmes.map((p) => p.id), ['um-bsc-cs', 'um-bsc-dsai'])
  assert.equal(scopeCatalogue(catalogue, { memberships: null }).programmes.length, 3)
})

test('organisation naming is stable', () => {
  assert.equal(organisationName(cs), 'Maastricht University · BSc Computer Science')
})

test('organisation admins may maintain only their own programme', () => {
  const orgAdmin = { admin: false, mode: 'clerk', memberships: [{ programmeId: 'um-bsc-cs', role: 'admin' }, { programmeId: 'tue-bsc-cs', role: 'member' }] }
  assert.equal(authorise(orgAdmin, { method: 'PUT', pathname: '/api/admin/programmes/um-bsc-cs/calendar' }), null)
  assert.equal(authorise(orgAdmin, { method: 'PUT', pathname: '/api/admin/programmes/um-bsc-cs' }), null)
  assert.equal(authorise(orgAdmin, { method: 'GET', pathname: '/api/admin/programmes' }), null)
  assert.match(authorise(orgAdmin, { method: 'PUT', pathname: '/api/admin/programmes/tue-bsc-cs/calendar' }), /Administrator/)
  assert.match(authorise(orgAdmin, { method: 'DELETE', pathname: '/api/admin/programmes/um-bsc-cs' }), /Administrator/)
  assert.match(authorise(orgAdmin, { method: 'PUT', pathname: '/api/admin/courses/sec' }), /Administrator/)
  const member = { admin: false, mode: 'clerk', memberships: [{ programmeId: 'um-bsc-cs', role: 'member' }] }
  assert.match(authorise(member, { method: 'PUT', pathname: '/api/admin/programmes/um-bsc-cs/calendar' }), /Administrator/)
  assert.equal(authorise({ admin: true, mode: 'clerk', memberships: [] }, { method: 'DELETE', pathname: '/api/admin/programmes/x' }), null)
})
