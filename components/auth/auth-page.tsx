'use client'

import { SignIn, SignUp, useAuth } from '@clerk/nextjs'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeAuthDestination } from '@/lib/workspace/auth-session.mjs'
import { BrandMark } from '@/components/brand/brand-mark'
import { contacts } from '@/lib/site-content'
import { SiteIcon } from '@/components/site/icon'

const appearance = {
  variables: {
    colorPrimary: '#3f51d9',
    colorText: '#20263a',
    colorTextSecondary: '#59627b',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#20263a',
    borderRadius: '4px',
    fontFamily: 'var(--font-ui)',
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
} as const

function AuthLoading({ opening = false }: { opening?: boolean }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 10000); return () => clearTimeout(timer) }, [])
  return <div className="py-5" role="status"><p className="text-sm text-muted-foreground">{opening ? 'Opening your workspace…' : 'Loading secure sign-in…'}</p>{slow && <p className="mt-3 text-sm">This is taking longer than expected. <button className="font-semibold text-primary underline" onClick={() => window.location.reload()}>Try again</button></p>}</div>
}

function HostedAuth({ signUp }: { signUp: boolean }) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const destination = safeAuthDestination(params.get('redirect_url'), typeof window === 'undefined' ? 'https://study.wicker.life' : window.location.origin)
  const switchQuery = `?redirect_url=${encodeURIComponent(destination)}`
  useEffect(() => { if (isLoaded && isSignedIn) router.replace(destination) }, [isLoaded, isSignedIn, destination, router])
  // Do not mount a second sign-in flow over an active session. Pending Clerk
  // session tasks remain signed-out here and are completed inside the widget.
  if (!isLoaded) return <AuthLoading />
  if (isSignedIn) return <><AuthLoading opening /><a className="text-sm font-semibold text-primary" href={destination}>Continue to your workspace →</a></>
  return <>
    {signUp
      ? <SignUp routing="hash" signInUrl={`/sign-in${switchQuery}`} forceRedirectUrl={destination} appearance={appearance} />
      : <SignIn routing="hash" signUpUrl={`/sign-up${switchQuery}`} forceRedirectUrl={destination} appearance={appearance} />}
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
      window.location.assign('/app')
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
              Students should use their <code>@student.maastrichtuniversity.nl</code> address. University staff should use <code>@maastrichtuniversity.nl</code>. {signUp ? 'We verify it once, then your password becomes the fast way back in.' : 'Use your password for immediate access. Email verification remains available as a fallback.'}
            </p>
          )}
          <div id="clerk-sign-in">
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
