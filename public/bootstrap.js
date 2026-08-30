const nativeFetch = window.fetch.bind(window)
const AUTH_TOKEN_TIMEOUT_MS = 5000
const AUTH_TOKEN_EXPIRY_SKEW_MS = 15000
let cachedAuthToken = null
let cachedAuthTokenExpiresAt = 0
let authTokenRequest = null

function deadline(promise, { timeoutMs, signal, message }) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      callback(value)
    }
    const onAbort = () => finish(reject, new DOMException('The request was cancelled.', 'AbortError'))
    const timer = setTimeout(() => finish(reject, new Error(message)), timeoutMs)
    if (signal?.aborted) return onAbort()
    signal?.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    )
  })
}

function tokenExpiresAt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return Number(JSON.parse(atob(payload)).exp || 0) * 1000
  } catch {
    return Date.now() + 30000
  }
}

function clearAuthToken() {
  cachedAuthToken = null
  cachedAuthTokenExpiresAt = 0
}

async function sessionToken({ force = false, signal } = {}) {
  if (!window.__clerkSession) return null
  if (!force && cachedAuthToken && cachedAuthTokenExpiresAt > Date.now() + AUTH_TOKEN_EXPIRY_SKEW_MS) {
    return cachedAuthToken
  }
  if (force) clearAuthToken()
  if (!authTokenRequest) {
    authTokenRequest = deadline(
      window.__clerkSession.getToken(force ? { skipCache: true } : undefined),
      { timeoutMs: AUTH_TOKEN_TIMEOUT_MS, message: 'Your secure session took too long to refresh.' }
    ).then((token) => {
      if (token) {
        cachedAuthToken = token
        cachedAuthTokenExpiresAt = tokenExpiresAt(token)
      }
      return token
    }).finally(() => { authTokenRequest = null })
  }
  return deadline(authTokenRequest, {
    timeoutMs: AUTH_TOKEN_TIMEOUT_MS,
    signal,
    message: 'Your secure session took too long to refresh.'
  })
}

function normalizedPath() {
  const value = window.location.pathname.replace(/\/+$/, '')
  return value || '/'
}

function loadStyle(href) {
  if ([...document.styleSheets].some((sheet) => sheet.href === new URL(href, location.href).href)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error(`Could not load ${src}`))
    document.head.append(script)
  })
}

// Heavy reader/editor libraries are fetched after the shell is on screen and
// awaited only by the surfaces that render markdown, code, diagrams, or PDFs.
let studyDependencies = null
function loadStudyDependencies() {
  if (studyDependencies) return studyDependencies
  studyDependencies = loadStudyDependencyBundle().catch((error) => { studyDependencies = null; throw error })
  window.__studyDepsReady = studyDependencies
  return studyDependencies
}
window.__ensureStudyDeps = loadStudyDependencies

async function loadStudyDependencyBundle() {
  loadStyle('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css')
  loadStyle('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css')
  loadStyle('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css')
  loadStyle('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/theme/eclipse.min.css')
  await Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js').then(() => loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js')),
    loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js').then(() => loadScript('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/languages/x86asm.min.js')),
    loadScript('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js').then(() => Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/clike/clike.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/gas/gas.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/matchbrackets.min.js'),
      loadScript('https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/edit/closebrackets.min.js')
    ])),
    import('https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', flowchart: { useMaxWidth: true } })
      window.__mermaid = mermaid
    }),
    import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'
      window.__pdfjs = pdfjsLib
    })
  ])
}

function snapshotLocalStorage() {
  const snapshot = {}
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key != null) snapshot[key] = localStorage.getItem(key)
  }
  return snapshot
}

function bootSkeleton(step) {
  const block = (w, h = 14) => `<span class="sk" style="width:${w};height:${h}px"></span>`
  return `<div class="dash boot-shell" aria-busy="true" aria-live="polite">
    <aside class="dash-side"><div class="dash-brand"><span class="brand-mark">W</span><span class="dash-brand-text"><strong>Wicker Study</strong><small>Academic workspace</small></span></div>
      <div class="boot-side">${block('100%', 32)}${block('40%', 10)}${block('70%')}${block('60%')}${block('65%')}${block('40%', 10)}${block('60%')}${block('55%')}</div>
      <div class="dash-side-foot boot-foot">${block('100%', 36)}</div></aside>
    <main class="content boot-main"><div class="boot-page">
      <p class="boot-status"><span class="boot-spinner"></span>${step}</p>
      ${block('120px', 11)}${block('42%', 26)}${block('60%', 14)}
      <div class="boot-kpis">${block('100%', 96)}${block('100%', 96)}${block('100%', 96)}${block('100%', 96)}</div>
      ${block('100%', 88)}${block('100%', 240)}
    </div></main></div>`
}
window.__bootStatus = (step) => { const el = document.querySelector('.boot-status'); if (el) el.innerHTML = `<span class="boot-spinner"></span>${step}` }

