'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceSession } from '@/components/workspace/require-auth'
import { Button } from '@/components/ui/button'

type Candidate = { snapshotId: string; assetId: string; filename: string; sourcePath: string; sourceType: string; category: 'paper' | 'solutions' | 'material'; courseCode: string; academicYear: string; consentStatus: string; status: 'pending' | 'approved' | 'withheld'; note: string; byteSize: number }

export default function SharedMaterialReviews() {
  const { session } = useWorkspaceSession()
  const [rows, setRows] = useState<Candidate[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [categories, setCategories] = useState<Record<string, Candidate['category']>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function load() {
    const response = await fetch(`/api/admin/shared-materials?search=${encodeURIComponent(search)}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Candidates could not be loaded.')
    setRows(result.materials)
  }
  useEffect(() => { if (!session?.admin) return; const timer = window.setTimeout(() => { void load().catch(cause => setError(cause.message)) }, 250); return () => window.clearTimeout(timer) }, [session?.admin, search])
  const distinct = useMemo(() => {
    const byAsset = new Map<string, Candidate>()
    const rank = { pending: 0, withheld: 1, approved: 2 }
    for (const row of rows) {
      const key = `${row.courseCode}/${row.academicYear}/${row.assetId}`
      const previous = byAsset.get(key)
      if (!previous || rank[row.status] > rank[previous.status]) byAsset.set(key, row)
    }
    return [...byAsset.values()]
  }, [rows])
  const pending = distinct.filter(row => row.status === 'pending')
  const chosen = distinct.filter(row => selected[row.snapshotId])
  async function review(status: 'approved' | 'withheld') {
    if (!chosen.length) { setError('Select at least one file.'); return }
    if (status === 'approved' && !note.trim()) { setError('Record the rights basis before release.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      let count = 0
      for (let offset = 0; offset < chosen.length; offset += 100) {
        const batch = chosen.slice(offset, offset + 100)
        const response = await fetch('/api/admin/shared-materials/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, note, acceptContributions: status === 'approved', items: batch.map(row => ({ snapshotId: row.snapshotId, category: categories[row.snapshotId] || row.category })) }) })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `Review stopped after ${count} records.`)
        count += result.reviewed
      }
      setNotice(`${count} source originals ${status === 'approved' ? 'released' : 'withheld'}.`)
      setSelected({}); await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  if (!session?.admin) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Administrator access required</h1></main>
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8"><header className="border-b pb-5"><a href="/app/admin" className="text-sm font-semibold text-primary">← Administration</a><h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Shared course originals</h1><p className="mt-2 max-w-[74ch] text-sm leading-6 text-muted-foreground">Review Canvas originals before distributing them to verified Maastricht University members. Selecting a file accepts its contribution and releases that original. Generated Wicker study guides are outside this Canvas register.</p></header>
    <div className="flex flex-wrap items-end gap-4"><label className="text-sm">Find course or file<input className="mt-1 block h-10 min-w-64 rounded-md border bg-background px-3" value={search} onChange={event => { setSearch(event.target.value); setSelected({}) }} placeholder="Course code, year or filename" /></label><span className="pb-2 text-xs text-muted-foreground">{distinct.length} distinct files · {pending.length} pending · {chosen.length} selected</span><Button variant="outline" disabled={busy} onClick={() => setSelected(Object.fromEntries(pending.slice(0, 100).map(row => [row.snapshotId, true])))}>Select first 100 pending</Button><Button variant="ghost" disabled={busy} onClick={() => setSelected({})}>Clear</Button></div>
    <label className="text-sm">Rights basis or review note<textarea className="mt-1 block min-h-24 w-full rounded-md border bg-background p-3" value={note} onChange={event => setNote(event.target.value)} placeholder="Record the permission or other basis for sharing these originals" /></label><div className="flex gap-2"><Button disabled={busy || !chosen.length} onClick={() => void review('approved')}>Accept and release selected</Button><Button disabled={busy || !chosen.length} variant="outline" onClick={() => void review('withheld')}>Withhold selected</Button></div>
    {error && <p role="alert" className="border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}{notice && <p role="status" className="border p-3 text-sm">{notice}</p>}
    <ul className="divide-y border-y">{distinct.map(row => <li key={row.snapshotId} className="flex flex-wrap items-center gap-4 py-4"><input type="checkbox" aria-label={`Select ${row.filename}`} checked={Boolean(selected[row.snapshotId])} onChange={event => setSelected(current => ({ ...current, [row.snapshotId]: event.target.checked }))} /><div className="min-w-0 flex-1"><p className="font-data text-xs uppercase text-muted-foreground">{row.courseCode} · {row.academicYear} · {row.status} · {row.consentStatus}</p><p className="mt-1 break-words text-sm font-semibold">{row.filename}</p><p className="mt-1 break-all text-xs text-muted-foreground">{row.sourcePath}</p></div><select aria-label={`Category for ${row.filename}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={categories[row.snapshotId] || row.category} onChange={event => setCategories(current => ({ ...current, [row.snapshotId]: event.target.value as Candidate['category'] }))}><option value="material">Material</option><option value="paper">Exam paper</option><option value="solutions">Solutions</option></select></li>)}</ul>
  </main>
}
