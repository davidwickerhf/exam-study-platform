'use client'

import { useEffect, useState } from 'react'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { Button } from '@/components/ui/button'

type Candidate = {
  snapshotId: string; filename: string; sourcePath: string; kind: 'paper' | 'solutions' | null
  courseCode: string; courseName: string; academicYear: string; editionId: string
  consentStatus: string; status: 'pending' | 'approved' | 'withheld'; note: string
}

export default function ExamPaperReviews() {
  const { session } = useWorkspaceSession()
  const [papers, setPapers] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showOtherPdfs, setShowOtherPdfs] = useState(false)
  const [kinds, setKinds] = useState<Record<string, 'paper' | 'solutions'>>({})
  async function load() {
    const response = await fetch(`/api/admin/exam-papers?search=${encodeURIComponent(search)}`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Exam-paper candidates could not be loaded.')
    setPapers(result.papers)
  }
  useEffect(() => { if (!session?.admin) return; const timer = window.setTimeout(() => { void load().catch(cause => setError(cause.message)) }, 250); return () => window.clearTimeout(timer) }, [session?.admin, search])
  async function review(paper: Candidate, status: 'approved' | 'withheld') {
    setBusy(paper.snapshotId)
    setError('')
    try {
      const note = status === 'approved'
        ? window.prompt('Record the basis for allowing this original to be shared with all verified Maastricht University members:')
        : window.prompt('Reason for withholding this original (optional):', paper.note)
      if (note === null) return
      if (status === 'approved' && !note.trim()) { setError('Record a rights basis before approving an original.'); return }
      const kind = kinds[paper.snapshotId] || paper.kind
      if (status === 'approved' && !kind) { setError('Classify this PDF as a paper or solutions before approving it.'); return }
      const response = await fetch('/api/admin/exam-papers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshotId: paper.snapshotId, status, kind, note }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Review failed.')
      await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(null) }
  }
  if (!session?.admin) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Administrator access required</h1></main>
  const visible = papers.filter(paper => showOtherPdfs || paper.kind || paper.status !== 'pending')
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-7 p-6 sm:p-8">
    <header className="border-b pb-5"><a href="/app/admin" className="text-primary text-sm font-semibold">← Administration</a><h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Exam originals for sharing</h1><p className="text-muted-foreground mt-2 max-w-[70ch] text-sm leading-6">These PDFs came from Canvas connections whose owners enabled community sharing. Accept the source contribution in the editorial rights review first, then make a separate decision about distributing its original to verified Maastricht members. Check each paper and its rights before approval.</p></header>
    {error && <p role="alert" className="border border-destructive/40 p-4 text-sm text-destructive">{error}</p>}
    {!papers.length && !error && <p className="text-muted-foreground text-sm">No exam-paper candidates are available.</p>}
    <div className="flex flex-wrap items-center gap-4"><label className="flex flex-col gap-1 text-sm">Find a PDF<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Course code or filename" className="h-10 min-w-64 rounded-md border bg-background px-3" /></label><label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={showOtherPdfs} onChange={event => setShowOtherPdfs(event.target.checked)} />Show all PDFs for manual classification</label><span className="text-muted-foreground mt-5 text-xs">{visible.length} of {papers.length} records</span></div>
    <ul className="divide-y border-y">{visible.map(paper => <li key={paper.snapshotId} className="flex flex-wrap items-center gap-4 py-5">
      <div className="min-w-[16rem] flex-1"><p className="font-data text-xs font-semibold uppercase tracking-wide text-muted-foreground">{paper.courseCode} · {paper.academicYear} · {paper.kind || 'unclassified PDF'}</p><h2 className="mt-1 break-words text-sm font-semibold">{paper.filename}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{paper.sourcePath}</p><p className="mt-2 text-xs text-muted-foreground">Contribution: {paper.consentStatus} · Original: {paper.status}</p>{paper.note && <p className="mt-1 text-xs text-muted-foreground">Review note: {paper.note}</p>}</div>
      <div className="flex flex-wrap items-center gap-2"><label className="text-xs text-muted-foreground">Type <select aria-label={`Type for ${paper.filename}`} className="ml-1 h-9 rounded-md border bg-background px-2 text-foreground" value={kinds[paper.snapshotId] || paper.kind || ''} onChange={event => setKinds(current => ({ ...current, [paper.snapshotId]: event.target.value as 'paper' | 'solutions' }))}><option value="">Choose</option><option value="paper">Paper</option><option value="solutions">Solutions</option></select></label><a href={`/app/admin?tab=production&edition=${encodeURIComponent(paper.editionId)}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">Rights review</a><Button size="sm" disabled={busy === paper.snapshotId || paper.consentStatus !== 'accepted' || paper.status === 'approved'} onClick={() => void review(paper, 'approved')}>Approve original</Button><Button size="sm" variant="outline" disabled={busy === paper.snapshotId || paper.status === 'withheld'} onClick={() => void review(paper, 'withheld')}>Withhold</Button></div>
    </li>)}</ul>
  </main>
}
