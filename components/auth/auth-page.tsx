'use client'

import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { safeAuthDestination } from '@/lib/workspace/auth-session.mjs'
import { emailAllowed } from '@/lib/access-policy.mjs'
import { authClient } from '@/lib/auth-client'
import { BrandMark } from '@/components/brand/brand-mark'
import { contacts } from '@/lib/site-content'
import { SiteIcon } from '@/components/site/icon'
import { trackEvent } from '@/lib/analytics'

type Step =
  | { kind: 'password' }
  | { kind: 'sign-up' }
  | { kind: 'code-request' }
  | { kind: 'code'; email: string }
  | { kind: 'verify'; email: string; password?: string }
  | { kind: 'reset-request' }
  | { kind: 'reset'; email: string }

const INELIGIBLE = 'Use your @student.maastrichtuniversity.nl or @maastrichtuniversity.nl address.'

type HostedConfig = { google: boolean; emailCodes: boolean }
type AuthError = { code?: string; message?: string; status?: number } | null | undefined

function AuthLoading({ opening = false }: { opening?: boolean }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 10000); return () => clearTimeout(timer) }, [])
  return <div className="py-5" role="status"><p className="text-sm text-muted-foreground">{opening ? 'Opening your workspace…' : 'Loading secure sign-in…'}</p>{slow && <p className="mt-3 text-sm">This is taking longer than expected. <button className="font-semibold text-primary underline" onClick={() => window.location.reload()}>Try again</button></p>}</div>
}

function describe(error: AuthError, fallback: string) {
  switch (error?.code) {
    case 'INVALID_EMAIL_OR_PASSWORD': return 'That email and password do not match. Try again, or use a sign-in code.'
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL': return 'An account already uses this email. Sign in instead.'
    case 'INVALID_OTP': return 'That code is not right. Check the latest email and try again.'
    case 'OTP_EXPIRED': return 'That code has expired. Ask for a new one.'
    case 'TOO_MANY_ATTEMPTS': return 'Too many attempts with that code. Ask for a new one.'
    case 'PASSWORD_TOO_SHORT': return 'Use at least 8 characters for your password.'
    case 'EMAIL_NOT_CONFIGURED': return error.message || 'Email codes are temporarily unavailable.'
    default:
      if (error?.status === 429) return 'Too many attempts. Wait a minute and try again.'
      return error?.message || fallback
  }
}

