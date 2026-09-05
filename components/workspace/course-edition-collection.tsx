'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DownloadIcon, RefreshCwIcon } from 'lucide-react'
import type { CourseEdition } from '@/lib/workspace/course-editions.mjs'
import type { useCourseCanvas } from './use-course-canvas'

export function CourseEditionCollection({ editions, selected, onSelect, canvas }: {
  editions: CourseEdition[]; selected: string; onSelect: (year: string) => void; canvas: ReturnType<typeof useCourseCanvas>
}) {
  const enabled = new Set(canvas.connections.filter(c => c.corpus?.collectionEnabled).map(c => c.origin))
  const missing = editions.filter(e => !e.busy).flatMap(e => e.missing).filter(s => enabled.has(s.origin))
  return <section className="overflow-hidden rounded-xl border bg-card" aria-label="Canvas editions">
    <div className="flex items-start justify-between gap-3 border-b px-5 py-4"><div className="min-w-0 flex-1"><h2 className="text-base font-semibold">Canvas editions</h2><p className="text-muted-foreground mt-1 text-xs">Collect original material for any available year.</p></div><Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Check available editions" onClick={() => void canvas.refresh()} disabled={canvas.loading || canvas.busy}><RefreshCwIcon className={canvas.loading ? 'animate-spin' : ''} /></Button></div>
    {canvas.loading && <p role="status" className="text-muted-foreground px-5 py-4 text-xs">Checking all available Canvas years…</p>}
    {canvas.error && <p role="alert" className="px-5 py-4 text-xs">{canvas.error}</p>}
    {!canvas.loading && !canvas.error && !canvas.connections.length && <div className="px-5 py-4"><p className="text-muted-foreground text-xs">Connect Canvas to find and collect your course editions.</p><Link href="/app/settings?tab=connections" className="text-primary mt-2 inline-flex min-h-9 items-center text-xs font-semibold">Connect Canvas</Link></div>}
    <ul className="divide-y">{editions.map(edition => {
      const targets = (edition.missing.length ? edition.missing : edition.shells).filter(s => enabled.has(s.origin))
      const label = edition.busy ? 'Collecting…' : edition.failed ? 'Collection needs attention' : edition.missing.length ? edition.sources ? `${edition.sources} ${edition.sources === 1 ? 'file' : 'files'} · incomplete` : 'Not collected' : edition.sources ? `${edition.sources} ${edition.sources === 1 ? 'file' : 'files'} available` : edition.collected ? 'Collected · no files found' : edition.shells.length ? 'Not collected' : 'No accessible Canvas edition'
      return <li key={edition.year} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"><button onClick={() => onSelect(edition.year)} aria-pressed={selected === edition.year} className="min-h-10 text-left"><span className={`font-data text-sm font-semibold ${selected === edition.year ? 'text-primary' : ''}`}>{edition.year === 'undated' ? 'Undated' : edition.year}</span><span className="text-muted-foreground mt-0.5 block text-xs">{label}</span></button>
        {targets.length > 0 ? <Button variant={edition.missing.length ? 'outline' : 'ghost'} size="sm" disabled={canvas.busy || edition.busy || canvas.loading || !canvas.status} aria-label={`${edition.missing.length ? 'Collect' : 'Refresh'} ${edition.year}`} onClick={() => void canvas.collect(targets)}>{edition.busy ? 'Collecting…' : edition.missing.length ? 'Collect material' : 'Refresh'}</Button> : edition.shells.length > 0 ? <Link className="text-primary text-xs font-semibold" href="/app/settings?tab=connections">Enable collection</Link> : null}
        {edition.failed && <p className="text-muted-foreground w-full text-xs">{edition.jobs.find(job => job.error)?.error || 'Try collecting this edition again.'}</p>}
      </li>
    })}</ul>
    {missing.length > 1 && <div className="border-t px-5 py-3"><Button variant="outline" size="sm" className="w-full" disabled={canvas.busy || canvas.loading || !canvas.status} onClick={() => void canvas.collect(missing)}><DownloadIcon />Collect all missing years</Button></div>}
    {canvas.notice && <p role="status" className="border-t px-5 py-4 text-xs">{canvas.notice}</p>}
    {canvas.actionError && <p role="alert" className="border-t px-5 py-4 text-xs">{canvas.actionError}</p>}
  </section>
}
