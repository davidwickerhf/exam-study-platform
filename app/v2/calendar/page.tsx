'use client'

/**
 * Calendar, migrated.
 *
 * Two different jobs, two different components. shadcn's Calendar is
 * react-day-picker — a date picker — which is exactly right for choosing which
 * week to look at, and cannot lay out timed events. The scheduling grid stays
 * on FullCalendar, which already handles the time axis, overlaps, the all-day
 * row and the now-indicator; it is themed into the board world rather than
 * rebuilt.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { EventClickArg } from '@fullcalendar/core'
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as DatePicker } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type CalendarEvent, type CalendarPayload, localIsoDate, roomOf } from '@/lib/v2/home.mjs'

const VIEWS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Day' },
  { id: 'listWeek', label: 'Agenda' }
] as const

const NUMERALS = 'font-data tabular-nums'

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const [payload, setPayload] = useState<(CalendarPayload & { categories: Record<string, string> }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<string>('timeGridWeek')
  const [date, setDate] = useState<Date>(new Date())
  const [title, setTitle] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/calendar/events', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Your calendar returned ${response.status}`))))
      .then((data) => { if (live) setPayload(data) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const events = useMemo(
    () => (payload?.events ?? [])
      .filter((event) => !hidden.has(event.category))
      .map((event) => ({
        id: event.id,
        title: event.courseCode && event.category === 'timetable' ? `${event.courseCode} · ${event.courseName ?? event.title}` : event.title,
        start: event.start,
        end: event.end ?? undefined,
        allDay: event.allDay,
        extendedProps: event
      })),
    [payload, hidden]
  )

  // Counts describe everything the feed holds, not what is currently shown, so
  // switching a category off does not make its own count disappear.
  const counts = useMemo(() => {
    const tally: Record<string, number> = {}
    for (const event of payload?.events ?? []) tally[event.category] = (tally[event.category] ?? 0) + 1
    return tally
  }, [payload])

  const move = (action: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api[action]()
    setDate(api.getDate())
    setTitle(api.view.title)
  }

  const goTo = (next: Date | undefined) => {
    if (!next) return
    setDate(next)
    const api = calendarRef.current?.getApi()
    api?.gotoDate(next)
    if (api) setTitle(api.view.title)
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] p-8">
        <Empty><EmptyHeader><EmptyTitle>{error}</EmptyTitle></EmptyHeader></Empty>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => move('prev')} aria-label="Previous"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon" onClick={() => move('next')} aria-label="Next"><ChevronRightIcon /></Button>
          <Button variant="outline" onClick={() => move('today')}>Today</Button>
        </div>
        <h1 className={`text-lg font-semibold tracking-tight ${NUMERALS}`}>{title || '\u2014'}</h1>
        <div className="ml-auto">
          <ToggleGroup value={[view]} variant="outline" onValueChange={(value) => {
            const next = value.at(-1)
            if (!next) return
            setView(next)
            const api = calendarRef.current?.getApi()
            api?.changeView(next)
            if (api) setTitle(api.view.title)
          }}>
            {VIEWS.map((entry) => <ToggleGroupItem key={entry.id} value={entry.id}>{entry.label}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <DatePicker mode="single" selected={date} onSelect={goTo} weekStartsOn={1} className="p-0" />

          <section className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Sources</h2>
            {!payload ? <Skeleton className="h-40 w-full" /> : (
              <ul className="flex flex-col gap-1.5">
                {Object.entries(payload.categories)
                  .filter(([id]) => counts[id])
                  .map(([id, label]) => (
                    <li key={id} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`cat-${id}`}
                        checked={!hidden.has(id)}
                        onCheckedChange={(checked) => setHidden((previous) => {
                          const next = new Set(previous)
                          if (checked) next.delete(id)
                          else next.add(id)
                          return next
                        })}
                      />
                      <label htmlFor={`cat-${id}`} className="flex-1 cursor-pointer text-sm">{label}</label>
                      <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{counts[id]}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          {selected && (
            <section className="flex flex-col gap-1.5 border-t pt-4">
              <h2 className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Selected</h2>
              <strong className="text-[15px] leading-snug font-medium">{selected.title}</strong>
              <p className={`text-muted-foreground text-xs ${NUMERALS}`}>
                {new Intl.DateTimeFormat('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  ...(selected.allDay ? {} : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
                }).format(new Date(selected.start))}
              </p>
              {roomOf(selected) && <p className="text-muted-foreground text-xs">{roomOf(selected)}</p>}
              {selected.externalHref && (
                <a href={selected.externalHref} target="_blank" rel="noopener noreferrer" className="text-primary mt-1 inline-flex items-center gap-1.5 text-xs font-semibold">
                  Open in Canvas <ExternalLinkIcon className="size-3.5" />
                </a>
              )}
            </section>
          )}
        </aside>

        <div className="min-h-0 min-w-0" data-fc>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView={view}
            headerToolbar={false}
            events={events}
            height="100%"
            firstDay={1}
            nowIndicator
            expandRows
            stickyHeaderDates
            allDaySlot
            slotDuration="01:00:00"
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            scrollTime="08:00:00"
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: false }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            dayMaxEvents
            slotEventOverlap={false}
            eventClick={(info: EventClickArg) => {
              info.jsEvent.preventDefault()
              setSelected(info.event.extendedProps as CalendarEvent)
            }}
            datesSet={(info) => setTitle(info.view.title)}
          />
        </div>
      </div>
    </div>
  )
}
