'use client'

// The browser half of the agent authorization. An agent running on this
// machine sends the user here with a name, the scopes it wants, a challenge,
// and a loopback address to answer on. Nothing is granted until the signed-in
// account presses Authorise, and the answer only ever goes back to loopback.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './agent-connect.module.css'

const SCOPE_COPY: Record<string, { title: string; detail: string }> = {
  read: { title: 'Read', detail: 'Course material, questions, your progress, plan, and calendar.' },
  write: { title: 'Study on your behalf', detail: 'Record answers, flashcard reviews, mastery, mistakes, and plan changes.' },
  admin: { title: 'Maintain content', detail: 'The editorial workflow and the programme catalogue. Administrators only.' }
}

type Request = { name: string; scopes: string[]; challenge: string; state: string; redirectUri: string }
type Status = 'idle' | 'working' | 'granted' | 'denied'

function loopback(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  } catch { return false }
}

function parseRequest(search: URLSearchParams): { request: Request | null; problem: string | null } {
  const redirectUri = search.get('redirect_uri') || ''
  const challenge = search.get('challenge') || ''
  if (!redirectUri || !challenge) return { request: null, problem: 'This link is incomplete. Start the connection again from your agent — it needs to supply its own callback address and challenge.' }
  // Refusing a non-loopback callback here is the whole point: an agent key must
  // never be deliverable to a machine other than the one asking for it.
  if (!loopback(redirectUri)) return { request: null, problem: 'This link asks Wicker Study to send an API key somewhere other than this computer. It has been refused. Only an agent running locally can be authorised this way.' }
  const scopes = (search.get('scopes') || 'read')
    .split(/[ ,]+/)
    .map((scope) => scope.trim().toLowerCase())
    .filter((scope) => scope in SCOPE_COPY)
  return {
    request: {
      name: (search.get('name') || 'Agent (MCP)').slice(0, 80),
      scopes: scopes.includes('read') ? scopes : ['read', ...scopes],
      challenge,
      state: search.get('state') || '',
      redirectUri
    },
    problem: null
  }
}

export function AgentConnect() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [account, setAccount] = useState<string | null>(null)

  // Read through the router rather than window.location: the page is rendered
  // on the server first, and reading the address bar during render would make
  // the two disagree.
  const search = useSearchParams()
  const { request, problem } = useMemo(() => parseRequest(new URLSearchParams(search.toString())), [search])
  const [href, setHref] = useState('/connect')
  useEffect(() => { setHref(window.location.href) }, [])

  // /app locks the document viewport; a direct route transition must release it.
  useEffect(() => { document.documentElement.classList.remove('app-mode') }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/me', { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return
        if (!response.ok) { setSignedIn(false); return }
        const body = await response.json()
        setSignedIn(true)
        setAccount(body?.email || body?.userId || null)
      })
      .catch(() => { if (!cancelled) setSignedIn(false) })
    return () => { cancelled = true }
  }, [])

  const answer = useCallback((params: Record<string, string>) => {
    if (!request) return
    const target = new URL(request.redirectUri)
    for (const [key, value] of Object.entries(params)) if (value) target.searchParams.set(key, value)
    if (request.state) target.searchParams.set('state', request.state)
    window.location.replace(target.toString())
  }, [request])

  const authorise = useCallback(async () => {
    if (!request) return
    setStatus('working')
    setError(null)
    try {
      const response = await fetch('/api/agent/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: request.name, scopes: request.scopes, redirectUri: request.redirectUri, challenge: request.challenge })
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Authorization failed (${response.status}).`)
      setStatus('granted')
      answer({ code: body.code })
    } catch (failure) {
      setStatus('idle')
      setError(failure instanceof Error ? failure.message : 'This agent could not be authorised.')
    }
  }, [answer, request])

  const deny = useCallback(() => {
    setStatus('denied')
    answer({ error: 'access_denied' })
  }, [answer])

  if (problem || !request) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>This connection link cannot be used</h1>
          <p className={styles.lead}>{problem || 'Start the connection again from your agent.'}</p>
          <a className={styles.secondary} href="/app">Go to Wicker Study</a>
        </section>
      </main>
    )
  }

  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(href)}`

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Connect an agent</p>
        <h1>{request.name} wants to use your Wicker Study account</h1>
        <p className={styles.lead}>
          It is running on this computer and will receive its own API key. The key is delivered
          straight back to <code>{new URL(request.redirectUri).host}</code> — it is never shown in a
          chat, and it never leaves this machine.
        </p>

        <ul className={styles.scopes}>
          {request.scopes.map((scope) => (
            <li key={scope}>
              <strong>{SCOPE_COPY[scope]?.title || scope}</strong>
              <span>{SCOPE_COPY[scope]?.detail || 'Additional access.'}</span>
            </li>
          ))}
        </ul>

        <p className={styles.note}>
          Your Canvas Personal Access Token is not part of this. It stays encrypted in your account
          and is never given to an agent. The key expires in a year and you can revoke it at any
          time under <a href="/app/account?tab=api">Account → API access</a>.
        </p>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        {signedIn === false ? (
          <div className={styles.actions}>
            <a className={styles.primary} href={signInUrl}>Sign in to continue</a>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={authorise} disabled={status !== 'idle' || signedIn === null}>
              {status === 'working' ? 'Authorising…' : status === 'granted' ? 'Authorised — returning to your agent…' : 'Authorise'}
            </button>
            <button type="button" className={styles.secondary} onClick={deny} disabled={status !== 'idle'}>Cancel</button>
          </div>
        )}

        {account ? <p className={styles.account}>Signed in as {account}</p> : null}
      </section>
    </main>
  )
}
