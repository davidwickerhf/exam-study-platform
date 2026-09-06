'use client'

import Link from 'next/link'
import { ArrowLeftIcon, ArrowRightIcon, ListChecksIcon, RefreshCwIcon } from 'lucide-react'
import { useJson } from '@/components/workspace/use-json'
import { Button, buttonVariants } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { StudyArtifacts, type WorkItem, type StudyArtifactsData } from '../study-artifacts'

type WorkOverview = StudyArtifactsData & { items: WorkItem[]; recentEvents: { id: string; title: string; type: string; at: string; after?: string }[] }

export default function StudyWorkPage() {
  const { data, error, reload } = useJson<WorkOverview>('/api/tutor/work')
  const empty = data && !data.items.length && !data.diagnostics?.length && !data.reviews?.length

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Link href="/app/tutor" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs font-semibold">
            <ArrowLeftIcon className="size-3.5" />Tutor
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]">Your study work</h1>
              <p className="text-muted-foreground mt-2 max-w-[65ch] text-sm">Assignments, project milestones, catch-up work and practice checks.</p>
            </div>
            <Button variant="outline" onClick={reload} disabled={!data && !error}>
              <RefreshCwIcon data-icon="inline-start" />Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        {!data && !error && <div role="status" aria-label="Loading your study work" className="space-y-4"><Skeleton className="h-48 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div>}
        {data && <>
          <StudyArtifacts data={{ ...data, work: data.items.filter(item => !item.parentId) }} />
          {empty && <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ListChecksIcon /></EmptyMedia>
              <EmptyTitle>Start with one concrete task</EmptyTitle>
              <EmptyDescription>Ask Tutor to track an assignment, break down a project, review a draft or prepare a practice check. Work you approve appears here.</EmptyDescription>
            </EmptyHeader>
            <Link href="/app/tutor" className={buttonVariants({ size: 'sm' })}>Open Tutor<ArrowRightIcon data-icon="inline-end" /></Link>
          </Empty>}
          {!!data.recentEvents.length && <details className="rounded-xl border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Activity history</summary>
            <ul className="divide-y border-t px-5">{data.recentEvents.map(event => <li key={event.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
              <span>{event.title}<small className="text-muted-foreground ml-2">{event.after || event.type.replaceAll('-', ' ')}</small></span>
              <time className="text-muted-foreground font-data text-xs">{new Date(event.at).toLocaleString('en-GB')}</time>
            </li>)}</ul>
          </details>}
        </>}
      </main>
    </div>
  )
}
