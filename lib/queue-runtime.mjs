// Preview workers are opt-in and require a separately provisioned database.
// A copied database also contains production accounts: only explicitly selected
// test accounts may run jobs, and automatic discovery stays off in previews.
export function previewWorkerUsers(env = process.env) {
  return (env.WICKER_PREVIEW_WORKER_USERS || '').split(',').map(value => value.trim()).filter(Boolean)
}
export function queueWorkersEnabled(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return true
  try {
    return Boolean(env.WICKER_PREVIEW_DATABASE_HOST && previewWorkerUsers(env).length &&
      new URL(env.DATABASE_URL).hostname === env.WICKER_PREVIEW_DATABASE_HOST)
  } catch { return false }
}
export function queueWorkerAllowsUser(userId, env = process.env) {
  return queueWorkersEnabled(env) && (env.VERCEL_ENV !== 'preview' || previewWorkerUsers(env).includes(userId))
}
export function queueDispatcherOrigin(env = process.env) {
  if (!queueWorkersEnabled(env)) return ''
  // Never fall back to the production alias from a preview API container.
  const host = env.VERCEL_ENV === 'preview'
    ? env.VERCEL_BRANCH_URL || env.VERCEL_URL
    : env.VERCEL_PROJECT_PRODUCTION_URL
  return host ? `https://${host}` : ''
}
export function queueRequestHeaders(env = process.env) {
  return env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}
}