async function startApplication() {
  document.getElementById('public-site').hidden = true
  document.getElementById('auth-gate').hidden = true
  document.documentElement.classList.remove('public-mode')
  document.body.classList.remove('public-mode')
  document.body.classList.add('app-mode')
  document.getElementById('app').innerHTML = bootSkeleton('Loading your courses…')
  // The application and its first data request start immediately; reader
  // libraries stream in behind them.
  const app = import(`/app.js?v=20260830-docs`)
  setTimeout(() => loadStudyDependencies().catch(() => {}), 0)
  await app
}

async function configureCloudSync() {
  let lastSerialized = ''
  try {
    const remote = await nativeFetch('/api/browser-state', { headers: await authHeaders() }).then((response) => response.ok ? response.json() : {})
    const local = snapshotLocalStorage()
    const merged = Object.keys(remote).length ? { ...local, ...remote } : local
    for (const [key, value] of Object.entries(merged)) localStorage.setItem(key, value)
    lastSerialized = JSON.stringify(merged)

    const push = async () => {
      const serialized = JSON.stringify(snapshotLocalStorage())
      if (serialized === lastSerialized) return
      const response = await nativeFetch('/api/browser-state', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...await authHeaders() },
        body: serialized
      })
      if (response.ok) lastSerialized = serialized
    }
    window.setInterval(() => push().catch(() => {}), 2500)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') push().catch(() => {})
    })
  } catch (error) {
    console.warn('Cloud browser-state sync unavailable:', error)
  }
}

async function authHeaders() {
  const token = await sessionToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function main() {
  const pathname = normalizedPath()
  if (['/', '/about', '/courses', '/docs', '/privacy', '/terms'].includes(pathname)) {
    const { mountPublicSite } = await import('/public-site.js?v=20260830-docs')
    mountPublicSite(pathname)
    return
  }

  document.getElementById('app').innerHTML = bootSkeleton('Checking your session…')
  const config = await nativeFetch('/api/auth/config').then((response) => response.json())
  if (!config.enabled) {
    if (pathname === '/sign-in') window.history.replaceState(null, '', '/app')
    window.__authMode = 'local'
    await configureCloudSync()
    await startApplication()
    return
  }

  const { Clerk } = await import('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/+esm')
  const clerk = new Clerk(config.publishableKey)
  await clerk.load()
  window.__clerk = clerk

  // Clerk's prebuilt component returns social OAuth/SAML flows to this hash.
  // Vanilla integrations must explicitly finish the callback before reading
  // `clerk.user`; otherwise a valid sign-in looks like an empty signed-out UI.
  if (window.location.hash.startsWith('#/sso-callback')) {
    const home = `${window.location.origin}/app`
    await clerk.handleRedirectCallback({
      signInForceRedirectUrl: home,
      signUpForceRedirectUrl: home,
      signInFallbackRedirectUrl: home,
      signUpFallbackRedirectUrl: home
    })
    return
  }
  window.__clerkSession = clerk.session

  if (!clerk.user) {
    if (pathname !== '/sign-in') window.history.replaceState(null, '', '/sign-in')
    const { mountAuthSite } = await import('/public-site.js?v=20260830-docs')
    mountAuthSite()
    clerk.mountSignIn(document.getElementById('clerk-sign-in'), {
      fallbackRedirectUrl: `${window.location.origin}/app`,
      signUpFallbackRedirectUrl: `${window.location.origin}/app`,
      appearance: {
        variables: {
          colorPrimary: '#3f51d9',
          colorText: '#20263a',
          colorTextSecondary: '#59627b',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#20263a',
          borderRadius: '4px',
          fontFamily: '"Manrope", sans-serif',
          fontSize: '14px'
        },
        elements: {
          rootBox: 'clerk-root',
          cardBox: 'clerk-card-box',
          card: 'clerk-card',
          header: 'clerk-header',
          footer: 'clerk-footer',
          socialButtonsBlockButton: 'clerk-social-button',
          formButtonPrimary: 'clerk-primary-button',
          formFieldInput: 'clerk-input'
        }
      }
    })
    return
  }

  if (pathname === '/sign-in') window.history.replaceState(null, '', '/app')

  window.fetch = async (input, init = {}) => {
    const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href)
    const isProtectedApi = requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')
    if (!isProtectedApi) return nativeFetch(input, init)

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}))
    const token = await sessionToken({ signal: init.signal })
    if (!token) throw new Error('Your session is unavailable. Reload the page to sign in again.')
    headers.set('authorization', `Bearer ${token}`)
    let response = await nativeFetch(input, { ...init, headers })

    // A token can expire between entering the workspace and opening a chapter.
    // Refresh once, then return the real 401 so the surface can show recovery UI.
    if (response.status === 401) {
      const refreshed = await sessionToken({ force: true, signal: init.signal })
      if (refreshed && refreshed !== token) {
        headers.set('authorization', `Bearer ${refreshed}`)
        response = await nativeFetch(input, { ...init, headers })
      }
    }
    return response
  }
  await configureCloudSync()
  await startApplication()
}

main().catch((error) => {
  document.getElementById('app').innerHTML = `<main class="boot-error"><h1>Unable to start</h1><p>${String(error.message || error)}</p></main>`
})
