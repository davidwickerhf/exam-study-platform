'use client'

import Link from 'next/link'
import { useJson } from '@/components/workspace/use-json'
import { Button } from '@/components/ui/button'
import { StudyArtifacts, type WorkItem, type StudyArtifactsData } from '../study-artifacts'

type WorkOverview = StudyArtifactsData & { items: WorkItem[]; recentEvents: { id: string; title: string; type: string; at: string; after?: string }[] }
export default function StudyWorkPage() {
  const { data, error, reload } = useJson<WorkOverview>('/api/tutor/work')
  return <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-8"><Link href="/app/tutor" className="text-muted-foreground text-sm">← Tutor</Link><header className="my-7 flex items-end justify-between gap-4 border-b pb-6"><div><h1 className="font-heading text-3xl font-semibold tracking-tight">Your study work</h1><p className="text-muted-foreground mt-2 max-w-[60ch] text-sm">Assignments, project milestones, catch-up work and practice checks you can return to.</p></div><Button variant="outline" onClick={reload}>Refresh</Button></header>
    {error && <p role="alert" className="text-destructive mb-4 text-sm">{error}</p>}{!data && !error && <p role="status" className="text-muted-foreground text-sm">Loading your study work…</p>}
    {data && <><StudyArtifacts data={{ ...data, work: data.items.filter(item => !item.parentId) }} />{!data.items.length && !data.diagnostics?.length && !data.reviews?.length && <div className="py-10"><h2 className="text-xl font-semibold">Start with one concrete task</h2><p className="text-muted-foreground mt-2 max-w-[55ch] text-sm leading-relaxed">Ask Tutor to track an assignment, break down a project, check a draft against its rubric, or prepare a short practice check. Approve checklist changes in Proposed actions.</p><Link href="/app/tutor" className="text-primary mt-5 inline-block text-sm font-semibold">Open Tutor →</Link></div>}
    {!!data.recentEvents.length && <details className="mt-8 border-t py-5"><summary className="cursor-pointer text-sm font-semibold">Activity history</summary><ul className="mt-4 divide-y">{data.recentEvents.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{event.title}<small className="text-muted-foreground ml-2">{event.after || event.type.replaceAll('-', ' ')}</small></span><time className="text-muted-foreground font-data text-xs">{new Date(event.at).toLocaleString('en-GB')}</time></li>)}</ul></details>}</>}
  </div>
}
