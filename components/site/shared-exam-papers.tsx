'use client'

import { useAuth } from '@clerk/nextjs'
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, CopyIcon, FileTextIcon, LockKeyholeIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type Paper = { id: string; title: string; kind: 'paper' | 'solutions'; academicYear: string; period: string; byteSize: number; url: string; downloadUrl: string }
type Index = { courseCode: string; courseName: string | null; papers: Paper[] }
type Access = 'checking' | 'guest' | 'allowed' | 'denied'

function HostedAccess({ onAccess }: { onAccess: (value: Access) => void }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { onAccess('guest'); return }
    let live = true
    void getToken().then(token => fetch('/api/auth/session', { headers: token ? { authorization: `Bearer ${token}` } : {} }))
      .then(response => { if (live) onAccess(response.ok ? 'allowed' : 'denied') })
      .catch(() => { if (live) onAccess('denied') })
    return () => { live = false }
  }, [isLoaded, isSignedIn, getToken, onAccess])
  return null
}

function LocalAccess({ onAccess }: { onAccess: (value: Access) => void }) {
  useEffect(() => {
    let live = true
    void fetch('/api/auth/session').then(response => { if (live) onAccess(response.ok ? 'allowed' : 'guest') })
      .catch(() => { if (live) onAccess('guest') })
    return () => { live = false }
  }, [onAccess])
  return null
}

export function SharedExamPapers({ courseCode, authEnabled }: { courseCode: string; authEnabled: boolean }) {
  const [index, setIndex] = useState<Index | null>(null)
  const [error, setError] = useState('')
  const [access, setAccess] = useState<Access>('checking')
  const [copied, setCopied] = useState(false)
  const destination = `/share/courses/${encodeURIComponent(courseCode)}/exam-papers`
  useEffect(() => {
    let live = true
    void fetch(`/api/public/exam-papers/${encodeURIComponent(courseCode)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('The paper list could not be loaded.'); return response.json() as Promise<Index> })
      .then(value => { if (live) setIndex(value) })
      .catch(cause => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [courseCode])
  const years = useMemo(() => [...new Set(index?.papers.map(paper => paper.academicYear || 'Undated') || [])].sort().reverse(), [index])

  return <main id="main-content" className="site-reading-page mx-auto w-full max-w-[1060px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
    {authEnabled ? <HostedAccess onAccess={setAccess} /> : <LocalAccess onAccess={setAccess} />}
    <div className="border-b border-current/15 pb-8">
      <p className="font-data text-xs font-semibold tracking-[0.13em] uppercase text-primary"><a className="underline-offset-4 hover:underline" href="/share/courses">Course archive</a> / {courseCode}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">Exam papers</h1>
          <p className="mt-3 max-w-[62ch] text-base text-muted-foreground">{index?.courseName || courseCode} · Papers shared for Maastricht University members.</p>
        </div>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-current/20 px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2500) }}>
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}{copied ? 'Link copied' : 'Copy page link'}
        </button>
      </div>
    </div>

    <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-primary/25 bg-primary/5 p-5" aria-label="Continue in workspace"><div><h2 className="font-semibold">Practise this course in your workspace</h2><p className="mt-1 text-sm text-muted-foreground">Use papers alongside course practice, progress and study tools.</p></div><a className="site-button site-button-primary" href={`/app/courses/${encodeURIComponent(courseCode)}?tab=papers`}>Open in workspace <ArrowRightIcon className="size-4" /></a></section>

    {access === 'guest' && <section className="mt-8 flex flex-wrap items-center justify-between gap-5 border border-primary/25 bg-primary/5 p-5 sm:p-6" aria-label="Sign in to open papers">
      <div className="flex max-w-[58ch] gap-3"><LockKeyholeIcon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="text-base font-semibold">Open with your Maastricht account</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Sign in or create an account with your university email. You’ll return directly to this page; no study setup is needed.</p></div></div>
      <div className="flex gap-2"><a className="site-button site-button-primary" href={`/sign-in?redirect_url=${encodeURIComponent(destination)}`}>Sign in</a><a className="site-button" href={`/sign-up?redirect_url=${encodeURIComponent(destination)}`}>Create account</a></div>
    </section>}
    {access === 'denied' && <p className="mt-8 border border-current/20 p-5 text-sm">This account cannot open shared exam papers. Sign in with a verified Maastricht University email.</p>}
    {access === 'allowed' && <p className="mt-8 text-sm text-muted-foreground">You can open the available papers directly. Your study setup can wait.</p>}

    {error && <p role="alert" className="mt-8 text-sm">{error}</p>}
    {!index && !error && <p className="mt-8 text-sm text-muted-foreground" role="status">Loading the exam-paper register…</p>}
    {index && !index.papers.length && <section className="mt-10 border-y border-current/15 py-8"><h2 className="text-lg font-semibold">No papers released yet</h2><p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted-foreground">A shared link can be used once exam originals for this course have passed review. Check back later.</p></section>}

    {years.map(year => <section key={year} className="mt-10" aria-label={`${year} exam papers`}>
      <div className="flex items-baseline justify-between border-b border-current/20 pb-2"><h2 className="font-heading text-xl font-semibold">{year}</h2><span className="font-data text-xs text-muted-foreground">{index?.papers.filter(paper => (paper.academicYear || 'Undated') === year).length} files</span></div>
      <ul>{index?.papers.filter(paper => (paper.academicYear || 'Undated') === year).map(paper => <li key={paper.id} className="flex flex-wrap items-center gap-4 border-b border-current/10 py-4">
        <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{paper.title}</p><p className="mt-1 font-data text-xs text-muted-foreground">{paper.kind === 'solutions' ? 'Solutions' : 'Question paper'}{paper.period ? ` · ${paper.period}` : ''} · {Math.max(1, Math.round(paper.byteSize / 1024))} KB</p></div>
        {access === 'allowed' ? <a className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-current/20 px-3 text-sm font-semibold hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" href={paper.url} target="_blank" rel="noreferrer">Open <ArrowUpRightIcon className="size-4" /></a> : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyholeIcon className="size-3.5" /> Sign in to open</span>}
      </li>)}</ul>
    </section>)}
  </main>
}
