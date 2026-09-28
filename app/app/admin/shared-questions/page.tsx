'use client'

import { useEffect, useState } from 'react'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { Button } from '@/components/ui/button'

const COURSES = ['BCS2120', 'BCS2130', 'BCS2140', 'BCS3130', 'BCS3210', 'BCS3300']
type Question = { id: string; kind: string; chapter: string; question: string; expected: string; sourceTitle: string; sourcePage: number | null; sourceUrl: string }
type SetState = { draft: Question[]; published: Question[]; generatedAt?: string; publishedAt?: string }

export default function SharedQuestionReview() {
  const { session } = useWorkspaceSession()
  const [sets, setSets] = useState<Record<string, SetState>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [answerText, setAnswerText] = useState('')
  async function load(code: string) {
    const response = await fetch(`/api/admin/shared-questions/${code}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Question set could not be loaded.')
    setSets(current => ({ ...current, [code]: data }))
  }
  useEffect(() => { if (session?.admin) void Promise.all(COURSES.map(load)).catch(cause => setError(cause.message)) }, [session?.admin])
  async function action(code: string, operation: 'generate' | 'publish', append = false) {
    setBusy(`${code}-${operation}`); setError('')
    try {
      const response = await fetch(`/api/admin/shared-questions/${code}/${operation}${append ? '?append=1' : ''}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `${operation} failed.`)
      await load(code)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }
  async function remove(code: string, id: string) {
    setBusy(`${code}-remove`); setError('')
    try {
      const response = await fetch(`/api/admin/shared-questions/${code}/draft/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Question could not be removed.')
      await load(code)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }
  async function save(code: string, id: string) {
    setBusy(`${code}-save`); setError('')
    try {
      const response = await fetch(`/api/admin/shared-questions/${code}/draft/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: questionText, expected: answerText })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Question could not be saved.')
      setEditing(''); await load(code)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy('') }
  }
  if (!session?.admin) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Administrator access required</h1></main>
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 sm:p-8"><header className="border-b pb-5"><a href="/app/admin" className="text-sm font-semibold text-primary">← Administration</a><h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Shared practice questions</h1><p className="mt-2 max-w-[74ch] text-sm leading-6 text-muted-foreground">Generate questions from approved indexed course materials, check every answer against its cited original, then publish each course set. These are Wicker exercises, not official exam questions.</p></header>
    {error && <p role="alert" className="border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {COURSES.map(code => { const set = sets[code]; return <section key={code} className="border p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-heading text-xl font-semibold">{code}</h2><p className="mt-1 text-sm text-muted-foreground">{set ? `${set.draft.length} draft · ${set.published.length} published` : 'Loading…'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={Boolean(busy)} onClick={() => void action(code, 'generate')}>{busy === `${code}-generate` ? 'Generating…' : 'Generate draft'}</Button><Button variant="outline" disabled={Boolean(busy) || !set?.draft.length} onClick={() => void action(code, 'generate', true)}>Generate more</Button><Button disabled={Boolean(busy) || !set || set.draft.length < 6} onClick={() => void action(code, 'publish')}>Publish reviewed set</Button></div></div>
      {set?.draft.length ? <ol className="mt-5 divide-y border-t">{set.draft.map((question, index) => <li key={question.id} className="py-4 text-sm"><p className="font-data text-xs text-muted-foreground">{index+1}. {question.kind} · {question.chapter}</p>{editing === question.id ? <div className="mt-3 space-y-3"><label className="block font-semibold">Question<textarea className="mt-1 block min-h-24 w-full rounded-md border bg-background p-3 font-normal" value={questionText} onChange={event => setQuestionText(event.target.value)} /></label><label className="block font-semibold">Reference answer<textarea className="mt-1 block min-h-32 w-full rounded-md border bg-background p-3 font-normal" value={answerText} onChange={event => setAnswerText(event.target.value)} /></label><div className="flex gap-2"><Button size="sm" disabled={Boolean(busy)} onClick={() => void save(code, question.id)}>Save revision</Button><Button size="sm" variant="ghost" onClick={() => setEditing('')}>Cancel</Button></div></div> : <><p className="mt-2 font-semibold">{question.question}</p><p className="mt-2 leading-6">Answer: {question.expected}</p></>}<div className="mt-2 flex flex-wrap items-center gap-4"><a className="text-xs font-semibold text-primary" href={question.sourceUrl} target="_blank" rel="noreferrer">Check source: {question.sourceTitle}{question.sourcePage != null ? ` · p. ${question.sourcePage}` : ''} ↗</a><button className="text-xs font-semibold text-primary" disabled={Boolean(busy)} onClick={() => { setEditing(question.id); setQuestionText(question.question); setAnswerText(question.expected) }}>Edit question</button><button className="text-xs font-semibold text-destructive" disabled={Boolean(busy)} onClick={() => void remove(code, question.id)}>Remove from draft</button></div></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">No draft yet.</p>}
    </section> })}
  </main>
}
