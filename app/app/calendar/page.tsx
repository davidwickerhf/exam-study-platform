'use client'

/**
 * Calendar, migrated.
 *
 * Two different jobs, two different components. shadcn's Calendar is
 * react-day-picker — a date picker — which is exactly right for choosing which
 * week to look at, and cannot lay out timed events. The scheduling grid stays
 * on FullCalendar, which already handles the time axis, overlaps, the all-day
 * row and the now-indicator; it is themed into the board world rather than
 * rebuilt, and it is fetched only when this destination is opened.
 *
 * The page used to begin with FullCalendar's own toolbar — no title, no line
 * of copy, no rule — so the one destination built on a third-party widget was
 * also the one that did not look like the product. It opens with the same flat
 * header as every other signed-in destination now, and the toolbar sits under
 * it as the local control it is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as DatePicker } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { eventRecord } from '@/lib/workspace/academics.mjs'
import { type CalendarChange, type CalendarEvent, type CalendarPayload, roomOf } from '@/lib/workspace/home.mjs'
import type { GridApi } from './calendar-grid'

const VIEWS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Day' },
  { id: 'listMonth', label: 'Agenda' }
] as const

const calendarView = (requested: string | null) => VIEWS.some(({ id }) => id === requested) ? requested! : 'timeGridWeek'

const NUMERALS = 'font-data tabular-nums'
const RULE = 'text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase'

/**
 * Dates the institution maintains. They are read-only here — the student's
 * plan is their own record — so the only thing to offer is a copy of one.
 */
const INSTITUTION = new Set(['exam-week', 'period', 'study-week', 'holiday', 'ceremony', 'registration', 'institution'])

/** The grid's shape while its code is on the wire: a header strip and rows. */
function GridSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-px" aria-hidden="true">
      <div className="grid shrink-0 grid-cols-7 gap-px">
        {Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-8 rounded-none" />)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px">
        {Array.from({ length: 28 }).map((_, index) => <Skeleton key={index} className="min-h-10 rounded-none" />)}
      </div>
    </div>
  )
}

const CalendarGrid = dynamic(() => import('./calendar-grid'), { ssr: false, loading: GridSkeleton })

const dayLabel = (value: string, allDay: boolean) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  }).format(new Date(value))

type PlanState = { id: string; status: 'saving' | 'done' | 'failed'; message?: string }

const CHANGE_LABEL: Record<CalendarChange['kind'], string> = {
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  'room-changed': 'Room changed',
  updated: 'Updated'
}

