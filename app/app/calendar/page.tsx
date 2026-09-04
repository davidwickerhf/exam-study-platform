'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { BookOpenIcon, CalendarPlusIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, Clock3Icon, ExternalLinkIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Calendar as DatePicker } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { eventRecord } from '@/lib/workspace/academics.mjs'
import { cn } from '@/lib/utils'
import { type CalendarEvent, type CalendarPayload, localIsoDate, roomOf } from '@/lib/workspace/home.mjs'
import type { GridApi } from './calendar-grid'

const VIEWS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Today' },
  { id: 'listMonth', label: 'Agenda' }
] as const

const calendarView = (requested: string | null) => VIEWS.some(({ id }) => id === requested) ? requested! : 'timeGridWeek'
const NUMERALS = 'font-data tabular-nums'
const LABEL = 'text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase'
const INSTITUTION = new Set(['exam-week', 'period', 'study-week', 'holiday', 'ceremony', 'registration', 'institution'])
type AttendanceStatus = 'unknown' | 'attended' | 'missed' | 'excused'
type PlanState = { id: string; status: 'saving' | 'done' | 'failed'; message?: string }

function GridSkeleton() {
  return <div className="grid h-full grid-cols-7 gap-px" aria-hidden="true">{Array.from({ length: 35 }).map((_, index) => <Skeleton key={index} className="min-h-16 rounded-none" />)}</div>
}

const CalendarGrid = dynamic(() => import('./calendar-grid'), { ssr: false, loading: GridSkeleton })

function fullDay(value: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)).replace(/^([^ ]+) /, '$1, ')
}

function eventTime(event: CalendarEvent) {
  if (event.allDay) return 'All day'
  const format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return [format.format(new Date(event.start)), event.end ? format.format(new Date(event.end)) : null].filter(Boolean).join('–')
}

function attendanceLabel(status?: AttendanceStatus) {
  if (status === 'attended') return 'Attended'
  if (status === 'missed') return 'Missed'
  if (status === 'excused') return 'Excused'
  return 'Not marked'
}

