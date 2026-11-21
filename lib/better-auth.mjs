// Self-hosted Better Auth, mounted same-origin at /api/auth/* on the API
// service. Tables live in the app's own Postgres (db/050_better_auth.sql).
//
// User ids imported from Clerk keep their `user_…` strings, so every personal
// table, ADMIN_USER_IDS and programme membership still points at the same
// person. Clerk password hashes are bcrypt; new and reset passwords use Better
// Auth's default scrypt, and verification accepts both.
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { emailOTP } from 'better-auth/plugins'
import bcrypt from 'bcryptjs'
import { emailAllowed } from './access-policy.mjs'
import { codeEmail, mailConfigured, sendMail } from './mail.mjs'
import { hostedAuthEnabled } from './hosted-auth.mjs'
import { poolFor } from './pg.mjs'

export const AUTH_BASE_PATH = '/api/auth'
const DAY = 60 * 60 * 24
const CODE_MINUTES = 10

/** Hosted sign-in is on when the API holds a Better Auth secret. */
export function betterAuthConfigured(env = process.env) {
  return hostedAuthEnabled(env)
}

export function googleConfigured(env = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

export function authSiteUrl(env = process.env) {
  const explicit = String(env.BETTER_AUTH_URL || env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (explicit) return new URL(explicit).origin
  if (env.NODE_ENV === 'production') return 'https://study.wicker.life'
  return `http://localhost:${env.PORT || 4177}`
}

export function isBcryptHash(hash) {
  return /^\$2[abxy]?\$\d{2}\$/.test(String(hash || ''))
}

/** Clerk exports bcrypt digests; everything Better Auth writes is scrypt. */
export async function verifyStoredPassword({ hash, password }) {
  if (isBcryptHash(hash)) return bcrypt.compare(password, hash)
  return verifyPassword({ hash, password })
}

// Paths on Better Auth that send mail. Production refuses them up front while
// SMTP_URL is unset, rather than creating an account whose code never arrives.
const MAIL_PATHS = ['/sign-up/email', '/email-otp/send-verification-otp', '/email-otp/request-password-reset', '/forget-password/email-otp', '/send-verification-email', '/request-password-reset']

export function authPathNeedsMail(path) {
  return MAIL_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}?`))
}

export function authOptions({ env = process.env, database } = {}) {
  const site = authSiteUrl(env)
  const development = env.NODE_ENV !== 'production'
  const trustedOrigins = [site]
  if (development) trustedOrigins.push('http://localhost:*', 'http://127.0.0.1:*')
  const options = {
    appName: 'Wicker Study',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: site,
    basePath: AUTH_BASE_PATH,
    trustedOrigins,
    database,
    telemetry: { enabled: false },
    user: {
      modelName: 'auth_user',
      additionalFields: {
        // Global administrator role, formerly Clerk private metadata
        // `wickerStudyRole`. Never writable from the browser.
        wickerStudyRole: { type: 'string', required: false, input: false }
      }
    },
    session: { modelName: 'auth_session', expiresIn: 30 * DAY, updateAge: DAY },
    account: {
      modelName: 'auth_account',
      // Imported users relink by verified email on their first Google sign-in.
      accountLinking: { enabled: true, trustedProviders: ['google'] }
    },
    verification: { modelName: 'auth_verification' },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyStoredPassword }
    },
    emailVerification: { autoSignInAfterVerification: true },
    socialProviders: {},
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/sign-in/email-otp': { window: 60, max: 10 }
      }
    },
    advanced: {
      // The API sits behind Traefik and the Next.js rewrite proxy.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] }
    },
    databaseHooks: {
      user: {
        create: {
          // Every path that creates an account (password sign-up, email code,
          // Google) passes through here. Access is locked to the university
          // domains in lib/access-policy.mjs, so refuse the rest at the door.
          async before(user) {
            if (!emailAllowed(user.email)) {
              throw new APIError('FORBIDDEN', { message: 'Wicker Study is available to @student.maastrichtuniversity.nl and @maastrichtuniversity.nl addresses.', code: 'EMAIL_NOT_ALLOWED' })
            }
            return { data: { ...user, email: String(user.email).toLowerCase() } }
          }
        }
      }
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_MINUTES * 60,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          // A sign-in code for an address outside the policy could only end in a
          // refused account, so do not send one.
          if (type === 'sign-in' && !emailAllowed(email)) return
          // Not awaited, so response time does not reveal whether an account exists.
          void sendMail({ to: email, ...codeEmail({ otp, type, minutes: CODE_MINUTES }) }, env)
            .catch(error => console.error(`[auth] ${type} email failed: ${error.message}`))
        }
      })
    ]
  }
  if (googleConfigured(env)) {
    options.socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' }
  }
  return options
}

let instance = null

export function getBetterAuth() {
  if (!betterAuthConfigured()) return null
  if (!instance) {
    if (!process.env.DATABASE_URL) throw new Error('Better Auth requires DATABASE_URL.')
    instance = betterAuth(authOptions({ database: poolFor(process.env.DATABASE_URL) }))
  }
  return instance
}

export function authMailReady(env = process.env) {
  return mailConfigured(env) || env.NODE_ENV !== 'production'
}
