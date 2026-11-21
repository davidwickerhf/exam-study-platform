import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { hashPassword } from 'better-auth/crypto'
import { authOptions, authPathNeedsMail, authSiteUrl, isBcryptHash, verifyStoredPassword } from '../lib/better-auth.mjs'
import { codeEmail, sendMail, MailNotConfiguredError } from '../lib/mail.mjs'

test('Clerk bcrypt digests and Better Auth scrypt hashes both verify', async () => {
  const clerk = await bcrypt.hash('correct horse', 4)
  assert.equal(isBcryptHash(clerk), true)
  assert.equal(await verifyStoredPassword({ hash: clerk, password: 'correct horse' }), true)
  assert.equal(await verifyStoredPassword({ hash: clerk, password: 'wrong horse' }), false)
  const native = await hashPassword('battery staple')
  assert.equal(isBcryptHash(native), false)
  assert.equal(await verifyStoredPassword({ hash: native, password: 'battery staple' }), true)
  assert.equal(await verifyStoredPassword({ hash: native, password: 'battery stapler' }), false)
})

test('only the paths that send email are held back without a mail transport', () => {
  for (const path of ['/sign-up/email', '/email-otp/send-verification-otp', '/email-otp/request-password-reset', '/forget-password/email-otp']) assert.equal(authPathNeedsMail(path), true, path)
  for (const path of ['/sign-in/email', '/sign-in/email-otp', '/get-session', '/sign-out', '/email-otp/verify-email', '/email-otp/reset-password']) assert.equal(authPathNeedsMail(path), false, path)
})

test('production refuses to pretend a code was sent when SMTP_URL is unset', async () => {
  await assert.rejects(sendMail({ to: 'a@student.maastrichtuniversity.nl', subject: 's', text: 't' }, { NODE_ENV: 'production' }), MailNotConfiguredError)
  const message = codeEmail({ otp: '123456', type: 'forget-password' })
  assert.match(message.subject, /Reset/)
  assert.match(message.text, /123456/)
})

test('auth options keep tables prefixed, ids stable and sign-up locked to the access policy', async () => {
  const options = authOptions({ env: { BETTER_AUTH_SECRET: 'x'.repeat(32), BETTER_AUTH_URL: 'https://study.wicker.life/app', NODE_ENV: 'production' } })
  assert.equal(options.baseURL, 'https://study.wicker.life')
  assert.deepEqual(options.trustedOrigins, ['https://study.wicker.life'])
  assert.equal(options.user.modelName, 'auth_user')
  assert.equal(options.session.modelName, 'auth_session')
  assert.equal(options.account.modelName, 'auth_account')
  assert.equal(options.verification.modelName, 'auth_verification')
  assert.equal(options.emailAndPassword.requireEmailVerification, true)
  assert.equal(options.socialProviders.google, undefined)
  await assert.rejects(options.databaseHooks.user.create.before({ email: 'someone@gmail.com', name: '' }), /maastrichtuniversity/)
  const allowed = await options.databaseHooks.user.create.before({ email: 'A@Student.MaastrichtUniversity.nl', name: '' })
  assert.equal(allowed.data.email, 'a@student.maastrichtuniversity.nl')
  const withGoogle = authOptions({ env: { BETTER_AUTH_SECRET: 'x', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' } })
  assert.equal(withGoogle.socialProviders.google.clientId, 'id')
  assert.equal(authSiteUrl({ NODE_ENV: 'development', PORT: '4177' }), 'http://localhost:4177')
})
