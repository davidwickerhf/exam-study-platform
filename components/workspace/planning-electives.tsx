'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpenIcon, CheckIcon, ChevronDownIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

type ElectiveGroup = {
  id: string
  label: string
  period?: string | null
  yearLevel?: string | null
  minSelections: number
  maxSelections: number
  chosen: string[]
  courses: { id: string; code: string; name: string; ects: number }[]
}

async function json<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(body?.error || `Electives returned ${response.status}.`)
  return body as T
}

export function PlanningElectives({ onSaved, onAddCourse }: { onSaved: () => void | Promise<unknown>; onAddCourse: () => void }) {
  const [groups, setGroups] = useState<ElectiveGroup[] | null>(null)
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState('')
  const [readAttempt, setReadAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (window.location.hash === '#electives') setExpanded(true)
  }, [])

  useEffect(() => {
    let live = true
    setError(null)
    setGroups(null)
    json<{ groups: ElectiveGroup[] }>('/api/onboarding/electives?scope=all')
      .then((data) => {
        if (!live) return
        setGroups(data.groups)
        setChosen(Object.fromEntries(data.groups.map((group) => [group.id, group.chosen])))
        setActiveGroupId((current) => current || data.groups.find((group) => group.chosen.length)?.id || data.groups[0]?.id || '')
      })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [readAttempt])

  const selectedCount = useMemo(() => Object.values(chosen).reduce((total, ids) => total + ids.length, 0), [chosen])
  if (!groups && !error) return <Skeleton className="h-14 w-full" />
  if (!groups && error) return (
    <section role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-5 sm:px-6">
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg"><BookOpenIcon className="size-[18px]" /></span>
      <div className="min-w-56 flex-1">
        <h2 className="text-sm font-semibold">The elective library is temporarily unavailable</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">Your course record is unaffected. Try loading the maintained curriculum choices again.</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setReadAttempt((value) => value + 1)}><RotateCcwIcon data-icon="inline-start" />Try again</Button>
      <details className="basis-full border-t pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Technical details</summary><p className="mt-2">{error}</p></details>
    </section>
  )
  if (!groups?.length) return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-5 sm:px-6">
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg"><BookOpenIcon className="size-[18px]" /></span>
      <div className="min-w-56 flex-1">
        <h2 className="text-sm font-semibold">No elective groups are published for this curriculum</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">You can still add an elective or another approved course to your plan yourself.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onAddCourse}><PlusIcon data-icon="inline-start" />Add course</Button>
    </section>
  )
  const active = groups.find((group) => group.id === activeGroupId) || groups[0]
  const selected = chosen[active.id] ?? []
  const validSelection = selected.length >= active.minSelections && selected.length <= active.maxSelections

  const saveActive = async () => {
    setBusy(active.id); setSaved(null); setError(null)
    try {
      await json('/api/onboarding/electives', { method: 'PUT', body: JSON.stringify({ groupId: active.id, courseIds: selected }) })
      await onSaved()
      setSaved(active.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The elective choices could not be saved.') }
    finally { setBusy(null) }
  }

  return (
    <details id="electives" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="group scroll-mt-28 overflow-hidden rounded-xl border bg-card">
      <summary className="flex min-h-[76px] cursor-pointer list-none items-center gap-4 px-5 py-4 marker:hidden sm:px-6">
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Curriculum choices</span>
          <h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.025em]">Elective library</h2>
          <p className="text-muted-foreground mt-1 text-sm">Choose maintained options across the degree. Saved courses immediately join the year register and Session Board.</p>
        </div>
        <span className="font-data text-muted-foreground shrink-0 text-sm tabular-nums">{selectedCount} selected</span>
        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t">
        {error && <p role="alert" className="border-b px-5 py-3 text-sm text-destructive sm:px-6">Elective choices could not be saved: {error}</p>}
        <div className="grid md:grid-cols-[15rem_minmax(0,1fr)]">
          <nav className="flex overflow-x-auto border-b md:min-h-[300px] md:flex-col md:border-r md:border-b-0" aria-label="Elective requirement groups">
            {groups.map((group) => {
              const current = group.id === active.id
              const count = (chosen[group.id] ?? []).length
              const selectionRule = group.minSelections === group.maxSelections && group.minSelections > 0
                ? `Choose ${group.minSelections}`
                : group.minSelections > 0 ? `Choose ${group.minSelections}–${group.maxSelections}` : 'Optional'
              return <button key={group.id} type="button" onClick={() => { setActiveGroupId(group.id); setSaved(null) }} className={`relative min-w-52 px-5 py-4 text-left transition-colors md:min-w-0 md:border-b ${current ? 'bg-primary/[0.035]' : 'hover:bg-muted/35'}`}><strong className="block text-sm">{group.label}</strong><span className="text-muted-foreground mt-1 block text-xs">{count ? `${count} selected · ${selectionRule}` : `Not chosen · ${selectionRule}`}</span>{current && <span className="bg-primary absolute inset-y-0 left-0 w-0.5 md:inset-x-0 md:top-auto md:h-0.5 md:w-auto" />}</button>
            })}
          </nav>
          <section className="min-w-0">
            <header className="flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6"><div><span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Choose for this requirement</span><h3 className="mt-1 text-base font-semibold">{active.label}</h3><p className="text-muted-foreground mt-1 text-xs">{active.minSelections === active.maxSelections && active.minSelections > 0 ? `Select ${active.minSelections} ${active.minSelections === 1 ? 'course' : 'courses'}.` : active.minSelections > 0 ? `Select between ${active.minSelections} and ${active.maxSelections} courses.` : 'Choose only the courses you intend to take.'}</p></div><span className="font-data text-muted-foreground text-xs tabular-nums">{selected.reduce((total, id) => total + (active.courses.find((course) => course.id === id)?.ects || 0), 0)} ECTS selected</span></header>
            <div className="border-t">
              {active.courses.map((course) => {
                const checked = selected.includes(course.id)
                return <label key={course.id} className={`flex min-h-16 cursor-pointer items-center gap-4 border-t px-5 py-3 first:border-t-0 sm:px-6 ${checked ? 'bg-primary/[0.035]' : 'hover:bg-muted/25'}`}><Checkbox checked={checked} onCheckedChange={(value) => { setSaved(null); setChosen((current) => ({ ...current, [active.id]: value ? [...new Set([...(current[active.id] ?? []), course.id])] : (current[active.id] ?? []).filter((id) => id !== course.id) })) }} /><span className="min-w-0 flex-1"><span className="font-data text-primary block text-xs font-semibold tracking-[0.04em] tabular-nums">{course.code}</span><strong className="mt-1 block text-sm">{course.name}</strong></span><span className="font-data text-muted-foreground shrink-0 text-xs tabular-nums">{course.ects} ECTS</span></label>
              })}
            </div>
            <footer className="flex min-h-16 flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-6"><Button size="sm" disabled={busy === active.id || !validSelection} onClick={() => void saveActive()}>{busy === active.id && <Spinner data-icon="inline-start" />}{busy === active.id ? 'Saving…' : 'Save choices'}</Button>{saved === active.id && <span role="status" className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold"><CheckIcon className="size-3.5" />Course record updated</span>}<span className="text-muted-foreground ml-auto text-xs">{validSelection ? 'Only this requirement group is changed.' : `Select ${active.minSelections === active.maxSelections ? active.minSelections : `${active.minSelections}–${active.maxSelections}`} before saving.`}</span></footer>
          </section>
        </div>
      </div>
    </details>
  )
}
