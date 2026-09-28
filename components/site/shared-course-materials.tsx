'use client'

import { useAuth } from '@clerk/nextjs'
import { ArrowUpRightIcon, CheckIcon, CopyIcon, LockKeyholeIcon, SearchIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Material = { id: string; title: string; category: 'paper' | 'solutions' | 'material'; academicYear: string; period: string; sourceType: string; mediaType: string; byteSize: number; url: string }
type Index = { courseCode: string; courseName: string | null; materials: Material[] }
type Passage = { title: string; academicYear: string; page: number | null; excerpt: string; url: string }
type Question = { id?: string; chapter: string; type?: string; kind?: string; question: string; expected?: string; options?: string[] }
type Access = 'checking' | 'guest' | 'allowed' | 'denied'

function HostedAccess({ onAccess }: { onAccess: (value: Access) => void }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { onAccess('guest'); return }
    let live = true
    void getToken().then(token => fetch('/api/auth/session', { headers: token ? { authorization: `Bearer ${token}` } : {} }))
      .then(async response => { const session = response.ok ? await response.json() : null; if (live) onAccess(session && (session.admin || /@(student\.)?maastrichtuniversity\.nl$/i.test(session.email || '')) ? 'allowed' : 'denied') })
      .catch(() => { if (live) onAccess('denied') })
    return () => { live = false }
  }, [isLoaded, isSignedIn, getToken, onAccess])
  return null
}

