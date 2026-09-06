'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StudyReader } from '@/components/workspace/study-reader'
import { studyRequest, type StudyChapter, type StudyRevision } from '@/lib/workspace/study-versions'

type Evaluation = {
  id: string; revision: string; scenario: string; status: string; stage: number
  course: StudyRevision['course']; snapshot: StudyRevision['snapshot']; topic: StudyRevision['topics'][number]
  billing: { model: string; source: string; maxJobUsd: number }
  generated: StudyChapter | null; limitations: string; error?: string
  checks: { name: string; passed: boolean; issues: (string | { severity: string; detail: string })[] }[]
  calls: { chargedUsd: number; conservative: boolean; usage: { inputTokens: number; outputTokens: number } | null }[]
}
export default function QualityEvaluationPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>()
  const [data, setData] = useState<Evaluation | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const path = `/api/study-versions/evaluations/${evaluationId}`
  useEffect(() => {
    let active = true
    setData(null)
    const load = () => studyRequest<Evaluation>(path).then(r => { if (active) { setData(r); setError('') } }).catch(e => { if (active) setError(e.message) })
    void load()
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 10000)
    return () => { active = false; clearInterval(interval) }
  }, [path])
  async function nextStep() {
    if (!data || busy) return
    setBusy(true); setError('')
    try { setData(await studyRequest<Evaluation>(`${path}/step`, { revision: data.revision })) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const chapter = data?.generated
  const revision: StudyRevision | null = data && chapter ? {
    id: data.id, versionId: data.id, course: data.course, snapshot: data.snapshot, topics: [data.topic],
    chapters: [{ ...chapter, id: data.topic.id, review: 'diagnostic',
      questions: chapter.questions.map((q, i) => ({ ...q, id: `evaluation-q-${i}` })),
      flashcards: chapter.flashcards.map((f, i) => ({ ...f, id: `evaluation-f-${i}` })) }],
    gaps: [], issues: [], review: 'diagnostic'
  } : null
  return <main className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
    <Link href="/app/settings?tab=ai-key" className="text-muted-foreground text-sm hover:text-foreground">Back to AI settings</Link>
    <header>
      <Badge variant="outline">Private quality evaluation</Badge>
      <h1 className="font-heading mt-3 text-2xl font-semibold tracking-tight">Inspect the teaching, then check the evidence.</h1>
      <p className="text-muted-foreground mt-2 text-sm">This diagnostic uses the course generator’s prompts and spending controls. Each button runs one paid step.</p>
    </header>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!data && !error && <Skeleton className="h-64 w-full" />}
    {data && <>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{data.scenario === 'reference' ? 'Probability reference test' : data.topic.title}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{data.billing.model} · {data.billing.source === 'personal' ? 'Your AI key' : 'Platform allowance'} · ${data.billing.maxJobUsd.toFixed(2)} total cap</p>
            <p className="text-muted-foreground mt-1 text-xs">{data.calls.length} calls recorded · ${data.calls.reduce((n, c) => n + c.chargedUsd, 0).toFixed(4)} recorded cost · {data.status}</p>
          </div>
          {data.status === 'pending' && <Button disabled={busy} onClick={() => void nextStep()}>{busy ? 'Running…' : ['Generate test chapter', 'Review against sources', 'Test reviewer with known errors'][data.stage]}</Button>}
          {data.status === 'running' && <p className="text-muted-foreground text-sm">Model call in progress. This page will update when its result is saved.</p>}
        </div>
        {data.checks.length > 0 && <ul className="divide-y">{data.checks.map((check, i) => <li className="py-3" key={i}>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={check.passed ? 'secondary' : 'destructive'}>{check.passed ? 'Passed' : 'Needs attention'}</Badge><span className="text-sm font-medium">{check.name}</span></div>
          {check.issues.length > 0 && <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">{check.issues.map((issue, j) => <li key={j}>{typeof issue === 'string' ? issue : `${issue.severity}: ${issue.detail}`}</li>)}</ul>}
        </li>)}</ul>}
        <p className="text-muted-foreground text-xs leading-5">{data.limitations}</p>
      </section>
      {revision && <StudyReader revision={revision} />}
    </>}
  </main>
}
