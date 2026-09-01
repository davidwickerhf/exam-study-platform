// Getting a key without putting one in a chat transcript.
//
// The agent opens a listener bound to loopback, sends the user to /connect with
// a verifier challenge and that listener's address, and waits. The browser
// approves; Wicker Study redirects back to loopback with a single-use code; the
// agent exchanges code + verifier for a key and stores it globally.
//
// The key therefore travels browser → loopback → disk. It is never printed,
// never passed as a tool argument, and never leaves the machine that asked for
// it — Wicker Study refuses any callback that is not loopback.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { saveApiKey } from './config.mjs'

export const AUTHORIZE_TIMEOUT_MS = 5 * 60_000

function base64url(bytes) { return bytes.toString('base64url') }

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f7f4;color:#20263a;
      font:400 15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:420px;padding:32px;background:#fff;border:1px solid #dfe2ea;border-radius:12px;text-align:center}
    h1{margin:0 0 8px;font-size:19px;letter-spacing:-.02em}p{margin:0;color:#59627b;font-size:13.5px}
  </style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`
}

// Bound to 127.0.0.1 explicitly so nothing on the network can reach it. The
// caller needs the address straight away and the code much later, so the two
// are handed back as separate promises.
export function startCallbackListener({ timeoutMs = AUTHORIZE_TIMEOUT_MS } = {}) {
  const state = base64url(randomBytes(24))
  let resolveCode
  let rejectCode
  const code = new Promise((resolve, reject) => { resolveCode = resolve; rejectCode = reject })
  let settled = false

  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return }
    if (!sameSecret(url.searchParams.get('state') || '', state)) {
      res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
      res.end(page('That did not match', 'This response did not come from the authorization this agent started. Nothing has been saved.'))
      return
    }
    const failure = url.searchParams.get('error')
    const value = url.searchParams.get('code')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(failure || !value
      ? page('Authorization cancelled', 'Nothing was granted. You can close this tab and try again from your agent.')
      : page('Wicker Study is connected', 'You can close this tab and go back to your agent.'))
    settle(failure ? new Error('The authorization was cancelled in the browser.') : null, value)
  })

  function settle(error, value) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    setTimeout(() => server.close(), 250).unref?.()
    if (error) rejectCode(error); else resolveCode(value)
  }

  const timer = setTimeout(() => settle(new Error(`No response within ${Math.round(timeoutMs / 60_000)} minutes. Start the authorization again.`)), timeoutMs)
  timer.unref?.()
  server.once('error', (error) => settle(error))

  const address = new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ port, redirectUri: `http://127.0.0.1:${port}/callback`, state })
    })
  })

  return { address, code, state, cancel: () => settle(new Error('The authorization was cancelled.')) }
}

export function authorizationUrl(serverUrl, { name, scopes, challenge, state, redirectUri }) {
  const url = new URL('/connect', serverUrl)
  url.searchParams.set('name', name)
  url.searchParams.set('scopes', scopes.join(','))
  url.searchParams.set('challenge', challenge)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', redirectUri)
  return url.toString()
}

export function makeVerifier() {
  const verifier = base64url(randomBytes(32))
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export async function exchange(serverUrl, { code, verifier }) {
  const response = await fetch(new URL('/api/agent/authorize/exchange', serverUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ code, verifier })
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || `The authorization could not be completed (HTTP ${response.status}).`)
  if (!body?.apiKey) throw new Error('Wicker Study returned no API key.')
  return body
}

// The whole flow. Returns the loopback URL to show the user immediately, and a
// promise that settles when they have finished in the browser.
export function beginAuthorization(serverUrl, { name = 'Agent (MCP)', scopes = ['read', 'write'], timeoutMs = AUTHORIZE_TIMEOUT_MS } = {}) {
  const { verifier, challenge } = makeVerifier()
  const listener = startCallbackListener({ timeoutMs })
  const ready = listener.address.then((address) => ({
    url: authorizationUrl(serverUrl, { name, scopes, challenge, state: address.state, redirectUri: address.redirectUri }),
    redirectUri: address.redirectUri
  }))
  const completed = (async () => {
    await ready
    const granted = await exchange(serverUrl, { code: await listener.code, verifier })
    const saved = await saveApiKey(serverUrl, granted.apiKey, granted)
    return { ...saved, name: granted.name, scopes: granted.scopes, expiresAt: granted.expiresAt }
  })()
  // The caller may only await this much later, or never (the user walked away).
  // Keep an unobserved rejection from taking the process down; the rejection is
  // still delivered to whoever does await it.
  completed.catch(() => {})
  return { ready, completed, cancel: listener.cancel }
}
