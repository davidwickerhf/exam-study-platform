'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DownloadIcon, PlusIcon, UploadIcon } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { Workspace } from '@/lib/workspace/academics.mjs'
import {
  type MatchSummary,
  type ProgrammeIndexItem,
  courseMatchSummary,
  exportEnvelope,
  exportFilename,
  importCandidate,
  programmeLabel
} from '@/lib/workspace/planning-settings.mjs'

type AcademicState = {
  index: { activeProgrammeId: string; programmes: ProgrammeIndexItem[] }
  workspace: Workspace & { profile: Workspace['profile'] & { gpaIncludesFailedCourses?: boolean } }
  summary?: unknown
  importReport?: { matched: unknown[]; unmatched: unknown[]; rejected: unknown[] }
}

type ImportPreview = { parsed: unknown; summary: MatchSummary; filename: string }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers }
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(data?.error || `That request answered ${response.status}.`)
  return data as T
}

function SectionHead({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-3">
      <div className="flex max-w-[74ch] flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </div>
  )
}

const QUIET = 'text-muted-foreground hover:text-foreground rounded-sm text-[13.5px] font-medium underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function PlanningSettings({ onChanged }: { onChanged?: (state: AcademicState) => void }) {
  const [state, setState] = useState<AcademicState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const accept = (next: AcademicState) => {
    setState(next)
    setError(null)
    onChanged?.(next)
  }

  useEffect(() => {
    let live = true
    api<AcademicState>('/api/academics')
      .then((next) => { if (live) accept(next) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
    // `accept` deliberately is not a dependency: this is the initial read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (work: () => Promise<AcademicState>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try { accept(await work()) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const programme = String(data.get('programme') ?? '').trim()
    const academicYear = String(data.get('academicYear') ?? '').trim()
    if (!programme) return
    void run(() => api('/api/academics/programmes', {
      method: 'POST',
      body: JSON.stringify({ profile: { programme, academicYear, currentYearKey: academicYear } })
    }).then((next) => { form.reset(); setComposerOpen(false); return next as AcademicState }))
  }

  const saveFailedRule = (checked: boolean) => {
    if (!state) return
    const workspace = { ...state.workspace, profile: { ...state.workspace.profile, gpaIncludesFailedCourses: checked } }
    void run(() => api('/api/academics', {
      method: 'PUT',
      body: JSON.stringify({ workspace, expectedRevision: state.workspace.revision })
    }))
  }

  const download = () => {
    if (!state) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportEnvelope(state.workspace), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = exportFilename()
    link.click()
    URL.revokeObjectURL(url)
  }

  const chooseImport = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const candidate = importCandidate(parsed)
      const material = await api<{ courses?: { code?: unknown }[] }>('/api/state')
      setPreview({ parsed, summary: courseMatchSummary(candidate, material.courses ?? []), filename: file.name })
    } catch (cause) {
      setError(`Import failed: ${(cause as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!preview || busy) return
    setBusy(true)
    try {
      const next = await api<AcademicState>('/api/academics/import', { method: 'POST', body: JSON.stringify(preview.parsed) })
      const report = next.importReport
      accept(next)
      setImportResult(report
        ? `Import complete: ${report.matched.length} matched, ${report.unmatched.length} planning-only, ${report.rejected.length} rejected.`
        : `Imported ${preview.summary.total} courses into a new programme.`)
      setPreview(null)
    } catch (cause) {
      setError(`Import failed: ${(cause as Error).message}`)
    } finally { setBusy(false) }
  }

  if (!state && error) {
    return <Empty><EmptyHeader><EmptyTitle>Planning settings could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
  }
  if (!state) return <div className="flex flex-col gap-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-28 w-full" /></div>

  const { index, workspace } = state
  const includesFailed = workspace.profile.gpaIncludesFailedCourses === true

  return (
    <div className="flex max-w-[920px] flex-col gap-10 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
        <div className="max-w-[66ch]">
          <h2 className="font-heading text-[32px] font-semibold tracking-[-0.03em]">How this academic record behaves</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Keep separate programmes apart, choose how grades are calculated, and move a complete planning record in or out of Wicker.</p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/app/settings" />}>Workspace settings</Button>
      </header>
      <section className="flex flex-col gap-4">
        <SectionHead title="Programmes" description="Each programme is a separate private record with its own curriculum, attempts, and rules.">
          <Button variant="secondary" size="sm" aria-expanded={composerOpen} disabled={busy} onClick={() => setComposerOpen((open) => !open)}>
            <PlusIcon data-icon="inline-start" />
            New programme
          </Button>
        </SectionHead>
        <ul className="flex flex-col">
          {index.programmes.map((item) => {
            const active = item.id === index.activeProgrammeId
            return (
              <li key={item.id} className="hover:bg-card flex min-h-16 items-center justify-between gap-4 border-b py-3 transition-colors">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <strong className="truncate text-sm font-semibold">{programmeLabel(item)}</strong>
                  <span className="text-muted-foreground font-data text-sm tabular-nums">{item.academicYear || 'No academic year'}</span>
                </div>
                {active
                  ? <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">Active</span>
                  : <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => api('/api/academics/active', { method: 'PUT', body: JSON.stringify({ id: item.id }) }))}>Switch</Button>}
              </li>
            )
          })}
        </ul>
        {/* One programme is a fact, not an empty list. Say it plainly. */}
        {index.programmes.length === 1 && (
          <p className="text-muted-foreground text-sm">This is your only programme record. Create another to keep a second degree, exchange, or cohort year apart from this one.</p>
        )}
        {composerOpen && (
          <form onSubmit={create} className="bg-muted flex flex-col gap-3 rounded-sm p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold" htmlFor="new-programme">Programme</Label>
                <Input id="new-programme" name="programme" maxLength={200} required placeholder="MSc Data Science" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold" htmlFor="new-academic-year">Academic year or cohort</Label>
                <Input id="new-academic-year" name="academicYear" maxLength={30} placeholder="2027–2028" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={busy}>{busy ? 'Creating…' : 'Create and switch'}</Button>
              <button type="button" className={QUIET} onClick={() => setComposerOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead title="Statistics" />
        {/* The control belongs beside the sentence it changes, not adrift at the far right. */}
        <label className="hover:bg-card flex cursor-pointer items-start gap-3 border-b pb-4 transition-colors">
          <Checkbox className="mt-0.5" aria-label="Include failed attempts in weighted GPA" checked={includesFailed} disabled={busy} onCheckedChange={(checked) => saveFailedRule(checked === true)} />
          <span className="flex flex-col gap-1">
            <strong className="text-sm font-semibold">Include failed attempts in weighted GPA</strong>
            <span className="text-muted-foreground text-sm">Some programmes average every recorded attempt; others count only passes.</span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-0">
        <SectionHead title="Tutor and agent access" description="Saved planning choices are workspace context. Draft changes on the Session Board remain private to that browser until you save them." />
        <div className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
          <div className="max-w-[62ch]">
            <strong className="text-sm font-semibold">Tutor</strong>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">Tutor can read your saved sittings, expected grades, and progression effects. It always places a planning change in Proposed actions for your approval.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/app/tutor" />} variant="outline" size="sm">Open Tutor</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b py-4">
          <div className="max-w-[62ch]">
            <strong className="text-sm font-semibold">MCP and API</strong>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">Read access can inspect planning context. Write access can update one course objective at a time. Teaching-period, calendar, transcript, resit-rule, and revision checks reject impossible or stale changes.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/app/settings?tab=api" />} variant="outline" size="sm">Manage access</Button>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead title="Portable data" description="Download this programme or import a Wicker Study academics file into a new programme. Course-code matches are shown before anything is saved." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}><DownloadIcon data-icon="inline-start" />Download JSON</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><UploadIcon data-icon="inline-start" />Import JSON</Button>
          <input ref={fileRef} type="file" accept="application/json" className="sr-only" onChange={(event) => void chooseImport(event.target.files?.[0])} />
        </div>
        {importResult && <p role="status" className="text-muted-foreground text-sm">{importResult}</p>}
      </section>

      {index.programmes.length > 1 && (
        <section className="flex flex-wrap items-center justify-between gap-4 border p-4">
          <div className="flex max-w-[60ch] flex-col gap-1">
            <strong className="text-sm font-semibold">Delete the active programme</strong>
            <p className="text-muted-foreground text-sm">Removes its curriculum, attempts, events, and scenarios. Other programmes are not affected.</p>
          </div>
          <Button variant="outline" onClick={() => setDeleteOpen(true)} disabled={busy}>Delete programme</Button>
        </section>
      )}

      {error && <p role="alert" className="text-destructive text-sm font-medium">Changes could not be saved: {error}</p>}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {programmeLabel(index.programmes.find((item) => item.id === index.activeProgrammeId))}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes this programme&rsquo;s curriculum, attempts, events, and scenarios. Your other programmes remain intact.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="outline" onClick={() => { setDeleteOpen(false); void run(() => api(`/api/academics/programmes/${encodeURIComponent(workspace.id)}`, { method: 'DELETE' })) }}>Delete programme</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Import {preview?.summary.total ?? 0} courses into a new programme?</AlertDialogTitle>
            <AlertDialogDescription>{preview?.summary.matched ?? 0} match study courses by code; {preview?.summary.unmatched ?? 0} will remain planning-only. Source: {preview?.filename}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void confirmImport()}>Import programme</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
