// /api/auth/* (except Wicker's own config/session/local-session paths) is
// served by Better Auth. First-party cookies on the study origin; the Next.js
// web service proxies these requests here like every other /api path.
import { toNodeHandler } from 'better-auth/node'
import { AUTH_BASE_PATH, authMailReady, authPathNeedsMail, getBetterAuth } from './better-auth.mjs'

let handler = null

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

export async function handleBetterAuth(req, res, url) {
  const auth = getBetterAuth()
  if (!auth) { reply(res, 404, { error: 'Hosted sign-in is not enabled in this environment.' }); return }
  const path = url.pathname.slice(AUTH_BASE_PATH.length)
  if (req.method === 'POST' && authPathNeedsMail(path) && !authMailReady()) {
    reply(res, 503, { code: 'EMAIL_NOT_CONFIGURED', message: 'Email codes are temporarily unavailable. Sign in with your password, or try again later.' })
    return
  }
  // Proxies may append values ("https,http"); Better Auth reads the first.
  const proto = req.headers['x-forwarded-proto']
  if (typeof proto === 'string' && proto.includes(',')) req.headers['x-forwarded-proto'] = proto.split(',')[0].trim()
  handler ||= toNodeHandler(auth)
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[auth] handler error', error?.name, String(error?.message || '').slice(0, 200))
    if (!res.headersSent) reply(res, 500, { message: 'Sign-in failed. Please try again.' })
  }
}