export function SharedCourseMaterials({ courseCode, authEnabled }: { courseCode: string; authEnabled: boolean }) {
  const [index, setIndex] = useState<Index | null>(null)
  const [access, setAccess] = useState<Access>('checking')
  const [tab, setTab] = useState<'files' | 'index' | 'questions'>('files')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<Passage[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const destination = `/share/courses/${encodeURIComponent(courseCode)}/materials`
  useEffect(() => {
    void fetch(`/api/public/materials/${encodeURIComponent(courseCode)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('The materials list could not be loaded.'); return response.json() as Promise<Index> })
      .then(setIndex).catch(cause => setError(cause.message))
  }, [courseCode])
  const loadIndex = useCallback(async () => {
    const response = await fetch(`/api/shared-materials/index/${encodeURIComponent(courseCode)}?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'The index could not be loaded.')
    setPassages(result.passages)
  }, [courseCode, query])
  useEffect(() => {
    if (access !== 'allowed' || tab !== 'index') return
    const timer = window.setTimeout(() => { void loadIndex().catch(cause => setError(cause.message)) }, 300)
    return () => window.clearTimeout(timer)
  }, [access, tab, loadIndex])
  useEffect(() => {
    if (access !== 'allowed' || tab !== 'questions') return
    void fetch(`/api/shared-materials/questions/${encodeURIComponent(courseCode)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Questions could not be loaded.'); return response.json() })
      .then(result => setQuestions(result.questions)).catch(cause => setError(cause.message))
  }, [access, tab, courseCode])
  const visible = useMemo(() => (index?.materials || []).filter(item =>
    (filter === 'all' || item.category === filter) && (!query || tab !== 'files' || item.title.toLowerCase().includes(query.toLowerCase()))), [index, filter, query, tab])
  const years = [...new Set(visible.map(item => item.academicYear || 'Undated'))].sort().reverse()
  return <main id="main-content" className="site-reading-page mx-auto w-full max-w-[1060px] px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
    {authEnabled ? <HostedAccess onAccess={setAccess} /> : <LocalAccess onAccess={setAccess} />}
    <header className="border-b border-current/15 pb-8">
      <p className="font-data text-xs font-semibold uppercase tracking-[0.13em] text-primary">Course archive / {courseCode}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6"><div><h1 className="font-heading text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Course materials</h1><p className="mt-3 text-base text-muted-foreground">{index?.courseName || courseCode} · Shared with Maastricht University members.</p></div><button type="button" className="inline-flex h-10 items-center gap-2 rounded-sm border border-current/20 px-4 text-sm font-semibold" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2500) }}>{copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}{copied ? 'Link copied' : 'Copy page link'}</button></div>
    </header>
    {access === 'guest' && <section className="mt-8 flex flex-wrap items-center justify-between gap-5 border border-primary/25 bg-primary/5 p-5" aria-label="Sign in to open materials"><div className="flex max-w-[58ch] gap-3"><LockKeyholeIcon className="mt-0.5 size-5 shrink-0 text-primary" /><div><h2 className="font-semibold">Open with your Maastricht account</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Sign in or create an account with your university email. You’ll return directly here without completing study setup.</p></div></div><div className="flex gap-2"><a className="site-button site-button-primary" href={`/sign-in?redirect_url=${encodeURIComponent(destination)}`}>Sign in</a><a className="site-button" href={`/sign-up?redirect_url=${encodeURIComponent(destination)}`}>Create account</a></div></section>}
    {access === 'denied' && <p className="mt-8 border p-5 text-sm">Sign in with a verified Maastricht University email to open materials, the index and questions.</p>}
    <nav className="mt-8 flex gap-5 border-b" aria-label="Course archive views">{(['files', 'index', 'questions'] as const).map(value => <button key={value} type="button" className={`border-b-2 px-1 pb-3 text-sm font-semibold capitalize ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => { setTab(value); setQuery(''); setError('') }}>{value === 'index' ? 'Search index' : value === 'questions' ? 'Practice questions' : `Files${index ? ` (${index.materials.length})` : ''}`}</button>)}</nav>
    {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
    {tab === 'files' && <><div className="mt-6 flex flex-wrap items-end gap-3"><label className="text-sm">Find a file<input className="mt-1 block h-10 min-w-64 rounded-sm border bg-background px-3" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filename" /></label><label className="text-sm">Type<select className="mt-1 block h-10 rounded-sm border bg-background px-3" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All files</option><option value="paper">Exam papers</option><option value="solutions">Solutions</option><option value="material">Other materials</option></select></label></div>{!index && !error && <p className="mt-8 text-sm text-muted-foreground">Loading materials…</p>}{index && !visible.length && <p className="mt-8 text-sm text-muted-foreground">No released files match this view yet.</p>}{years.map(year => <section key={year} className="mt-9"><h2 className="border-b pb-2 font-heading text-xl font-semibold">{year}</h2><ul className="divide-y">{visible.filter(item => (item.academicYear || 'Undated') === year).map(item => <li key={item.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 font-data text-xs text-muted-foreground">{item.category === 'paper' ? 'Exam paper' : item.category === 'solutions' ? 'Solutions' : item.sourceType} · {Math.max(1, Math.round(item.byteSize / 1024))} KB</p></div>{access === 'allowed' ? <a className="inline-flex h-9 items-center gap-1 rounded-sm border px-3 text-sm font-semibold" href={item.url} target="_blank" rel="noreferrer">Open <ArrowUpRightIcon className="size-4" /></a> : <span className="text-xs text-muted-foreground">Sign in to open</span>}</li>)}</ul></section>)}</>}
    {tab === 'index' && <section className="mt-6"><p className="text-sm text-muted-foreground">Search passages extracted from released course files. Open the original to check context.</p>{access === 'allowed' && <><label className="mt-5 flex max-w-xl items-center gap-2 border px-3"><SearchIcon className="size-4" /><input className="h-11 w-full bg-transparent outline-none" aria-label="Search indexed materials" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search course material" /></label><ul className="mt-6 divide-y">{passages.map((passage, index) => <li key={`${passage.url}-${index}`} className="py-5"><p className="font-semibold">{passage.title}</p><p className="mt-1 text-xs text-muted-foreground">{passage.academicYear}{passage.page != null ? ` · Page ${passage.page}` : ''}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{passage.excerpt}</p><a className="mt-3 inline-block text-sm font-semibold text-primary" href={passage.url} target="_blank" rel="noreferrer">Open original ↗</a></li>)}</ul>{!passages.length && <p className="mt-6 text-sm text-muted-foreground">No indexed passages found.</p>}</>}</section>}
    {tab === 'questions' && <section className="mt-6"><p className="text-sm text-muted-foreground">Wicker practice questions from the published course bank. These are study exercises, not official university exam questions.</p>{access === 'allowed' && <>{!questions.length && <p className="mt-6 text-sm text-muted-foreground">No published practice questions for this course yet.</p>}<ul className="mt-6 divide-y">{questions.map((question, index) => <li className="py-5" key={question.id || index}><p className="font-data text-xs text-muted-foreground">{question.chapter} · {question.kind || question.type || 'Practice'}</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{question.question}</p>{question.options?.length ? <ol className="mt-2 list-inside list-[lower-alpha] text-sm">{question.options.map(option => <li key={option}>{option}</li>)}</ol> : null}{question.expected && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-primary">Show reference answer</summary><p className="mt-2 whitespace-pre-wrap leading-6">{question.expected}</p></details>}</li>)}</ul></>}</section>}
  </main>
}

function LocalAccess({ onAccess }: { onAccess: (value: Access) => void }) {
  useEffect(() => { void fetch('/api/auth/session').then(response => onAccess(response.ok ? 'allowed' : 'guest')).catch(() => onAccess('guest')) }, [onAccess])
  return null
}
