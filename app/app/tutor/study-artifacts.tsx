'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { readJson, useJson } from '@/components/workspace/use-json'

type Evidence = { id: string; title: string; url?: string }
export type WorkItem = { id: string; title: string; courseCode: string; kind: string; parentId?: string | null; status: string; detail: string; dueDate?: string; responsibility: string; blocker?: string; children?: { id: string; title: string; status: string }[]; canvas?: { status: string; submittedAt?: string; grade?: string; url?: string } | null; source?: { url?: string; title: string } | null }
export type Diagnostic = { id: string; title: string; courseCode: string; topic: string; evidence: Evidence[]; questions: { id: string; prompt: string; options: string[] }[]; attempts: { id: string; score: number; total: number; at: string; feedback: { questionId: string; prompt: string; chosen: string; correct: boolean; answer: string; explanation: string }[] }[] }
export type SubmissionReview = { id: string; title: string; courseCode: string; summary: string; createdAt: string; criteria: { criterion: string; status: 'met' | 'missing' | 'needs-review'; finding: string }[]; evidence: Evidence[] }
export type StudyArtifactsData = { work?: WorkItem[]; diagnostics?: Diagnostic[]; reviews?: SubmissionReview[] }
const statusLabel = (status: string) => ({ todo: 'To do', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Personally done', archived: 'Archived' }[status] || status)

function Sources({ evidence }: { evidence: Evidence[] }) {
  return <details className="border-t px-4 py-3"><summary className="cursor-pointer text-xs font-semibold">Source material</summary><ul className="mt-2 space-y-1">{evidence.map(source => <li key={source.id} className="text-muted-foreground text-xs">{source.url ? <a className="text-primary" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li>)}</ul></details>
}

export function DiagnosticWidget({ diagnostic }: { diagnostic: Diagnostic }) {
  const [current, setCurrent] = useState(diagnostic)
  const latestRecord = useJson<{ diagnostic: Diagnostic }>(`/api/tutor/diagnostics/${encodeURIComponent(diagnostic.id)}`)
  useEffect(() => { if (latestRecord.data) setCurrent(latestRecord.data.diagnostic) }, [latestRecord.data])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<string | null>(null)
  const latest = current.attempts.at(-1)
  const submit = async () => {
    setBusy(true); setError(null)
    request.current ||= crypto.randomUUID()
    try {
      const result = await readJson<{ diagnostic: Diagnostic }>(`/api/tutor/diagnostics/${encodeURIComponent(current.id)}/answers`, { method: 'POST', body: JSON.stringify({ answers, requestId: request.current }) })
      setCurrent(result.diagnostic)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  return <section aria-label={current.title} className="overflow-hidden rounded-[10px] border bg-card">
    <header className="border-b p-4"><p className="text-muted-foreground text-xs">{current.courseCode} · {current.questions.length} questions</p><h3 className="mt-1 text-base font-semibold">{current.title}</h3><p className="text-muted-foreground mt-1 text-xs">A focused practice check. Your result is saved in Study work.</p></header>
    {latestRecord.error && <p role="alert" className="px-4 py-2 text-xs text-destructive">Could not refresh the saved attempt. {latestRecord.error}</p>}
    {latest ? <div className="p-4"><p className="font-data text-3xl font-semibold">{latest.score}<span className="text-muted-foreground text-lg"> / {latest.total}</span></p><p className="text-muted-foreground mt-1 text-xs">{new Date(latest.at).toLocaleDateString('en-GB')} · Formative result, not a course grade</p><ol className="mt-4 divide-y">{latest.feedback.map((feedback, index) => <li key={feedback.questionId} className="py-3 text-sm"><p className="font-semibold">{index + 1}. {feedback.prompt}</p><p className="mt-1">{feedback.correct ? 'Correct' : `Your answer: ${feedback.chosen}. Correct answer: ${feedback.answer}`}</p><p className="text-muted-foreground mt-1 leading-relaxed">{feedback.explanation}</p></li>)}</ol></div> : <form onSubmit={event => { event.preventDefault(); void submit() }} className="space-y-5 p-4">
      {current.questions.map((question, index) => <fieldset key={question.id} disabled={busy}><legend className="mb-2 text-sm font-semibold">{index + 1}. {question.prompt}</legend><div className="space-y-2">{question.options.map((option, choice) => <label key={choice} className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed"><input className="mt-1 accent-primary" type="radio" name={`${current.id}-${question.id}`} checked={answers[question.id] === choice} onChange={() => { request.current = null; setAnswers(previous => ({ ...previous, [question.id]: choice })) }} /><span>{option}</span></label>)}</div></fieldset>)}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}<Button type="submit" disabled={busy || !latestRecord.data || current.questions.some(question => answers[question.id] === undefined)}>{busy ? 'Checking…' : 'Check my answers'}</Button>
    </form>}
    <Sources evidence={current.evidence} />
  </section>
}

export function StudyArtifacts({ data }: { data: StudyArtifactsData }) {
  if (!data.work?.length && !data.diagnostics?.length && !data.reviews?.length) return null
  return <div className="space-y-5">
    {!!data.work?.length && <section aria-label="Personal study checklist" className="overflow-hidden rounded-[10px] border bg-card"><header className="flex items-center justify-between border-b p-4"><h3 className="text-base font-semibold">Study checklist</h3><Link href="/app/tutor/work" className="text-primary text-xs font-semibold">All study work</Link></header><ul className="divide-y">{data.work.map(item => <li key={item.id} className="p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="text-sm font-semibold">{item.title}</h4><span className="text-xs font-semibold">{statusLabel(item.status)}</span></div><p className="text-muted-foreground font-data mt-1 text-xs">{[item.courseCode, item.responsibility, item.dueDate && `Target ${item.dueDate}`].filter(Boolean).join(' · ')}</p>{item.detail && <p className="mt-2 text-sm leading-relaxed">{item.detail}</p>}{item.blocker && <p className="mt-2 text-xs font-semibold">Blocked by: {item.blocker}</p>}{!!item.children?.length && <ul className="mt-3 space-y-2 border-l pl-3">{item.children.map(child => <li className="flex justify-between gap-2 text-xs" key={child.id}><span>{child.title}</span><span className="text-muted-foreground shrink-0">{statusLabel(child.status)}</span></li>)}</ul>}{item.source && <p className="text-muted-foreground mt-3 text-xs">Canvas: {item.canvas ? `${item.canvas.status}${item.canvas.grade ? ` · grade ${item.canvas.grade}` : ''}` : 'Submission status not checked in this view'} · <a className="text-primary" href={item.source.url} target="_blank" rel="noreferrer">Open assignment</a></p>}</li>)}</ul><p className="text-muted-foreground border-t px-4 py-3 text-xs">Personal completion is separate from Canvas submission and grading. Ask Tutor to update your checklist.</p></section>}
    {data.diagnostics?.map(diagnostic => <DiagnosticWidget key={diagnostic.id} diagnostic={diagnostic} />)}
    {data.reviews?.map(review => <section key={review.id} aria-label={review.title} className="overflow-hidden rounded-[10px] border bg-card"><header className="border-b p-4"><p className="text-muted-foreground text-xs">{review.courseCode} · Formative submission check</p><h3 className="mt-1 text-base font-semibold">{review.title}</h3><p className="mt-2 text-sm">{review.summary}</p></header><ul className="divide-y">{review.criteria.map((criterion, index) => <li key={index} className="p-4"><div className="flex justify-between gap-3 text-sm"><h4 className="font-semibold">{criterion.criterion}</h4><span className="shrink-0 text-xs">{{ met: 'Met', missing: 'Missing', 'needs-review': 'Needs review' }[criterion.status]}</span></div><p className="text-muted-foreground mt-2 text-sm leading-relaxed">{criterion.finding}</p></li>)}</ul><Sources evidence={review.evidence} /></section>)}
  </div>
}
