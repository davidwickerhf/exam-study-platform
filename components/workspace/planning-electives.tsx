'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

type ElectiveGroup = {
  id: string
  label: string
  period?: string | null
  yearLevel?: string | null
  chosen: string[]
  courses: { id: string; code: string; name: string; ects: number }[]
}

async function json<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(body?.error || `Electives returned ${response.status}.`)
  return body as T
}

export function PlanningElectives({ onSaved }: { onSaved: () => void | Promise<unknown> }) {
  const [groups, setGroups] = useState<ElectiveGroup[] | null>(null)
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    json<{ groups: ElectiveGroup[] }>('/api/onboarding/electives?scope=all')
      .then((data) => {
        if (!live) return
        setGroups(data.groups)
        setChosen(Object.fromEntries(data.groups.map((group) => [group.id, group.chosen])))
      })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const selectedCount = useMemo(() => Object.values(chosen).reduce((total, ids) => total + ids.length, 0), [chosen])
  if (!groups && !error) return <Skeleton className="h-14 w-full" />
  if (!groups && error) return <p role="alert" className="border-y py-3 text-sm text-destructive">Elective choices could not be read: {error}</p>
  if (!groups?.length) return <p className="border-y py-3 text-sm text-muted-foreground">This curriculum has no maintained elective groups. You can still add a personal course from the page header.</p>

  return (
    <details className="group overflow-hidden rounded-xl border bg-card">
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
        {error && <p role="alert" className="border-b px-4 py-3 text-sm text-destructive sm:px-5">Elective choices could not be saved: {error}</p>}
        {groups.map((group) => {
          const selected = chosen[group.id] ?? []
          return (
            <section key={group.id} className="border-b last:border-b-0">
              <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 sm:px-6">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <span className="font-data text-muted-foreground text-xs tabular-nums">{selected.length} selected</span>
              </header>
              <div>
                {group.courses.map((course) => {
                  const checked = selected.includes(course.id)
                  return (
                    <label key={course.id} className="hover:bg-muted/25 flex min-h-12 cursor-pointer items-center gap-3 border-t px-5 py-2.5 sm:px-6">
                      <Checkbox checked={checked} onCheckedChange={(value) => { setSaved(null); setChosen((current) => ({ ...current, [group.id]: value ? [...new Set([...(current[group.id] ?? []), course.id])] : (current[group.id] ?? []).filter((id) => id !== course.id) })) }} />
                      <span className="font-data text-primary w-20 shrink-0 text-xs font-semibold tabular-nums">{course.code}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{course.name}</span>
                      <span className="font-data text-muted-foreground shrink-0 text-xs tabular-nums">{course.ects} ECTS</span>
                    </label>
                  )
                })}
              </div>
              <footer className="flex min-h-14 flex-wrap items-center gap-3 border-t px-5 py-2.5 sm:px-6">
                <Button size="sm" disabled={busy === group.id} onClick={async () => {
                  setBusy(group.id); setSaved(null); setError(null)
                  try {
                    await json('/api/onboarding/electives', { method: 'PUT', body: JSON.stringify({ groupId: group.id, courseIds: selected }) })
                    await onSaved()
                    setSaved(group.id)
                  } catch (cause) { setError(cause instanceof Error ? cause.message : 'The elective choices could not be saved.') }
                  finally { setBusy(null) }
                }}>{busy === group.id && <Spinner data-icon="inline-start" />}{busy === group.id ? 'Saving…' : 'Save this group'}</Button>
                {saved === group.id && <span role="status" className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold"><CheckIcon className="size-3.5" />Added to your course record</span>}
              </footer>
            </section>
          )
        })}
      </div>
    </details>
  )
}