function AttendanceButtons({ event, saving, onMark }: { event: CalendarEvent; saving: boolean; onMark: (status: AttendanceStatus) => void }) {
  const future = new Date(event.start).getTime() > Date.now()
  return (
    <section className="border-b px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Attendance</h3>
        <span className={cn('rounded-md px-2 py-1 text-[10px] font-semibold tracking-[0.07em] uppercase', event.attendanceRequired ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{event.attendanceRequired ? 'Required' : 'Personal record'}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border">
        {(['attended', 'missed', 'excused'] as const).map((status) => (
          <button key={status} type="button" disabled={saving || future} onClick={() => onMark(status)} className={cn('flex h-9 items-center justify-center gap-1 border-r text-xs font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-45', event.attendanceStatus === status ? 'bg-foreground text-card' : 'bg-card text-muted-foreground hover:bg-muted')}>
            {status === 'attended' && <CheckIcon className="size-3.5" />}{attendanceLabel(status)}
          </button>
        ))}
      </div>
      {event.attendanceStatus && event.attendanceStatus !== 'unknown' && <button type="button" disabled={saving} onClick={() => onMark('unknown')} className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-[11px] font-medium hover:text-foreground"><RotateCcwIcon className="size-3" /> Clear attendance mark</button>}
      {future && <p className="text-muted-foreground mt-2 text-xs">Attendance can be marked when this session begins.</p>}
      {event.attendanceRequired && event.attendanceRule && (
        <details className="mt-4 border-t pt-3">
          <summary className="cursor-pointer text-xs font-semibold">Why attendance is required</summary>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{event.attendanceRule}</p>
          <p className={`text-primary mt-2 text-[11px] font-semibold ${NUMERALS}`}>{event.attendancePolicy?.source || 'Verified course rule'}</p>
        </details>
      )}
    </section>
  )
}

function DayDesk({ selected, selectedDate, dayEvents, plan, attendanceSaving, attendanceError, onSelect, onMark, onAddToPlan, onClear }: {
  selected: CalendarEvent | null
  selectedDate: string
  dayEvents: CalendarEvent[]
  plan: PlanState | null
  attendanceSaving: boolean
  attendanceError: string | null
  onSelect: (event: CalendarEvent) => void
  onMark: (status: AttendanceStatus) => void
  onAddToPlan: (event: CalendarEvent) => void
  onClear: () => void
}) {
  const deadlines = dayEvents.filter((event) => ['deadline', 'canvas-deadline', 'exam'].includes(event.category))
  const attendanceDue = dayEvents.filter((event) => event.attendanceEligible && new Date(event.start).getTime() <= Date.now() && (!event.attendanceStatus || event.attendanceStatus === 'unknown'))
  return (
    <aside className="bg-card h-full min-h-0 overflow-y-auto border-l" aria-label="Day desk">
      <header className="flex min-h-[88px] items-start justify-between gap-4 border-b px-5 py-5">
        <div className="min-w-0"><p className={LABEL}>{selected ? 'Selected event' : 'Day desk'}</p><h2 className="font-heading mt-1.5 text-[23px] leading-[1.05] font-semibold tracking-[-0.025em]">{selected ? selected.courseName || selected.title : fullDay(selectedDate)}</h2></div>
        {selected && <button type="button" onClick={onClear} className="text-muted-foreground grid size-8 shrink-0 place-items-center hover:text-foreground" aria-label="Back to day summary"><ChevronRightIcon className="size-4" /></button>}
      </header>
      {selected ? (
        <>
          <section className="border-b px-5 py-5">
            <div className="grid gap-4">
              <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2.5"><Clock3Icon className="text-muted-foreground size-4" /><span><strong className={`block text-sm ${NUMERALS}`}>{eventTime(selected)}</strong><small className="text-muted-foreground mt-0.5 block text-xs">{fullDay(selected.start.slice(0, 10))}</small></span></div>
              {selected.courseCode && <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2.5"><BookOpenIcon className="text-muted-foreground size-4" /><span><strong className={`block text-sm ${NUMERALS}`}>{selected.courseCode}</strong><small className="text-muted-foreground mt-0.5 block text-xs">{roomOf(selected) || selected.courseName}</small></span></div>}
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">{selected.notes || 'No additional details were supplied by this source.'}</p>
          </section>
          {selected.attendanceEligible && <AttendanceButtons event={selected} saving={attendanceSaving} onMark={onMark} />}
          {attendanceError && <p role="alert" className="text-destructive border-b px-5 py-3 text-xs">{attendanceError}</p>}
          <section className="flex flex-wrap gap-2 border-b px-5 py-5">
            {selected.href && <Link href={selected.href} className={buttonVariants({ size: 'sm' })}>Open in Wicker</Link>}
            {selected.externalHref && <a href={selected.externalHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Open in Canvas <ExternalLinkIcon data-icon="inline-end" /></a>}
            {INSTITUTION.has(selected.category) && <Button size="sm" variant="outline" disabled={plan?.status === 'saving' || plan?.status === 'done'} onClick={() => onAddToPlan(selected)}><CalendarPlusIcon data-icon="inline-start" />{plan?.status === 'saving' ? 'Adding…' : plan?.status === 'done' ? 'In your plan' : 'Add to plan'}</Button>}
            {selected.attendanceEligible && selected.editorialCourseId && <Link href={`/app/courses/${selected.editorialCourseId}#attendance`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Course attendance</Link>}
          </section>
          {plan?.status === 'failed' && <p role="alert" className="text-destructive border-b px-5 py-3 text-xs">{plan.message}</p>}
        </>
      ) : (
        <>
          <dl className="grid grid-cols-3 border-b">
            {[['Items', dayEvents.length], ['Deadlines', deadlines.length], ['Unmarked', attendanceDue.length]].map(([label, value]) => <div key={label} className="border-r px-3 py-4 last:border-r-0"><dd className={`text-xl font-semibold ${NUMERALS}`}>{value}</dd><dt className="text-muted-foreground mt-1 text-[10px]">{label}</dt></div>)}
          </dl>
          {(deadlines.length > 0 || attendanceDue.length > 0) && <section className="bg-accent/45 border-b px-5 py-4"><div className="flex items-start gap-2.5"><CircleAlertIcon className="text-primary mt-0.5 size-4 shrink-0" /><div><h3 className="text-sm font-semibold">{deadlines.length ? `${deadlines.length} ${deadlines.length === 1 ? 'deadline' : 'deadlines'} on this day` : `${attendanceDue.length} attendance ${attendanceDue.length === 1 ? 'mark' : 'marks'} needed`}</h3><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Open an item to inspect its source and take action.</p></div></div></section>}
          <section>
            <div className="flex items-center justify-between border-b px-5 py-3"><h3 className="text-sm font-semibold">Schedule</h3><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{dayEvents.length}</span></div>
            {dayEvents.length ? dayEvents.map((event) => <button key={event.id} type="button" onClick={() => onSelect(event)} className="grid w-full grid-cols-[3.25rem_3px_minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-3 text-left hover:bg-muted/55"><span className={`text-xs font-semibold ${NUMERALS}`}>{eventTime(event).split('–')[0]}</span><i className={cn('h-9 rounded-full bg-muted-foreground', ['deadline', 'canvas-deadline', 'exam'].includes(event.category) ? 'bg-destructive' : event.attendanceRequired ? 'bg-primary' : '')} /><span className="min-w-0"><strong className="block truncate text-xs">{event.courseName || event.title}</strong><small className="text-muted-foreground mt-0.5 block truncate text-[10px]">{[event.courseCode, event.activity, event.attendanceEligible ? attendanceLabel(event.attendanceStatus) : null].filter(Boolean).join(' · ')}</small></span><ChevronRightIcon className="text-muted-foreground size-3.5" /></button>) : <p className="text-muted-foreground px-5 py-6 text-sm">Nothing is scheduled on this day.</p>}
          </section>
        </>
      )}
    </aside>
  )
}

export default function CalendarPage() {
  const apiRef = useRef<GridApi | null>(null)
  const today = localIsoDate()
  const [payload, setPayload] = useState<(CalendarPayload & { categories: Record<string, string> }) | null>(null)
  const [academicRevision, setAcademicRevision] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<string>(() => calendarView(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('view')))
  const [date, setDate] = useState<Date>(new Date())
  const [title, setTitle] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [ready, setReady] = useState(false)
  const [plan, setPlan] = useState<PlanState | null>(null)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)

  const loadCalendar = useCallback(async (preferredEventId?: string | null) => {
    const response = await fetch('/api/calendar/events', { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`Your calendar returned ${response.status}`)
    const data = await response.json()
    setPayload(data)
    if (preferredEventId) setSelected(data.events.find((event: CalendarEvent) => event.id === preferredEventId) || null)
    return data
  }, [])

  useEffect(() => {
    let live = true
    Promise.all([
      fetch('/api/calendar/events', { headers: { accept: 'application/json' } }).then((response) => response.ok ? response.json() : Promise.reject(new Error(`Your calendar returned ${response.status}`))),
      fetch('/api/academics', { headers: { accept: 'application/json' } }).then((response) => response.ok ? response.json() : null)
    ]).then(([calendar, academics]) => { if (live) { setPayload(calendar); setAcademicRevision(academics?.workspace?.revision ?? null) } }).catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const events = useMemo(() => (payload?.events ?? []).filter((event) => !hidden.has(event.category)), [payload, hidden])
  const counts = useMemo(() => { const tally: Record<string, number> = {}; for (const event of payload?.events ?? []) tally[event.category] = (tally[event.category] ?? 0) + 1; return tally }, [payload])
  const dayEvents = useMemo(() => events.filter((event) => event.start.slice(0, 10) === selectedDate).sort((left, right) => left.start.localeCompare(right.start)), [events, selectedDate])

  const move = useCallback((action: 'prev' | 'next' | 'today') => {
    const api = apiRef.current
    if (!api) return
    api[action](); setDate(api.getDate()); setTitle(api.view.title)
    if (action === 'today') setSelectedDate(today)
  }, [today])

  const goTo = (next: Date | undefined) => {
    if (!next) return
    setDate(next); setSelected(null); setSelectedDate(localIsoDate(next)); apiRef.current?.gotoDate(next)
    if (apiRef.current) setTitle(apiRef.current.view.title)
  }

  function changeView(next: string) {
    setView(next)
    const url = new URL(window.location.href); url.searchParams.set('view', next); window.history.replaceState(null, '', url)
    const api = apiRef.current; api?.changeView(next)
    if (next === 'timeGridDay') { api?.today(); setDate(new Date()); setSelectedDate(today); setSelected(null) }
    if (api) setTitle(api.view.title)
  }

  async function markAttendance(status: AttendanceStatus) {
    if (!selected || academicRevision === null || attendanceSaving) return
    setAttendanceSaving(true); setAttendanceError(null)
    try {
      const response = await fetch('/api/attendance', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ event: selected, status, expectedRevision: academicRevision }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Attendance returned ${response.status}`)
      setAcademicRevision(body.workspace.revision)
      await loadCalendar(selected.id)
    } catch (cause) { setAttendanceError((cause as Error).message) }
    finally { setAttendanceSaving(false) }
  }

  async function addToPlan(event: CalendarEvent) {
    setPlan({ id: event.id, status: 'saving' })
    try {
      const response = await fetch('/api/academics', { headers: { accept: 'application/json' } }); if (!response.ok) throw new Error(`Your record returned ${response.status}`)
      const { workspace } = await response.json()
      const next = { ...workspace, events: [...(workspace.events ?? []), eventRecord({ title: event.title, date: event.start.slice(0, 10), endDate: event.end ? event.end.slice(0, 10) : '', type: event.category, notes: event.notes ?? '' })] }
      const saved = await fetch('/api/academics', { method: 'PUT', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ workspace: next, expectedRevision: workspace.revision }) })
      const body = await saved.json().catch(() => null); if (!saved.ok) throw new Error(body?.error || `Your record returned ${saved.status}`)
      setAcademicRevision(body.workspace.revision); setPlan({ id: event.id, status: 'done' })
    } catch (cause) { setPlan({ id: event.id, status: 'failed', message: `It was not added. ${(cause as Error).message}` }) }
  }

  if (error) return <div className="mx-auto w-full max-w-[1400px] p-5 sm:p-8"><Empty><EmptyHeader><EmptyTitle>Your calendar could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty></div>

  const sources = (prefix: string) => payload && Object.entries(payload.categories).filter(([id]) => counts[id]).map(([id, label]) => <li key={id} className="flex min-w-0 items-center gap-2.5"><Checkbox id={`${prefix}-${id}`} checked={!hidden.has(id)} onCheckedChange={(checked: boolean) => setHidden((current) => { const next = new Set(current); if (checked) next.delete(id); else next.add(id); return next })} /><label htmlFor={`${prefix}-${id}`} className="min-w-0 flex-1 cursor-pointer truncate text-xs">{label}</label><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{counts[id]}</span></li>)
  const summary = payload?.attendance?.summary

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col md:h-dvh">
      <header className="bg-background flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/app/planning" className={cn(buttonVariants(), 'hidden sm:inline-flex')}><PlusIcon data-icon="inline-start" />Create</Link>
          <Button variant="outline" onClick={() => move('today')} disabled={!ready}>Today</Button>
          <div className="flex"><Button variant="ghost" size="icon" onClick={() => move('prev')} disabled={!ready} aria-label="Previous"><ChevronLeftIcon /></Button><Button variant="ghost" size="icon" onClick={() => move('next')} disabled={!ready} aria-label="Next"><ChevronRightIcon /></Button></div>
          <h1 className={`font-heading ml-1 text-xl font-semibold tracking-[-0.025em] ${NUMERALS}`}>{title || 'Calendar'}</h1>
        </div>
        <div className="bg-card flex overflow-x-auto rounded-lg border p-1" role="tablist" aria-label="Calendar view">
          {VIEWS.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={view === entry.id} disabled={!ready} onClick={() => changeView(entry.id)} className={cn('h-8 min-w-16 rounded-md px-3 text-xs font-semibold disabled:opacity-50', view === entry.id ? 'bg-foreground text-card' : 'text-muted-foreground hover:text-foreground')}>{entry.label}</button>)}
        </div>
      </header>
      <details className="bg-card shrink-0 border-b px-4 py-2 lg:hidden"><summary className="cursor-pointer text-sm font-semibold">Calendar sources</summary><ul className="mt-3 grid grid-cols-2 gap-2 pb-2">{sources('mobile')}</ul></details>
      {selected && <div className="bg-card fixed inset-x-0 bottom-16 z-30 max-h-[70dvh] overflow-y-auto border-t shadow-[var(--shadow-sheet)] lg:hidden"><DayDesk selected={selected} selectedDate={selectedDate} dayEvents={dayEvents} plan={plan} attendanceSaving={attendanceSaving} attendanceError={attendanceError} onSelect={setSelected} onMark={(status) => void markAttendance(status)} onAddToPlan={(event) => void addToPlan(event)} onClear={() => { setSelected(null); setPlan(null); setAttendanceError(null) }} /></div>}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_290px] 2xl:grid-cols-[214px_minmax(0,1fr)_310px]">
        <aside className="bg-card hidden min-h-0 overflow-y-auto border-r 2xl:block">
          <div className="border-b p-4"><DatePicker mode="single" selected={date} onSelect={goTo} weekStartsOn={1} className="p-0" /></div>
          <section className="border-b px-5 py-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Calendars</h2><PlusIcon className="text-muted-foreground size-4" /></div>{payload ? <ul className="flex flex-col gap-2.5">{sources('desktop')}</ul> : <Skeleton className="h-36 w-full" />}</section>
          <section className="px-5 py-5">
            <p className={LABEL}>Attendance</p>
            <div className="mt-2 flex items-end justify-between gap-3"><div><strong className="block text-sm">{summary?.atRiskCourses ? 'Needs attention' : 'On track'}</strong><span className="text-muted-foreground mt-1 block text-[11px]">{summary ? `${summary.missed} missed · ${summary.unmarked} unmarked` : 'Checking your record'}</span></div><strong className={`text-2xl ${NUMERALS}`}>{summary?.rate == null ? '—' : `${summary.rate}%`}</strong></div>
            <Link href="/app/courses" className="text-primary mt-3 inline-flex text-xs font-semibold">View by course</Link>
          </section>
        </aside>
        <main className="bg-card min-h-0 min-w-0 overflow-hidden" data-fc>
          <CalendarGrid apiRef={apiRef} view={view} events={events} onSelectEvent={(event) => { setPlan(null); setAttendanceError(null); setSelected(event); setSelectedDate(event.start.slice(0, 10)) }} onSelectDate={(day) => { setSelected(null); setPlan(null); setSelectedDate(day) }} onTitle={setTitle} onReady={() => setReady(true)} />
        </main>
        <div className="hidden min-h-0 lg:block"><DayDesk selected={selected} selectedDate={selectedDate} dayEvents={dayEvents} plan={plan} attendanceSaving={attendanceSaving} attendanceError={attendanceError} onSelect={(event) => { setSelected(event); setAttendanceError(null) }} onMark={(status) => void markAttendance(status)} onAddToPlan={(event) => void addToPlan(event)} onClear={() => { setSelected(null); setPlan(null); setAttendanceError(null) }} /></div>
      </div>
    </div>
  )
}
