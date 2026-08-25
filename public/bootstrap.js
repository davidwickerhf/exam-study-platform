const nativeFetch = window.fetch.bind(window)

function snapshotLocalStorage() {
  const snapshot = {}
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key != null) snapshot[key] = localStorage.getItem(key)
  }
  return snapshot
}

async function startApplication() {
  await import(`/app.js?v=20260825-cloud`)
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
  const token = await window.__clerkSession?.getToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function main() {
  const config = await nativeFetch('/api/auth/config').then((response) => response.json())
  if (!config.enabled) {
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
    const home = `${window.location.origin}/`
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
    const gate = document.getElementById('auth-gate')
    gate.hidden = false
    clerk.mountSignIn(document.getElementById('clerk-sign-in'), { afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href })
    return
  }

  window.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {})
    const token = await clerk.session?.getToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    return nativeFetch(input, { ...init, headers })
  }
  await configureCloudSync()
  await startApplication()
}

main().catch((error) => {
  document.getElementById('app').innerHTML = `<main class="boot-error"><h1>Unable to start</h1><p>${String(error.message || error)}</p></main>`
})