function Field({ id, label, aside, ...input }: { id: string; label: string; aside?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="auth-field"><label htmlFor={id}><span>{label}</span>{aside}</label><input id={id} name={id} {...input} /></div>
}

function HostedAuth({ signUp }: { signUp: boolean }) {
  const params = useSearchParams()
  const { data: session, isPending } = authClient.useSession()
  const destination = safeAuthDestination(params.get('redirect_url'), typeof window === 'undefined' ? 'https://study.wicker.life' : window.location.origin)
  const switchQuery = `?redirect_url=${encodeURIComponent(destination)}`
  const [step, setStep] = useState<Step>({ kind: signUp ? 'sign-up' : 'password' })
  const [config, setConfig] = useState<HostedConfig>({ google: false, emailCodes: true })
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const leaving = useRef(false)

  useEffect(() => {
    let live = true
    fetch('/api/auth/config', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(body => {
      if (live && body) setConfig({ google: Boolean(body.google), emailCodes: body.emailCodes !== false })
    }).catch(() => undefined)
    return () => { live = false }
  }, [])

  // Arriving with a live session goes straight on; a sign-in completed here
  // leaves through finish(), which is the only place that counts it.
  useEffect(() => {
    if (isPending || !session || leaving.current) return
    leaving.current = true
    window.location.assign(destination)
  }, [isPending, session, destination])

  const go = (next: Step, message: string | null = null) => { setError(null); setNotice(message); setStep(next) }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try { await action() } catch (cause) { setError((cause as Error).message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }

  async function finish() {
    if (leaving.current) return
    leaving.current = true
    trackEvent(signUp ? 'sign-up-completed' : 'sign-in-completed', { resumed: false })
    window.location.assign(destination)
  }

  async function sendCode(address: string, type: 'sign-in' | 'email-verification') {
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({ email: address, type })
    if (failure) throw new Error(describe(failure, 'We could not send a code. Try again.'))
  }

  function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const address = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    setEmail(address)
    void run(async () => {
      const { error: failure } = await authClient.signIn.email({ email: address, password })
      if (failure?.code === 'EMAIL_NOT_VERIFIED') {
        await sendCode(address, 'email-verification')
        go({ kind: 'verify', email: address }, `We sent a code to ${address} to confirm it is yours.`)
        return
      }
      if (failure) throw new Error(describe(failure, 'Sign-in failed. Try again.'))
      await finish()
    })
  }

  function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const address = String(form.get('email') || '').trim()
    const name = String(form.get('name') || '').trim()
    const password = String(form.get('password') || '')
    setEmail(address)
    void run(async () => {
      if (!emailAllowed(address)) throw new Error(INELIGIBLE)
      const { error: failure } = await authClient.signUp.email({ email: address, password, name })
      if (failure) throw new Error(describe(failure, 'We could not create your account. Try again.'))
      // Verification is required before the first session; the code is on its way.
      go({ kind: 'verify', email: address }, `We sent a 6-digit code to ${address}.`)
    })
  }

  function onVerify(event: FormEvent<HTMLFormElement>, address: string) {
    event.preventDefault()
    const otp = String(new FormData(event.currentTarget).get('otp') || '').trim()
    void run(async () => {
      const { error: failure } = await authClient.emailOtp.verifyEmail({ email: address, otp })
      if (failure) throw new Error(describe(failure, 'We could not verify that code.'))
      await finish()
    })
  }

  function onCodeRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = String(new FormData(event.currentTarget).get('email') || '').trim()
    setEmail(address)
    void run(async () => {
      if (!emailAllowed(address)) throw new Error(INELIGIBLE)
      await sendCode(address, 'sign-in')
      go({ kind: 'code', email: address }, `If ${address} can use Wicker Study, a 6-digit code is on its way.`)
    })
  }

  function onCode(event: FormEvent<HTMLFormElement>, address: string) {
    event.preventDefault()
    const otp = String(new FormData(event.currentTarget).get('otp') || '').trim()
    void run(async () => {
      const { error: failure } = await authClient.signIn.emailOtp({ email: address, otp })
      if (failure) throw new Error(describe(failure, 'We could not sign you in with that code.'))
      await finish()
    })
  }

  function onResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = String(new FormData(event.currentTarget).get('email') || '').trim()
    setEmail(address)
    void run(async () => {
      const { error: failure } = await authClient.emailOtp.requestPasswordReset({ email: address })
      if (failure) throw new Error(describe(failure, 'We could not send a reset code. Try again.'))
      go({ kind: 'reset', email: address }, `If an account uses ${address}, a 6-digit reset code is on its way.`)
    })
  }

  function onReset(event: FormEvent<HTMLFormElement>, address: string) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const otp = String(form.get('otp') || '').trim()
    const password = String(form.get('password') || '')
    void run(async () => {
      const { error: failure } = await authClient.emailOtp.resetPassword({ email: address, otp, password })
      if (failure) throw new Error(describe(failure, 'We could not reset your password.'))
      const signedIn = await authClient.signIn.email({ email: address, password })
      if (signedIn.error) { go({ kind: 'password' }, 'Your password is updated. Sign in with it now.'); return }
      await finish()
    })
  }

  function google() {
    void run(async () => {
      const { error: failure } = await authClient.signIn.social({ provider: 'google', callbackURL: destination, errorCallbackURL: `/sign-in${switchQuery}` })
      if (failure) throw new Error(describe(failure, 'Google sign-in is unavailable right now.'))
    })
  }

  if (isPending) return <AuthLoading />
  if (session) return <><AuthLoading opening /><a className="text-sm font-semibold text-primary" href={destination}>Continue to your workspace →</a></>

  const status = <>{error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}</>
  const submit = (label: string, pending: string) => <button type="submit" className="site-button site-button-primary" disabled={busy}>{busy ? pending : label}</button>
  const googleButton = config.google && (step.kind === 'password' || step.kind === 'sign-up') ? <>
    <button type="button" className="site-button auth-provider" disabled={busy} onClick={google}>Continue with Google</button>
    <div className="auth-divider">or</div>
  </> : null
  const back = <button type="button" className="auth-link" onClick={() => go({ kind: signUp ? 'sign-up' : 'password' })}>← Back</button>

  let body: ReactNode
  switch (step.kind) {
    case 'password':
      body = <form className="auth-form" onSubmit={onPassword}>
        {googleButton}
        <Field id="email" label="University email" type="email" autoComplete="username" required defaultValue={email} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required aside={<button type="button" className="auth-link" onClick={() => go({ kind: 'reset-request' })}>Forgot password?</button>} />
        {status}
        {submit('Sign in', 'Signing in…')}
        {config.emailCodes && <div className="auth-alternatives"><button type="button" className="auth-link" onClick={() => go({ kind: 'code-request' })}>Email me a sign-in code instead</button></div>}
      </form>
      break
    case 'sign-up':
      body = <form className="auth-form" onSubmit={onSignUp}>
        {googleButton}
        <Field id="name" label="Name" type="text" autoComplete="name" defaultValue="" />
        <Field id="email" label="University email" type="email" autoComplete="email" required defaultValue={email} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" minLength={8} required aria-describedby="password-hint" />
        <p id="password-hint" className="auth-hint">At least 8 characters. We email a code once to confirm the address.</p>
        {status}
        {submit('Create account', 'Creating account…')}
      </form>
      break
    case 'verify':
      body = <form className="auth-form" onSubmit={event => onVerify(event, step.email)}>
        <p className="auth-hint">Enter the 6-digit code sent to <strong>{step.email}</strong>.</p>
        <Field id="otp" label="Verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        {status}
        {submit('Verify and continue', 'Verifying…')}
        <div className="auth-alternatives">{back}<button type="button" className="auth-link" disabled={busy} onClick={() => void run(async () => { await sendCode(step.email, 'email-verification'); setNotice('A new code is on its way.') })}>Send a new code</button></div>
      </form>
      break
    case 'code-request':
      body = <form className="auth-form" onSubmit={onCodeRequest}>
        <Field id="email" label="University email" type="email" autoComplete="username" required defaultValue={email} autoFocus />
        {status}
        {submit('Email me a code', 'Sending…')}
        <div className="auth-alternatives">{back}</div>
      </form>
      break
    case 'code':
      body = <form className="auth-form" onSubmit={event => onCode(event, step.email)}>
        <Field id="otp" label="Sign-in code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        {status}
        {submit('Sign in', 'Signing in…')}
        <div className="auth-alternatives">{back}<button type="button" className="auth-link" disabled={busy} onClick={() => void run(async () => { await sendCode(step.email, 'sign-in'); setNotice('A new code is on its way.') })}>Send a new code</button></div>
      </form>
      break
    case 'reset-request':
      body = <form className="auth-form" onSubmit={onResetRequest}>
        <p className="auth-hint">We will email you a code to choose a new password.</p>
        <Field id="email" label="University email" type="email" autoComplete="username" required defaultValue={email} autoFocus />
        {status}
        {submit('Email me a reset code', 'Sending…')}
        <div className="auth-alternatives">{back}</div>
      </form>
      break
    case 'reset':
      body = <form className="auth-form" onSubmit={event => onReset(event, step.email)}>
        <Field id="otp" label="Reset code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus />
        <Field id="password" label="New password" type="password" autoComplete="new-password" minLength={8} required />
        {status}
        {submit('Save password and sign in', 'Saving…')}
        <div className="auth-alternatives">{back}</div>
      </form>
      break
  }

  return <>
    {body}
    <p className="auth-switch">{signUp ? <>Already have an account? <a href={`/sign-in${switchQuery}`}>Sign in</a></> : <>New here? <a href={`/sign-up${switchQuery}`}>Create an account</a></>}</p>
  </>
}

