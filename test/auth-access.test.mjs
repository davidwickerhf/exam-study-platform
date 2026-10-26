import test from 'node:test'
import assert from 'node:assert/strict'
import { isBetterAuthRoute, isPublicApi } from '../lib/auth.mjs'
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

test('Better Auth serves /api/auth/* except the three paths Wicker owns', () => {
  for (const path of ['/api/auth/sign-in/email', '/api/auth/get-session', '/api/auth/email-otp/send-verification-otp', '/api/auth/callback/google', '/api/auth/sign-out']) {
    assert.equal(isBetterAuthRoute(path), true, path)
    assert.equal(isPublicApi(path), true, path)
  }
  for (const path of ['/api/auth/session', '/api/auth/config', '/api/auth/local-session', '/api/account', '/api/authx']) assert.equal(isBetterAuthRoute(path), false, path)
  assert.equal(isPublicApi('/api/auth/session'), false)
})

test('a Better Auth user row is eligible only through a verified email', () => {
  assert.equal(verifiedPrimaryEmail({ email: 'Person@Student.MaastrichtUniversity.nl', emailVerified: true }), 'person@student.maastrichtuniversity.nl')
  assert.equal(verifiedPrimaryEmail({ email: 'person@student.maastrichtuniversity.nl', emailVerified: false }), null)
})
