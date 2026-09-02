'use client'

/**
 * The first surface migrated off the vanilla template renderer.
 *
 * It exists to prove the stack end to end before the other fourteen routes
 * follow: real shadcn components, the Dienstregeling tokens resolved through
 * shadcn's semantic names, the existing API untouched, and the legacy SPA
 * still serving everything else in the meantime.
 *
 * Same behaviour as the vanilla version it replaces — a state segment with
 * counts, one course select, search, sort, and a list grouped by how soon
 * things are due — but as components rather than template strings.
 */

import { useEffect, useMemo, useState } from 'react'
import { ExternalLinkIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  type Assignment,
  type Hub,
  type StateId,
  BUCKETS,
  STATES,
  assignmentTitle,
  bucketOf,
  daysUntil,
  stateOf
} from '@/lib/v2/canvas'

const SORTS = [
  { id: 'due', label: 'Due soonest' },
  { id: 'due-desc', label: 'Due latest' },
  { id: 'course', label: 'By course' },
  { id: 'points', label: 'Most points' }
] as const

function dueLine(item: Assignment) {
  const away = daysUntil(item.dueAt)
  const when = item.dueAt
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(item.dueAt))
    : 'No due date'
  const parts = [when]
  if (away !== null) parts.push(away === 0 ? 'today' : away < 0 ? `${Math.abs(away)} days ago` : `in ${away} days`)
  if (item.pointsPossible !== null) parts.push(`${item.pointsPossible} point${item.pointsPossible === 1 ? '' : 's'}`)
  if (item.score !== null) parts.push(`scored ${item.score}`)
  if (item.late) parts.push('handed in late')
  return parts.join(' · ')
}

export default function UpdatesPage() {
  const [hub, setHub] = useState<Hub | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<StateId>('todo')
  const [course, setCourse] = useState('all')
  const [sort, setSort] = useState<string>('due')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    fetch('/api/integrations/canvas/hub?scope=current&days=30', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Canvas returned ${response.status}`))))
      .then((data: Hub) => { if (live) setHub(data) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: 0 }
    for (const item of hub?.assignments ?? []) {
      tally[stateOf(item.status)] = (tally[stateOf(item.status)] ?? 0) + 1
      tally.all += 1
    }
    return tally
  }, [hub])

  const visible = useMemo(() => {
    const allowed = STATES.find((entry) => entry.id === state)?.statuses ?? null
    const needle = query.trim().toLowerCase()
    return (hub?.assignments ?? [])
      .filter((item) => !allowed || allowed.includes(item.status as never))
      .filter((item) => course === 'all' || item.courseId === course)
      .filter((item) => !needle || `${item.title} ${item.courseCode ?? ''}`.toLowerCase().includes(needle))
      .sort((left, right) => {
        if (sort === 'course') return (left.courseCode ?? '').localeCompare(right.courseCode ?? '')
        if (sort === 'points') return (right.pointsPossible ?? -1) - (left.pointsPossible ?? -1)
        const direction = sort === 'due-desc' ? -1 : 1
        if (Boolean(left.dueAt) !== Boolean(right.dueAt)) return left.dueAt ? -1 : 1
        return direction * String(left.dueAt ?? '').localeCompare(String(right.dueAt ?? ''))
      })
  }, [hub, state, course, sort, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const item of visible) map.set(bucketOf(item), [...(map.get(bucketOf(item)) ?? []), item])
    return map
  }, [visible])

  const courses = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; current: boolean }>()
    for (const item of hub?.assignments ?? []) {
      if (!seen.has(item.courseId)) seen.set(item.courseId, { id: item.courseId, label: item.courseCode ?? item.courseName ?? item.courseId, current: item.courseCurrent })
    }
    return [...seen.values()]
  }, [hub])

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-5xl leading-none tracking-tight">Updates</h1>
        <p className="text-muted-foreground text-sm">Canvas hand-ins, grouped by how soon they are due.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <ToggleGroup value={[state]} onValueChange={(value) => { const next = value.at(-1); if (next) setState(next as StateId) }} variant="outline">
          {STATES.filter((entry) => entry.id === 'all' || counts[entry.id]).map((entry) => (
            <ToggleGroupItem key={entry.id} value={entry.id} className="gap-1.5">
              {entry.label}
              <span className="font-data text-muted-foreground tabular-nums">{counts[entry.id] ?? 0}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={course} onValueChange={(value) => setCourse(value ?? "all")}>
          <SelectTrigger className="w-[190px]" aria-label="Course">
            <SelectValue>{(value) => (value === 'all' ? 'All courses' : courses.find((entry) => entry.id === value)?.label ?? 'All courses')}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All courses</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>This period</SelectLabel>
              {courses.filter((entry) => entry.current).map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Other courses</SelectLabel>
              {courses.filter((entry) => !entry.current).map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assignments" className="pl-9" aria-label="Search assignments" />
        </div>

        <Select value={sort} onValueChange={(value) => setSort(value ?? "due")}>
          <SelectTrigger className="w-[150px]" aria-label="Sort">
            <SelectValue>{(value) => SORTS.find((entry) => entry.id === value)?.label ?? 'Due soonest'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORTS.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Empty><EmptyHeader><EmptyTitle>Canvas could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
      ) : !hub ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
        </div>
      ) : !visible.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>{hub.assignments.length} assignments are outside the current filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        BUCKETS.filter((bucket) => grouped.has(bucket.id)).map((bucket) => (
          <section key={bucket.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between border-b pb-2">
              <h2 className="text-sm font-semibold">{bucket.label}</h2>
              <span className="font-data text-muted-foreground text-sm tabular-nums">{grouped.get(bucket.id)!.length}</span>
            </div>
            <ul className="flex flex-col">
              {grouped.get(bucket.id)!.map((item) => (
                <li key={item.id} className="hover:bg-card grid grid-cols-[5.5rem_minmax(0,1fr)_auto_1.5rem] items-baseline gap-4 border-b py-2">
                  <span className="font-data text-muted-foreground text-sm font-semibold tabular-nums">{item.courseCode}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <strong className="text-[15px] leading-snug font-medium break-words">{assignmentTitle(item)}</strong>
                    <small className="text-muted-foreground text-xs tabular-nums">{dueLine(item)}</small>
                  </span>
                  {['upcoming', 'undated'].includes(item.status) ? <span /> : (
                    <Badge variant={item.status === 'missing' || item.status === 'overdue' ? 'default' : 'secondary'}>
                      {hub.statuses[item.status] ?? item.status}
                    </Badge>
                  )}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`Open ${item.title} in Canvas`}>
                      <ExternalLinkIcon className="size-4" />
                    </a>
                  ) : <span />}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
