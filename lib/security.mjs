import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

// ── Response headers ─────────────────────────────────────────────────────

const CLERK_ORIGINS = 'https://*.clerk.accounts.dev https://*.clerk.com https://clerk.study.wicker.life https://challenges.cloudflare.com'
const CDN = 'https://cdn.jsdelivr.net'

export function contentSecurityPolicy({ nonce = '', development = false } = {}) {
  const nonceSource = nonce ? ` 'nonce-${nonce}'` : ''
  const developmentSource = development ? " 'unsafe-eval'" : ''
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'wasm-unsafe-eval'${nonceSource}${developmentSource} ${CDN} ${CLERK_ORIGINS}`,
    `worker-src 'self' blob: ${CDN}`,
    `style-src 'self' 'unsafe-inline' ${CDN} https://fonts.googleapis.com`,
    `font-src 'self' data: ${CDN} https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com ${CLERK_ORIGINS}`,
    // Wicker Local is a loopback-only, opt-in bridge used solely to create a
    // browser download on the user's own Mac. Keep this exact origin rather
    // than permitting an arbitrary local network destination.
    `connect-src 'self' ${CDN} ${CLERK_ORIGINS} https://api.openai.com http://127.0.0.1:41917`,
    `frame-src ${CLERK_ORIGINS}`,
    "form-action 'self'",
    'upgrade-insecure-requests'
  ].join('; ')
}

export function securityHeaders({ page = false, nonce = '', development = false } = {}) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
  if (page) headers['Content-Security-Policy'] = contentSecurityPolicy({ nonce, development })
  return headers
}

// ── Cross-site mutation guard ────────────────────────────────────────────
// Cookie-authenticated browser requests that mutate state must originate from
// this site. Bearer-authenticated calls (agents, the app's own fetch wrapper)
// carry no ambient credentials and are exempt.
export function isForbiddenCrossSite(req) {
  const method = req.method || 'GET'
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false
  if (req.headers.authorization) return false
  const site = String(req.headers['sec-fetch-site'] || '').toLowerCase()
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origin = req.headers.origin
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host || ''
    try { if (new URL(origin).host !== host) return true } catch { return true }
  }
  return false
}

// ── Client address ───────────────────────────────────────────────────────
export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const candidate = forwarded || req.socket?.remoteAddress || 'unknown'
  return candidate.replace(/^::ffff:/, '')
}

// ── SSRF guard for server-side fetches of user-supplied URLs ─────────────
function privateIPv4(ip) {
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

function privateIPv6(ip) {
  const lower = ip.toLowerCase()
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:')
}

export function isPrivateAddress(ip) {
  const version = isIP(ip)
  if (version === 4) return privateIPv4(ip)
  if (version === 6) return privateIPv6(ip) || (ip.includes('.') && privateIPv4(ip.split(':').pop()))
  return true
}

export async function assertPublicUrl(value) {
  let url
  try { url = new URL(String(value)) } catch { throw new Error('Not a valid URL.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) URLs are allowed.')
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed.')
  if (url.port && !['80', '443', ''].includes(url.port)) throw new Error('Only ports 80 and 443 are allowed.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('Internal hosts are not allowed.')
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Private network addresses are not allowed.')
    return url
  }
  let addresses
  try { addresses = await lookup(host, { all: true }) } catch { throw new Error(`Could not resolve ${host}.`) }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('The host resolves to a private network address.')
  return url
}

// Fetch with redirect re-validation and a byte cap.
export async function safeFetch(value, { maxBytes = 4 * 1024 * 1024, timeoutMs = 15_000, headers = {}, fetchImpl = fetch } = {}) {
  let url = await assertPublicUrl(value)
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetchImpl(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirect without a location.')
      url = await assertPublicUrl(new URL(location, url))
      continue
    }
    const length = Number(response.headers.get('content-length') || 0)
    if (length > maxBytes) throw new Error('The response is too large.')
    const reader = response.body?.getReader?.()
    if (!reader) return { response, text: await response.text() }
    const chunks = []
    let total = 0
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      total += chunk.byteLength
      if (total > maxBytes) { reader.cancel().catch(() => {}); throw new Error('The response is too large.') }
      chunks.push(chunk)
    }
    return { response, text: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8') }
  }
  throw new Error('Too many redirects.')
}