export function AuthPage({ mode, enabled, allowedDomains, localAccounts = [] }: { mode: 'sign-in' | 'sign-up'; enabled: boolean; allowedDomains: string[]; localAccounts?: string[] }) {
  const signUp = mode === 'sign-up'
  const [localError, setLocalError] = useState<string | null>(null)
  const [localBusy, setLocalBusy] = useState(false)

  async function localSignIn(email: string) {
    setLocalBusy(true)
    setLocalError(null)
    try {
      const response = await fetch('/api/auth/local-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Test sign-in failed.')
      window.location.assign(safeAuthDestination(new URLSearchParams(window.location.search).get('redirect_url'), window.location.origin))
    } catch (cause) {
      setLocalError((cause as Error).message)
      setLocalBusy(false)
    }
  }

  useEffect(() => {
    document.documentElement.classList.remove('public-mode', 'app-mode')
    document.body.classList.remove('public-mode', 'app-mode')
  }, [])

  return (
    <main id="auth-gate" className="auth-gate">
      <div className="auth-page">
        <section className="auth-form-column" aria-labelledby="auth-title">
          <a className="auth-back" href="/">← Back to Wicker Study</a>
          <a className="site-brand" href="/" aria-label="Wicker Study home"><BrandMark className="site-brand-mark" /><strong>Wicker Study</strong></a>
          <div className="auth-form-copy">
            <h1 id="auth-title">{signUp ? 'Create your study record.' : 'Return to your study record.'}</h1>
            <p>{signUp ? 'Your notes, attempts, mastery history, and review schedule — private to you, on any device.' : 'Open your notes, attempts, mastery history, and review schedule.'}</p>
          </div>
          {allowedDomains.length > 0 && (
            <p className="auth-eligibility">
              Students should use their <code>@student.maastrichtuniversity.nl</code> address. University staff should use <code>@maastrichtuniversity.nl</code>. {signUp ? 'We verify it once, then your password becomes the fast way back in.' : 'Use your password for immediate access. A sign-in code by email remains available as a fallback.'}
            </p>
          )}
          <div id="auth-forms">
            {enabled ? (
              <Suspense fallback={<AuthLoading />}><HostedAuth signUp={signUp} /></Suspense>
            ) : localAccounts.length ? (
              <div className="next-local-access">
                <p>Development test accounts</p>
                {localAccounts.map((email) => <button key={email} type="button" className="site-button site-button-primary" disabled={localBusy} onClick={() => void localSignIn(email)}>Continue as {email} <SiteIcon name="arrow" /></button>)}
                {localError && <p role="alert">{localError}</p>}
              </div>
            ) : (
              <div className="next-local-access"><p>Authentication is disabled in this local environment.</p><a className="site-button site-button-primary" href="/app">Open local workspace <SiteIcon name="arrow" /></a></div>
            )}
          </div>
          {!enabled && <p className="auth-switch">{signUp ? <>Already have an account? <a href="/sign-in">Sign in</a></> : <>New here? <a href="/sign-up">Create an account</a></>}</p>}
          <p className="auth-legal">By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy notice</a>. Need help? <a href={`mailto:${contacts.support}`}>{contacts.support}</a>.</p>
        </section>
        <aside className="auth-product-column" aria-label="Product overview">
          <div className="auth-product-copy"><h2>One place for the full course-to-exam loop.</h2><p>Maintained sources, focused practice, and a private record that resumes on any device.</p></div>
          <div className="auth-course-sheet"><header><span>Today’s study plan</span><strong>3 actions</strong></header><div><b>Continue</b><span>BCS1540 · Dynamic Programming</span><em>22 min</em></div><div><b>Review</b><span>Statistics flashcards</span><em>6 due</em></div><div><b>Correct</b><span>Computer Security mistakes</span><em>3 open</em></div></div>
          <p className="auth-privacy-note"><SiteIcon name="shield" /> Course content is shared. Your notes and progress are private to your account.</p>
        </aside>
      </div>
    </main>
  )
}