function TimetableChanges({ changes, onDismiss }: { changes: CalendarChange[]; onDismiss: (id: string) => void }) {
  if (!changes.length) return null
  return (
    <section className="border-y" aria-labelledby="timetable-changes-title">
      <div className="flex items-baseline justify-between gap-4 py-2">
        <h2 id="timetable-changes-title" className={RULE}>Timetable changes</h2>
        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{changes.length} unread</span>
      </div>
      <ul>
        {changes.slice(0, 3).map((change) => (
          <li key={change.id} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-start gap-3 border-t py-2.5 max-sm:grid-cols-[80px_minmax(0,1fr)_auto]">
            <strong className={`text-primary text-[10.5px] leading-5 font-semibold tracking-[0.08em] uppercase ${NUMERALS}`}>{CHANGE_LABEL[change.kind]}</strong>
            <span className="min-w-0 text-sm leading-5"><b className="font-medium">{change.title}</b><small className="text-muted-foreground ml-2">{change.detail} · {change.feedLabel}</small></span>
            <button type="button" onClick={() => onDismiss(change.id)} className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 focus-visible:outline-2" aria-label={`Dismiss change to ${change.title}`}><XIcon className="size-4" /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The detail panel. Selecting a date or an event opens this — never an alert,
 * and never a dialog that takes the grid away from behind it.
 */
function EventDetail({
  selected, date, plan, onAddToPlan, onClose
}: {
  selected: CalendarEvent | null
  date: string | null
  plan: PlanState | null
  onAddToPlan: (event: CalendarEvent) => void
  onClose: () => void
}) {
  if (!selected && !date) return null

  const saving = plan?.status === 'saving'
  const added = plan?.status === 'done'

  return (
    <section className="flex flex-col gap-1.5 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={RULE}>Selected</h2>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs focus-visible:underline">
          Clear
        </button>
      </div>

      {selected ? (
        <>
          <strong className="text-[15px] leading-snug font-medium">{selected.title}</strong>
          <p className={`text-muted-foreground text-xs ${NUMERALS}`}>{dayLabel(selected.start, selected.allDay)}</p>
          {selected.courseCode && (
            <p className={`text-muted-foreground text-xs ${NUMERALS}`}>{selected.courseCode}{selected.courseName ? ` · ${selected.courseName}` : ''}</p>
          )}
          {roomOf(selected) && <p className="text-muted-foreground text-xs">{roomOf(selected)}</p>}

          <div className="mt-2 flex flex-col items-start gap-1.5">
            {selected.href && (
              <a href={selected.href} className="text-primary text-xs font-semibold hover:underline">Open in Wicker Study</a>
            )}
            {selected.externalHref && (
              <a
                href={selected.externalHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
              >
                Open in Canvas <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
            {INSTITUTION.has(selected.category) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || added}
                onClick={() => onAddToPlan(selected)}
              >
                <CalendarPlusIcon data-icon="inline-start" />
                {saving ? 'Adding…' : added ? 'In your plan' : 'Add to my plan'}
              </Button>
            )}
            {plan?.status === 'failed' && (
              <p role="alert" className="text-xs font-medium">{plan.message}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <strong className={`text-[15px] leading-snug font-medium ${NUMERALS}`}>{dayLabel(`${date}T12:00:00`, true)}</strong>
          <p className="text-muted-foreground text-xs">Nothing is scheduled on this day in the sources you have switched on.</p>
        </>
      )}
    </section>
  )
}

export default function CalendarPage() {
  const apiRef = useRef<GridApi | null>(null)
  const [payload, setPayload] = useState<(CalendarPayload & { categories: Record<string, string> }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<string>(() => calendarView(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('view')))
  const [date, setDate] = useState<Date>(new Date())
  const [title, setTitle] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [plan, setPlan] = useState<PlanState | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/calendar/events', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Your calendar returned ${response.status}`))))
      .then((data) => { if (live) setPayload(data) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const events = useMemo(
    () => (payload?.events ?? []).filter((event) => !hidden.has(event.category)),
    [payload, hidden]
  )

  // Counts describe everything the feed holds, not what is currently shown, so
  // switching a category off does not make its own count disappear.
  const counts = useMemo(() => {
    const tally: Record<string, number> = {}
    for (const event of payload?.events ?? []) tally[event.category] = (tally[event.category] ?? 0) + 1
    return tally
  }, [payload])

  /** The header's secondary line names what the feed is actually made of. */
  const sourceLine = useMemo(() => {
    if (!payload) return 'Your exams, timetable, Canvas deadlines and the institution calendar, in one feed.'
    const named = Object.entries(payload.categories).filter(([id]) => counts[id]).map(([, label]) => label)
    if (!named.length) return 'No calendar sources have supplied a date yet.'
    return `${named.slice(0, 4).join(', ')}${named.length > 4 ? `, and ${named.length - 4} more` : ''}.`
  }, [payload, counts])

  const move = useCallback((action: 'prev' | 'next' | 'today') => {
    const api = apiRef.current
    if (!api) return
    api[action]()
    setDate(api.getDate())
    setTitle(api.view.title)
  }, [])

  const goTo = (next: Date | undefined) => {
    if (!next) return
    setDate(next)
    const api = apiRef.current
    api?.gotoDate(next)
    if (api) setTitle(api.view.title)
  }

  const toggleCategory = (id: string, checked: boolean) => setHidden((previous) => {
    const next = new Set(previous)
    if (checked) next.delete(id)
    else next.add(id)
    return next
  })

  /**
   * A read-only institution date, copied into the student's own record.
   * Planning owns that record, so this is the same read-modify-write it does:
   * the whole workspace under the revision it was read at, which the server
   * rejects if anything else has moved in the meantime.
   */
  async function addToPlan(event: CalendarEvent) {
    setPlan({ id: event.id, status: 'saving' })
    try {
      const response = await fetch('/api/academics', { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`Your record returned ${response.status}`)
      const { workspace } = await response.json()
      const next = {
        ...workspace,
        events: [
          ...(workspace.events ?? []),
          eventRecord({
            title: event.title,
            date: event.start.slice(0, 10),
            endDate: event.end ? event.end.slice(0, 10) : '',
            type: event.category,
            notes: event.notes ?? ''
          })
        ]
      }
      const saved = await fetch('/api/academics', {
        method: 'PUT',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: next, expectedRevision: workspace.revision })
      })
      const body = await saved.json().catch(() => null)
      if (!saved.ok) throw new Error(body?.error || `Your record returned ${saved.status}`)
      setPlan({ id: event.id, status: 'done' })
    } catch (cause) {
      setPlan({ id: event.id, status: 'failed', message: `It was not added. ${(cause as Error).message}` })
    }
  }

  function dismissChange(id: string) {
    setPayload((held) => held ? { ...held, changes: (held.changes ?? []).filter((change) => change.id !== id) } : held)
    void fetch(`/api/calendar/changes/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { accept: 'application/json' } })
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Your calendar could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const detail = (
    <EventDetail
      selected={selected}
      date={selectedDate}
      plan={plan}
      onAddToPlan={(event) => void addToPlan(event)}
      onClose={() => { setSelected(null); setSelectedDate(null); setPlan(null) }}
    />
  )

  const sources = (idPrefix: string) => payload && Object.entries(payload.categories)
    .filter(([id]) => counts[id])
    .map(([id, label]) => (
      <li key={id} className="flex min-w-0 items-center gap-2.5">
        <Checkbox
          id={`${idPrefix}-${id}`}
          checked={!hidden.has(id)}
          onCheckedChange={(checked: boolean) => toggleCategory(id, checked)}
        />
        <label htmlFor={`${idPrefix}-${id}`} className="min-w-0 flex-1 cursor-pointer truncate text-sm">{label}</label>
        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{counts[id]}</span>
      </li>
    ))

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-4 p-3 sm:p-6 md:h-dvh">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Calendar</h1>
          <p className="text-muted-foreground text-sm">{sourceLine}</p>
        </div>
        {payload && (
          <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
            {payload.events.length} dated {payload.events.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </header>

      <TimetableChanges changes={payload?.changes ?? []} onDismiss={dismissChange} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => move('prev')} disabled={!ready} aria-label="Previous"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon" onClick={() => move('next')} disabled={!ready} aria-label="Next"><ChevronRightIcon /></Button>
          <Button variant="outline" onClick={() => move('today')} disabled={!ready}>Today</Button>
        </div>
        <h2 className={`text-lg font-semibold tracking-tight ${NUMERALS}`}>{title || '—'}</h2>
        <div className="ml-auto max-w-full overflow-x-auto">
          <ToggleGroup value={[view]} variant="outline" onValueChange={(value) => {
            const next = value.at(-1)
            if (!next) return
            setView(next)
            const url = new URL(window.location.href)
            url.searchParams.set('view', next)
            window.history.replaceState(null, '', url)
            const api = apiRef.current
            api?.changeView(next)
            if (api) setTitle(api.view.title)
          }}>
            {VIEWS.map((entry) => <ToggleGroupItem key={entry.id} value={entry.id} disabled={!ready}>{entry.label}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <details className="border-y py-2 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">Visible calendar sources</summary>
        <ul className="mt-3 grid grid-cols-2 gap-2 pb-1">{sources('mobile-cat')}</ul>
      </details>

      {/* Below the rail's breakpoint the detail panel is the page's own row. */}
      <div className="lg:hidden">{detail}</div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto lg:flex">
          <DatePicker mode="single" selected={date} onSelect={goTo} weekStartsOn={1} className="p-0" />

          <section className="flex flex-col gap-2">
            <h2 className={RULE}>Sources</h2>
            {!payload ? <Skeleton className="h-40 w-full" /> : <ul className="flex flex-col gap-1.5">{sources('cat')}</ul>}
          </section>

          {detail}
        </aside>

        <div className="min-h-0 min-w-0" data-fc>
          <CalendarGrid
            apiRef={apiRef}
            view={view}
            events={events}
            onSelectEvent={(event) => { setSelectedDate(null); setPlan(null); setSelected(event) }}
            onSelectDate={(day) => { setSelected(null); setPlan(null); setSelectedDate(day) }}
            onTitle={setTitle}
            onReady={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  )
}
