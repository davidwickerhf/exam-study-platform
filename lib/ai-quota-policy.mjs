import { currentUserId } from './request-context.mjs'
import { identityFor } from './auth.mjs'
const EXEMPT_EMAILS = new Set(['davidwickerhf@gmail.com','d.wicker@student.maastrichtuniversity.nl'])

export function developmentAiQuotasDisabled(env = process.env) {
  if (env.VERCEL_ENV) return ['preview','development'].includes(env.VERCEL_ENV)
  return env.NODE_ENV === 'development' || (!env.NODE_ENV && !env.CI && !env.NODE_TEST_CONTEXT)
}
export function verifiedAccountQuotaExempt(email) {
  return EXEMPT_EMAILS.has(String(email || '').trim().toLowerCase())
}
export async function aiQuotaExemption({owner=currentUserId(),env=process.env,lookup=identityFor} = {}) {
  if (developmentAiQuotasDisabled(env)) return 'development'
  // identityFor reads the verified primary Clerk email and also works in a
  // queued worker with only a user ID. Never trust request-body billing flags.
  try { return verifiedAccountQuotaExempt((await lookup(owner)).email) ? 'account' : null }
  catch { return null }
}
