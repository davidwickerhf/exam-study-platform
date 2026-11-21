import { NextRequest, NextResponse } from 'next/server'
import { securityHeaders } from './lib/security.mjs'
import { papersTarget } from './lib/papers-redirect.mjs'

// Native Next.js hosting needs the same per-document CSP as the local server.
// Supplying it to the render request lets Next nonce its own hydration scripts.
export function proxy(request: NextRequest) {
  const target = process.env.NODE_ENV === 'production' && process.env.STUDY_KEEP_PAGES !== '1' ? papersTarget(request.nextUrl.pathname) : null
  if (target) return NextResponse.redirect(target, 308)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const headers = securityHeaders({ page: true, nonce, development: process.env.NODE_ENV !== 'production' })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', headers['Content-Security-Policy'])
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

// The matcher skips /api, the OAuth discovery documents and /skills: next.config.mjs rewrites them to the API, and
// middleware runs before those rewrites. test/papers-redirect.test.mjs checks this list.
export const config = {
  matcher: ['/((?!api/|\\.well-known/|skills/|_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|site.webmanifest).*)'],
}
