'use client'

import { useEffect, useState } from 'react'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { Button } from '@/components/ui/button'

type Candidate = {
  snapshotId: string; filename: string; sourcePath: string; kind: 'paper' | 'solutions'
  courseCode: string; courseName: string; academicYear: string; editionId: string
  consentStatus: string; status: 'pending' | 'approved' | 'withheld'; note: string
}

export default function ExamPaperReviews() {
  const { session } = useWorkspaceSession()
  const [papers, setPapers] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  async function load() {
    const response = await fetch('/api/admin/exam-papers')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Exam-paper candidates could not be loaded.')
    setPapers(result.papers)
  }
  useEffect(() => { if (session?.admin) void load().catch(cause => setError(cause.message)) }, [session?.admin])
  async function review(paper: Candidate, status: 'approved' | 'withheld') {
    setBusy(paper.snapshotId)
    setError('')
    try {
      const note = status === 'approved'
        ? window.prompt('Record the basis for allowing this original to be shared with all verified Maastricht University members:')
        : window.prompt('Reason for withholding this original (optional):', paper.note)
      if (note === null) return
      if (status === 'approved' && !note.trim()) { setError('Record a rights basis before approving an original.'); return }
      const response = await fetch('/api/admin/exam-papers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshotId: paper.snapshotId, status, note }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Review failed.')
      await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(null) }
  }
  if (!session?.admin) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Administrator access required</h1></main>
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-7 p-6 sm:p-8">
    <header className="border-b pb-5"><a href="/app/admin" className="text-primary text-sm font-semibold">← Administration</a><h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Exam originals for sharing</h1><p className="text-muted-foreground mt-2 max-w-[70ch] text-sm leading-6">These PDF candidates came from Canvas connections whose owners enabled community sharing. Accept the source contribution in the editorial rights review first, then make a separate decision about distributing its original to verified Maastricht members.</p></header>
    {error && <p role="alert" className="border border-destructive/40 p-4 text-sm text-destructive">{error}</p>}
    {!papers.length && !error && <p className="text-muted-foreground text-sm">No exam-paper candidates are available.</p>}
    <ul className="divide-y border-y">{papers.map(paper => <li key={paper.snapshotId} className="flex flex-wrap items-center gap-4 py-5">
      <div className="min-w-[16rem] flex-1"><p className="font-data text-xs font-semibold uppercase tracking-wide text-muted-foreground">{paper.courseCode} · {paper.academicYear} · {paper.kind}</p><h2 className="mt-1 break-words text-sm font-semibold">{paper.filename}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{paper.sourcePath}</p><p className="mt-2 text-xs text-muted-foreground">Contribution: {paper.consentStatus} · Original: {paper.status}</p>{paper.note && <p className="mt-1 text-xs text-muted-foreground">Review note: {paper.note}</p>}</div>
      <div className="flex flex-wrap gap-2"><a href={`/app/admin?tab=production&edition=${encodeURIComponent(paper.editionId)}`} className="inline-flex h-9 items-center rounded-sm border px-3 text-sm">Rights review</a><Button size="sm" disabled={busy === paper.snapshotId || paper.consentStatus !== 'accepted' || paper.status === 'approved'} onClick={() => void review(paper, 'approved')}>Approve original</Button><Button size="sm" variant="outline" disabled={busy === paper.snapshotId || paper.status === 'withheld'} onClick={() => void review(paper, 'withheld')}>Withhold</Button></div>
    </li>)}</ul>
  </main>
}
