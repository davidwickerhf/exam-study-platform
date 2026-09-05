import test from 'node:test'
import assert from 'node:assert/strict'
import { isMissingClerkSession } from '../lib/auth.mjs'
import { accessPolicy, emailAllowed, isAccessAdministratorEmail, verifiedPrimaryEmail } from '../lib/access-policy.mjs'

test('access policy is locked to exact Maastricht domains and the administrator exception', () => {
  const policy = accessPolicy()
  assert.deepEqual(policy.domains, ['maastrichtuniversity.nl', 'student.maastrichtuniversity.nl'])
  assert.deepEqual(policy.emails, ['davidwickerhf@gmail.com'])
  assert.equal(emailAllowed('a.b@student.maastrichtuniversity.nl', policy), true)
  assert.equal(emailAllowed('Staff@MaastrichtUniversity.nl', policy), true)
  assert.equal(emailAllowed('x@fse.maastrichtuniversity.nl', policy), false)
  assert.equal(emailAllowed('DavidWickerHF@Gmail.com', policy), true)
  assert.equal(emailAllowed('someone@gmail.com', policy), false)
  assert.equal(emailAllowed('evil@maastrichtuniversity.nl.attacker.com', policy), false)
  assert.equal(emailAllowed('evil@notmaastrichtuniversity.nl', policy), false)
  assert.equal(emailAllowed('', policy), false)
  assert.equal(emailAllowed(null, policy), false)
})

test('deployment variables cannot broaden the locked access policy', () => {
  const policy = accessPolicy({ ALLOWED_EMAIL_DOMAINS: 'gmail.com', ALLOWED_EMAILS: 'someone@gmail.com' })
  assert.equal(emailAllowed('anyone@gmail.com', policy), false)
  assert.equal(emailAllowed('someone@gmail.com', policy), false)
})

test('only the named exception receives administrator access by email', () => {
  assert.equal(isAccessAdministratorEmail('DavidWickerHF@Gmail.com'), true)
  assert.equal(isAccessAdministratorEmail('someone@maastrichtuniversity.nl'), false)
  assert.equal(isAccessAdministratorEmail('davidwickerhf@gmail.com.attacker.test'), false)
})

test('eligibility reads only a verified primary email', () => {
  const user = {
    primaryEmailAddressId: 'primary',
    emailAddresses: [
      { id: 'primary', emailAddress: 'person@gmail.com', verification: { status: 'unverified' } },
      { id: 'secondary', emailAddress: 'person@student.maastrichtuniversity.nl', verification: { status: 'verified' } }
    ]
  }
  assert.equal(verifiedPrimaryEmail(user), null)
  user.emailAddresses[0].verification.status = 'verified'
  assert.equal(verifiedPrimaryEmail(user), 'person@gmail.com')
  user.primaryEmailAddressId = 'secondary'
  assert.equal(verifiedPrimaryEmail(user), 'person@student.maastrichtuniversity.nl')
})

test('a deleted Clerk session or user is treated as signed out', () => {
  assert.equal(isMissingClerkSession({
    status: 404,
    errors: [{ code: 'resource_not_found', message: 'No session was found with id sess_dead' }]
  }), true)
  assert.equal(isMissingClerkSession({
    status: 404,
    errors: [{ code: 'resource_not_found', message: 'No user was found with id user_dead' }]
  }), true)
  assert.equal(isMissingClerkSession({
    status: 404,
    errors: [{ code: 'resource_not_found', message: 'No organisation was found.' }]
  }), false)
  assert.equal(isMissingClerkSession({ status: 500, message: 'Clerk is unavailable.' }), false)
})
