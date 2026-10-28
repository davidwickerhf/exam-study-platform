import { NextRequest, NextResponse } from 'next/server'
import { securityHeaders } from './lib/security.mjs'

// Wicker Study now lives in papers.wicker.life (papers PR #14, 27 Oct 2026). In production every page sends visitors
// to papers: its /from-study/ brings their programme and plan over, privacy and terms go to papers' privacy page.
// During the grace period sign-in, the MCP connector's consent pages (/connect), /internal and every /api/* route
// (the hosted MCP, OAuth, the stdio package's REST calls) keep working; the matcher below never sees /api.
const PAPERS = 'https://papers.wicker.life'
const KEEP = /^\/(?:sign-in|sign-up|connect|internal|canvas)(?:\/|$)/
function papersTarget(pathname: string) {
  if (KEEP.test(pathname)) return null
  if (/^\/(?:privacy|terms)(?:\/|$)/.test(pathname)) return `${PAPERS}/privacy/`
  return `${PAPERS}/from-study/`
}

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

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|site.webmanifest).*)'],
}
