'use client'

import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { useEffect, useRef, useState } from 'react'
import { contacts } from '@/lib/site-content'

type Programme = {
  id: string
  degree: string
  name: string
  institution?: { name?: string; city?: string }
}

type SessionPayload = {
  email?: string
  needsProgramme?: boolean
  eligible?: Programme[]
}

type AccessState =
  | { kind: 'loading'; message: string }
  | { kind: 'ineligible'; email: string; allowedDomains: string[] }
  | { kind: 'programme'; email: string; programmes: Programme[]; error?: string; saving?: boolean }
  | { kind: 'error'; message: string }

declare global {
  interface Window {
    __authMode?: 'local'
    __clerk?: unknown
    __clerkSession?: { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> }
    __bootStatus?: (message: string) => void
    __ensureStudyDeps?: () => Promise<void>
    __studyDepsReady?: Promise<void>
    __mermaid?: unknown
    __pdfjs?: unknown
  }
}

const nativeFetch = typeof window === 'undefined' ? fetch : window.fetch.bind(window)

function deadline<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value) },
      (error: unknown) => { window.clearTimeout(timer); reject(error) }
    )
  })
}

function loadStyle(href: string) {
  if ([...document.styleSheets].some((sheet) => sheet.href === new URL(href, location.href).href)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Could not load ${src}`))
    document.head.append(script)
  })
}

const importExternal = (source: string) => import(/* webpackIgnore: true */ source) as Promise<Record<string, unknown>>

let studyDependencies: Promise<void> | null = null

function loadStudyDependencies() {
  if (studyDependencies) return studyDependencies
  studyDependencies = loadStudyDependencyBundle().catch((error: unknown) => {
    studyDependencies = null
    throw error
  })
  window.__studyDepsReady = studyDependencies
  return studyDependencies
}

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
    importExternal('https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs').then((module) => {
      const mermaid = module.default as { initialize: (options: Record<string, unknown>) => void }
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', flowchart: { useMaxWidth: true } })
      window.__mermaid = mermaid
    }),
    importExternal('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs').then((pdfjs) => {
      const library = pdfjs as { GlobalWorkerOptions: { workerSrc: string } }
      library.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'
      window.__pdfjs = library
    })
  ])
}

function snapshotLocalStorage() {
  const snapshot: Record<string, string | null> = {}
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key != null) snapshot[key] = localStorage.getItem(key)
  }
  return snapshot
}

async function configureCloudSync() {
  let lastSerialized = ''
  try {
    const response = await window.fetch('/api/browser-state')
    const remote = response.ok ? await response.json() as Record<string, string> : {}
    const local = snapshotLocalStorage()
    const merged = Object.keys(remote).length ? { ...local, ...remote } : local
    for (const [key, value] of Object.entries(merged)) if (value != null) localStorage.setItem(key, value)
    lastSerialized = JSON.stringify(merged)

    const push = async () => {
      const serialized = JSON.stringify(snapshotLocalStorage())
      if (serialized === lastSerialized) return
      const update = await window.fetch('/api/browser-state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: serialized })
      if (update.ok) lastSerialized = serialized
    }
    window.setInterval(() => void push().catch(() => undefined), 2500)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void push().catch(() => undefined) })
  } catch (error) {
    console.warn('Cloud browser-state sync unavailable:', error)
  }
}

function bootSkeleton(message: string) {
  const block = (width: string, height = 14) => `<span class="sk" style="width:${width};height:${height}px"></span>`
  return `<div class="dash boot-shell" aria-busy="true" aria-live="polite">
    <aside class="dash-side"><div class="dash-brand"><span class="brand-mark">W</span><span class="dash-brand-text"><strong>Wicker Study</strong><small>Academic workspace</small></span></div>
      <div class="boot-side">${block('100%', 32)}${block('40%', 10)}${block('70%')}${block('60%')}${block('65%')}${block('40%', 10)}${block('60%')}${block('55%')}</div>
      <div class="dash-side-foot boot-foot">${block('100%', 36)}</div></aside>
    <main class="content boot-main"><div class="boot-page"><p class="boot-status"><span class="boot-spinner"></span>${message}</p>${block('120px', 11)}${block('42%', 26)}${block('60%', 14)}<div class="boot-kpis">${block('100%', 96)}${block('100%', 96)}${block('100%', 96)}${block('100%', 96)}</div>${block('100%', 88)}${block('100%', 240)}</div></main></div>`
}

function prepareWorkspaceDom(message: string) {
  document.documentElement.classList.remove('public-mode')
  document.documentElement.classList.add('app-mode')
  document.body.classList.remove('public-mode')
  document.body.classList.add('app-mode')
  const root = document.getElementById('app')
  if (root) root.innerHTML = bootSkeleton(message)
  window.__bootStatus = (nextMessage) => {
    const status = document.querySelector('.boot-status')
    if (status) status.innerHTML = `<span class="boot-spinner"></span>${nextMessage}`
  }
  window.__ensureStudyDeps = loadStudyDependencies
}

function loadLegacyApplication(version: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = `/app.js?v=${encodeURIComponent(version)}`
    script.dataset.legacyWorkspace = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('The study workspace bundle could not be loaded.'))
    document.head.append(script)
  })
}

async function startLegacyApplication(version: string) {
  prepareWorkspaceDom('Loading your courses…')
  window.setTimeout(() => void loadStudyDependencies().catch(() => undefined), 0)
  await configureCloudSync()
  await loadLegacyApplication(version)
}

function WorkspaceHost({ state }: { state: AccessState }) {
  if (state.kind === 'ineligible') return (
    <main id="auth-gate" className="auth-gate"><div className="auth-page auth-page-single"><section className="auth-form-column" aria-labelledby="auth-title"><a className="auth-back" href="/">← Back to Wicker Study</a><a className="site-brand" href="/"><span>W</span><strong>Wicker Study</strong></a><div className="auth-form-copy"><h1 id="auth-title">This account isn’t eligible yet.</h1><p>Wicker Study is open to Maastricht University accounts. Sign in with a {state.allowedDomains.map((domain) => `@${domain}`).join(' or ')} address — you are signed in as <strong>{state.email}</strong>.</p></div><p className="auth-actions"><button type="button" className="site-button site-button-primary" data-workspace-sign-out>Sign out and use another account</button></p><p className="auth-legal">Think this is a mistake? Email <a href={`mailto:${contacts.support}`}>{contacts.support}</a> with the address you used.</p></section></div></main>
  )

  if (state.kind === 'programme') return (
    <main id="auth-gate" className="auth-gate"><div className="auth-page auth-page-single"><section className="auth-form-column" aria-labelledby="auth-title"><a className="auth-back" href="/">← Back to Wicker Study</a><a className="site-brand" href="/"><span>W</span><strong>Wicker Study</strong></a><div className="auth-form-copy"><h1 id="auth-title">Which programme are you in?</h1><p>Your address <strong>{state.email}</strong> matches more than one maintained programme. Choose yours to see its courses and institution calendar.</p></div><div className="auth-programmes" role="list">{state.programmes.map((programme) => <button key={programme.id} type="button" className="auth-programme" role="listitem" data-programme={programme.id} disabled={state.saving}><strong>{programme.degree} {programme.name}</strong><span>{programme.institution?.name || ''}{programme.institution?.city ? ` · ${programme.institution.city}` : ''}</span></button>)}</div>{state.error && <p className="auth-error">{state.error}</p>}<p className="auth-legal"><button type="button" className="pl-link pl-link-button" data-workspace-sign-out>Sign out</button></p></section></div></main>
  )

  if (state.kind === 'error') return <main className="next-boot-error"><div><h1>Unable to start</h1><p>{state.message}</p></div></main>

  return <div className="next-workspace-root"><div id="app" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootSkeleton(state.kind === 'loading' ? state.message : 'Loading your courses…') }} /></div>
}

function LocalWorkspace({ version }: { version: string }) {
  const started = useRef(false)
  const [state, setState] = useState<AccessState>({ kind: 'loading', message: 'Loading your courses…' })

  useEffect(() => {
    if (started.current) return
    started.current = true
    window.__authMode = 'local'
    void startLegacyApplication(version).catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) }))
  }, [version])

  return <WorkspaceHost state={state} />
}

function HostedWorkspace({ version, allowedDomains }: { version: string; allowedDomains: string[] }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const started = useRef(false)
  const [state, setState] = useState<AccessState>({ kind: 'loading', message: 'Checking your session…' })

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      window.location.replace('/sign-in')
      return
    }
    if (started.current) return
    started.current = true

    window.__clerk = clerk
    window.__clerkSession = { getToken }
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const inputUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const requestUrl = new URL(inputUrl, window.location.href)
      if (requestUrl.origin !== window.location.origin || !requestUrl.pathname.startsWith('/api/')) return originalFetch(input, init)
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
      const token = await deadline(getToken(), 5000, 'Your secure session took too long to refresh.')
      if (!token) throw new Error('Your session is unavailable. Reload the page to sign in again.')
      headers.set('authorization', `Bearer ${token}`)
      let response = await originalFetch(input, { ...init, headers })
      if (response.status === 401) {
        const refreshed = await deadline(getToken({ skipCache: true }), 5000, 'Your secure session took too long to refresh.')
        if (refreshed && refreshed !== token) {
          headers.set('authorization', `Bearer ${refreshed}`)
          response = await originalFetch(input, { ...init, headers })
        }
      }
      return response
    }

    const begin = async () => {
      const response = await window.fetch('/api/auth/session')
      if (response.status === 403) {
        const detail = await response.json().catch(() => ({})) as { allowedDomains?: string[] }
        setState({ kind: 'ineligible', email: user?.primaryEmailAddress?.emailAddress || '', allowedDomains: detail.allowedDomains || allowedDomains })
        return
      }
      if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || 'Your session could not be verified.')
      const session = await response.json() as SessionPayload
      if (session.needsProgramme && (session.eligible?.length || 0) > 1) {
        setState({ kind: 'programme', email: session.email || '', programmes: session.eligible || [] })
        return
      }
      await startLegacyApplication(version)
    }

    void begin().catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) }))
  }, [allowedDomains, clerk, getToken, isLoaded, isSignedIn, user, version])

  useEffect(() => {
    if (state.kind !== 'ineligible' && state.kind !== 'programme') return
    const signOut = () => void clerk.signOut({ redirectUrl: '/sign-in' })
    const signOutButtons = document.querySelectorAll<HTMLElement>('[data-workspace-sign-out]')
    signOutButtons.forEach((button) => button.addEventListener('click', signOut))

    const choose = async (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement
      if (state.kind !== 'programme') return
      setState({ ...state, saving: true, error: undefined })
      try {
        const response = await window.fetch('/api/account/programme', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ programmeId: button.dataset.programme }) })
        if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || 'Could not join this programme.')
        setState({ kind: 'loading', message: 'Loading your courses…' })
        await startLegacyApplication(version)
      } catch (error) {
        setState({ ...state, saving: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
    const programmeButtons = document.querySelectorAll<HTMLButtonElement>('[data-programme]')
    programmeButtons.forEach((button) => button.addEventListener('click', choose))
    return () => {
      signOutButtons.forEach((button) => button.removeEventListener('click', signOut))
      programmeButtons.forEach((button) => button.removeEventListener('click', choose))
    }
  }, [clerk, state, version])

  return <WorkspaceHost state={state} />
}

export function LegacyWorkspace({ authEnabled, version, allowedDomains }: { authEnabled: boolean; version: string; allowedDomains: string[] }) {
  return authEnabled ? <HostedWorkspace version={version} allowedDomains={allowedDomains} /> : <LocalWorkspace version={version} />
}
