import test from 'node:test'
import assert from 'node:assert/strict'
import { accessPolicy, emailAllowed } from '../lib/auth.mjs'

test('access policy parses env and matches domains, subdomains, and exceptions', () => {
  const policy = accessPolicy({ ALLOWED_EMAIL_DOMAINS: 'student.maastrichtuniversity.nl, MaastrichtUniversity.nl', ALLOWED_EMAILS: 'Owner@example.com' })
  assert.deepEqual(policy.domains, ['student.maastrichtuniversity.nl', 'maastrichtuniversity.nl'])
  assert.equal(emailAllowed('a.b@student.maastrichtuniversity.nl', policy), true)
  assert.equal(emailAllowed('Staff@MaastrichtUniversity.nl', policy), true)
  assert.equal(emailAllowed('x@fse.maastrichtuniversity.nl', policy), true)
  assert.equal(emailAllowed('owner@example.com', policy), true)
  assert.equal(emailAllowed('someone@gmail.com', policy), false)
  assert.equal(emailAllowed('evil@maastrichtuniversity.nl.attacker.com', policy), false)
  assert.equal(emailAllowed('evil@notmaastrichtuniversity.nl', policy), false)
  assert.equal(emailAllowed('', policy), false)
  assert.equal(emailAllowed(null, policy), false)
})

test('no policy means everyone is allowed', () => {
  assert.equal(emailAllowed('anyone@gmail.com', accessPolicy({})), true)
})
