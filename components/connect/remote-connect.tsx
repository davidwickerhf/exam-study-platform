'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, PencilLine, UserRound } from 'lucide-react'
import { BrandMark } from '@/components/brand/brand-mark'
import { contacts } from '@/lib/site-content'
import styles from './agent-connect.module.css'

type Account = { id: string; email: string | null }
type Pending = { name: string; redirectUri: string; scopes: string[]; account: Account }
type Connection = { id: string; name: string; scopes: string[]; createdAt: string }

export function RemoteConnect() {
  const search = useSearchParams(), request = search.get('request')
  const [pending, setPending] = useState<Pending | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'approve' | 'cancel' | 'disconnect' | null>(null)
  const [loaded, setLoaded] = useState(false), [signIn, setSignIn] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    document.documentElement.classList.remove('app-mode')
    document.body.classList.remove('app-mode')
    setLoaded(false); setSignIn(false); setPending(null); setAccount(null); setConnections([]); setError('')
    fetch(request ? `/api/mcp/consent?request=${encodeURIComponent(request)}` : '/api/mcp/connections', { cache: 'no-store' }).then(async response => {
      const body = await response.json()
      if (cancelled) return
      if (response.status === 401) { setSignIn(true); return }
      if (!response.ok) throw new Error(body.error_description || body.error || 'Could not load this connection.')
      setAccount(body.account || null)
      if (request) setPending(body); else setConnections(body.connections)
    }).catch(error => { if (!cancelled) setError(error.message) }).finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [request, revision])

  async function answer(approved: boolean) {
    setBusy(approved ? 'approve' : 'cancel'); setError('')
    try {
      const response = await fetch('/api/mcp/consent', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request, approved, accountId: pending?.account?.id })
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 401 || body.error === 'account_changed') {
          setPending(null); setAccount(null)
          if (response.status === 401) setSignIn(true)
        }
        throw new Error(body.error_description || body.error || 'Could not complete this connection.')
      }
      window.location.assign(body.redirect)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not complete this connection.'); setBusy(null) }
  }
  async function disconnect(id: string) {
    setBusy('disconnect'); setError('')
    try {
      const response = await fetch(`/api/mcp/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not disconnect this service. Try again.')
      setConnections(current => current.filter(item => item.id !== id))
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not disconnect.') } finally { setBusy(null) }
  }
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(`/connect/remote${request ? `?request=${encodeURIComponent(request)}` : ''}`)}`
  return <main className={styles.page}>
    <div className={styles.consentShell}>
      <div className={styles.consentBrand}><BrandMark className={styles.consentLogo} /><strong>Wicker Study</strong><span>Account connection</span></div>
      <section className={styles.consentCard} aria-labelledby="connection-title" aria-busy={!loaded}>
        <header className={styles.consentHeader}>
          <h1 id="connection-title">{pending ? <>Connect <bdi>{pending.name}</bdi>?</> : request ? 'Connect a service' : 'Connected services'}</h1>
          <p className={styles.lead}>{pending ? 'Review the account and permissions you’re sharing with this service.' : request ? signIn ? 'Sign in to review the service and its requested access.' : 'Review the service and its requested access before connecting.' : 'Manage the services you’ve allowed to access your study account.'}</p>
        </header>
        {account && <div className={styles.consentAccount}>
          <UserRound size={20} aria-hidden="true" />
          <div><span>{pending ? 'You’re authorizing access to' : 'Signed in as'}</span><strong><bdi>{account.email || 'Your signed-in Wicker Study account'}</bdi></strong></div>
        </div>}
        {pending && <>
          <div className={styles.consentSection}>
            <div className={styles.serviceAddress}><span>After approval, return to</span><strong><bdi>{new URL(pending.redirectUri).origin}</bdi></strong></div>
            <h2 className={styles.permissionHeading}>This service will be able to</h2>
            <ul className={styles.permissionList}>{pending.scopes.map(scope => <li key={scope}>
              {scope === 'write' ? <PencilLine size={20} aria-hidden="true" /> : <BookOpen size={20} aria-hidden="true" />}
              <div><strong>{scope === 'write' ? 'Make study changes' : 'Read your study data'}</strong><p>{scope === 'write' ? 'Save answers, progress, plans and context, and request AI processing.' : 'Read your course materials, calendar, groups, progress and saved context.'}</p></div>
            </li>)}</ul>
          </div>
          <div className={styles.consentSection}>
            <p className={styles.consentRevoke}>You stay in control. Disconnect this service at any time in <a href="/connect/remote" target="_blank" rel="noopener noreferrer">Connected services</a>. Access expires after 30 days unless you reconnect.</p>
            <p className={styles.consentDetail}>Your Canvas sign-in credentials are never shared. Only connect a service you trust.</p>
          </div>
        </>}
        {!loaded && <p className={styles.consentSection} role="status">Loading connection…</p>}
        {signIn && <div className={styles.consentSection}><a className={`${styles.primary} ${styles.signInAction}`} href={signInUrl}>Sign in to continue</a></div>}
        {!request && !signIn && loaded && !error && <div className={styles.consentSection}>
          {connections.length ? <ul className={styles.connectionList}>{connections.map(item => <li key={item.id}><div><strong><bdi>{item.name}</bdi></strong><p>{item.scopes.map(scope => scope === 'write' ? 'Make changes' : 'Read access').join(' · ')} · Connected {new Date(item.createdAt).toLocaleDateString()}</p></div><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => disconnect(item.id)}>Disconnect</button></li>)}</ul> : <p className={styles.lead}>No services connected yet.</p>}
        </div>}
        {error && <div className={styles.consentSection}><p role="alert" className={styles.error}>{error}</p>{!pending && !signIn && <button className={`${styles.secondary} ${styles.retryAction}`} onClick={() => setRevision(value => value + 1)}>Reload connection</button>}</div>}
        {pending && <div className={styles.consentActions}>
          <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => answer(false)}>{busy === 'cancel' ? 'Cancelling…' : 'Cancel'}</button>
          <button className={styles.primary} disabled={Boolean(busy) || !pending.account?.id} onClick={() => answer(true)}>{busy === 'approve' ? 'Connecting…' : 'Approve connection'}</button>
        </div>}
      </section>
      <footer className={styles.consentFooter}>
        <nav aria-label="Wicker Study policies and support"><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy notice</a><a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a><a href={`mailto:${contacts.support}`}>Support</a></nav>
        <a className={styles.consentBack} href="/app/settings?tab=api"><ArrowLeft size={14} aria-hidden="true" /> Back to settings</a>
      </footer>
    </div>
  </main>
}
